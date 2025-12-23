import ReactDOM from "react-dom/client";
import DialogView from "@/components/Dialog/View";

import type { ReactNode } from "react";
import type { DialogState } from "@/components/Dialog/type";

declare global {
  interface Window {
    dialog: Dialog | Element;
  }
  const dialog: Dialog;
}

class Dialog {
  private root;
  private dialogState: DialogState = {
    revealed: false,
    title: "",
    description: "",
    type: "alert",
  };
  private resolve: ((value: boolean) => void) | null = null;

  constructor() {
    const target = document.getElementById("dialog");
    if (target) {
      this.root = ReactDOM.createRoot(target);
    }
  }

  private renderDialog() {
    this.root?.render(
      <DialogView
        revealed={this.dialogState.revealed}
        title={this.dialogState.title}
        description={this.dialogState.description}
        type={this.dialogState.type}
        onConfirm={() => this.closeDialog(true)}
        onCancel={() => this.closeDialog(false)}
      />
    );
  }

  private closeDialog(confirmed: boolean) {
    this.dialogState = { ...this.dialogState, revealed: false };
    this.renderDialog();
    if (this.resolve) {
      this.resolve(confirmed);
      this.resolve = null;
    }
  }

  confirm(
    title: string,
    description: string | ReactNode = ""
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.dialogState = {
        revealed: true,
        type: "confirm",
        title,
        description,
      };
      this.renderDialog();
    });
  }

  alert(title: string, description: string | ReactNode = ""): Promise<void> {
    return new Promise((resolve) => {
      this.resolve = () => resolve();
      this.dialogState = { revealed: true, type: "alert", title, description };
      this.renderDialog();
    });
  }
}

export default Dialog;
