/* שלב 0: עמוד תשתית. מוודא שהאתר עלה ושהחיבור ל-Firebase עובד.
   יוחלף במסך הכניסה בשלב 2. */
import { useEffect, useState, type ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { DominoTile } from './components/DominoTile';
import './App.css';

type CheckState = 'pending' | 'ok' | 'fail';

// המסד נעול לגמרי בשלב הזה, ולכן "אין הרשאה" היא התשובה הנכונה:
// היא מוכיחה שהדפדפן הגיע ל-Firestore של הפרויקט ושהכללים חוסמים.
async function checkFirestoreLocked(): Promise<CheckState> {
  const timeout = new Promise<CheckState>((resolve) => setTimeout(() => resolve('fail'), 8000));
  const probe = getDoc(doc(db, '_health', 'ping'))
    .then((): CheckState => 'fail')
    .catch((err: { code?: string }) => (err.code === 'permission-denied' ? 'ok' : 'fail'));
  return Promise.race([probe, timeout]);
}

export function App() {
  const [firestore, setFirestore] = useState<CheckState>('pending');

  useEffect(() => {
    checkFirestoreLocked().then(setFirestore);
  }, []);

  // מונחים לועזיים עטופים ב-<bdi> כדי שלא יתהפכו בתוך שורה עברית
  const checks: { label: ReactNode; state: CheckState; detail: ReactNode }[] = [
    { label: 'האתר עלה', state: 'ok', detail: <>פריסה אוטומטית ל-<bdi>GitHub Pages</bdi> בכל עדכון</> },
    { label: <>מחובר ל-<bdi>Firebase</bdi></>, state: firestore, detail: <>פרויקט <bdi>dominos-crm</bdi></> },
    { label: 'מסד הנתונים נעול', state: firestore, detail: <>כל גישה חסומה עד שלב 2</> },
  ];

  return (
    <div className="stage0">
      <section className="stage0__brand" aria-hidden="true">
        <DominoTile size={168} animate />
        <p className="stage0__brand-title">מערכת CRM</p>
        <p className="stage0__brand-sub">לקוחות עסקיים והזמנות</p>
      </section>

      <main className="stage0__panel">
        <div className="stage0__card">
          <p className="stage0__eyebrow">שלב 0 · תשתית</p>
          <h1 className="stage0__title">המערכת בבנייה</h1>
          <p className="stage0__lead">מסך הכניסה, ההרשמה ואישור המנהל ייבנו בשלב 2.</p>

          <ul className="checks" aria-live="polite">
            {checks.map((c, i) => (
              <li key={i} className={`check check--${c.state}`}>
                <span className="check__icon" aria-hidden="true">
                  {c.state === 'ok' ? '✓' : c.state === 'fail' ? '!' : ''}
                </span>
                <span className="check__text">
                  <span className="check__label">{c.label}</span>
                  <span className="check__detail">
                    {c.state === 'pending' ? 'בודק…' : c.state === 'fail' ? 'לא הצליח – בדוק חיבור לרשת' : c.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
