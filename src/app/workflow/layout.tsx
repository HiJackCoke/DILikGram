"use client";

import { useEffect } from "react";
import { ReactDiagramProvider } from "react-cosmos-diagram";
import { AIWorkflowEditorProvider } from "@/contexts/AIWorkflowEditor";
import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { ExecutionSummaryProvider } from "@/contexts/ExecutionSummary";
import { PropertiesPanelProvider } from "@/contexts/PropertiesPanel";
import { WorkflowExecutionProvider } from "@/contexts/WorkflowExecution";
import { WorkflowGeneratorProvider } from "@/contexts/WorkflowGenerator";
import { WorkflowVersioningProvider } from "@/contexts/WorkflowVersioning";
import { UIPreviewProvider } from "@/contexts/UIPreview";
// import DialogProvider from "@/contexts/Dialog";
// import ToastProvider from "@/contexts/Toast";

export default function WorkflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <ReactDiagramProvider>
      <PropertiesPanelProvider>
        <WorkflowExecutionProvider>
          <ExecutorEditorProvider>
            <ExecutionSummaryProvider>
              <AIWorkflowEditorProvider>
                <WorkflowGeneratorProvider>
                  <WorkflowVersioningProvider>
                    <UIPreviewProvider>
                      <div className="modal-root" id="workflow-generator-modal" />
                      <div className="modal-root" id="workflow-summary-modal" />

                      {children}
                    </UIPreviewProvider>
                  </WorkflowVersioningProvider>
                </WorkflowGeneratorProvider>
              </AIWorkflowEditorProvider>
            </ExecutionSummaryProvider>
          </ExecutorEditorProvider>
        </WorkflowExecutionProvider>
      </PropertiesPanelProvider>
    </ReactDiagramProvider>
    // <ToastProvider>
    //   <DialogProvider>
    //     <ReactDiagramProvider>
    //       <PropertiesPanelProvider>
    //         <ExecutorEditorProvider>
    //           <ExecutionSummaryProvider>
    //             <AIWorkflowEditorProvider>
    //               <WorkflowGeneratorProvider>
    //                 <WorkflowExecutionProvider>
    //                   <WorkflowVersioningProvider>

    //                     <div className="modal-root" id="workflow-generator-modal" />
    //                     <div className="modal-root" id="workflow-summary-modal" />

    //                     {children}
    //                   </WorkflowVersioningProvider>
    //                 </WorkflowExecutionProvider>
    //               </WorkflowGeneratorProvider>
    //             </AIWorkflowEditorProvider>
    //           </ExecutionSummaryProvider>
    //         </ExecutorEditorProvider>
    //       </PropertiesPanelProvider>
    //     </ReactDiagramProvider>
    //   </DialogProvider>
    // </ToastProvider>
  );
}
