/**
 * UI Generation Prompt
 *
 * Generates a self-contained React component for a single app page.
 * Used in Step 3 of the pipeline: Workflow → UI Preview.
 *
 * Rules for generated code:
 *  - Single default export: function App() { ... }
 *  - No import statements — React is available as global
 *  - Tailwind CSS only (CDN available in iframe)
 *  - All mock data must be inline
 *  - Must be interactive (useState where appropriate)
 */

export const UI_GENERATION_SYSTEM_PROMPT = `You are a senior mobile UI developer. Generate a self-contained multi-component React page. The result must look like a polished, production-quality mobile app.

## Code Rules
- NO import statements. React is available as global.
- Use React.useState, React.useEffect (always prefix hooks with React.)
- Tailwind CSS classes ONLY — do NOT use style={{}} inline styles
- Exception: style={{}} is allowed ONLY for dynamic values that cannot be expressed as Tailwind classes (e.g. style={{ width: \`\${pct}%\` }} for progress bars, style={{ height: \`\${px}px\` }} for dynamic heights)
- Output ONLY the JavaScript code — no markdown fences, no explanation
- NEVER use alert(), confirm(), or prompt() — the iframe is sandboxed and these are blocked. Use React state for feedback (toast, snackbar, or inline message) instead.

## Component Architecture (CRITICAL — enforced strictly)
The code MUST use a multi-component structure. Each workflow node = one named React function component (or multiple tightly-coupled nodes share one component — see Combined rule below).

Structure:
1. Define each node's component function BEFORE function App()
2. Component name = PascalCase of componentKey (e.g. "courtMapView" → CourtMapView)
3. Place data-dg-component="componentKey" on the ROOT element of each component function ONLY
4. The App() function MUST NOT contain any data-dg-component attributes anywhere
5. App() manages all state and passes props down to components

✅ REQUIRED pattern:
\`\`\`
function CourtMapView({ courts, selected, onSelect }) {
  return (
    <div data-dg-component="courtMapView" className="h-36 bg-blue-50">  // ← on ROOT of component
      {/* map content */}
    </div>
  );
}

function ApplyCourtFilters({ filter, onChange }) {
  return (
    <div data-dg-component="applyCourtFilters" className="flex gap-2">  // ← on ROOT of component
      {/* filter content */}
    </div>
  );
}

function App() {
  const [filter, setFilter] = React.useState({});
  return (
    <div className="min-h-screen bg-slate-50">  // ← NO data-dg-component inside App
      <ApplyCourtFilters filter={filter} onChange={setFilter} />
      <CourtMapView courts={courts} />
    </div>
  );
}
\`\`\`

❌ FORBIDDEN: placing data-dg-component on any element inside function App() { ... }
❌ FORBIDDEN: putting all UI into a single App function without separate named components
❌ FORBIDDEN: leaving any workflow node without a corresponding React component
❌ FORBIDDEN: creating invisible/hidden components — NEVER use className="hidden", display:"none", opacity-0, or invisible on the root element of a named component. If a node represents initialization/loading/routing logic (e.g., a "Load Page" or "Initialize" step), implement it as a visible loading skeleton, status bar, or header section — not a hidden placeholder.
❌ FORBIDDEN: a named component rendering other named components that have data-dg-component — this makes it a page wrapper, not a focused UI section. ONLY function App() may compose named components. Each named component must render its OWN UI content directly, not delegate to sibling components.

## Combined Components (required for group nodes and their children)
A workflow group node and all its child nodes MUST be implemented as ONE React component. Rules:
- The component's nodeIds array must list the group node ID + ALL child node IDs
- The component still gets ONE data-dg-component key on its root element
- Hovering this component in Coverage highlights all grouped nodes
- ✅ Example: group "Discover Courts" + service "Fetch Courts" + task "Sort" + task "Render Pins" → CourtMap component with nodeIds: ["group-id", "svc-id", "task-id-1", "task-id-2"]
- ❌ FORBIDDEN: a component with nodeIds: [] (phantom — has no node basis)
- ❌ FORBIDDEN: omitting any nodeId that appears in the REQUIRED @dg-components provided below

## Layout Requirements
- Outer wrapper: className="min-h-screen bg-slate-50 font-sans" with max-w-sm mx-auto
- Header: white background, bottom border, padding px-5 pt-5 pb-4
- Page title: className="text-2xl font-bold text-slate-900"
- Section labels: className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-2"
- Body padding: px-4 pb-6 (use pb-24 ONLY if a FAB is present)

## Card Design (use for every list item)
- className="bg-white rounded-2xl shadow-sm p-4 mb-3"
- Card title: className="text-base font-bold text-slate-900"
- Card subtitle/meta: className="text-sm text-slate-400 mt-0.5"
- NEVER use plain <div> with just a border for list items

## Color & Badge System
- Choose ONE accent color that fits the domain (blue=productivity/sports, green=health/fitness, orange=food/travel, purple=creative/focus)
- Active/selected state: bg-{color}-500 text-white
- Inactive state: bg-slate-100 text-slate-500
- Status badges: className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
  - Success/low: bg-emerald-100 text-emerald-700
  - Warning/medium: bg-amber-100 text-amber-700
  - Danger/high: bg-red-100 text-red-700
- Tag chips: className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-600"

## Typography Hierarchy
- Hero number/stat: text-3xl font-extrabold text-slate-900
- Section title: text-lg font-bold text-slate-900
- Body text: text-sm text-slate-700
- Muted/meta: text-xs text-slate-400
- Emphasis: font-semibold text-slate-800

## Feature Grounding Rule (CRITICAL — read before writing any UI element)
Every button, FAB, form, toggle, or interactive element MUST correspond to a specific feature listed in the Features section or a specific node in the workflow.
- ❌ FORBIDDEN: decorative buttons with no onClick, FABs that do nothing, placeholder "+" buttons
- ❌ FORBIDDEN: adding UI elements just because they look nice or fit a page-type pattern
- ✅ REQUIRED: every onClick handler must call a real state update or action derived from the features
- Example: a FAB is only valid if an "add/create" feature exists AND the FAB's onClick opens a form or adds an item
- Example: filter chips are only valid if a "filter" or "view by category" feature exists

## Interactive Pattern Library (use ONLY when a feature justifies it)
- Tab bar: pill-style tabs in a bg-slate-100 rounded-xl p-1 container, active tab bg-white rounded-lg shadow-sm
- Filter chips: horizontal scrollable row of rounded-full buttons
- Favorite/bookmark toggle: heart or bookmark icon that toggles color
- FAB (Floating Action Button): fixed bottom-6 right-6 w-14 h-14 rounded-full bg-{color}-500 shadow-lg text-white text-2xl — ONLY if create/add feature exists and no inline form already serves that purpose
  - FAB MUST use a showForm toggle: onClick={() => setShowForm(p => !p)}, show "+" when closed, "×" when open
  - The form MUST appear as an inline card (bg-white rounded-2xl shadow-sm p-4) at the bottom of the scrollable content — NEVER as a fixed/absolute positioned element
  - Use pb-24 on the body container only when a FAB is present (to prevent FAB covering content)
- Bottom sheet modal: fixed inset-0 bg-black/40 flex items-end → inner div bg-white rounded-t-3xl p-6
- Progress bar: h-2 bg-slate-100 rounded-full overflow-hidden → inner div bg-{color}-500 rounded-full
- Expandable card: clicking a card reveals more detail (useState toggle)
- Toast/snackbar feedback: fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-full shadow-lg (use instead of alert() for action confirmations)

## Mock Data Rules (CRITICAL)
- MUST include at least 3-4 realistic items with SPECIFIC values:
  - Names: real-sounding names (not "Item 1", "User A", "Test data")
  - Numbers: realistic figures (ratings: 4.2-4.9, prices: $12-$85, distances: 0.3-3.5 km)
  - Statuses: use domain-appropriate states (active/completed/pending, open/closed, low/medium/high)
  - Dates/times: specific values like "Today 6:00 PM", "Apr 10", "2 days ago"
- Define mock data as a const array at the TOP LEVEL (before component functions) OR inside App
- Each item should have 4-6 fields to enable rich card rendering

## Layout Patterns by Page Type (structural hints only — do NOT add elements not backed by features)
- List/Discovery pages: search bar (if search feature exists) + filter chips (if filter feature exists) + card list + FAB (only if add feature exists and no inline form is present)
- Dashboard/Home: stat cards grid + recent activity list + progress indicators (only if stats/progress features exist)
- Detail/Profile pages: hero section + tabbed content (only if multiple content sections exist) + action buttons backed by features
- Timer/Focus pages: large centered display + play/pause/stop controls + session stats
- Form/Input pages: clean inputs with labels + primary CTA button at bottom

## Component Traceability (REQUIRED — do not skip)
After function App() { ... }, append a metadata block on a new line.
⚠️ The closing */ is MANDATORY — the parser requires it. NEVER omit it.

/* @dg-components
[
  {"componentKey": "camelCaseKey", "componentName": "Human Name", "nodeIds": ["nodeId1"]},
  {"componentKey": "combinedKey", "componentName": "Combined Name", "nodeIds": ["nodeId2", "nodeId3"]}
]
*/

Rules:
- Only include nodes that map to a DIRECTLY VISIBLE UI section in @dg-components. Orchestration/container nodes (those that just manage state or compose other components) must NOT be listed — they live in App() and will appear as "Not Implemented" in Coverage, which is CORRECT.
- Default: one component per visible node (1:1)
- Exception: tightly coupled nodes (e.g., fetch + render) may be combined — list all their IDs in nodeIds
  - ✅ Single: [{"componentKey": "applyFilters", "nodeIds": ["task-apply-filters-xxx"]}]
  - ✅ Combined: [{"componentKey": "courtList", "nodeIds": ["svc-fetch-courts-xxx", "task-render-pins-xxx"]}]
  - ❌ FORBIDDEN: [{"componentKey": "appMain", "nodeIds": []}] — phantom components are forbidden
  - ❌ FORBIDDEN: listing a node whose component only wraps other named components — remove it from @dg-components and put its logic in App()
- componentKey must be camelCase and unique within the page
- No two components may share a nodeId
- If no "Data flow from workflow nodes" section is present, use nodeIds: [] for all components

## data-dg-component ↔ @dg-components Consistency (CRITICAL)
- EVERY component function that has a componentKey MUST have data-dg-component="componentKey" on its ROOT element
  - ✅ Correct: function CourtMapView() { return <div data-dg-component="courtMapView">...</div> }
  - ❌ Forbidden: attr key exists in a component but missing from metadata (or vice versa)
- NEVER place data-dg-component inside function App() — all data-dg-component must be on component roots
- Each component function corresponds to EXACTLY ONE metadata entry

## nodeIds Strict Validation (CRITICAL — violations are caught and flagged)
- nodeIds values MUST be copied EXACTLY from the nodeId values provided in "Data flow from workflow nodes" above
  - ✅ Correct: the workflow lists "(nodeId: task-abc-123)" → use "task-abc-123"
  - ❌ Forbidden: inventing IDs like "node-1", "fetchTasks", or any string not in the workflow
  - ❌ Forbidden: using nodeIds: [] when workflow nodes ARE provided
- A component function MUST NOT exist if it has no valid nodeId backing
  - ❌ Forbidden: a HeaderCard, StatsSection, or NavBar component with no corresponding workflow node
  - ✅ Only create component functions that directly implement a workflow node's responsibility
- Each component's nodeIds must contain 1–3 exact nodeIds from the workflow
- Every workflow node listed MUST be covered by exactly one component (no omissions, no sharing)
- If ALL nodeIds in a component are invalid, the component is "phantom" — it will be flagged as having no node basis in the coverage panel

Output the complete JavaScript code including all component functions followed by function App() { ... }`;

