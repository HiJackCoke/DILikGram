import type { ValidationContext } from "./types";
import type { WorkflowNode } from "@/types";
import {
  validateCircularReferences,
  repairCircularReferences,
} from "./circularReference";
import {
  validateDecisionNodes,
  repairDecisionNodes,
} from "./decisionNode";
import {
  validateGroupNodePipelines,
  repairGroupNodePipelines,
} from "./groupNodePipeline";
import {
  validateRootGroupNodes,
  repairRootGroupNodes,
} from "./rootGroupNode";
import {
  validateFunctionCodeInputData,
  repairFunctionCodeMismatch,
} from "./functionCodeMismatch";
import {
  validateStartNodeChildren,
  repairStartNodeChildren,
} from "./startNodeChild";

/**
 * Run validation pipeline
 *
 * Executes all validators sequentially and repairs issues as they're found.
 * Order matters: earlier validators may fix issues that later validators check.
 *
 * @param context - Validation context with nodes, dialog, and updateWorkflowAction
 * @returns Updated nodes after all validations and repairs
 */
export async function runValidationPipeline(
  context: ValidationContext
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];

  // Validator registry (order is important - circular reference FIRST)
  const validators = [
    {
      name: "Circular References",
      validate: validateCircularReferences,
      repair: repairCircularReferences,
    },
    {
      name: "Start Node Children",
      validate: validateStartNodeChildren,
      repair: repairStartNodeChildren,
    },
    {
      name: "Decision Nodes",
      validate: validateDecisionNodes,
      repair: repairDecisionNodes,
    },
    {
      name: "GroupNode Pipelines",
      validate: validateGroupNodePipelines,
      repair: repairGroupNodePipelines,
    },
    {
      name: "Root GroupNodes",
      validate: validateRootGroupNodes,
      repair: repairRootGroupNodes,
    },
    {
      name: "functionCode Mismatch",
      validate: validateFunctionCodeInputData,
      repair: repairFunctionCodeMismatch,
    },
  ];

  // Run validators sequentially
  for (const validator of validators) {
    const result = validator.validate(workingNodes);

    if (!result.valid) {
      console.log(`Validation failed: ${validator.name}`, result);

      // Run repair with updated context
      workingNodes = await validator.repair({
        ...context,
        nodes: workingNodes,
      });
    }
  }

  return workingNodes;
}
