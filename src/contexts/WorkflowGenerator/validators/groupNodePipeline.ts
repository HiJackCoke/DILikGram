import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
} from "../../../types/ai/validators";

import {
  getExecutionConfig,
  hasSameTopLevelKeys,
} from "../utils/validationUtils";

/**
 * Information about a broken GroupNode pipeline
 */
interface BrokenGroupInfo {
  groupNode: WorkflowNode;
  breakIndex: number;
  prevTitle: string;
  nextTitle: string;
  prevNode: WorkflowNode;
  nextNode: WorkflowNode;
}

/**
 * Information about a GroupNode boundary contract violation
 */
interface GroupBoundaryViolation {
  groupNode: WorkflowNode;
  violationType: "input_boundary" | "output_boundary";
  groupValue: unknown;
  childValue: unknown;
  childTitle: string;
  childNode: WorkflowNode;
}

/**
 * Check if two nodes have data flow overlap
 * Returns true if prev.outputData overlaps with next.inputData
 *
 * @param prevNode - Previous node in the pipeline
 * @param nextNode - Next node in the pipeline
 * @returns true if data can flow from prev to next
 */
export function hasDataFlowOverlap(
  prevNode: WorkflowNode,
  nextNode: WorkflowNode,
): boolean {
  const prevConfig = getExecutionConfig(prevNode);
  const nextConfig = getExecutionConfig(nextNode);

  const outputData = prevConfig?.nodeData?.outputData;
  const inputData = nextConfig?.nodeData?.inputData;

  // If prev produces no output, consider valid (nothing to check)
  if (!outputData || Object.keys(outputData).length === 0) {
    return true;
  }

  // If next expects no input:
  if (!inputData || inputData === null) {
    // Service nodes that don't reference inputData in their functionCode are self-contained
    // (e.g. GET /tasks fetches independently — null inputData is intentional, not a chain break)
    if (nextNode.type === "service") {
      const nextFnCode = getExecutionConfig(nextNode)?.functionCode ?? "";
      if (!/\binputData\b/.test(nextFnCode)) {
        return true; // self-contained service node — not a chain break
      }
    }
    return false;
  }

  // Check that all required input keys are provided by the previous node's output
  const outputKeys = new Set(Object.keys(outputData));
  const inputKeys = Object.keys(inputData);

  return inputKeys.every((key) => outputKeys.has(key));
}


/**
 * Detect broken GroupNode pipelines
 * A pipeline is broken when prev.outputData doesn't overlap with next.inputData
 */
function detectBrokenGroups(nodes: WorkflowNode[]): BrokenGroupInfo[] {
  const groupNodeIds = new Set(
    nodes.filter((n) => n.type === "group").map((n) => n.id),
  );
  const groupChildrenSorted: Record<string, WorkflowNode[]> = {};

  // Collect and sort children for each GroupNode
  nodes.forEach((n) => {
    if (
      n.parentNode &&
      groupNodeIds.has(n.parentNode) &&
      n.type !== "decision"
    ) {
      if (!groupChildrenSorted[n.parentNode]) {
        groupChildrenSorted[n.parentNode] = [];
      }
      groupChildrenSorted[n.parentNode].push(n);
    }
  });

  Object.values(groupChildrenSorted).forEach((arr) =>
    arr.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)),
  );

  const broken: BrokenGroupInfo[] = [];

  Object.entries(groupChildrenSorted).forEach(([groupId, children]) => {
    for (let i = 0; i < children.length - 1; i++) {
      const prevNode = children[i];
      const nextNode = children[i + 1];

      if (!hasDataFlowOverlap(prevNode, nextNode)) {
        const groupNode = nodes.find((n) => n.id === groupId);
        if (!groupNode) continue;

        broken.push({
          groupNode,
          breakIndex: i,
          prevTitle: prevNode.data.title ?? "Untitled",
          nextTitle: nextNode.data.title ?? "Untitled",
          prevNode,
          nextNode,
        });
      }
    }
  });

  return broken;
}

