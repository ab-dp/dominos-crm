/* רכיבי בסיס של מערכת העיצוב (תוכנית בנייה, סעיף 3.8) */
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, CircleAlert, Loader2, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { Health, Issue } from '../rules-engine/health';
import { STATUS_LABEL, type OrderStatus } from '../data/types';
import './components.css';

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'fix';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  kbd?: string;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, kbd, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`btn btn--${variant} btn--${size} ${loading ? 'is-loading' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="btn__spin" size={16} aria-hidden="true" /> : icon}
      {children && <span className="btn__label">{children}</span>}
      {kbd && <kbd className="kbd btn__kbd" aria-hidden="true">{kbd}</kbd>}
    </button>
  );
});

/* ---------- Tooltip ---------- */
export function Tip({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tip" side={side} sideOffset={6} dir="rtl">
          {label}
          <Tooltip.Arrow className="tip__arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* ---------- Health badge: צבע + אייקון + מילה ---------- */
const HEALTH_META: Record<Exclude<Health, 'ok'>, { word: string; Icon: typeof OctagonAlert }> = {
  critical: { word: 'חריגה', Icon: OctagonAlert },
  urgent: { word: 'דחוף', Icon: TriangleAlert },
  missing: { word: 'חסר', Icon: CircleAlert },
};
/* focusable=false: כשהבעיות כבר נקראות בשם הנגיש של השורה – בלי עצירת Tab נוספת */
export function HealthBadge({ health, issues, compact, focusable = true }: { health: Health; issues: Issue[]; compact?: boolean; focusable?: boolean }) {
  if (health === 'ok') return <span className="sr-only">תקינה</span>;
  const { word, Icon } = HEALTH_META[health];
  const badge = (
    <span className={`health health--${health}`} tabIndex={focusable ? 0 : undefined} role="img" aria-label={`${word}: ${issues.map((i) => i.label).join(', ')}`}>
      <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
      {!compact && <span>{word}</span>}
    </span>
  );
  return (
    <Tip label={<ul className="tip__list">{issues.map((i) => <li key={i.rule}>{i.label}</li>)}</ul>}>
      {badge}
    </Tip>
  );
}

/* ---------- Status badge: ניטרלי, עם תפריט לשינוי ---------- */
export function StatusMenu({ status, onChange }: { status: OrderStatus; onChange: (s: OrderStatus) => void }) {
  return (
    <Dropdown.Root dir="rtl">
      <Dropdown.Trigger asChild>
        <button className="status" aria-label={`סטטוס: ${STATUS_LABEL[status]}. לחץ לשינוי`} onClick={(e) => e.stopPropagation()}>
          {STATUS_LABEL[status]}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu" sideOffset={4} align="start" onClick={(e) => e.stopPropagation()}>
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
            <Dropdown.Item key={s} className="menu__item" onSelect={() => s !== status && onChange(s)}>
              <span className="menu__check">{s === status && <Check size={14} />}</span>
              {STATUS_LABEL[s]}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/* ---------- Mark: סניף · Q · תשלום. בוצע = ✓ בעיגול, חסר = עיגול מקווקו ---------- */
export function MarkGlyph({ done, label, drawKey }: { done: boolean; label: string; drawKey?: string | number }) {
  const reduce = useReducedMotion();
  // מצייר את ה-✓ רק כשהסימון משתנה – לא בהופעה הראשונה של השורה (טבלה גדולה = אלפי אנימציות)
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const animate = !reduce && mounted.current;
  return (
    <span className={`mark ${done ? 'mark--done' : 'mark--missing'}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        {done && !animate ? (
          <>
            <circle cx="11" cy="11" r="9.5" className="mark__fill" />
            <path d="M6.6 11.4l3 3 5.8-6.2" className="mark__tick" />
          </>
        ) : done ? (
          <>
            <motion.circle
              key={`c${drawKey}`}
              cx="11" cy="11" r="9.5" className="mark__fill"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              style={{ originX: '50%', originY: '50%' }}
            />
            <motion.path
              key={`p${drawKey}`}
              d="M6.6 11.4l3 3 5.8-6.2" className="mark__tick"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.24, delay: 0.08, ease: [0.2, 0, 0, 1] }}
            />
          </>
        ) : (
          <circle cx="11" cy="11" r="9" className="mark__dash" />
        )}
      </svg>
      <span className="mark__label">{label}</span>
    </span>
  );
}

/* פעולה שנפתחת במקום: לחיצה על הסימון → שדה קטן → Enter → ✓ */
export function MarkAction({
  done, label, srLabel, title, children, onOpenChange, open,
}: {
  done: boolean; label: string; srLabel: string; title: string; children: ReactNode;
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button className="mark-btn" aria-label={srLabel} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <MarkGlyph done={done} label={label} drawKey={String(done)} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pop" aria-label={title} sideOffset={6} align="start" dir="rtl" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <p className="pop__title">{title}</p>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* שדה עם תווית קבועה מעליו (לא placeholder במקום תווית) */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

/* ---------- Rolling number: ספרה שמתגלגלת כשהמונה משתנה ---------- */
export function RollingNumber({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const prev = useRef(value);
  const dir = value < prev.current ? -1 : 1;
  useEffect(() => { prev.current = value; }, [value]);
  return (
    <span className="roll" aria-live="polite">
      <motion.span
        key={value}
        className="roll__digit"
        initial={reduce ? false : { y: dir * -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      >
        {value}
      </motion.span>
    </span>
  );
}

/* ---------- Skeleton / Empty ---------- */
export function Skeleton({ w = '100%', h = 14 }: { w?: number | string; h?: number }) {
  return <span className="skeleton" style={{ width: w, height: h }} aria-hidden="true" />;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">{icon}</span>
      <p className="empty__title">{title}</p>
      {children && <p className="empty__text">{children}</p>}
      {action}
    </div>
  );
}

/* מקלדת: האם הפוקוס בשדה טקסט (קיצורים פועלים רק מחוץ לשדות) */
export function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function useHotkey(key: string, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
      // לפי מיקום המקש, כדי שיעבוד גם כשהמקלדת בעברית
      const code = key === '/' ? 'Slash' : `Key${key.toUpperCase()}`;
      if (e.key.toLowerCase() === key.toLowerCase() || e.code === code) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [key]);
}

export function useToggle(initial = false) {
  const [v, set] = useState(initial);
  return [v, set] as const;
}

/* פרט חובה שחסר בהזמנה – אדום עד שמשלימים */
export function Missing({ children = 'חסר' }: { children?: ReactNode }) {
  return <span className="miss-text">{children}</span>;
}
