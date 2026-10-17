import React, { useState, useEffect } from 'react';

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    function onChange(e) { setPrefersReducedMotion(e.matches); }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Centered loading spinner for use in page sections
 * Shows a spinning animation with optional message, unless the user prefers reduced motion
 */
export default function Spinner({ message = 'Loading...', size = 40 }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div role="status" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      gap: 16,
    }}>
      <div style={{
        width: size,
        height: size,
        border: `4px solid #f3f3f3`,
        borderTop: `4px solid #2d6a4f`,
        borderRadius: '50%',
        animation: prefersReducedMotion ? 'none' : 'spin 1s linear infinite',
      }} />
      <div style={{
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
      }}>
        {message}
      </div>
      {!prefersReducedMotion && (
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </div>
  );
}
