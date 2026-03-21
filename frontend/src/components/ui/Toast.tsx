'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

let nextId = 0;

const COLORS: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: 'var(--color-ok-bg)', border: '#bbf7d0', color: 'var(--color-ok)' },
  error: { bg: 'var(--color-danger-bg)', border: '#fecaca', color: 'var(--color-danger)' },
  info: { bg: 'var(--color-accent-light)', border: 'var(--color-accent-muted)', color: 'var(--color-accent)' },
};

const ICONS: Record<ToastType, string> = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  info: 'M12 16v-4m0-4h.01',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            pointerEvents: 'none',
            width: '100%',
            maxWidth: '24rem',
            padding: '0 1rem',
          }}
        >
          {toasts.map(toast => {
            const c = COLORS[toast.type];
            return (
              <div
                key={toast.id}
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  animation: 'toast-in 0.25s ease-out',
                  pointerEvents: 'auto',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d={ICONS[toast.type]} />
                </svg>
                <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: c.color }}>
                  {toast.message}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext>
  );
}
