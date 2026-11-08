/* תיק הזמנה בפאנל צדדי (אפיון 6.3): קודם "להעברה לקופה" – כל מה שצריך כדי להוריד את ההזמנה ל-Q, ושורת Q.
   מתחת: ציר ההזמנה, ושאר הפרטים בלשוניות (פרטים נוספים · תשלום ומסמכים · הערות · היסטוריה). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Maximize2, Minimize2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { HealthBadge, Missing, Tip } from '../../design/components';
import { Ltr, Money, fmtDate, fmtMoney, fmtPhone, toISODate } from '../../lib/format';
import { METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';

import { useOrderDoc, useOrderHistory, useOrderViewers, type OrderAuditRow } from '../../data/orders';
import { healthOf, issuesFor } from '../../rules-engine/health';
import { FixButton, PoEdit } from './OrderActions';
import { OrderTimeline } from './OrderTimeline';
import { RegisterBlock } from './OrderRegister';
import { DeleteOrder, HandlerEdit } from './AdminOrderActions';

// פעולות שהן חלק מציר ההזמנה – מופיעות בציר, לא ברשימת הבעיות
const STEP_ACTIONS = ['q', 'branch', 'status', 'close', 'ops'];
import { OrderDocsSection } from './OrderDocs';
import { EditKv, NotesSection, useOrderSave } from './OrderEdit';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import './OrderPanel.css';

type Tab = 'more' | 'pay' | 'notes' | 'history';
const TABS: [Tab, string][] = [['more', 'פרטים נוספים'], ['pay', 'תשלום ומסמכים'], ['notes', 'הערות'], ['history', 'היסטוריה']];

export function OrderPanel() {
  const panel = usePanel();
  const { orders, now, thresholds } = useStore();
  const reduce = useReducedMotion();
  const [full, setFull] = useState(false);
  const listed = orders.find((x) => x.id === panel.openId);
  // הזמנה ישנה שלא ברשימה החיה – נטענת ישירות
  const single = useOrderDoc(listed || panel.openId == null ? null : panel.openId);
  const o = useMemo(() => {
    if (listed) return listed;
    if (!single) return undefined;
    const issues = issuesFor(single, now, thresholds);
    return { ...single, issues, health: healthOf(issues) };
  }, [listed, single, now, thresholds]);
  // השורה או הכפתור שפתחו את התיק – הפוקוס חוזר אליהם בסגירה
  const opener = useRef<HTMLElement | null>(null);
  if (o && !opener.current) opener.current = document.activeElement as HTMLElement | null;
  const restoreFocus = (e: Event) => {
    e.preventDefault();
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected && el !== document.body) el.focus();
  };

  return (
    <Dialog.Root open={!!o} onOpenChange={(v) => !v && panel.close()}>
      <AnimatePresence>
        {o && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount dir="rtl" aria-describedby={undefined} aria-labelledby="panel-title" onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast} onEscapeKeyDown={(e) => { if ((document.activeElement as HTMLElement | null)?.closest('.ib-table, .pgs')) e.preventDefault(); }}
              onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById('panel-title')?.focus(); }}
              onCloseAutoFocus={restoreFocus}>
              <motion.div
                className={`panel ${full ? 'panel--full' : ''}`}
                initial={reduce ? { opacity: 0 } : { x: '-100%' }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: '-100%' }}
                transition={{ type: 'tween', duration: 0.24, ease: [0.2, 0, 0, 1] }}
              >
                <PanelBody o={o} full={full} setFull={setFull} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function PanelBody({ o, full, setFull }: { o: OrderView; full: boolean; setFull: (f: boolean) => void }) {
  const save = useOrderSave(o);
  /* שינוי של משתמש אחר בזמן שהתיק פתוח: הודעה מה השתנה ועל ידי מי */
  const { profile } = useAuth();
  const prev = useRef(o);
  const viewers = useOrderViewers(o.id);
  const [remoteNote, setRemoteNote] = useState<{ by: string; fields: string[] } | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = o;
    if (p.id !== o.id) { setRemoteNote(null); return; }
    if (o.updatedAt?.seconds === p.updatedAt?.seconds || !o.updatedBy || o.updatedBy === profile?.uid) return;
    const fields = [...new Set(Object.keys(FIELD).filter((k) => JSON.stringify(p[k as keyof OrderView]) !== JSON.stringify(o[k as keyof OrderView])).map((k) => FIELD[k]))];
    if (fields.length) setRemoteNote({ by: o.updatedByName || 'משתמש אחר', fields });
  }, [o, profile?.uid]);
  const panel = usePanel();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('more');
  useEffect(() => setTab('more'), [o.id]);
  const [scrolled, setScrolled] = useState(false);
  const gap = o.qAmount !== undefined && o.qAmount !== o.amount;
  const openCustomer = () => { panel.close(); nav(`/customers/${o.customerId}`); };

  return (
    <>
      <div className={`panel__head ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="panel__row">
          <Dialog.Title id="panel-title" className="panel__title" tabIndex={-1}>הזמנה <Ltr>{o.id}</Ltr> · {o.customerName}</Dialog.Title>
          <HealthBadge health={o.health} issues={o.issues} />
          {viewers.length > 0 && (
            <span className="viewers" role="status"><span className="viewers__dot" aria-hidden="true" />{viewers.map((v) => v.name.split(' ')[0]).join(', ')} {viewers.length === 1 ? 'פותח' : 'פותחים'} את ההזמנה כרגע</span>
          )}
          <span className="panel__spacer" />
          <Tip label={full ? 'חזרה לפאנל' : 'מסך מלא'}>
            <button className="icon-btn panel__full-btn" onClick={() => setFull(!full)} aria-label={full ? 'חזרה לפאנל' : 'מסך מלא'}>{full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          </Tip>
          <Dialog.Close asChild><button className="icon-btn panel__close" aria-label="סגור תיק הזמנה (Esc)"><X size={20} /></button></Dialog.Close>
        </div>
        <AnimatePresence initial={false}>
          {remoteNote && (
            <motion.div className="remote-note" role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <RefreshCw size={15} aria-hidden="true" />
              <span><b>{remoteNote.by}</b> עדכן עכשיו: {remoteNote.fields.join(', ')}. הערכים בתיק מעודכנים.</span>
              <button className="icon-btn icon-btn--sm" aria-label="סגור הודעה" onClick={() => setRemoteNote(null)}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>
        {o.postCloseFix && (
          <div className="changed-note">
            <span className="changed-tag">תיקון לאחר סגירה</span>
            <span className="changed-note__item">{o.postCloseFix.reason}</span>
            <span className="muted">· {o.postCloseFix.by}</span>
          </div>
        )}
        {o.changedAfterApproval && (
          <div className="changed-note">
            <span className="changed-tag">שונתה לאחר אישור</span>
            {o.changedAfterApproval.fields.map((k) => (
              <span key={k} className="changed-note__item">{FIELD[k] ?? k}: אושר <s>{showVal(k, o.changedAfterApproval!.before[k])}</s> · כעת <b>{showVal(k, o[k as keyof OrderView])}</b></span>
            ))}
            <span className="muted">· {o.changedAfterApproval.by}</span>
          </div>
        )}
      </div>

      <div className="panel__body" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)} tabIndex={0} role="region" aria-label="תוכן תיק ההזמנה">
        {(o.status === 'partial' || o.status === 'cancelled') && (
          <div className={`closed-note closed-note--${o.status}`}>
            <b>{o.status === 'partial' ? 'סופקה חלקית' : `בוטלה${o.cancelReason ? ` · ${o.cancelReason}` : ''}`}</b>
            {(o.partialNote || o.cancelNote) && <span>{o.partialNote ?? o.cancelNote}</span>}
          </div>
        )}
        {/* קודם כל: מה שצריך כדי להוריד את ההזמנה לקופה, ושורת Q */}
        <RegisterBlock o={o} />

        <div className="panel__flow">
          <OrderTimeline o={o} />
          {/* פעולות שהן חלק מהציר מופיעות בציר עצמו – כאן רק שאר הבעיות */}
          {o.issues.some((i) => !STEP_ACTIONS.includes(i.action)) && (
            <div className="missing" aria-label="מה חסר">
              {o.issues.filter((i) => !STEP_ACTIONS.includes(i.action)).map((i) => (
                <div key={i.rule} className={`missing__item missing__item--${i.severity}`}>
                  <span>{i.label}</span>
                  <FixButton o={o} issue={i} onOpen={() => { if (i.rule === 2 || i.rule === 9) setTab('pay'); else document.querySelector('.reg')?.scrollIntoView({ behavior: 'smooth' }); }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <nav className="panel__tabs panel__tabs--body" role="tablist" aria-label="עוד בתיק ההזמנה">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
        <div role="tabpanel" aria-label={TABS.find(([k]) => k === tab)?.[1]}>
          {tab === 'more' && (
            <Section id="details" title="פרטים נוספים">
              <Kv k="לקוח" v={<button className="link" onClick={openCustomer}>{o.customerName} · לתיק הלקוח</button>} />
              <EditKv k="ערוץ / מספר פניה" value={o.channel} display={o.channel || <Missing />} placeholder="לא נרשם" validate={(v) => (v ? '' : 'חובה: ערוץ או מספר פניה')} onSave={(v) => save({ channel: v }, 'ערוץ / מספר פניה')} />
              <Kv k="מטפל" v={<HandlerEdit o={o} />} />
              <Kv k="נוצר ע״י" v={<>{o.createdBy} · <Ltr>{fmtDate(o.createdAt)}</Ltr></>} />
              {o.branchPhone && <Kv k="טלפון הסניף" v={<Ltr>{fmtPhone(o.branchPhone)}</Ltr>} />}
              {o.cluster && <Kv k="אשכול" v={o.cluster} />}
            </Section>
          )}
          {tab === 'pay' && (
            <>
              <Section id="payment" title="תשלום">
                <Kv k="מצב תשלום" v={PAYMENT_LABEL[o.payment]} />
                <Kv k="תעודת רכש" v={<span className="kv__edit">{o.poNumber ? <Ltr>{o.poNumber}</Ltr> : o.poRequired ? <Missing /> : <span className="muted">לא נרשם</span>} <PoEdit o={o} /></span>} />
                {o.billingNote && <Kv k="הערות לחיוב" v={o.billingNote} />}
                <div className="sums">
                  <div><span>סכום לחיוב</span><b>{o.amount > 0 ? <Money value={o.amount} /> : <Missing>חסר סכום</Missing>}</b></div>
                  <div className={gap ? 'is-gap' : ''}>
                    <span>סכום Q</span>
                    <b>{o.qAmount !== undefined ? <Money value={o.qAmount} /> : '—'}</b>
                    {gap && <em>פער <Ltr>{fmtMoney(Math.abs((o.qAmount ?? 0) - o.amount))}</Ltr></em>}
                  </div>
                </div>
              </Section>
              <Section id="docs" title="מסמכים">
                <OrderDocsSection orderId={o.id} customerId={o.customerId} />
              </Section>
            </>
          )}
          {tab === 'notes' && (
            <Section id="notes" title="הערות פנימיות">
              <NotesSection o={o} />
            </Section>
          )}
          {tab === 'history' && <History o={o} />}
        </div>
        {/* בטלפון אין שורה תחתונה – מחיקה בסוף התיק, רחוק מהאגודל */}
        <div className="panel__del-m"><DeleteOrder o={o} /></div>
      </div>
      <div className="panel__foot">
        <span className="muted">לחיצה על ערך פותחת עריכה · נשמר אוטומטית · <kbd className="kbd">Esc</kbd> לסגירה</span>
        <DeleteOrder o={o} />
        <button className="link" onClick={panel.close}>חזרה לרשימה</button>
      </div>
    </>
  );
}

function Section({ id, title, children, action }: { id: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={`sec-${id}`} className="sec" aria-labelledby={`h-${id}`}>
      <div className="sec__head"><h3 id={`h-${id}`} className="sec__title">{title}</h3>{action}</div>
      <div className="sec__body">{children}</div>
    </section>
  );
}
function Kv({ k, v }: { k: string; v: ReactNode }) {
  return <div className="kv"><span className="kv__k">{k}</span><span className="kv__v">{v}</span></div>;
}

/* יומן ההזמנה – נקרא מ-auditLog, שאי אפשר לערוך או למחוק (נאכף בשרת) */
export const FIELD: Record<string, string> = {
  status: 'סטטוס', payment: 'תשלום', qNumber: "מס' Q", qAmount: 'סכום Q', branchApproval: 'עדכון בתפעול', poNumber: 'תעודת רכש',
  date: 'תאריך', time: 'שעה', amount: 'סכום לחיוב', docName: 'מסמך שצורף', contactName: 'איש קשר', contactPhone: 'טלפון', channel: 'ערוץ',
  delivery: 'סוג אספקה', instructions: 'הערות להזמנה', contents: 'פירוט', deliveryFee: 'דמי משלוח', method: 'אמצעי תשלום', accountPhone: 'טלפון הקפה',
  qGapAck: 'פער מול Q', qCancelAck: 'ביטול ב-Q', items: 'פריטים', partialNote: 'מה סופק', cancelReason: 'סיבת ביטול', cancelNote: 'פירוט ביטול', note: 'הערה', branchName: 'סניף', address: 'כתובת', customerName: 'לקוח', customerId: 'לקוח', postCloseFix: 'תיקון לאחר סגירה', calcAmount: 'סכום מחושב',
};
export function showVal(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (k === 'status') return STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? String(v);
  if (k === 'payment') return PAYMENT_LABEL[v as keyof typeof PAYMENT_LABEL] ?? String(v);
  if (k === 'amount' || k === 'qAmount') return fmtMoney(Number(v));
  if (k === 'branchApproval') return `עודכן בתפעול${(v as { manager?: string }).manager ? ` · ${(v as { manager: string }).manager}` : ''}`;
  if (k === 'date') return fmtDate(String(v));
  if (k === 'qGapAck') return v ? `אושר שהפער מוסבר: ${(v as { note?: string }).note ?? ''}` : '—';
  if (k === 'qCancelAck') return v ? 'אושר שבוטלה גם בקופה' : '—';
  if (k === 'items') return Array.isArray(v) ? `${v.length} פריטים` : '—';
  if (k === 'delivery') return v === 'pickup' ? 'איסוף עצמי' : 'משלוח';
  if (k === 'deliveryFee') return fmtMoney(Number(v));
  if (k === 'method') return METHOD_LABEL[String(v)] ?? String(v);
  return String(v);
}
const fmtAt = (d: Date) => `${fmtDate(toISODate(d))} | ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function History({ o }: { o: OrderView }) {
  const rows = useOrderHistory(o.id);
  if (rows === null) return <p className="muted">טוען…</p>;
  return (
    <ol className="timeline">
      {rows.length === 0 && <li className="muted">אין עדיין רשומות ביומן.</li>}
      {rows.map((r: OrderAuditRow) => (
        <li key={r.id}>
          <span className="timeline__at"><Ltr>{r.at ? fmtAt(r.at.toDate()) : '…'}</Ltr></span>
          <span>
            <b>{r.byName}</b> · {r.action === 'create' ? 'ההזמנה נוצרה' : r.action === 'doc' ? 'צירוף תעודת רכש' : r.action === 'note' ? 'הערה פנימית' : r.note === 'ביטול פעולה' ? 'ביטול פעולה' : r.action === 'status' ? 'שינוי סטטוס' : r.source === 'bulk' ? 'עדכון מרובה' : 'עדכון'}
            {r.action !== 'create' && r.action !== 'doc' && r.after && Object.keys(r.after).filter((k) => FIELD[k]).map((k) => (
              <span key={k} className="hist__change">{FIELD[k]}: <span className="muted">{showVal(k, r.before?.[k])}</span> ← {showVal(k, r.after?.[k])}</span>
            ))}
            {r.action === 'doc' && r.after && <span className="hist__change">{String(r.after.docName ?? '')}</span>}
            {r.note && r.note !== 'ביטול פעולה' && <span className="hist__change muted">הערה: {r.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
