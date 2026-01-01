import { Outlet } from "react-router-dom";

import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { ExecutionSummaryProvider } from "@/contexts/ExecutionSummary";
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
          <ExecutionSummaryProvider>
            <PropertiesPanelProvider>
              <WorkflowGeneratorProvider>
                <WorkflowExecutionProvider>
                  <div className="modal-root" id="modal-root" />
                  <Outlet />
                </WorkflowExecutionProvider>
              </WorkflowGeneratorProvider>
            </PropertiesPanelProvider>
          </ExecutionSummaryProvider>
        </ExecutorEditorProvider>
      </DialogProvider>
    </ToastProvider>
  );
};

export default Layout;
