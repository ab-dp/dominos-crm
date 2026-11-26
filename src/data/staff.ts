/* רשימת הנציגים ל"העבר לטיפול…". רשימת המשתמשים עצמה פתוחה בכללים רק למנהל (יש בה מיילים),
   ולכן לנציג הרשימה נבנית ממי שמטפל בפועל בהזמנות ובהצעות שכבר טעונות במערכת. מנהל רואה את כל המשתמשים הפעילים. */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import type { UserDoc } from '../auth/types';
import { db } from '../lib/firebase';
import { useStore } from './store';

export type Staff = { uid: string; name: string };

export function useStaff(): Staff[] {
  const { isAdmin, profile } = useAuth();
  const { orders, quotes } = useStore();
  const [users, setUsers] = useState<Staff[]>([]);
  useEffect(() => {
    if (!isAdmin) { setUsers([]); return; }
    return onSnapshot(collection(db, 'users'),
      (s) => setUsers(s.docs.map((d) => d.data() as UserDoc).filter((u) => u.status === 'active').map((u) => ({ uid: u.uid, name: u.name }))),
      () => setUsers([]));
  }, [isAdmin]);
  return useMemo(() => {
    const m = new Map<string, string>();
    if (profile) m.set(profile.uid, profile.name);
    if (isAdmin) users.forEach((u) => m.set(u.uid, u.name));
    else [...orders, ...quotes].forEach((x) => { if (x.handlerUid && x.handler && !m.has(x.handlerUid)) m.set(x.handlerUid, x.handler); });
    return [...m].map(([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [isAdmin, users, orders, quotes, profile]);
}
