/* בניית הצעת מחיר – מסך אחד: עורכים מימין, ודף ההצעה מתעדכן חי משמאל (בטלפון – לשונית "תצוגת ההצעה").
   מחירים: ידני, או מחירון מהמערכת (המחירון של הלקוח נבחר לבד). שורה = מוצר, מחיר ליחידה וכמות – כמו בהזמנה, בלי תוספות.
   פרטי הלקוח – לא חובה. "הורדת PDF" שומרת ומורידה; אחרי ההורדה שואלים אם לסמן שההצעה נשלחה. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CircleAlert, Copy, Download, FileText, Link2, Plus, RotateCcw, Save, Trash2, Unlink } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { newId, primaryContact, useCustomers, type Customer } from '../../data/customers';
import { DELIVERY_CAT, pizzaCount, usePriceLists, type PriceItem } from '../../data/priceLists';
import {
  EMPTY_QUOTE_CUSTOMER, QUOTE_STATUS_LABEL, addDays, createQuote, isExpired, linesTotal, saveQuote, setQuoteStatus, useQuote, useQuoteTerms, useQuotes,
  type Quote, type QuoteCustomer, type QuoteInput, type QuoteLine,
} from '../../data/quotes';
import { useStore } from '../../data/store';
import { CATEGORIES } from '../../data/types';
import { Button, EmptyState, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { Ltr, fmtMoney, fmtPhone, roundMoney, toISODate } from '../../lib/format';
import { isSimilar } from '../../lib/names';
import { saveError } from '../../lib/saveError';
import { Shell } from '../leads/LeadDialogs';
import { buildCatalog, catalogFor, normName, type CatalogItem } from '../orders/ItemsBuilder';
import { QuoteSheet, downloadSheetPdf, type SheetData } from './QuoteSheet';
import { QuoteTrack } from './QuoteTrack';
import '../pages.css';
import '../orders/ItemsBuilder.css';
import './quotes.css';

type QLine = QuoteLine & { key: string; pText?: string };
type Fee = { itemId?: string; name: string; price: string };
const CARD_RE = /\d{13,}/;
const VALID: number[] = [7, 14, 30];
const DRAFT_KEY = 'quoteDraft';
const money = (s: string) => roundMoney(Number(s.replace(/[^\d.]/g, '')) || 0);
const blankLine = (l: QuoteLine) => !l.name.trim() && !l.qty && !l.unitPrice;
const lineErr = (l: QuoteLine) => (blankLine(l) ? '' : !l.name.trim() ? 'חסר שם מוצר' : l.qty <= 0 ? 'חסרה כמות' : '');
// פריטים לחישוב מדרגת המשלוח: הכל חוץ משתייה
const deliveryCount = (lines: QuoteLine[]) => lines.filter((l) => l.category !== 'משקאות' && !blankLine(l)).reduce((t, l) => t + l.qty, 0);

/* ---------- המסך: הצעה חדשה / הצעה שמורה ---------- */
export function QuotePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = !id;
  const fromId = isNew && params.get('from') ? Number(params.get('from')) : null;
  const { q, loading } = useQuote(isNew ? fromId : Number(id));
  if (loading) return <div className="page"><Skeleton h={28} w="30%" /><div style={{ height: 16 }} /><Skeleton h={320} /></div>;
  if (!isNew && !q) {
    return <div className="page"><div className="card"><EmptyState icon={<FileText size={20} />} title="ההצעה לא נמצאה" action={<Link className="btn btn--secondary btn--md" to="/quotes"><span className="btn__label">להצעות המחיר</span></Link>} /></div></div>;
  }
  return <QuoteEditor key={id ?? `new-${fromId ?? ''}-${params.get('customer') ?? ''}`} quote={isNew ? undefined : q!} seed={isNew ? q ?? undefined : undefined} customerParam={params.get('customer') ?? ''} />;
}

type Form = {
  customerId: string; customer: QuoteCustomer; plSel: string | null; delivery: 'delivery' | 'pickup';
  lines: QLine[]; fee: Fee; feeTouched: boolean; date: string; time: string; address: string; validDays: number; notes: string;
};

function initialForm(q?: Partial<Quote>): Form {
  return {
    // הצעה שמורה: המחירון שנשמר בה (ריק = ידני). חדשה: לפי הלקוח (null)
    customerId: q?.customerId ?? '', customer: { ...EMPTY_QUOTE_CUSTOMER, ...q?.customer }, plSel: q?.id ? q.priceListId ?? '' : q?.priceListId ?? null,
    delivery: q?.delivery ?? 'delivery', lines: (q?.lines ?? []).map((l) => ({ ...l, key: newId() })),
    fee: q?.fee ? { itemId: q.fee.itemId, name: q.fee.name, price: q.fee.price ? String(q.fee.price) : '' } : { name: 'משלוח', price: '' }, feeTouched: !!q?.fee || !!q?.id,
    date: q?.date ?? '', time: q?.time ?? '', address: q?.address ?? '', validDays: q?.validDays ?? 14, notes: q?.notes ?? '',
  };
}
/* חתימה להשוואה "יש שינויים שלא נשמרו" – בלי מפתחות שורה וטקסט בהקלדה */
const sig = (x: Form) => JSON.stringify({ ...x, feeTouched: undefined, lines: x.lines.filter((l) => !blankLine(l)).map(({ key: _k, pText: _p, ...l }) => l) });

