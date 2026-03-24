/**
 * UI Generation Prompt
 *
 * Generates a self-contained React component for a single app page.
 * Used in Step 3 of the pipeline: Workflow → UI Preview.
 *
 * Rules for generated code:
 *  - Single default export: function App() { ... }
 *  - No import statements — React is available as global
 *  - Tailwind CSS only — no custom styles
 *  - All mock data must be inline
 *  - Must be interactive (useState where appropriate)
 */

export const UI_GENERATION_SYSTEM_PROMPT = `You are a React UI developer. Generate a single self-contained React component for the given app page.

Rules:
- Export a single function named App: function App() { ... }
- DO NOT write any import statements. React is available as a global variable.
- Use React.useState, React.useEffect (prefix all hooks with React.)
- Use Tailwind CSS classes only — no custom CSS, no style={{ }} unless absolutely needed for width/height values
- Embed all mock data as inline constants inside the component
- Make the UI visually complete and realistic — not a skeleton or placeholder
- Include all features listed for this page
- Mobile-first layout (max-w-sm mx-auto or full mobile viewport)
- Use emoji as icons where appropriate

Output ONLY the JavaScript code — no markdown fences, no explanation.`;

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
  const featuresText = ctx.features
    .map((f) => `  - [${f.priority}] ${f.name}: ${f.description}`)
    .join("\n");

  const dataHints =
    ctx.dataFields.length > 0
      ? `\nData fields used in this page: ${ctx.dataFields.join(", ")}`
      : "";

  const endpointHints =
    ctx.endpoints.length > 0
      ? `\nAPI endpoints: ${ctx.endpoints.map((e) => `${e.method} ${e.endpoint}`).join(", ")}`
      : "";

  return `Generate a React component for the "${ctx.pageName}" page.

App goal: ${ctx.goal}

Features to implement:
${featuresText}
${dataHints}
${endpointHints}

Return ONLY the JavaScript code for function App() { ... }`;
}
