/* ספי התראות (אפיון 9, "שעות סמוכות", "היום או מחר"): מסמך אחד settings/thresholds.
   כולם קוראים, רק מנהל משנה (נאכף בכללים). מנוע החריגים, בדיקת הכפילות ומסך "היום" נשענים על אותם ערכים. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type Thresholds = {
  qLeadMinutes: number;      // כמה דקות לפני האספקה ההזמנה חייבת להיות ב-Q (חריגה אדומה)
  soonDays: number;          // "בקרוב": היום ועוד X ימים – אישור סניף, אישור לקוח ופרטי אספקה הופכים לדחופים
  nearMinutes: number;       // בדיקת כפילות: אותו לקוח, תאריך וסניף בהפרש של עד X דקות
  creditDeadline: string;    // עד איזו שעה ביום האספקה אשראי צריך להיות מחויב; אחריה – חריגה אדומה
};

export const DEFAULT_THRESHOLDS: Thresholds = { qLeadMinutes: 120, soonDays: 1, nearMinutes: 180, creditDeadline: '12:00' };

export const THRESHOLD_META: Record<keyof Thresholds, { title: string; hint: string; unit: string; min: number; max: number }> = {
  qLeadMinutes: { title: 'העברה ל-Q', hint: 'הזמנה של היום שלא הועברה ל-Q כשנשאר פחות מזה עד האספקה – חריגה אדומה', unit: 'דקות', min: 15, max: 600 },
  soonDays: { title: 'חלון "בקרוב"', hint: 'הזמנות של היום ועוד מספר הימים הזה: חסר אישור סניף, אישור לקוח או פרטי אספקה – דחוף', unit: 'ימים', min: 0, max: 7 },
  nearMinutes: { title: 'שעות סמוכות לכפילות', hint: 'אזהרת כפילות כשאותו לקוח מזמין לאותו סניף באותו יום בהפרש של עד', unit: 'דקות', min: 15, max: 720 },
  creditDeadline: { title: 'מועד חיוב אשראי', hint: 'אשראי שלא חויב עד השעה הזו ביום האספקה עובר מדחוף לחריגה אדומה', unit: 'שעה', min: 0, max: 0 },
};

export function useThresholds() {
  const [th, setTh] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [saved, setSaved] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'settings', 'thresholds'),
    (s) => { setSaved(s.exists()); setTh({ ...DEFAULT_THRESHOLDS, ...(s.data() as Partial<Thresholds> | undefined) }); },
    () => undefined), []);
  return { th, saved };
}

export async function saveThresholds(next: Thresholds, before: Thresholds) {
  const u = auth.currentUser!;
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'thresholds'), { ...next, updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'settings', entityId: 'thresholds', action: 'update', before, after: next, source: 'form',
    by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}
