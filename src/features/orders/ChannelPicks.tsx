/* ערוץ ההזמנה: האפשרויות הן רק מה שהוגדר ב"הגדרות ← רשימות ← ערוצי קבלה" (פעילים), ולא כל מה שהוקלד אי פעם.
   לחיצה על אפשרות ממלאת אותה; אפשר תמיד להקליד בשדה טקסט חופשי (למשל מספר פניה). */
import { useLists } from '../../data/lists';
import './ChannelPicks.css';

export function useChannelOptions() {
  const { lists } = useLists();
  return (lists?.channels ?? []).filter((x) => x.active).map((x) => x.label);
}

/* keepFocus: בעריכה במקום (כרטיס ההזמנה) – הלחיצה לא מוציאה את הפוקוס מהשדה, כדי שלא יישמר ערך ביניים */
export function ChannelPicks({ value, onPick, keepFocus }: { value: string; onPick: (v: string) => void; keepFocus?: boolean }) {
  const options = useChannelOptions();
  if (!options.length) return null;
  return (
    <span className="chpicks" role="group" aria-label="ערוצים מההגדרות">
      {options.map((o) => (
        <button key={o} type="button" className={`chpick ${value.trim() === o ? 'is-on' : ''}`} aria-pressed={value.trim() === o}
          onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined} onClick={() => onPick(o)}>{o}</button>
      ))}
    </span>
  );
}
