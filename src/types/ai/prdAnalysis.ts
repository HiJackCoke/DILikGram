export interface PRDFeature {
  id: string;
  name: string;
  description: string;
  priority: "must" | "should" | "could";
}

export interface PRDPage {
  id: string;
  name: string;
  path?: string;
  features: PRDFeature[];
}

export interface PRDAnalysisResult {
  goal: string;
  pages: PRDPage[];
}

export type AnalyzePRDAction = (
  prdContent: string,
  prompt: string,
) => Promise<PRDAnalysisResult>;
