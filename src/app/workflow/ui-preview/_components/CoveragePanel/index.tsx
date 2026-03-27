import type { UIComponent } from "@/types/ai/uiGeneration";
import type { WorkflowNode } from "@/types/nodes";

interface CoveragePanelProps {
  components: UIComponent[];
  workflowNodes: WorkflowNode[];
  pageName: string;
  onHoverComponent: (key: string | null, isPhantom?: boolean) => void;
}

export default function CoveragePanel({
  components,
  workflowNodes,
  pageName,
  onHoverComponent,
}: CoveragePanelProps) {
  const implementedNodeIds = new Set(components.flatMap((c) => c.nodeIds));

  // Phantom: rendered in UI but no workflow node basis
  const phantomComponents = components.filter((c) => c.nodeIds.length === 0);
  // Valid: backed by at least one workflow node
  const validComponents = components.filter((c) => c.nodeIds.length > 0);

  const pageNodes = workflowNodes
    .filter((n) => {
      const section = n.data.prdReference?.section;
      return section === pageName || section === pageName.toLowerCase();
    })
    .filter((n) => n.type !== "start" && n.type !== "end");

  const unimplementedNodes = pageNodes.filter(
    (n) => !implementedNodeIds.has(n.id),
  );

  return (
    <div className="w-[280px] shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-slate-800 shrink-0 flex items-center gap-2">
        <span className="text-xs font-bold text-slate-200">Node Coverage</span>
        {phantomComponents.length > 0 && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-palette-danger-active/40 text-palette-danger-color">
            {phantomComponents.length} phantom
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
        {/* Valid components with node backing */}
        {validComponents.map((comp) => (
          <div
            key={comp.componentKey}
            className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors"
            onMouseEnter={() => onHoverComponent(comp.componentKey)}
            onMouseLeave={() => onHoverComponent(null)}
          >
            <div className="px-3 py-2 bg-slate-800 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {comp.componentName}
              </span>
              <span className="ml-auto text-[10px] text-slate-500 shrink-0">
                {comp.nodeIds.length} node{comp.nodeIds.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-3 py-2 space-y-1">
              {comp.nodeIds.map((nid) => {
                const node = workflowNodes.find((n) => n.id === nid);
                return (
                  <div key={nid} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-600 uppercase font-bold w-12 shrink-0">
                      {node?.type ?? "?"}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate">
                      {node?.data.title ?? nid}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Phantom components: no valid node IDs at all */}
        {phantomComponents.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-bold text-palette-danger-border tracking-widest uppercase px-1">
              Phantom (no node basis)
            </div>
            {phantomComponents.map((comp) => (
              <div
                key={comp.componentKey}
                className="rounded-lg border border-palette-danger-active/50 bg-palette-danger-active/15 overflow-hidden cursor-pointer hover:border-palette-danger-border transition-colors"
                onMouseEnter={() => onHoverComponent(comp.componentKey, true)}
                onMouseLeave={() => onHoverComponent(null)}
              >
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-palette-danger-color truncate">
                    {comp.componentName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Not implemented: real nodes with no UI component */}
        {unimplementedNodes.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-bold text-amber-500 tracking-widest uppercase px-1">
              Not Implemented
            </div>
            {unimplementedNodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-900/60 bg-amber-950/30"
              >
                <span className="text-[10px] text-amber-600 uppercase font-bold w-12 shrink-0">
                  {node.type}
                </span>
                <span className="text-[11px] text-amber-400 truncate">
                  {node.data.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {components.length === 0 && unimplementedNodes.length === 0 && (
          <div className="text-slate-700 text-xs text-center mt-8">
            No coverage data.
            <br />
            <span className="text-slate-800 text-[11px]">
              Regenerate UI to see node mapping.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
