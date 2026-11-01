import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* הגדרות (מנהל מערכת בלבד): משתמשים · רשימות · ספי התראות */
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { UsersPage } from './UsersPage';
import { ListsPage } from './ListsPage';
import { ThresholdsPage } from './ThresholdsPage';
export function SettingsPage() {
    const { isAdmin } = useAuth();
    // משתמש רגיל לא רואה את ההגדרות בכלל (והשרת חוסם אותו בכל מקרה)
    if (!isAdmin)
        return _jsx(Navigate, { to: "/today", replace: true });
    return (_jsxs(_Fragment, { children: [_jsxs("nav", { className: "subnav", "aria-label": "\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA", children: [_jsx("span", { className: "subnav__label", "aria-hidden": "true", children: "\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA" }), _jsx(NavLink, { to: "/settings/users", className: ({ isActive }) => (isActive ? 'is-on' : ''), children: "\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD" }), _jsx(NavLink, { to: "/settings/lists", className: ({ isActive }) => (isActive ? 'is-on' : ''), children: "\u05E8\u05E9\u05D9\u05DE\u05D5\u05EA" }), _jsx(NavLink, { to: "/settings/thresholds", className: ({ isActive }) => (isActive ? 'is-on' : ''), children: "\u05E1\u05E4\u05D9 \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA" })] }), _jsxs(Routes, { children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "users", replace: true }) }), _jsx(Route, { path: "users", element: _jsx(UsersPage, {}) }), _jsx(Route, { path: "lists", element: _jsx(ListsPage, {}) }), _jsx(Route, { path: "thresholds", element: _jsx(ThresholdsPage, {}) })] })] }));
}
