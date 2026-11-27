/* תיק הזמנה בפאנל צדדי: ראש רשומה בכחול-לילה (שם, מזהה, שורת עובדות, ציר שלבים, סכום) ←
   הערות להזמנה בתיבה חמה (רק כשיש) ← גיליון אחד עם אזורים זה מתחת לזה, בלי לשוניות שמחביאות דברים:
   להעברה לקופה (עם שורת Q) · הצעד הבא · תשלום ומסמכים · פרטים נוספים · היסטוריה (מקופלת) · תיעוד טיפול (בתחתית).
   כל ערך עדיין נערך בלחיצה ונשמר מיד (עד שהעריכה המרכזית תחליף את זה). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Ban, ChevronLeft, ClipboardPen, History as HistoryIcon, Maximize2, Minimize2, MoreHorizontal, Pencil, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import { NextStep } from './OrderTimeline';
import { methodText, stageOf } from '../../data/types';
import { useFlag } from '../../data/flags';
import { useAuth } from '../../auth/AuthContext';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { Button, HealthBadge, Missing, Tip } from '../../design/components';
import { Ltr, Money, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';

import { useOrderDoc, useOrderHistory, useOrderViewers, type OrderAuditRow } from '../../data/orders';
import { healthOf, issuesFor } from '../../rules-engine/health';
import { FixButton, PoEdit } from './OrderActions';
import { OrderTimeline } from './OrderTimeline';
import { RegisterBlock, RegisterLocked } from './OrderRegister';
import { HoldBanner } from './Hold';
import { CareSection } from './Care';
import { canCare, needsCare } from '../../data/care';
import { DeleteOrder, HandlerEdit } from './AdminOrderActions';

// פעולות שהן חלק מציר ההזמנה – מופיעות בציר, לא ברשימת הבעיות
const STEP_ACTIONS = ['q', 'close'];
import { OrderDocsSection } from './OrderDocs';
import { ChannelEdit, EarlierNotes, EditKv, useOrderSave } from './OrderEdit';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import './OrderPanel.css';

const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

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
            <Dialog.Content asChild forceMount dir="rtl" aria-describedby={undefined} aria-labelledby="panel-title" onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast} onEscapeKeyDown={(e) => { if ((document.activeElement as HTMLElement | null)?.closest('.ib-table, .pgs, .kv.is-editing')) e.preventDefault(); }}
              onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById('panel-title')?.focus(); }}
              onCloseAutoFocus={restoreFocus}>
              <motion.div
                className={`panel ${full ? 'panel--full' : ''}`}
                initial={reduce ? { opacity: 0 } : { x: '-100%' }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: '-100%' }}
                transition={{ type: 'tween', duration: 0.24, ease: [0.2, 0, 0, 1] }}
              >
                {/* key: מעבר להזמנה אחרת ("הבאה להקלדה") בונה את התוכן מחדש – גלילה לראש, לשונית ראשונה, פוקוס בכותרת */}
                <PanelBody key={o.id} o={o} full={full} setFull={setFull} />
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
  // פוקוס בכותרת גם כשעוברים ישר להזמנה אחרת בלי לסגור (הכפתור שנלחץ כבר לא קיים)
  useEffect(() => { document.getElementById('panel-title')?.focus({ preventScroll: true }); }, []);
  const [scrolled, setScrolled] = useState(false);
  const [notesTop] = useState(!!o.instructions);
  // עריכה מרכזית (מאחורי מתג): "עריכה" פותח את טופס ההזמנה עם כל הערכים, והערכים בכרטיס לקריאה בלבד
  const central = useFlag('editForm');
  const { openNewOrder, requestStatus } = useStore();
  const { isAdmin } = useAuth();
  const [delOpen, setDelOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const closedOk = o.status === 'delivered' || o.status === 'partial';
  const canCancel = o.status !== 'cancelled' && !closedOk;
  const openHistory = () => { setHistOpen(true); requestAnimationFrame(() => jumpTo('sec-history')); };
  /* הצעד הבא – כפתור אחד לפי השלב, בראש הכרטיס (ובטלפון בסרגל התחתון) */
  const next = () => {
    if (o.hold) return null; // בהמתנה – הפעולות בפס הסגול
    if (cancelled) return <Button className="prec__act" icon={<RotateCcw size={16} />} onClick={() => requestStatus(o, 'approved')}>החזר מביטול</Button>;
    if (closedOk) return needsCare(o) ? <Button className="prec__act" icon={<ClipboardPen size={16} />} onClick={() => { jumpTo('sec-care'); setTimeout(() => (document.getElementById('care-add') as HTMLButtonElement | null)?.click(), 250); }}>תעד טיפול</Button> : null;
    // פתוחה: מעביר לשדה Q בבלוק הקופה ("רישום Q" שם נשאר הכפתור הראשי) – לכן כאן מתאר, לא מלא
    if (stageOf(o) === 'open') return <Button className="prec__act prec__act--brand" onClick={focusQ}>לרישום Q</Button>;
    return <span className="prec__next"><NextStep o={o} size="md" variant="primary" /></span>;
  };
  const ro = central || o.status === 'cancelled'; // הכרטיס נבנה מחדש לכל הזמנה (key), אז זה נקבע פעם אחת לכל הזמנה
  const gap = o.qAmount !== undefined && o.qAmount !== o.amount;
  const cancelled = o.status === 'cancelled';
  // "הקלד ל-Q" בציר מעביר לשורת Q שבבלוק הקופה – טופס אחד, לא שניים
  const focusQ = () => {
    const el = document.getElementById('reg-q-num') as HTMLInputElement | null;
    el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el?.focus({ preventScroll: true });
  };
  const openCustomer = () => { panel.close(); nav(`/customers/${o.customerId}`); };

  const barNext = next(); // בטלפון – בסרגל התחתון

  return (
    <>
      <div className={`panel__head ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="prec">
          <div className="panel__row">
            <Dialog.Title id="panel-title" className="panel__title" tabIndex={-1}><span className="prec__name">{o.customerName}</span> <span className="prec__id"><Ltr>#{o.id}</Ltr></span></Dialog.Title>
            <HealthBadge health={o.health} issues={o.issues} />
            {viewers.length > 0 && (
              <span className="viewers" role="status"><span className="viewers__dot" aria-hidden="true" />{viewers.map((v) => v.name.split(' ')[0]).join(', ')} {viewers.length === 1 ? 'פותח' : 'פותחים'} את ההזמנה כרגע</span>
            )}
            <span className="panel__spacer" />
            {/* פעולות ההזמנה – במקום אחד: עריכה · ביטול · עוד (היסטוריה, מחיקה למנהל) */}
            <span className="prec__acts">
              {central && !cancelled && <Button className="prec__edit" icon={<Pencil size={16} />} onClick={() => openNewOrder({ editOf: o })}>עריכה</Button>}
              {canCancel && <Button className="prec__cancel" icon={<Ban size={16} />} onClick={() => requestStatus(o, 'cancelled')}>ביטול הזמנה</Button>}
              <Dropdown.Root dir="rtl">
                <Dropdown.Trigger asChild><button className="icon-btn prec__more" aria-label="עוד פעולות להזמנה"><MoreHorizontal size={20} /></button></Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content className="menu" align="end" sideOffset={6} onCloseAutoFocus={(e) => e.preventDefault()}>
                    {central && !cancelled && <Dropdown.Item className="menu__item prec__m-only" onSelect={() => setTimeout(() => openNewOrder({ editOf: o }), 0)}><Pencil size={16} aria-hidden="true" /> עריכה</Dropdown.Item>}
                    <Dropdown.Item className="menu__item" onSelect={openHistory}><HistoryIcon size={16} aria-hidden="true" /> היסטוריה</Dropdown.Item>
                    {canCancel && <><Dropdown.Separator className="menu__sep prec__m-only" /><Dropdown.Item className="menu__item menu__item--danger prec__m-only" onSelect={() => setTimeout(() => requestStatus(o, 'cancelled'), 0)}><Ban size={16} aria-hidden="true" /> ביטול הזמנה</Dropdown.Item></>}
                    {isAdmin && <><Dropdown.Separator className="menu__sep" /><Dropdown.Item className="menu__item menu__item--danger" onSelect={() => setTimeout(() => setDelOpen(true), 0)}><Trash2 size={16} aria-hidden="true" /> מחק הזמנה</Dropdown.Item></>}
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
            </span>
            <span className="prec__divider" aria-hidden="true" />
            <Tip label={full ? 'חזרה לפאנל' : 'מסך מלא'}>
              <button className="icon-btn panel__full-btn" onClick={() => setFull(!full)} aria-label={full ? 'חזרה לפאנל' : 'מסך מלא'}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
            </Tip>
            <Dialog.Close asChild><button className="icon-btn panel__close" aria-label="סגור תיק הזמנה"><X size={20} /></button></Dialog.Close>
          </div>
          {/* שורת עובדות – לקריאה; עריכה באזורים שבגוף הכרטיס */}
          <dl className="prec__facts">
            <div><dt>מועד</dt><dd>{weekday(o.date)} <Ltr>{fmtDate(o.date).slice(0, 5)}</Ltr>{o.time && <>, <Ltr>{o.time}</Ltr></>}</dd></div>
            <div><dt>סניף · אספקה</dt><dd><span className="prec__trunc prec__trunc--branch" title={o.branchName}>{o.branchName || <span className="prec__miss">חסר</span>}</span> · {o.delivery === 'pickup' ? 'איסוף' : 'משלוח'}</dd></div>
            <div className="prec__contact"><dt>איש קשר</dt><dd>{o.contactName || o.contactPhone
              ? <><span className="prec__trunc" title={o.contactName}>{o.contactName}</span>{o.contactPhone && <a className="prec__tel" href={`tel:${o.contactPhone}`}><Ltr>{fmtPhone(o.contactPhone)}</Ltr></a>}</>
              : <span className="prec__miss">חסר</span>}</dd></div>
            <div><dt>תשלום</dt><dd>{methodText(o)}{o.method === 'account' && (o.accountPhone ? <> · <Ltr>{fmtPhone(o.accountPhone)}</Ltr></> : <> · <span className="prec__miss">חסר טלפון</span></>)}</dd></div>
          </dl>
          <div className="prec__track">
            <OrderTimeline o={o} part="track" />
            <span className="prec__step">{next()}</span>
            <span className="prec__sum"><small>סכום לחיוב</small><b>{o.amount > 0 ? <Money value={o.amount} /> : '—'}</b></span>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {remoteNote && (
            <motion.div className="remote-note" role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <RefreshCw size={16} aria-hidden="true" />
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
        {/* "שונתה אחרי הקלדה ל-Q" – הסימון החדש; "שונתה לאחר אישור" – סימון ישן שנשאר מוצג בהזמנות ישנות */}
        {o.changedAfterQ && (
          <div className="changed-note">
            <span className="changed-tag">שונתה אחרי הקלדה ל-Q</span>
            {o.changedAfterQ.fields.map((k) => (
              <span key={k} className="changed-note__item">{FIELD[k] ?? k}: היה <s>{showVal(k, o.changedAfterQ!.before[k])}</s> · כעת <b>{showVal(k, o[k as keyof OrderView])}</b></span>
            ))}
            <span className="muted">· {o.changedAfterQ.by}</span>
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
        {o.status === 'partial' && (
          <div className="closed-note">
            <b>סופקה חלקית</b>
            {o.partialNote && <span>{o.partialNote}</span>}
          </div>
        )}
        {cancelled && <CancelledNote o={o} />}
        <HoldBanner o={o} />
        {/* הערות להזמנה – ראשונות ובולטות, רק כשיש. כשאין – השדה נשאר בבלוק הקופה, להוספה */}
        {notesTop && !cancelled && (
          <section className="onotes" aria-label="הערות להזמנה">
            <EditKv readOnly={central} k="הערות להזמנה" kind="textarea" value={o.instructions ?? ''} placeholder="אין" onSave={(v) => save({ instructions: v || undefined }, 'ההערות')} />
            <EarlierNotes o={o} />
          </section>
        )}
        <div className="psheet">
        {/* מה שצריך כדי להוריד את ההזמנה לקופה, ושורת Q. בהזמנה מבוטלת – לקריאה בלבד */}
        {cancelled ? <RegisterLocked o={o} /> : <RegisterBlock o={o} notesAbove={notesTop} ro={central} />}

        <div className="panel__flow">
          {/* פעולות שהן חלק מהציר מופיעות בציר עצמו – כאן רק שאר הבעיות */}
          {o.issues.some((i) => !STEP_ACTIONS.includes(i.action)) && (
            <div className="missing" role="list" aria-label="מה חסר">
              {o.issues.filter((i) => !STEP_ACTIONS.includes(i.action)).map((i) => (
                <div key={i.rule} role="listitem" className={`missing__item missing__item--${i.severity}`}>
                  <span>{i.label}</span>
                  <FixButton o={o} issue={i} onOpen={() => central && !(i.rule === 2 || i.rule === 9) ? openNewOrder({ editOf: o }) : jumpTo(i.rule === 2 || i.rule === 9 ? 'sec-payment' : 'h-reg')} />
                </div>
              ))}
            </div>
          )}
        </div>

        <Section id="payment" title="תשלום ומסמכים">
          <Kv k="מצב תשלום" v={PAYMENT_LABEL[o.payment]} />
          <Kv k="תעודת רכש" v={<span className="kv__edit">{o.poNumber ? <Ltr>{o.poNumber}</Ltr> : o.poRequired ? <Missing /> : <span className="muted">לא נרשם</span>} {!cancelled && <PoEdit o={o} />}</span>} />
          <div className="sums">
            <div><span>סכום לחיוב</span><b>{o.amount > 0 ? <Money value={o.amount} /> : <Missing>חסר סכום</Missing>}</b></div>
            <div className={gap ? 'is-gap' : ''}>
              <span>סכום Q</span>
              <b>{o.qAmount !== undefined ? <Money value={o.qAmount} /> : '—'}</b>
              {gap && <em>פער <Ltr>{fmtMoney(Math.abs((o.qAmount ?? 0) - o.amount))}</Ltr></em>}
            </div>
          </div>
          <div className="psec__sub"><span className="kv__k">מסמכים</span><OrderDocsSection orderId={o.id} customerId={o.customerId} /></div>
        </Section>
            <Section id="details" title="פרטים נוספים">
              <Kv k="לקוח" v={<button className="link" onClick={openCustomer}>{o.customerName} · לתיק הלקוח</button>} />
              <ChannelEdit o={o} readOnly={ro} />
              <EditKv k="מספר קריאה" allowCard readOnly={ro} value={o.callRef ?? ''} display={o.callRef ? <Ltr>{o.callRef}</Ltr> : undefined} placeholder="אין" maxLength={60} validate={(v) => (v.length > 60 ? 'עד 60 תווים' : '')} onSave={(v) => save({ callRef: v || undefined }, 'מספר הקריאה')} />
              {o.channelLegacy && <Kv k="ערוץ (טקסט ישן)" v={o.channelLegacy} />}
              <Kv k="מטפל" v={<HandlerEdit o={o} />} />
              <Kv k="נוצר ע״י" v={<>{o.createdBy} · <Ltr>{fmtDate(o.createdAt)}</Ltr></>} />
              {o.branchPhone && <Kv k="טלפון הסניף" v={<Ltr>{fmtPhone(o.branchPhone)}</Ltr>} />}
              {o.cluster && <Kv k="אשכול" v={o.cluster} />}
              {/* פנימי להנהלת החשבונות (למשל למי לשלוח חשבונית בסוף החודש) – נפרד מ"הערות להזמנה" שלמעלה,
                  ולא מופיע בהעברה לקופה ובסיכום לתפעול. נטען מ"הנחיות חיוב" של הלקוח ביצירה */}
              <EditKv k="הערות להנהלת חשבונות" kind="textarea" value={o.billingNote ?? ''} placeholder="אין" onSave={(v) => save({ billingNote: v || undefined }, 'ההערות להנהלת חשבונות')} />
            </Section>
        {/* היסטוריה מקופלת – היומן נטען רק כשפותחים */}
        <HistorySection o={o} open={histOpen} setOpen={setHistOpen} />
        {/* תיעוד טיפול – בתחתית, בהזמנה שנסגרה */}
        {canCare(o) && <div id="sec-care" className="psec-care"><CareSection o={o} /></div>}
        </div>
        {/* בטלפון אין שורה תחתונה – מחיקה בסוף התיק, רחוק מהאגודל */}

      </div>
      {/* בטלפון: סרגל פעולות דביק – הצעד הבא ועריכה. ביטול ומחיקה בתפריט "עוד" (רחוק מהאגודל) */}
      {(barNext || (central && !cancelled)) && (
        <div className="pbar">
          {barNext}
          {central && !cancelled && <Button className="pbar__edit" icon={<Pencil size={16} />} onClick={() => openNewOrder({ editOf: o })}>עריכה</Button>}
        </div>
      )}
      <DeleteOrder o={o} control={{ open: delOpen, setOpen: setDelOpen }} />
    </>
  );
}

/* הזמנה מבוטלת: למה, מי ומתי – בראש התיק. מי ומתי נקראים מהיומן (הרשומה האחרונה שהעבירה ל"בוטלה") */
function CancelledNote({ o }: { o: OrderView }) {
  const rows = useOrderHistory(o.id);
  const row = rows?.find((r) => r.after?.status === 'cancelled');
  return (
    <div className="closed-note closed-note--cancelled" role="status">
      <b>בוטלה{o.cancelReason && <> · {o.cancelReason}</>}</b>
      {o.cancelNote && <span>{o.cancelNote}</span>}
      {row && <span>בוטלה ע״י {row.byName}{row.at && <> · <Ltr>{fmtAt(row.at.toDate())}</Ltr></>}</span>}
      {o.qNumber && !o.qCancelAck && <span className="closed-note__warn">הוקלדה ל-Q (<Ltr>{o.qNumber}</Ltr>) – צריך לבטל גם בקופה</span>}
    </div>
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

function HistorySection({ o, open, setOpen }: { o: OrderView; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <details id="sec-history" className="sec phist" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="sec__head phist__sum"><h3 className="sec__title">היסטוריה</h3><ChevronLeft size={16} aria-hidden="true" className="phist__chev" /></summary>
      {open && <History o={o} />}
    </details>
  );
}

/* יומן ההזמנה – נקרא מ-auditLog, שאי אפשר לערוך או למחוק (נאכף בשרת) */
export const FIELD: Record<string, string> = {
  status: 'סטטוס', payment: 'תשלום', qNumber: "מס' Q", qAmount: 'סכום Q', branchApproval: 'עדכון בתפעול', poNumber: 'תעודת רכש',
  date: 'תאריך', time: 'שעה', amount: 'סכום לחיוב', docName: 'מסמך שצורף', contactName: 'איש קשר', contactPhone: 'טלפון', channel: 'ערוץ', channelId: 'ערוץ', channelLegacy: 'ערוץ (טקסט ישן)', callRef: 'מספר קריאה',
  delivery: 'סוג אספקה', instructions: 'הערות להזמנה', contents: 'פירוט', deliveryFee: 'דמי משלוח', method: 'אמצעי תשלום', methodNote: 'פירוט אמצעי התשלום', accountPhone: 'טלפון הקפה',
  qGapAck: 'פער מול Q', qCancelAck: 'ביטול ב-Q', items: 'פריטים', partialNote: 'מה סופק', cancelReason: 'סיבת ביטול', cancelNote: 'פירוט ביטול', note: 'הערה', branchName: 'סניף', address: 'כתובת', customerName: 'לקוח', customerId: 'לקוח', postCloseFix: 'תיקון לאחר סגירה', calcAmount: 'סכום מחושב',
  opsNotified: 'נשלח בקבוצת תפעול', changedAfterApproval: 'שונתה לאחר אישור', changedAfterQ: 'שונתה אחרי הקלדה ל-Q', hold: 'בהמתנה', late: 'איחור', qNeedsUpdate: 'עדכון ב-Q אחרי שינוי', billingNote: 'הערות להנהלת חשבונות', careCount: 'תיעודי טיפול', topic: 'נושא', comp: 'פיצוי', compAmount: 'סכום הפיצוי', text: 'איך טיפלנו',
};
export function showVal(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (k === 'status') return STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? String(v);
  if (k === 'payment') return PAYMENT_LABEL[v as keyof typeof PAYMENT_LABEL] ?? String(v);
  if (k === 'amount' || k === 'qAmount' || k === 'compAmount') return fmtMoney(Number(v));
  if (k === 'branchApproval') return `עודכן בתפעול${(v as { manager?: string }).manager ? ` · ${(v as { manager: string }).manager}` : ''}`;
  if (k === 'date') return fmtDate(String(v));
  if (k === 'qGapAck') return v ? `אושר שהפער מוסבר: ${(v as { note?: string }).note ?? ''}` : '—';
  if (k === 'qCancelAck') return v ? 'אושר שבוטלה גם בקופה' : '—';
  if (k === 'items') return Array.isArray(v) ? `${v.length} פריטים` : '—';
  if (k === 'delivery') return v === 'pickup' ? 'איסוף עצמי' : 'משלוח';
  if (k === 'deliveryFee') return fmtMoney(Number(v));
  if (k === 'method') return METHOD_LABEL[String(v)] ?? String(v);
  if (k === 'methodNote') return String(v ?? '') || '—';
  if (k === 'opsNotified') return v ? 'נשלח' : 'עוד לא';
  if (k === 'hold') return v ? (() => { const h = v as { reason?: string; note?: string; attempts?: number }; return [h.reason, h.attempts && h.attempts > 1 ? `ניסיון ${h.attempts}` : '', h.note].filter(Boolean).join(' · '); })() : 'שוחררה';
  if (k === 'qNeedsUpdate') return v ? 'צריך לעדכן' : 'עודכן';
  if (k === 'late') return (v as { minutes?: number }).minutes ? `${(v as { minutes: number }).minutes} דק'` : 'באיחור';
  if (k === 'postCloseFix') return (v as { reason?: string }).reason ?? '—';
  if (k === 'changedAfterQ' || k === 'changedAfterApproval') return Array.isArray((v as { fields?: unknown }).fields) ? (v as { fields: string[] }).fields.map((x) => FIELD[x] ?? x).join(', ') : '—';
  if (typeof v === 'object') return '—';
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
            <b>{r.byName}</b> · {r.action === 'create' ? 'ההזמנה נוצרה' : r.action === 'doc' ? 'צירוף תעודת רכש' : r.action === 'note' ? 'הערה פנימית' : r.action === 'care' ? 'תיעוד טיפול (בתיק הלקוח)' : r.note === 'ביטול פעולה' ? 'ביטול פעולה' : r.action === 'status' ? 'שינוי סטטוס' : r.after?.opsNotified === true && Object.keys(r.after).length === 1 ?'נשלח בקבוצת תפעול' : r.source === 'bulk' ? 'עדכון מרובה' : 'עדכון'}
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
