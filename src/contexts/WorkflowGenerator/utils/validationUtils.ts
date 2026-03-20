/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ExecutionConfig, ExecutionData, WorkflowNode } from "@/types";
import type { UpdateWorkflowResponse } from "@/types/ai";
import type { DecisionNodeData } from "@/types/nodes";
import { isExecutionConfig } from "./typeGuards";
import { generatePanelCode } from "@/utils/workflow/codeGenerators";

// ============================================
// AI FIX APPLICATION
// ============================================

/**
 * Apply AI fix response to current node list.
 *
 * Order: delete → update → create
 * - delete: removes nodes first so orphaned refs are exposed to next validation cycle
 * - update: merges data and parentNode in-place
 * - create: adds new nodes, skipping ID collisions
 */
export function applyAIFixes(
  nodes: WorkflowNode[],
  response: UpdateWorkflowResponse,
): WorkflowNode[] {
  let result = [...nodes];

  // 1. Delete first (orphaned refs will be caught by next iteration)
  const deleteSet = new Set(response.nodes.delete ?? []);
  result = result.filter((n) => !deleteSet.has(n.id));

  // 2. Update in-place (merge data, optionally reassign parentNode)
  // AI responds in flat format (functionCode, inputData, outputData at top level of data).
  // Map flat fields → nested WorkflowNode path: data.execution.config.*
  for (const update of response.nodes.update ?? []) {
    const idx = result.findIndex((n) => n.id === update.id);
    if (idx >= 0) {
      const { functionCode, inputData, outputData, title, ...restData } =
        (update.data ?? {}) as any;
      const existingConfig = result[idx].data?.execution?.config ?? {};
      const existingNodeData =
        (existingConfig as ExecutionConfig)?.nodeData ?? {};

      const hasExecutionFields =
        functionCode !== undefined ||
        inputData !== undefined ||
        outputData !== undefined;

      const rawParentNode = (update as any).parentNode;
      // Allow AI to explicitly remove parentNode by sending null (JSON null → undefined = root node)
      const resolvedParentNode =
        rawParentNode !== undefined
          ? rawParentNode !== null
            ? rawParentNode
            : undefined
          : result[idx].parentNode;

      // Guard: never overwrite functionCode with null/empty string.
      // The AI is instructed not to send functionCode: "" but may do so accidentally.
      // A null/empty functionCode update is always a mistake — preserve existing.
      const resolvedFunctionCode =
        functionCode !== undefined && functionCode !== null && String(functionCode).trim() !== ""
          ? functionCode
          : undefined;

      result[idx] = {
        ...result[idx],
        parentNode: resolvedParentNode,
        data: {
          ...result[idx].data,
          ...(title !== undefined ? { title } : {}),
          ...restData,
          ...(hasExecutionFields
            ? {
                execution: {
                  ...result[idx].data?.execution,
                  config: {
                    ...existingConfig,
                    ...(resolvedFunctionCode !== undefined ? { functionCode: resolvedFunctionCode } : {}),
                    nodeData: {
                      ...existingNodeData,
                      ...(inputData !== undefined ? { inputData } : {}),
                      ...(outputData !== undefined ? { outputData } : {}),
                    },
                  },
                },
              }
            : {}),
        },
      };
    }
  }

  // 3. Create (skip if ID already exists)
  for (const newNode of response.nodes.create ?? []) {
    if (!result.find((n) => n.id === newNode.id)) {
      result.push(newNode);
    }
  }

  return result;
}

// ============================================
// EXECUTION CONFIG UTILITIES (from dataFlowUtils.ts)
// ============================================

/**
 * Safely extract execution config from a node
 * Returns the config object or null if not present
 *
 * Uses runtime type checking to ensure type safety without assertions
 */
export function getExecutionConfig(node: WorkflowNode): ExecutionConfig | null {
  const config = node.data?.execution?.config;

  if (!config) return null;

  // Validate structure matches ExecutionConfig
  if (!isExecutionConfig(config)) return null;

  return config;
}

// ============================================
// FUNCTION CODE PARSING UTILITIES (from functionCodeParser.ts)
// ============================================

/**
 * Extract all inputData field references from functionCode
 * Finds patterns like: inputData.fieldName
 *
 * @param functionCode - JavaScript function code as string
 * @returns Set of referenced field names
 */
export function extractInputDataReferences(functionCode: string): Set<string> {
  const regex = /inputData\.(\w+)/g;
  const referencedFields = new Set<string>();
  let match;

  while ((match = regex.exec(functionCode)) !== null) {
    referencedFields.add(match[1]);
  }

  return referencedFields;
}


