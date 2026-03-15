import { ExecutionConfig, WorkflowNode, WorkflowNodeType } from "@/types";
import { TestCase } from "@/types/prd";
import { GroupDataFlowProps } from "./GroupDataFlow/type";

type CoreProps = GroupDataFlowProps & {
  isInternalNode?: boolean;

  nodeType: WorkflowNodeType;



  openInternalNode?: (node: WorkflowNode) => void;

  onClose?: () => void;
};

export type ExecutorEditorContentViewProps = CoreProps & {
  meta: ExecutionConfig["nodeData"];
  code: string;
  isAsync: boolean;
  error: string | null;
  inputData: string;
  outputData: string | null;
  testCases: TestCase[];

  onCodeChange: (code: string) => void;
  onInputDataChange: (input: string) => void;
  onTest: () => Promise<void>;
  onSave: () => void;

  // For test cases
  onTestCasesChange: (cases: TestCase[]) => void;
  onRunTest: (testCase: TestCase) => Promise<void>;
  onRunAllTests: () => Promise<void>;
};

export type ExecutorEditorContentProps = CoreProps & {
  config?: ExecutionConfig;
  initialTestCases?: TestCase[];
  isSimulated?: boolean;

  onSave: (config: ExecutionConfig) => void;
};
