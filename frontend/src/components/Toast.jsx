// Lightweight toast system for instant action feedback.
// Usage: const toast = useToast(); toast.success('Saved'); toast.error('Nope');
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Icon, ICONS } from './ui';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const STYLES = {
  success: { icon: ICONS.checkCircle, bar: 'bg-emerald-500', text: 'text-emerald-600' },
  error:   { icon: ICONS.alert,       bar: 'bg-rose-500',    text: 'text-rose-600' },
  info:    { icon: ICONS.info,        bar: 'bg-indigo-500',  text: 'text-indigo-600' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const id = ++idRef.current;
    setToasts((list) => [...list.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), 3800);
  }, [dismiss]);

  const api = {
    success: (m) => push('success', m),
    error:   (m) => push('error', m),
    info:    (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const s = STYLES[t.type] || STYLES.info;
          return (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex items-start gap-3 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-900/10 px-4 py-3 cursor-pointer animate-slide-in overflow-hidden relative"
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
              <Icon path={s.icon} className={`h-5 w-5 mt-px shrink-0 ${s.text}`} />
              <p className="text-sm text-slate-700 font-medium leading-snug flex-1">{t.message}</p>
              <Icon path={ICONS.close} className="h-3.5 w-3.5 text-slate-300 mt-1 shrink-0" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
