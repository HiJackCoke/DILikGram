import "react-cosmos-diagram/dist/style.css";

import ReactDiagram, {
  useNodesState,
  useEdgesState,
} from "react-cosmos-diagram";

import { nodeTypes } from "@/components/Nodes";
import { edgeTypes } from "@/components/Edges";

import { initialNodes } from "@/mocks/nodes";
import { initialEdges } from "@/mocks/edges";

export default function WorkflowPage() {
  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-2xl font-bold text-white">Workflow Builder</h1>
        <p className="text-slate-400 text-sm">react-cosmos-diagram</p>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-slate-800/80 rounded-lg p-4 border border-slate-700">
        <p className="text-slate-300 text-xs font-semibold mb-2">Edge Types</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-slate-400 rounded" />
            <span className="text-slate-400 text-xs">Default</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-green-500 rounded" />
            <span className="text-slate-400 text-xs">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-red-500 rounded" />
            <span className="text-slate-400 text-xs">Error</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-yellow-500 rounded" />
            <span className="text-slate-400 text-xs">Warning</span>
          </div>
        </div>
      </div>

      {/* Diagram */}
      <ReactDiagram
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionRadius={30}
        minZoom={0.5}
        maxZoom={2}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        style={{
          background: "transparent",
        }}
      />
    </div>
  );
}
