import { describe, expect, it } from 'vitest';
import { formatViolationSummary, selectBlockingViolations } from './a11y-helpers';

const violation = (id: string, impact: string) => ({ id, impact, help: id, helpUrl: `https://example.com/${id}`, nodes: [] });

describe('a11y violation helpers', () => {
  it('filters non-blocking impacts', () => {
    const results = { violations: [violation('minor', 'minor'), violation('moderate', 'moderate')] } as any;
    expect(selectBlockingViolations(results)).toEqual([]);
  });

  it('selects and formats serious violations', () => {
    const results = { violations: [violation('serious-rule', 'serious'), violation('critical-rule', 'critical')] } as any;
    const blocking = selectBlockingViolations(results);
    expect(blocking).toHaveLength(2);
    expect(formatViolationSummary(blocking)).toContain('serious-rule');
    expect(formatViolationSummary(blocking)).toContain('https://example.com/serious-rule');
  });
});
