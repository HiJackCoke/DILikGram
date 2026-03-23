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
        functionCode !== undefined &&
        functionCode !== null &&
        String(functionCode).trim() !== ""
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
                    ...(resolvedFunctionCode !== undefined
                      ? { functionCode: resolvedFunctionCode }
                      : {}),
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
export function getExecutionConfig(
  node?: WorkflowNode,
): ExecutionConfig | null {
  const config = node?.data?.execution?.config;

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
 * Finds patterns like: inputData.fieldName or inputData?.fieldName (optional chaining)
 *
 * @param functionCode - JavaScript function code as string
 * @returns Set of referenced field names
 */
export function extractInputDataReferences(functionCode: string): Set<string> {
  const regex = /inputData\??\.(\w+)/g;
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

      // Ensure nodeData.inputData and nodeData.outputData are at least null (never undefined).
      // validateServiceNodeFunctionCode checks both === undefined — null is valid.
      // AI-created service nodes may omit these fields entirely; this guards against that.
      const existingNodeData = (config as ExecutionConfig | undefined)
        ?.nodeData;
      const inputDataDefined =
        existingNodeData && "inputData" in existingNodeData;
      const outputDataDefined =
        existingNodeData && "outputData" in existingNodeData;

      return {
        ...node,
        data: {
          ...baseData,
          execution: {
            ...node.data.execution,
            config: {
              ...config,
              functionCode: code,
              nodeData: {
                ...(existingNodeData ?? {}),
                ...(inputDataDefined ? {} : { inputData: null }),
                ...(outputDataDefined ? {} : { outputData: null }),
              },
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

/**
 * When an array contains objects that share a key with empty array values,
 * fill them using sibling inference or minimal placeholder objects.
 *
 * Case 1: Some siblings have populated arrays → propagate to empty-array siblings.
 * Case 2: ALL siblings have empty arrays → generate 3 minimal placeholder objects.
 *   The placeholder uses a single `id` field (most universal domain key).
 *   Safe: passes validateEmptyDataShape (3 non-empty objects). AI can further refine.
 */
function propagatePopulatedNestedArrays(
  elements: Record<string, unknown>[],
): Record<string, unknown>[] {
  const allKeys = new Set(elements.flatMap((el) => Object.keys(el)));
  let changed = false;
  const result = elements.map((el) => ({ ...el }));

  for (const key of allKeys) {
    const values = result.map((el) => el[key]);
    const emptyIndices = values
      .map((v, i) => (Array.isArray(v) && v.length === 0 ? i : -1))
      .filter((i) => i >= 0);
    if (emptyIndices.length === 0) continue;

    // Case 1: find a sibling with a populated (>=3 element) array to use as template
    const populatedValue = values.find(
      (v) => Array.isArray(v) && v.length >= 3,
    ) as unknown[] | undefined;
    if (populatedValue) {
      for (const idx of emptyIndices) {
        result[idx][key] = populatedValue;
        changed = true;
      }
    } else {
      // Case 2: all siblings have empty arrays — generate minimal placeholder objects.
      // Use `{id: "key-001"}` as a universal minimal structure that passes shape validation.
      const placeholder = [
        { id: `${key}-item-001` },
        { id: `${key}-item-002` },
        { id: `${key}-item-003` },
      ];
      for (const idx of emptyIndices) {
        result[idx][key] = placeholder;
        changed = true;
      }
    }
  }

  return changed ? result : elements;
}

function fixArrayShapes(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    if (value.length === 0) {
      // Empty array inside a named object key: generate minimal placeholders (key type is known)
      if (keyHint) {
        return [
          { id: `${keyHint}-item-001` },
          { id: `${keyHint}-item-002` },
          { id: `${keyHint}-item-003` },
        ];
      }
      // Top-level / no key hint: leave for AI (element type is unknown)
      return value;
    }

    const padded = value.length < 3 ? padUnderPopulatedArray(value) : value;
    const processed = padded.map((el) => fixArrayShapes(el));

    // If elements are objects, propagate populated nested arrays to empty-array siblings
    if (
      processed.length > 1 &&
      processed.every(
        (el) => el !== null && typeof el === "object" && !Array.isArray(el),
      )
    ) {
      return propagatePopulatedNestedArrays(
        processed as Record<string, unknown>[],
      );
    }
    return processed;
  }

  const keys = Object.keys(value as object);
  if (keys.length === 0) {
    // Empty object inside a named key: generate minimal placeholder so validateEmptyDataShape passes.
    // The placeholder has a single generic key; AI will replace with proper schema on next repair.
    if (keyHint) {
      return { type: `${keyHint}-default` };
    }
    return value; // top-level empty object: leave for AI
  }
  return Object.fromEntries(
    Object.entries(value as object).map(([k, v]) => [k, fixArrayShapes(v, k)]),
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
 * Returns true if value contains any empty array at any depth.
 * Used to detect nested empty arrays like games[i].attendees = [].
 */
function hasDeepEmptyArray(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    return value.some(hasDeepEmptyArray);
  }
  if (typeof value === "object") {
    return Object.values(value as object).some(hasDeepEmptyArray);
  }
  return false;
}

/**
 * Returns true if value contains any empty object ({}) at any depth (excluding null).
 * Used to detect nested empty objects like courts[i].conditions = {}.
 */
function hasDeepEmptyObject(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some(hasDeepEmptyObject);
  }
  if (typeof value === "object") {
    if (Object.keys(value as object).length === 0) return true;
    return Object.values(value as object).some(hasDeepEmptyObject);
  }
  return false;
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
    // Deep check: catch nested empty arrays inside objects within arrays (e.g. games[i].attendees=[])
    const hasDeepEmptyInput = !hasEmptyInput && hasDeepEmptyArray(inputData);
    const hasDeepEmptyOutput = !hasEmptyOutput && hasDeepEmptyArray(outputData);
    // Deep empty object check: catch nested empty objects inside arrays (e.g. courts[i].conditions={})
    const hasDeepEmptyObjInput =
      !fixInput && !hasDeepEmptyInput && hasDeepEmptyObject(inputData);
    const hasDeepEmptyObjOutput =
      !fixOutput && !hasDeepEmptyOutput && hasDeepEmptyObject(outputData);

    if (
      !fixInput &&
      !fixOutput &&
      !hasEmptyInput &&
      !hasEmptyOutput &&
      !hasDeepEmptyInput &&
      !hasDeepEmptyOutput &&
      !hasDeepEmptyObjInput &&
      !hasDeepEmptyObjOutput
    )
      return node;

    // Step 1: Pad under-populated arrays (existing behavior) + nested empty arrays + empty objects
    // Pass a keyHint so top-level empty objects (e.g., outputData={}) get a minimal placeholder.
    let newInputData: unknown =
      fixInput || hasDeepEmptyInput || hasDeepEmptyObjInput
        ? fixArrayShapes(inputData, "inputData")
        : inputData;
    let newOutputData: unknown =
      fixOutput || hasDeepEmptyOutput || hasDeepEmptyObjOutput
        ? fixArrayShapes(outputData, "outputData")
        : outputData;

    if (
      fixInput ||
      fixOutput ||
      hasDeepEmptyInput ||
      hasDeepEmptyOutput ||
      hasDeepEmptyObjInput ||
      hasDeepEmptyObjOutput
    ) {
      console.log(
        `[deterministicRepairEmptyDataShape] Padding arrays for node ${node.id}` +
          (hasDeepEmptyInput || hasDeepEmptyOutput
            ? " (includes deeply nested empty arrays)"
            : "") +
          (hasDeepEmptyObjInput || hasDeepEmptyObjOutput
            ? " (includes nested empty objects)"
            : ""),
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

          // B3: Fallback — neither B1 nor B2 resolved the empty array.
          // Generate a keyHint-based placeholder so validateEmptyDataShape passes.
          // The placeholder shape ({id:'key-item-001'}) is universally valid and tells the AI the expected element type.
          if (
            Array.isArray(result[key]) &&
            (result[key] as unknown[]).length === 0
          ) {
            result[key] = fixArrayShapes([], key);
            strategyBChanged = true;
            console.log(
              `[deterministicRepairEmptyDataShape] Filled outputData.${key} with placeholder (B3 fallback) for ${node.id}`,
            );
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
// TRIVIAL DECISION NODE REPAIR
// ============================================

/**
 * Deterministic repair for trivial decision nodes:
 * Decision nodes with inputData where ALL top-level values are null (unusable data)
 * AND functionCode doesn't reference any inputData fields → set inputData = null.
 *
 * This breaks the cycle: AI writes `const { reviews } = inputData; return reviews !== null;`
 * which uses destructuring that extractInputDataReferences() can't detect (it only matches inputData.key).
 * Instead of chasing AI behavior, just remove the null-valued inputData entirely.
 *
 * Safe: inputData values are already null so they carry no actual data.
 */
export function deterministicRepairTrivialDecisionNodes(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.type !== "decision") return node;

    const config = getExecutionConfig(node);
    if (!config) return node;

    const inputData = config.nodeData?.inputData;
    // Only act on non-null inputData objects
    if (inputData === null || inputData === undefined) return node;
    if (typeof inputData !== "object" || Array.isArray(inputData)) return node;

    const entries = Object.entries(inputData as Record<string, unknown>);
    if (entries.length === 0) return node;

    // Check if ALL top-level values are null
    const allNull = entries.every(([, v]) => v === null);
    if (!allNull) return node;

    // Check if functionCode doesn't reference any inputData fields
    const functionCode = config.functionCode ?? "";
    const refs = extractInputDataReferences(functionCode);
    if (refs.size > 0) return node;

    console.log(
      `[deterministicRepairTrivialDecisionNodes] Setting inputData=null for ${node.id} (all values null, functionCode ignores them)`,
    );

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
              inputData: null,
            },
          },
        },
      },
    } satisfies { data: { execution: ExecutionData } };
  });
}

// ============================================
// FUNCTIONCODE MISMATCH REPAIR
// ============================================

/**
 * Deterministic repair: when functionCode references inputData.key but key doesn't exist in inputData,
 * fill the missing key by copying it from the parent node's outputData.
 *
 * Safe because:
 * - We only ADD keys to inputData (never remove existing keys)
 * - Values are copied from the parent's actual outputData (not invented)
 * - Never changes functionCode
 * - Runs on task AND service nodes (service functionCode references inputData when URL uses templates like {{inputData.field}})
 *
 * Group propagation (prevents boundary cycle):
 * - When a task node is the first child of a group AND the added keys come from the grandparent,
 *   also update the parent GROUP's inputData with those keys. This prevents
 *   deterministicRepairGroupBoundaries from removing the keys on the next pass
 *   (boundary repair: firstChild.inputData = group.inputData).
 */
export function deterministicRepairFunctionCodeMismatch(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    // Service nodes can also have functionCode mismatches when http URL/body uses
    // template vars like {{inputData.field}} — the generated functionCode references those fields.
    // Decision nodes are excluded (validateFunctionCodeInputData also skips them).
    if (node.type !== "task" && node.type !== "service") continue;

    const config = getExecutionConfig(node);
    if (!config?.functionCode?.trim()) continue;

    const referencedFields = extractInputDataReferences(config.functionCode);
    if (referencedFields.size === 0) continue;

    const inputData = config.nodeData?.inputData;

    // Find missing fields (referenced in functionCode but not in inputData)
    const inputKeys =
      inputData && typeof inputData === "object" && !Array.isArray(inputData)
        ? new Set(Object.keys(inputData as object))
        : new Set<string>();

    const missingFields = [...referencedFields].filter(
      (f) => !inputKeys.has(f),
    );
    if (missingFields.length === 0) continue;

    // Determine the correct predecessor data source for this node.
    //
    // Nodes inside a group receive data from their PIPELINE PREDECESSOR, not the group itself:
    //   - First child  → receives from group.inputData (= parent-task output after boundary sync)
    //   - Non-first child → receives from previous sibling's outputData
    //
    // Adding grandparent keys to a non-first-child node breaks the pipeline chain
    // (sibling.outputData ↔ node.inputData must match exactly), so we restrict the
    // lookup to the node's actual predecessor.
    //
    // Nodes NOT inside a group (root-level, decision children, etc.):
    //   - Use parent.outputData, then grandparent if needed.

    const parentNode = node.parentNode
      ? nodeMap.get(node.parentNode)
      : undefined;

    // Build predecessor data: the object we can safely copy keys from
    let predecessorData: Record<string, unknown> | null = null;
    // Whether this node is the first child of a group (enables group propagation later)
    let isGroupFirstChild = false;

    if (parentNode?.type === "group") {
      // Sort non-decision siblings by y-position to find pipeline order
      const siblings = nodes
        .filter((n) => n.parentNode === parentNode.id && n.type !== "decision")
        .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
      const nodeIndex = siblings.findIndex((n) => n.id === node.id);

      if (nodeIndex === 0) {
        // First child: predecessor is group.inputData (which is synced from parent-task output)
        isGroupFirstChild = true;
        const groupConfig = getExecutionConfig(nodeMap.get(parentNode.id)!);
        const groupInput = groupConfig?.nodeData?.inputData;
        if (
          groupInput &&
          typeof groupInput === "object" &&
          !Array.isArray(groupInput)
        ) {
          predecessorData = groupInput as Record<string, unknown>;
        }
        // Also check grandparent (for keys not yet propagated into group.inputData)
        if (parentNode.parentNode) {
          const grandparent = nodeMap.get(parentNode.parentNode);
          if (grandparent) {
            const gpConfig = getExecutionConfig(grandparent);
            const gpOut =
              grandparent.type === "decision"
                ? gpConfig?.nodeData?.inputData
                : gpConfig?.nodeData?.outputData;
            if (gpOut && typeof gpOut === "object" && !Array.isArray(gpOut)) {
              // Merge: group.inputData takes precedence, grandparent fills gaps
              predecessorData = {
                ...(gpOut as Record<string, unknown>),
                ...(predecessorData ?? {}),
              };
            }
          }
        }
      } else {
        // Non-first child: predecessor is the previous sibling's outputData.
        // Do NOT look at group.outputData or grandparent — that would add keys that break
        // the pipeline chain (prevSibling.outputData ↔ node.inputData must match exactly).
        const prevSibling =
          nodeIndex > 0 ? nodeMap.get(siblings[nodeIndex - 1].id) : undefined;
        if (prevSibling) {
          const prevConfig = getExecutionConfig(prevSibling);
          const prevOut = prevConfig?.nodeData?.outputData;
          if (
            prevOut &&
            typeof prevOut === "object" &&
            !Array.isArray(prevOut)
          ) {
            predecessorData = prevOut as Record<string, unknown>;
          }
        }
      }
    } else if (parentNode) {
      // Not inside a group: use parent's outputData (or inputData for decision parents)
      const parentConfig = getExecutionConfig(parentNode);
      const parentOut =
        parentNode.type === "decision"
          ? parentConfig?.nodeData?.inputData
          : parentConfig?.nodeData?.outputData;
      if (
        parentOut &&
        typeof parentOut === "object" &&
        !Array.isArray(parentOut)
      ) {
        predecessorData = parentOut as Record<string, unknown>;
      }
      // Also check grandparent if parent doesn't have the key
      if (parentNode.parentNode) {
        const grandparent = nodeMap.get(parentNode.parentNode);
        if (grandparent) {
          const gpConfig = getExecutionConfig(grandparent);
          const gpOut =
            grandparent.type === "decision"
              ? gpConfig?.nodeData?.inputData
              : gpConfig?.nodeData?.outputData;
          if (gpOut && typeof gpOut === "object" && !Array.isArray(gpOut)) {
            predecessorData = {
              ...(gpOut as Record<string, unknown>),
              ...(predecessorData ?? {}),
            };
          }
        }
      }
    }

    // Build additions: only copy keys from the predecessor that are missing in inputData
    const additions: Record<string, unknown> = {};
    for (const key of missingFields) {
      if (predecessorData && key in predecessorData) {
        additions[key] = predecessorData[key];
        const source = isGroupFirstChild ? "group/grandparent" : "predecessor";
        console.log(
          `[deterministicRepairFunctionCodeMismatch] Added inputData.${key} from ${source} for ${node.id}`,
        );
      }
      // If key not found in predecessor, leave for AI — we don't invent values
    }

    if (Object.keys(additions).length === 0) {
      // All missing fields have no upstream source.
      // For task nodes INSIDE a GroupNode with NON-NULL inputData: generate a safe fallback functionCode.
      // The current functionCode is demonstrably broken (references non-existent fields) and the AI
      // has been unable to fix it. We rewrite using spread (no inputData.field refs = no mismatch).
      // This is the last-resort deterministic fix before throwing MAX_RETRIES.
      if (
        node.type === "task" &&
        parentNode?.type === "group" &&
        inputData !== null &&
        inputData !== undefined &&
        typeof inputData === "object" &&
        !Array.isArray(inputData) &&
        Object.keys(inputData as object).length > 0
      ) {
        const availableKeys = Object.keys(inputData as Record<string, unknown>);
        // Check if any missing field is also absent from groupNode.inputData — confirms orphaned state
        const groupNodeInMap = nodeMap.get(parentNode.id);
        const groupConfig = groupNodeInMap
          ? getExecutionConfig(groupNodeInMap)
          : null;
        const groupInput = groupConfig?.nodeData?.inputData;
        const groupKeys =
          groupInput &&
          typeof groupInput === "object" &&
          !Array.isArray(groupInput)
            ? new Set(Object.keys(groupInput as object))
            : new Set<string>();
        const allOrphaned = missingFields.every((f) => !groupKeys.has(f));
        if (allOrphaned) {
          // Generate fallback: use spread (no inputData.field refs) to pass through available data
          const fallbackFunctionCode = `return { ...inputData, processed: true };`;
          // Update outputData to match what the fallback returns
          const fallbackOutputData: Record<string, unknown> = {
            ...(inputData as Record<string, unknown>),
            processed: true,
          };
          // Apply fallback only if the current functionCode actually references orphaned fields
          // (guard against re-applying on already-fixed nodes)
          const updatedNode: WorkflowNode = {
            ...node,
            data: {
              ...node.data,
              execution: {
                ...node.data.execution,
                config: {
                  ...config,
                  functionCode: fallbackFunctionCode,
                  nodeData: {
                    ...config.nodeData,
                    outputData: fallbackOutputData,
                  },
                },
              },
            },
          } satisfies { data: { execution: ExecutionData } };
          nodeMap.set(node.id, updatedNode);
          console.log(
            `[deterministicRepairFunctionCodeMismatch] Fallback: rewrote functionCode to spread passthrough for ${node.id} (orphaned fields: ${missingFields.join(", ")}; available: ${availableKeys.join(", ")})`,
          );
        }
      }
      // For other node types (or cases without confirmed orphaned state), leave for AI.
      continue;
    }

    const newInputData = {
      ...(inputData &&
      typeof inputData === "object" &&
      !Array.isArray(inputData)
        ? (inputData as Record<string, unknown>)
        : {}),
      ...additions,
    };

    const updatedNode: WorkflowNode = {
      ...node,
      data: {
        ...node.data,
        execution: {
          ...node.data.execution,
          config: {
            ...config,
            nodeData: {
              ...config.nodeData,
              inputData: newInputData,
            },
          },
        },
      },
    } satisfies { data: { execution: ExecutionData } };

    nodeMap.set(node.id, updatedNode);

    // Group propagation: if this node is the first child of a group, also update the
    // group node's inputData with the same additions. This prevents
    // deterministicRepairGroupBoundaries from removing the keys (it syncs firstChild = group.inputData).
    if (parentNode?.type === "group" && isGroupFirstChild) {
      const groupConfig = getExecutionConfig(nodeMap.get(parentNode.id)!);
      const groupInputData = groupConfig?.nodeData?.inputData;
      const groupInputRecord =
        groupInputData &&
        typeof groupInputData === "object" &&
        !Array.isArray(groupInputData)
          ? (groupInputData as Record<string, unknown>)
          : {};
      // Only add keys that are NOT already in group.inputData
      const groupAdditions: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(additions)) {
        if (!(key in groupInputRecord)) {
          groupAdditions[key] = value;
        }
      }
      if (Object.keys(groupAdditions).length > 0) {
        const newGroupInputData = { ...groupInputRecord, ...groupAdditions };
        const updatedGroup: WorkflowNode = {
          ...parentNode,
          data: {
            ...parentNode.data,
            execution: {
              ...parentNode.data.execution,
              config: {
                ...groupConfig,
                nodeData: {
                  ...groupConfig?.nodeData,
                  inputData: newGroupInputData,
                },
              },
            },
          },
        } satisfies { data: { execution: ExecutionData } };
        nodeMap.set(parentNode.id, updatedGroup);
        console.log(
          `[deterministicRepairFunctionCodeMismatch] Propagated ${Object.keys(groupAdditions).join(", ")} to parent group ${parentNode.id} (prevents boundary cycle)`,
        );
      }
    }
  }

  return nodes.map((n) => nodeMap.get(n.id) ?? n);
}