// ============================================
// AI RESPONSE SANITY CHECK
// ============================================

/**
 * Pre-validate AI response before applying fixes.
 *
 * Catches common failure modes that would cause applyAIFixes to silently no-op:
 * 1. Empty response — all arrays empty, nothing to apply
 * 2. Coverage gap — none of the violated nodes are touched by update/delete
 * 3. Ghost updates — all update targets are non-existent node IDs
 *
 * @param response - AI update response
 * @param workingNodes - Current node list
 * @param allAffectedIds - IDs of nodes flagged by validators
 * @returns { valid: true } or { valid: false, reason: string }
 */
export function checkAIResponseSanity(
  response: UpdateWorkflowResponse,
  workingNodes: WorkflowNode[],
  allAffectedIds: string[],
): { valid: boolean; reason?: string } {
  const updates = response.nodes.update ?? [];
  const creates = response.nodes.create ?? [];
  const deletes = response.nodes.delete ?? [];

  // 1. Empty response
  if (updates.length === 0 && creates.length === 0 && deletes.length === 0) {
    return { valid: false, reason: "empty response (no operations)" };
  }

  // 2. Coverage gap: none of the violated nodes are touched by update/delete/create
  // Note: creates that target an affected node as parentNode count as valid coverage
  // (this is how GroupNode Min Children is fixed — by adding child nodes, not updating the group)
  if (allAffectedIds.length > 0) {
    const touchedIds = new Set([...updates.map((u) => u.id), ...deletes]);
    const affectedSet = new Set(allAffectedIds);
    const anyTouched =
      allAffectedIds.some((id) => touchedIds.has(id)) ||
      creates.some((c) => affectedSet.has(c.parentNode ?? ""));
    if (!anyTouched) {
      return {
        valid: false,
        reason: `no affected nodes touched (affected: ${allAffectedIds.join(", ")})`,
      };
    }
  }

  // 3. Ghost updates: all update targets are non-existent node IDs
  if (updates.length > 0) {
    const workingIds = new Set(workingNodes.map((n) => n.id));
    const allGhost = updates.every((u) => !workingIds.has(u.id));
    if (allGhost) {
      return {
        valid: false,
        reason: `all update targets are non-existent: ${updates.map((u) => u.id).join(", ")}`,
      };
    }
  }

  return { valid: true };
}

// ============================================
// DETERMINISTIC CODE GENERATION
// ============================================

/**
 * Unconditionally generate functionCode for service and decision nodes.
 *
 * Service nodes: always generate from data.http via generatePanelCode("service", data).
 *   Also rescues misplaced functionCode from top-level data to execution.config.
 * Decision nodes: always generate from data.condition + force outputData = true.
 *
 * Called early (before validation) and after every applyAIFixes call so that
 * AI never needs to write functionCode for these node types.
 */
export function applyDeterministicCodeGeneration(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  return nodes.map((node) => {
    // --- Service Node ---
    if (node.type === "service") {
      const config = node.data.execution?.config;

      // Detect functionCode placed at the wrong top-level position

      const misplacedCode = (
        (node.data as any).functionCode as string | undefined
      )?.trim();

      // Always generate from http config
      const code = generatePanelCode("service", node.data);
      if (!code) return node;

      // Strip misplaced top-level functionCode if present

      let baseData: typeof node.data = node.data;
      if (misplacedCode) {
        const { functionCode: _removed, ...restData } = node.data as any;
        baseData = restData as typeof node.data;
        console.log(
          `[applyDeterministicCodeGeneration] Rescuing misplaced functionCode for service node ${node.id}`,
        );
      }

      return {
        ...node,
        data: {
          ...baseData,
          execution: {
            ...node.data.execution,
            config: {
              ...config,
              functionCode: code,
            },
          },
        },
      } satisfies { data: { execution: ExecutionData } };
    }

    // --- Decision Node ---
    if (node.type === "decision") {
      const config = getExecutionConfig(node);
      if (!config) return node;

      const condition = (node.data as DecisionNodeData).condition ?? {};
      const code =
        generatePanelCode("decision", { condition }) ?? "return false;";

      return {
        ...node,
        data: {
          ...node.data,
          execution: {
            ...node.data?.execution,
            config: {
              ...config,
              functionCode: code,
              nodeData: {
                ...config?.nodeData,
                outputData: true,
              },
            },
          },
        },
      };
    }

    // --- Task Node (functionCode misplaced inside nodeData) ---
    if (node.type === "task") {
      const config = node.data.execution?.config;

      const misplacedCode = (
        (config as any)?.nodeData?.functionCode as string | undefined
      )?.trim();

      if (misplacedCode && !config?.functionCode?.trim()) {
        // Rescue: move from config.nodeData.functionCode → config.functionCode
        console.log(
          `[applyDeterministicCodeGeneration] Rescuing misplaced functionCode in nodeData for task node ${node.id}`,
        );
        return {
          ...node,
          data: {
            ...node.data,
            execution: {
              ...node.data.execution,
              config: {
                ...config,
                functionCode: misplacedCode,
                nodeData: {
                  ...(config as any)?.nodeData,
                  functionCode: undefined,
                },
              },
            },
          },
        };
      }
    }

    return node;
  });
}

