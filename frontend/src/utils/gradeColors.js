/**
 * Shared background/foreground color pairs for the product grade badge
 * (Marketplace, and anywhere else a grade needs to render — AuctionCard,
 * ProductDetail, etc. — without copy-pasting the literals).
 *
 * Grade C's pair was changed from #a85d00 (on #ffe0b2) to #7a3d00 because
 * the old pair only reached 3.91:1 and failed WCAG AA (4.5:1 minimum for
 * normal text). That guarantee is enforced by
 * src/__tests__/gradeColors.test.js, not just this comment — any future
 * palette tweak that drops a pair below 4.5:1 fails the build.
 */
export const GRADE_COLORS = {
  A: { background: '#d8f3dc', color: '#2d6a4f' },
  B: { background: '#fff3cd', color: '#856404' },
  C: { background: '#ffe0b2', color: '#7a3d00' },
  Ungraded: { background: '#e0e0e0', color: '#555' },
};
