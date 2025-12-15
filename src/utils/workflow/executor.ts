import type { WorkflowNode } from "@/types/nodes";
import type { EdgeTransferData, WorkflowEdge } from "@/types/edges";
import type {
  ExecutionError,
  ExecutorFunction,
  ExecutionState,
  ExecutionData,
  WorkflowMode,
  WorkflowRuntimeState,
  OnStateChangeCallback,
  OnNodeUpdateCallback,
  OnEdgeUpdateCallback,
  OnNodeUpdateEndCallback,
  WorkflowExecutorConfig,
} from "@/types/workflow";
import { compileExecutor, executeFunction } from "./runtime";
import { getDataType } from "./helpers";

/**
 * 워크플로우 실행을 위한 유틸리티
 */
export class WorkflowExecutor {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private mode: WorkflowMode;
  private executionState: WorkflowRuntimeState;
  private abortController: AbortController | null = null;

  private onStateChange: OnStateChangeCallback;
  private onNodeUpdate?: OnNodeUpdateCallback;
  private onEdgeUpdate?: OnEdgeUpdateCallback;
  private onNodeUpdateEnd?: OnNodeUpdateEndCallback;

  // Executor function cache
  private executionCache = new Map<string, ExecutorFunction>();

  constructor(config: WorkflowExecutorConfig) {
    this.nodes = config.nodes;
    this.edges = config.edges;
    this.mode = config.mode;
    this.onStateChange = config.onStateChange;
    this.onNodeUpdate = config.onNodeUpdate;
    this.onEdgeUpdate = config.onEdgeUpdate;
    this.onNodeUpdateEnd = config.onNodeUpdateEnd;
    this.executionState = {
      isRunning: false,
      context: {
        outputs: new Map(),
        errors: new Map(),
        startTime: 0,
      },
    };
  }

