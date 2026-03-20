import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";
import type { EdgeTransferData, WorkflowEdge } from "@/types/edges";
import type {
  ExecutionError,
  ExecutorFunction,
  ExecutionState,
  ExecutionData,
  WorkflowRuntimeState,
  OnStateChangeCallback,
  OnNodeUpdateCallback,
  OnEdgeUpdateCallback,
  OnNodeUpdateEndCallback,
  WorkflowExecutorConfig,
  ExecutionSummary,
  ExecutionLogEntry,
} from "@/types/workflow";
import { compileExecutor, executeFunction } from "./runtime";
import { getDataType } from "./helpers";

/**
 * 워크플로우 실행을 위한 유틸리티
 */
export class WorkflowExecutor {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private executionState: WorkflowRuntimeState;
  private abortController: AbortController | null = null;
  private startNodeId?: string;
  private isSimulated: boolean = false;

  private onStateChange: OnStateChangeCallback;
  private onNodeUpdate?: OnNodeUpdateCallback;
  private onEdgeUpdate?: OnEdgeUpdateCallback;
  private onNodeUpdateEnd?: OnNodeUpdateEndCallback;

  // Executor function cache
  private executionCache = new Map<string, ExecutorFunction>();

  constructor(config: WorkflowExecutorConfig) {
    this.nodes = config.nodes;
    this.edges = config.edges;
    this.startNodeId = config.startNodeId;
    this.isSimulated = config.isSimulated ?? false;
    // mode is always "auto" now - no need to store it
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
      let startNode: WorkflowNode | undefined;

      if (this.startNodeId) {
        // Find the specific Start node by ID
        startNode = this.nodes.find(
          (node) => node.id === this.startNodeId && node.type === "start",
        );
        if (!startNode) {
          throw new Error(`Start node with ID ${this.startNodeId} not found`);
        }
      } else {
        // Fallback: Find first Start node (backward compatible)
        startNode = this.nodes.find((node) => node.type === "start");
        if (!startNode) {
          throw new Error("Start node not found");
        }
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
    data: unknown,
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
        executionError, // Pass error
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
    executionData: ExecutionData,
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
    // Start, End, and Group nodes don't have executors
    if (node.type === "start" || node.type === "end" || node.type === "group") {
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
      const nodeTypeForValidation = node.type as WorkflowNodeType;

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

    if (parentNode?.type === "group") {
      // Group nodes have no execution.config — read from last internal node's outputData
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const groups = (parentNode.data as any).groups as
        | WorkflowNode[]
        | undefined;
      if (groups?.length) {
        const lastInternal = groups[groups.length - 1];
        const lastOutput =
          lastInternal.data.execution?.config?.nodeData?.outputData;
        if (lastOutput !== undefined) return lastOutput;
      }
      // Fall through to context.outputs fallback (group's final output stored under groupNode.id)
    } else {
      const parentOutputData =
        parentNode?.data.execution?.config?.nodeData?.outputData;
      if (parentOutputData !== undefined) {
        return parentOutputData;
      }
    }

    // Fallback: Get from executionState.context.outputs
    const parentOutput = this.executionState.context.outputs.get(
      node.parentNode,
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
    error?: ExecutionError,
    summary?: ExecutionSummary,
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
      summary, // Include summary for END nodes
    };
  }

  /**
   * Extract success value from decision node output
   * Uses early return pattern to avoid nested if statements
   * IMPORTANT: Should only be called for decision nodes
   */
  private extractDecisionSuccess(
    node: WorkflowNode,
    outputData: unknown,
  ): boolean {
    // Assertion: this method should only be called for decision nodes
    if (node.type !== "decision") {
      throw new Error(
        `extractDecisionSuccess should only be called for decision nodes, got ${node.type}`,
      );
    }

    // Plain boolean — new preferred return format
    if (typeof outputData === "boolean") {
      return outputData;
    }

    // Legacy object format: { ...inputData, success: boolean }
    if (typeof outputData === "object" && outputData !== null && "success" in outputData) {
      const successValue = (outputData as { success: unknown }).success;
      if (typeof successValue === "boolean") return successValue;
      console.warn(
        `Decision node ${node.id}: success field is not boolean (${typeof successValue}). Falling back to true.`,
      );
      return true;
    }

    console.warn(
      `Decision node ${node.id}: outputData is neither boolean nor object with success field. Falling back to true.`,
    );
    return true;
  }

  /**
   * Group 노드의 내부 순차 실행
   * 데이터 플로우: inputData → groups[0] → groups[1] → ... → groups[n] → functionCode → outputData
   */
  private async executeGroupInternals(
    groupNode: WorkflowNode,
    inputData: unknown,
  ): Promise<{ outputData: unknown; success: boolean }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupData = groupNode.data as any; // GroupNodeData
    const { groups } = groupData;

    // 빈 그룹 처리
    if (!groups || groups.length === 0) {
      console.warn(`Group node ${groupNode.id} has no internal nodes`);
      return { outputData: inputData, success: true };
    }

    // Group nodes always execute sequentially through internal nodes
    let currentData = inputData;
    let allSucceeded = true;

    // 각 내부 노드를 순차적으로 실행
    for (let i = 0; i < groups.length; i++) {
      const internalNode = groups[i];

      // 유효성 검증
      if (!internalNode || !internalNode.id) {
        throw new Error(
          `Group node ${groupNode.id}: Invalid internal node at index ${i}`,
        );
      }

      // 중첩 Group 방지 (무한 재귀 방지)
      if (internalNode.type === "group") {
        throw new Error(
          `Group node ${groupNode.id}: Nested group nodes are not allowed`,
        );
      }

      try {
        // UI 알림: 내부 노드 실행 시작
        await this.notifyNodeExecuting(internalNode.id, currentData);

        // 내부 노드 실행
        const { outputData, success } = await this.computeNodeOutput(
          internalNode,
          currentData,
        );

        // 출력 저장 (내부 노드 상태 추적용)
        const startTime = Date.now();
        this.storeOutput(internalNode.id, outputData, success, startTime);

        // UI 알림: 내부 노드 실행 완료
        await this.notifyNodeExecuted(internalNode.id, outputData);

        // 다음 내부 노드로 출력 전달
        currentData = outputData;
        allSucceeded = allSucceeded && success;

        // 시각화를 위한 딜레이 (옵션)
        await this.delay(300);
      } catch (error) {
        // Fail-fast: 내부 노드 실패 시 그룹 전체 실패
        this.handleExecutionError(internalNode.id, error as Error);
        throw error; // 에러 전파로 그룹 실행 중단
      }
    }

    // 마지막 내부 노드의 출력을 그룹 출력으로 반환
    return {
      outputData: currentData,
      success: allSucceeded,
    };
  }

  /**
   * Compute node output based on node type and executor
   */
  private async computeNodeOutput(
    node: WorkflowNode,
    inputData: unknown,
  ): Promise<{ outputData: unknown; success: boolean }> {
    // Start node doesn't have execution
    if (node.type === "start") {
      return { outputData: null, success: true };
    }

    // END node returns execution summary
    if (node.type === "end") {
      const summary = this.aggregateExecutionSummary();
      return { outputData: summary, success: true };
    }

    // Group 노드 - 내부 순차 실행
    if (node.type === "group") {
      return await this.executeGroupInternals(node, inputData);
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
    inputData: unknown,
  ): Promise<{ outputData: unknown; success: boolean }> {
    await this.delay(500);

    // Check if simulation mode is active
    if (this.isSimulated) {
      return this.runSimulatedExecution(node, inputData);
    }

    // Real execution
    const result = await executeFunction(execution, inputData, 30000);

    // Handle execution errors differently based on node type
    if (!result.success) {
      // Decision nodes: treat error as success: false (take "no" branch)
      if (node.type === "decision") {
        console.warn(
          `Decision node ${node.id}: executor threw error. Treating as success: false.`,
          result.error,
        );
        return { outputData: result.error, success: false };
      }

      // Task/Service nodes: fail-fast (stop workflow)
      throw new Error(result.error?.message || "Execution failed");
    }

    const outputData = result.data;

    // Extract success from outputData for Decision nodes
    if (node.type === "decision") {
      // Plain boolean return → pass through inputData so children receive it
      if (typeof outputData === "boolean") {
        return { outputData: inputData, success: outputData };
      }
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
    inputData: unknown,
  ): { outputData: unknown; success: boolean } {
    if (node.type === "decision") {
      console.warn(
        `Decision node ${node.id}: no executor configured. Falling back to success=true.`,
      );
      return { outputData: inputData, success: true };
    }

    // Task/Service nodes succeed by default (no custom executor)
    return { outputData: inputData, success: true };
  }

  /**
   * Run simulated execution using mock data
   * Priority: nodeData.outputData > default success
   */
  private runSimulatedExecution(
    node: WorkflowNode,
    inputData: unknown,
  ): { outputData: unknown; success: boolean } {
    // Priority 1: nodeData.outputData
    const mockData = node.data.execution?.config?.nodeData?.outputData;
    if (mockData !== undefined) {
      return this.extractSuccessFromOutput(node, mockData, inputData);
    }

    // Priority 2: Default success response
    return {
      outputData: { success: true, simulated: true, inputData },
      success: true,
    };
  }

  /**
   * Extract success value from outputData (for Decision nodes)
   */
  private extractSuccessFromOutput(
    node: WorkflowNode,
    outputData: unknown,
    inputData?: unknown,
  ): { outputData: unknown; success: boolean } {
    if (node.type === "decision") {
      // Plain boolean → pass through inputData so children receive the decision's input
      if (typeof outputData === "boolean") {
        return { outputData: inputData ?? null, success: outputData };
      }
      const success = this.extractDecisionSuccess(node, outputData);
      return { outputData, success };
    }

    // Task/Service nodes always succeed in simulation mode
    return { outputData, success: true };
  }

  /**
   * Notify UI that node is executing (show inputData)
   */
  private async notifyNodeExecuting(
    nodeId: string,
    inputData: unknown,
  ): Promise<void> {
    if (!this.onNodeUpdate) return;

    const executionData = this.buildExecutorData(
      nodeId,
      "executing",
      inputData,
    );
    this.onNodeUpdate(nodeId, executionData);
    this.syncNodeAfterUpdate(nodeId, executionData);
  }

  /**
   * Notify UI: group node finished — explicitly sets inputData/outputData from internal nodes.
   */
  private async notifyGroupNodeExecuted(
    nodeId: string,
    inputData: unknown,
    outputData: unknown,
  ): Promise<void> {
    if (!this.onNodeUpdate) return;

    const existingNode = this.nodes.find((n) => n.id === nodeId);
    const existingConfig = existingNode?.data.execution?.config;

    const executionData: ExecutionData = {
      state: "executed",
      config: {
        lastModified: existingConfig?.lastModified ?? Date.now(),
        isAsync: existingConfig?.isAsync ?? false,
        nodeData: { inputData, outputData },
      },
    };

    this.onNodeUpdate(nodeId, executionData);
    this.syncNodeAfterUpdate(nodeId, executionData);
  }

  /**
   * Notify UI that node finished executing (show outputData)
   */
  private async notifyNodeExecuted(
    nodeId: string,
    outputData: unknown,
  ): Promise<void> {
    if (!this.onNodeUpdate) return;

    // Check if this is an END node and outputData is the summary
    const node = this.nodes.find((n) => n.id === nodeId);
    const isEndNode = node?.type === "end";
    const summary =
      isEndNode && outputData ? (outputData as ExecutionSummary) : undefined;

    const executionData = this.buildExecutorData(
      nodeId,
      "executed",
      outputData,
      undefined,
      summary,
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
    startTime: number,
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
    let currentNodeFailed = false;

    try {
      // 2. Get input data
      const inputData = this.getNodeInput(nodeId);

      // 3. Notify UI: node is executing
      await this.notifyNodeExecuting(nodeId, inputData);

      // 4. Execute node logic
      currentNodeFailed = true;
      const { outputData, success } = await this.computeNodeOutput(
        node,
        inputData,
      );
      currentNodeFailed = false;

      // 5. Store output
      this.storeOutput(nodeId, outputData, success, startTime);

      // 6. Notify UI: node finished
      if (node.type === "group") {
        await this.notifyGroupNodeExecuted(nodeId, inputData, outputData);
      } else {
        await this.notifyNodeExecuted(nodeId, outputData);
      }

      // 7. Execute next nodes
      await this.executeNextNodes(nodeId);
    } catch (error) {
      if (currentNodeFailed) {
        this.handleExecutionError(nodeId, error as Error);
      }
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
      (node) => node.parentNode === currentNode.id,
    );

    if (allChildren.length === 0) return [];

    // Decision node: select branch(es) - supports multiple edges per port
    if (currentNode.type === "decision") {
      const selectedChildren = this.selectChildrenByBranch(
        currentNode.id,
        allChildren,
      );
      return selectedChildren;
    }

    // Normal node: all children
    return allChildren;
  }

  /**
   * Execute a child node with edge data transfer visualization
   */
  private async executeChildWithEdge(
    currentNodeId: string,
    child: WorkflowNode,
  ): Promise<void> {
    // Find edge connecting current node to child
    const edge = this.edges.find(
      (e) => e.source === currentNodeId && e.target === child.id,
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

    // Execute child node — catch per-node errors to allow sibling branches to continue
    try {
      await this.executeNode(child.id);
    } catch (error) {
      // Node's error is already recorded by handleExecutionError inside executeNode.
      // Do NOT re-throw: sibling branches must continue executing independently.
      console.warn(
        `Node ${child.id} failed (sibling branches continue):`,
        (error as Error).message,
      );
    }

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

    // END node: aggregate execution summary
    if (currentNode.type === "end") {
      const summary = this.aggregateExecutionSummary();

      // Store summary in END node's execution data (now includes summary in ExecutionData)
      await this.notifyNodeExecuted(currentNodeId, summary);

      return;
    }

    // Get children to execute (decision node selects one, normal node gets all)
    const childrenToExecute = this.getChildrenToExecute(currentNode);

    // Execute all children in parallel (each branch runs independently)
    await Promise.all(
      childrenToExecute.map((child) =>
        this.executeChildWithEdge(currentNode.id, child),
      ),
    );
  }

  /**
   * Decision 노드에서 선택된 브랜치의 모든 자식 노드 반환
   * - success=true → yes port의 모든 edge
   * - success=false → no port의 모든 edge
   * - 같은 port에서 여러 edge가 나가면 모두 반환 (병렬 실행)
   */
  private selectChildrenByBranch(
    decisionNodeId: string,
    children: WorkflowNode[],
  ): WorkflowNode[] {
    if (children.length === 0) return [];

    // Get success from stored output
    const storedOutput =
      this.executionState.context.outputs.get(decisionNodeId);
    const success =
      storedOutput?.success !== undefined ? storedOutput.success : true;

    // Find ALL yes edges (not just one)
    const yesEdges = this.edges.filter(
      (e) =>
        e.source === decisionNodeId &&
        (e.sourcePort === "yes" || e.label === "Yes"),
    );

    // Find ALL no edges (not just one)
    const noEdges = this.edges.filter(
      (e) =>
        e.source === decisionNodeId &&
        (e.sourcePort === "no" || e.label === "No"),
    );

    // Select edges based on success value
    const selectedEdges = success ? yesEdges : noEdges;

    // Get ALL children connected by selected edges
    const selectedChildren = children.filter((child) =>
      selectedEdges.some((edge) => edge.target === child.id),
    );

    // Fallback: if no children found, return first child
    return selectedChildren.length > 0 ? selectedChildren : [children[0]];
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
   * Aggregate execution summary from current context
   * Called when END node is reached
   */
  private aggregateExecutionSummary(): ExecutionSummary {
    const { outputs, startTime } = this.executionState.context;
    const endTime = Date.now();

    // Extract execution path from outputs Map keys (insertion order preserved)
    const executedPath = Array.from(outputs.keys());

    // Build detailed logs array
    const logs: ExecutionLogEntry[] = executedPath.map((nodeId) => {
      const result = outputs.get(nodeId)!;
      const node = this.nodes.find((n) => n.id === nodeId);

      return {
        nodeId,
        nodeType: node?.type || "task",
        timestamp: result.timestamp || 0,
        executionTime: result.executionTime || 0,
        outputData: result.data,
        success: result.success,
      };
    });

    // Count successful nodes
    const successCount = logs.filter((log) => log.success).length;

    return {
      executedPath,
      logs,
      totalExecutionTime: endTime - startTime,
      successCount,
      outputs,
      startTime,
      endTime,
    };
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
  config: WorkflowExecutorConfig,
): WorkflowExecutor {
  return new WorkflowExecutor(config);
}
