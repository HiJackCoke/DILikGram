import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { PropertiesPanelProvider } from "@/contexts/PropertiesPanel";
import { WorkflowExecutionProvider } from "@/contexts/WorkflowExecution";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <ExecutorEditorProvider>
      <PropertiesPanelProvider>
        <div id="executor-modal" />
        <WorkflowExecutionProvider>
          <Outlet />
        </WorkflowExecutionProvider>
      </PropertiesPanelProvider>
    </ExecutorEditorProvider>
  );
};

export default Layout;
