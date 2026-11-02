/* לקוחות פוטנציאליים (אפיון 19.1): שלוש תצוגות של אותם לידים –
   לוח כרטיסים בגרירה בין השלבים, טבלה עם סינונים, ו"המשימות שלי היום". כל כרטיס מראה את הצעד הבא ומתי. */
import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { CalendarClock, ChevronDown, CircleCheckBig, Kanban, ListChecks, Plus, Search, Table2, Target, UserCheck, X, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useLists } from '../../data/lists';
import { useStore } from '../../data/store';
import { OPEN_STAGES, STAGES, STAGE_LABEL, deciderOf, isOpen, useLeads, type Lead, type LeadStage } from '../../data/leads';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { usePref } from '../../lib/prefs';
import { ActivityDialog, LostDialog, MoveDialog } from './LeadDialogs';
import { LeadForm } from './LeadForm';
import '../pages.css';
import '../exceptions/ExceptionsPage.css';
import '../customers/CustomerFile.css';
import './Leads.css';

type View = 'board' | 'table' | 'today';
type Pending = { lead: Lead; to: LeadStage } | null;

export function LeadsPage() {
  const { items, loading, error } = useLeads();
  const { now } = useStore();
  const { profile } = useAuth();
  const nav = useNavigate();
  const [view, setView] = usePref<View>('leadsView', 'board');
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<Pending>(null);
  const today = toISODate(now);
  const monthStart = today.slice(0, 8) + '01';

  const open = items.filter(isOpen);
  const due = open.filter((l) => l.nextStep && l.nextStep.due <= today);
  const wonThisMonth = items.filter((l) => l.stage === 'won' && l.stageAt && toISODate(l.stageAt.toDate()) >= monthStart);
  const potential = open.reduce((t, l) => t + (l.potentialAmount || 0), 0);

  /* גרירה ל"לקוח פעיל" פותחת את תיק הליד עם חלון ההפיכה; ל"לא רלוונטי" – חלון סיבה; לשלב פתוח – צעד הבא */
  const requestMove = (lead: Lead, to: LeadStage) => {
    if (to === lead.stage) return;
    if (to === 'won') { nav(`/leads/${lead.id}?convert=1`); return; }
    setMoving({ lead, to });
  };

  return (
    <div className="page leads">
      <header className="page__head">
        <div>
          <h1 className="page__title">לקוחות פוטנציאליים</h1>
          <p className="page__sub">עסקים שאנחנו רוצים לצרף. לכל ליד פתוח יש צעד הבא עם תאריך – והוא מופיע במשימות.</p>
        </div>
        <dl className="head-stats">
          <div><dt>לידים פתוחים</dt><dd><Ltr>{open.length}</Ltr></dd></div>
          <div className={due.length ? 'is-alert' : ''}><dt>צעדים להיום</dt><dd><Ltr>{due.length}</Ltr></dd></div>
          <div><dt>פוטנציאל בחודש</dt><dd><Ltr>{fmtMoney(potential)}</Ltr></dd></div>
          <div><dt>הפכו ללקוח החודש</dt><dd><Ltr>{wonThisMonth.length}</Ltr></dd></div>
        </dl>
      </header>

      <div className="tablebar">
        <div className="seg" role="group" aria-label="תצוגה">
          <button className={view === 'board' ? 'is-on' : ''} aria-pressed={view === 'board'} onClick={() => setView('board')}><Kanban size={15} aria-hidden="true" /> לוח</button>
          <button className={view === 'table' ? 'is-on' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={15} aria-hidden="true" /> טבלה</button>
          <button className={view === 'today' ? 'is-on' : ''} aria-pressed={view === 'today'} onClick={() => setView('today')}><ListChecks size={15} aria-hidden="true" /> המשימות שלי היום</button>
        </div>
        <div className="page__head-end">
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>ליד חדש</Button>
        </div>
      </div>

      {error ? <div className="card"><EmptyState icon={<Target size={24} />} title="לא ניתן לטעון לידים">{error}. ודא שכללי האבטחה פורסמו.</EmptyState></div>
        : loading ? <div className="card loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}</div>
        : items.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Target size={24} />} title="עוד אין לידים" action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>ליד חדש</Button>}>
              כל עסק שאנחנו רוצים לצרף נכנס כאן: מי איש הקשר, מה הפוטנציאל, ומה הצעד הבא.
            </EmptyState>
          </div>
        )
        : view === 'board' ? <Board leads={open} today={today} onMove={requestMove} onOpen={(l) => nav(`/leads/${l.id}`)} />
        : view === 'table' ? <LeadTable leads={items} today={today} onOpen={(l) => nav(`/leads/${l.id}`)} />
        : <TodayList leads={open} today={today} meUid={profile?.uid ?? ''} onOpen={(l) => nav(`/leads/${l.id}`)} />}

      {adding && <LeadForm onClose={() => setAdding(false)} leads={items} />}
      {moving && moving.to === 'lost' && <LostDialog lead={moving.lead} onClose={() => setMoving(null)} />}
      {moving && moving.to !== 'lost' && <MoveDialog lead={moving.lead} to={moving.to} onClose={() => setMoving(null)} />}
    </div>
  );
}