export interface UIPageContext {
  pageName: string;
  pagePath?: string;
  goal: string;
  features: Array<{
    name: string;
    description: string;
    priority: "must" | "should" | "could";
  }>;
  /**
   * Structured node flow for this page — type, title, PRD requirement,
   * outputData shape, and functionCode summary per node.
   * When present, supersedes dataFields/endpoints as the primary context.
   */
  nodeFlow?: string;
  /** Fallback: key field names when nodeFlow is unavailable */
  dataFields: string[];
  /** Fallback: API endpoints when nodeFlow is unavailable */
  endpoints: Array<{ method: string; endpoint: string }>;
}

/**
 * Parse nodeFlow to extract per-node component structure.
 * Each node (task/service/decision/group) becomes its own component with exactly
 * one nodeId. This enforces 1:1 mapping: one UI section per workflow node.
 * Returns a pre-filled @dg-components JSON string the AI should copy verbatim.
 */
function buildComponentSuggestion(nodeFlow: string): string {
  interface CompEntry {
    componentKey: string;
    componentName: string;
    nodeIds: string[];
  }

  const lines = nodeFlow.split("\n");
  const components: CompEntry[] = [];
  const usedKeys = new Set<string>();

  for (const line of lines) {
    const match = line.match(
      /^\[(task|service|decision|group)\] (.+?) \(nodeId: ([^)]+)\)/,
    );
    if (!match) continue;

    const name = match[2];
    const id = match[3];

    // Build camelCase key from the node name
    const baseKey =
      name
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .split(" ")
        .filter(Boolean)
        .map((w, i) =>
          i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1),
        )
        .join("") || `node${components.length + 1}`;

    // Deduplicate keys by appending an index suffix
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}${suffix++}`;
    }
    usedKeys.add(key);

    components.push({ componentKey: key, componentName: name, nodeIds: [id] });
  }

  if (components.length === 0) return "";
  return JSON.stringify(components, null, 2);
}

export function getUIGenerationContent(ctx: UIPageContext): string {
  const mustFeatures = ctx.features.filter((f) => f.priority === "must");
  const shouldFeatures = ctx.features.filter((f) => f.priority === "should");
  const couldFeatures = ctx.features.filter((f) => f.priority === "could");

  const featuresText = [
    mustFeatures.length > 0
      ? `MUST implement:\n${mustFeatures.map((f) => `  - ${f.name}: ${f.description}`).join("\n")}`
      : "",
    shouldFeatures.length > 0
      ? `SHOULD implement:\n${shouldFeatures.map((f) => `  - ${f.name}: ${f.description}`).join("\n")}`
      : "",
    couldFeatures.length > 0
      ? `COULD implement:\n${couldFeatures.map((f) => `  - ${f.name}: ${f.description}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let contextSection: string;
  let componentSuggestion = "";

  if (ctx.nodeFlow) {
    contextSection = `\nData flow from workflow nodes:\n${ctx.nodeFlow}`;
    const suggestion = buildComponentSuggestion(ctx.nodeFlow);
    if (suggestion) {
      componentSuggestion = `\n\n⚠️ REQUIRED @dg-components — the nodeFlow above already contains this block. COPY IT EXACTLY as your metadata block. Do NOT change nodeIds, do NOT omit entries.`;
    }
  } else {
    contextSection = [
      "\nNOTE: No workflow node data available. Use nodeIds: [] for all @dg-components entries.",
      ctx.dataFields.length > 0
        ? `\nData fields to use in mock data: ${ctx.dataFields.join(", ")}`
        : "",
      ctx.endpoints.length > 0
        ? `\nAPI endpoints (for context only — use mock data): ${ctx.endpoints.map((e) => `${e.method} ${e.endpoint}`).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const pageTypeHint = inferPageTypeHint(ctx.pageName, ctx.features);

  return `Generate a polished, production-quality React component for the "${ctx.pageName}" page.

App goal: ${ctx.goal}

Features:
${featuresText}
${contextSection}
${componentSuggestion}

Page type hint: ${pageTypeHint}

REMINDER: Use Tailwind classes only. Use the data shapes above for mock data (do NOT invent field names). Every button/FAB/toggle must have a real onClick wired to a state action — NO decorative/non-functional elements. Cards must use bg-white rounded-2xl shadow-sm.

Return ONLY the JavaScript code — all component functions then function App() { ... } then the @dg-components metadata block.`;
}

function inferPageTypeHint(
  pageName: string,
  features: UIPageContext["features"],
): string {
  const name = pageName.toLowerCase();
  const featureNames = features.map((f) => f.name.toLowerCase()).join(" ");
  const combined = name + " " + featureNames;

  if (
    combined.includes("list") ||
    combined.includes("discover") ||
    combined.includes("search") ||
    combined.includes("browse") ||
    combined.includes("court") ||
    combined.includes("destination")
  ) {
    return "List/Discovery — search bar + filter chips + card list + FAB";
  }
  if (
    combined.includes("dashboard") ||
    combined.includes("home") ||
    combined.includes("overview") ||
    combined.includes("analytics") ||
    combined.includes("progress")
  ) {
    return "Dashboard — stat cards grid + charts/progress bars + recent activity";
  }
  if (
    combined.includes("timer") ||
    combined.includes("focus") ||
    combined.includes("pomodoro") ||
    combined.includes("session")
  ) {
    return "Timer/Focus — large centered timer display + play/pause/stop controls + session counter";
  }
  if (
    combined.includes("plan") ||
    combined.includes("itinerary") ||
    combined.includes("schedule") ||
    combined.includes("budget") ||
    combined.includes("trip")
  ) {
    return "Planning — tabbed sections (itinerary/budget/notes) + editable list items";
  }
  if (
    combined.includes("log") ||
    combined.includes("track") ||
    combined.includes("meal") ||
    combined.includes("exercise")
  ) {
    return "Logging — summary card with totals + scrollable log list + FAB that toggles inline add-entry form card (showForm state)";
  }
  if (
    combined.includes("game") ||
    combined.includes("match") ||
    combined.includes("event")
  ) {
    return "Event/Game list — tab bar (open/mine) + card list with join/leave actions + create FAB";
  }

  return "General — header + card list + at least one interactive pattern";
}
