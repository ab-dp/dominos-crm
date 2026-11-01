import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* רכיבי בסיס של מערכת העיצוב (תוכנית בנייה, סעיף 3.8) */
import { forwardRef, useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, Loader2, OctagonAlert, TriangleAlert } from 'lucide-react';
import { STATUS_LABEL } from '../data/types';
import './components.css';
export const Button = forwardRef(function Button({ variant = 'secondary', size = 'md', icon, loading, kbd, children, className = '', disabled, ...rest }, ref) {
    return (_jsxs("button", { ref: ref, className: `btn btn--${variant} btn--${size} ${loading ? 'is-loading' : ''} ${className}`, disabled: disabled || loading, "aria-busy": loading || undefined, ...rest, children: [loading ? _jsx(Loader2, { className: "btn__spin", size: 16, "aria-hidden": "true" }) : icon, children && _jsx("span", { className: "btn__label", children: children }), kbd && _jsx("kbd", { className: "kbd btn__kbd", "aria-hidden": "true", children: kbd })] }));
});
/* ---------- Tooltip ---------- */
export function Tip({ label, children, side = 'top' }) {
    return (_jsxs(Tooltip.Root, { delayDuration: 300, children: [_jsx(Tooltip.Trigger, { asChild: true, children: children }), _jsx(Tooltip.Portal, { children: _jsxs(Tooltip.Content, { className: "tip", side: side, sideOffset: 6, dir: "rtl", children: [label, _jsx(Tooltip.Arrow, { className: "tip__arrow" })] }) })] }));
}
/* ---------- Health badge: צבע + אייקון + מילה ---------- */
const HEALTH_META = {
    critical: { word: 'חריגה', Icon: OctagonAlert },
    urgent: { word: 'דחוף', Icon: TriangleAlert },
    missing: { word: 'חסר', Icon: CircleAlert },
};
export function HealthBadge({ health, issues, compact }) {
    if (health === 'ok')
        return _jsx("span", { className: "sr-only", children: "\u05EA\u05E7\u05D9\u05E0\u05D4" });
    const { word, Icon } = HEALTH_META[health];
    const badge = (_jsxs("span", { className: `health health--${health}`, tabIndex: 0, role: "img", "aria-label": `${word}: ${issues.map((i) => i.label).join(', ')}`, children: [_jsx(Icon, { size: 14, strokeWidth: 2.4, "aria-hidden": "true" }), !compact && _jsx("span", { children: word })] }));
    return (_jsx(Tip, { label: _jsx("ul", { className: "tip__list", children: issues.map((i) => _jsx("li", { children: i.label }, i.rule)) }), children: badge }));
}
/* ---------- Status badge: ניטרלי, עם תפריט לשינוי ---------- */
export function StatusMenu({ status, onChange }) {
    return (_jsxs(Dropdown.Root, { dir: "rtl", children: [_jsx(Dropdown.Trigger, { asChild: true, children: _jsxs("button", { className: "status", "aria-label": `סטטוס: ${STATUS_LABEL[status]}. לחץ לשינוי`, onClick: (e) => e.stopPropagation(), children: [STATUS_LABEL[status], _jsx(ChevronDown, { size: 14, "aria-hidden": "true" })] }) }), _jsx(Dropdown.Portal, { children: _jsx(Dropdown.Content, { className: "menu", sideOffset: 4, align: "start", onClick: (e) => e.stopPropagation(), children: Object.keys(STATUS_LABEL).map((s) => (_jsxs(Dropdown.Item, { className: "menu__item", onSelect: () => s !== status && onChange(s), children: [_jsx("span", { className: "menu__check", children: s === status && _jsx(Check, { size: 14 }) }), STATUS_LABEL[s]] }, s))) }) })] }));
}
/* ---------- Mark: סניף · Q · תשלום. בוצע = ✓ בעיגול, חסר = עיגול מקווקו ---------- */
export function MarkGlyph({ done, label, drawKey }) {
    const reduce = useReducedMotion();
    return (_jsxs("span", { className: `mark ${done ? 'mark--done' : 'mark--missing'}`, children: [_jsx("svg", { width: "22", height: "22", viewBox: "0 0 22 22", "aria-hidden": "true", children: done ? (_jsxs(_Fragment, { children: [_jsx(motion.circle, { cx: "11", cy: "11", r: "9.5", className: "mark__fill", initial: reduce ? false : { scale: 0.4, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: 'spring', stiffness: 500, damping: 28 }, style: { originX: '50%', originY: '50%' } }, `c${drawKey}`), _jsx(motion.path, { d: "M6.6 11.4l3 3 5.8-6.2", className: "mark__tick", initial: reduce ? false : { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.24, delay: 0.08, ease: [0.2, 0, 0, 1] } }, `p${drawKey}`)] })) : (_jsx("circle", { cx: "11", cy: "11", r: "9", className: "mark__dash" })) }), _jsx("span", { className: "mark__label", children: label })] }));
}
/* פעולה שנפתחת במקום: לחיצה על הסימון → שדה קטן → Enter → ✓ */
export function MarkAction({ done, label, srLabel, title, children, onOpenChange, open, }) {
    return (_jsxs(Popover.Root, { open: open, onOpenChange: onOpenChange, children: [_jsx(Popover.Trigger, { asChild: true, children: _jsx("button", { className: "mark-btn", "aria-label": srLabel, onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), children: _jsx(MarkGlyph, { done: done, label: label, drawKey: String(done) }) }) }), _jsx(Popover.Portal, { children: _jsxs(Popover.Content, { className: "pop", sideOffset: 6, align: "start", dir: "rtl", onClick: (e) => e.stopPropagation(), onKeyDown: (e) => e.stopPropagation(), children: [_jsx("p", { className: "pop__title", children: title }), children, _jsx(Popover.Arrow, { className: "pop__arrow" })] }) })] }));
}
/* שדה עם תווית קבועה מעליו (לא placeholder במקום תווית) */
export function Field({ label, children, hint }) {
    return (_jsxs("label", { className: "field", children: [_jsx("span", { className: "field__label", children: label }), children, hint && _jsx("span", { className: "field__hint", children: hint })] }));
}
/* ---------- Rolling number: ספרה שמתגלגלת כשהמונה משתנה ---------- */
export function RollingNumber({ value }) {
    const reduce = useReducedMotion();
    const prev = useRef(value);
    const dir = value < prev.current ? -1 : 1;
    useEffect(() => { prev.current = value; }, [value]);
    return (_jsx("span", { className: "roll", "aria-live": "polite", children: _jsx(motion.span, { className: "roll__digit", initial: reduce ? false : { y: dir * -14, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { type: 'spring', stiffness: 520, damping: 32 }, children: value }, value) }));
}
/* ---------- Skeleton / Empty ---------- */
export function Skeleton({ w = '100%', h = 14 }) {
    return _jsx("span", { className: "skeleton", style: { width: w, height: h }, "aria-hidden": "true" });
}
export function EmptyState({ icon, title, children, action }) {
    return (_jsxs("div", { className: "empty", children: [_jsx("span", { className: "empty__icon", "aria-hidden": "true", children: icon }), _jsx("p", { className: "empty__title", children: title }), children && _jsx("p", { className: "empty__text", children: children }), action] }));
}
/* מקלדת: האם הפוקוס בשדה טקסט (קיצורים פועלים רק מחוץ לשדות) */
export function isTyping(e) {
    const el = e.target;
    return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}
export function useHotkey(key, fn) {
    const ref = useRef(fn);
    ref.current = fn;
    useEffect(() => {
        const h = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e))
                return;
            // לפי מיקום המקש, כדי שיעבוד גם כשהמקלדת בעברית
            const code = key === '/' ? 'Slash' : `Key${key.toUpperCase()}`;
            if (e.key.toLowerCase() === key.toLowerCase() || e.code === code) {
                e.preventDefault();
                ref.current();
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [key]);
}
export function useToggle(initial = false) {
    const [v, set] = useState(initial);
    return [v, set];
}
/* פרט חובה שחסר בהזמנה – אדום עד שמשלימים */
export function Missing({ children = 'חסר' }) {
    return _jsx("span", { className: "miss-text", children: children });
}
