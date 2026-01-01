import { createContext, useState, useCallback, use } from "react";
import type { ReactNode } from "react";
import type { ExecutionSummary } from "@/types/workflow";
import ExecutionSummaryModal from "@/contexts/ExecutionSummary/ExecutionSummaryModal";

interface ExecutionSummaryContextValue {
  open: (summary: ExecutionSummary) => void;
  close: () => void;
}

interface ExecutionSummaryProviderProps {
  children: ReactNode;
}

const ExecutionSummaryContext =
  createContext<ExecutionSummaryContextValue | null>(null);

export function ExecutionSummaryProvider({
  children,
}: ExecutionSummaryProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);

  const open = useCallback((newSummary: ExecutionSummary) => {
    setSummary(newSummary);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSummary(null);
  }, []);

  return (
    <ExecutionSummaryContext value={{ open, close }}>
      {children}

      <ExecutionSummaryModal open={isOpen} summary={summary} onClose={close} />
    </ExecutionSummaryContext>
  );
}

export function useExecutionSummary() {
  const context = use(ExecutionSummaryContext);
  if (!context) {
    throw new Error(
      "useExecutionSummary must be used within ExecutionSummaryProvider"
    );
  }
  return context;
}
