import { useEffect } from "react";
import { useExecutorEditorContext } from "@/contexts/ExecutorEditor";
import type { ExecutorOnSave } from "@/contexts/ExecutorEditor/type";

export function useExecutorOnSave(handler: ExecutorOnSave) {
  const { registerOnSave } = useExecutorEditorContext();

  useEffect(() => {
    const register = registerOnSave(handler);
    return register;
  }, []);
}
