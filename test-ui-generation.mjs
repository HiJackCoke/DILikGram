/**
 * UI Generation Quality Test
 * Tests generateUIAction prompt quality against 4 sample datasets.
 *
 * Usage: node test-ui-generation.mjs
 */

import OpenAI from "openai";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.resolve(__dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

// Inline the prompt logic (mirrors uiGeneration.ts)
function inferPageTypeHint(pageName, features) {
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

function getUIGenerationContent(ctx) {
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

// Read the current system prompt from uiGeneration.ts
function readSystemPrompt() {
  const filePath = path.resolve(__dirname, "src/fixtures/prompts/uiGeneration.ts");
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(/UI_GENERATION_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/);
  if (!match) throw new Error("Could not extract UI_GENERATION_SYSTEM_PROMPT");
  return match[1];
}

function checkQuality(code, sampleName, pageName) {
  const checks = {
    hasTailwindCard: /rounded[\w-]*|shadow[\w-]*|bg-white/.test(code),
    hasSpecificMockData: (() => {
      // Check for realistic names/numbers (not "Item 1", "User A", "test")
      const hasNames = /["'][A-Z][a-z]+ [A-Z][a-z]+["']|["'][A-Z][a-z]{3,}["']/.test(code);
      const hasNumbers = /\d+\.\d|\$\d+|\d+ (km|min|cal|kg|lb|pts)/.test(code);
      const hasArrayWith3Plus = /\[[\s\S]{100,}\]/.test(code); // heuristic: long array literal
      return hasNames || hasNumbers || hasArrayWith3Plus;
    })(),
    hasUseState: /React\.useState|useState/.test(code),
    hasMobileContainer: /max-w-sm|max-w-xs/.test(code),
    inlineStyleCount: (code.match(/style=\{\{/g) || []).length,
  };

  const pass = checks.hasTailwindCard && checks.hasSpecificMockData && checks.hasUseState && checks.hasMobileContainer && checks.inlineStyleCount <= 3;

  console.log(`\n  [${sampleName}] ${pageName}`);
  console.log(`    ✓ Tailwind card classes: ${checks.hasTailwindCard ? "PASS" : "FAIL"}`);
  console.log(`    ✓ Specific mock data: ${checks.hasSpecificMockData ? "PASS" : "FAIL"}`);
  console.log(`    ✓ useState interaction: ${checks.hasUseState ? "PASS" : "FAIL"}`);
  console.log(`    ✓ Mobile container: ${checks.hasMobileContainer ? "PASS" : "FAIL"}`);
  console.log(`    ✓ Inline style count: ${checks.inlineStyleCount} (${checks.inlineStyleCount <= 3 ? "PASS" : "FAIL - must be ≤3"})`);
  console.log(`    → Overall: ${pass ? "✅ PASS" : "❌ FAIL"}`);

  return pass;
}

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = readSystemPrompt();

  const samples = ["basketball", "fitness", "focus", "travel"];
  let allPassed = true;

  for (const sample of samples) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Sample: ${sample}`);

    const sampleData = JSON.parse(
      readFileSync(path.resolve(__dirname, `src/fixtures/samples/data/${sample}.json`), "utf-8")
    );

    const { analysisResult, nodes = [] } = sampleData;

    // Build page contexts (same as buildPageContext in ai.ts)
    for (const page of analysisResult.pages) {
      const dataFieldsSet = new Set();
      const endpoints = [];

      for (const node of nodes) {
        const nodeData = node.data?.execution?.config?.nodeData;
        if (nodeData?.inputData && typeof nodeData.inputData === "object") {
          Object.keys(nodeData.inputData).forEach((k) => dataFieldsSet.add(k));
        }
        if (nodeData?.outputData && typeof nodeData.outputData === "object") {
          Object.keys(nodeData.outputData).forEach((k) => dataFieldsSet.add(k));
        }
        if (node.type === "service") {
          const http = node.data?.http;
          const endpoint = http?.endpoint;
          if (endpoint && !endpoints.some((e) => e.endpoint === endpoint)) {
            endpoints.push({ method: http?.method ?? "POST", endpoint });
          }
        }
      }

      const ctx = {
        pageName: page.name,
        pagePath: page.path,
        goal: analysisResult.goal,
        features: page.features,
        dataFields: [...dataFieldsSet].slice(0, 20),
        endpoints: endpoints.slice(0, 10),
      };

      const content = getUIGenerationContent(ctx);

      console.log(`\n  Generating: "${page.name}"...`);

      let code;
      try {
        const response = await openai.responses.create({
          model: "gpt-4o-mini",
          temperature: 0.4,
          instructions: systemPrompt,
          input: content,
        });
        code = (response.output_text ?? "")
          .replace(/^```(?:jsx?|tsx?|javascript)?\n?/m, "")
          .replace(/\n?```\s*$/m, "")
          .trim();
      } catch (err) {
        console.log(`  ❌ API ERROR: ${err.message}`);
        allPassed = false;
        continue;
      }

      const passed = checkQuality(code, sample, page.name);
      if (!passed) allPassed = false;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  if (allPassed) {
    console.log("✅ ALL CHECKS PASSED");
  } else {
    console.log("❌ SOME CHECKS FAILED — need prompt improvements");
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
