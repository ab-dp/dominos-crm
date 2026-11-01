import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* גרף עמודות של סדרה אחת: "זמן" – עמודות לאורך ציר; "קטגוריה" – פסים אופקיים ממוינים (עד 12 ועוד "אחרים").
   צבע אחד (כחול Domino's), תווית ערך בריחוף, ולחיצה פותחת את ההזמנות של אותה שורה. נבנה ב-HTML כדי לעבוד טבעי מימין לשמאל. */
import { useState } from 'react';
import { Ltr, fmtMoney } from '../../lib/format';
export function BarChart({ data, kind, money, onPick }) {
    const [hover, setHover] = useState(null);
    const fmt = (v) => (money ? fmtMoney(v) : String(v));
    if (kind === 'category') {
        const sorted = [...data].sort((a, b) => b.value - a.value);
        const top = sorted.slice(0, 12);
        const rest = sorted.slice(12);
        const rows = rest.length ? [...top, { id: '__rest', label: `אחרים (${rest.length})`, value: rest.reduce((t, d) => t + d.value, 0) }] : top;
        const max = Math.max(1, ...rows.map((d) => d.value));
        return (_jsx("ol", { className: "bars", "aria-label": "\u05D2\u05E8\u05E3 \u05E4\u05E1\u05D9\u05DD", children: rows.map((d) => (_jsx("li", { children: _jsxs("button", { className: "bars__row", disabled: d.id === '__rest', onClick: () => onPick(d.id), "aria-label": `${d.label}: ${fmt(d.value)}`, children: [_jsx("span", { className: "bars__label", children: d.label }), _jsx("span", { className: "bars__track", children: _jsx("span", { className: "bars__fill", style: { width: `${Math.max(1.5, (d.value / max) * 100)}%` } }) }), _jsx("span", { className: "bars__value", children: _jsx(Ltr, { children: fmt(d.value) }) })] }) }, d.id))) }));
    }
    const max = Math.max(1, ...data.map((d) => d.value));
    const step = Math.ceil(data.length / 10); // תוויות ציר לא צפופות
    const top = niceMax(max);
    return (_jsxs("div", { className: "cols", role: "group", "aria-label": "\u05D2\u05E8\u05E3 \u05E2\u05DE\u05D5\u05D3\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D6\u05DE\u05DF \u2013 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DE\u05D5\u05E4\u05D9\u05E2\u05D9\u05DD \u05D2\u05DD \u05D1\u05D8\u05D1\u05DC\u05D4", children: [_jsx("div", { className: "cols__grid", "aria-hidden": "true", children: [1, 0.5, 0].map((f) => _jsx("span", { style: { bottom: `${f * 100}%` }, children: _jsx(Ltr, { children: fmt(Math.round(top * f)) }) }, f)) }), _jsx("div", { className: "cols__plot", children: data.map((d, i) => (_jsxs("button", { className: `cols__col ${hover === d.id ? 'is-hover' : ''}`, onMouseEnter: () => setHover(d.id), onMouseLeave: () => setHover(null), onFocus: () => setHover(d.id), onBlur: () => setHover(null), onClick: () => onPick(d.id), "aria-label": `${d.label}: ${fmt(d.value)}`, children: [_jsx("span", { className: "cols__bar", style: { height: `${Math.max(d.value ? 1.5 : 0, (d.value / top) * 100)}%` } }), hover === d.id && _jsxs("span", { className: "cols__tip", children: [_jsx("b", { children: _jsx(Ltr, { children: fmt(d.value) }) }), _jsx(Ltr, { children: d.label })] }), _jsx("span", { className: "cols__x", children: i % step === 0 ? _jsx(Ltr, { children: d.label }) : '' })] }, d.id))) })] }));
}
/* קצה ציר עגול: 1, 2, 2.5 או 5 כפול חזקת 10 */
function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10])
        if (m * p >= v)
            return m * p;
    return 10 * p;
}