/**
 * Detect GroupNode boundary contract violations.
 * - input_boundary: group.inputData does not match firstChild.inputData
 * - output_boundary: group.outputData keys do not match lastChild.outputData keys
 */
function detectBoundaryViolations(
  nodes: WorkflowNode[],
): GroupBoundaryViolation[] {
  const groupNodeIds = new Set(
    nodes.filter((n) => n.type === "group").map((n) => n.id),
  );
  const groupChildrenSorted: Record<string, WorkflowNode[]> = {};

  nodes.forEach((n) => {
    if (
      n.parentNode &&
      groupNodeIds.has(n.parentNode) &&
      n.type !== "decision"
    ) {
      if (!groupChildrenSorted[n.parentNode])
        groupChildrenSorted[n.parentNode] = [];
      groupChildrenSorted[n.parentNode].push(n);
    }
  });

  Object.values(groupChildrenSorted).forEach((arr) =>
    arr.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)),
  );

  const violations: GroupBoundaryViolation[] = [];

  for (const groupId of Object.keys(groupChildrenSorted)) {
    const children = groupChildrenSorted[groupId];
    if (!children || children.length === 0) continue;

    const groupNode = nodes.find((n) => n.id === groupId);
    if (!groupNode) continue;

    const groupConfig = getExecutionConfig(groupNode);
    const groupInputData = groupConfig?.nodeData?.inputData;
    const groupOutputData = groupConfig?.nodeData?.outputData;

    // Input boundary: group.inputData vs firstChild.inputData
    const firstChild = children[0];
    const firstConfig = getExecutionConfig(firstChild);
    const firstInputData = firstConfig?.nodeData?.inputData ?? null;

    if (groupInputData === null) {
      // Root group — firstChild must also have null inputData
      if (firstInputData !== null) {
        violations.push({
          groupNode,
          violationType: "input_boundary",
          groupValue: null,
          childValue: firstInputData,
          childTitle: firstChild.data.title ?? "Untitled",
          childNode: firstChild,
        });
      }
    } else if (
      groupInputData &&
      typeof groupInputData === "object" &&
      !hasSameTopLevelKeys(groupInputData, firstInputData)
    ) {
      // Service nodes with null inputData are self-contained (e.g., GET /resource).
      // Their null inputData is intentional — they fetch data from external APIs without input.
      // The Group passes its inputData context, but the service doesn't consume it.
      // This is NOT a boundary violation; skip to avoid false positives.
      if (firstChild.type === "service" && firstInputData === null) {
        // intentional: service node fetches data independently (no input required)
      } else {
        violations.push({
          groupNode,
          violationType: "input_boundary",
          groupValue: groupInputData,
          childValue: firstInputData,
          childTitle: firstChild.data.title ?? "Untitled",
          childNode: firstChild,
        });
      }
    }

    // Output boundary: group.outputData vs lastChild.outputData
    const lastChild = children[children.length - 1];
    const lastConfig = getExecutionConfig(lastChild);
    const lastOutputData = lastConfig?.nodeData?.outputData ?? null;

    if (
      groupOutputData &&
      typeof groupOutputData === "object" &&
      Object.keys(groupOutputData as object).length > 0 &&
      !hasSameTopLevelKeys(groupOutputData, lastOutputData)
    ) {
      violations.push({
        groupNode,
        violationType: "output_boundary",
        groupValue: groupOutputData,
        childValue: lastOutputData,
        childTitle: lastChild.data.title ?? "Untitled",
        childNode: lastChild,
      });
    }
  }

  return violations;
}

/**
 * Detect GroupNodes that are nested inside other GroupNodes.
 * Per LAW 4: GroupNodes MUST be siblings, never children of another GroupNode.
 *
 * Traces all the way up to the first non-group ancestor so deeply nested chains
 * (e.g. C inside B inside A inside root-task) all get the correct target parentId.
 */
