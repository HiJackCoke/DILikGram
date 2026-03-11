import type {
  ValidationContext,
  ValidationProgress,
} from "../../../types/ai/validators";
import type { WorkflowNode } from "@/types";
import {
  validateParentNodeStructure,
  repairParentNodeStructure,
} from "./parentNodeStructure";
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
import { validateSyncOnlyNodes, repairSyncOnlyNodes } from "./syncOnlyNodes";
import {
  validateOutputDataTypeMismatch,
  repairOutputDataTypeMismatch,
} from "./outputDataTypeMismatch";
import {
  validateServiceNodeSimulation,
  repairServiceNodeSimulation,
} from "./serviceNodeSimulation";

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

  // Validator registry (order is important - parent node structure FIRST)
  const validators = [
    {
      name: "Parent Node Structure",
      validate: validateParentNodeStructure,
      repair: repairParentNodeStructure,
    },
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
      name: "Sync-Only Nodes",
      validate: validateSyncOnlyNodes,
      repair: repairSyncOnlyNodes,
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
    {
      name: "outputData Type Mismatch",
      validate: validateOutputDataTypeMismatch,
      repair: repairOutputDataTypeMismatch,
    },
    // {
    //   name: "Service Node functionCode",
    //   validate: validateServiceNodeFunctionCode,
    //   repair: repairServiceNodeFunctionCode,
    // },
    {
      name: "Service Node Simulation",
      validate: validateServiceNodeSimulation,
      repair: repairServiceNodeSimulation,
    },
  ];

  // Run validators sequentially
  const totalValidators = validators.length;

  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];

    // Report validation start
    onProgress?.({
      completedValidators: i,
      status: "validating",
    });

    const result = await validator.validate(workingNodes);

    if (!result.valid) {
      console.log(`Validation failed: ${validator.name}`, result);

      // Report repair start
      onProgress?.({
        completedValidators: i,
        status: "repairing",
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
    completedValidators: totalValidators,
    status: "completed",
  });

  return workingNodes;
}