/* ---------- צעד הבא – טקסט ותאריך, אדום כשבאיחור ---------- */
export function StepLine({ lead, today }: { lead: Lead; today: string }) {
  const s = lead.nextStep;
  if (!s) return <span className="muted">—</span>;
  const tone = s.due < today ? 'late' : s.due === today ? 'today' : 'later';
  const when = s.due < today ? <>באיחור · <Ltr>{fmtDate(s.due)}</Ltr></> : s.due === today ? 'היום' : <Ltr>{fmtDate(s.due)}</Ltr>;
  return (
    <span className={`lstepline lstepline--${tone}`}>
      <CalendarClock size={13} aria-hidden="true" />
      <span className="lstepline__text">{s.text}</span>
      <span className="lstepline__when">{when}</span>
    </span>
  );
}

/* ---------- לוח ---------- */
function Board({ leads, today, onMove, onOpen }: { leads: Lead[]; today: string; onMove: (l: Lead, to: LeadStage) => void; onOpen: (l: Lead) => void }) {
  const { lists } = useLists();
  const [over, setOver] = useState<LeadStage | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const fieldLabel = (id: string) => lists?.leadFields.find((x) => x.id === id)?.label ?? '';
  const drop = (to: LeadStage) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const l = leads.find((x) => x.id === (e.dataTransfer.getData('text/lead') || dragId));
    setDragId(null);
    if (l) onMove(l, to);
  };
  const zone = (to: LeadStage) => ({
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== to) setOver(to); },
    onDragLeave: (e: DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(null); },
    onDrop: drop(to),
  });
  return (
    <div className={`lboard ${dragId ? 'is-dragging' : ''}`}>
      {OPEN_STAGES.map((st) => {
        const list = leads.filter((l) => l.stage === st).sort((a, b) => (a.nextStep?.due ?? '9').localeCompare(b.nextStep?.due ?? '9'));
        const sum = list.reduce((t, l) => t + (l.potentialAmount || 0), 0);
        return (
          <section key={st} className={`lcol ${over === st ? 'is-over' : ''}`} aria-labelledby={`lcol-${st}`} {...zone(st)}>
            <header className="lcol__head">
              <h2 id={`lcol-${st}`} className="lcol__title">{STAGE_LABEL[st]}</h2>
              <span className="lcol__n"><Ltr>{list.length}</Ltr></span>
              {sum > 0 && <span className="lcol__sum"><Ltr>{fmtMoney(sum)}</Ltr></span>}
            </header>
            <ul className="lcol__list">
              {list.map((l) => (
                <li key={l.id}>
                  <article className={`lcard ${dragId === l.id ? 'is-drag' : ''}`} draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/lead', l.id); e.dataTransfer.effectAllowed = 'move'; setDragId(l.id); }}
                    onDragEnd={() => { setDragId(null); setOver(null); }}>
                    <button className="lcard__main" onClick={() => onOpen(l)} aria-label={`${l.name}, ${STAGE_LABEL[l.stage]}${l.nextStep ? `, צעד הבא: ${l.nextStep.text}` : ''}`}>
                      <span className="lcard__name">{l.name}</span>
                      <span className="lcard__meta">
                        {[fieldLabel(l.field), deciderOf(l)?.name].filter(Boolean).join(' · ')}
                        {l.potentialAmount > 0 && <> · <Ltr>{fmtMoney(l.potentialAmount)}</Ltr> בחודש</>}
                      </span>
                      <StepLine lead={l} today={today} />
                    </button>
                    <StageMenu lead={l} onMove={onMove} />
                  </article>
                </li>
              ))}
              {list.length === 0 && <li className="lcol__empty">אפשר לגרור לכאן</li>}
            </ul>
          </section>
        );
      })}
      <div className="lboard__ends">
        <div className={`lend lend--won ${over === 'won' ? 'is-over' : ''}`} {...zone('won')}><UserCheck size={18} aria-hidden="true" /> לקוח פעיל<small>גרירה לכאן פותחת "הפיכה ללקוח"</small></div>
        <div className={`lend lend--lost ${over === 'lost' ? 'is-over' : ''}`} {...zone('lost')}><XCircle size={18} aria-hidden="true" /> לא רלוונטי<small>עם סיבה</small></div>
      </div>
    </div>
  );
}

