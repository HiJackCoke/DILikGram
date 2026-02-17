/**
 * PRD Context Builder
 *
 * Builds context string from PRD text for OpenAI prompt
 */

/**
 * Build PRD context for AI workflow generation
 *
 * @param prdText - Raw PRD text input from user
 * @returns Formatted context string for OpenAI prompt
 */
export function buildPRDContext(prdText: string): string {
  return `
═══════════════════════════════════════════════════════════════
PRD REQUIREMENTS
═══════════════════════════════════════════════════════════════

${prdText.trim()}

═══════════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════════

When generating nodes based on the above PRD:

1. Reference specific PRD sections when creating nodes
2. Include section names in the prdReference field
3. Clearly justify each node with requirement rationale
4. Extract exact requirement text from PRD
5. Ensure every node has a clear link to PRD requirements
`;
}
