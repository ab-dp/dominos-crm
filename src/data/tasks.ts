/* משימות מעקב (אפיון 6.6, 9, 19.1): "משימת חזרה" בתיק לקוח, או "צעד הבא" של ליד, הופכים למשימה במסך החריגים ביום שלהם.
   מסמך לכל משימה: tasks/{id}. אין מחיקה – רק סימון "בוצע", עם שם ושעה, ונרשם ביומן. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch, type DocumentData, type DocumentReference, type Timestamp, type WriteBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type Task = {
  id: string; customerId: string; leadId?: string; quoteId?: number; customerName: string; text: string; due: string;
  done: boolean; by: string; byName: string; createdAt?: Timestamp;
  doneBy?: string; doneByName?: string; doneAt?: Timestamp;
};

/* משימה של ליד / של הצעה (גם בלי לקוח במערכת) / של לקוח – ביומן נרשמת על מה שהיא שייכת אליו */
const taskEntity = (t: Pick<Task, 'leadId' | 'quoteId'>) => (t.leadId ? 'lead' : t.quoteId ? 'quote' : 'customer');
const taskEntityId = (t: Pick<Task, 'leadId' | 'quoteId' | 'customerId'>) => t.leadId || (t.quoteId ? String(t.quoteId) : t.customerId);
/* לאן מוביל קישור המשימה */
export const taskHref = (t: Pick<Task, 'leadId' | 'quoteId' | 'customerId'>) =>
  t.leadId ? `/leads/${t.leadId}` : t.quoteId ? `/quotes/${t.quoteId}` : `/customers/${t.customerId}?tab=activity`;

/* כל המשימות הפתוחות – מספרן קטן, ולכן נטענות במלואן */
export function useOpenTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'tasks'), where('done', '==', false)),
    (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Task).sort((a, b) => a.due.localeCompare(b.due))),
    () => setTasks([])), []);
  return tasks;
}

/* נכתב יחד עם רשומת הפעילות בתיק הלקוח, באותה פעולה */
export function addTaskTo(batch: { set: (ref: DocumentReference, data: DocumentData) => unknown }, t: { customerId: string; leadId?: string; quoteId?: number; customerName: string; text: string; due: string }) {
  const u = auth.currentUser!;
  const ref = doc(collection(db, 'tasks'));
  batch.set(ref, { ...t, text: t.text.trim(), done: false, by: u.uid, byName: u.displayName ?? u.email ?? '', createdAt: serverTimestamp() });
  return ref.id;
}

/* דחייה או תיקון ניסוח של משימה פתוחה – אותה משימה, ההיסטוריה לא מתפצלת. ביומן: הערך הקודם והחדש */
export async function updateTask(t: Task, next: { text: string; due: string }) {
  const u = auth.currentUser!;
  const byName = u.displayName ?? u.email ?? '';
  const text = next.text.trim();
  const patch: Record<string, unknown> = {};
  if (text !== t.text) patch.text = text;
  if (next.due !== t.due) patch.due = next.due;
  if (!Object.keys(patch).length) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'tasks', t.id), { ...patch, updatedBy: u.uid, updatedAt: serverTimestamp() });
  if (t.quoteId && patch.due) syncQuoteCallAt(batch, t.quoteId, next.due);
  batch.set(doc(collection(db, 'auditLog')), {
    entity: taskEntity(t), entityId: taskEntityId(t), action: 'task-update',
    before: { task: t.text.slice(0, 200), due: t.due }, after: { task: text.slice(0, 200), due: next.due }, source: 'inline',
    by: u.uid, byName, at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}

/* משימת חזרה של הצעה: תאריך החזרה שעל ההצעה (callAt) הולך יחד איתה – בוצעה = מתאפס, נדחתה = התאריך החדש */
function syncQuoteCallAt(batch: WriteBatch, quoteId: number, callAt: string) {
  const u = auth.currentUser!;
  batch.update(doc(db, 'quotes', String(quoteId)), { callAt, updatedAt: serverTimestamp(), updatedBy: u.uid, updatedByName: u.displayName ?? u.email ?? '' });
}

export async function setTaskDone(t: Task, done: boolean) {
  const u = auth.currentUser!;
  const byName = u.displayName ?? u.email ?? '';
  const batch = writeBatch(db);
  batch.update(doc(db, 'tasks', t.id), done
    ? { done: true, doneBy: u.uid, doneByName: byName, doneAt: serverTimestamp() }
    : { done: false, doneBy: null, doneByName: null, doneAt: null });
  if (t.quoteId) syncQuoteCallAt(batch, t.quoteId, done ? '' : t.due);
  batch.set(doc(collection(db, 'auditLog')), {
    entity: taskEntity(t), entityId: taskEntityId(t), action: done ? 'task-done' : 'task-reopen', before: null, after: { task: t.text.slice(0, 200), due: t.due }, source: 'inline',
    by: u.uid, byName, at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}
