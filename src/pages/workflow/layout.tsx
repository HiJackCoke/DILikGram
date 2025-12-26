import { Outlet } from "react-router-dom";

import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { PropertiesPanelProvider } from "@/contexts/PropertiesPanel";
import { WorkflowExecutionProvider } from "@/contexts/WorkflowExecution";
import { WorkflowGeneratorProvider } from "@/contexts/WorkflowGenerator";
import DialogProvider from "@/contexts/Dialog";
import ToastProvider from "@/contexts/Toast";

const Layout = () => {
  return (
    <ToastProvider>
      <DialogProvider>
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
      </DialogProvider>
    </ToastProvider>
  );
};

export default Layout;