function detectNestedGroupNodes(nodes: WorkflowNode[]): {
  nested: WorkflowNode;
  parent: WorkflowNode;
  targetParentId: string;
}[] {
  const groupNodeIds = new Set(nodes.filter((n) => n.type === "group").map((n) => n.id));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result: { nested: WorkflowNode; parent: WorkflowNode; targetParentId: string }[] = [];
  for (const node of nodes) {
    if (node.type === "group" && node.parentNode && groupNodeIds.has(node.parentNode)) {
      const parent = nodeMap.get(node.parentNode)!;
      // Trace up through group-ancestors until we find the first non-group ancestor
      // That ancestor's parentNode is the correct sibling target
      let cursor = parent;
      while (cursor.parentNode && groupNodeIds.has(cursor.parentNode)) {
        cursor = nodeMap.get(cursor.parentNode)!;
      }
      // cursor is now the topmost group in the chain; its parentNode is the target
      const targetParentId = cursor.parentNode ?? "null (root task ID)";
      result.push({ nested: node, parent, targetParentId });
    }
  }
  return result;
}

/**
 * Validate GroupNode internal pipelines
 * Checks that data flows correctly between sequential nodes,
 * and that group boundary contracts (inputData/outputData) are upheld.
 */
export function validateGroupNodePipelines(
  nodes: WorkflowNode[],
): ValidationResult {
  // ── Phase 0: Explicit nesting check (GroupNode inside GroupNode) ──────────
  const nestedGroups = detectNestedGroupNodes(nodes);
  if (nestedGroups.length > 0) {
    const nestingMsgs = nestedGroups.map(({ nested, parent, targetParentId }) => {
      return (
        `⚠️ NESTING VIOLATION: GroupNode "${nested.data.title}" (${nested.id}) is ILLEGALLY nested inside GroupNode "${parent.data.title}" (${parent.id}). ` +
        `REQUIRED FIX: update "${nested.data.title}".parentNode from "${parent.id}" to "${targetParentId}" — move it to be a SIBLING (this ID is in your nodeIds scope).`
      );
    });
    // Include nested groups, their immediate parents, and target parent nodes
    // so the AI can use all these IDs in its parentNode updates
    const nestedIds = nestedGroups.flatMap(({ nested, parent, targetParentId }) => [
      nested.id,
      parent.id,
      ...(targetParentId !== "null (root task ID)" ? [targetParentId] : []),
    ]);
    const seenNested = new Set<string>();
    const affectedNested = nodes
      .filter((n) => nestedIds.includes(n.id))
      .filter((n) => { if (seenNested.has(n.id)) return false; seenNested.add(n.id); return true; });
    return {
      valid: false,
      errorType: "BROKEN_GROUPNODE_PIPELINES",
      errorMessage: nestingMsgs.join(" | "),
      affectedNodes: affectedNested,
      metadata: { nestedGroups, brokenGroups: [], boundaryViolations: [] },
    };
  }

  const brokenGroups = detectBrokenGroups(nodes);
  const boundaryViolations = detectBoundaryViolations(nodes);

  if (brokenGroups.length === 0 && boundaryViolations.length === 0) {
    return { valid: true };
  }

  const affectedGroupIds = new Set([
    ...brokenGroups.map((g) => g.groupNode.id),
    ...boundaryViolations.map((v) => v.groupNode.id),
  ]);
  const affectedChildNodes: WorkflowNode[] = [
    ...brokenGroups.flatMap((g) => [g.prevNode, g.nextNode]),
    ...boundaryViolations.map((v) => v.childNode),
  ];
  const seenIds = new Set<string>();
  const affectedNodes = [
    ...nodes.filter((n) => affectedGroupIds.has(n.id)),
    ...affectedChildNodes,
  ].filter((n) => {
    if (seenIds.has(n.id)) return false;
    seenIds.add(n.id);
    return true;
  });

  const brokenMsgs = brokenGroups.map(({ groupNode, prevNode, nextNode }) => {
    const prevConfig = getExecutionConfig(prevNode);
    const nextConfig = getExecutionConfig(nextNode);
    const prevOutput = prevConfig?.nodeData?.outputData;
    const nextInput = nextConfig?.nodeData?.inputData;
    const prevFn = prevConfig?.functionCode;
    const nextFn = nextConfig?.functionCode;
    const outputKeys = new Set(prevOutput ? Object.keys(prevOutput) : []);
    const missingKeys = nextInput
      ? Object.keys(nextInput).filter((k) => !outputKeys.has(k))
      : [];
    const prevInputKeys = Object.keys(prevConfig?.nodeData?.inputData ?? {});
    const nestingWarning = nextNode.type === "group"
      ? ` ⚠️ NESTING DETECTED: nextNode "${nextNode.data.title}"[type=group] is a feature GroupNode nested inside "${groupNode.data.title}". REQUIRED FIX: update "${nextNode.data.title}".parentNode from "${groupNode.id}" to "${groupNode.parentNode ?? "null (root task ID)"}" — make it a SIBLING, not a child.`
      : prevNode.type === "group"
        ? ` ⚠️ NESTING DETECTED: prevNode "${prevNode.data.title}"[type=group] is a feature GroupNode nested inside "${groupNode.data.title}". REQUIRED FIX: update "${prevNode.data.title}".parentNode from "${groupNode.id}" to "${groupNode.parentNode ?? "null (root task ID)"}" — make it a SIBLING, not a child.`
        : "";
    // Determine which strategy to suggest inline
    const allMissingCanPassThrough = missingKeys.length > 0 && missingKeys.every(k => prevInputKeys.includes(k));
    const strategyHint = allMissingCanPassThrough
      ? ` [STRATEGY A: ALL missing keys (${JSON.stringify(missingKeys)}) are in prevNode inputData — extend prevNode.functionCode to also return { ..., ${missingKeys.map(k => `${k}: inputData.${k}`).join(", ")} } and add those keys to prevNode.outputData. DO NOT change nextNode.]`
      : ` [STRATEGY B: missing keys (${JSON.stringify(missingKeys)}) NOT in prevNode inputData — change nextNode.inputData to match prevNode.outputData ${JSON.stringify(prevOutput ? Object.keys(prevOutput) : null)}, then rewrite nextNode.functionCode to use the new inputData keys.]`;
    return (
      `GroupNode "${groupNode.data.title ?? "Untitled"}" (${groupNode.id}): ` +
      `"${prevNode.data.title}"[type=${prevNode.type}](${prevNode.id}) → "${nextNode.data.title}"[type=${nextNode.type}](${nextNode.id}) mismatch — ` +
      `prevNode output keys: ${JSON.stringify(prevOutput ? Object.keys(prevOutput) : null)}, ` +
      `nextNode input keys: ${JSON.stringify(nextInput ? Object.keys(nextInput) : null)}, ` +
      `missing keys (nextNode needs but prevNode doesn't output): ${JSON.stringify(missingKeys)}, ` +
      `prevNode available input keys (can pass through): ${JSON.stringify(prevInputKeys)}; ` +
      `prevNode.functionCode: "${prevFn?.slice(0, 120) ?? "none"}"; ` +
      `nextNode.functionCode: "${nextFn?.slice(0, 120) ?? "none"}"` +
      strategyHint +
      nestingWarning
    );
  });

  const boundaryMsgs = boundaryViolations.map(
    ({ groupNode, violationType, groupValue, childNode, childValue }) =>
      `GroupNode "${groupNode.data.title ?? "Untitled"}" (${groupNode.id}) ${violationType}: ` +
      `group=${JSON.stringify(groupValue ? Object.keys(groupValue as object) : null)}, ` +
      `child "${childNode.data.title}" has ${JSON.stringify(childValue ? Object.keys(childValue as object) : null)}`,
  );

  // console.group("[GroupNodePipelines] Violation detected");
  // // console.log("affectedNodes IDs:", affectedNodes.map((n) => n.id));
  // console.log(
  //   "errorMessage:",
  //   [...brokenMsgs, ...boundaryMsgs].join("\n---\n"),
  // );
  // console.groupEnd();

  return {
    valid: false,
    errorType: "BROKEN_GROUPNODE_PIPELINES",
    errorMessage: [...brokenMsgs, ...boundaryMsgs].join(" | "),
    affectedNodes,
    metadata: { brokenGroups, boundaryViolations },
  };
}

