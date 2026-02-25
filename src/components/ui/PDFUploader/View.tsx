import React, { useState } from "react";
import { CloudUpload, FileText, CheckCircle2, Trash2 } from "lucide-react";
import Button from "../Button";

import { PDFUploaderViewProps } from "./types";

const PDFUploaderView: React.FC<PDFUploaderViewProps> = ({
  selectedFile,
  onFileChange,
  onRemoveFile,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndProcess = (file: File) => {
    if (file.type !== "application/pdf") {
      alert("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    const mockEvent = {
      target: { files: [file] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    onFileChange(mockEvent);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) validateAndProcess(e.dataTransfer.files[0]);
  };

  // 공통 레이아웃 스타일
  const containerStyle =
    "w-full aspect-video md:aspect-[2/1] rounded-2xl transition-all duration-300 relative overflow-hidden";

  return (
    <div className="w-full max-w-2xl mx-auto">
      {!selectedFile ? (
        /* 1. 업로드 전 UI */
        <label
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`${containerStyle} flex flex-col items-center justify-center border-2 border-dashed cursor-pointer
            ${
              isDragOver
                ? "border-palette-primary-border bg-palette-primary-hover/10 scale-[1.01]"
                : "border-palette-neutral-color bg-slate-50 hover:bg-white hover:border-palette-neutral-border shadow-sm"
            }
          `}
        >
          <div className="flex flex-col items-center p-6">
            <div
              className={`p-4 rounded-full mb-4 transition-all shadow-sm 
              ${isDragOver ? "bg-palette-primary-bg text-white" : "bg-white text-palette-neutral-border"}`}
            >
              <CloudUpload size={36} strokeWidth={1.5} />
            </div>
            <p className="text-sm md:text-base font-bold text-slate-700">
              PRD PDF 업로드
            </p>
            <p className="mt-1 text-xs text-palette-neutral-border font-medium">
              드래그하거나 클릭하여 파일을 선택하세요
            </p>
          </div>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) =>
              e.target.files?.[0] && validateAndProcess(e.target.files[0])
            }
          />
        </label>
      ) : (
        /* 2. 업로드 후 UI (높이 차이를 최소화한 카드형) */
        <div
          className={`${containerStyle} flex flex-col items-center justify-center border-2 border-palette-secondary-border/20 bg-white shadow-md animate-in fade-in zoom-in duration-300`}
        >
          {/* 상단 삭제 버튼 */}
          <Button
            className="absolute top-4 right-4 p-2"
            palette="danger"
            icon={<Trash2 />}
            onClick={onRemoveFile}
          />

          <div className="flex flex-col items-center text-center px-8">
            {/* 문서 아이콘 및 상태 체크 표시 */}
            <div className="relative mb-4">
              <div className="flex items-center justify-center w-20 h-20 bg-palette-secondary-hover/20 text-palette-secondary-bg rounded-2xl">
                <FileText size={40} />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white rounded-full text-palette-success-border">
                <CheckCircle2
                  size={28}
                  fill="currentColor"
                  className="text-white fill-palette-success-bg"
                />
              </div>
            </div>

            {/* 파일 정보 */}
            <h4 className="text-base md:text-lg font-bold text-slate-800 line-clamp-1 max-w-xs md:max-w-md">
              {selectedFile.name}
            </h4>
            <div className="flex items-center gap-3 mt-2 font-medium">
              <span className="text-[11px] px-3 py-1 rounded-full bg-palette-secondary-bg text-white tracking-tight">
                분석 준비 완료
              </span>
              <p className="text-xs text-palette-neutral-border">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>

          {/* 하단 장식 요소 (선택 사항 - 더 자연스러운 부피감을 위해) */}
          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-palette-secondary-bg/10" />
        </div>
      )}
    </div>
  );
};

export default PDFUploaderView;
