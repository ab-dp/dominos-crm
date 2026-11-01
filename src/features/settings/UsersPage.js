import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/* ניהול משתמשים (אפיון 11): ממתינים · פעילים · מושבתים · נדחו. אישור ודחייה ישירות בשורה. */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ExternalLink, MoreHorizontal, ShieldCheck, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../auth/AuthContext';
import { BOOT_ADMIN, ROLE_LABEL } from '../../auth/types';
import { Button, EmptyState, Field, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { logAction } from '../../data/audit';
import { Ltr } from '../../lib/format';
import '../pages.css';
import './UsersPage.css';
const TABS = [['pending', 'ממתינים לאישור'], ['active', 'פעילים'], ['disabled', 'מושבתים'], ['rejected', 'נדחו']];
const CONSOLE_USERS = 'https://console.firebase.google.com/project/dominos-crm/authentication/users';
function fmtTs(ts) {
    if (!ts)
        return '—';
    const d = ts.toDate();
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function UsersPage() {
    const { profile } = useAuth();
    const toast = useToast();
    const [users, setUsers] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [deletedPassword, setDeletedPassword] = useState(null);
    useEffect(() => onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => d.data())), () => setError('אין הרשאה לצפות במשתמשים. ודא שכללי האבטחה פורסמו ב-Firebase.')), []);
    const by = useMemo(() => {
        const m = { pending: [], active: [], disabled: [], rejected: [] };
        (users ?? []).forEach((u) => { if (u.status in m)
            m[u.status].push(u); });
        Object.values(m).forEach((l) => l.sort((a, b) => (b.requestedAt?.seconds ?? 0) - (a.requestedAt?.seconds ?? 0)));
        return m;
    }, [users]);
    // הטאב "ממתינים" נפתח ראשון כשיש בקשות
    const current = tab ?? (by.pending.length ? 'pending' : 'active');
    const activeAdmins = by.active.filter((u) => u.role === 'admin').length;
    const isProtected = (u) => u.email === BOOT_ADMIN || (u.role === 'admin' && u.status === 'active' && activeAdmins <= 1);
    async function setStatus(u, status, extra = {}, message, action) {
        const before = { status: u.status, role: u.role };
        try {
            await updateDoc(doc(db, 'users', u.uid), { status, ...extra, statusChangedAt: serverTimestamp(), statusChangedBy: profile?.uid ?? '' });
            logAction({ entity: 'user', entityId: u.uid, action, before, after: { status, ...extra } });
            toast({ message });
        }
        catch {
            toast({ message: 'הפעולה נכשלה – אין הרשאה או אין חיבור' });
        }
    }
    return (_jsxs("div", { className: "page", children: [_jsx("header", { className: "page__head", children: _jsxs("div", { children: [_jsx("h1", { className: "page__title", children: "\u05E0\u05D9\u05D4\u05D5\u05DC \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD" }), _jsx("p", { className: "page__sub", children: "\u05DB\u05DC \u05D0\u05D7\u05D3 \u05D9\u05DB\u05D5\u05DC \u05DC\u05D4\u05D9\u05E8\u05E9\u05DD \u2013 \u05E8\u05E7 \u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05E4\u05D5\u05EA\u05D7 \u05D2\u05D9\u05E9\u05D4. \u05DB\u05DC \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DB\u05D0\u05DF \u05E0\u05E8\u05E9\u05DE\u05EA \u05D1\u05D9\u05D5\u05DE\u05DF." })] }) }), _jsx("div", { className: "tabs", role: "tablist", "aria-label": "\u05DE\u05E6\u05D1 \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD", children: TABS.map(([k, label]) => (_jsxs("button", { role: "tab", "aria-selected": current === k, className: `tab ${current === k ? 'is-on' : ''} ${k === 'pending' && by.pending.length ? 'tab--alert' : ''}`, onClick: () => setTab(k), children: [label, _jsx("span", { className: "tab__count", children: _jsx(Ltr, { children: by[k].length }) })] }, k))) }), deletedPassword && (_jsxs("div", { className: "console-hint", role: "status", children: [_jsxs("span", { children: [_jsxs("b", { children: ["\u05E2\u05D5\u05D3 \u05E6\u05E2\u05D3 \u05D0\u05D7\u05D3 \u05DB\u05D3\u05D9 \u05E9", deletedPassword.name, " \u05D9\u05D5\u05DB\u05DC \u05DC\u05D4\u05D9\u05E8\u05E9\u05DD \u05DE\u05D7\u05D3\u05E9 \u05D1\u05D0\u05D5\u05EA\u05D5 \u05DE\u05D9\u05D9\u05DC:"] }), " \u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05EA \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05D2\u05DD \u05D1-Firebase Console (", _jsx("bdi", { dir: "ltr", children: deletedPassword.email }), " \u2190 \u05E9\u05DC\u05D5\u05E9 \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u2190 Delete account)."] }), _jsxs("a", { className: "btn btn--primary btn--sm", href: CONSOLE_USERS, target: "_blank", rel: "noreferrer", children: [_jsx(ExternalLink, { size: 14, "aria-hidden": "true" }), _jsx("span", { className: "btn__label", children: "\u05E4\u05EA\u05D7 \u05D0\u05EA Firebase Console" })] }), _jsx("button", { className: "btn btn--ghost btn--sm", onClick: () => setDeletedPassword(null), children: _jsx("span", { className: "btn__label", children: "\u05E1\u05D9\u05D9\u05DE\u05EA\u05D9" }) })] })), error ? _jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(Users, { size: 24 }), title: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD", children: error }) })
                : users === null ? _jsx("div", { className: "card users-skel", children: [0, 1, 2].map((i) => _jsx(Skeleton, { h: 44 }, i)) })
                    : by[current].length === 0 ? (_jsx("div", { className: "card", children: _jsx(EmptyState, { icon: _jsx(UserCheck, { size: 24 }), title: current === 'pending' ? 'אין בקשות הצטרפות ממתינות' : 'אין משתמשים בתצוגה הזו' }) })) : (_jsx("div", { className: "otable-wrap", children: _jsxs("table", { className: "otable otable--dense users", children: [_jsxs("caption", { className: "sr-only", children: ["\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u2013 ", TABS.find((t) => t[0] === current)[1]] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u05E9\u05DD" }), _jsx("th", { children: "\u05DE\u05D9\u05D9\u05DC" }), _jsx("th", { children: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05E2\u05DD" }), _jsx("th", { children: "\u05EA\u05E4\u05E7\u05D9\u05D3" }), _jsx("th", { children: current === 'pending' ? 'תאריך בקשה' : 'כניסה אחרונה' }), _jsx("th", { children: _jsx("span", { className: "sr-only", children: "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA" }) })] }) }), _jsx("tbody", { children: by[current].map((u) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("span", { className: "ucell", children: [_jsx("span", { className: "ucell__avatar", "aria-hidden": "true", children: u.name?.[0] ?? '?' }), _jsxs("span", { children: [u.name, u.uid === profile?.uid && _jsx("span", { className: "you", children: "\u05D0\u05EA/\u05D4" })] })] }) }), _jsx("td", { children: _jsx("bdi", { dir: "ltr", children: u.email }) }), _jsx("td", { children: u.provider === 'google' ? 'Google' : 'מייל וסיסמה' }), _jsx("td", { children: u.role === 'admin' ? _jsxs("span", { className: "role role--admin", children: [_jsx(ShieldCheck, { size: 14, "aria-hidden": "true" }), " ", ROLE_LABEL.admin] }) : ROLE_LABEL.user }), _jsx("td", { className: "num", children: _jsx(Ltr, { children: fmtTs(current === 'pending' ? u.requestedAt : u.lastLogin) }) }), _jsxs("td", { className: "users__actions", children: [current === 'pending' && (_jsxs(_Fragment, { children: [_jsx(Button, { size: "sm", variant: "primary", icon: _jsx(Check, { size: 16 }), onClick: () => setDialog({ kind: 'approve', user: u }), children: "\u05D0\u05E9\u05E8" }), _jsx(Button, { size: "sm", onClick: () => setDialog({ kind: 'reject', user: u }), children: "\u05D3\u05D7\u05D4" })] })), current === 'rejected' && _jsx(Button, { size: "sm", onClick: () => setDialog({ kind: 'approve', user: u }), children: "\u05D0\u05E9\u05E8 \u05D1\u05DB\u05DC \u05D6\u05D0\u05EA" }), current === 'disabled' && _jsx(Button, { size: "sm", icon: _jsx(UserCheck, { size: 16 }), onClick: () => setStatus(u, 'active', {}, _jsxs(_Fragment, { children: [u.name, " \u05D4\u05D5\u05E4\u05E2\u05DC \u05DE\u05D7\u05D3\u05E9"] }), 'enable'), children: "\u05D4\u05E4\u05E2\u05DC \u05DE\u05D7\u05D3\u05E9" }), current !== 'pending' && (_jsx(UserMenu, { u: u, protectedUser: isProtected(u), onEdit: () => setDialog({ kind: 'edit', user: u }), onDisable: () => setStatus(u, 'disabled', {}, _jsxs(_Fragment, { children: [u.name, " \u05D4\u05D5\u05E9\u05D1\u05EA \u05D5\u05E0\u05D5\u05EA\u05E7 \u05DE\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA"] }), 'disable'), onDelete: () => setDialog({ kind: 'delete', user: u }) }))] })] }, u.uid))) })] }) })), _jsx(UserDialog, { state: dialog, onClose: () => setDialog(null), onApprove: (u, role) => setStatus(u, 'active', { role, approvedBy: profile?.uid, rejectReason: '' }, _jsxs(_Fragment, { children: [u.name, " \u05D0\u05D5\u05E9\u05E8 \u05DB", ROLE_LABEL[role], " \u2013 \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E4\u05E2\u05D9\u05DC"] }), 'approve'), onReject: (u, reason) => setStatus(u, 'rejected', { rejectReason: reason }, _jsxs(_Fragment, { children: ["\u05D4\u05D1\u05E7\u05E9\u05D4 \u05E9\u05DC ", u.name, " \u05E0\u05D3\u05D7\u05EA\u05D4"] }), 'reject'), onEdit: async (u, name, role) => {
                    try {
                        await updateDoc(doc(db, 'users', u.uid), { name, role });
                        logAction({ entity: 'user', entityId: u.uid, action: 'edit', before: { name: u.name, role: u.role }, after: { name, role } });
                        toast({ message: 'פרטי המשתמש עודכנו' });
                    }
                    catch {
                        toast({ message: 'העדכון נכשל' });
                    }
                }, onDelete: async (u) => {
                    await setStatus(u, 'deleted', {}, _jsxs(_Fragment, { children: [u.name, " \u05E0\u05DE\u05D7\u05E7 \u05DE\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA"] }), 'delete');
                    if (u.provider === 'password')
                        setDeletedPassword(u);
                }, canChangeRole: (u) => !isProtected(u) })] }));
}
function UserMenu({ u, protectedUser, onEdit, onDisable, onDelete }) {
    return (_jsxs(Dropdown.Root, { dir: "rtl", children: [_jsx(Dropdown.Trigger, { asChild: true, children: _jsx("button", { className: "icon-btn", "aria-label": `פעולות עבור ${u.name}`, children: _jsx(MoreHorizontal, { size: 18 }) }) }), _jsx(Dropdown.Portal, { children: _jsxs(Dropdown.Content, { className: "menu", align: "end", sideOffset: 4, children: [_jsx(Dropdown.Item, { className: "menu__item", onSelect: onEdit, children: "\u05E2\u05E8\u05D5\u05DA \u05E9\u05DD \u05D5\u05EA\u05E4\u05E7\u05D9\u05D3" }), u.status === 'active' && (_jsxs(Dropdown.Item, { className: "menu__item", disabled: protectedUser, onSelect: onDisable, children: [_jsx(UserX, { size: 16, "aria-hidden": "true" }), " \u05D4\u05E9\u05D1\u05EA", protectedUser && _jsx("span", { className: "menu__hint", children: "\u05DE\u05E0\u05D4\u05DC \u05D0\u05D7\u05E8\u05D5\u05DF" })] })), _jsx(Dropdown.Separator, { className: "menu__sep" }), _jsxs(Dropdown.Item, { className: "menu__item menu__item--danger", disabled: protectedUser, onSelect: onDelete, children: [_jsx(Trash2, { size: 16, "aria-hidden": "true" }), " \u05DE\u05D7\u05E7", protectedUser && _jsx("span", { className: "menu__hint", children: "\u05DE\u05E0\u05D4\u05DC \u05D0\u05D7\u05E8\u05D5\u05DF" })] })] }) })] }));
}
function UserDialog({ state, onClose, onApprove, onReject, onEdit, onDelete, canChangeRole }) {
    const [role, setRole] = useState('user');
    const [text, setText] = useState('');
    const u = state?.user;
    useEffect(() => {
        if (!state)
            return;
        setRole(state.kind === 'edit' ? state.user.role : 'user');
        setText(state.kind === 'edit' ? state.user.name : '');
    }, [state]);
    if (!state || !u)
        return null;
    const titles = { approve: `אישור ${u.name}`, reject: `דחיית הבקשה של ${u.name}`, edit: `עריכת ${u.name}`, delete: `מחיקת ${u.name}` };
    const submit = () => {
        if (state.kind === 'approve')
            onApprove(u, role);
        if (state.kind === 'reject')
            onReject(u, text.trim());
        if (state.kind === 'edit' && text.trim())
            onEdit(u, text.trim(), role);
        if (state.kind === 'delete')
            onDelete(u);
        onClose();
    };
    return (_jsx(Dialog.Root, { open: true, onOpenChange: (o) => !o && onClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "cmd-overlay" }), _jsxs(Dialog.Content, { className: "udialog", dir: "rtl", "aria-describedby": "udialog-desc", children: [_jsx(Dialog.Title, { className: "udialog__title", children: titles[state.kind] }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); submit(); }, children: [_jsxs("div", { id: "udialog-desc", children: [state.kind === 'approve' && _jsxs("p", { className: "muted", children: ["\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05D9\u05D4\u05D9\u05D4 \u05E4\u05E2\u05D9\u05DC \u05DE\u05D9\u05D3. ", _jsx("bdi", { dir: "ltr", children: u.email })] }), state.kind === 'reject' && _jsx("p", { className: "muted", children: "\u05D4\u05D1\u05E7\u05E9\u05D4 \u05EA\u05E2\u05D1\u05D5\u05E8 \u05DC\"\u05E0\u05D3\u05D7\u05D5\". \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D9\u05E8\u05D0\u05D4 \u05D4\u05D5\u05D3\u05E2\u05D4 \u05E9\u05D4\u05D1\u05E7\u05E9\u05D4 \u05DC\u05D0 \u05D0\u05D5\u05E9\u05E8\u05D4." }), state.kind === 'delete' && (_jsxs("div", { className: "udialog__danger", children: [_jsx("p", { children: "\u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05D9\u05D9\u05E2\u05DC\u05DD \u05DE\u05D4\u05E8\u05E9\u05D9\u05DE\u05D5\u05EA \u05D5\u05DC\u05D0 \u05D9\u05D5\u05DB\u05DC \u05DC\u05D4\u05D9\u05DB\u05E0\u05E1. \u05D4\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05E9\u05DC\u05D5 \u05E0\u05E9\u05D0\u05E8\u05D5\u05EA \u05D1\u05D9\u05D5\u05DE\u05DF \u05EA\u05D7\u05EA \u05E9\u05DE\u05D5." }), u.provider === 'password'
                                                    ? _jsx("p", { children: "\u05DB\u05D3\u05D9 \u05E9\u05D9\u05D5\u05DB\u05DC \u05DC\u05D4\u05D9\u05E8\u05E9\u05DD \u05DE\u05D7\u05D3\u05E9 \u05D1\u05D0\u05D5\u05EA\u05D5 \u05DE\u05D9\u05D9\u05DC, \u05D0\u05D7\u05E8\u05D9 \u05D4\u05DE\u05D7\u05D9\u05E7\u05D4 \u05EA\u05E6\u05D8\u05E8\u05DA \u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05D5\u05EA\u05D5 \u05D2\u05DD \u05D1-Firebase Console \u2013 \u05E0\u05E4\u05EA\u05D7 \u05DC\u05DA \u05E7\u05D9\u05E9\u05D5\u05E8 \u05D9\u05E9\u05D9\u05E8." })
                                                    : _jsx("p", { children: "\u05D4\u05D5\u05D0 \u05E0\u05DB\u05E0\u05E1 \u05E2\u05DD Google \u2013 \u05D0\u05DD \u05D9\u05D9\u05DB\u05E0\u05E1 \u05E9\u05D5\u05D1, \u05EA\u05D9\u05D5\u05D5\u05E6\u05E8 \u05D1\u05E7\u05E9\u05D4 \u05D7\u05D3\u05E9\u05D4 \u05E9\u05EA\u05D7\u05DB\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8\u05DA." })] }))] }), (state.kind === 'edit') && (_jsx(Field, { label: "\u05E9\u05DD \u05DE\u05DC\u05D0", children: _jsx("input", { className: "input", autoFocus: true, value: text, onChange: (e) => setText(e.target.value) }) })), (state.kind === 'approve' || state.kind === 'edit') && (_jsxs("fieldset", { className: "rolepick", disabled: state.kind === 'edit' && !canChangeRole(u), children: [_jsx("legend", { className: "field__label", children: "\u05EA\u05E4\u05E7\u05D9\u05D3" }), ['user', 'admin'].map((r) => (_jsxs("label", { className: `rolepick__opt ${role === r ? 'is-on' : ''}`, children: [_jsx("input", { type: "radio", name: "role", value: r, checked: role === r, onChange: () => setRole(r) }), _jsxs("span", { children: [_jsx("b", { children: ROLE_LABEL[r] }), _jsx("small", { children: r === 'user' ? 'כל העבודה היומית: הזמנות, לקוחות, דוחות, סגירת חודש' : 'כל מה שמשתמש עושה + משתמשים והגדרות' })] })] }, r)))] })), state.kind === 'reject' && (_jsx(Field, { label: "\u05E1\u05D9\u05D1\u05D4 (\u05DC\u05D0 \u05D7\u05D5\u05D1\u05D4)", children: _jsx("input", { className: "input", autoFocus: true, value: text, onChange: (e) => setText(e.target.value) }) })), _jsxs("div", { className: "udialog__actions", children: [_jsx(Button, { type: "submit", variant: state.kind === 'delete' ? 'danger' : 'primary', autoFocus: state.kind === 'approve' || state.kind === 'delete', children: state.kind === 'approve' ? 'אשר והפעל' : state.kind === 'reject' ? 'דחה בקשה' : state.kind === 'edit' ? 'שמור' : 'מחק משתמש' }), _jsx(Dialog.Close, { asChild: true, children: _jsx(Button, { type: "button", variant: "ghost", children: "\u05D1\u05D9\u05D8\u05D5\u05DC" }) })] })] })] })] }) }));
}
