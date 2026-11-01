/* תיק הזמנה בפאנל צדדי (אפיון 6.3): כותרת קבועה, "מה חסר" לחיץ, גלילה אחת עם עוגנים, טאב היסטוריה. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { HealthBadge, StatusMenu, Tip } from '../../design/components';
import { Ltr, Money, fmtDate, fmtMoney, fmtPhone, toISODate, weekday } from '../../lib/format';
import { METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';
import { useOrderDoc, useOrderHistory, type OrderAuditRow } from '../../data/orders';
import { healthOf, issuesFor } from '../../rules-engine/health';
import { FixButton, OrderMarks, PoEdit } from './OrderActions';
import { OrderDocsSection } from './OrderDocs';
import { BranchEdit, DeliveryTypeEdit, EditKv, ItemsEditor, MethodEdit, NotesSection, showDate, showPhone, useOrderSave, validDate, validPhone, validTime } from './OrderEdit';
import { phoneError } from '../../lib/names';
import { keepOpenOnToast } from '../../app/ErrorBoundary';
import './OrderPanel.css';

const ANCHORS = [
  ['details', 'פרטים'], ['delivery', 'אספקה'], ['items', 'פריטים ומחיר'], ['approvals', 'אישורים'],
  ['payment', 'תשלום'], ['docs', 'מסמכים'], ['notes', 'הערות'],
] as const;

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

  return (
    <Dialog.Root open={!!o} onOpenChange={(v) => !v && panel.close()}>
      <AnimatePresence>
        {o && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount dir="rtl" aria-describedby={undefined} onPointerDownOutside={keepOpenOnToast} onInteractOutside={keepOpenOnToast}
              onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById('panel-title')?.focus(); }}
              onCloseAutoFocus={(e) => e.preventDefault()}>
              <motion.aside
                className={`panel ${full ? 'panel--full' : ''}`}
                initial={reduce ? { opacity: 0 } : { x: '-100%' }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: '-100%' }}
                transition={{ type: 'tween', duration: 0.24, ease: [0.2, 0, 0, 1] }}
              >
                <PanelBody o={o} full={full} setFull={setFull} />
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function PanelBody({ o, full, setFull }: { o: OrderView; full: boolean; setFull: (f: boolean) => void }) {
  const { requestStatus } = useStore();
  const save = useOrderSave(o);
  const [editItems, setEditItems] = useState(false);
  useEffect(() => setEditItems(false), [o.id]);
  const panel = usePanel();
  const nav = useNavigate();
  const [tab, setTab] = useState<'file' | 'history'>('file');
  const [activeSec, setActiveSec] = useState<string>('details');
  const [scrolled, setScrolled] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const gap = o.qAmount !== undefined && o.qAmount !== o.amount;

  // הדגשת העוגן של החלק שקוראים כרגע
  useEffect(() => {
    const root = bodyRef.current;
    if (!root || tab !== 'file') return;
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActiveSec(top.target.id.replace('sec-', ''));
    }, { root, rootMargin: '0px 0px -65% 0px' });
    root.querySelectorAll('.sec').forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [tab, o.id]);

  return (
    <>
      <header className={`panel__head ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="panel__row">
          <Dialog.Title id="panel-title" className="panel__title" tabIndex={-1}>הזמנה <Ltr>{o.id}</Ltr></Dialog.Title>
          <HealthBadge health={o.health} issues={o.issues} />
          <span className="panel__spacer" />
          <Tip label={full ? 'חזרה לפאנל' : 'מסך מלא'}>
            <button className="icon-btn" onClick={() => setFull(!full)} aria-label={full ? 'חזרה לפאנל' : 'מסך מלא'}>{full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          </Tip>
          <Dialog.Close asChild><button className="icon-btn" aria-label="סגור תיק הזמנה (Esc)"><X size={20} /></button></Dialog.Close>
        </div>
        <div className="panel__row panel__meta">
          <button className="link" onClick={() => { panel.close(); nav(`/customers/${o.customerId}`); }}>{o.customerName}</button>
          <span>·</span>
          <span>יום {weekday(o.date)} <Ltr>{fmtDate(o.date)}</Ltr> · <Ltr>{o.time}</Ltr></span>
          <span>·</span>
          <span>{o.branchName}</span>
        </div>
        <div className="panel__row">
          <StatusMenu status={o.status} onChange={(s) => requestStatus(o, s)} />
          <span className="panel__marks"><OrderMarks o={o} /></span>
        </div>
        {o.issues.length > 0 && (
          <div className="missing" aria-label="מה חסר">
            {o.issues.map((i) => (
              <div key={i.rule} className={`missing__item missing__item--${i.severity}`}>
                <span>{i.label}</span>
                <FixButton o={o} issue={i} onOpen={() => document.getElementById(i.rule === 2 ? 'sec-items' : 'sec-delivery')?.scrollIntoView({ behavior: 'smooth' })} />
              </div>
            ))}
          </div>
        )}
        <nav className="panel__tabs" aria-label="ניווט בתיק">
          <button className={tab === 'file' ? 'is-on' : ''} onClick={() => setTab('file')}>תיק</button>
          {tab === 'file' && ANCHORS.map(([id, label]) => (
            <a key={id} href={`#sec-${id}`} className={activeSec === id ? 'is-on' : ''} aria-current={activeSec === id ? 'location' : undefined} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label}</a>
          ))}
          <button className={`panel__tab-history ${tab === 'history' ? 'is-on' : ''}`} onClick={() => setTab('history')}>היסטוריה</button>
        </nav>
      </header>

      <div className="panel__body" ref={bodyRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)} tabIndex={0} role="region" aria-label="תוכן תיק ההזמנה">
        {tab === 'history' ? <History o={o} /> : (
          <>
            {(o.status === 'partial' || o.status === 'cancelled') && (
              <div className={`closed-note closed-note--${o.status}`}>
                <b>{o.status === 'partial' ? 'סופקה חלקית' : `בוטלה${o.cancelReason ? ` · ${o.cancelReason}` : ''}`}</b>
                {(o.partialNote || o.cancelNote) && <span>{o.partialNote ?? o.cancelNote}</span>}
              </div>
            )}
            <Section id="details" title="פרטים">
              <Kv k="לקוח" v={o.customerName} />
              <EditKv k="ערוץ קבלה" value={o.channel} placeholder="לא נרשם" validate={(v) => (v ? '' : 'חובה: ערוץ ההזמנה')} onSave={(v) => save({ channel: v }, 'ערוץ הקבלה')} />
              <Kv k="מטפל" v={o.handler} />
              <Kv k="נוצר ע״י" v={<>{o.createdBy} · <Ltr>{fmtDate(o.createdAt)}</Ltr></>} />
            </Section>
            <Section id="delivery" title="אספקה">
              <EditKv k="תאריך" kind="date" value={o.date} display={<>יום {weekday(o.date)} · {showDate(o.date)}</>} validate={validDate} onSave={(v) => save({ date: v }, 'תאריך האספקה')} />
              <EditKv k="שעה" kind="time" value={o.time} display={<Ltr>{o.time}</Ltr>} validate={validTime} onSave={(v) => save({ time: v }, 'שעת האספקה')} />
              <DeliveryTypeEdit o={o} />
              <BranchEdit o={o} />
              {o.delivery === 'delivery' && <EditKv k="כתובת" value={o.address ?? ''} display={o.address || <span className="warn-text">חסרה</span>} placeholder="רחוב, מספר, עיר" onSave={(v) => save({ address: v || undefined }, 'הכתובת')} />}
              <EditKv k="איש קשר לקבלה" value={o.contactName ?? ''} display={o.contactName || <span className="warn-text">חסר</span>} placeholder="מי מקבל את ההזמנה" onSave={(v) => save({ contactName: v || undefined }, 'איש הקשר')} />
              <EditKv k="טלפון" kind="phone" value={o.contactPhone ? fmtPhone(o.contactPhone) : ''} display={showPhone(o.contactPhone) ?? <span className="warn-text">חסר</span>} placeholder="05X-XXXXXXX" validate={validPhone} onSave={(v) => save({ contactPhone: v || undefined }, 'הטלפון')} />
              <EditKv k="הנחיות" kind="textarea" value={o.instructions ?? ''} placeholder="אין" onSave={(v) => save({ instructions: v || undefined }, 'ההנחיות')} />
            </Section>
            <Section id="items" title="פריטים ומחיר" action={!editItems && <button className="link" onClick={() => setEditItems(true)}>עריכה</button>}>
              {editItems ? <ItemsEditor o={o} onDone={() => setEditItems(false)} /> : (
                <>
                  {o.contents && <p className="order-contents">{o.contents}</p>}
                  {o.items.length > 0 && <table className="items">
                    <thead><tr><th>פריט</th><th>כמות</th><th>מחיר ליחידה</th><th>סה״כ</th></tr></thead>
                    <tbody>
                      {o.items.map((it, i) => (
                        <tr key={i}><td>{it.name}</td><td><Ltr>{it.qty}</Ltr></td><td><Money value={it.unitPrice} /></td><td><Money value={it.qty * it.unitPrice} /></td></tr>
                      ))}
                    </tbody>
                  </table>}
                  {!o.contents && o.items.length === 0 && <p className="muted">לא נרשמה תכולה – רק סכום. <button className="link" onClick={() => setEditItems(true)}>הוסף פירוט</button></p>}
                </>
              )}
              <div className="sums">
                {!!o.deliveryFee && <div><span>מתוכו דמי משלוח</span><b><Money value={o.deliveryFee} /></b></div>}
                {o.calcAmount !== undefined && <div><span>מחושב מהפריטים</span><b className="muted"><Money value={o.calcAmount} /></b></div>}
                <div><span>סכום לחיוב{o.calcAmount !== undefined && <span className="no-final__tag"> שונה ידנית</span>}</span><b><Money value={o.amount} /></b></div>
                <div className={gap ? 'is-gap' : ''}>
                  <span>סכום Q</span>
                  <b>{o.qAmount !== undefined ? <Money value={o.qAmount} /> : '—'}</b>
                  {gap && <em>פער <Ltr>{fmtMoney(Math.abs((o.qAmount ?? 0) - o.amount))}</Ltr></em>}
                </div>
              </div>
            </Section>
            <Section id="approvals" title="אישורים וסימונים">
              <Kv k="אישור לקוח" v={o.status === 'approved' || o.status === 'delivered' || o.status === 'partial' ? 'אושר' : <span className="warn-text">טרם אושר</span>} />
              <Kv k="אישור סניף" v={o.branchApproval ? <>אושר ע״י {o.branchApproval.manager}</> : <span className="warn-text">חסר</span>} />
              <Kv k="הועברה ל-Q" v={o.qNumber ? <><Ltr>{o.qNumber}</Ltr> · <Money value={o.qAmount ?? o.amount} /></> : <span className="warn-text">לא הועברה</span>} />
            </Section>
            <Section id="payment" title="תשלום">
              <MethodEdit o={o} />
              {o.method === 'account' && <EditKv k="טלפון הקפה" kind="phone" value={o.accountPhone ? fmtPhone(o.accountPhone) : ''} display={showPhone(o.accountPhone) ?? <span className="warn-text">חסר</span>} placeholder="05X-XXXXXXX" validate={(v) => (v ? phoneError(v) : 'חובה בהקפה: טלפון ההקפה')} onSave={(v) => save({ accountPhone: v }, 'טלפון ההקפה')} />}
              <Kv k="מצב תשלום" v={PAYMENT_LABEL[o.payment]} />
              <Kv k="תעודת רכש" v={<span className="kv__edit">{o.poNumber ? <Ltr>{o.poNumber}</Ltr> : <span className="muted">לא נרשם</span>} <PoEdit o={o} /></span>} />
              {o.billingNote && <Kv k="הערות לחיוב" v={o.billingNote} />}
            </Section>
            <Section id="docs" title="מסמכים">
              <OrderDocsSection orderId={o.id} />
            </Section>
            <Section id="notes" title="הערות פנימיות">
              <NotesSection o={o} />
            </Section>
          </>
        )}
      </div>
      <footer className="panel__foot">
        <span className="muted">לחיצה על ערך פותחת עריכה · נשמר אוטומטית · <kbd className="kbd">Esc</kbd> לסגירה</span>
        <button className="link" onClick={panel.close}>חזרה לרשימה</button>
      </footer>
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
const FIELD: Record<string, string> = {
  status: 'סטטוס', payment: 'תשלום', qNumber: "מס' Q", qAmount: 'סכום Q', branchApproval: 'אישור סניף', poNumber: 'תעודת רכש',
  date: 'תאריך', time: 'שעה', amount: 'סכום לחיוב', docName: 'מסמך שצורף', contactName: 'איש קשר', contactPhone: 'טלפון', channel: 'ערוץ',
  delivery: 'סוג אספקה', instructions: 'הנחיות', contents: 'פירוט', deliveryFee: 'דמי משלוח', method: 'אמצעי תשלום', accountPhone: 'טלפון הקפה',
  qGapAck: 'פער מול Q', qCancelAck: 'ביטול ב-Q', items: 'פריטים', partialNote: 'מה סופק', cancelReason: 'סיבת ביטול', cancelNote: 'פירוט ביטול', note: 'הערה', branchName: 'סניף', address: 'כתובת', customerName: 'לקוח', customerId: 'לקוח',
};
function showVal(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (k === 'status') return STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? String(v);
  if (k === 'payment') return PAYMENT_LABEL[v as keyof typeof PAYMENT_LABEL] ?? String(v);
  if (k === 'amount' || k === 'qAmount') return fmtMoney(Number(v));
  if (k === 'branchApproval') return `אושר ע"י ${(v as { manager?: string }).manager ?? ''}`;
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
