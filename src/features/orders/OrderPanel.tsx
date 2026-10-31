/* תיק הזמנה בפאנל צדדי (אפיון 6.3): כותרת קבועה, "מה חסר" לחיץ, גלילה אחת עם עוגנים, טאב היסטוריה. */
import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useStore, type OrderView } from '../../data/store';
import { HealthBadge, StatusMenu, Tip } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, Money, Phone, fmtDate, fmtMoney, weekday } from '../../lib/format';
import { METHOD_LABEL, PAYMENT_LABEL, STATUS_LABEL } from '../../data/types';
import { FixButton, OrderMarks } from './OrderActions';
import './OrderPanel.css';

const ANCHORS = [
  ['details', 'פרטים'], ['delivery', 'אספקה'], ['items', 'פריטים ומחיר'], ['approvals', 'אישורים'],
  ['payment', 'תשלום'], ['docs', 'מסמכים'], ['notes', 'הערות'],
] as const;

export function OrderPanel() {
  const panel = usePanel();
  const { orders } = useStore();
  const reduce = useReducedMotion();
  const [full, setFull] = useState(false);
  const o = orders.find((x) => x.id === panel.openId);

  return (
    <Dialog.Root open={!!o} onOpenChange={(v) => !v && panel.close()}>
      <AnimatePresence>
        {o && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="panel-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount dir="rtl" aria-describedby={undefined}
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
  const { update } = useStore();
  const panel = usePanel();
  const toast = useToast();
  const [tab, setTab] = useState<'file' | 'history'>('file');
  const gap = o.qAmount !== undefined && o.qAmount !== o.amount;

  return (
    <>
      <header className="panel__head">
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
          <button className="link" onClick={() => toast({ message: 'תיק לקוח ייבנה בשלב 4' })}>{o.customerName}</button>
          <span>·</span>
          <span>יום {weekday(o.date)} <Ltr>{fmtDate(o.date)}</Ltr> · <Ltr>{o.time}</Ltr></span>
          <span>·</span>
          <span>{o.branchName}</span>
        </div>
        <div className="panel__row">
          <StatusMenu status={o.status} onChange={(s) => update(o.id, { status: s, ...(s === 'cancelled' ? { payment: 'cancelled' as const } : {}) }, <>סטטוס: {STATUS_LABEL[s]} · הזמנה <Ltr>{o.id}</Ltr></>)} />
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
            <a key={id} href={`#sec-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label}</a>
          ))}
          <button className={`panel__tab-history ${tab === 'history' ? 'is-on' : ''}`} onClick={() => setTab('history')}>היסטוריה</button>
        </nav>
      </header>

      <div className="panel__body" tabIndex={0} role="region" aria-label="תוכן תיק ההזמנה">
        {tab === 'history' ? <History o={o} /> : (
          <>
            <Section id="details" title="פרטים">
              <Kv k="לקוח" v={o.customerName} />
              <Kv k="ערוץ קבלה" v={o.channel} />
              <Kv k="מטפל" v={o.handler} />
              <Kv k="נוצר ע״י" v={<>{o.createdBy} · <Ltr>{fmtDate(o.createdAt)}</Ltr></>} />
            </Section>
            <Section id="delivery" title="אספקה">
              <Kv k="מועד" v={<><Ltr>{fmtDate(o.date)}</Ltr> · <Ltr>{o.time}</Ltr></>} />
              <Kv k="סוג" v={o.delivery === 'delivery' ? 'משלוח' : 'איסוף עצמי'} />
              <Kv k="סניף" v={<>{o.branchName} <span className="muted">· אשכול {o.cluster}</span></>} />
              <Kv k="כתובת" v={o.delivery === 'pickup' ? '—' : (o.address || <span className="warn-text">חסרה</span>)} />
              <Kv k="איש קשר לקבלה" v={o.contactName ? <>{o.contactName} · <Phone value={o.contactPhone ?? ''} /></> : <span className="warn-text">חסר</span>} />
              {o.instructions && <Kv k="הנחיות" v={o.instructions} />}
            </Section>
            <Section id="items" title="פריטים ומחיר">
              <table className="items">
                <thead><tr><th>פריט</th><th>כמות</th><th>מחיר ליחידה</th><th>סה״כ</th></tr></thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.name}><td>{it.name}</td><td><Ltr>{it.qty}</Ltr></td><td><Money value={it.unitPrice} /></td><td><Money value={it.qty * it.unitPrice} /></td></tr>
                  ))}
                </tbody>
              </table>
              <div className="sums">
                <div><span>סכום הזמנה</span><b><Money value={o.amount} /></b></div>
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
              <Kv k="אמצעי תשלום" v={METHOD_LABEL[o.method]} />
              {o.accountPhone && <Kv k="טלפון הקפה" v={<Phone value={o.accountPhone} />} />}
              <Kv k="מצב תשלום" v={PAYMENT_LABEL[o.payment]} />
              <Kv k="תעודת רכש" v={o.poNumber ? <Ltr>{o.poNumber}</Ltr> : o.poRequired ? <span className="warn-text">נדרשת – חסרה</span> : '—'} />
              {o.billingNote && <Kv k="הערות לחיוב" v={o.billingNote} />}
            </Section>
            <Section id="docs" title="מסמכים">
              <p className="muted">העלאה בגרירה או בכפתור "בחר קובץ" – תיבנה בשלב 7.</p>
            </Section>
            <Section id="notes" title="הערות פנימיות">
              {o.notes.length === 0 ? <p className="muted">אין הערות</p> : o.notes.map((n, i) => (
                <p key={i} className="note"><b>{n.by}</b> <span className="muted"><Ltr>{fmtDate(n.at)}</Ltr></span><br />{n.text}</p>
              ))}
            </Section>
          </>
        )}
      </div>
      <footer className="panel__foot">
        <span className="muted">שינויים נשמרים אוטומטית · <kbd className="kbd">Esc</kbd> לסגירה</span>
        <button className="link" onClick={panel.close}>חזרה לרשימה</button>
      </footer>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`sec-${id}`} className="sec" aria-labelledby={`h-${id}`}>
      <h3 id={`h-${id}`} className="sec__title">{title}</h3>
      <div className="sec__body">{children}</div>
    </section>
  );
}
function Kv({ k, v }: { k: string; v: ReactNode }) {
  return <div className="kv"><span className="kv__k">{k}</span><span className="kv__v">{v}</span></div>;
}

function History({ o }: { o: OrderView }) {
  const rows = [
    { at: `${fmtDate(o.createdAt)} | 09:12`, who: o.createdBy, what: 'ההזמנה נוצרה' },
    ...(o.branchApproval ? [{ at: `${fmtDate(o.date)} | 08:40`, who: o.handler, what: `אישור סניף: ${o.branchApproval.manager}` }] : []),
    ...(o.qNumber ? [{ at: `${fmtDate(o.date)} | 09:05`, who: o.handler, what: `הועברה ל-Q: ${o.qNumber}` }] : []),
  ].reverse();
  return (
    <ol className="timeline">
      {rows.map((r, i) => (
        <li key={i}><span className="timeline__at"><Ltr>{r.at}</Ltr></span><span><b>{r.who}</b> · {r.what}</span></li>
      ))}
      <li className="muted">יומן מלא שאי אפשר לערוך – שלב 5</li>
    </ol>
  );
}