/* העברת שלב בלי עכבר: כפתור בכל כרטיס */
function StageMenu({ lead, onMove }: { lead: Lead; onMove: (l: Lead, to: LeadStage) => void }) {
  return (
    <Dropdown.Root dir="rtl">
      <Dropdown.Trigger asChild>
        <button className="icon-btn lcard__menu" aria-label={`העבר שלב: ${lead.name}`}><ChevronDown size={16} /></button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu" align="end" sideOffset={4}>
          <Dropdown.Label className="menu__label">העבר ל…</Dropdown.Label>
          {STAGES.filter((s) => s.id !== lead.stage).map((s) => (
            <Dropdown.Item key={s.id} className="menu__item" onSelect={() => onMove(lead, s.id)}>{s.label}</Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/* ---------- טבלה עם סינונים ---------- */
function LeadTable({ leads, today, onOpen }: { leads: Lead[]; today: string; onOpen: (l: Lead) => void }) {
  const { lists } = useLists();
  const [stage, setStage] = useState<'open' | LeadStage | 'all'>('open');
  const [field, setField] = useState('');
  const [source, setSource] = useState('');
  const [area, setArea] = useState('');
  const [late, setLate] = useState(false);
  const [q, setQ] = useState('');
  const label = (key: 'leadFields' | 'leadSources', id: string) => lists?.[key].find((x) => x.id === id)?.label ?? '';
  const areas = useMemo(() => [...new Set(leads.map((l) => l.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')), [leads]);
  const s = q.trim();
  const digits = s.replace(/\D/g, '');
  const rows = leads
    .filter((l) => stage === 'all' || (stage === 'open' ? isOpen(l) : l.stage === stage))
    .filter((l) => !field || l.field === field)
    .filter((l) => !source || l.source === source)
    .filter((l) => !area || l.area === area)
    .filter((l) => !late || (isOpen(l) && !!l.nextStep && l.nextStep.due < today))
    .filter((l) => !s || l.name.includes(s) || l.tags.some((t) => t.includes(s)) || l.contacts.some((c) => c.name.includes(s) || (digits.length >= 3 && c.phone.includes(digits))))
    .sort((a, b) => (a.nextStep?.due ?? '9').localeCompare(b.nextStep?.due ?? '9'));
  const lateCount = leads.filter((l) => isOpen(l) && l.nextStep && l.nextStep.due < today).length;
  const filtered = !!(field || source || area || late || s || stage !== 'open');

  return (
    <>
      <div className="tablebar">
        <select className="input input--sm" value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} aria-label="שלב">
          <option value="open">כל הפתוחים</option>
          {STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          <option value="all">הכל</option>
        </select>
        <select className="input input--sm" value={field} onChange={(e) => setField(e.target.value)} aria-label="תחום">
          <option value="">כל התחומים</option>
          {(lists?.leadFields ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <select className="input input--sm" value={area} onChange={(e) => setArea(e.target.value)} aria-label="אזור">
          <option value="">כל האזורים</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="input input--sm" value={source} onChange={(e) => setSource(e.target.value)} aria-label="מקור">
          <option value="">כל המקורות</option>
          {(lists?.leadSources ?? []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <button className={`chip ${late ? 'is-on' : ''}`} aria-pressed={late} onClick={() => setLate(!late)}>צעד הבא באיחור <Ltr>{lateCount}</Ltr></button>
        {filtered && <button className="link" onClick={() => { setStage('open'); setField(''); setSource(''); setArea(''); setLate(false); setQ(''); }}>ניקוי סינון</button>}
        <label className="tablebar__search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="שם, איש קשר, טלפון או תגית" aria-label="חיפוש ליד" />
          {q && <button onClick={() => setQ('')} aria-label="נקה חיפוש"><X size={14} /></button>}
        </label>
      </div>
      {rows.length === 0 ? <div className="card"><EmptyState icon={<Target size={24} />} title="אין לידים בתצוגה הזו" /></div> : (
        <div className="otable-wrap">
          <table className="otable otable--dense ltable">
            <caption className="sr-only">לקוחות פוטנציאליים</caption>
            <thead><tr><th>שם</th><th>שלב</th><th>תחום</th><th>אזור</th><th>מקור</th><th>איש קשר</th><th className="num">פוטנציאל בחודש</th><th>צעד הבא</th><th>מטפל</th></tr></thead>
            <tbody>
              {rows.map((l) => {
                const d = deciderOf(l);
                return (
                  <tr key={l.id} className="orow" tabIndex={0} onClick={() => onOpen(l)} aria-label={`${l.name}, ${STAGE_LABEL[l.stage]}. Enter לפתיחה`}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter') { e.preventDefault(); onOpen(l); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
                    }}>
                    <td className="strong">{l.name}</td>
                    <td><StagePill stage={l.stage} /></td>
                    <td>{label('leadFields', l.field) || <span className="muted">—</span>}</td>
                    <td>{l.area || <span className="muted">—</span>}</td>
                    <td>{label('leadSources', l.source) || <span className="muted">—</span>}</td>
                    <td>{d ? <>{d.name}{d.phone && <span className="muted"> · <Ltr>{fmtPhone(d.phone)}</Ltr></span>}</> : <span className="muted">—</span>}</td>
                    <td className="num">{l.potentialAmount ? <Ltr>{fmtMoney(l.potentialAmount)}</Ltr> : <span className="muted">—</span>}</td>
                    <td className="c-step">{isOpen(l) ? <StepLine lead={l} today={today} /> : l.stage === 'lost' ? <span className="muted">{l.lostReason}</span> : <span className="muted">הפך ללקוח</span>}</td>
                    <td>{l.ownerName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function StagePill({ stage }: { stage: LeadStage }) {
  return <span className={`lpill lpill--${stage}`}>{STAGE_LABEL[stage]}</span>;
}

/* ---------- המשימות שלי היום ---------- */
function TodayList({ leads, today, meUid, onOpen }: { leads: Lead[]; today: string; meUid: string; onOpen: (l: Lead) => void }) {
  const [mine, setMine] = usePref('leadsMine', true);
  const [logging, setLogging] = useState<Lead | null>(null);
  const list = leads.filter((l) => !mine || l.ownerUid === meUid).filter((l) => l.nextStep && l.nextStep.due <= today)
    .sort((a, b) => a.nextStep!.due.localeCompare(b.nextStep!.due));
  const late = list.filter((l) => l.nextStep!.due < today);
  const now = list.filter((l) => l.nextStep!.due === today);
  const group = (title: string, tone: string, xs: Lead[]): ReactNode => xs.length > 0 && (
    <div className="exc__group">
      <p className={`exc__label exc__label--${tone}`}>{title} <Ltr>{xs.length}</Ltr></p>
      <ul className="ltoday">
        {xs.map((l) => {
          const d = deciderOf(l);
          return (
            <li key={l.id} className="ltoday__row">
              <button className="ltoday__main" onClick={() => onOpen(l)}>
                <span className="ltoday__step">{l.nextStep!.text}</span>
                <span className="ltoday__meta"><b>{l.name}</b> · <StagePill stage={l.stage} />{d && <> · {d.name}</>}{l.nextStep!.due < today && <> · מאז <Ltr>{fmtDate(l.nextStep!.due)}</Ltr></>}</span>
              </button>
              {d?.phone && <a className="btn btn--ghost btn--sm" href={`tel:${d.phone}`}><span className="btn__label"><Ltr>{fmtPhone(d.phone)}</Ltr></span></a>}
              <Button size="sm" variant="fix" onClick={() => setLogging(l)}>תיעוד וצעד הבא</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <section className="card" aria-labelledby="h-ltoday">
      <div className="card__head">
        <h2 id="h-ltoday" className="card__title">צעדים להיום</h2>
        <div className="seg seg--inline" role="group" aria-label="של מי">
          <button className={mine ? 'is-on' : ''} aria-pressed={mine} onClick={() => setMine(true)}>שלי</button>
          <button className={!mine ? 'is-on' : ''} aria-pressed={!mine} onClick={() => setMine(false)}>כולם</button>
        </div>
      </div>
      <div className="card__body">
        {list.length === 0 ? <p className="calm"><CircleCheckBig size={18} aria-hidden="true" /> אין צעדים להיום. כל הלידים מתוזמנים לימים הבאים</p> : <>
          {group('באיחור', 'red', late)}
          {group('היום', 'brand', now)}
        </>}
      </div>
      {logging && <ActivityDialog lead={logging} onClose={() => setLogging(null)} />}
    </section>
  );
}
