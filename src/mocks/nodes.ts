import type { WorkflowNode } from "@/types/nodes";
import { Position } from "react-cosmos-diagram";
import { createTypedExecutor } from "@/utils/executorHelpers";

export const initialNodes: WorkflowNode[] = [
  {
    id: "start-1",
    type: "start",
    data: {
      title: "Start",
      ports: [
        { id: "output", position: Position.Bottom, type: "source" as const },
      ],
    },

    position: { x: 300, y: 50 },
  },
  {
    id: "task-1",
    type: "task",
    parentNode: "start-1",
    data: {
      title: "데이터 수집",
      description: "외부 API에서 데이터를 가져옵니다",
      // status: "completed" as const,
      assignee: "김개발",
      estimatedTime: 30,
      metadata: {
        소스: "REST API",
        타임아웃: "30초",
      },
      ports: [
        { id: "input", position: Position.Top, type: "target" as const },
        { id: "output", position: Position.Bottom, type: "source" as const },
      ],
      executor: {
        config: createTypedExecutor<unknown, unknown>(
          `// Example: Transform data
return "REST API";`
        ),
      },
    },
    position: { x: 250, y: 180 },
  },
  {
    id: "decision-1",
    type: "decision",
    parentNode: "task-1",
    data: {
      title: "데이터 검증",
      condition: "isValid?",
      ports: [
        { id: "input", position: Position.Top, type: "target" as const },
        {
          id: "yes",
          position: Position.Right,
          type: "source" as const,
          label: "Yes",
        },
        {
          id: "no",
          position: Position.Bottom,
          type: "source" as const,
          label: "No",
        },
      ],

      executor: {
        config: createTypedExecutor<unknown, unknown>(
          `//
  
  return {
    success: !!nodeInput,
    validationChecked: true,
    validationTime: Date.now()
  
  };`
          // {
          //   inputType: "unknown",
          //   outputType: "unknown",
          // }
        ),
      },
    },
    position: { x: 270, y: 380 },
  },
  {
    id: "service-1",
    type: "service",
    parentNode: "decision-1",
    data: {
      title: "API 호출",
      description: "처리된 데이터를 서버에 전송합니다",
      serviceType: "api" as const,
      mode: "panel",
      method: "POST" as const,
      endpoint: "/api/v1/data",
      // status: "running" as const,
      headers: {
        "Content-Type": "application/json",
      },
      body: {},
      retry: {
        count: 3,
        delay: 2000,
      },
      timeout: 10000,
      ports: [
        { id: "input", position: Position.Left, type: "target" as const },
        { id: "output", position: Position.Bottom, type: "source" as const },
      ],

      executor: {
        config: createTypedExecutor<unknown, unknown>(
          `// Example: Async API call with full context (auto-detected from 'await' keyword)
  const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
  const data = await response.json();
  return {
    ...data,
    timestamp: Date.now()
  };`
        ),
      },
    },
    position: { x: 500, y: 400 },
  },
  {
    id: "task-2",
    type: "task",
    parentNode: "decision-1",
    data: {
      title: "에러 로깅",
      description: "실패한 요청을 기록합니다",
      // status: "idle" as const,
      metadata: {
        저장소: "CloudWatch",
        레벨: "ERROR",
      },
      ports: [
        { id: "input", position: Position.Top, type: "target" as const },
        { id: "output", position: Position.Bottom, type: "source" as const },
      ],
    },
    position: { x: 250, y: 580 },
  },
  {
    id: "end-success",
    type: "end",
    parentNode: "service-1",
    data: {
      title: "완료",
      status: "success" as const,
      ports: [{ id: "input", position: Position.Top, type: "target" as const }],
    },
    position: { x: 550, y: 600 },
  },
  {
    id: "end-failure",
    type: "end",
    parentNode: "task-2",
    data: {
      title: "실패",
      status: "failure" as const,
      ports: [{ id: "input", position: Position.Top, type: "target" as const }],
    },
    position: { x: 250, y: 750 },
  },
];