function setNodeInputData(
  node: WorkflowNode,
  inputData: unknown,
): WorkflowNode {
  const exec = node.data?.execution;
  return {
    ...node,
    data: {
      ...node.data,
      execution: {
        ...exec,
        config: {
          ...(exec?.config ?? {}),
          nodeData: {
            ...((exec?.config as { nodeData?: unknown })?.nodeData ?? {}),
            inputData,
          },
        },
      },
    },
  };
}

function setNodeOutputData(
  node: WorkflowNode,
  outputData: unknown,
): WorkflowNode {
  const exec = node.data?.execution;
  return {
    ...node,
    data: {
      ...node.data,
      execution: {
        ...exec,
        config: {
          ...(exec?.config ?? {}),
          nodeData: {
            ...((exec?.config as { nodeData?: unknown })?.nodeData ?? {}),
            outputData,
          },
        },
      },
    },
  };
}

/**
 * Deterministically repair GroupNode boundary violations (no AI needed).
 *
 * - output_boundary: GroupNode.outputData = lastChild.outputData  (safe: pure schema sync)
 * - input_boundary:  firstChild.inputData = GroupNode.inputData   (safe: schema sync only)
 *
 * Chain breaks are NOT auto-fixed here — auto-chaining (next.inputData = prev.outputData)
 * risks destroying the semantic intent of downstream nodes. Chain breaks go to AI.
 *
 * After repair, if firstChild.functionCode references stale keys, it becomes a
 * FUNCTION_CODE_INPUTDATA_MISMATCH violation — a simpler, focused AI task.
 */
