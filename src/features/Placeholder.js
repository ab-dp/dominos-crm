import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { EmptyState } from '../design/components';
import './pages.css';
export function Placeholder({ title, stage, children }) {
    return (_jsxs("div", { className: "page", children: [_jsx("header", { className: "page__head", children: _jsx("h1", { className: "page__title", children: title }) }), _jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(Construction, { size: 24 }), title: `ייבנה בשלב ${stage}`, children: children ?? 'המסך הזה לא חלק מהאב-טיפוס של שלב 1.' }) })] }));
}
export function ReportsHub() {
    return (_jsxs(Placeholder, { title: "\u05D3\u05D5\u05D7\u05D5\u05EA", stage: 8, children: ["\u05D1\u05D0\u05D1-\u05D8\u05D9\u05E4\u05D5\u05E1 \u05D6\u05DE\u05D9\u05DF ", _jsx(Link, { to: "/reports/credit", children: "\u05D3\u05D5\u05D7 \u05D4\u05E7\u05E4\u05D5\u05EA" }), ". \u05E9\u05D0\u05E8 \u05D4\u05D3\u05D5\u05D7\u05D5\u05EA \u05D9\u05D9\u05D1\u05E0\u05D5 \u05D1\u05E9\u05DC\u05D1 8."] }));
}
