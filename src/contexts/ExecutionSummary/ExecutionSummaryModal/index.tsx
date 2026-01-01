import Modal from "@/components/Modal";
import ExecutionSummaryView from "./View";
import type { ExecutionSummary } from "@/types/workflow";

interface ExecutionSummaryModalProps {
  open: boolean;
  summary: ExecutionSummary | null;
  onClose: () => void;
}

function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function ExecutionSummaryModal({
  open,
  summary,
  onClose,
}: ExecutionSummaryModalProps) {
  return (
    <Modal
      // selector="#workflow-summary-modal"
      title="Workflow Execution Summary"
      description={`Completed in ${formatExecutionTime(summary?.totalExecutionTime || 0)}`}
      open={open}
      onClose={onClose}
    >
      {summary && <ExecutionSummaryView summary={summary} />}
    </Modal>
  );
}