export function deterministicRepairGroupBoundaries(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const groupNodeIds = new Set(
    nodes.filter((n) => n.type === "group").map((n) => n.id),
  );
  const groupChildrenSorted: Record<string, WorkflowNode[]> = {};
  nodes.forEach((n) => {
    if (
      n.parentNode &&
      groupNodeIds.has(n.parentNode) &&
      n.type !== "decision"
    ) {
      if (!groupChildrenSorted[n.parentNode])
        groupChildrenSorted[n.parentNode] = [];
      groupChildrenSorted[n.parentNode].push(n);
    }
  });
  Object.values(groupChildrenSorted).forEach((arr) =>
    arr.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)),
  );

  for (const [groupId, children] of Object.entries(groupChildrenSorted)) {
    if (!children || children.length === 0) continue;
    const groupNode = nodeMap.get(groupId);
    if (!groupNode) continue;

    const groupConfig = getExecutionConfig(groupNode);
    if (!groupConfig) continue;

    const firstChild = nodeMap.get(children[0].id)!;
    const lastChild = nodeMap.get(children[children.length - 1].id)!;
    const firstConfig = getExecutionConfig(firstChild);
    const lastConfig = getExecutionConfig(lastChild);

    // ── output_boundary repair ─────────────────────────────────────
    const groupOutputData = groupConfig.nodeData?.outputData;
    const lastOutputData = lastConfig?.nodeData?.outputData ?? null;
    if (
      groupOutputData &&
      typeof groupOutputData === "object" &&
      Object.keys(groupOutputData as object).length > 0 &&
      !hasSameTopLevelKeys(groupOutputData, lastOutputData)
    ) {
      nodeMap.set(
        groupId,
        setNodeOutputData(nodeMap.get(groupId)!, lastOutputData),
      );
    }

    // ── input_boundary repair ──────────────────────────────────────
    const groupInputData = groupConfig.nodeData?.inputData;
    const firstInputData = firstConfig?.nodeData?.inputData ?? null;
    // NOTE: We intentionally skip null-propagation (groupInputData===null → firstChild=null).
    // If a group's inputData is null, it means Parent-Child Data Flow hasn't fixed it yet.
    // Overwriting firstChild's (possibly correct) inputData with null would cascade into
    // functionCode Mismatch / outputData Type Mismatch violations. Let the AI fix the group
    // inputData first, then the deterministic repair will sync firstChild on the next pass.
    if (
      groupInputData &&
      typeof groupInputData === "object" &&
      !hasSameTopLevelKeys(groupInputData, firstInputData)
    ) {
      nodeMap.set(children[0].id, setNodeInputData(firstChild, groupInputData));
    }
  }

  return nodes.map((n) => nodeMap.get(n.id) ?? n);
}