// ============================================
// PARENT-CHILD DATA FLOW REPAIR
// ============================================

/**
 * Deterministically repair task/service nodes whose inputData keys
 * don't overlap with their parent's outputData keys.
 *
 * This handles the cycle: AI changes service.inputData → code gen references old
 * http.body template vars → FunctionCode mismatch fires → AI reverts → cycle.
 *
 * Strategy:
 *  1. For each non-group child whose inputData has NO overlap with parent.outputData:
 *     a. Replace child.inputData = parent.outputData
 *     b. For service children: strip http.body template vars referencing old keys
 *        (so applyDeterministicCodeGeneration doesn't re-introduce old key refs)
 *     c. For task children: rewrite functionCode as spread passthrough
 *
 * Safe because: child is supposed to receive parent's data; mismatched keys
 * are either hallucinated or cross-page chaining mismatches.
 */
export function deterministicRepairParentChildDataFlow(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const groupNodeIds = new Set(
    nodes.filter((n) => n.type === "group").map((n) => n.id),
  );
  const updated = new Map<string, WorkflowNode>();

  for (const child of nodes) {
    if (!child.parentNode) continue;
    if (child.type === "start" || child.type === "end") continue;

    const parent = nodeMap.get(child.parentNode);
    if (!parent) continue;
    // Only handle task/service parents (group/start/decision handled elsewhere)
    if (
      parent.type === "start" ||
      parent.type === "group" ||
      parent.type === "decision"
    )
      continue;
    // Skip if parent is itself inside a group (groupNodePipeline handles those)
    if (groupNodeIds.has(child.parentNode)) continue;

    const parentConfig = getExecutionConfig(parent);
    const childConfig = getExecutionConfig(child);
    if (!childConfig) continue;

    const parentOutputData = parentConfig?.nodeData?.outputData;
    const childInputData = childConfig.nodeData?.inputData;

    // Skip if parent has no output or trivial output
    if (
      !parentOutputData ||
      typeof parentOutputData !== "object" ||
      Object.keys(parentOutputData).length === 0
    )
      continue;

    // Skip if child has null/undefined inputData (a different validator handles that)
    if (childInputData === null || childInputData === undefined) continue;

    // Check overlap: ALL child input keys must be in parent output
    const parentOutputKeys = new Set(Object.keys(parentOutputData as object));
    const childInputKeys = Object.keys(childInputData as object);
    const allMatch = childInputKeys.every((k) => parentOutputKeys.has(k));
    if (allMatch) continue; // already valid

    // --- Repair ---
    const newInputData = { ...(parentOutputData as Record<string, unknown>) };

    if (child.type === "service") {
      // Update inputData AND strip http.body template vars for missing keys
      const serviceHttp = (child.data as any)?.http ?? {};
      const oldBody = serviceHttp.body ?? {};
      const newBody: Record<string, unknown> = {};

      for (const [bKey, bVal] of Object.entries(oldBody)) {
        if (typeof bVal === "string" && bVal.includes("{{inputData.")) {
          const refMatch = bVal.match(/\{\{inputData\.(\w+)\}\}/);
          if (refMatch && parentOutputKeys.has(refMatch[1])) {
            newBody[bKey] = bVal; // keep — the ref key is in new inputData
          }
          // else: drop — old key no longer available in new inputData
        } else {
          newBody[bKey] = bVal; // keep non-template entries
        }
      }

      const repairedChild: WorkflowNode = {
        ...child,
        data: {
          ...(child.data as any),
          http: { ...serviceHttp, body: newBody },
          execution: {
            ...child.data.execution,
            config: {
              ...childConfig,
              nodeData: {
                ...childConfig.nodeData,
                inputData: newInputData,
              },
            },
          },
        },
      };
      updated.set(child.id, repairedChild);
      console.log(
        `[deterministicRepairParentChildDataFlow] Aligned service ${child.id}.inputData to parent ${parent.id}.outputData (stripped ${childInputKeys.filter((k) => !parentOutputKeys.has(k)).join(", ")} from http.body)`,
      );
    } else if (child.type === "task") {
      // Rewrite task: align inputData + spread passthrough functionCode
      const fallbackFunctionCode = `return { ...inputData, processed: true };`;
      const fallbackOutputData = { ...newInputData, processed: true };
      const repairedChild: WorkflowNode = {
        ...child,
        data: {
          ...child.data,
          execution: {
            ...child.data.execution,
            config: {
              ...childConfig,
              functionCode: fallbackFunctionCode,
              nodeData: {
                ...childConfig.nodeData,
                inputData: newInputData,
                outputData: fallbackOutputData,
              },
            },
          },
        },
      };
      updated.set(child.id, repairedChild);
      console.log(
        `[deterministicRepairParentChildDataFlow] Aligned task ${child.id}.inputData to parent ${parent.id}.outputData (spread passthrough)`,
      );
    } else if (child.type === "group") {
      // GroupNode [FIX HINT] case: parent is a root task (no parentNode) and
      // GroupNode.inputData doesn't match parent.outputData.
      // Fix: update GroupNode.inputData = parent.outputData.
      // deterministicRepairGroupBoundaries will then sync firstChild.inputData.
      // Only apply when parent is a root task (parentNode=null) — these are [FIX HINT] cases.
      if (parent.parentNode !== undefined && parent.parentNode !== null)
        continue; // skip [REPARENTING HINT] cases
      const repairedChild: WorkflowNode = {
        ...child,
        data: {
          ...child.data,
          execution: {
            ...child.data.execution,
            config: {
              ...childConfig,
              nodeData: {
                ...childConfig.nodeData,
                inputData: newInputData,
              },
            },
          },
        },
      };
      updated.set(child.id, repairedChild);
      console.log(
        `[deterministicRepairParentChildDataFlow] Aligned GroupNode ${child.id}.inputData to root task ${parent.id}.outputData [FIX HINT case]`,
      );
    }
  }

  if (updated.size === 0) return nodes;
  return nodes.map((n) => updated.get(n.id) ?? n);
}

