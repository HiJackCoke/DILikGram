import type { WorkflowNode, ExecutionContext } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

export type ExecutionMode = "success" | "failure";

export type ExecutionState = {
  currentNodeId: string | null;
  executedNodeIds: Set<string>;
  activeEdgeIds: Set<string>;
  isRunning: boolean;

  // 실행 컨텍스트
  context: ExecutionContext;
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

  constructor(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    mode: ExecutionMode,
    onStateChange: (state: ExecutionState) => void
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.mode = mode;
    this.onStateChange = onStateChange;
    this.executionState = {
      currentNodeId: null,
      executedNodeIds: new Set(),
      activeEdgeIds: new Set(),
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
      this.executionState.currentNodeId = null;
      this.executionState.activeEdgeIds.clear();
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
   * 특정 노드 실행
   */
  private async executeNode(nodeId: string): Promise<void> {
    if (this.abortController?.signal.aborted) {
      throw new Error("Execution aborted");
    }

    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // 현재 노드 설정
    this.executionState.currentNodeId = nodeId;
    this.notifyStateChange();

    // 노드 실행 시뮬레이션 (1초 대기)
    await this.delay(1000);

    // 실행 완료 표시
    this.executionState.executedNodeIds.add(nodeId);
    this.notifyStateChange();

    // 다음 노드 찾기 및 실행
    await this.executeNextNodes(nodeId);
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
        // 엣지 애니메이션 활성화
        const edge = this.edges.find(
          (e) => e.source === currentNodeId && e.target === selectedChild.id
        );
        if (edge) {
          this.executionState.activeEdgeIds.add(edge.id);
          this.notifyStateChange();
          await this.delay(500); // 엣지 애니메이션 표시
        }

        await this.executeNode(selectedChild.id);

        // 엣지 애니메이션 비활성화
        if (edge) {
          this.executionState.activeEdgeIds.delete(edge.id);
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
          this.executionState.activeEdgeIds.add(edge.id);
          this.notifyStateChange();
          await this.delay(500);
        }

        await this.executeNode(child.id);

        // 엣지 애니메이션 비활성화
        if (edge) {
          this.executionState.activeEdgeIds.delete(edge.id);
          this.notifyStateChange();
        }
      }
    }
  }

  /**
   * Decision 노드에서 모킹 모드에 따라 분기 선택
   */
  private selectBranchByMode(
    decisionNodeId: string,
    children: WorkflowNode[]
  ): WorkflowNode | null {
    if (children.length === 0) return null;

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

    if (this.mode === "success" && yesEdge) {
      return children.find((c) => c.id === yesEdge.target) || null;
    } else if (this.mode === "failure" && noEdge) {
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
  onStateChange: (state: ExecutionState) => void
): WorkflowExecutor {
  return new WorkflowExecutor(nodes, edges, mode, onStateChange);
}