  /**
   * 워크플로우 실행 시작
   */
  async execute(): Promise<void> {
    this.abortController = new AbortController();
    this.executionState.isRunning = true;
    this.executionState.context.startTime = Date.now();
    this.notifyStateChange();

    try {
      // Start 노드 찾기
      const startNode = this.nodes.find((node) => node.type === "start");
      if (!startNode) {
        throw new Error("Start node not found");
      }

      await this.executeNode(startNode.id);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Execution aborted");
      } else {
        console.error("Execution error:", error);
      }
    } finally {
      this.executionState.isRunning = false;

      this.executionState.context.endTime = Date.now();
      this.notifyStateChange();

      // 모든 실행이 끝나면 최종 노드 상태를 전달
      if (this.onNodeUpdateEnd) {
        this.onNodeUpdateEnd([...this.nodes]);
      }
    }
  }

  /**
   * 실행 중단
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * 데이터 크기 문자열 생성
   */
  // private getDataSize(data: unknown): string {
  //   if (data === null || data === undefined) return "null";
  //   if (Array.isArray(data)) return `${data.length} items`;
  //   if (typeof data === "object") {
  //     const keys = Object.keys(data).length;
  //     return `${keys} fields`;
  //   }
  //   return typeof data;
  // }

  /**
   * 엣지를 통한 데이터 전달 시각화
   */
  private async transferDataThroughEdge(
    edgeId: string,
    data: unknown
  ): Promise<void> {
    if (!this.onEdgeUpdate) return;

    const transferData: EdgeTransferData = {
      payload: data,
      dataType: getDataType(data),
      // size: this.getDataSize(data),
      timestamp: Date.now(),
    };

    // 엣지에 데이터 표시
    this.onEdgeUpdate(edgeId, {
      transferData,
      animated: true,
    });

    // 500ms 대기 (애니메이션)
    await this.delay(500);

    // 애니메이션 종료
    this.onEdgeUpdate(edgeId, {
      animated: false,
    });
  }

  /**
   * 노드 실행 에러 처리
   */
  private handleExecutionError(nodeId: string, error: Error): void {
    const timestamp = Date.now();
    const executionError: ExecutionError = {
      message: error.message,
      stack: error.stack,
      timestamp,
    };

    this.executionState.context.errors.set(nodeId, executionError);

    // 노드에 에러 표시
    if (this.onNodeUpdate) {
      const executionData = this.buildExecutorData(
        nodeId,
        "executed",
        undefined, // No output data on error
        executionError // Pass error
      );
      this.onNodeUpdate(nodeId, executionData);
      this.syncNodeAfterUpdate(nodeId, executionData);
    }
  }

  /**
   * Sync this.nodes with React state after update
   * Ensures getNodeInput() reads fresh data from this.nodes
   */
  private syncNodeAfterUpdate(
    nodeId: string,
    executionData: ExecutionData
  ): void {
    const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId);

    if (nodeIndex !== -1) {
      // Create updated node (immutable pattern)
      this.nodes[nodeIndex] = {
        ...this.nodes[nodeIndex],
        data: {
          ...this.nodes[nodeIndex].data,
          execution: executionData,
        },
      };
    }
  }

  /**
   * Get or compile execution for a node
   * Returns null if no execution configured or node doesn't support executions
   */
  private getExecutorForNode(node: WorkflowNode): ExecutorFunction | null {
    // Start and End nodes don't have executions
    if (node.type === "start" || node.type === "end") {
      return null;
    }

    const data = node.data;

    const config = data.execution?.config;

    // No custom execution configured
    if (!config?.functionCode) {
      return null;
    }

    // Check cache
    const cacheKey = `${node.id}-${config.lastModified}`;
    if (this.executionCache.has(cacheKey)) {
      return this.executionCache.get(cacheKey)!;
    }

    // Compile and cache with node type validation
    try {
      const nodeTypeForValidation = node.type as
        | "task"
        | "service"
        | "decision";

      const execution = compileExecutor(config, nodeTypeForValidation);
      this.executionCache.set(cacheKey, execution);

      return execution;
    } catch (error) {
      console.error(`Failed to compile execution for ${node.id}:`, error);
      // Display error on node for validation failures (e.g., TaskNode with async)
      this.handleExecutionError(node.id, error as Error);
      return null;
    }
  }

  /**
   * 노드의 입력 데이터 가져오기 (부모 노드의 output)
   */
  private getNodeInput(nodeId: string): unknown {
    const node = this.nodes.find((n) => n.id === nodeId);

    if (!node?.parentNode) {
      return null; // Start 노드는 input 없음
    }

    // Primary: Get from parent node's config.nodeData.outputData
    const parentNode = this.nodes.find((n) => n.id === node.parentNode);
    const parentOutputData =
      parentNode?.data.execution?.config?.nodeData?.outputData;

    if (parentOutputData !== undefined) {
      return parentOutputData;
    }

    // Fallback: Get from executionState.context.outputs
    const parentOutput = this.executionState.context.outputs.get(
      node.parentNode
    );

    return parentOutput?.data ?? null;
  }

  /**
   * Build complete ExecutionData by merging execution result with existing config
   *
   * @param nodeId - Node being updated
   * @param executionState - Current execution state
   * @param resultData - Data to store (input or output)
   * @param error - Optional execution error
   * @returns Complete ExecutionData ready to assign
   */
  private buildExecutorData(
    nodeId: string,
    executionState: ExecutionState,
    resultData: unknown,
    error?: ExecutionError
  ): ExecutionData {
    // Find existing node to preserve config
    const existingNode = this.nodes.find((n) => n.id === nodeId);
    const existingExecutor = existingNode?.data.execution;
    const existingConfig = existingExecutor?.config;

    // Determine if updating input (executing) or output (executed)
    const isInputUpdate = executionState === "executing";
    const dataKey = isInputUpdate ? "inputData" : "outputData";

    // Merge new data with existing nodeData
    const nodeData = {
      ...existingConfig?.nodeData,
      [dataKey]: resultData,
    };

    // Build complete ExecutionData
    return {
      state: executionState,
      config: {
        functionCode: existingConfig?.functionCode ?? "",
        lastModified: existingConfig?.lastModified ?? Date.now(),
        isAsync: existingConfig?.isAsync ?? false,
        nodeData,
      },
      error, // Include error if present
    };
  }

  /**
   * Extract success value from decision node output
   * Uses early return pattern to avoid nested if statements
   * IMPORTANT: Should only be called for decision nodes
   */
  private extractDecisionSuccess(
    node: WorkflowNode,
    outputData: unknown
  ): boolean {
    // Assertion: this method should only be called for decision nodes
    if (node.type !== "decision") {
      throw new Error(
        `extractDecisionSuccess should only be called for decision nodes, got ${node.type}`
      );
    }

    // Forced mode (not auto)
    if (this.mode !== "auto") {
      return this.mode === "success";
    }

    // Auto mode: extract from outputData
    if (typeof outputData !== "object" || outputData === null) {
      console.warn(
        `Decision node ${node.id}: outputData is not an object. Falling back to true.`
      );
      return true;
    }

    if (!("success" in outputData)) {
      console.warn(
        `Decision node ${node.id}: outputData has no success field. Falling back to true.`
      );
      return true;
    }

    const successValue = (outputData as { success: unknown }).success;
    if (typeof successValue !== "boolean") {
      console.warn(
        `Decision node ${node.id}: success field is not boolean (${typeof successValue}). Falling back to true.`
      );
      return true;
    }

    return successValue;
  }

  /**
   * Compute node output based on node type and executor
   */
  private async computeNodeOutput(
    node: WorkflowNode,
    inputData: unknown
  ): Promise<{ outputData: unknown; success: boolean }> {
    if (node.type === "start") {
      return { outputData: null, success: true };
    }

    const execution = this.getExecutorForNode(node);

    if (execution) {
      return await this.runCustomExecution(node, execution, inputData);
    } else {
      return this.runDefaultExecution(node, inputData);
    }
  }

  /**
   * Run custom executor function
   */
  private async runCustomExecution(
    node: WorkflowNode,
    execution: ExecutorFunction,
    inputData: unknown
  ): Promise<{ outputData: unknown; success: boolean }> {
    await this.delay(500);
    const result = await executeFunction(execution, inputData, 30000);

    if (!result.success) {
      throw new Error(result.error?.message || "Execution failed");
    }

    const outputData = result.data;

    // Only extract success for decision nodes
    if (node.type === "decision") {
      const success = this.extractDecisionSuccess(node, outputData);
      return { outputData, success };
    }

    // Task/Service nodes: execution succeeded if we reach here
    return { outputData, success: true };
  }

  /**
   * Run default identity execution (no custom executor)
   */
  private runDefaultExecution(
    node: WorkflowNode,
    inputData: unknown
  ): { outputData: unknown; success: boolean } {
    if (node.type === "decision") {
      console.warn(
        `Decision node ${node.id}: no executor configured. Falling back to success=true.`
      );
      return { outputData: inputData, success: true };
    }

    // Task/Service nodes succeed by default (no custom executor)
    return { outputData: inputData, success: true };
  }

  /**
   * Notify UI that node is executing (show inputData)
   */
  private async notifyNodeExecuting(
    nodeId: string,
    inputData: unknown
  ): Promise<void> {
    if (!this.onNodeUpdate) return;

    const executionData = this.buildExecutorData(
      nodeId,
      "executing",
      inputData
    );
    this.onNodeUpdate(nodeId, executionData);
    this.syncNodeAfterUpdate(nodeId, executionData);
  }

  /**
   * Notify UI that node finished executing (show outputData)
   */
  private async notifyNodeExecuted(
    nodeId: string,
    outputData: unknown
  ): Promise<void> {
    if (!this.onNodeUpdate) return;

    const executionData = this.buildExecutorData(
      nodeId,
      "executed",
      outputData
    );
    this.onNodeUpdate(nodeId, executionData);
    this.syncNodeAfterUpdate(nodeId, executionData);
  }

  /**
   * Store execution output in context
   */
  private storeOutput(
    nodeId: string,
    outputData: unknown,
    success: boolean,
    startTime: number
  ): void {
    const executionTime = Date.now() - startTime;
    this.executionState.context.outputs.set(nodeId, {
      data: outputData,
      timestamp: Date.now(),
      executionTime,
      success,
    });
  }

  /**
   * Execute a single node (orchestration only)
   */
  private async executeNode(nodeId: string): Promise<void> {
    // 1. Pre-execution checks
    if (this.abortController?.signal.aborted) {
      throw new Error("Execution aborted");
    }

    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const startTime = Date.now();

    try {
      // 2. Get input data
      const inputData = this.getNodeInput(nodeId);

      // 3. Notify UI: node is executing
      await this.notifyNodeExecuting(nodeId, inputData);

      // 4. Execute node logic
      const { outputData, success } = await this.computeNodeOutput(
        node,
        inputData
      );

      // 5. Store output
      this.storeOutput(nodeId, outputData, success, startTime);

      // 6. Notify UI: node finished
      await this.notifyNodeExecuted(nodeId, outputData);

      // 7. Execute next nodes
      await this.executeNextNodes(nodeId);
    } catch (error) {
      this.handleExecutionError(nodeId, error as Error);
      throw error; // Fail-Fast
    }
  }

  /**
   * Get list of children to execute based on node type
   * - Decision nodes: returns single child selected by branch mode
   * - Normal nodes: returns all children
   */
  private getChildrenToExecute(currentNode: WorkflowNode): WorkflowNode[] {
    const allChildren = this.nodes.filter(
      (node) => node.parentNode === currentNode.id
    );

    if (allChildren.length === 0) return [];

    // Decision node: select one branch
    if (currentNode.type === "decision") {
      const selectedChild = this.selectBranchByMode(
        currentNode.id,
        allChildren
      );
      return selectedChild ? [selectedChild] : [];
    }

    // Normal node: all children
    return allChildren;
  }

  /**
   * Execute a child node with edge data transfer visualization
   */
  private async executeChildWithEdge(
    currentNodeId: string,
    child: WorkflowNode
  ): Promise<void> {
    // Find edge connecting current node to child
    const edge = this.edges.find(
      (e) => e.source === currentNodeId && e.target === child.id
    );

    // Transfer data through edge if exists
    if (edge) {
      const currentOutput =
        this.executionState.context.outputs.get(currentNodeId);
      const outputData = currentOutput?.data;

      await this.transferDataThroughEdge(edge.id, outputData);
      this.notifyStateChange();
      await this.delay(500);
    }

    // Execute child node
    await this.executeNode(child.id);

    // Deactivate edge animation
    if (edge) {
      this.notifyStateChange();
    }
  }

  /**
   * Execute next nodes in workflow (orchestration only)
   */
  private async executeNextNodes(currentNodeId: string): Promise<void> {
    const currentNode = this.nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return;

    // End node terminates execution
    if (currentNode.type === "end") {
      return;
    }

    // Get children to execute (decision node selects one, normal node gets all)
    const childrenToExecute = this.getChildrenToExecute(currentNode);

    // Execute all children with edge visualization
    for (const child of childrenToExecute) {
      await this.executeChildWithEdge(currentNode.id, child);
    }
  }

  /**
   * Decision 노드에서 success 필드 또는 모드에 따라 분기 선택
   */
  private selectBranchByMode(
    decisionNodeId: string,
    children: WorkflowNode[]
  ): WorkflowNode | null {
    if (children.length === 0) return null;

    // Get success from stored output
    const storedOutput =
      this.executionState.context.outputs.get(decisionNodeId);
    const success = storedOutput?.success;

    // yes/no 엣지 찾기
    const yesEdge = this.edges.find(
      (e) =>
        e.source === decisionNodeId &&
        (e.sourcePort === "yes" || e.label === "Yes")
    );

    const noEdge = this.edges.find(
      (e) =>
        e.source === decisionNodeId &&
        (e.sourcePort === "no" || e.label === "No")
    );

    // Use success field, fallback to mode if not set
    const shouldTakeYesPath =
      success !== undefined ? success : this.mode === "success";

    if (shouldTakeYesPath && yesEdge) {
      return children.find((c) => c.id === yesEdge.target) || null;
    } else if (!shouldTakeYesPath && noEdge) {
      return children.find((c) => c.id === noEdge.target) || null;
    }

    // 기본값: 첫 번째 자식
    return children[0];
  }

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      this.abortController?.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Execution aborted"));
      });
    });
  }

  /**
   * 상태 변경 알림
   */
  private notifyStateChange(): void {
    this.onStateChange({ ...this.executionState });
  }
}

/**
 * 워크플로우 실행 헬퍼 함수
 */
export function createWorkflowExecutor(
  config: WorkflowExecutorConfig
): WorkflowExecutor {
  return new WorkflowExecutor(config);
}
