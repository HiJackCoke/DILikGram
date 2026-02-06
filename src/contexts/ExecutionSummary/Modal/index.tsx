import Modal from "@/components/ui/Modal";
import ExecutionSummaryView from "./View";
import type { ExecutionSummary } from "@/types/workflow";
import { ModalProps } from "@/types";

interface ExecutionSummaryModalProps
  extends Pick<ModalProps, "show" | "onClose"> {
  summary: ExecutionSummary | null;
}

function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function ExecutionSummaryModal({
  show,
  summary,
  onClose,
}: ExecutionSummaryModalProps) {
  return (
    <Modal
      // selector="#workflow-summary-modal"
      title="Workflow Execution Summary"
      description={`Completed in ${formatExecutionTime(summary?.totalExecutionTime || 0)}`}
      show={show}
      onClose={onClose}
    >
      {summary && <ExecutionSummaryView summary={summary} />}
    </Modal>
  );
}