function QuoteEditor({ quote, seed, customerParam }: { quote?: Quote; seed?: Quote; customerParam: string }) {
  const toast = useToast();
  const nav = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { now } = useStore();
  const { items: customers } = useCustomers();
  const { items: priceLists, loading: plLoading } = usePriceLists();
  const { items: allQuotes } = useQuotes('all');
  const terms = useQuoteTerms();
  const today = toISODate(now);

  /* מצב התחלתי: הצעה שמורה / שכפול / טיוטה שלא נשמרה (בלשונית הזו) / ריקה */
  const [restored] = useState(() => {
    if (quote || seed || customerParam) return null;
    try { const s = sessionStorage.getItem(DRAFT_KEY); return s ? (JSON.parse(s) as Form) : null; } catch { return null; }
  });
  const [f, setF] = useState<Form>(() => restored ?? initialForm(quote ?? (seed ? { ...seed, id: undefined, priceListId: seed.priceListId } : undefined)));
  const [savedJson, setSavedJson] = useState(() => sig(initialForm(quote)));
  const [tab, setTab] = useState(() => (f.lines[0]?.category && CATEGORIES.includes(f.lines[0].category) ? f.lines[0].category : CATEGORIES[0]));
  const [draftKey, setDraftKey] = useState(newId);
  const [focus, setFocus] = useState<{ key: string; field: string } | null>(null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState<'' | 'save' | 'pdf'>('');
  const [err, setErr] = useState('');
  const [askSent, setAskSent] = useState<boolean>(() => !!(location.state as { askSent?: boolean } | null)?.askSent);
  const sheetRef = useRef<HTMLElement>(null);
  // סגירת השאלה "לסמן שנשלחה?" – גם מנקה את הבקשה מההיסטוריה, שלא תחזור ברענון
  const closeAsk = () => { setAskSent(false); if (location.state) nav(location.pathname, { replace: true, state: null }); };
  const tableRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Form>) => { setF((x) => ({ ...x, ...patch })); setErr(''); };

  const linked = customers.find((c) => c.id === f.customerId);
  // לקוח מתיק הלקוח ("הצעה חדשה" מתוך התיק)
  useEffect(() => {
    if (!customerParam || f.customerId) return;
    const c = customers.find((x) => x.id === customerParam);
    if (c) linkCustomer(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerParam, customers.length]);

  const plId = f.plSel ?? linked?.priceListId ?? '';
  const priceList = priceLists.find((p) => p.id === plId);
  const catalog = useMemo(() => buildCatalog(priceList, linked, f.delivery), [priceList, linked, f.delivery]);
  const tiers = useMemo(() => (priceList?.items ?? []).filter((i) => i.active && i.category === DELIVERY_CAT), [priceList]);
  const locked = !!quote && ['approved', 'rejected', 'ordered'].includes(quote.status);

  /* טיוטה של הצעה חדשה נשמרת בלשונית – רענון או מעבר מסך לא מוחקים אותה */
  useEffect(() => {
    if (quote) return;
    try { if (f.lines.some((l) => !blankLine(l)) || f.customer.name.trim()) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch { /* מצב פרטי */ }
  }, [f, quote]);
  const dirty = sig(f) !== savedJson;
  // הצעה שמורה עם שינויים שלא נשמרו – הדפדפן שואל לפני סגירה. הצעה חדשה נשמרת בלשונית ממילא
  useEffect(() => {
    if (!dirty || !quote) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, quote]);

  /* ---------- מחירים ---------- */
  const match = (cat: CatalogItem[], l: Pick<QuoteLine, 'category' | 'name'>) => cat.find((i) => i.category === l.category && normName(i.name) === normName(l.name) && l.name.trim());
  // החלפת מחירון / משלוח-איסוף: שורות שהמחיר שלהן מהמחירון מתעדכנות; מחיר ששונה ידנית נשאר
  const reprice = (patch: Partial<Form>) => {
    const next = { ...f, ...patch };
    const pl = priceLists.find((p) => p.id === (next.plSel ?? linked?.priceListId ?? ''));
    const cat = buildCatalog(pl, linked, next.delivery);
    let n = 0;
    const lines = next.lines.map((l) => {
      if (l.manual) return l;
      const m = match(cat, l);
      if (m?.unit && m.unit !== l.unitPrice) { n++; return { ...l, itemId: m.id, unitPrice: m.unit, pText: undefined }; }
      if (!m && l.itemId) return { ...l, itemId: undefined };
      return l;
    });
    set({ ...patch, lines });
    if (n) toast({ message: <>מחירים עודכנו ב-<Ltr>{n}</Ltr> שורות{pl ? <> לפי "{pl.name}"</> : null}</> });
  };
  const lastPrice = useMemo(() => {
    const m = new Map<string, number>();
    [...allQuotes].sort((a, b) => a.id - b.id).forEach((q) => q.id !== quote?.id && q.lines.forEach((l) => { if (l.unitPrice > 0) m.set(`${l.category}|${normName(l.name)}`, l.unitPrice); }));
    return m;
  }, [allQuotes, quote?.id]);
  const nameHints = (cat: string) => [...new Set([...catalog.filter((i) => i.category === cat).map((i) => i.name), ...allQuotes.flatMap((q) => q.lines.filter((l) => l.category === cat).map((l) => l.name.trim()))])].filter(Boolean).slice(0, 80);

  /* ---------- שורות ---------- */
  const catLines = f.lines.filter((l) => l.category === tab);
  const draft: QLine = { key: draftKey, category: tab, name: '', qty: 0, unitPrice: 0 };
  const rows = [...catLines, draft];
  const real = f.lines.filter((l) => !blankLine(l));
  const change = (key: string, patch: Partial<QLine>) => {
    setF((x) => {
      const exists = x.lines.some((l) => l.key === key);
      let lines = exists ? x.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) : [...x.lines, { ...draft, ...patch, key }];
      // שם שתואם מוצר במחירון – המחיר נכנס לבד (אם לא שונה ידנית)
      if ('name' in patch) {
        lines = lines.map((l) => {
          if (l.key !== key || l.manual) return l;
          const m = match(catalog, l);
          return m ? { ...l, itemId: m.id, unitPrice: m.unit ?? l.unitPrice, pText: undefined } : l.itemId ? { ...l, itemId: undefined } : l;
        });
      }
      return { ...x, lines };
    });
    if (key === draftKey) setDraftKey(newId());
    setErr('');
  };
  const remove = (key: string) => setF((x) => ({ ...x, lines: x.lines.filter((l) => l.key !== key) }));
  const setPrice = (l: QLine, text: string) => {
    const v = money(text);
    const m = match(catalog, l);
    change(l.key, { pText: text, unitPrice: v, manual: !!v && (!m?.unit || v !== m.unit) ? true : undefined });
  };
  const pick = (it: CatalogItem) => {
    const ex = catLines.find((l) => normName(l.name) === normName(it.name));
    const key = ex?.key ?? newId();
    if (!ex) setF((x) => ({ ...x, lines: [...x.lines, { key, category: tab, name: it.name, qty: 0, unitPrice: it.unit ?? 0, itemId: it.id }] }));
    requestAnimationFrame(() => tableRef.current?.querySelector<HTMLInputElement>(`[data-key="${key}"] input[data-col="qty"]`)?.focus());
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const row = (e.target as HTMLElement).closest('[data-key]');
    const next = row?.nextElementSibling?.matches('[data-key]') ? row.nextElementSibling : null;
    (next?.querySelector('input[data-col="name"]') as HTMLInputElement | null)?.focus();
  };
  const count = (c: string) => f.lines.filter((l) => l.category === c && !blankLine(l)).reduce((t, l) => t + l.qty, 0);

  /* ---------- משלוח: מדרגה מוצעת לפי מספר הפריטים (בלי שתייה) ---------- */
  const dCount = deliveryCount(f.lines);
  const suggested = [...tiers].filter((t) => t.upTo && t.price).sort((a, b) => a.upTo! - b.upTo!).find((t) => dCount > 0 && dCount <= t.upTo!);
  useEffect(() => {
    if (f.feeTouched || f.delivery !== 'delivery' || !suggested) return;
    if (f.fee.itemId === suggested.id) return;
    setF((x) => ({ ...x, fee: { itemId: suggested.id, name: suggested.name, price: String(suggested.price) } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested?.id, f.feeTouched, f.delivery]);
  const pickTier = (t: PriceItem) => set({ fee: { itemId: t.id, name: t.name, price: t.price ? String(t.price) : '' }, feeTouched: true });
  const feeValue = f.delivery === 'delivery' ? money(f.fee.price) : 0;
  const itemsTotal = linesTotal(real);
  const total = itemsTotal + feeValue;

  /* ---------- לקוח ---------- */
  function linkCustomer(c: Customer) {
    const pc = primaryContact(c);
    setF((x) => ({
      ...x, customerId: c.id,
      customer: { name: c.name, contact: pc?.name ?? x.customer.contact, phone: pc?.phone ? fmtPhone(pc.phone) : x.customer.phone, email: pc?.email ?? x.customer.email, taxId: c.taxId || x.customer.taxId },
      address: x.address || c.addresses[0]?.address || c.businessAddress || '',
    }));
  }
  const twins = f.customerId || f.customer.name.trim().length < 2 ? [] : customers.filter((c) => c.status === 'active' && (isSimilar(c.name, f.customer.name) || c.name.includes(f.customer.name.trim()))).slice(0, 3);

  /* ---------- בדיקות חיות ---------- */
  const rowErrs = real.filter((l) => lineErr(l));
  const unpriced = real.filter((l) => !lineErr(l) && !l.unitPrice);
  const pizzas = pizzaCount(real);
  const minWarn = priceList?.minPizzas && pizzas > 0 && pizzas < priceList.minPizzas ? priceList.minPizzas : 0;
  const cardIn = [f.notes, f.address, f.customer.name, f.customer.contact, ...real.map((l) => l.name)].some((s) => CARD_RE.test(s));

  const input = (): QuoteInput => {
    const issueDate = quote?.issueDate || today;
    const lines = real.map(({ key: _k, pText: _p, ...l }) => ({ ...l, name: l.name.trim(), ...(l.manual ? {} : { manual: undefined }) }));
    return {
      customerId: f.customerId || undefined,
      customer: { name: f.customer.name.trim(), contact: f.customer.contact.trim(), phone: f.customer.phone.replace(/[^\d+]/g, ''), email: f.customer.email.trim(), taxId: f.customer.taxId.replace(/\D/g, '') },
      delivery: f.delivery, fee: feeValue ? { name: f.fee.name.trim() || 'משלוח', price: feeValue, ...(f.fee.itemId ? { itemId: f.fee.itemId } : {}) } : undefined,
      date: f.date || undefined, time: f.time || undefined, address: f.delivery === 'delivery' ? f.address.trim() || undefined : undefined,
      priceListId: plId || undefined, priceListName: priceList?.name,
      lines, notes: f.notes.trim() || undefined,
      issueDate, validDays: f.validDays, validUntil: addDays(issueDate, f.validDays),
      itemsTotal, total,
    };
  };
  const check = (forPdf: boolean) => {
    if (rowErrs.length) { setTab(rowErrs[0].category); return 'בשורה המסומנת באדום חסרים שם מוצר או כמות'; }
    if (cardIn) return 'אסור לרשום מספר כרטיס אשראי בהצעה';
    if (forPdf && !real.length) return 'אין פריטים בהצעה – הוסיפו לפחות שורה אחת';
    if (!real.length && !f.customer.name.trim()) return 'הצעה ריקה – הוסיפו פריטים או לקוח לפני השמירה';
    return '';
  };

  /* שמירה: הצעה חדשה מקבלת מספר; מחזיר את מספר ההצעה */
  const save = async (forPdf = false): Promise<number | null> => {
    const e = check(forPdf);
    if (e) { setErr(e); return null; }
    if (quote && !dirty) return quote.id;
    setBusy(forPdf ? 'pdf' : 'save');
    try {
      const data = input();
      let n: number;
      if (quote) { await saveQuote(quote, data); n = quote.id; }
      else { n = await createQuote(data); try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* מצב פרטי */ } }
      setSavedJson(sig(f));
      if (!forPdf) toast({ message: quote ? <>הצעה <Ltr>{n}</Ltr> עודכנה</> : <>הצעה <Ltr>{n}</Ltr> נשמרה כטיוטה{data.customer.name ? <> · {data.customer.name}</> : null}</> });
      if (!quote && !forPdf) nav(`/quotes/${n}`, { replace: true });
      setBusy('');
      return n;
    } catch (x) { setErr(`${saveError(x)}. ההצעה לא נשמרה.`); setBusy(''); return null; }
  };
  const fileName = (n: number) => `הצעת מחיר ${n}${f.customer.name.trim() ? ` - ${f.customer.name.trim().replace(/[\\/:*?"<>|]/g, '')}` : ''}.pdf`;
  const [pdfNumber, setPdfNumber] = useState<number | undefined>(undefined);
  const pdf = async () => {
    const n = await save(true);
    if (!n) return;
    setBusy('pdf');
    setPdfNumber(n);
    // הדף מתעדכן עם מספר ההצעה לפני הציור
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      await downloadSheetPdf(sheetRef.current!, fileName(n));
      const status = quote?.status ?? 'draft';
      if (!quote) nav(`/quotes/${n}`, { replace: true, state: { askSent: true } });
      else if (status === 'draft') setAskSent(true);
      else toast({ message: <>הקובץ ירד · הצעה <Ltr>{n}</Ltr></> });
    } catch { setErr('לא ניתן היה ליצור PDF – נסו שוב'); }
    setBusy('');
  };

  const sheet: SheetData = {
    number: quote?.id ?? pdfNumber, issueDate: quote?.issueDate || today, validUntil: addDays(quote?.issueDate || today, f.validDays),
    customer: f.customer, delivery: f.delivery, date: f.date, time: f.time, address: f.address, lines: real, notes: f.notes,
    fee: feeValue ? { name: f.fee.name.trim() || 'משלוח', price: feeValue } : undefined, terms, handler: quote?.handler || profile?.name || '',
  };
  const expired = quote ? isExpired(quote, today) : false;

  /* ---------- תצוגה ---------- */
  const preview = (
    <div className="qe-preview" aria-label="תצוגה מקדימה של ההצעה">
      <ScaledSheet><QuoteSheet ref={sheetRef} d={sheet} /></ScaledSheet>
    </div>
  );

  return (
    <div className="page qe">
      <button className="auth__back" onClick={() => nav('/quotes')}><ArrowRight size={16} aria-hidden="true" /> הצעות מחיר</button>
      <header className="page__head qe__head">
        <div>
          <h1 className="page__title">{quote ? <>הצעה <Ltr>{quote.id}</Ltr>{quote.customer.name && <> · {quote.customer.name}</>}</> : seed ? `הצעה חדשה (עותק של ${seed.id})` : 'הצעה חדשה'}</h1>
          <p className="page__sub">
            {quote ? <><span className={`qstat qstat--${expired ? 'expired' : quote.status}`}>{expired ? 'פג תוקף' : QUOTE_STATUS_LABEL[quote.status]}</span> · נוצרה ב-<Ltr>{quote.issueDate.split('-').reverse().join('.')}</Ltr> ע"י {quote.handler}</>
              : 'המחירים כוללים מע"מ.'}
          </p>
        </div>
        <div className="page__head-end">
          <div className="seg qe__view" role="tablist" aria-label="תצוגה">
            <button role="tab" aria-selected={view === 'edit'} className={view === 'edit' ? 'is-on' : ''} onClick={() => setView('edit')}>עריכה</button>
            <button role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'is-on' : ''} onClick={() => setView('preview')}>תצוגת ההצעה</button>
          </div>
          {quote && <Button icon={<Copy size={16} />} onClick={() => nav(`/quotes/new?from=${quote.id}`)}>שכפל</Button>}
        </div>
      </header>
      {restored && <p className="qe-restored" role="status"><RotateCcw size={16} aria-hidden="true" /> שוחזרה הצעה שהתחלתם ולא נשמרה. <button className="link" onClick={() => { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* */ } setF(initialForm()); setSavedJson(sig(initialForm())); }}>התחל מחדש</button></p>}

      <div className={`qe-grid qe-grid--${view}`}>
        <div className="qe-main">
          {quote && <QuoteTrack q={quote} />}
          {locked && <p className="qe-locked" role="note"><CircleAlert size={16} aria-hidden="true" /> ההצעה {quote!.status === 'ordered' ? 'הפכה להזמנה' : quote!.status === 'approved' ? 'אושרה' : 'נדחתה'} ולכן לא נערכת. לשינוי – {quote!.status === 'rejected' ? 'החזירו אותה לטיפול, או ' : ''}שכפלו להצעה חדשה.</p>}

          <fieldset className="qe-form" disabled={locked}>
            {/* 1. מחירים */}
            <section className="card qe-sec" aria-labelledby="qe-h-price">
              <h2 id="qe-h-price" className="qe-sec__title"><span className="qe-num">1</span> מחירים לפי</h2>
              <div className="qe-row">
                <div className="seg" role="radiogroup" aria-label="מקור המחירים">
                  <button type="button" role="radio" aria-checked={!plId} className={!plId ? 'is-on' : ''} onClick={() => reprice({ plSel: '' })}>מחירים ידניים</button>
                  <button type="button" role="radio" aria-checked={!!plId} className={plId ? 'is-on' : ''} onClick={() => { if (plLoading) return; const first = linked?.priceListId || priceLists.find((p) => p.active)?.id; if (first) reprice({ plSel: first }); else toast({ message: 'עוד אין מחירונים במערכת – אפשר ליצור במסך "מחירונים"' }); }}>מחירון</button>
                </div>
                {plId && (
                  <select className="input input--sm qe-plsel" value={plId} aria-label="בחירת מחירון" onChange={(e) => reprice({ plSel: e.target.value })}>
                    {priceLists.filter((p) => p.active || p.id === plId).map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === linked?.priceListId ? ' – של הלקוח' : ''}</option>)}
                  </select>
                )}
                <div className="seg qe-dlv" role="radiogroup" aria-label="משלוח או איסוף">
                  <button type="button" role="radio" aria-checked={f.delivery === 'delivery'} className={f.delivery === 'delivery' ? 'is-on' : ''} onClick={() => reprice({ delivery: 'delivery' })}>משלוח</button>
                  <button type="button" role="radio" aria-checked={f.delivery === 'pickup'} className={f.delivery === 'pickup' ? 'is-on' : ''} onClick={() => reprice({ delivery: 'pickup' })}>איסוף עצמי</button>
                </div>
              </div>
              <p className="qe-hint qe-hint--edit">
                {plId ? <>המחיר של כל מוצר מהמחירון נכנס לבד, ואפשר לשנות אותו בשורה – להצעה הזו בלבד.{linked && linked.priceListId === plId && ' המחירים המיוחדים של הלקוח כלולים.'}</> : 'מקלידים מחיר לכל שורה. מחיר שכבר הוצע בעבר למוצר מוצע בלחיצה.'}
              </p>
              {priceList?.note && <p className="qe-cond"><CircleAlert size={16} aria-hidden="true" /> תנאי המחירון: {priceList.note}</p>}
            </section>

            {/* 2. פריטים */}
            <section className="card qe-sec" aria-labelledby="qe-h-items">
              <h2 id="qe-h-items" className="qe-sec__title"><span className="qe-num">2</span> פריטים</h2>
              <div className="ib-tabs" role="tablist" aria-label="קטגוריה">
                {CATEGORIES.map((c) => (
                  <button type="button" role="tab" key={c} aria-selected={tab === c} className={`ib-tab ${tab === c ? 'is-on' : ''} ${f.lines.some((l) => l.category === c && lineErr(l)) ? 'is-bad' : ''}`} onClick={() => { setTab(c); setFocus(null); }}>
                    {c}{count(c) > 0 && <span className="ib-tab__n"><Ltr>{count(c)}</Ltr></span>}
                  </button>
                ))}
              </div>
              {catalog.some((i) => i.category === tab) && (
                <div className="qe-chips" role="group" aria-label={`הוספה מהמחירון – ${tab}`}>
                  <span className="qe-chips__label">מהמחירון:</span>
                  {catalog.filter((i) => i.category === tab).map((it) => (
                    <button type="button" key={it.id} className={`qe-chip ${catLines.some((l) => normName(l.name) === normName(it.name)) ? 'is-in' : ''}`} onClick={() => pick(it)}>
                      <Plus size={14} aria-hidden="true" /> {it.name}{it.unit ? <> · <Ltr>{fmtMoney(it.unit)}</Ltr></> : null}
                    </button>
                  ))}
                </div>
              )}
              <div className="ib-table qe-table" role="group" aria-label={`פריטים – ${tab}`} ref={tableRef}>
                <div className="qe-r qe-r--head" aria-hidden="true">
                  <span>מוצר <small>כמו שיופיע בהצעה</small></span>
                  <span>מחיר ליחידה</span>
                  <span>כמות</span>
                  <span>סה"כ</span>
                  <span />
                </div>
                {rows.map((l) => {
                  const isDraft = l.key === draftKey;
                  const active = focus?.key === l.key;
                  const e = !active ? lineErr(l) : '';
                  const m = match(catalog, l);
                  const changed = !!m?.unit && l.unitPrice > 0 && l.unitPrice !== m.unit;
                  const label = l.name.trim() || (isDraft ? 'שורה חדשה' : 'שורה');
                  const priceFocus = active && !isDraft && l.name.trim() && (focus!.field === 'name' || focus!.field === 'price');
                  const sug = priceFocus && !m ? catalogFor(catalog, tab, l.name).filter((i) => normName(i.name) !== normName(l.name)) : [];
                  const last = priceFocus ? lastPrice.get(`${l.category}|${normName(l.name)}`) : undefined;
                  const on = (field: string) => ({ onFocus: () => setFocus({ key: l.key, field }), onKeyDown: onKey, 'data-col': field });
                  return (
                    <div key={l.key} className="qe-g" data-key={l.key} data-draft={isDraft || undefined}
                      onBlur={(ev) => { if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) { setFocus((x) => (x?.key === l.key ? null : x)); if (l.pText !== undefined) change(l.key, { pText: undefined }); } }}>
                      <div className={`qe-r ${isDraft ? 'is-draft' : ''}`}>
                        <input className={`input input--sm ${e && !l.name.trim() ? 'is-invalid' : ''}`} list={`qe-names-${CATEGORIES.indexOf(tab)}`} value={l.name}
                          placeholder={isDraft ? (tab === 'פיצות' ? 'למשל: פיצה משפחתית עם תוספת' : tab === 'ליד הפיצה' ? 'למשל: סל תוספות' : tab === 'משקאות' ? 'למשל: שתייה גדולה' : 'שם המוצר') : ''}
                          onChange={(ev) => change(l.key, { name: ev.target.value })} aria-label={`מוצר – ${label}`} {...on('name')} />
                        <span className="qe-price">
                          <input className={`input input--sm input--ltr ${changed ? 'is-changed' : ''}`} inputMode="decimal" value={l.pText ?? (l.unitPrice ? String(l.unitPrice) : '')} placeholder="₪"
                            onChange={(ev) => setPrice(l, ev.target.value)} aria-label={`מחיר ליחידה – ${label}`} {...on('price')} />
                          {changed && <button type="button" className="qe-revert" title={`חזרה למחיר המחירון ${fmtMoney(m!.unit!)}`} aria-label={`חזרה למחיר המחירון ${fmtMoney(m!.unit!)} – ${label}`} onMouseDown={(ev) => ev.preventDefault()} onClick={() => change(l.key, { unitPrice: m!.unit!, manual: undefined, pText: undefined })}><RotateCcw size={14} /></button>}
                        </span>
                        <input className={`input input--sm input--ltr ${e && l.name.trim() && l.qty <= 0 ? 'is-invalid' : ''}`} inputMode="numeric" value={l.qty || ''}
                          onChange={(ev) => change(l.key, { qty: Number(ev.target.value.replace(/\D/g, '')) || 0 })} aria-label={`כמות – ${label}`} {...on('qty')} />
                        <span className="qe-sum">{l.qty && l.unitPrice ? <Ltr>{fmtMoney(l.qty * l.unitPrice)}</Ltr> : <span className="muted">—</span>}</span>
                        {isDraft ? <span /> : <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר שורה – ${label}`} onClick={() => remove(l.key)}><Trash2 size={16} /></button>}
                      </div>
                      {(changed || (m && !m.unit && !l.unitPrice)) && !active && <p className="qe-tag">{changed ? <>שונה מהמחירון (<Ltr>{fmtMoney(m!.unit!)}</Ltr>) – להצעה הזו בלבד</> : 'במחירון אין מחיר למוצר הזה – הקלידו מחיר'}</p>}
                      {(sug.length > 0 || (last && last !== l.unitPrice)) && (
                        <p className="ib-sug ib-sug--price qe-sug">
                          <span>מחיר מוצע:</span>
                          {sug.map((it) => (
                            <button type="button" key={it.id} className="ib-sug__chip" onMouseDown={(ev) => ev.preventDefault()} onClick={() => change(l.key, { name: it.name, itemId: it.id, unitPrice: it.unit!, manual: undefined, pText: undefined })}>
                              {it.name} <Ltr>{fmtMoney(it.unit!)}</Ltr>
                            </button>
                          ))}
                          {last && last !== l.unitPrice && (
                            <button type="button" className="ib-sug__chip" onMouseDown={(ev) => ev.preventDefault()} onClick={() => change(l.key, { unitPrice: last, manual: m?.unit ? last !== m.unit || undefined : true, pText: undefined })}>
                              בהצעה הקודמת <Ltr>{fmtMoney(last)}</Ltr>
                            </button>
                          )}
                        </p>
                      )}
                      {e && <p className="ib-err">{e}</p>}
                    </div>
                  );
                })}
                <button type="button" className="ib-addrow" onClick={() => tableRef.current?.querySelector<HTMLInputElement>('[data-draft] input[data-col="name"]')?.focus()}>
                  <Plus size={14} aria-hidden="true" /> שורה
                </button>
              </div>
              <p className="ib-foot">
                <span className="ib-hint">Enter – לשורה הבאה · כותבים קבוצת מוצר ומחיר סופי ליחידה, בלי פירוט תוספות</span>
                {count(tab) > 0 && <b>סה״כ {tab}: <Ltr>{count(tab)}</Ltr></b>}
              </p>
              {CATEGORIES.map((c, i) => <datalist key={c} id={`qe-names-${i}`}>{nameHints(c).map((h) => <option key={h} value={h} />)}</datalist>)}
            </section>

            {/* 3. משלוח */}
            <section className="card qe-sec" aria-labelledby="qe-h-fee">
              <h2 id="qe-h-fee" className="qe-sec__title"><span className="qe-num">3</span> {f.delivery === 'delivery' ? 'דמי משלוח' : 'איסוף עצמי'}</h2>
              {f.delivery === 'pickup' ? <p className="qe-hint">איסוף עצמי – בלי דמי משלוח. להחלפה: "משלוח" בחלק 1.</p> : (
                <>
                  {tiers.length > 0 && (
                    <div className="qe-chips" role="radiogroup" aria-label="מדרגת משלוח מהמחירון">
                      {tiers.map((t) => (
                        <button type="button" role="radio" key={t.id} aria-checked={f.fee.itemId === t.id} className={`chip ${f.fee.itemId === t.id ? 'is-on' : ''}`} onClick={() => pickTier(t)}>
                          {t.name}{t.price ? <> · <Ltr>{fmtMoney(t.price)}</Ltr></> : null}{suggested?.id === t.id && <span className="qe-sugtag">מוצע</span>}
                        </button>
                      ))}
                      <button type="button" role="radio" aria-checked={!f.fee.itemId && !money(f.fee.price)} className={`chip ${!f.fee.itemId && !money(f.fee.price) ? 'is-on' : ''}`} onClick={() => set({ fee: { name: 'משלוח', price: '' }, feeTouched: true })}>בלי דמי משלוח</button>
                    </div>
                  )}
                  <div className="qe-row qe-fee">
                    <label className="qe-field"><span className="field__label">שם בשורת המשלוח</span>
                      <input className="input input--sm" value={f.fee.name} onChange={(e) => set({ fee: { ...f.fee, name: e.target.value, itemId: undefined }, feeTouched: true })} placeholder="משלוח" /></label>
                    <label className="qe-field qe-field--sm"><span className="field__label">דמי משלוח (₪)</span>
                      <input className="input input--sm input--ltr" inputMode="decimal" value={f.fee.price} onChange={(e) => set({ fee: { ...f.fee, price: e.target.value, itemId: undefined }, feeTouched: true })} placeholder="0" aria-label="דמי משלוח (₪)" /></label>
                  </div>
                  <p className="qe-hint">{suggested && !f.feeTouched ? <>נבחר לבד לפי <Ltr>{dCount}</Ltr> פריטים (בלי שתייה). אפשר לבחור אחר או להקליד סכום.</> : tiers.length ? 'בוחרים מדרגה מהמחירון או מקלידים סכום.' : 'מקלידים סכום. מדרגות משלוח קבועות מגדירים במחירון, בלשונית "משלוח".'}</p>
                </>
              )}
            </section>

            {/* 4. לקוח ואספקה */}
            <section className="card qe-sec" aria-labelledby="qe-h-cust">
              <h2 id="qe-h-cust" className="qe-sec__title"><span className="qe-num">4</span> לקוח ואספקה <span className="qe-opt">הכל לא חובה – מה שתמלאו יופיע בהצעה</span></h2>
              {linked ? (
                <p className="qe-linked"><Link2 size={16} aria-hidden="true" /> מקושר ללקוח <Link to={`/customers/${linked.id}`}>{linked.name}</Link>{linked.priceListId && priceLists.find((p) => p.id === linked.priceListId) && <> · מחירון: {priceLists.find((p) => p.id === linked.priceListId)!.name}</>}
                  <button type="button" className="link" onClick={() => set({ customerId: '' })}><Unlink size={14} aria-hidden="true" /> נתק</button></p>
              ) : twins.length > 0 && (
                <p className="qe-twins"><span>לקוח קיים ב-CRM?</span>{twins.map((c) => <button type="button" key={c.id} className="chip" onClick={() => linkCustomer(c)}>{c.name}</button>)}</p>
              )}
              <div className="qe-fields">
                <label className="qe-field qe-field--wide"><span className="field__label">שם הלקוח / החברה</span>
                  <input className="input" value={f.customer.name} onChange={(e) => set({ customer: { ...f.customer, name: e.target.value } })} placeholder="הקלידו – לקוח קיים יוצע לבד" /></label>
                <label className="qe-field"><span className="field__label">איש קשר</span>
                  <input className="input" value={f.customer.contact} onChange={(e) => set({ customer: { ...f.customer, contact: e.target.value } })} /></label>
                <label className="qe-field"><span className="field__label">טלפון</span>
                  <input className="input input--ltr" inputMode="tel" value={f.customer.phone} onChange={(e) => set({ customer: { ...f.customer, phone: e.target.value } })} placeholder="05X-XXXXXXX" /></label>
                <label className="qe-field"><span className="field__label">אימייל</span>
                  <input className="input input--ltr" type="email" value={f.customer.email} onChange={(e) => set({ customer: { ...f.customer, email: e.target.value } })} /></label>
                <label className="qe-field"><span className="field__label">ח.פ / ע.מ</span>
                  <input className="input input--ltr" inputMode="numeric" value={f.customer.taxId} onChange={(e) => set({ customer: { ...f.customer, taxId: e.target.value } })} /></label>
                <label className="qe-field"><span className="field__label">תאריך אספקה</span>
                  <input className="input input--ltr" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></label>
                <label className="qe-field"><span className="field__label">שעה</span>
                  <input className="input input--ltr" type="time" step={900} value={f.time} onChange={(e) => set({ time: e.target.value })} /></label>
                {f.delivery === 'delivery' && (
                  <label className="qe-field qe-field--wide"><span className="field__label">כתובת לאספקה</span>
                    <input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="רחוב, מספר, עיר" /></label>
                )}
              </div>
            </section>

            {/* 5. תוקף והערות */}
            <section className="card qe-sec" aria-labelledby="qe-h-notes">
              <h2 id="qe-h-notes" className="qe-sec__title"><span className="qe-num">5</span> תוקף והערות</h2>
              <div className="qe-row">
                <span className="field__label">תוקף ההצעה</span>
                <div className="seg" role="radiogroup" aria-label="תוקף ההצעה">
                  {VALID.map((d) => <button type="button" role="radio" key={d} aria-checked={f.validDays === d} className={f.validDays === d ? 'is-on' : ''} onClick={() => set({ validDays: d })}><Ltr>{d}</Ltr> ימים</button>)}
                </div>
                <span className="muted">עד <Ltr>{sheet.validUntil.split('-').reverse().join('.')}</Ltr></span>
              </div>
              <label className="qe-field qe-field--wide"><span className="field__label">הערות בהצעה <span className="muted">(יופיעו בדף)</span></span>
                <textarea className="input cform__ta" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="למשל: כולל כלים חד-פעמיים ומפיות" /></label>
              <p className="qe-hint qe-hint--edit">התנאים הקבועים בסוף ההצעה {terms.length ? `(${terms.length})` : ''} נערכים בהגדרות → "הצעות מחיר".</p>
            </section>
          </fieldset>

          {/* סיכום ופעולות – תמיד בתחתית */}
          <div className="qe-bar">
            <ul className="qe-warn" aria-live="polite">
              {err && <li className="is-err"><CircleAlert size={16} aria-hidden="true" /> {err}</li>}
              {minWarn > 0 && <li><CircleAlert size={16} aria-hidden="true" /> המחירון "{priceList!.name}" תקף מ-<Ltr>{minWarn}</Ltr> פיצות – בהצעה יש <Ltr>{pizzas}</Ltr></li>}
              {unpriced.length > 0 && <li><CircleAlert size={16} aria-hidden="true" /> <Ltr>{unpriced.length}</Ltr> {unpriced.length === 1 ? 'שורה' : 'שורות'} בלי מחיר ({unpriced.slice(0, 2).map((l) => l.name).join(', ')}{unpriced.length > 2 ? '…' : ''}) – בדף יופיע "—"</li>}
            </ul>
            <span className="qe-total">סה"כ לתשלום <b><Ltr>{fmtMoney(total)}</Ltr></b> <span className="muted">כולל מע"מ</span></span>
            {!locked && <Button icon={<Save size={16} />} loading={busy === 'save'} onClick={() => save()}>{quote ? (dirty ? 'שמור שינויים' : 'נשמר') : 'שמירה'}</Button>}
            <Button variant="primary" icon={<Download size={16} />} loading={busy === 'pdf'} onClick={locked ? async () => { setBusy('pdf'); try { await downloadSheetPdf(sheetRef.current!, fileName(quote!.id)); } catch { setErr('לא ניתן היה ליצור PDF – נסו שוב'); } setBusy(''); } : pdf}>הורדת PDF</Button>
          </div>
        </div>
        {preview}
      </div>

      {askSent && quote && quote.status === 'draft' && (
        <Shell title="ההצעה ירדה ✓" sub={<>הקובץ "{fileName(quote.id)}" נשמר בהורדות. כשההצעה נשלחת ללקוח – מסמנים "נשלחה", ומאותו רגע נספר הזמן עד תזכורת המעקב.</>} onClose={() => closeAsk()}>
          <div className="udialog__actions">
            <Button variant="primary" icon={<Check size={16} />} data-autofocus onClick={async () => {
              closeAsk();
              try { await setQuoteStatus(quote, 'sent'); toast({ message: <>הצעה <Ltr>{quote.id}</Ltr> סומנה כנשלחה</> }); } catch { toast({ tone: 'error', message: 'העדכון נכשל – בדקו חיבור' }); }
            }}>כן, סמן שנשלחה</Button>
            <Button variant="ghost" onClick={() => closeAsk()}>עוד לא נשלחה</Button>
          </div>
        </Shell>
      )}
    </div>
  );
}

/* דף A4 מוקטן לרוחב העמודה – הדף עצמו לא משתנה, כך שה-PDF יוצא בגודל מלא */
function ScaledSheet({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState({ scale: 1, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const inner = el.querySelector<HTMLElement>('.qs');
      if (!inner) return;
      const scale = Math.min(1, el.clientWidth / inner.offsetWidth);
      setS({ scale, h: inner.offsetHeight * scale });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const sheet = el.querySelector('.qs');
    if (sheet) ro.observe(sheet);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="qe-scale" ref={ref} style={{ height: s.h || undefined }}>
      <div className="qe-scale__in" style={{ transform: `scale(${s.scale})` }}>{children}</div>
    </div>
  );
}
