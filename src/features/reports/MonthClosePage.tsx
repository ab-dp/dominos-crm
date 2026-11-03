/* סגירת חודש (אפיון 4.8, 7) – מסך אחד, ארבעה שלבים עם מונה התקדמות:
   1. השלמת חוסרים · 2. בדיקת הקפות · 3. העברה להנהלת חשבונות · 4. נעילה.
   כל שלב מחושב מהנתונים החיים, כך שאפשר לעצור באמצע, ומשתמש אחר ממשיך בדיוק מאותו מקום. */
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, CircleCheckBig, Download, Lock, LockOpen, ReceiptText, TriangleAlert, Wallet } from 'lucide-react';
import { usePanel } from '../../app/PanelContext';
import { useAuth } from '../../auth/AuthContext';
import { useStore, type OrderView } from '../../data/store';
import { lockMonth, markExported, monthLabel, reopenMonth, summarize, useMonth, useMonthOrders, type MonthDoc } from '../../data/months';
import { CLOSED, METHOD_LABEL, OUTCOME_LABEL, PAYMENT_LABEL, STAGE_LABEL, closeLabel, stageOf, type Order } from '../../data/types';
import { Button, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, Money, fmtDate, fmtMoney, fmtPhone } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { healthOf, issuesFor, type Issue } from '../../rules-engine/health';
import { FixButton } from '../orders/OrderActions';
import { CreditCheck, creditOrders } from './CreditCheck';
import '../pages.css';
import './MonthClosePage.css';

