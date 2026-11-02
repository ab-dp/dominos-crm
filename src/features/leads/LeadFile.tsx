/* תיק ליד (אפיון 19.1): הכל על הלקוח הפוטנציאלי במסך אחד – שלב, צעד הבא, אנשי קשר, פוטנציאל ותיעוד הפעילות.
   מכאן מתעדים, מעבירים שלב, סוגרים כ"לא רלוונטי" או הופכים ללקוח. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ArrowRight, CalendarClock, Check, Mail, MapPin, MessageSquarePlus, MoreHorizontal, Pencil, Phone as PhoneIcon, RotateCcw, Star, Target, UserCheck, UserRound, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useBranches } from '../../data/branches';
import { useLists } from '../../data/lists';
import { useStore } from '../../data/store';
import {
  ACTIVITY_LABEL, OPEN_STAGES, STAGE_LABEL, isOpen, updateLead, useLeadActivity, useLeadHistory, useLeads, type Lead, type LeadStage,
} from '../../data/leads';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { ActivityDialog, ConvertDialog, LostDialog, MoveDialog, ReopenDialog, StepDialog } from './LeadDialogs';
import { LeadForm } from './LeadForm';
import { StagePill, StepLine } from './LeadsPage';
import '../pages.css';
import '../customers/CustomerFile.css';
import './Leads.css';

type Dialogs = { kind: 'activity' | 'convert' | 'lost' | 'reopen' | 'step' | 'edit' } | { kind: 'move'; to: LeadStage } | null;

export function LeadFile() {
  const { id = '' } = useParams();
  const { items, loading } = useLeads();
  const l = items.find((x) => x.id === id);
  if (loading) return <div className="page"><Skeleton h={28} w="40%" /><div style={{ height: 16 }} /><Skeleton h={160} /></div>;
  if (!l) return <div className="page"><div className="card"><EmptyState icon={<Target size={24} />} title="הליד לא נמצא" action={<Link className="btn btn--secondary btn--md" to="/leads"><span className="btn__label">חזרה ללידים</span></Link>} /></div></div>;
  return <FileBody l={l} all={items} />;
}

function FileBody({ l, all }: { l: Lead; all: Lead[] }) {
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const { now } = useStore();
  const { lists } = useLists();
  const { items: branches } = useBranches();
  const activity = useLeadActivity(l.id);
  const [dlg, setDlg] = useState<Dialogs>(null);
  const [tab, setTab] = useState<'activity' | 'history'>('activity');
  const today = toISODate(now);
  const open = isOpen(l);
  const label = (key: 'leadFields' | 'leadSources', id: string) => lists?.[key].find((x) => x.id === id)?.label ?? '';
  const branch = branches.find((b) => b.id === l.branchId);

  // גרירה ל"לקוח פעיל" בלוח מגיעה לכאן עם ?convert=1
  useEffect(() => {
    if (params.get('convert') === '1' && open) { setDlg({ kind: 'convert' }); const p = new URLSearchParams(params); p.delete('convert'); setParams(p, { replace: true }); }
  }, [params, open, setParams]);

  const stageIdx = OPEN_STAGES.indexOf(l.stage);

  return (
    <div className="page cfile lfile">
      <button className="auth__back" onClick={() => nav('/leads')}><ArrowRight size={16} aria-hidden="true" /> לקוחות פוטנציאליים</button>

      <header className="cfile__head card">
        <div className="cfile__title-row">
          <span className="cfile__avatar lfile__avatar" aria-hidden="true">{l.name[0]}</span>
          <div className="cfile__ident">
            <h1 className="page__title">{l.name}</h1>
            <p className="cfile__sub">
              <StagePill stage={l.stage} />
              {label('leadFields', l.field) && <span>{label('leadFields', l.field)}</span>}
              {l.area && <span><MapPin size={13} aria-hidden="true" /> {l.area}</span>}
              {label('leadSources', l.source) && <span>מקור: {label('leadSources', l.source)}</span>}
              <span>מטפל: {l.ownerName}</span>
            </p>
          </div>
          <div className="cfile__actions">
            {open && <Button variant="primary" icon={<MessageSquarePlus size={18} />} onClick={() => setDlg({ kind: 'activity' })}>תיעוד פעילות</Button>}
            {open && <Button icon={<UserCheck size={16} />} onClick={() => setDlg({ kind: 'convert' })}>הפוך ללקוח</Button>}
            {l.stage === 'won' && l.customerId && <Link className="btn btn--primary btn--md" to={`/customers/${l.customerId}`}><UserCheck size={16} aria-hidden="true" /><span className="btn__label">פתח את תיק הלקוח</span></Link>}
            {l.stage === 'lost' && <Button icon={<RotateCcw size={16} />} onClick={() => setDlg({ kind: 'reopen' })}>פתח מחדש</Button>}
            <Button icon={<Pencil size={16} />} onClick={() => setDlg({ kind: 'edit' })}>עריכה</Button>
            <Dropdown.Root dir="rtl">
              <Dropdown.Trigger asChild><button className="icon-btn" aria-label="פעולות נוספות"><MoreHorizontal size={20} /></button></Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content className="menu" align="end" sideOffset={4}>
                  {profile && l.ownerUid !== profile.uid && (
                    <Dropdown.Item className="menu__item" onSelect={async () => { await updateLead(l, { ownerUid: profile.uid, ownerName: profile.name }); toast({ message: `${l.name} עבר לטיפולך` }); }}>
                      <UserRound size={16} aria-hidden="true" /> העבר לטיפולי
                    </Dropdown.Item>
                  )}
                  {open && <Dropdown.Item className="menu__item" onSelect={() => setDlg({ kind: 'lost' })}><XCircle size={16} aria-hidden="true" /> לא רלוונטי</Dropdown.Item>}
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </div>

        {/* שלבים: לחיצה על שלב פותחת מעבר עם צעד הבא */}
        {open && (
          <ol className="lsteps" aria-label="שלב המכירה">
            {OPEN_STAGES.map((s, i) => (
              <li key={s} className={i < stageIdx ? 'is-done' : i === stageIdx ? 'is-now' : ''}>
                <button disabled={s === l.stage} aria-current={s === l.stage ? 'step' : undefined} onClick={() => setDlg({ kind: 'move', to: s })}>
                  {i < stageIdx && <Check size={13} aria-hidden="true" />} {STAGE_LABEL[s]}
                </button>
              </li>
            ))}
            <li className="lsteps__end"><button onClick={() => setDlg({ kind: 'convert' })}><UserCheck size={13} aria-hidden="true" /> לקוח פעיל</button></li>
          </ol>
        )}

        {open && l.nextStep && (
          <div className={`lnext ${l.nextStep.due < today ? 'is-late' : ''}`}>
            <CalendarClock size={18} aria-hidden="true" />
            <div><span className="kpi__label">צעד הבא</span><StepLine lead={l} today={today} /></div>
            <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'step' })}>שנה</Button>
          </div>
        )}
        {l.stage === 'lost' && <div className="cfile__banner" role="note"><b>לא רלוונטי:</b> {l.lostReason}{l.lostNote && <> · {l.lostNote}</>}</div>}
      </header>

      <div className="lfile__grid">
        <aside className="card lfile__facts">
          <div className="card__head"><h2 className="card__title">פרטים</h2></div>
          <div className="card__body">
            <dl className="lfacts">
              <div><dt>פוטנציאל</dt><dd>{l.potentialAmount ? <><Ltr>{fmtMoney(l.potentialAmount)}</Ltr> בחודש</> : '—'}{l.potentialOrders ? <> · <Ltr>{l.potentialOrders}</Ltr> הזמנות</> : null}</dd></div>
              <div><dt>עובדים</dt><dd>{l.size ? <Ltr>{l.size}</Ltr> : '—'}</dd></div>
              <div><dt>סניף קרוב</dt><dd>{branch?.name ?? '—'}</dd></div>
              <div><dt>ח.פ</dt><dd>{l.taxId ? <Ltr>{l.taxId}</Ltr> : '—'}</dd></div>
              {l.tags.length > 0 && <div><dt>תגיות</dt><dd className="lfacts__tags">{l.tags.map((t) => <span key={t} className="tag">{t}</span>)}</dd></div>}
              {l.notes && <div><dt>הערות</dt><dd>{l.notes}</dd></div>}
            </dl>
            <h3 className="lfile__h3">אנשי קשר</h3>
            <ul className="lcontacts">
              {l.contacts.length === 0 && <li className="muted">אין אנשי קשר</li>}
              {l.contacts.map((c) => (
                <li key={c.id}>
                  <span className="lcontacts__name">{c.name}{c.decider && <span className="lcontacts__dec"><Star size={12} aria-hidden="true" /> מקבל החלטות</span>}</span>
                  {c.role && <span className="muted">{c.role}</span>}
                  <span className="lcontacts__links">
                    {c.phone && <a className="fact__link" href={`tel:${c.phone}`}><PhoneIcon size={14} aria-hidden="true" /> <Ltr>{fmtPhone(c.phone)}</Ltr></a>}
                    {c.email && <a className="fact__link" href={`mailto:${c.email}`}><Mail size={14} aria-hidden="true" /> <bdi dir="ltr">{c.email}</bdi></a>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="card">
          <nav className="tabs lfile__tabs" role="tablist" aria-label="תיק ליד">
            <button role="tab" aria-selected={tab === 'activity'} className={`tab ${tab === 'activity' ? 'is-on' : ''}`} onClick={() => setTab('activity')}>פעילות <span className="tab__count"><Ltr>{activity.length}</Ltr></span></button>
            <button role="tab" aria-selected={tab === 'history'} className={`tab ${tab === 'history' ? 'is-on' : ''}`} onClick={() => setTab('history')}>היסטוריה</button>
          </nav>
          <div role="tabpanel">
            {tab === 'activity' ? (
              <ol className="timeline cfile__timeline">
                {activity.length === 0 && <li className="muted">עוד אין פעילות. כל שיחה, הודעה או פגישה נרשמת כאן – עם הצעד הבא.</li>}
                {activity.map((a) => (
                  <li key={a.id}>
                    <span className="timeline__at"><Ltr>{a.at ? fmtTs(a.at.toDate()) : '…'}</Ltr></span>
                    <span>
                      <span className={`akind lkind lkind--${a.kind}`}>{ACTIVITY_LABEL[a.kind]}</span> <b>{a.byName}</b><br />
                      {a.text}
                      {a.asked && <span className="hist__change">ביקשו: {a.asked}</span>}
                      {a.objections && <span className="hist__change">התנגדויות: {a.objections}</span>}
                      {a.outcome && <span className="hist__change">תוצאה: {a.outcome}</span>}
                      {a.nextStep && <span className="hist__change muted">צעד הבא: {a.nextStep.text} · <Ltr>{fmtDate(a.nextStep.due)}</Ltr></span>}
                    </span>
                  </li>
                ))}
              </ol>
            ) : <History l={l} />}
          </div>
        </section>
      </div>

      {dlg?.kind === 'activity' && <ActivityDialog lead={l} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'convert' && <ConvertDialog lead={l} activity={activity} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'lost' && <LostDialog lead={l} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'reopen' && <ReopenDialog lead={l} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'step' && <StepDialog lead={l} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'move' && <MoveDialog lead={l} to={dlg.to} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'edit' && <LeadForm onClose={() => setDlg(null)} leads={all} editing={l} />}
    </div>
  );
}

/* ---------- היסטוריה: מהיומן שאי אפשר לערוך ---------- */
const FIELD_LABEL: Record<string, string> = {
  name: 'שם', taxId: 'ח.פ', field: 'תחום', size: 'עובדים', area: 'אזור', branchId: 'סניף קרוב', source: 'מקור', contacts: 'אנשי קשר',
  potentialOrders: 'הזמנות בחודש', potentialAmount: '₪ בחודש', tags: 'תגיות', notes: 'הערות', stage: 'שלב', nextStep: 'צעד הבא', ownerName: 'מטפל', lostReason: 'סיבה',
};
const ACTION: Record<string, string> = { create: 'הליד נוצר', update: 'עדכון', stage: 'מעבר שלב', activity: 'תיעוד פעילות', convert: 'הפך ללקוח' };
function History({ l }: { l: Lead }) {
  const rows = useLeadHistory(l.id);
  const show = (k: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (k === 'stage') return STAGE_LABEL[v as LeadStage] ?? String(v);
    if (k === 'nextStep' && typeof v === 'object') { const s = v as { text: string; due: string }; return `${s.text} (${fmtDate(s.due)})`; }
    if (Array.isArray(v)) return `${v.length} פריטים`;
    return String(v);
  };
  return (
    <ol className="timeline cfile__timeline">
      {rows.length === 0 && <li className="muted">אין עדיין שינויים.</li>}
      {rows.map((r) => (
        <li key={r.id}>
          <span className="timeline__at"><Ltr>{r.at ? fmtTs(r.at.toDate()) : '…'}</Ltr></span>
          <span>
            <b>{r.byName}</b> · {ACTION[r.action] ?? r.action}
            {r.action !== 'create' && r.after && Object.keys(r.after).filter((k) => FIELD_LABEL[k]).map((k) => (
              <span key={k} className="hist__change">{FIELD_LABEL[k]}: <span className="muted">{show(k, r.before?.[k])}</span> ← {show(k, r.after?.[k])}</span>
            ))}
            {r.after && 'customerName' in r.after && <span className="hist__change">נוצר הלקוח "{String(r.after.customerName)}"</span>}
            {r.note && <span className="hist__change muted">הערה: {r.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function fmtTs(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}
