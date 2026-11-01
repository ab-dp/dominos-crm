import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* חריגים ומשימות (אפיון 9): כל מה שדורש טיפול, במקום אחד. שורה לכל בעיה, עם הכפתור שפותר אותה,
   מקובץ לפי חומרה; ובצד – משימות המעקב מתיקי הלקוחות. מבוסס על אותו מנוע של מסך "היום" והפעמון. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, CircleCheckBig, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useStore } from '../../data/store';
import { setTaskDone } from '../../data/tasks';
import { useToast } from '../../design/Toast';
import { Skeleton } from '../../design/components';
import { Ltr, fmtDate, toISODate } from '../../lib/format';
import { RULE_LABEL } from '../../rules-engine/health';
import { FixButton } from '../orders/OrderActions';
import '../pages.css';
import './ExceptionsPage.css';
const GROUPS = [['red', 'חריגות'], ['orange', 'דחוף'], ['yellow', 'חסר']];
export function ExceptionsPage() {
    const { orders, now, tasks, loading } = useStore();
    const { profile } = useAuth();
    const panel = usePanel();
    const reduce = useReducedMotion();
    const [params, setParams] = useSearchParams();
    const [mine, setMine] = useState(false);
    const rule = params.get('rule');
    const today = toISODate(now);
    const tomorrow = toISODate(new Date(now.getTime() + 86400000));
    const all = useMemo(() => orders
        .filter((o) => !mine || (o.handlerUid ? o.handlerUid === profile?.uid : o.handler === profile?.name))
        .flatMap((o) => o.issues.map((issue) => ({ o, issue })))
        .sort((a, b) => (a.o.date + a.o.time).localeCompare(b.o.date + b.o.time)), [orders, mine, profile]);
    const rows = rule === null ? all : all.filter((r) => String(r.issue.rule) === rule);
    const counts = useMemo(() => {
        const m = new Map();
        all.forEach((r) => m.set(r.issue.rule, (m.get(r.issue.rule) ?? 0) + 1));
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [all]);
    const by = (s) => rows.filter((r) => r.issue.severity === s);
    const overdue = tasks.filter((t) => t.due < today);
    const dueToday = tasks.filter((t) => t.due === today);
    const upcoming = tasks.filter((t) => t.due > today);
    const when = (iso) => (iso === today ? 'היום' : iso === tomorrow ? 'מחר' : _jsx(Ltr, { children: fmtDate(iso) }));
    const setRule = (r) => { const p = new URLSearchParams(params); if (r === null)
        p.delete('rule');
    else
        p.set('rule', r); setParams(p, { replace: true }); };
    return (_jsxs("div", { className: "page exc", children: [_jsxs("header", { className: "page__head", children: [_jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05D7\u05E8\u05D9\u05D2\u05D9\u05DD \u05D5\u05DE\u05E9\u05D9\u05DE\u05D5\u05EA" }), _jsx("p", { className: "page__sub", children: "\u05DB\u05DC \u05DE\u05D4 \u05E9\u05D3\u05D5\u05E8\u05E9 \u05D8\u05D9\u05E4\u05D5\u05DC, \u05DC\u05E4\u05D9 \u05D7\u05D5\u05DE\u05E8\u05D4. \u05DB\u05DC \u05E9\u05D5\u05E8\u05D4 \u05E2\u05DD \u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u05E9\u05E4\u05D5\u05EA\u05E8 \u05D0\u05D5\u05EA\u05D4." })] }), _jsxs("dl", { className: "head-stats", children: [_jsxs("div", { className: by('red').length ? 'is-alert' : '', children: [_jsx("dt", { children: "\u05D7\u05E8\u05D9\u05D2\u05D5\u05EA" }), _jsx("dd", { children: _jsx(Ltr, { children: all.filter((r) => r.issue.severity === 'red').length }) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u05D3\u05D7\u05D5\u05E3" }), _jsx("dd", { children: _jsx(Ltr, { children: all.filter((r) => r.issue.severity === 'orange').length }) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u05D7\u05E1\u05E8" }), _jsx("dd", { children: _jsx(Ltr, { children: all.filter((r) => r.issue.severity === 'yellow').length }) })] }), _jsxs("div", { className: overdue.length ? 'is-alert' : '', children: [_jsx("dt", { children: "\u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05DC\u05D4\u05D9\u05D5\u05DD" }), _jsx("dd", { children: _jsx(Ltr, { children: overdue.length + dueToday.length }) })] })] })] }), _jsxs("div", { className: "tablebar", children: [_jsxs("div", { className: "seg", role: "group", "aria-label": "\u05E9\u05DC \u05DE\u05D9", children: [_jsx("button", { className: !mine ? 'is-on' : '', "aria-pressed": !mine, onClick: () => setMine(false), children: "\u05DB\u05D5\u05DC\u05DD" }), _jsx("button", { className: mine ? 'is-on' : '', "aria-pressed": mine, onClick: () => setMine(true), children: "\u05E9\u05DC\u05D9" })] }), _jsx("div", { className: "chips", role: "group", "aria-label": "\u05E1\u05D9\u05E0\u05D5\u05DF \u05DC\u05E4\u05D9 \u05E1\u05D5\u05D2", children: counts.map(([r, n]) => (_jsxs("button", { className: `chip ${rule === String(r) ? 'is-on' : ''}`, "aria-pressed": rule === String(r), onClick: () => setRule(rule === String(r) ? null : String(r)), children: [RULE_LABEL[r] ?? r, " ", _jsx("span", { className: "chip__n", children: _jsx(Ltr, { children: n }) }), rule === String(r) && _jsx(X, { size: 13, "aria-hidden": "true" })] }, r))) })] }), _jsxs("div", { className: "exc__grid", children: [_jsxs("section", { className: "card", "aria-labelledby": "h-exc", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { id: "h-exc", className: "card__title", children: "\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E9\u05D3\u05D5\u05E8\u05E9\u05D5\u05EA \u05D8\u05D9\u05E4\u05D5\u05DC" }), _jsxs("span", { className: "muted exc__n", children: [_jsx(Ltr, { children: rows.length }), " \u05E9\u05D5\u05E8\u05D5\u05EA"] })] }), loading ? _jsx("div", { className: "loading-rows", "aria-busy": "true", "aria-label": "\u05D8\u05D5\u05E2\u05DF", children: [0, 1, 2, 3].map((i) => _jsx(Skeleton, { h: 40 }, i)) }) : rows.length === 0 ? (_jsxs("p", { className: "calm exc__calm", children: [_jsx(CircleCheckBig, { size: 18, "aria-hidden": "true" }), " ", rule ? `אין "${RULE_LABEL[Number(rule)]}"` : 'אין חריגים. הכל מטופל'] })) : GROUPS.map(([sev, title]) => {
                                const list = by(sev);
                                if (!list.length)
                                    return null;
                                return (_jsxs("div", { className: "exc__group", children: [_jsxs("p", { className: `exc__label exc__label--${sev}`, children: [title, " ", _jsx(Ltr, { children: list.length })] }), _jsx("ul", { className: "exc__list", children: _jsx(AnimatePresence, { initial: false, children: list.map(({ o, issue }) => (_jsxs(motion.li, { layout: !reduce, className: `exc__row exc__row--${sev}`, initial: { opacity: 0 }, animate: { opacity: 1 }, exit: reduce ? { opacity: 0 } : { opacity: 0, height: 0 }, transition: { duration: 0.18 }, children: [_jsxs("button", { className: "exc__main", onClick: (e) => panel.open(o.id, e.currentTarget), children: [_jsx("span", { className: "exc__issue", children: issue.label }), _jsxs("span", { className: "exc__meta", children: [_jsx("b", { children: o.customerName }), " \u00B7 ", when(o.date), " ", _jsx(Ltr, { children: o.time }), " \u00B7 ", o.branchName, " \u00B7 \u05D4\u05D6\u05DE\u05E0\u05D4 ", _jsx(Ltr, { children: o.id })] })] }), _jsx(FixButton, { o: o, issue: issue, onOpen: () => panel.open(o.id) }, issue.rule)] }, `${o.id}-${issue.rule}`))) }) })] }, sev));
                            })] }), _jsxs("section", { className: "card", "aria-labelledby": "h-tasks", children: [_jsxs("div", { className: "card__head", children: [_jsx("h2", { id: "h-tasks", className: "card__title", children: "\u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05DE\u05E2\u05E7\u05D1" }), _jsxs("span", { className: "muted exc__n", children: [_jsx(Ltr, { children: tasks.length }), " \u05E4\u05EA\u05D5\u05D7\u05D5\u05EA"] })] }), tasks.length === 0 ? (_jsxs("p", { className: "exc__empty", children: [_jsx(CalendarClock, { size: 18, "aria-hidden": "true" }), " \u05D0\u05D9\u05DF \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05E4\u05EA\u05D5\u05D7\u05D5\u05EA. \u05DE\u05E9\u05D9\u05DE\u05D4 \u05E0\u05D5\u05E6\u05E8\u05EA \u05DE\"\u05DE\u05E9\u05D9\u05DE\u05EA \u05D7\u05D6\u05E8\u05D4\" \u05D1\u05EA\u05D9\u05E7 \u05DC\u05E7\u05D5\u05D7."] })) : (_jsxs(_Fragment, { children: [_jsx(TaskGroup, { title: "\u05D1\u05D0\u05D9\u05D7\u05D5\u05E8", tone: "red", list: overdue, when: when }), _jsx(TaskGroup, { title: "\u05D4\u05D9\u05D5\u05DD", tone: "brand", list: dueToday, when: when }), _jsx(TaskGroup, { title: "\u05D1\u05D4\u05DE\u05E9\u05DA", tone: "muted", list: upcoming, when: when })] }))] })] })] }));
}
function TaskGroup({ title, tone, list, when }) {
    const toast = useToast();
    if (!list.length)
        return null;
    const done = (t) => setTaskDone(t, true)
        .then(() => toast({ message: _jsxs(_Fragment, { children: ["\u05DE\u05E9\u05D9\u05DE\u05D4 \u05E1\u05D5\u05DE\u05E0\u05D4 \u05DB\u05D1\u05D5\u05E6\u05E2\u05D4 \u00B7 ", t.customerName] }), onUndo: () => { setTaskDone({ ...t, done: true }, false).catch(() => undefined); } }))
        .catch(() => toast({ message: 'הסימון נכשל – בדוק חיבור' }));
    return (_jsxs("div", { className: "exc__group", children: [_jsxs("p", { className: `exc__label exc__label--${tone}`, children: [title, " ", _jsx(Ltr, { children: list.length })] }), _jsx("ul", { className: "tasks", children: list.map((t) => (_jsxs("li", { className: "task-row", children: [_jsx("label", { className: "task-row__check", children: _jsx("input", { type: "checkbox", onChange: () => done(t), "aria-label": `סמן כבוצע: ${t.text}` }) }), _jsxs("span", { className: "task-row__main", children: [_jsx("span", { className: "task-row__text", children: t.text }), _jsxs("span", { className: "task-row__meta", children: [_jsx(Link, { to: `/customers/${t.customerId}`, children: t.customerName || 'לקוח' }), " \u00B7 ", when(t.due), " \u00B7 ", t.byName] })] })] }, t.id))) })] }));
}
