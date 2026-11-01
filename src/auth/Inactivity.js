import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* ניתוק אחרי 60 דקות בלי פעילות, עם אזהרה 2 דקות מראש וכפתור "המשך מחובר" (אפיון 11, תיקון 4). */
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Clock } from 'lucide-react';
import { Button } from '../design/components';
import { useAuth } from './AuthContext';
const LIMIT = 60 * 60 * 1000;
const WARN = 2 * 60 * 1000;
export function InactivityGuard() {
    const { logout } = useAuth();
    const last = useRef(Date.now());
    const [left, setLeft] = useState(null);
    useEffect(() => {
        const bump = () => { if (left === null)
            last.current = Date.now(); };
        const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
        events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
        const t = setInterval(() => {
            const idle = Date.now() - last.current;
            if (idle >= LIMIT)
                logout('נותקת אחרי 60 דקות בלי פעילות. היכנס שוב כדי להמשיך.');
            else if (idle >= LIMIT - WARN)
                setLeft(LIMIT - idle);
            else
                setLeft(null);
        }, 1000);
        return () => { events.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
    }, [left, logout]);
    const stay = () => { last.current = Date.now(); setLeft(null); };
    if (left === null)
        return null;
    const s = Math.ceil(left / 1000);
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (o) => !o && stay(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "udialog", dir: "rtl", "aria-describedby": "idle-desc", role: "alertdialog", children: [_jsxs(Dialog.Title, { className: "udialog__title", children: [_jsx(Clock, { size: 18, "aria-hidden": "true", style: { verticalAlign: -3 } }), " \u05E2\u05D3\u05D9\u05D9\u05DF \u05DB\u05D0\u05DF?"] }), _jsxs("p", { id: "idle-desc", className: "muted", children: ["\u05DC\u05D0 \u05D4\u05D9\u05D9\u05EA\u05D4 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA \u05DB\u05DE\u05E2\u05D8 \u05E9\u05E2\u05D4. \u05EA\u05E0\u05D5\u05EA\u05E7 \u05D1\u05E2\u05D5\u05D3 ", _jsx("bdi", { dir: "ltr", className: "ltr", children: _jsx("b", { children: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }) }), " \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D2\u05DF \u05E2\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05D1\u05E2\u05DE\u05D3\u05D4 \u05D4\u05DE\u05E9\u05D5\u05EA\u05E4\u05EA."] }), _jsxs("div", { className: "udialog__actions", children: [_jsx(Button, { variant: "primary", autoFocus: true, onClick: stay, children: "\u05D4\u05DE\u05E9\u05DA \u05DE\u05D7\u05D5\u05D1\u05E8" }), _jsx(Button, { variant: "ghost", onClick: () => logout(), children: "\u05D4\u05EA\u05E0\u05EA\u05E7 \u05E2\u05DB\u05E9\u05D9\u05D5" })] })] })] }) }));
}
