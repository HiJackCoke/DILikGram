import type {
  ValidationContext,
  ValidationProgress,
} from "../../../types/ai/validators";
import type { WorkflowNode } from "@/types";
import {
  validateCircularReferences,
  repairCircularReferences,
} from "./circularReference";
import { validateDecisionNodes, repairDecisionNodes } from "./decisionNode";
import {
  validateGroupNodePipelines,
  repairGroupNodePipelines,
} from "./groupNodePipeline";
import { validateRootGroupNodes, repairRootGroupNodes } from "./rootGroupNode";
import {
  validateFunctionCodeInputData,
  repairFunctionCodeMismatch,
} from "./functionCodeMismatch";
import {
  validateStartNodeChildren,
  repairStartNodeChildren,
} from "./startNodeChild";

/**
 * User-friendly display names for validators
 */
const VALIDATOR_DISPLAY_NAMES: Record<string, string> = {
  "Circular References": "Checking for circular dependencies",
  "Start Node Children": "Validating initial node configuration",
  "Decision Nodes": "Checking decision node branches",
  "GroupNode Pipelines": "Verifying data flow between nodes",
  "Root GroupNodes": "Checking group node structure",
  "functionCode Mismatch": "Validating node execution logic",
};

/**
 * Run validation pipeline
 *
 * Executes all validators sequentially and repairs issues as they're found.
 * Order matters: earlier validators may fix issues that later validators check.
 *
 * @param context - Validation context with nodes, dialog, and updateWorkflowAction
 * @param onProgress - Optional callback to report validation progress
 * @returns Updated nodes after all validations and repairs
 */
export async function runValidationPipeline(
  context: ValidationContext,
  onProgress?: (progress: ValidationProgress) => void,
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
  const totalValidators = validators.length;

  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];

    // Report validation start
    onProgress?.({
      currentValidator: validator.name,
      totalValidators,
      completedValidators: i,
      status: "validating",
      message: VALIDATOR_DISPLAY_NAMES[validator.name] || validator.name,
    });

    const result = validator.validate(workingNodes);

    if (!result.valid) {
      console.log(`Validation failed: ${validator.name}`, result);

      // Report repair start
      onProgress?.({
        currentValidator: validator.name,
        totalValidators,
        completedValidators: i,
        status: "repairing",
        message: `Auto-fixing ${validator.name.toLowerCase()} issues...`,
      });

      // Run repair with updated context
      workingNodes = await validator.repair({
        ...context,
        nodes: workingNodes,
      });
    }
  }

  // Report completion
  onProgress?.({
    currentValidator: null,
    totalValidators,
    completedValidators: totalValidators,
    status: "completed",
    message: "Finalizing workflow...",
  });

  return workingNodes;
}
