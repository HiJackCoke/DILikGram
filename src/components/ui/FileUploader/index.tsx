import React, { useState, useId, ChangeEvent } from "react";
import FileUploaderView from "./View";
import { FileUploaderProps } from "./types";

const isValidFile = (file: File, accept: string): boolean => {
  const tokens = accept.split(",").map((t) => t.trim());
  return tokens.some((token) => {
    if (token.startsWith(".")) {
      return file.name.toLowerCase().endsWith(token.toLowerCase());
    }
    if (token.endsWith("/*")) {
      return file.type.startsWith(token.slice(0, -1));
    }
    return file.type === token;
  });
};

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileChange,
  maxFiles = 1,
  accept = "application/pdf",
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputId = useId();

  const canAddMore = selectedFiles.length < maxFiles;

  const handleFileUpload = (files: File[]) => {
    const newSelectedFiles = [...selectedFiles, ...files].slice(0, maxFiles);

    setSelectedFiles(newSelectedFiles);
    onFileChange(newSelectedFiles);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const validFiles = files.filter((f) => isValidFile(f, accept));

    if (validFiles.length !== files.length) {
      alert("허용되지 않는 파일 형식입니다.");
    }

    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }

    handleFileUpload(validFiles);

    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    const newSelectedFiles = selectedFiles.filter((_, i) => i !== index);

    setSelectedFiles(newSelectedFiles);
    onFileChange(newSelectedFiles);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canAddMore) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canAddMore) setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!canAddMore) return;

    const files = Array.from(e.dataTransfer.files ?? []);
    const validFiles = files.filter((f) => isValidFile(f, accept));
    if (validFiles.length !== files.length) alert("허용되지 않는 파일 형식입니다.");
    if (validFiles.length === 0) return;

    handleFileUpload(validFiles);
  };

  return (
    <FileUploaderView
      selectedFiles={selectedFiles}
      maxFiles={maxFiles}
      isDragOver={isDragOver}
      inputId={inputId}
      accept={accept}
      onFileUpload={handleFileChange}
      onFileRemove={handleRemoveFile}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    />
  );
};

export default FileUploader;
