import type { UIComponent } from "@/types/ai/uiGeneration";
import type { WorkflowNode } from "@/types/nodes";

interface CoveragePanelProps {
  components: UIComponent[];
  workflowNodes: WorkflowNode[];
  pageName: string;
  pageIndex: number;
  selectedComponentKey: string | null;
  onHoverComponent: (key: string | null, isPhantom?: boolean) => void;
  onSelectComponent: (key: string | null, isPhantom?: boolean) => void;
}

export default function CoveragePanel({
  components,
  workflowNodes,
  pageName,
  pageIndex,
  selectedComponentKey,
  onHoverComponent,
  onSelectComponent,
}: CoveragePanelProps) {
  // Split components into combined (nodeIds > 1), single (nodeIds === 1), phantom (nodeIds === 0)
  const combinedComponents = components.filter((c) => c.nodeIds.length > 1);
  const singleComponents = components.filter((c) => c.nodeIds.length === 1);
  const phantomComponents = components.filter((c) => c.nodeIds.length === 0);

  // All node IDs that are accounted for (in any non-phantom component)
  const implementedNodeIds = new Set(
    components
      .filter((c) => c.nodeIds.length > 0)
      .flatMap((c) => c.nodeIds),
  );

  // Node IDs that are in combined components
  const combinedNodeIds = new Set(combinedComponents.flatMap((c) => c.nodeIds));

  // Node ID → componentKey lookup (for single-node components)
  const nodeIdToComponentKey = new Map<string, string>();
  for (const comp of singleComponents) {
    nodeIdToComponentKey.set(comp.nodeIds[0], comp.componentKey);
  }

  // Page nodes: all non-start/end nodes belonging to this page
  const pageAliases = new Set([
    pageName,
    pageName.toLowerCase(),
    `p${pageIndex + 1}`,
  ]);

  const idPrefix = `p${pageIndex + 1}-`;

  let pageNodes = workflowNodes.filter((n) => {
    const section = n.data.prdReference?.section;
    return section !== undefined && pageAliases.has(section);
  });

  // Fallback: match by node ID prefix when section doesn't match
  if (pageNodes.length === 0) {
    pageNodes = workflowNodes.filter((n) => n.id.startsWith(idPrefix));
  }

  // Fallback: trace all descendants of the start node with siblingIndex === pageIndex.
  if (pageNodes.length === 0) {
    const startNode = workflowNodes.find(
      (n) =>
        n.type === "start" &&
        (n as unknown as { siblingIndex?: number }).siblingIndex === pageIndex,
    );
    if (startNode) {
      const descendantIds = new Set<string>();
      const queue = [startNode.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (descendantIds.has(id)) continue;
        descendantIds.add(id);
        for (const n of workflowNodes) {
          if (n.parentNode === id && !descendantIds.has(n.id)) {
            queue.push(n.id);
          }
        }
      }
      pageNodes = workflowNodes.filter((n) => descendantIds.has(n.id));
    }
  }

  // Final fallback: show nodes that were actually used in the generated UI
  if (pageNodes.length === 0 && implementedNodeIds.size > 0) {
    pageNodes = workflowNodes.filter((n) => implementedNodeIds.has(n.id));
  }

  pageNodes = pageNodes.filter((n) => n.type !== "start" && n.type !== "end");

  // Nodes that belong to single-node components (shown in Implemented section)
  const implementedSingleNodes = pageNodes.filter(
    (n) => implementedNodeIds.has(n.id) && !combinedNodeIds.has(n.id),
  );
  // Nodes not in any component (shown in Not Implemented section)
  const unimplementedNodes = pageNodes.filter(
    (n) => !implementedNodeIds.has(n.id),
  );

  const totalCovered = implementedSingleNodes.length + combinedNodeIds.size;

  return (
    <div className="w-[300px] shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-slate-800 shrink-0 flex items-center gap-2">
        <span className="text-xs font-bold text-slate-200">Node Coverage</span>
        <span className="text-[10px] text-slate-500 ml-1">
          {totalCovered}/{pageNodes.length}
        </span>
        {phantomComponents.length > 0 && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-palette-danger-active/40 text-palette-danger-color">
            {phantomComponents.length} phantom
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-3 py-3 space-y-1.5">
        {/* Combined components — multiple nodes mapped to one React component */}
        {combinedComponents.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-violet-400 tracking-widest uppercase px-1 mb-1.5">
              Combined ({combinedComponents.length})
            </div>
            {combinedComponents.map((comp) => {
              const compNodes = pageNodes.filter((n) =>
                comp.nodeIds.includes(n.id),
              );
              const allNodeIds = comp.nodeIds;
              const isSelected = selectedComponentKey === comp.componentKey;
              return (
                <div
                  key={comp.componentKey}
                  className={`rounded-xl border cursor-pointer transition-colors overflow-hidden ${
                    isSelected
                      ? "border-violet-400 bg-violet-900/40 ring-1 ring-violet-400/40"
                      : "border-violet-700/60 bg-violet-950/30 hover:border-violet-500"
                  }`}
                  onMouseEnter={() => onHoverComponent(comp.componentKey)}
                  onMouseLeave={() => onHoverComponent(null)}
                  onClick={() =>
                    onSelectComponent(
                      isSelected ? null : comp.componentKey,
                    )
                  }
                >
                  {/* Component header */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-800/40">
                    <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">
                      COMBINED
                    </span>
                    <span className="text-[11px] font-semibold text-violet-200 truncate">
                      {comp.componentName}
                    </span>
                    <span className="ml-auto text-[10px] text-violet-500 shrink-0">
                      {allNodeIds.length} nodes
                    </span>
                    {isSelected && (
                      <span className="text-[9px] font-bold text-violet-300 bg-violet-700/60 px-1.5 py-0.5 rounded-full">
                        selected
                      </span>
                    )}
                  </div>
                  {/* Node list within this combined component */}
                  <div className="divide-y divide-violet-900/40">
                    {compNodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center gap-2 px-3 py-1.5"
                      >
                        <span className="text-[9px] text-violet-400 uppercase font-bold w-10 shrink-0">
                          {node.type}
                        </span>
                        <span className="text-[10px] text-violet-300 truncate">
                          {node.data.title}
                        </span>
                      </div>
                    ))}
                    {allNodeIds
                      .filter((id) => !compNodes.some((n) => n.id === id))
                      .map((id) => (
                        <div
                          key={id}
                          className="flex items-center gap-2 px-3 py-1.5"
                        >
                          <span className="text-[9px] text-violet-600 uppercase font-bold w-10 shrink-0">
                            ???
                          </span>
                          <span className="text-[10px] text-violet-600 truncate font-mono">
                            {id}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Implemented nodes (single-node components) — hoverable + selectable */}
        {implementedSingleNodes.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase px-1 mb-1.5">
              Implemented ({implementedSingleNodes.length})
            </div>
            {implementedSingleNodes.map((node) => {
              const compKey = nodeIdToComponentKey.get(node.id);
              const isSelected = compKey !== undefined && selectedComponentKey === compKey;
              return (
                <div
                  key={node.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-indigo-400 bg-indigo-900/30 ring-1 ring-indigo-400/30"
                      : "border-slate-700 bg-slate-900 hover:border-indigo-500 hover:bg-slate-800"
                  }`}
                  onMouseEnter={() =>
                    compKey ? onHoverComponent(compKey) : undefined
                  }
                  onMouseLeave={() => onHoverComponent(null)}
                  onClick={() =>
                    compKey
                      ? onSelectComponent(isSelected ? null : compKey)
                      : undefined
                  }
                >
                  <span className="text-[10px] text-indigo-400 uppercase font-bold w-12 shrink-0">
                    {node.type}
                  </span>
                  <span className={`text-[11px] truncate ${isSelected ? "text-indigo-200" : "text-slate-300"}`}>
                    {node.data.title}
                  </span>
                  {isSelected && (
                    <span className="ml-auto text-[9px] font-bold text-indigo-300 bg-indigo-700/50 px-1.5 py-0.5 rounded-full shrink-0">
                      selected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Not implemented nodes */}
        {unimplementedNodes.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[10px] font-bold text-amber-500 tracking-widest uppercase px-1 mb-1.5">
              Not Implemented ({unimplementedNodes.length})
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

        {/* Phantom components: UI sections with no node basis */}
        {phantomComponents.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[10px] font-bold text-palette-danger-border tracking-widest uppercase px-1 mb-1.5">
              Phantom UI (no node basis)
            </div>
            {phantomComponents.map((comp) => {
              const isSelected = selectedComponentKey === comp.componentKey;
              return (
                <div
                  key={comp.componentKey}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-palette-danger-border bg-palette-danger-active/25 ring-1 ring-palette-danger-border/40"
                      : "border-palette-danger-active/50 bg-palette-danger-active/15 hover:border-palette-danger-border"
                  }`}
                  onMouseEnter={() => onHoverComponent(comp.componentKey, true)}
                  onMouseLeave={() => onHoverComponent(null)}
                  onClick={() =>
                    onSelectComponent(
                      isSelected ? null : comp.componentKey,
                      true,
                    )
                  }
                >
                  <span className="text-[11px] text-palette-danger-color truncate">
                    {comp.componentName}
                  </span>
                  {isSelected && (
                    <span className="ml-auto text-[9px] font-bold text-palette-danger-color bg-palette-danger-active/40 px-1.5 py-0.5 rounded-full shrink-0">
                      selected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {pageNodes.length === 0 && components.length === 0 && (
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
