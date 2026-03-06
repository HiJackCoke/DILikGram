import React from "react";
import {
  CloudUpload,
  FileText,
  CheckCircle2,
  Trash2,
  Plus,
} from "lucide-react";
import Button from "../Button";

import { FileUploaderViewProps } from "./types";

const containerStyle =
  "w-full aspect-video md:aspect-[2/1] rounded-2xl transition-all duration-300 relative overflow-hidden";

const FileUploaderView: React.FC<FileUploaderViewProps> = ({
  selectedFiles,
  maxFiles,
  isDragOver,
  inputId,
  accept,
  onFileUpload,
  onFileRemove,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}) => {
  const canAddMore = selectedFiles.length < maxFiles;

  const formatSize = (bytes: number) =>
    `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  const maxFilesLabel =
    maxFiles === 1 ? "최대 1개 파일" : `최대 ${maxFiles}개 파일까지`;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {selectedFiles.length === 0 ? (
        /* 빈 상태: 기존 drag-drop UI */
        <label
          htmlFor={inputId}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
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
              파일 업로드
            </p>
            <p className="mt-1 text-xs text-palette-neutral-border font-medium">
              드래그하거나 클릭하여 파일을 선택하세요
            </p>
            <p className="mt-1 text-xs text-palette-neutral-color">
              {maxFilesLabel} 업로드 가능
            </p>
          </div>
          <input
            id={inputId}
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            className="hidden"
            onChange={onFileUpload}
          />
        </label>
      ) : (
        /* 파일 있는 상태: 리스트 UI */
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={`${containerStyle} flex flex-col border-2 bg-white shadow-md
            ${isDragOver ? "border-palette-primary-border bg-palette-primary-hover/10" : "border-palette-secondary-border/20"}
          `}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-palette-secondary-border/10 shrink-0">
            <span className="text-xs font-semibold text-slate-500 tracking-wide">
              {selectedFiles.length} / {maxFiles} 파일
            </span>
            {canAddMore && (
              <label
                htmlFor={inputId}
                className="flex items-center gap-1 text-xs font-medium text-palette-secondary-bg cursor-pointer hover:text-palette-secondary-border transition-colors"
              >
                <Plus size={13} />
                추가
              </label>
            )}
          </div>

          {/* 파일 리스트 (스크롤) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-palette-secondary-border/15 bg-slate-50 hover:bg-white transition-colors"
              >
                {/* 아이콘 */}
                <div className="relative shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-palette-secondary-hover/20 text-palette-secondary-bg rounded-lg">
                    <FileText size={16} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full">
                    <CheckCircle2
                      size={13}
                      fill="currentColor"
                      className="text-white fill-palette-success-bg"
                    />
                  </div>
                </div>

                {/* 파일 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-palette-neutral-border mt-0.5">
                    {formatSize(file.size)}
                  </p>
                </div>

                {/* 삭제 버튼 */}
                <Button
                  palette="danger"
                  icon={<Trash2 />}
                  onClick={() => onFileRemove(index)}
                />
              </div>
            ))}
          </div>

          {/* 하단 장식 */}
          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-palette-secondary-bg/10 shrink-0" />
        </div>
      )}

      {/* 숨겨진 input (파일 있는 상태에서 추가용) */}
      {selectedFiles.length > 0 && (
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          className="hidden"
          onChange={onFileUpload}
        />
      )}
    </div>
  );
};

export default FileUploaderView;
