/* הודעה קצרה עם "בטל" (אפיון סעיף 2, תיקון 3): 10 שניות, נעצרת בריחוף או בפוקוס, נקראת לקורא מסך. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, X } from 'lucide-react';
import './Toast.css';

type ToastInput = { message: ReactNode; onUndo?: () => void };
type ToastItem = ToastInput & { id: number };

const ToastCtx = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const DURATION = 10000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const show = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((cur) => [...cur.slice(-2), { ...t, id }]);
  }, []);
  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => <ToastView key={t.id} item={t} onDone={() => dismiss(t.id)} />)}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION);
  const started = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    started.current = Date.now();
    const t = setTimeout(onDone, remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current -= Date.now() - started.current;
    };
  }, [paused, onDone]);

  const r = 9;
  const c = 2 * Math.PI * r;

  return (
    <motion.div
      layout={!reduce}
      className="toast"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast__ok" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
      <span className="toast__msg">{item.message}</span>
      {item.onUndo && (
        <button
          className="toast__undo"
          onClick={() => { item.onUndo!(); onDone(); }}
        >
          <svg className="toast__ring" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <circle cx="11" cy="11" r={r} className="toast__ring-track" />
            <circle
              cx="11" cy="11" r={r}
              className="toast__ring-bar"
              strokeDasharray={c}
              style={{ animationDuration: `${DURATION}ms`, animationPlayState: paused ? 'paused' : 'running', ['--c' as string]: c }}
            />
          </svg>
          בטל
        </button>
      )}
      <button className="toast__close" onClick={onDone} aria-label="סגור הודעה"><X size={16} /></button>
    </motion.div>
  );
}
