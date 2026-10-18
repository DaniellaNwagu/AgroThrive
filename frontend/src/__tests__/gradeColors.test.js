import { describe, test, expect } from 'vitest';
import { GRADE_COLORS } from '../utils/gradeColors';

// Standard WCAG 2.x relative-luminance + contrast-ratio formula.
// https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

function srgbChannelToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rl, gl, bl] = [r, g, b].map(srgbChannelToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('GRADE_COLORS — WCAG AA contrast', () => {
  test.each(Object.entries(GRADE_COLORS))(
    'grade %s (%o) reaches at least 4.5:1 for normal text',
    (grade, { background, color }) => {
      const ratio = contrastRatio(background, color);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    },
  );
});
