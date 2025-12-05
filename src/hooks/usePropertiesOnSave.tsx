import { useEffect } from "react";
import { usePropertiesPanelContext } from "@/contexts/PropertiesPanel";
import type { PropertiesOnSave } from "@/contexts/PropertiesPanel/type";

export function usePropertiesOnSave(handler: PropertiesOnSave) {
  const { registerOnSave } = usePropertiesPanelContext();

  useEffect(() => {
    const unregister = registerOnSave(handler);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