/**
 * Inject passthrough keys into a functionCode's return statement.
 * Finds the last `return { ... }` block and adds `key: inputData.key` entries.
 */
function injectPassthroughKeys(functionCode: string, keys: string[]): string {
  if (keys.length === 0) return functionCode;
  const passthroughStr = keys.map((k) => `${k}: inputData.${k}`).join(", ");

  // Find the last `return {` pattern
  const returnRegex = /\breturn\s*\{/g;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = returnRegex.exec(functionCode)) !== null) lastMatch = m;
  if (!lastMatch) return functionCode;

  // The opening brace is the last char of the match
  const openBraceIdx = lastMatch.index + lastMatch[0].length - 1;

  // Find the matching closing brace (brace-balanced)
  let depth = 0;
  let closeIdx = -1;
  for (let i = openBraceIdx; i < functionCode.length; i++) {
    if (functionCode[i] === "{") depth++;
    else if (functionCode[i] === "}") {
      depth--;
      if (depth === 0) { closeIdx = i; break; }
    }
  }
  if (closeIdx < 0) return functionCode;

  const beforeClose = functionCode.substring(0, closeIdx);
  const afterClose = functionCode.substring(closeIdx); // includes '}'
  const contentInside = functionCode.substring(openBraceIdx + 1, closeIdx).trimEnd();
  const needsComma = contentInside.length > 0 && !contentInside.endsWith(",");

  return `${beforeClose}${needsComma ? ", " : ""}${passthroughStr}${afterClose}`;
}

/**
 * Deterministically apply Strategy A to GroupNode pipeline chain breaks.
 *
 * When prevNode → nextNode is broken AND all missing keys are available in
 * prevNode's inputData, extend prevNode to pass those keys through.
 *
 * Safe: only adds passthrough of keys that already exist in prevNode.inputData
 * and are expected by nextNode.inputData. Never removes or changes existing keys.
 *
 * Runs in a loop until stable (handles cascading chains like A→B→C→D where
 * each step needs the same passthrough fix applied in sequence).
 */
