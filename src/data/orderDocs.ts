/* מסמכי הזמנה (אפיון 6.3 "מסמכים") – כרגע תעודת רכש. בלי Storage בתשלום: הקובץ נשמר בתוך Firestore,
   מחולק לחלקים של עד 700KB (מגבלת מסמך היא 1MB), עד 2MB לקובץ. תמונה גדולה מוקטנת לפני השמירה.
   אין מחיקה – מסמך שגוי מוחלף בהעלאת מסמך חדש, והכל נרשם ביומן. */
import { useEffect, useState } from 'react';
import { Bytes, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export const MAX_FILE = 2 * 1024 * 1024;
const CHUNK = 700 * 1024;
export const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const TYPES = ACCEPT.split(',');

export type OrderDoc = { id: string; orderId: string; kind: string; name: string; type: string; size: number; chunks: number; byName: string; at?: Timestamp };

export function fileError(f: File): string {
  if (!TYPES.includes(f.type)) return 'אפשר לצרף PDF או תמונה (JPG, PNG)';
  return '';
}

/* תמונה מעל 1MB מוקטנת ל-2000 פיקסלים לכל היותר, JPEG – תעודת רכש נשארת קריאה */
async function shrink(f: File): Promise<Blob> {
  if (!f.type.startsWith('image/') || f.size <= 1024 * 1024) return f;
  const bmp = await createImageBitmap(f);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? f), 'image/jpeg', 0.85));
}

export async function uploadOrderDoc(orderId: number, f: File, kind = 'po') {
  const err = fileError(f);
  if (err) throw new Error(err);
  const blob = await shrink(f);
  if (blob.size > MAX_FILE) throw new Error('הקובץ גדול מ-2MB. אפשר לסרוק ברזולוציה נמוכה יותר או לצלם מחדש.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const u = auth.currentUser!;
  const byName = u.displayName ?? u.email ?? '';
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'orderDocs'));
  const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK));
  const type = blob === f ? f.type : 'image/jpeg';
  const name = blob === f ? f.name : f.name.replace(/\.\w+$/, '') + '.jpg';
  batch.set(ref, { orderId: String(orderId), kind, name, type, size: bytes.length, chunks, by: u.uid, byName, at: serverTimestamp() });
  for (let i = 0; i < chunks; i++) {
    batch.set(doc(db, 'orderDocs', ref.id, 'chunks', String(i)), { i, data: Bytes.fromUint8Array(bytes.slice(i * CHUNK, (i + 1) * CHUNK)) });
  }
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'order', entityId: String(orderId), action: 'doc', before: null, after: { docName: name, kind }, source: 'form',
    by: u.uid, byName, at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}

export function useOrderDocs(orderId: number) {
  const [items, setItems] = useState<OrderDoc[] | null>(null);
  useEffect(() => onSnapshot(query(collection(db, 'orderDocs'), where('orderId', '==', String(orderId))),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderDoc).sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0))),
    () => setItems([])), [orderId]);
  return items;
}

/* מרכיב את הקובץ מהחלקים ומחזיר כתובת זמנית לפתיחה או הורדה */
export async function openOrderDoc(d: OrderDoc): Promise<string> {
  const s = await getDocs(query(collection(db, 'orderDocs', d.id, 'chunks'), orderBy('i')));
  const parts = s.docs.map((x) => new Uint8Array((x.data().data as Bytes).toUint8Array()) as Uint8Array<ArrayBuffer>);
  return URL.createObjectURL(new Blob(parts, { type: d.type }));
}
