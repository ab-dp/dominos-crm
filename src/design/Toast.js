import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* הודעה קצרה עם "בטל" (אפיון סעיף 2, תיקון 3): 10 שניות, נעצרת בריחוף או בפוקוס, נקראת לקורא מסך. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, X } from 'lucide-react';
import './Toast.css';
const ToastCtx = createContext(() => { });
export const useToast = () => useContext(ToastCtx);
const DURATION = 10000;
export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const seq = useRef(0);
    const show = useCallback((t) => {
        const id = ++seq.current;
        setItems((cur) => [...cur.slice(-2), { ...t, id }]);
    }, []);
    const dismiss = useCallback((id) => setItems((cur) => cur.filter((t) => t.id !== id)), []);
    return (_jsxs(ToastCtx.Provider, { value: show, children: [children, _jsx("div", { className: "toasts", role: "status", "aria-live": "polite", children: _jsx(AnimatePresence, { initial: false, children: items.map((t) => _jsx(ToastView, { item: t, onDone: () => dismiss(t.id) }, t.id)) }) })] }));
}
function ToastView({ item, onDone }) {
    const reduce = useReducedMotion();
    const [paused, setPaused] = useState(false);
    const remaining = useRef(DURATION);
    const started = useRef(Date.now());
    useEffect(() => {
        if (paused)
            return;
        started.current = Date.now();
        const t = setTimeout(onDone, remaining.current);
        return () => {
            clearTimeout(t);
            remaining.current -= Date.now() - started.current;
        };
    }, [paused, onDone]);
    const r = 9;
    const c = 2 * Math.PI * r;
    return (_jsxs(motion.div, { layout: !reduce, className: "toast", initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: reduce ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.16 } }, transition: { type: 'spring', stiffness: 420, damping: 34 }, onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false), onFocus: () => setPaused(true), onBlur: () => setPaused(false), children: [_jsx("span", { className: "toast__ok", "aria-hidden": "true", children: _jsx(Check, { size: 14, strokeWidth: 3 }) }), _jsx("span", { className: "toast__msg", children: item.message }), item.onUndo && (_jsxs("button", { className: "toast__undo", onClick: () => { item.onUndo(); onDone(); }, children: [_jsxs("svg", { className: "toast__ring", width: "22", height: "22", viewBox: "0 0 22 22", "aria-hidden": "true", children: [_jsx("circle", { cx: "11", cy: "11", r: r, className: "toast__ring-track" }), _jsx("circle", { cx: "11", cy: "11", r: r, className: "toast__ring-bar", strokeDasharray: c, style: { animationDuration: `${DURATION}ms`, animationPlayState: paused ? 'paused' : 'running', ['--c']: c } })] }), "\u05D1\u05D8\u05DC"] })), item.action && _jsx("button", { className: "toast__action", onClick: () => { item.action.run(); onDone(); }, children: item.action.label }), _jsx("button", { className: "toast__close", onClick: onDone, "aria-label": "\u05E1\u05D2\u05D5\u05E8 \u05D4\u05D5\u05D3\u05E2\u05D4", children: _jsx(X, { size: 16 }) })] }));
}
