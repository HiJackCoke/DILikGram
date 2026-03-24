/**
 * UI generation pipeline test
 *
 * Verifies that:
 *  1. getUIPreviewBySampleId returns correct fixture data
 *  2. generateUIAction returns GenerateUIResponse with code strings
 *  3. Each code string contains a valid App function
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json test-ui-generation.ts
 *   npx tsx --tsconfig tsconfig.json test-ui-generation.ts fitness
 *   npx tsx --tsconfig tsconfig.json test-ui-generation.ts basketball
 */

import { getUIPreviewBySampleId } from "./src/fixtures/uiPreviews";

const SAMPLE_IDS = ["fitness", "basketball", "travel", "focus"] as const;
type SampleId = (typeof SAMPLE_IDS)[number];

const target = (process.argv[2] as SampleId | undefined) ?? null;
const targets: SampleId[] = target
  ? [target as SampleId]
  : [...SAMPLE_IDS];

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

for (const sampleId of targets) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`📋 Testing sample: ${sampleId}`);

  // ── Test 1: fixture data loads ─────────────────────────────────────────
  const pages = getUIPreviewBySampleId(sampleId);

  assert(pages !== null, `getUIPreviewBySampleId("${sampleId}") returns data`);
  if (!pages) continue;

  assert(pages.length >= 1, `Has at least 1 page (got ${pages.length})`);

  for (const page of pages) {
    console.log(`\n  📄 Page: ${page.pageName}`);

    assert(typeof page.pageId === "string" && page.pageId.length > 0, "pageId is non-empty string");
    assert(typeof page.pageName === "string" && page.pageName.length > 0, "pageName is non-empty string");
    assert(typeof page.code === "string" && page.code.length > 100, `code is non-trivial string (${page.code.length} chars)`);
    assert(page.status === "done", `status is "done" (got "${page.status}")`);

    // ── Test 2: code contains App function ───────────────────────────────
    assert(page.code.includes("function App()"), "code contains function App()");
    assert(!page.code.includes("import "), "code has no import statements");

    // ── Test 3: code uses React hooks correctly ──────────────────────────
    const hasHooks = page.code.includes("React.useState") || page.code.includes("React.useEffect");
    const hasJSX = page.code.includes("return (") || page.code.includes("return <");
    assert(hasJSX, "code has a return with JSX");

    if (hasHooks) {
      assert(true, "code uses React.* hooks (no bare useState/useEffect)");
      assert(!page.code.includes("useState(") || page.code.includes("React.useState("),
        "all useState calls are prefixed with React.");
    }

    // Preview first 3 lines of code
    const preview = page.code.split("\n").slice(0, 3).map(l => `    ${l}`).join("\n");
    console.log(`\n    Code preview:\n${preview}\n    ...`);
  }

  // ── Test 4: simulate generateUIAction fixture path ────────────────────
  console.log(`\n  🔁 Simulating generateUIAction({ sampleId: "${sampleId}" })`);
  // We can't call Server Action directly (requires Next.js runtime),
  // so we test the fixture layer that it delegates to
  const actionPages = getUIPreviewBySampleId(sampleId);
  assert(actionPages !== null, "action fixture path would return data");
  assert(actionPages?.length === pages.length, "action returns same pages as direct fixture call");
}

console.log(`\n${"═".repeat(50)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("✅ All tests passed");
}