// ============================================
// FUNCTION CODE REQUIRED REPAIR
// ============================================

// ============================================
// EMPTY DATA SHAPE REPAIR
// ============================================

function padUnderPopulatedArray(arr: unknown[]): unknown[] {
  // Precondition: arr.length > 0 (empty arrays are not passed here)
  const last = arr[arr.length - 1];
  const padded = [...arr];
  while (padded.length < 3) {
    padded.push(
      typeof last === "object" && last !== null && !Array.isArray(last)
        ? { ...(last as object) }
        : last,
    );
  }
  return padded;
}

function fixArrayShapes(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    // Empty arrays are left for AI — element type is unknown, padding would destroy semantic intent
    const padded =
      value.length > 0 && value.length < 3
        ? padUnderPopulatedArray(value)
        : value;
    return padded.map(fixArrayShapes);
  }

  const keys = Object.keys(value as object);
  if (keys.length === 0) return value; // leave empty objects to AI
  return Object.fromEntries(
    Object.entries(value as object).map(([k, v]) => [k, fixArrayShapes(v)]),
  );
}

function hasUnderPopulatedArray(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    // Empty arrays (length === 0) are NOT reported here — validateEmptyDataShape handles them via AI
    return (
      (value.length > 0 && value.length < 3) ||
      value.some(hasUnderPopulatedArray)
    );
  }
  return Object.values(value as object).some(hasUnderPopulatedArray);
}

/**
 * Returns true if a top-level key in an inputData/outputData object has an empty array value.
 * Only checks the first level (Strategy A/B only need to handle top-level keys).
 */
function hasTopLevelEmptyArray(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return Object.values(data as object).some(
    (v) => Array.isArray(v) && v.length === 0,
  );
}

/**
 * Pad under-populated arrays in inputData/outputData to >= 3 elements.
 * Also fills empty arrays (length === 0) using cross-node inference:
 *
 * Strategy A — inputData[key] = []:
 *   Case 1: parent outputData has key with array >= 3 elements → copy
 *   Case 2: parent doesn't have key AND functionCode doesn't reference it → remove (spurious field)
 *   Case 3: parent doesn't have key BUT functionCode references it → leave for AI
 *
 * Strategy B — outputData[key] = []:
 *   Step B1: inputData has the same key with array >= 3 → copy (same-key passthrough)
 *   Step B2: functionCode pattern `{ key: inputData.otherKey }` and inputData.otherKey >= 3 → copy
 *
 * Decision node parents pass their inputData (not outputData) to children.
 */
