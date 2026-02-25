import React, { useState, ChangeEvent } from "react";
import PDFUploaderView from "./View";
import { PDFUploaderProps } from "./types";

const PDFUploader: React.FC<PDFUploaderProps> = ({ onFileSelect }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 파일 선택 핸들러 (단일 파일 업데이트 보장)
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        onFileSelect(file);
      } else {
        alert("PDF 파일만 업로드 가능합니다.");
        e.target.value = ""; // input 초기화
      }
    }
  };

  // 파일 제거/교체 핸들러
  const handleRemoveFile = () => {
    setSelectedFile(null);
    onFileSelect(null);
  };

  // View에 필요한 Props 바인딩
  const viewProps = {
    selectedFile,
    onFileChange: handleFileChange,
    onRemoveFile: handleRemoveFile,
  };

  return <PDFUploaderView {...viewProps} />;
};

export default PDFUploader;
