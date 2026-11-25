/* סרגל סינון משותף: כפתור "סינון" שפותח בחירה לכל ממד, צ'יפ לכל סינון פעיל עם ✕, ו"נקה הכל".
   מה שמעבר לסינון (חיפוש, טווח, צפיפות) נכנס כ-children ומוצג באותה שורה. */
import { useRef, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Filter, X } from 'lucide-react';
import { Button } from './components';
import { Ltr } from '../lib/format';
import './FilterBar.css';

export type FilterDim = { key: string; label: string; all: string; options: { value: string; label: string }[]; clears?: string[] };

export function FilterBar({ dims, values, onChange, title = 'סינון', extraActive = 0, alsoClear = [], onClearAll, children }: {
  dims: FilterDim[];
  values: Record<string, string | undefined>;
  onChange: (patch: Record<string, string | null>) => void;
  title?: string;
  /* סינונים פעילים שלא בממדים (למשל חיפוש לקוח) – נספרים ב"נקה הכל" */
  extraActive?: number;
  /* מפתחות נוספים בכתובת ש"נקה הכל" מנקה (למשל צ'יפ סינון מהיר) – באותו עדכון, כדי שלא ידרסו זה את זה */
  alsoClear?: string[];
  onClearAll?: () => void;
  children?: ReactNode;
}) {
  const active = dims.filter((d) => values[d.key]);
  /* אחרי הסרת צ'יפ או ניקוי – הפוקוס חוזר לכפתור "סינון", כדי שמשתמש מקלדת לא יאבד את המקום */
  const trigger = useRef<HTMLButtonElement>(null);
  const refocus = () => requestAnimationFrame(() => trigger.current?.focus());
  const clearAll = () => { onChange(Object.fromEntries([...dims.map((d) => d.key), ...alsoClear].map((k) => [k, null]))); onClearAll?.(); refocus(); };
  const pick = (d: FilterDim, v: string) => onChange({ [d.key]: v || null, ...Object.fromEntries((d.clears ?? []).map((k) => [k, null])) });
  return (
    <div className="fbar">
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button ref={trigger} variant="secondary" size="sm" icon={<Filter size={16} />} aria-label={active.length ? `${title}, ${active.length} פעילים` : title}>
            {title}{active.length > 0 && <span className="fbar__count"><Ltr>{active.length}</Ltr></span>}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="pop fbar__pop" align="start" sideOffset={6} dir="rtl" aria-label={title}>
            {dims.map((d) => (
              <label key={d.key} className="field">
                <span className="field__label">{d.label}</span>
                <select className="input" value={values[d.key] ?? ''} onChange={(e) => pick(d, e.target.value)}>
                  <option value="">{d.all}</option>
                  {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
            {active.length > 0 && <button type="button" className="link fbar__clear" onClick={clearAll}>נקה את כל הסינון</button>}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {active.map((d) => {
        const text = d.options.find((o) => o.value === values[d.key])?.label ?? values[d.key];
        return (
        <button key={d.key} type="button" className="chip is-on fbar__chip" onClick={() => { pick(d, ''); refocus(); }} aria-label={`הסר סינון ${d.label}: ${text}`}>
          <span className="fbar__k">{d.label}:</span> {text}
          <X size={14} aria-hidden="true" />
        </button>
        );
      })}
      {active.length + extraActive > 1 && <button type="button" className="link fbar__clear" onClick={clearAll}>נקה הכל</button>}
      {children}
    </div>
  );
}