export function deterministicRepairEmptyDataShape(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  return nodes.map((node) => {
    const config = getExecutionConfig(node);
    if (!config) return node;

    const { inputData, outputData } = config.nodeData ?? {};
    const fixInput = hasUnderPopulatedArray(inputData);
    const fixOutput = hasUnderPopulatedArray(outputData);
    const hasEmptyInput = hasTopLevelEmptyArray(inputData);
    const hasEmptyOutput = hasTopLevelEmptyArray(outputData);

    if (!fixInput && !fixOutput && !hasEmptyInput && !hasEmptyOutput) return node;

    // Step 1: Pad under-populated arrays (existing behavior)
    let newInputData: unknown = fixInput ? fixArrayShapes(inputData) : inputData;
    let newOutputData: unknown = fixOutput ? fixArrayShapes(outputData) : outputData;

    if (fixInput || fixOutput) {
      console.log(
        `[deterministicRepairEmptyDataShape] Padding arrays for node ${node.id}`,
      );
    }

    // Step 2 — Strategy A: Fill/remove top-level empty arrays in inputData
    if (hasEmptyInput && node.parentNode) {
      const parentNode = nodeMap.get(node.parentNode);
      if (parentNode) {
        const parentConfig = getExecutionConfig(parentNode);
        // Decision nodes pass their inputData (not outputData) to children
        const parentReference =
          parentNode.type === "decision"
            ? parentConfig?.nodeData?.inputData
            : parentConfig?.nodeData?.outputData;
        const functionCode: string = config.functionCode ?? "";

        if (
          newInputData &&
          typeof newInputData === "object" &&
          !Array.isArray(newInputData)
        ) {
          const result = { ...(newInputData as Record<string, unknown>) };
          let strategyAChanged = false;

          for (const [key, value] of Object.entries(result)) {
            if (!(Array.isArray(value) && value.length === 0)) continue;

            const parentIsObject =
              parentReference !== null &&
              parentReference !== undefined &&
              typeof parentReference === "object" &&
              !Array.isArray(parentReference);
            const parentHasKey =
              parentIsObject &&
              key in (parentReference as Record<string, unknown>);
            const parentValue = parentHasKey
              ? (parentReference as Record<string, unknown>)[key]
              : undefined;

            if (Array.isArray(parentValue) && parentValue.length >= 3) {
              // Case 1: parent has key with non-empty array → copy
              result[key] = parentValue;
              strategyAChanged = true;
              console.log(
                `[deterministicRepairEmptyDataShape] Filled inputData.${key} from parent outputData for ${node.id}`,
              );
            } else if (
              !parentHasKey &&
              !new RegExp(`\\binputData\\.${key}\\b`).test(functionCode)
            ) {
              // Case 2: parent doesn't have key AND functionCode doesn't reference it → remove
              delete result[key];
              strategyAChanged = true;
              console.log(
                `[deterministicRepairEmptyDataShape] Removed spurious inputData.${key} (absent from parent output + unreferenced in functionCode) for ${node.id}`,
              );
            }
            // Case 3: parent doesn't have key BUT functionCode references it → leave for AI
          }

          if (strategyAChanged) newInputData = result;
        }
      }
    }

    // Step 3 — Strategy B: Fill top-level empty arrays in outputData from inputData
    if (hasEmptyOutput) {
      const functionCode: string = config.functionCode ?? "";

      if (
        newOutputData &&
        typeof newOutputData === "object" &&
        !Array.isArray(newOutputData)
      ) {
        const result = { ...(newOutputData as Record<string, unknown>) };
        let strategyBChanged = false;

        for (const [key, value] of Object.entries(result)) {
          if (!(Array.isArray(value) && value.length === 0)) continue;

          // B1: Same-key passthrough from inputData
          if (
            newInputData &&
            typeof newInputData === "object" &&
            !Array.isArray(newInputData)
          ) {
            const sameKeyValue = (newInputData as Record<string, unknown>)[key];
            if (Array.isArray(sameKeyValue) && sameKeyValue.length >= 3) {
              result[key] = sameKeyValue;
              strategyBChanged = true;
              console.log(
                `[deterministicRepairEmptyDataShape] Filled outputData.${key} from same-key inputData for ${node.id}`,
              );
              continue;
            }
          }

          // B2: functionCode pattern match: { key: inputData.someOtherKey }
          const pattern = new RegExp(`\\b${key}\\s*:\\s*inputData\\.(\\w+)`);
          const match = pattern.exec(functionCode);
          if (match) {
            const inKey = match[1];
            if (
              newInputData &&
              typeof newInputData === "object" &&
              !Array.isArray(newInputData)
            ) {
              const inValue = (newInputData as Record<string, unknown>)[inKey];
              if (Array.isArray(inValue) && inValue.length >= 3) {
                result[key] = inValue;
                strategyBChanged = true;
                console.log(
                  `[deterministicRepairEmptyDataShape] Filled outputData.${key} from inputData.${inKey} via functionCode pattern for ${node.id}`,
                );
              }
            }
          }
        }

        if (strategyBChanged) newOutputData = result;
      }
    }

    const inputChanged = newInputData !== inputData;
    const outputChanged = newOutputData !== outputData;

    if (!inputChanged && !outputChanged) return node;

    return {
      ...node,
      data: {
        ...node.data,
        execution: {
          ...node.data.execution,
          config: {
            ...config,
            nodeData: {
              ...config.nodeData,
              ...(inputChanged ? { inputData: newInputData } : {}),
              ...(outputChanged ? { outputData: newOutputData } : {}),
            },
          },
        },
      },
    } satisfies { data: { execution: ExecutionData } };
  });
}

// ============================================
// TEST CASE REPAIR
// ============================================

/** Check if two values have the same set of top-level keys. */
export function hasSameTopLevelKeys(a: unknown, b: unknown): boolean {
  if (!a || typeof a !== "object" || !b || typeof b !== "object") return false;
  const aKeys = Object.keys(a as object).sort();
  const bKeys = Object.keys(b as object).sort();
  return aKeys.length === bKeys.length && aKeys.every((k, i) => k === bKeys[i]);
}
