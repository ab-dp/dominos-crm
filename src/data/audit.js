/* יומן פעולות – אפשר רק להוסיף (נאכף בכללי האבטחה). כל פעולה במסך ניהול המשתמשים נרשמת כאן. */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
export function logAction(e) {
    const by = auth.currentUser?.uid;
    if (!by)
        return Promise.resolve();
    return addDoc(collection(db, 'auditLog'), {
        ...e,
        before: e.before ?? null,
        after: e.after ?? null,
        by,
        byName: auth.currentUser?.displayName ?? auth.currentUser?.email ?? '',
        at: serverTimestamp(),
        ok: true,
    }).catch(() => undefined);
}
