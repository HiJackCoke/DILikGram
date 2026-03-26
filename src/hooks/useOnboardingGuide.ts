"use client";

import { useState, useCallback } from "react";

const STORAGE_KEYS = {
  workflow: "dg:onboarding-workflow",
  ui: "dg:onboarding-ui",
} as const;

const read = (key: string) =>
  typeof window !== "undefined" && localStorage.getItem(key) === "1";

/**
 * Tracks whether the user has completed each onboarding step.
 * - workflowGenerated: true after the first workflow is generated
 * - uiViewed:         true after "View UI" is clicked for the first time
 */
export function useOnboardingGuide() {
  const [workflowGenerated, setWorkflowGenerated] = useState(() =>
    read(STORAGE_KEYS.workflow),
  );
  const [uiViewed, setUiViewed] = useState(() => read(STORAGE_KEYS.ui));

  const markWorkflowGenerated = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.workflow, "1");
    setWorkflowGenerated(true);
  }, []);

  const markUIViewed = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.ui, "1");
    setUiViewed(true);
  }, []);

  return { workflowGenerated, uiViewed, markWorkflowGenerated, markUIViewed };
}
