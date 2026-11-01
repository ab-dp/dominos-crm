import { jsx as _jsx } from "react/jsx-runtime";
export function Ltr({ children, className = '' }) {
    return _jsx("bdi", { dir: "ltr", className: `ltr ${className}`, children: children });
}
const pad = (n) => String(n).padStart(2, '0');
export function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}
export function fmtMoney(n) {
    return '₪' + Math.round(n).toLocaleString('en-US');
}
export function fmtPhone(raw) {
    const digits = raw.replace(/\D/g, '');
    return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : raw;
}
export function Money({ value }) {
    return _jsx(Ltr, { children: fmtMoney(value) });
}
export function DateText({ iso }) {
    return _jsx(Ltr, { children: fmtDate(iso) });
}
export function Phone({ value }) {
    return _jsx(Ltr, { children: fmtPhone(value) });
}
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export function weekday(iso) {
    return WEEKDAYS[new Date(iso + 'T12:00:00').getDay()];
}
