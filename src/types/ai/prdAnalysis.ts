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

export interface AnalyzePRDResult {
  goal: string;
  pages: PRDPage[];
}

export type AnalyzePRDParams = {
  pdfFiles?: File[];
  prompt?: string;
};
export type AnalyzePRD = (
  params: AnalyzePRDParams,
) => Promise<AnalyzePRDResult>;
