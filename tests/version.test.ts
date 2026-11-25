/* מספר הגרסה נשמר בשני מקומות (src/lib/version.ts ו-public/version.json) – חייבים להיות זהים,
   אחרת באנר "יש גרסה חדשה" לא ייעלם אחרי רענון, או לא יופיע בכלל */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/lib/version';
import { opsReminderOnSave } from '../src/data/types';
import { NOW, TOMORROW } from './fixtures/orders';

describe('גרסה', () => {
  it('version.json זהה ל-APP_VERSION', () => {
    const file = JSON.parse(readFileSync(new URL('../public/version.json', import.meta.url), 'utf8')) as { v: number };
    expect(file.v).toBe(APP_VERSION);
  });
});

describe('תזכורת לעדכן בתפעול – הזמנה מבוטלת שחזרה', () => {
  const evening = new Date(2026, 10, 25, 19, 0, 0);
  it('אחרי שעת הסיכום – תזכורת', () => {
    expect(opsReminderOnSave({ status: 'cancelled', date: TOMORROW }, { status: 'approved', date: TOMORROW }, evening, '18:00')).toBe(true);
  });
  it('לפני שעת הסיכום – בלי תזכורת', () => {
    expect(opsReminderOnSave({ status: 'cancelled', date: TOMORROW }, { status: 'approved', date: TOMORROW }, NOW, '18:00')).toBe(false);
  });
});
