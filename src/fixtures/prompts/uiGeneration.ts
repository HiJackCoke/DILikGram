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

export const UI_GENERATION_SYSTEM_PROMPT = `You are a senior mobile UI developer. Generate a single self-contained React component for the given app page. The result must look like a polished, production-quality mobile app.

## Code Rules
- Single function named App: function App() { ... }
- NO import statements. React is available as global.
- Use React.useState, React.useEffect (always prefix hooks with React.)
- Tailwind CSS classes ONLY — do NOT use style={{}} inline styles
- Exception: style={{}} is allowed ONLY for dynamic values that cannot be expressed as Tailwind classes (e.g. style={{ width: \`\${pct}%\` }} for progress bars, style={{ height: \`\${px}px\` }} for dynamic heights)
- Output ONLY the JavaScript code — no markdown fences, no explanation
- NEVER use alert(), confirm(), or prompt() — the iframe is sandboxed and these are blocked. Use React state for feedback (toast, snackbar, or inline message) instead.

## Layout Requirements
- Outer wrapper: className="min-h-screen bg-slate-50 font-sans" with max-w-sm mx-auto
- Header: white background, bottom border, padding px-5 pt-5 pb-4
- Page title: className="text-2xl font-bold text-slate-900"
- Section labels: className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-2"
- Body padding: px-4 pb-24 (leave room for FAB)

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

## Required Interactive Patterns (implement AT LEAST 2)
- Tab bar: pill-style tabs in a bg-slate-100 rounded-xl p-1 container, active tab bg-white rounded-lg shadow-sm
- Filter chips: horizontal scrollable row of rounded-full buttons
- Favorite/bookmark toggle: heart or bookmark icon that toggles color
- FAB (Floating Action Button): fixed bottom-6 right-6 w-14 h-14 rounded-full bg-{color}-500 shadow-lg text-white text-2xl
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
- Define mock data as a const array INSIDE the component
- Each item should have 4-6 fields to enable rich card rendering

## Patterns by Page Type
- List/Discovery pages: search bar + filter chips + card list + FAB to create
- Dashboard/Home: stat cards grid + recent activity list + progress indicators
- Detail/Profile pages: hero section + tabbed content + action buttons
- Timer/Focus pages: large centered display + control buttons + session stats
- Form/Input pages: clean inputs with labels + primary CTA button at bottom

Output ONLY the JavaScript code for function App() { ... }`;

export interface UIPageContext {
  pageName: string;
  pagePath?: string;
  goal: string;
  features: Array<{
    name: string;
    description: string;
    priority: "must" | "should" | "could";
  }>;
  /** Key field names from node inputData/outputData — hints for mock data structure */
  dataFields: string[];
  /** API endpoints from ServiceNodes — hints for data shape */
  endpoints: Array<{ method: string; endpoint: string }>;
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

  const dataHints =
    ctx.dataFields.length > 0
      ? `\nData fields to use in mock data: ${ctx.dataFields.join(", ")}`
      : "";

  const endpointHints =
    ctx.endpoints.length > 0
      ? `\nAPI endpoints (for context only — use mock data): ${ctx.endpoints.map((e) => `${e.method} ${e.endpoint}`).join(", ")}`
      : "";

  const pageTypeHint = inferPageTypeHint(ctx.pageName, ctx.features);

  return `Generate a polished, production-quality React component for the "${ctx.pageName}" page.

App goal: ${ctx.goal}

Features:
${featuresText}
${dataHints}
${endpointHints}

Page type hint: ${pageTypeHint}

REMINDER: Use Tailwind classes only. At least 3 realistic mock data items. At least 2 interactive patterns (tabs, filters, favorites, FAB, modal, etc.). Cards must use bg-white rounded-2xl shadow-sm.

Return ONLY the JavaScript code for function App() { ... }`;
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
    return "Logging — summary card with totals + scrollable log list + FAB to add entry";
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