export function lastMonths(now: Date, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function MonthPicker({ months, value, onChange }: { months: string[]; value: string; onChange: (m: string) => void }) {
  return (
    <label className="filter">
      <span>חודש</span>
      <select className="input input--ltr" value={value} onChange={(e) => onChange(e.target.value)}>
        {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
    </label>
  );
}

/* מה מונע סגירה בהזמנה (אפיון 7, שלב 1) */
function blockersOf(o: Order, issues: Issue[]): Issue[] {
  const out: Issue[] = [];
  if (!CLOSED.includes(o.status)) out.push({ rule: 3, severity: 'red', label: 'לא סומנה סגירה', action: 'close', actionLabel: 'סמן סופקה' });
  if (o.status !== 'cancelled' && !o.qNumber) out.push({ rule: 1, severity: 'red', label: 'לא הועברה ל-Q', action: 'q', actionLabel: 'סמן הועברה ל-Q' });
  issues.filter((i) => i.rule === 2 || i.rule === 10 || i.rule === 11).forEach((i) => out.push(i));
  return out;
}

type Step = 1 | 2 | 3 | 4;

export function MonthClosePage() {
  const { now, thresholds } = useStore();
  const [params, setParams] = useSearchParams();
  // ברירת מחדל: החודש הקודם (סוגרים אחרי שהחודש נגמר)
  const months = lastMonths(now, 13);
  const ym = params.get('m') && months.includes(params.get('m')!) ? params.get('m')! : months[1];
  const { orders, loading } = useMonthOrders(ym);
  const { month, loading: mLoading } = useMonth(ym);
  const locked = month?.status === 'locked';

  const views: OrderView[] = useMemo(() => orders.map((o) => {
    const issues = issuesFor(o, now, thresholds);
    return { ...o, issues, health: healthOf(issues) };
  }), [orders, now, thresholds]);

  const blocked = views.map((o) => ({ o, blockers: blockersOf(o, o.issues) })).filter((r) => r.blockers.length)
    .sort((a, b) => (a.o.date + a.o.time).localeCompare(b.o.date + b.o.time));
  const credit = creditOrders(orders);
  const creditUnpaid = credit.filter((o) => o.payment !== 'paid');
  const fixes = orders.filter((o) => o.postCloseFix);

  const done: Record<Step, boolean> = { 1: blocked.length === 0, 2: creditUnpaid.length === 0, 3: !!month?.exportedAt, 4: locked };
  const firstOpen = ([1, 2, 3, 4] as Step[]).find((s) => !done[s]) ?? 4;
  const [picked, setPicked] = useState<{ ym: string; step: Step } | null>(null);
  const step: Step = picked?.ym === ym ? picked.step : firstOpen;
  const setStep = (s: Step) => setPicked({ ym, step: s });
  const doneCount = (Object.values(done) as boolean[]).filter(Boolean).length;
  const busy = loading || mLoading;

  const STEPS: [Step, string, string, ReactNode][] = [
    [1, 'השלמת חוסרים', done[1] ? 'אין חוסרים' : `${blocked.length} הזמנות`, <TriangleAlert size={18} key="1" />],
    [2, 'בדיקת הקפות', done[2] ? (credit.length ? 'הכל שולם' : 'אין הקפות') : `${creditUnpaid.length} לא שולמו`, <Wallet size={18} key="2" />],
    [3, 'העברה להנה"ח', done[3] ? `יוצא ${fmtStamp(month?.exportedAt)}` : 'טרם יוצא', <ReceiptText size={18} key="3" />],
    [4, 'נעילה', locked ? 'החודש נעול' : 'פתוח', <Lock size={18} key="4" />],
  ];

  return (
    <div className="page mclose">
      <header className="page__head">
        <div>
          <h1 className="page__title">סגירת חודש</h1>
          <p className="page__sub">
            חודש <bdi dir="ltr">{monthLabel(ym)}</bdi> · <Ltr>{orders.length}</Ltr> הזמנות ·{' '}
            {locked ? <span className="mclose__state mclose__state--locked"><Lock size={13} aria-hidden="true" /> נעול · {month?.lockedByName} · {fmtStamp(month?.lockedAt)}</span>
              : <span className="mclose__state">פתוח · <Ltr>{`${doneCount}/4`}</Ltr> שלבים הושלמו</span>}
          </p>
        </div>
        <div className="page__head-end">
          <MonthPicker months={months} value={ym} onChange={(m) => setParams({ m }, { replace: true })} />
        </div>
      </header>

      <ol className="mclose__steps" aria-label="שלבי סגירת החודש">
        {STEPS.map(([s, title, sub, icon]) => (
          <li key={s}>
            <button className={`mstep ${step === s ? 'is-on' : ''} ${done[s] ? 'is-done' : ''}`} onClick={() => setStep(s)} aria-current={step === s ? 'step' : undefined}>
              <span className="mstep__n" aria-hidden="true">{done[s] ? <Check size={16} strokeWidth={3} /> : s}</span>
              <span className="mstep__text"><b>{title}</b><span>{busy ? '…' : sub}</span></span>
              <span className="mstep__icon" aria-hidden="true">{icon}</span>
            </button>
          </li>
        ))}
      </ol>

      {busy ? <div className="card loading-rows" aria-busy="true" aria-label="טוען">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={30} />)}</div> : (
        <section className="mclose__body" aria-live="polite">
          {step === 1 && <Gaps rows={blocked} locked={locked} />}
          {step === 2 && (
            <>
              <StepIntro done={done[2]} doneText={credit.length ? 'כל הזמנות ההקפה סומנו כשולמו.' : 'אין הזמנות הקפה בחודש הזה.'}>
                משווים לדוח ההקפות מהקופה: מסמנים ✓ ליד כל שורה שנמצאה, משלימים בתיק ההזמנה תעודת רכש, סכום והערות לחיוב, ובסוף "סמן כשולם".
              </StepIntro>
              <CreditCheck ym={ym} orders={orders} month={month} loading={false} locked={locked} />
            </>
          )}
          {step === 3 && <Export ym={ym} orders={orders} month={month} locked={locked} />}
          {step === 4 && <LockStep ym={ym} orders={orders} month={month} done={done} fixes={fixes} onGo={setStep} />}
        </section>
      )}
    </div>
  );
}

