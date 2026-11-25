/* "יש גרסה חדשה": בודקים את public/version.json בחזרה לחלון וכל 5 דקות. גרסה חדשה יותר מזו שנטענה – באנר קבוע
   בראש התוכן עם "רענן". לא חוסם עבודה; שגיאת רשת – מתעלמים בשקט. */
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../design/components';
import { APP_VERSION } from '../lib/version';

const EVERY = 5 * 60000;

function useNewVersion() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => {
      fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { v?: unknown } | null) => { if (alive && typeof d?.v === 'number' && d.v > APP_VERSION) setFresh(true); })
        .catch(() => undefined);
    };
    check();
    const t = setInterval(check, EVERY);
    window.addEventListener('focus', check);
    return () => { alive = false; clearInterval(t); window.removeEventListener('focus', check); };
  }, []);
  return fresh;
}

export function VersionBanner() {
  const fresh = useNewVersion();
  if (!fresh) return null;
  return (
    <div className="version-banner" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <p>יש גרסה חדשה של המערכת – רענן כדי להמשיך לעבוד עם הגרסה העדכנית</p>
      <Button size="sm" variant="primary" onClick={() => location.reload()}>רענן</Button>
    </div>
  );
}
