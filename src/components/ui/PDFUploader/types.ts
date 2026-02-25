export interface PDFUploaderViewProps {
  selectedFile: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
}

export interface PDFUploaderProps {
  onFileSelect: (file: File | null) => void;
}
