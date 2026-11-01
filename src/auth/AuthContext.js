import { jsx as _jsx } from "react/jsx-runtime";
/* מצב ההתחברות והחשבון. סדר הבדיקה לפי האפיון: קודם מייל וסיסמה (Firebase), ורק אחר כך מצב החשבון. */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, browserSessionPersistence, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { BOOT_ADMIN, STATUS_MESSAGE } from './types';
const Ctx = createContext(null);
export function useAuth() {
    const c = useContext(Ctx);
    if (!c)
        throw new Error('useAuth outside provider');
    return c;
}
// אין "זכור אותי": המחשבים במוקד משותפים, אז ההתחברות נמחקת כשסוגרים את הדפדפן
const ready = setPersistence(auth, browserSessionPersistence).catch(() => undefined);
export function AuthProvider({ children }) {
    const [phase, setPhase] = useState('loading');
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [notice, setNotice] = useState('');
    const pendingName = useRef('');
    const loggedThisSession = useRef(false);
    const logout = async (msg) => {
        if (msg)
            setNotice(msg);
        await signOut(auth);
    };
    useEffect(() => {
        let unsubDoc;
        const unsubAuth = onAuthStateChanged(auth, (u) => {
            unsubDoc?.();
            setUser(u);
            if (!u) {
                setProfile(null);
                setPhase('signedOut');
                loggedThisSession.current = false;
                return;
            }
            const ref = doc(db, 'users', u.uid);
            unsubDoc = onSnapshot(ref, async (snap) => {
                const email = (u.email ?? '').toLowerCase();
                const provider = u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password';
                const name = u.displayName || pendingName.current || email.split('@')[0];
                // כניסה ראשונה: בקשת הצטרפות (או מנהל המערכת הקבוע – פעיל מיד)
                if (!snap.exists()) {
                    const boot = email === BOOT_ADMIN && u.emailVerified;
                    await setDoc(ref, {
                        uid: u.uid, name, email: u.email, provider,
                        role: boot ? 'admin' : 'user',
                        status: boot ? 'active' : 'pending',
                        requestedAt: serverTimestamp(),
                    }).catch(() => setNotice('לא הצלחנו לשלוח את הבקשה. נסה שוב.'));
                    return;
                }
                const data = snap.data();
                setProfile(data);
                // נמחק ונכנס שוב: בקשה חדשה במצב "ממתין"
                if (data.status === 'deleted') {
                    await updateDoc(ref, { status: 'pending', role: 'user', requestedAt: serverTimestamp(), name, rejectReason: '' }).catch(() => undefined);
                    return;
                }
                if (data.status === 'rejected' || data.status === 'disabled') {
                    await logout(STATUS_MESSAGE[data.status]);
                    return;
                }
                if (data.status === 'pending') {
                    setPhase('pending');
                    return;
                }
                setPhase('active');
                if (!loggedThisSession.current) {
                    loggedThisSession.current = true;
                    updateDoc(ref, { lastLogin: serverTimestamp() }).catch(() => undefined);
                }
            }, () => setPhase('signedOut'));
        });
        return () => { unsubDoc?.(); unsubAuth(); };
    }, []);
    const api = {
        phase, user, profile, notice,
        isAdmin: phase === 'active' && profile?.role === 'admin',
        clearNotice: () => setNotice(''),
        loginEmail: async (email, password) => {
            await ready;
            setNotice('');
            await signInWithEmailAndPassword(auth, email.trim(), password);
        },
        loginGoogle: async () => {
            await ready;
            setNotice('');
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await signInWithPopup(auth, provider);
        },
        register: async (name, email, password) => {
            await ready;
            setNotice('');
            pendingName.current = name.trim();
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
        },
        logout,
    };
    return _jsx(Ctx.Provider, { value: api, children: children });
}
/* הודעות שגיאה במילים, עם הסבר מה לעשות (אפיון 2.2). מייל או סיסמה שגויים – תמיד אותה הודעה. */
export function authErrorMessage(err) {
    const code = err?.code ?? '';
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
            return 'המייל או הסיסמה שגויים';
        case 'auth/too-many-requests':
            return 'יותר מדי ניסיונות כושלים. החשבון נחסם זמנית – נסה שוב בעוד כמה דקות.';
        case 'auth/email-already-in-use':
            return 'המייל הזה כבר רשום. נסה להיכנס, ואם שכחת את הסיסמה פנה למנהל המוקד.';
        case 'auth/weak-password':
            return 'הסיסמה חלשה מדי. לפחות 8 תווים, אות אחת ומספר אחד.';
        case 'auth/network-request-failed':
            return 'אין חיבור לרשת. בדוק את החיבור ונסה שוב.';
        case 'auth/popup-blocked':
            return 'הדפדפן חסם את חלון Google. אפשר חלונות קופצים לאתר ונסה שוב.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return '';
        case 'auth/account-exists-with-different-credential':
            return 'המייל הזה רשום עם סיסמה. היכנס עם מייל וסיסמה.';
        default:
            return 'משהו השתבש. נסה שוב, ואם זה חוזר פנה למנהל המוקד.';
    }
}
