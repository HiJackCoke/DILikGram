import { NodeProps, Port } from "react-cosmos-diagram";
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Settings,
  FileText,
} from "lucide-react";
import { useState } from "react";

import type { GroupNode } from "@/types/nodes";
import { getDefaultPorts } from "@/utils/graph/nodes";
import { useExecutorEditor } from "@/contexts/ExecutorEditor";
import PRDTooltip from "./PRDTooltip";
import Tooltip from "@/components/ui/Tooltip";

export function GroupNode(nodeProps: NodeProps<GroupNode>) {
  const { data, selected } = nodeProps;
  const [collapsed, setCollapsed] = useState(data.collapsed ?? true);

  const { open } = useExecutorEditor();

  const ports = data.ports || getDefaultPorts("group");

  const groupCount = data.groups?.length || 0;

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };

  const handleOpenEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    open(nodeProps);
  };

  const hasExecutor = !!data.execution?.config?.functionCode;

  // 실행 상태 스타일
  const executionStyles = {
    executing: "ring-4 ring-palette-warning-color animate-pulse scale-105",
    executed: "ring-2 ring-palette-warning-color",
    error: "ring-4 ring-palette-danger-color border-palette-danger-bg",
    idle: "",
  };

  return (
    <div className="group-node relative">
      {/* 포트 */}
      {ports.map((port) => (
        <Port
          key={port.id}
          id={port.id}
          position={port.position}
          type={port.type}
        />
      ))}

      <div
        className={`
          
          relative min-w-[240px] max-w-[320px] min-h-[140px]
          bg-white rounded-xl shadow-lg border-2 transition-all duration-200
          ${
            selected
              ? "border-palette-warning-bg shadow-yellow-200 shadow-xl"
              : "border-gray-200 hover:shadow-xl hover:border-palette-warning-bg hover:shadow-yellow-200"
          }
          ${data.state?.highlighted ? "ring-2 ring-yellow-300" : ""}
          ${data.state?.dimmed ? "opacity-30" : ""}
          ${data.execution?.error ? executionStyles.error : executionStyles[data.execution?.state || "idle"]}
        `}
      >
        {/* 헤더 */}
        <div className="rounded-t-[10px] bg-gradient-to-r from-palette-warning-bg to-palette-warning-border px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleCollapse}
              className="text-white hover:bg-white/20 rounded p-1"
            >
              {collapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            <span className="text-white">
              {collapsed ? (
                <Folder className="w-4 h-4" />
              ) : (
                <FolderOpen className="w-4 h-4" />
              )}
            </span>
            <span className="text-white font-semibold text-sm truncate flex-1">
              {data.title}
            </span>

            {/* PRD Reference Badge */}
            <Tooltip
              content={
                data.prdReference && <PRDTooltip prdRef={data.prdReference} />
              }
            >
              <button
                className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition"
                title="PRD Reference"
              >
                <FileText className="w-3 h-3" />
              </button>
            </Tooltip>

            {/* Settings 버튼 */}
            <button
              onClick={handleOpenEditor}
              className={`p-1 rounded transition ${
                hasExecutor
                  ? "bg-green-500/80 hover:bg-green-600"
                  : "bg-white/20 hover:bg-white/30"
              }`}
              title="Configure group node"
            >
              <Settings className="w-3 h-3 text-white" />
            </button>

            <span className="text-white/80 text-xs">
              {groupCount} node{groupCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 py-3">
          {data.description && (
            <p className="text-xs text-gray-500 mb-3">{data.description}</p>
          )}

          {/* 확장 시: 내부 노드 미리보기 */}
          {!collapsed && data.groups && data.groups.length > 0 && (
            <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
              {data.groups.map((node, index) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded border border-gray-200"
                >
                  <span className="text-xs text-gray-400 font-mono">
                    {index + 1}.
                  </span>
                  <span className="text-xs text-gray-700 font-medium flex-1 truncate">
                    {node.data?.title || node.type}
                  </span>
                  <span className="text-xs text-gray-400 uppercase">
                    {node.type}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 축소 시: 요약 */}
          {collapsed && groupCount > 0 && (
            <div className="text-xs text-gray-400 italic">
              Click to expand and view {groupCount} internal node
              {groupCount !== 1 ? "s" : ""}
            </div>
          )}

          {/* 빈 상태 */}
          {groupCount === 0 && (
            <div className="text-xs text-gray-400 italic">
              No internal nodes configured
            </div>
          )}

          {/* 메타데이터 */}
          {data.metadata && Object.keys(data.metadata).length > 0 && (
            <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
              {Object.entries(data.metadata).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-gray-500">{key}</span>
                  <span className="text-gray-700 font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
