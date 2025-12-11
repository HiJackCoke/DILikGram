import type { WorkflowNode } from "@/types/nodes";
import type { EdgeTransferData, WorkflowEdge } from "@/types/edges";
import type {
  ExecutionError,
  ExecutorFunction,
  ExecutorResult,
  ExecutorState,
} from "@/types/executor";
import { compileExecutor, executeFunction } from "./executorRuntime";

export type ExecutionMode = "success" | "failure";

export type ExecutionState = {
  // activeEdgeIds: Set<string>;
  isRunning: boolean;

  // 실행 컨텍스트
  context: ExecutionContext;
};

type ExecutionOutput = {
  data: unknown;
  timestamp: number;
  executionTime: number;
  success?: boolean; // NEW: For DecisionNode branching
};

export type ExecutionContext = {
  outputs: Map<string, ExecutionOutput>; // nodeId -> output
  errors: Map<string, ExecutionError>; // nodeId -> error
  startTime: number;
  endTime?: number;
};

/**
 * 워크플로우 실행을 위한 유틸리티
 */
export class WorkflowExecutor {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private mode: ExecutionMode;
  private onStateChange: (state: ExecutionState) => void;
  private executionState: ExecutionState;
  private abortController: AbortController | null = null;

  private onNodeUpdate?: (
    nodeId: string,
    update: { result: ExecutorResult; state: ExecutorState }
  ) => void;
  private onEdgeUpdate?: (
    edgeId: string,
    data: Partial<WorkflowEdge["data"]>
  ) => void;

  // Executor function cache
  private executorCache = new Map<string, ExecutorFunction>();