function StepIntro({ done, doneText, children }: { done: boolean; doneText: string; children: ReactNode }) {
  return done
    ? <p className="mclose__intro is-done"><CircleCheckBig size={18} aria-hidden="true" /> {doneText}</p>
    : <p className="mclose__intro">{children}</p>;
}

/* ---------- 1. השלמת חוסרים ---------- */
function Gaps({ rows, locked }: { rows: { o: OrderView; blockers: Issue[] }[]; locked: boolean }) {
  const panel = usePanel();
  return (
    <>
      <StepIntro done={rows.length === 0} doneText="אין חוסרים: כל ההזמנות נסגרו, הועברו ל-Q והסכומים תואמים.">
        כל מה שמונע סגירה: הזמנות שלא סומנה להן סגירה, שלא הועברו ל-Q, או שיש פער בין סכום ההזמנה לסכום Q. לחיצה על שורה פותחת את התיק לתיקון.
      </StepIntro>
      {rows.length > 0 && (
        <ul className="card mgaps">
          {rows.map(({ o, blockers }) => (
            <li key={o.id} className="mgaps__row">
              <button className="mgaps__main" onClick={(e) => panel.open(o.id, e.currentTarget)}>
                <span className="mgaps__id"><Ltr>{o.id}</Ltr></span>
                <span className="mgaps__who"><b>{o.customerName}</b><span className="muted"><Ltr>{fmtDate(o.date)}</Ltr> · {o.branchName || 'ללא סניף'} · {STAGE_LABEL[stageOf(o)]}</span></span>
                <span className="mgaps__why">{blockers.map((b) => <span key={b.rule} className="mgaps__tag">{b.label}</span>)}</span>
                <span className="mgaps__sum"><Money value={o.amount} /></span>
              </button>
              {!locked && <span className="mgaps__fix"><FixButton o={o} issue={blockers[0]} onOpen={() => panel.open(o.id)} /></span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- 3. העברה להנהלת חשבונות ---------- */
function Export({ ym, orders, month, locked }: { ym: string; orders: Order[]; month: MonthDoc | null; locked: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const sorted = [...orders].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    downloadCsv(`הנהלת חשבונות ${monthLabel(ym)}.csv`, [
      ['חודש', monthLabel(ym), `${orders.length} הזמנות`],
      ['הזמנה', 'תאריך', 'לקוח', 'סניף', 'אשכול', 'סטטוס', 'אמצעי תשלום', 'טלפון הקפה', 'מצב תשלום', "מס' Q", 'סכום הזמנה', 'סכום Q', 'תעודת רכש', 'הערות לחיוב', 'תיקון לאחר סגירה'],
      ...sorted.map((o) => [o.id, fmtDate(o.date), o.customerName, o.branchName, o.cluster, closeLabel(o), o.methodLabel || METHOD_LABEL[o.method] || o.method,
        o.accountPhone ? fmtPhone(o.accountPhone) : '', PAYMENT_LABEL[o.payment], o.qNumber ?? '', o.amount, o.qAmount ?? '', o.poNumber ?? '', o.billingNote ?? '', o.postCloseFix?.reason ?? '']),
    ]);
    if (locked) return;
    setBusy(true);
    try { await markExported(ym, month, orders.length); toast({ message: <>החודש סומן "הועבר להנהלת חשבונות" · <Ltr>{orders.length}</Ltr> הזמנות</> }); }
    catch { toast({ message: 'הקובץ ירד, אבל הסימון לא נשמר – בדוק חיבור ונסה שוב' }); }
    setBusy(false);
  };
  return (
    <>
      <StepIntro done={!!month?.exportedAt} doneText={`הועבר להנהלת חשבונות ${fmtStamp(month?.exportedAt)}${month?.exportedByName ? ` · ${month.exportedByName}` : ''}. אפשר לייצא שוב בכל עת.`}>
        ייצוא כל הזמנות החודש לאקסל – כולל סטטוס, אמצעי ומצב תשלום, מס' Q, סכומים, תעודות רכש והערות לחיוב. אחרי הייצוא החודש מסומן "הועבר להנהלת חשבונות".
      </StepIntro>
      <div className="card mclose__card">
        <Download size={22} aria-hidden="true" className="mclose__card-icon" />
        <div><b>קובץ להנהלת חשבונות</b><span className="muted"><Ltr>{orders.length}</Ltr> הזמנות · חודש <bdi dir="ltr">{monthLabel(ym)}</bdi></span></div>
        <Button variant="primary" icon={<Download size={16} />} loading={busy} disabled={!orders.length} onClick={run}>{month?.exportedAt ? 'ייצוא מחדש' : 'ייצוא וסימון "הועבר"'}</Button>
      </div>
    </>
  );
}

/* ---------- 4. נעילה ---------- */
function LockStep({ ym, orders, month, done, fixes, onGo }: { ym: string; orders: Order[]; month: MonthDoc | null; done: Record<Step, boolean>; fixes: Order[]; onGo: (s: Step) => void }) {
  const { isAdmin } = useAuth();
  const panel = usePanel();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const locked = month?.status === 'locked';
  const ready = done[1] && done[2];
  const live = summarize(orders);
  const s = locked && month?.summary ? month.summary : live;

  const lock = async () => {
    setBusy(true);
    try { await lockMonth(ym, month, summarize(orders)); toast({ message: <>החודש <bdi dir="ltr">{monthLabel(ym)}</bdi> נסגר ונעול</> }); }
    catch { toast({ message: 'הנעילה נכשלה – בדוק חיבור ונסה שוב' }); }
    setBusy(false);
  };
  const reopen = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) { setErr('חובה: סיבת הפתיחה מחדש'); return; }
    setBusy(true);
    try { await reopenMonth(ym, month, reason.trim()); setReason(''); toast({ message: <>החודש <bdi dir="ltr">{monthLabel(ym)}</bdi> נפתח מחדש</> }); }
    catch { setErr('הפתיחה נכשלה – רק מנהל מערכת יכול לפתוח חודש נעול'); }
    setBusy(false);
  };

  return (
    <>
      {locked ? (
        <p className="mclose__intro is-done"><Lock size={18} aria-hidden="true" /> החודש נעול. סכומים, תאריכים, סטטוסים ומצבי תשלום של הזמנותיו משתנים רק עם סיבה, ומסומנים "תיקון לאחר סגירה".</p>
      ) : (
        <div className="card mclose__card">
          <Lock size={22} aria-hidden="true" className="mclose__card-icon" />
          <div>
            <b>סגור ונעל את החודש</b>
            {ready ? <span className="muted">כל ההזמנות נסגרו וכל ההקפות שולמו. הסיכומים יישמרו כעותק קפוא.{!done[3] && ' שים לב: החודש עוד לא יוצא להנהלת חשבונות.'}</span>
              : <span className="mclose__need">כדי לנעול צריך: {!done[1] && <button className="link" onClick={() => onGo(1)}>להשלים חוסרים</button>}{!done[1] && !done[2] && ' · '}{!done[2] && <button className="link" onClick={() => onGo(2)}>לסמן את כל ההקפות כשולמו</button>}</span>}
          </div>
          <Button variant="primary" icon={<Lock size={16} />} loading={busy} disabled={!ready} onClick={lock}>סגור חודש</Button>
        </div>
      )}

      <div className="card msum">
        <div className="card__head"><h2 className="card__title">{locked ? 'סיכומי החודש (קפואים)' : 'סיכומי החודש'}</h2>{locked && <span className="muted msum__note">כפי שנשמרו ברגע הנעילה</span>}</div>
        <dl className="msum__kpis">
          <div><dt>הזמנות</dt><dd><Ltr>{s.count}</Ltr></dd></div>
          <div><dt>סך החודש</dt><dd><Ltr>{fmtMoney(s.sum)}</Ltr></dd></div>
          <div><dt>ממוצע</dt><dd><Ltr>{s.count ? fmtMoney(Math.round(s.sum / s.count)) : '—'}</Ltr></dd></div>
          <div><dt>בוטלו</dt><dd><Ltr>{s.cancelled}</Ltr></dd></div>
          {s.byOutcome && (['ontime', 'late', 'partial'] as const).map((k) => <div key={k}><dt>{OUTCOME_LABEL[k]}</dt><dd><Ltr>{s.byOutcome![k] ?? 0}</Ltr></dd></div>)}
          {Object.entries(s.byMethod).map(([m, v]) => <div key={m}><dt>{METHOD_LABEL[m] ?? m}</dt><dd><Ltr>{fmtMoney(v.sum)}</Ltr><small> · <Ltr>{v.count}</Ltr></small></dd></div>)}
        </dl>
        {s.byCustomer.length > 0 && (
          <div className="report__scroll">
            <table className="rtable msum__table">
              <caption className="sr-only">סיכום לפי לקוח</caption>
              <thead><tr><th>לקוח</th><th className="num">הזמנות</th><th className="num">סך</th></tr></thead>
              <tbody>{s.byCustomer.map((c) => <tr key={c.name}><td>{c.name}</td><td className="num"><Ltr>{c.count}</Ltr></td><td className="num"><Ltr>{fmtMoney(c.sum)}</Ltr></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      {(locked || fixes.length > 0) && (
        <div className="card msum">
          <div className="card__head"><h2 className="card__title">תיקונים לאחר סגירה</h2><span className="muted"><Ltr>{fixes.length}</Ltr></span></div>
          {fixes.length === 0 ? <p className="muted msum__empty">אין תיקונים מאז הנעילה.</p> : (
            <ul className="mfix">
              {fixes.map((o) => (
                <li key={o.id}><button onClick={(e) => panel.open(o.id, e.currentTarget)}>
                  <span className="changed-tag">תיקון לאחר סגירה</span> הזמנה <Ltr>{o.id}</Ltr> · {o.customerName} · <span className="muted">{o.postCloseFix!.reason} · {o.postCloseFix!.by}</span>
                </button></li>
              ))}
            </ul>
          )}
          {locked && month?.summary && live.sum !== month.summary.sum && (
            <p className="mfix__delta">הסך הנוכחי <b><Ltr>{fmtMoney(live.sum)}</Ltr></b> שונה מהסך שננעל (<Ltr>{fmtMoney(month.summary.sum)}</Ltr>) בגלל התיקונים.</p>
          )}
        </div>
      )}

      {locked && (
        isAdmin ? (
          <form className="card mreopen" onSubmit={reopen}>
            <LockOpen size={20} aria-hidden="true" />
            <label className="cform__field">
              <span className="field__label">פתיחה מחדש של החודש (מנהל מערכת)<span className="req">חובה סיבה</span></span>
              <input className="input" value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} placeholder="למשל: התגלתה הזמנה שלא נרשמה" aria-invalid={!!err} aria-describedby={err ? 'reopen-err' : undefined} />
              {err && <span className="cform__err" id="reopen-err" role="alert">{err}</span>}
            </label>
            <Button variant="secondary" type="submit" loading={busy}>פתח מחדש</Button>
          </form>
        ) : <p className="muted mreopen__note">פתיחה מחדש של חודש נעול – רק מנהל מערכת. לתיקון הזמנה בודדת אין צורך לפתוח: פתח את ההזמנה ותקן עם סיבה.</p>
      )}
      {month?.reopenReason && !locked && <p className="muted mreopen__note">נפתח מחדש ע"י {month.reopenedByName} {fmtStamp(month.reopenedAt)} · {month.reopenReason}</p>}
      <p className="muted mreopen__note"><Link to={`/reports/credit?m=${ym}`}>דוח ההקפות של החודש</Link></p>
    </>
  );
}

function fmtStamp(t?: { seconds: number }) {
  if (!t?.seconds) return '';
  const d = new Date(t.seconds * 1000);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
