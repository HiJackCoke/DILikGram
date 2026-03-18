import { ExecutionConfig, WorkflowNodeType } from "@/types";
import { TestCase } from "@/types/prd";
import { GroupDataFlowProps } from "./GroupDataFlow/type";

type CoreProps = Omit<GroupDataFlowProps, "rootInputData"> & {
  isVisibleTypeHint?: boolean;
  isVisibleTestExecutor?: boolean;

  nodeType: WorkflowNodeType;

  onClose?: () => void;
};

export type ExecutorEditorContentViewProps = CoreProps & {
  meta: ExecutionConfig["nodeData"];
  code: string;
  isAsync: boolean;
  error: string | null;
  inputData: string;
  outputData?: string | null;
  testCases: TestCase[];

  onCodeChange: (code: string) => void;
  onInputDataChange: (input: string) => void;
  onRunCode: () => Promise<void>;
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
  onRunCode?: (meta: ExecutionConfig["nodeData"]) => void;
};