  constructor(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    mode: ExecutionMode,
    onStateChange: (state: ExecutionState) => void,
    onNodeUpdate?: (
      nodeId: string,
      update: { result: ExecutorResult; state: ExecutorState }
    ) => void,
    onEdgeUpdate?: (edgeId: string, data: Partial<WorkflowEdge["data"]>) => void
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.mode = mode;
    this.onStateChange = onStateChange;
    this.onNodeUpdate = onNodeUpdate; // 추가
    this.onEdgeUpdate = onEdgeUpdate; // 추가
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
      dataType: typeof data,
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
  private handleNodeError(nodeId: string, error: Error): void {
    const timestamp = Date.now();
    const executionError: ExecutionError = {
      message: error.message,
      stack: error.stack,
      timestamp,
    };

    this.executionState.context.errors.set(nodeId, executionError);

    // 노드에 에러 표시
    if (this.onNodeUpdate) {
      this.onNodeUpdate(nodeId, {
        result: {
          success: false,
          error: executionError,
          executionTime: timestamp,
        },
        state: "executed",
      });
    }
  }

  /**
   * Get or compile executor for a node
   * Returns null if no executor configured or node doesn't support executors
   */
  private getExecutorForNode(node: WorkflowNode): ExecutorFunction | null {
    // Start and End nodes don't have executors
    if (node.type === "start" || node.type === "end") {
      return null;
    }

    const data = node.data;

    const config = data.executor?.config;

    // No custom executor configured
    if (!config?.functionCode) {
      return null;
    }

    // Check cache
    const cacheKey = `${node.id}-${config.lastModified}`;
    if (this.executorCache.has(cacheKey)) {
      return this.executorCache.get(cacheKey)!;
    }

    // Compile and cache with node type validation
    try {
      const nodeTypeForValidation = node.type as
        | "task"
        | "service"
        | "decision";

      const executor = compileExecutor(config, nodeTypeForValidation);
      this.executorCache.set(cacheKey, executor);

      return executor;
    } catch (error) {
      console.error(`Failed to compile executor for ${node.id}:`, error);
      // Display error on node for validation failures (e.g., TaskNode with async)
      this.handleNodeError(node.id, error as Error);
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

    const parentOutput = this.executionState.context.outputs.get(
      node.parentNode
    );
    return parentOutput?.data ?? null;
  }

  /**
   * 특정 노드 실행
   */
  private async executeNode(nodeId: string): Promise<void> {
    if (this.abortController?.signal.aborted) {
      throw new Error("Execution aborted");
    }

    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const startTime = Date.now();

    try {
      // 1. Input 데이터 가져오기
      const inputData = this.getNodeInput(nodeId);

      // 2. 노드에 inputData 표시
      if (this.onNodeUpdate) {
        this.onNodeUpdate(nodeId, {
          result: {
            success: true,
            data: inputData,
            executionTime: startTime,
          },
          state: "executing",
        });
      }

      // 4. Execute node with custom executor or default behavior
      let outputData: unknown;
      let success: boolean | undefined; // Track success for DecisionNode

      if (node.type === "start") {
        // Start node: no transformation, pass null
        outputData = null;
      } else {
        // Task/Service node: transform data

        const executor = this.getExecutorForNode(node);
        if (executor) {
          await this.delay(500);
          const result = await executeFunction(executor, inputData, 30000);

          if (!result.success) {
            throw new Error(result.error.message || "Execution failed");
          }

          success =
            node.type === "decision" && this.mode === "failure"
              ? false
              : result.success;
          outputData = result.data;
        } else {
          // Default: identity function
          await this.delay(1000);
          outputData = inputData;
        }
      }

      // 5. Output 저장
      const executionTime = Date.now() - startTime;
      this.executionState.context.outputs.set(nodeId, {
        data: outputData,
        timestamp: Date.now(),
        executionTime,
        success, // Include success for DecisionNode
      });

      // 6. 노드에 결과 표시
      if (this.onNodeUpdate) {
        this.onNodeUpdate(nodeId, {
          result: {
            success: true,
            data: outputData,
            executionTime,
          },
          state: "executed",
        });
      }

      // 8. 다음 노드 실행
      await this.executeNextNodes(nodeId);
    } catch (error) {
      // 에러 처리
      this.handleNodeError(nodeId, error as Error);
      throw error; // 즉시 중단 (Fail-Fast)
    }
  }

  /**
   * 다음 노드들 실행
   */
  private async executeNextNodes(currentNodeId: string): Promise<void> {
    const currentNode = this.nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return;

    // End 노드면 종료
    if (currentNode.type === "end") {
      return;
    }

    // 현재 노드의 자식 노드들 찾기
    const children = this.nodes.filter(
      (node) => node.parentNode === currentNodeId
    );

    if (children.length === 0) return;

    // Decision 노드인 경우: 모킹 모드에 따라 분기 선택
    if (currentNode.type === "decision") {
      const selectedChild = this.selectBranchByMode(currentNodeId, children);
      if (selectedChild) {
        // 엣지 찾아서 데이터 전달 시각화
        const edge = this.edges.find(
          (e) => e.source === currentNodeId && e.target === selectedChild.id
        );
        if (edge) {
          // 현재 노드의 output 가져오기
          const currentOutput =
            this.executionState.context.outputs.get(currentNodeId);
          const outputData = currentOutput?.data;

          await this.transferDataThroughEdge(edge.id, outputData); // 추가
          this.notifyStateChange();
          await this.delay(500);
        }

        await this.executeNode(selectedChild.id);

        // 엣지 애니메이션 비활성화
        if (edge) {
          this.notifyStateChange();
        }
      }
    } else {
      // 일반 노드: 모든 자식 순차 실행
      for (const child of children) {
        // 엣지 애니메이션 활성화
        const edge = this.edges.find(
          (e) => e.source === currentNodeId && e.target === child.id
        );

        if (edge) {
          // 현재 노드의 output 가져오기
          const currentOutput =
            this.executionState.context.outputs.get(currentNodeId);
          const outputData = currentOutput?.data;

          await this.transferDataThroughEdge(edge.id, outputData); // 추가
          this.notifyStateChange();
          await this.delay(500);
        }

        await this.executeNode(child.id);

        // 엣지 애니메이션 비활성화
        if (edge) {
          this.notifyStateChange();
        }
      }
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
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  mode: ExecutionMode,
  onStateChange: (state: ExecutionState) => void,
  onNodeUpdate?: (
    nodeId: string,
    update: { result: ExecutorResult; state: ExecutorState }
  ) => void,
  onEdgeUpdate?: (edgeId: string, data: Partial<WorkflowEdge["data"]>) => void
): WorkflowExecutor {
  return new WorkflowExecutor(
    nodes,
    edges,
    mode,
    onStateChange,
    onNodeUpdate,
    onEdgeUpdate
  );
}
