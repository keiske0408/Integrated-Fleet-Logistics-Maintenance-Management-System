import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** If true the toast will start animating out */
  dismissing?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  dismiss: (id: string) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// Auto-dismiss durations (ms). Error = 0 means never auto-dismiss.
const AUTO_DISMISS: Record<ToastType, number> = {
  success: 3000,
  warning: 5000,
  error: 0, // manual dismiss only
};

// How long the exit animation plays before the item is removed from state (ms)
const EXIT_ANIMATION_DURATION = 320;

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Store timer refs so we can clear them on manual dismiss
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const beginDismiss = useCallback((id: string) => {
    // Clear any scheduled auto-dismiss timer
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }

    // Mark the item as dismissing (triggers CSS exit animation)
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, dismissing: true } : toast)),
    );

    // After the animation finishes, remove from state
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, EXIT_ANIMATION_DURATION);

    timers.current.set(`${id}-exit`, removeTimer);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      const delay = AUTO_DISMISS[type];
      if (delay > 0) {
        const timer = setTimeout(() => beginDismiss(id), delay);
        timers.current.set(id, timer);
      }
    },
    [beginDismiss],
  );

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast]);
  const dismiss = useCallback((id: string) => beginDismiss(id), [beginDismiss]);

  // Cleanup all timers on unmount
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, dismiss }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

// ─── UI Config per type ────────────────────────────────────────────────────────

const CONFIG: Record<
  ToastType,
  { icon: React.ComponentType<{ className?: string }>; classes: string }
> = {
  success: {
    icon: CheckCircle2,
    classes:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 [--toast-icon:theme(colors.emerald.400)]',
  },
  error: {
    icon: XCircle,
    classes: 'border-red-500/30 bg-red-500/10 text-red-300 [--toast-icon:theme(colors.red.400)]',
  },
  warning: {
    icon: AlertTriangle,
    classes:
      'border-amber-500/30 bg-amber-500/10 text-amber-300 [--toast-icon:theme(colors.amber.400)]',
  },
};

// ─── Toast Container ───────────────────────────────────────────────────────────

function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
      style={{ maxWidth: '26rem', width: 'calc(100vw - 2.5rem)' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

// ─── Individual Toast Item ─────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { icon: Icon, classes } = CONFIG[toast.type];
  const isError = toast.type === 'error';

  return (
    <div
      role="alert"
      className={[
        // Layout & shape
        'pointer-events-auto relative flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-2xl',
        // Backdrop blur for glassmorphism
        'backdrop-blur-sm',
        // Dark glass base (always rendered over dark/light app)
        'bg-card/95 border-border',
        // Slide-in / slide-out animation
        toast.dismissing ? 'animate-toast-out' : 'animate-toast-in',
        // Type-specific accent overlay
        classes,
      ].join(' ')}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Colored left bar */}
      <span
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{
          background:
            toast.type === 'success'
              ? 'rgb(52 211 153)'
              : toast.type === 'error'
                ? 'rgb(248 113 113)'
                : 'rgb(251 191 36)',
        }}
      />

      {/* Icon */}
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          toast.type === 'success'
            ? 'text-emerald-400'
            : toast.type === 'error'
              ? 'text-red-400'
              : 'text-amber-400'
        }`}
      />

      {/* Message */}
      <p className="flex-1 text-sm leading-snug text-foreground font-medium pr-1">
        {toast.message}
      </p>

      {/* Dismiss button — always shown but critical for error type */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        title={isError ? 'Dismiss' : 'Close'}
        className={`-mr-1 -mt-0.5 rounded-lg p-1 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          isError ? 'opacity-90' : 'opacity-50 hover:opacity-100'
        }`}
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