// ============================================
// DUPLICATE GROUP CHILD REPAIR
// ============================================

/**
 * Remove AI-created duplicate children from groups.
 *
 * When the AI tries to fix a GroupNode pipeline by adding a new child with the
 * same title as an existing child, it creates a duplicate that causes cycling.
 *
 * Strategy: For each group that has children with the same title,
 * prefer the "original" node (page-prefix ID like `p\d-node-*`) and remove
 * AI-created duplicates (IDs that don't match the page-prefix pattern).
 *
 * Safe because: same-title nodes in a group are never intentional — the AI
 * creates them to "fix" something but makes the pipeline worse.
 */
export function deterministicRepairDuplicateGroupChildren(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  // Group children by parentNode
  const childrenByGroup = new Map<string, WorkflowNode[]>();
  for (const node of nodes) {
    if (!node.parentNode) continue;
    if (!childrenByGroup.has(node.parentNode))
      childrenByGroup.set(node.parentNode, []);
    childrenByGroup.get(node.parentNode)!.push(node);
  }

  const idsToRemove = new Set<string>();

  for (const [, children] of childrenByGroup) {
    // Group children by title
    const byTitle = new Map<string, WorkflowNode[]>();
    for (const child of children) {
      const title = (child.data?.title as string) ?? child.id;
      if (!byTitle.has(title)) byTitle.set(title, []);
      byTitle.get(title)!.push(child);
    }

    for (const [, dupes] of byTitle) {
      if (dupes.length <= 1) continue;

      // Prefer nodes with page-prefix IDs (e.g., "p1-node-task-*", "p2-node-service-*")
      // AI-created nodes during repair may also have this prefix but include "-NEW-" suffix.
      const pagePrefix = /^p\d+-node-/;
      const originals = dupes.filter(
        (n) => pagePrefix.test(n.id) && !n.id.includes("-NEW-"),
      );
      const aiCreated = dupes.filter(
        (n) => !pagePrefix.test(n.id) || n.id.includes("-NEW-"),
      );

      if (originals.length > 0 && aiCreated.length > 0) {
        // Remove AI-created duplicates, keep originals
        for (const dup of aiCreated) {
          idsToRemove.add(dup.id);
          console.log(
            `[deterministicRepairDuplicateGroupChildren] Removing AI-created duplicate "${dup.data?.title}" (${dup.id}) — keeping original ${originals[0].id}`,
          );
        }
      }
      // If all duplicates are AI-created (no page-prefix), keep the first one
      if (originals.length === 0 && aiCreated.length > 1) {
        for (const dup of aiCreated.slice(1)) {
          idsToRemove.add(dup.id);
          console.log(
            `[deterministicRepairDuplicateGroupChildren] Removing extra AI-created duplicate "${dup.data?.title}" (${dup.id})`,
          );
        }
      }
    }
  }

  if (idsToRemove.size === 0) return nodes;
  return nodes.filter((n) => !idsToRemove.has(n.id));
}

