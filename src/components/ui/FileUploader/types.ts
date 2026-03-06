export interface FileUploaderViewProps {
  selectedFiles: File[];
  maxFiles: number;
  isDragOver: boolean;
  inputId: string;
  accept: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileRemove: (index: number) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export interface FileUploaderProps {
  onFileChange: (files: File[]) => void;
  maxFiles?: number; // default: 1
  accept?: string; // HTML input accept 형식: "application/pdf", ".pdf,.docx", "image/*" 등, default: "application/pdf"
}
