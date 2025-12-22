import { useEffect } from "react";

import { useWorkflowGenerator } from "@/contexts/WorkflowGenerator";
import type { RegisterOnWorkflowGenerated } from "@/contexts/WorkflowGenerator/type";

export function useWorkflowGeneratorOnGenerate(
  handler: RegisterOnWorkflowGenerated
) {
  const { registerOnGenerate } = useWorkflowGenerator();

  useEffect(() => {
    const unregister = registerOnGenerate(handler);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
