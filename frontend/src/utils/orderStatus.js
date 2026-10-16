export const ALL_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'disputed', 'cancelled', 'refunded', 'failed'];
export const TIMELINE_STEPS = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
export const STATUS_STYLE = {
  paid: { bg: '#d8f3dc', color: '#2d6a4f' }, pending: { bg: '#fff3cd', color: '#856404' },
  processing: { bg: '#cce5ff', color: '#004085' }, shipped: { bg: '#d1ecf1', color: '#0c5460' },
  delivered: { bg: '#d4edda', color: '#155724' }, failed: { bg: '#fee', color: '#c0392b' },
  disputed: { bg: '#ffe4cc', color: '#a04000' }, cancelled: { bg: '#f0f0f0', color: '#555' },
  refunded: { bg: '#e8d5f5', color: '#6a0dad' },
};
export const STATUS_ICON = { pending: '⏳', paid: '✅', processing: '⚙️', shipped: '🚚', delivered: '📦', failed: '❌', disputed: '⚠️', cancelled: '🚫', refunded: '↩️' };

export function getTimeline(status) {
  const currentIndex = TIMELINE_STEPS.indexOf(status);
  return TIMELINE_STEPS.map((step, index) => ({ step, current: index === currentIndex, completed: currentIndex >= 0 && index <= currentIndex }));
}
