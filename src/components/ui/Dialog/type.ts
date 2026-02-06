import type { ReactNode } from "react";

export type DialogType = "confirm" | "alert";

export interface DialogState {
  revealed: boolean;
  title: string;
  description: string | ReactNode;
  type: DialogType;
}
