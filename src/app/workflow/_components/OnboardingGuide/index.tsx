"use client";

import TutorialCursor from "@/components/ui/TutorialCursor";
import { useWorkflowGenerator } from "@/contexts/WorkflowGenerator";

type GuideStep = "point-generate" | "point-sample" | "point-view-ui" | "done";

interface OnboardingGuideProps {
  workflowGenerated: boolean;
  uiViewed: boolean;
}

const STEP_CONFIG: Record<
  Exclude<GuideStep, "done">,
  { selector: string; label: string }
> = {
  "point-generate": {
    selector: '[data-tutorial="generate-btn"]',
    label: "Click here to generate a workflow!",
  },
  "point-sample": {
    selector: '[data-tutorial="sample-prd-first"]',
    label: "Try a sample PRD to get started",
  },
  "point-view-ui": {
    selector: '[data-tutorial="view-ui-btn"]',
    label: "Preview the generated UI!",
  },
};

/**
 * Orchestrates the step-by-step onboarding guide on the workflow page.
 *
 * Steps:
 *  1. Point at "Generate with AI" button (first visit)
 *  2. Generator modal opens → point at first Sample PRD card
 *  3. Workflow generated → point at "View UI" button
 *  4. UI viewed → guide complete, nothing shown
 */
export default function OnboardingGuide({
  workflowGenerated,
  uiViewed,
}: OnboardingGuideProps) {
  const { isOpen: isGeneratorOpen } = useWorkflowGenerator();

  let step: GuideStep = "done";
  if (!workflowGenerated) {
    step = isGeneratorOpen ? "point-sample" : "point-generate";
  } else if (!uiViewed) {
    step = "point-view-ui";
  }

  if (step === "done") return null;

  const { selector, label } = STEP_CONFIG[step];
  return <TutorialCursor targetSelector={selector} label={label} />;
}
