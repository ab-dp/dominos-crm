/* ניתוק אחרי 60 דקות בלי פעילות, עם אזהרה 2 דקות מראש וכפתור "המשך מחובר" (אפיון 11, תיקון 4). */
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Clock } from 'lucide-react';
import { Button } from '../design/components';
import { useAuth } from './AuthContext';

const LIMIT = 60 * 60 * 1000;
const WARN = 2 * 60 * 1000;

export function InactivityGuard() {
  const { logout } = useAuth();
  const last = useRef(Date.now());
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const bump = () => { if (left === null) last.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= LIMIT) logout('נותקת אחרי 60 דקות בלי פעילות. היכנס שוב כדי להמשיך.');
      else if (idle >= LIMIT - WARN) setLeft(LIMIT - idle);
      else setLeft(null);
    }, 1000);
    return () => { events.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [left, logout]);

  const stay = () => { last.current = Date.now(); setLeft(null); };
  if (left === null) return null;
  const s = Math.ceil(left / 1000);

  return (
    <Dialog.Root open onOpenChange={(o) => !o && stay()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog" dir="rtl" aria-describedby="idle-desc" role="alertdialog">
          <Dialog.Title className="udialog__title"><Clock size={16} aria-hidden="true" style={{ verticalAlign: -3 }} /> עדיין כאן?</Dialog.Title>
          <p id="idle-desc" className="muted">
            לא הייתה פעילות כמעט שעה. תנותק בעוד <bdi dir="ltr" className="ltr"><b>{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</b></bdi> כדי להגן על המערכת בעמדה המשותפת.
          </p>
          <div className="udialog__actions">
            <Button variant="primary" autoFocus onClick={stay}>המשך מחובר</Button>
            <Button variant="ghost" onClick={() => logout()}>התנתק עכשיו</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
