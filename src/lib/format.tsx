/* פורמטים אחידים (אפיון סעיף 2): DD.MM.YYYY, שעה 24h, ₪ עם פסיק אלפים, טלפון 05X-XXXXXXX.
   כל ערך מספרי עטוף ב-<Ltr> כדי שלא יתהפך בתוך טקסט עברי. */
import type { ReactNode } from 'react';

export function Ltr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <bdi dir="ltr" className={`ltr ${className}`}>{children}</bdi>;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function fmtMoney(n: number): string {
  return '₪' + Math.round(n).toLocaleString('en-US');
}

export function fmtPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : raw;
}

export function Money({ value }: { value: number }) {
  return <Ltr>{fmtMoney(value)}</Ltr>;
}

export function DateText({ iso }: { iso: string }) {
  return <Ltr>{fmtDate(iso)}</Ltr>;
}

export function Phone({ value }: { value: string }) {
  return <Ltr>{fmtPhone(value)}</Ltr>;
}

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export function weekday(iso: string): string {
  return WEEKDAYS[new Date(iso + 'T12:00:00').getDay()];
}
