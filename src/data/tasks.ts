/* משימות מעקב (אפיון 6.6, 9): "משימת חזרה" שנרשמת בתיק לקוח עם תאריך הופכת למשימה במסך החריגים ביום שלה.
   מסמך לכל משימה: tasks/{id}. אין מחיקה – רק סימון "בוצע", עם שם ושעה, ונרשם ביומן. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch, type Timestamp, type WriteBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type Task = {
  id: string; customerId: string; customerName: string; text: string; due: string;
  done: boolean; by: string; byName: string; createdAt?: Timestamp;
  doneBy?: string; doneByName?: string; doneAt?: Timestamp;
};

/* כל המשימות הפתוחות – מספרן קטן, ולכן נטענות במלואן */
export function useOpenTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'tasks'), where('done', '==', false)),
    (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Task).sort((a, b) => a.due.localeCompare(b.due))),
    () => setTasks([])), []);
  return tasks;
}

/* נכתב יחד עם רשומת הפעילות בתיק הלקוח, באותה פעולה */
export function addTaskTo(batch: WriteBatch, t: { customerId: string; customerName: string; text: string; due: string }) {
  const u = auth.currentUser!;
  const ref = doc(collection(db, 'tasks'));
  batch.set(ref, { ...t, text: t.text.trim(), done: false, by: u.uid, byName: u.displayName ?? u.email ?? '', createdAt: serverTimestamp() });
  return ref.id;
}

export async function setTaskDone(t: Task, done: boolean) {
  const u = auth.currentUser!;
  const byName = u.displayName ?? u.email ?? '';
  const batch = writeBatch(db);
  batch.update(doc(db, 'tasks', t.id), done
    ? { done: true, doneBy: u.uid, doneByName: byName, doneAt: serverTimestamp() }
    : { done: false, doneBy: null, doneByName: null, doneAt: null });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'customer', entityId: t.customerId, action: done ? 'task-done' : 'task-reopen', before: null, after: { task: t.text.slice(0, 200), due: t.due }, source: 'inline',
    by: u.uid, byName, at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}