// ============================================
// TEST CASE REPAIR
// ============================================

/**
 * Clear parentNode on nodes whose parentNode ID does not exist in the workflow.
 * These dangling references are always invalid and cannot be repaired by the AI
 * without first removing them — the AI keeps assigning the same non-existent ID.
 * Clearing parentNode makes the node root-level, which then triggers GroupNode
 * Min Children to rebuild the group structure in a subsequent retry.
 *
 * Safe because: pointing to a non-existent parent is always structurally invalid.
 * Moving to root preserves AI intent (the node still exists with its data).
 */
export function deterministicRepairInvalidParentNodes(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  let anyFixed = false;

  const result = nodes.map((node) => {
    if (node.parentNode && !nodeIds.has(node.parentNode)) {
      anyFixed = true;
      console.log(
        `[deterministicRepairInvalidParentNodes] Cleared dangling parentNode="${node.parentNode}" from ${node.id} ("${node.data?.title}")`,
      );
      return { ...node, parentNode: undefined };
    }
    return node;
  });

  if (!anyFixed) return nodes; // return original array if nothing changed
  return result;
}

/** Check if two values have the same set of top-level keys. */
export function hasSameTopLevelKeys(a: unknown, b: unknown): boolean {
  if (!a || typeof a !== "object" || !b || typeof b !== "object") return false;
  const aKeys = Object.keys(a as object).sort();
  const bKeys = Object.keys(b as object).sort();
  return aKeys.length === bKeys.length && aKeys.every((k, i) => k === bKeys[i]);
}
