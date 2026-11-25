/* ספי התראות (אפיון 9, "שעות סמוכות", "היום או מחר"): מסמך אחד settings/thresholds.
   כולם קוראים, רק מנהל משנה (נאכף בכללים). מנוע החריגים, בדיקת הכפילות ומסך "היום" נשענים על אותם ערכים. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type Thresholds = {
  qLeadMinutes: number;      // כמה דקות לפני האספקה ההזמנה חייבת להיות ב-Q (חריגה אדומה)
  qFromTime: string;         // מאיזו שעה ביום האספקה הזמנה שלא הועברה ל-Q היא חריגה (המוקדם מבין זה לבין qLeadMinutes)
  soonDays: number;          // "בקרוב": היום ועוד X ימים – עדכון בתפעול, אישור לקוח ופרטי אספקה הופכים לדחופים
  nearMinutes: number;       // בדיקת כפילות: אותו לקוח, תאריך וסניף בהפרש של עד X דקות
  creditDeadline: string;    // עד איזו שעה ביום האספקה אשראי צריך להיות מחויב; אחריה – חריגה אדומה
  quoteFollowupHours: number; // הצעת מחיר שנשלחה ולא עודכנה כך וכך שעות – תזכורת לחזור ללקוח
  lateSplitMinutes: number;  // בבורד ובדוחות: איחור עד X דקות / מעל X דקות (כל איחור נשאר איחור)
  opsCutoff: string;         // "לעדכן בתפעול": הזמנה של היום/מחר שנוצרה או שונתה אחרי השעה הזו ביום שלפני המועד
};

export const DEFAULT_THRESHOLDS: Thresholds = { qLeadMinutes: 120, qFromTime: '12:00', soonDays: 1, nearMinutes: 180, creditDeadline: '12:00', quoteFollowupHours: 24, lateSplitMinutes: 15, opsCutoff: '18:00' };

export const THRESHOLD_META: Record<keyof Thresholds, { title: string; hint: string; unit: string; min: number; max: number }> = {
  qLeadMinutes: { title: 'העברה ל-Q – לפני האספקה', hint: 'הזמנה של היום שלא הועברה ל-Q כשנשאר פחות מזה עד האספקה – חריגה אדומה', unit: 'דקות', min: 15, max: 600 },
  qFromTime: { title: 'העברה ל-Q – החל מהשעה', hint: 'ביום האספקה, החל מהשעה הזו כל הזמנה שלא הועברה ל-Q היא חריגה אדומה (או לפי הדקות לפני האספקה, המוקדם מביניהם)', unit: 'שעה', min: 0, max: 0 },
  soonDays: { title: 'חלון "בקרוב"', hint: 'הזמנות של היום ועוד מספר הימים הזה: חסר פרט חובה – חריגה דחופה', unit: 'ימים', min: 0, max: 7 },
  nearMinutes: { title: 'שעות סמוכות לכפילות', hint: 'אזהרת כפילות כשאותו לקוח מזמין לאותו סניף באותו יום בהפרש של עד', unit: 'דקות', min: 15, max: 720 },
  creditDeadline: { title: 'מועד חיוב אשראי', hint: 'אשראי שלא חויב עד השעה הזו ביום האספקה עובר מדחוף לחריגה אדומה', unit: 'שעה', min: 0, max: 0 },
  lateSplitMinutes: { title: 'פיצול איחורים', hint: 'בבורד ובדוחות האיחורים מתחלקים לאיחור עד מספר הדקות הזה ולאיחור מעליו. כל איחור עדיין נספר כאיחור', unit: 'דקות', min: 1, max: 120 },
  opsCutoff: { title: 'עדכון התפעול – החל מהשעה', hint: 'הזמנה של היום או מחר שנוצרה או שונתה (מועד, שעה, סניף, משלוח/איסוף, כתובת, פריטים) אחרי השעה הזו ביום שלפני – מסומנת "לעדכן בתפעול"', unit: 'שעה', min: 0, max: 0 },
  quoteFollowupHours: { title: 'תזכורת להצעת מחיר', hint: 'הצעה שנשלחה ללקוח ולא עודכנה (סטטוס או הערה) במשך הזמן הזה – מופיעה כתזכורת במסך היום ובהצעות המחיר', unit: 'שעות', min: 1, max: 336 },
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
