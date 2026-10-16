import type { Result } from 'axe-core';

export const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

export function selectBlockingViolations(results: Result) {
  return results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));
}

export function formatViolationSummary(violations: Result['violations']) {
  return violations
    .map((violation) => `  [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length} node(s))\n    ${violation.helpUrl}`)
    .join('\n');
}
