import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { PropertiesPanelProvider } from "@/contexts/PropertiesPanel";
import { WorkflowExecutionProvider } from "@/contexts/WorkflowExecution";
import { WorkflowGeneratorProvider } from "@/contexts/WorkflowGenerator";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <ExecutorEditorProvider>
      <PropertiesPanelProvider>
        <WorkflowGeneratorProvider>
          <div className="modal-root" id="executor-modal" />
          <div className="modal-root" id="workflow-generator-modal" />
          <WorkflowExecutionProvider>
            <Outlet />
          </WorkflowExecutionProvider>
        </WorkflowGeneratorProvider>
      </PropertiesPanelProvider>
    </ExecutorEditorProvider>
  );
};

export default Layout;
