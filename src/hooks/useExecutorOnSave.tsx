import { useEffect } from "react";
import { useExecutorEditorContext } from "@/contexts/ExecutorEditor";
import type { ExecutorOnSave } from "@/contexts/ExecutorEditor/type";

export function useExecutorOnSave(handler: ExecutorOnSave) {
  const { registerOnSave } = useExecutorEditorContext();

  useEffect(() => {
    const unregister = registerOnSave(handler);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
