import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { PropertiesPanelProvider } from "@/contexts/PropertiesPanel";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <ExecutorEditorProvider>
      <PropertiesPanelProvider>
        <div id="executor-modal" />
        <Outlet />
      </PropertiesPanelProvider>
    </ExecutorEditorProvider>
  );
};

export default Layout;
