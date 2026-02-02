'use client';

import { ReactDiagramProvider } from 'react-cosmos-diagram';
import { AIWorkflowEditorProvider } from '@/contexts/AIWorkflowEditor';
import { ExecutorEditorProvider } from '@/contexts/ExecutorEditor';
import { ExecutionSummaryProvider } from '@/contexts/ExecutionSummary';
import { PropertiesPanelProvider } from '@/contexts/PropertiesPanel';
import { WorkflowExecutionProvider } from '@/contexts/WorkflowExecution';
import { WorkflowGeneratorProvider } from '@/contexts/WorkflowGenerator';
import DialogProvider from '@/contexts/Dialog';
import ToastProvider from '@/contexts/Toast';

export default function WorkflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <DialogProvider>
        <ReactDiagramProvider>
          <ExecutorEditorProvider>
            <ExecutionSummaryProvider>
              <PropertiesPanelProvider>
                <AIWorkflowEditorProvider>
                  <WorkflowGeneratorProvider>
                    <WorkflowExecutionProvider>
                      <div className="modal-root" id="modal-root" />
                      {children}
                    </WorkflowExecutionProvider>
                  </WorkflowGeneratorProvider>
                </AIWorkflowEditorProvider>
              </PropertiesPanelProvider>
            </ExecutionSummaryProvider>
          </ExecutorEditorProvider>
        </ReactDiagramProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
