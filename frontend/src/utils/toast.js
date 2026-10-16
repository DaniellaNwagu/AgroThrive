/**
 * Simple toast notification system using DOM manipulation
 * Shows a temporary message at the bottom of the screen
 */

const TOAST_CONTAINER_ID = 'toast-notifications';
const TOAST_DURATION_MS = 5000;

function ensureStyles() {
  if (document.getElementById('toast-animations')) return;
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = '@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}';
  document.head.appendChild(style);
}

function getOrCreateContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = TOAST_DURATION_MS) {
  ensureStyles();
  const container = getOrCreateContainer();
  const toastEl = document.createElement('div');

  const bgColor = type === 'error'
    ? '#c0392b'
    : type === 'success'
      ? '#2d6a4f'
      : type === 'warning'
        ? '#f5a623'
        : '#333';
  const textColor = '#fff';

  toastEl.style.cssText = `
    background: ${bgColor};
    color: ${textColor};
    padding: 12px 18px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    max-width: 360px;
    word-wrap: break-word;
    pointer-events: auto;
    animation: slideIn 0.3s ease-out;
  `;

  const messageEl = document.createElement('span');
  messageEl.textContent = message;
  toastEl.appendChild(messageEl);
  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.setAttribute('aria-label', 'Dismiss notification');
  dismissButton.textContent = '×';
  toastEl.appendChild(dismissButton);
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');

  container.appendChild(toastEl);

  // Auto-remove after duration
  let closed = false;
  let exitTimeoutId;
  const cleanup = () => {
    toastEl.remove();
    if (container.children.length === 0) container.remove();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timeoutId);
    clearTimeout(exitTimeoutId);
    cleanup();
  };
  const timeoutId = setTimeout(() => {
    toastEl.style.animation = 'slideOut 0.3s ease-out';
    exitTimeoutId = setTimeout(close, 300);
  }, duration);
  dismissButton.addEventListener('click', close);

  // Return function to manually close
  return close;
}
