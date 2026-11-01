import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* מסכי הכניסה (אפיון 11 + 2.1): חצי כחול עם אריח הדומינו, חצי לבן עם הטופס. במובייל – לוגו אנכי מעל הטופס. */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Eye, EyeOff, Hourglass, LogOut, Mail, TriangleAlert, X } from 'lucide-react';
import { Button } from '../design/components';
import { DominoTile } from '../components/DominoTile';
import { authErrorMessage, useAuth } from './AuthContext';
import './AuthScreens.css';
const BASE = import.meta.env.BASE_URL;
export function AuthScreens() {
    const { phase } = useAuth();
    const [view, setView] = useState('login');
    const reduce = useReducedMotion();
    const screen = phase === 'pending' ? 'pending' : view;
    return (_jsxs("div", { className: "auth", children: [_jsxs("section", { className: "auth__brand", "aria-hidden": "true", style: { ['--login-photo']: `url(${BASE}brand/login.webp)` }, children: [_jsx(DominoTile, { size: 176, animate: true }), _jsx("p", { className: "auth__brand-title", children: "\u05DE\u05E2\u05E8\u05DB\u05EA CRM" }), _jsx("p", { className: "auth__brand-sub", children: "\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05E2\u05E1\u05E7\u05D9\u05D9\u05DD \u05D5\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA" })] }), _jsxs("main", { className: "auth__panel", children: [_jsx("img", { className: "auth__mobile-logo", src: `${BASE}logo-vertical.svg`, alt: "Domino's Pizza" }), _jsx(AnimatePresence, { mode: "wait", initial: false, children: _jsx(motion.div, { className: "auth__card", initial: reduce ? { opacity: 0 } : { opacity: 0, x: screen === 'register' ? -16 : 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, transition: { duration: 0.1 } }, transition: { duration: 0.24, ease: [0.2, 0, 0, 1] }, children: screen === 'pending' ? _jsx(Pending, {}) : screen === 'register' ? _jsx(Register, { onBack: () => setView('login') }) : _jsx(Login, { onRegister: () => setView('register') }) }, screen) })] })] }));
}
/* ---------- כניסה ---------- */
function Login({ onRegister }) {
    const { loginEmail, loginGoogle, notice, clearNotice } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const emailRef = useRef(null);
    useEffect(() => { emailRef.current?.focus(); }, []);
    const submit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setError('חובה למלא מייל וסיסמה');
            return;
        }
        setBusy('email');
        setError('');
        try {
            await loginEmail(email, password);
        }
        catch (err) {
            setError(authErrorMessage(err));
            setBusy('');
        }
    };
    const google = async () => {
        setBusy('google');
        setError('');
        try {
            await loginGoogle();
        }
        catch (err) {
            setError(authErrorMessage(err));
            setBusy('');
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx("h1", { className: "auth__title", children: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA" }), _jsx("p", { className: "auth__lead", children: "\u05D1\u05E8\u05D5\u05DA \u05D4\u05D1\u05D0. \u05D4\u05D9\u05DB\u05E0\u05E1 \u05DB\u05D3\u05D9 \u05DC\u05E8\u05D0\u05D5\u05EA \u05DE\u05D4 \u05E6\u05E8\u05D9\u05DA \u05DC\u05D8\u05E4\u05DC \u05D1\u05D5 \u05E2\u05DB\u05E9\u05D9\u05D5." }), notice && _jsx(Notice, { tone: "danger", onClose: clearNotice, children: notice }), _jsx(GoogleButton, { onClick: google, busy: busy === 'google', disabled: !!busy, children: "\u05D4\u05DE\u05E9\u05DA \u05E2\u05DD Google" }), _jsx(Divider, { children: "\u05D0\u05D5 \u05E2\u05DD \u05DE\u05D9\u05D9\u05DC" }), _jsxs("form", { onSubmit: submit, noValidate: true, children: [_jsxs("label", { className: "afield", children: [_jsx("span", { className: "afield__label", children: "\u05DE\u05D9\u05D9\u05DC" }), _jsx("input", { ref: emailRef, className: "input input--ltr", type: "email", autoComplete: "username", value: email, onChange: (e) => { setEmail(e.target.value); setError(''); }, "aria-invalid": !!error, "aria-describedby": error ? 'login-err' : undefined })] }), _jsx(PasswordField, { label: "\u05E1\u05D9\u05E1\u05DE\u05D4", value: password, onChange: (v) => { setPassword(v); setError(''); }, autoComplete: "current-password", invalid: !!error, describedBy: error ? 'login-err' : undefined }), _jsx(AnimatePresence, { children: error && _jsx(FieldError, { id: "login-err", children: error }) }), _jsx(Button, { variant: "primary", size: "lg", type: "submit", className: "auth__submit", loading: busy === 'email', disabled: !!busy && busy !== 'email', children: "\u05DB\u05E0\u05D9\u05E1\u05D4" })] }), _jsxs("p", { className: "auth__switch", children: ["\u05D0\u05D9\u05DF \u05DC\u05DA \u05D7\u05E9\u05D1\u05D5\u05DF? ", _jsx("button", { className: "link", onClick: onRegister, children: "\u05D4\u05E8\u05E9\u05DE\u05D4" })] }), _jsx("p", { className: "auth__help", children: "\u05E9\u05DB\u05D7\u05EA \u05E1\u05D9\u05E1\u05DE\u05D4? \u05E4\u05E0\u05D4 \u05DC\u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05D5\u05E7\u05D3" })] }));
}
/* ---------- הרשמה ---------- */
function Register({ onBack }) {
    const { register, loginGoogle } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const nameRef = useRef(null);
    useEffect(() => { nameRef.current?.focus(); }, []);
    const rules = [
        { ok: password.length >= 8, label: 'לפחות 8 תווים' },
        { ok: /[a-zA-Zא-ת]/.test(password), label: 'לפחות אות אחת' },
        { ok: /\d/.test(password), label: 'לפחות מספר אחד' },
        { ok: !!password && password.toLowerCase() !== email.trim().toLowerCase(), label: 'שונה מהמייל' },
    ];
    const allOk = rules.every((r) => r.ok);
    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim())
            return setError('חובה: שם מלא');
        if (!/^\S+@\S+\.\S+$/.test(email.trim()))
            return setError('כתובת המייל לא תקינה. בדוק שיש @ ונקודה.');
        if (!allOk)
            return setError('הסיסמה לא עומדת בכללים שמסומנים למטה');
        if (password !== confirm)
            return setError('הסיסמאות לא זהות. הקלד שוב את אימות הסיסמה.');
        setBusy('email');
        setError('');
        try {
            await register(name, email, password);
        }
        catch (err) {
            setError(authErrorMessage(err));
            setBusy('');
        }
    };
    const google = async () => {
        setBusy('google');
        setError('');
        try {
            await loginGoogle();
        }
        catch (err) {
            setError(authErrorMessage(err));
            setBusy('');
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("button", { className: "auth__back", onClick: onBack, children: [_jsx(ArrowRight, { size: 16, "aria-hidden": "true" }), " \u05D7\u05D6\u05E8\u05D4 \u05DC\u05DB\u05E0\u05D9\u05E1\u05D4"] }), _jsx("h1", { className: "auth__title", children: "\u05D4\u05E8\u05E9\u05DE\u05D4" }), _jsx("p", { className: "auth__lead", children: "\u05D0\u05D7\u05E8\u05D9 \u05D4\u05D4\u05E8\u05E9\u05DE\u05D4 \u05D4\u05D1\u05E7\u05E9\u05D4 \u05E2\u05D5\u05D1\u05E8\u05EA \u05DC\u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA. \u05EA\u05D5\u05DB\u05DC \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1 \u05D0\u05D7\u05E8\u05D9 \u05E9\u05EA\u05D0\u05D5\u05E9\u05E8." }), _jsx(GoogleButton, { onClick: google, busy: busy === 'google', disabled: !!busy, children: "\u05D4\u05E8\u05E9\u05DE\u05D4 \u05E2\u05DD Google" }), _jsx(Divider, { children: "\u05D0\u05D5 \u05E2\u05DD \u05DE\u05D9\u05D9\u05DC \u05D5\u05E1\u05D9\u05E1\u05DE\u05D4" }), _jsxs("form", { onSubmit: submit, noValidate: true, children: [_jsxs("label", { className: "afield", children: [_jsxs("span", { className: "afield__label", children: ["\u05E9\u05DD \u05DE\u05DC\u05D0 ", _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), _jsx("input", { ref: nameRef, className: "input", autoComplete: "name", value: name, onChange: (e) => { setName(e.target.value); setError(''); } })] }), _jsxs("label", { className: "afield", children: [_jsxs("span", { className: "afield__label", children: ["\u05DE\u05D9\u05D9\u05DC ", _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), _jsx("input", { className: "input input--ltr", type: "email", autoComplete: "email", value: email, onChange: (e) => { setEmail(e.target.value); setError(''); } })] }), _jsx(PasswordField, { label: "\u05E1\u05D9\u05E1\u05DE\u05D4", required: true, value: password, onChange: (v) => { setPassword(v); setError(''); }, autoComplete: "new-password", describedBy: "pw-rules" }), _jsx("ul", { className: "pwrules", id: "pw-rules", "aria-label": "\u05DB\u05DC\u05DC\u05D9 \u05D4\u05E1\u05D9\u05E1\u05DE\u05D4", children: rules.map((r) => (_jsxs("li", { className: r.ok ? 'is-ok' : '', children: [_jsx("span", { className: "pwrules__icon", "aria-hidden": "true", children: r.ok ? _jsx(Check, { size: 12, strokeWidth: 3 }) : null }), r.label, _jsx("span", { className: "sr-only", children: r.ok ? ' – תקין' : ' – חסר' })] }, r.label))) }), _jsx(PasswordField, { label: "\u05D0\u05D9\u05DE\u05D5\u05EA \u05E1\u05D9\u05E1\u05DE\u05D4", required: true, value: confirm, onChange: (v) => { setConfirm(v); setError(''); }, autoComplete: "new-password", hint: confirm && confirm === password ? 'הסיסמאות זהות ✓' : undefined }), _jsx(AnimatePresence, { children: error && _jsx(FieldError, { id: "reg-err", children: error }) }), _jsx(Button, { variant: "primary", size: "lg", type: "submit", className: "auth__submit", loading: busy === 'email', disabled: !!busy && busy !== 'email', children: "\u05E9\u05DC\u05D7 \u05D1\u05E7\u05E9\u05D4" })] })] }));
}
/* ---------- ממתין לאישור: מתעדכן לבד ברגע שהמנהל מאשר ---------- */
function Pending() {
    const { profile, user, logout } = useAuth();
    return (_jsxs("div", { className: "pending", children: [_jsx("span", { className: "pending__icon", "aria-hidden": "true", children: _jsx(Hourglass, { size: 28 }) }), _jsx("h1", { className: "auth__title", children: "\u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC\u05DA \u05E0\u05E9\u05DC\u05D7\u05D4" }), _jsx("p", { className: "auth__lead", children: "\u05D4\u05D1\u05E7\u05E9\u05D4 \u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC\u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA. \u05EA\u05D5\u05DB\u05DC \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1 \u05D0\u05D7\u05E8\u05D9 \u05E9\u05EA\u05D0\u05D5\u05E9\u05E8 \u2013 \u05D4\u05DE\u05E1\u05DA \u05D4\u05D6\u05D4 \u05D9\u05EA\u05E2\u05D3\u05DB\u05DF \u05DC\u05D1\u05D3 \u05D1\u05E8\u05D2\u05E2 \u05D4\u05D0\u05D9\u05E9\u05D5\u05E8, \u05D0\u05D9\u05DF \u05E6\u05D5\u05E8\u05DA \u05DC\u05E8\u05E2\u05E0\u05DF." }), _jsxs("div", { className: "pending__who", children: [_jsx(Mail, { size: 16, "aria-hidden": "true" }), _jsx("span", { children: profile?.name }), _jsx("bdi", { dir: "ltr", className: "muted", children: user?.email })] }), _jsxs("div", { className: "pending__dots", "aria-hidden": "true", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), _jsx(Button, { variant: "secondary", icon: _jsx(LogOut, { size: 16 }), onClick: () => logout(), children: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05DB\u05E0\u05D9\u05E1\u05D4" })] }));
}
/* ---------- רכיבים קטנים ---------- */
function PasswordField({ label, value, onChange, autoComplete, invalid, describedBy, required, hint }) {
    const [show, setShow] = useState(false);
    return (_jsxs("label", { className: "afield", children: [_jsxs("span", { className: "afield__label", children: [label, " ", required && _jsx("span", { className: "req", children: "\u05D7\u05D5\u05D1\u05D4" })] }), _jsxs("span", { className: "pw", children: [_jsx("input", { className: "input input--ltr", type: show ? 'text' : 'password', autoComplete: autoComplete, value: value, onChange: (e) => onChange(e.target.value), "aria-invalid": invalid || undefined, "aria-describedby": describedBy }), _jsx("button", { type: "button", className: "pw__toggle", onClick: () => setShow(!show), "aria-label": show ? 'הסתר סיסמה' : 'הצג סיסמה', "aria-pressed": show, children: show ? _jsx(EyeOff, { size: 18 }) : _jsx(Eye, { size: 18 }) })] }), hint && _jsx("span", { className: "afield__hint", children: hint })] }));
}
function GoogleButton({ children, onClick, busy, disabled }) {
    return (_jsxs("button", { type: "button", className: "gbtn", onClick: onClick, disabled: disabled, "aria-busy": busy || undefined, children: [busy ? _jsx("span", { className: "gbtn__spin", "aria-hidden": "true" }) : (_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 48 48", "aria-hidden": "true", children: [_jsx("path", { fill: "#EA4335", d: "M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13.7 17.7 9.5 24 9.5z" }), _jsx("path", { fill: "#4285F4", d: "M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" }), _jsx("path", { fill: "#FBBC05", d: "M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.8-6z" }), _jsx("path", { fill: "#34A853", d: "M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.7-4.2-13.6-10l-7.8 6C6.6 42.6 14.6 48 24 48z" })] })), _jsx("span", { children: children })] }));
}
function Divider({ children }) {
    return _jsx("div", { className: "adivider", role: "separator", children: _jsx("span", { children: children }) });
}
function FieldError({ id, children }) {
    const reduce = useReducedMotion();
    return (_jsxs(motion.p, { id: id, role: "alert", className: "aerror", initial: reduce ? { opacity: 0 } : { opacity: 0, x: [0, -6, 6, -3, 0] }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3 }, children: [_jsx(TriangleAlert, { size: 16, "aria-hidden": "true" }), " ", children] }));
}
function Notice({ tone, children, onClose }) {
    return (_jsxs("div", { className: `anotice anotice--${tone}`, role: "alert", children: [_jsx(TriangleAlert, { size: 18, "aria-hidden": "true" }), _jsx("span", { children: children }), _jsx("button", { onClick: onClose, "aria-label": "\u05E1\u05D2\u05D5\u05E8 \u05D4\u05D5\u05D3\u05E2\u05D4", children: _jsx(X, { size: 16 }) })] }));
}