export function deterministicRepairPipelineStrategyA(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let anyChanged = true;

  while (anyChanged) {
    anyChanged = false;

    const currentNodes = Array.from(nodeMap.values());
    const groupNodeIds = new Set(
      currentNodes.filter((n) => n.type === "group").map((n) => n.id),
    );
    const groupChildrenSorted: Record<string, WorkflowNode[]> = {};
    currentNodes.forEach((n) => {
      if (
        n.parentNode &&
        groupNodeIds.has(n.parentNode) &&
        n.type !== "decision"
      ) {
        if (!groupChildrenSorted[n.parentNode])
          groupChildrenSorted[n.parentNode] = [];
        groupChildrenSorted[n.parentNode].push(n);
      }
    });
    Object.values(groupChildrenSorted).forEach((arr) =>
      arr.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)),
    );

    for (const children of Object.values(groupChildrenSorted)) {
      for (let i = 0; i < children.length - 1; i++) {
        const prevNode = nodeMap.get(children[i].id)!;
        const nextNode = nodeMap.get(children[i + 1].id)!;

        if (hasDataFlowOverlap(prevNode, nextNode)) continue;

        const prevConfig = getExecutionConfig(prevNode);
        const nextConfig = getExecutionConfig(nextNode);
        const prevOutput = prevConfig?.nodeData?.outputData;
        const nextInput = nextConfig?.nodeData?.inputData;
        const prevInput = prevConfig?.nodeData?.inputData;

        // Strategy C: nextNode has null inputData but its functionCode references inputData
        // (e.g. service node with body template vars like "{{ inputData.taskId }}").
        // Safe: just set nextNode.inputData = prevNode.outputData (pure schema alignment).
        // This resolves the chain break without changing any functional code.
        if (
          (nextInput === null || nextInput === undefined) &&
          prevOutput &&
          typeof prevOutput === "object" &&
          Object.keys(prevOutput as object).length > 0
        ) {
          const nextFnCode = nextConfig?.functionCode ?? "";
          if (/\binputData\b/.test(nextFnCode)) {
            const updatedNextNode = setNodeInputData(nextNode, prevOutput);
            nodeMap.set(nextNode.id, updatedNextNode);
            children[i + 1] = updatedNextNode;
            anyChanged = true;
            console.log(
              `[deterministicRepairPipelineStrategyA] Strategy C: ${nextNode.id} inputData set from prevNode ${prevNode.id} outputData`,
            );
          }
          continue;
        }

        if (
          !prevOutput ||
          !nextInput ||
          !prevInput ||
          typeof prevOutput !== "object" ||
          typeof nextInput !== "object" ||
          typeof prevInput !== "object"
        )
          continue;

        const outputKeys = new Set(Object.keys(prevOutput as object));
        const missingKeys = Object.keys(nextInput as object).filter(
          (k) => !outputKeys.has(k),
        );
        if (missingKeys.length === 0) continue;

        const prevInputRecord = prevInput as Record<string, unknown>;
        const allMissingInPrevInput = missingKeys.every(
          (k) => k in prevInputRecord,
        );
        if (!allMissingInPrevInput) continue;

        // Strategy A: safe passthrough — extend prevNode's outputData
        const newOutputData = { ...(prevOutput as Record<string, unknown>) };
        for (const key of missingKeys) {
          newOutputData[key] = prevInputRecord[key];
        }

        // Extend prevNode's functionCode to also return the passthrough keys
        let functionCode = prevConfig?.functionCode ?? "";
        const keysToAdd = missingKeys.filter(
          (k) => !new RegExp(`\\b${k}\\s*:`).test(functionCode),
        );
        if (keysToAdd.length > 0) {
          functionCode = injectPassthroughKeys(functionCode, keysToAdd);
        }

        const updatedPrevNode: WorkflowNode = {
          ...prevNode,
          data: {
            ...prevNode.data,
            execution: {
              ...prevNode.data.execution,
              config: {
                ...prevConfig,
                functionCode,
                nodeData: {
                  ...prevConfig?.nodeData,
                  outputData: newOutputData,
                },
              },
            },
          },
        };

        nodeMap.set(prevNode.id, updatedPrevNode);
        children[i] = updatedPrevNode; // update reference for next iteration
        anyChanged = true;

        console.log(
          `[deterministicRepairPipelineStrategyA] ${prevNode.id} → passthrough keys: ${JSON.stringify(missingKeys)}`,
        );
      }
    }
  }

  return nodes.map((n) => nodeMap.get(n.id) ?? n);
}

