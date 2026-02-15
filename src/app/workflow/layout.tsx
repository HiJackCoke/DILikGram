"use client";

import { ReactDiagramProvider } from "react-cosmos-diagram";
import { AIWorkflowEditorProvider } from "@/contexts/AIWorkflowEditor";
import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { ExecutionSummaryProvider } from "@/contexts/ExecutionSummary";
import { PropertiesPanelProvider } from "@/contexts/PropertiesPanel";
import { WorkflowExecutionProvider } from "@/contexts/WorkflowExecution";
import { WorkflowGeneratorProvider } from "@/contexts/WorkflowGenerator";
import { WorkflowVersioningProvider } from "@/contexts/WorkflowVersioning";
import DialogProvider from "@/contexts/Dialog";
import ToastProvider from "@/contexts/Toast";

export default function WorkflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <DialogProvider>
        <ReactDiagramProvider>
          <PropertiesPanelProvider>
            <ExecutorEditorProvider>
              <ExecutionSummaryProvider>
                <AIWorkflowEditorProvider>
                  <WorkflowGeneratorProvider>
                    <WorkflowExecutionProvider>
                      <WorkflowVersioningProvider>
                        <div className="modal-root" id="modal-root" />
                        <div className="drawer-root" id="drawer-root" />
                        {children}
                      </WorkflowVersioningProvider>
                    </WorkflowExecutionProvider>
                  </WorkflowGeneratorProvider>
                </AIWorkflowEditorProvider>
              </ExecutionSummaryProvider>
            </ExecutorEditorProvider>
          </PropertiesPanelProvider>
        </ReactDiagramProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
