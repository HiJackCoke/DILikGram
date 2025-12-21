import { useEffect } from "react";
import { usePropertiesPanel } from "@/contexts/PropertiesPanel";
import type { PropertiesOnSave } from "@/contexts/PropertiesPanel/type";

export function usePropertiesOnSave(handler: PropertiesOnSave) {
  const { registerOnSave } = usePropertiesPanel();

  useEffect(() => {
    const unregister = registerOnSave(handler);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
