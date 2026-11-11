/* צירוף מסמכים: גרירה או "בחר קובץ", עם סוג מסמך מתוך הרשימות (תעודת רכש, הצעת מחיר, חשבונית…).
   בטופס ההזמנה הקובץ נשמר יחד עם ההזמנה; בתיק ההזמנה ובתיק הלקוח – מיד. */
import { useRef, useState, type DragEvent } from 'react';
import { Download, ExternalLink, FileText, Paperclip, X } from 'lucide-react';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { useLists } from '../../data/lists';
import { ACCEPT, MAX_FILE, fileError, isOlderVersion, openOrderDoc, uploadDoc, useCustomerDocs, useOrderDocs, type OrderDoc } from '../../data/orderDocs';
import { Ltr, fmtDate, toISODate } from '../../lib/format';
import './OrderDocs.css';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export function FileDrop({ file, onFile, label = 'צרף תעודת רכש', busy }: { file: File | null; onFile: (f: File | null) => void; label?: string; busy?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');
  const take = (f: File | undefined) => {
    if (!f) return;
    const e = fileError(f) || (f.size > MAX_FILE * 4 ? 'הקובץ גדול מדי' : '');
    setErr(e);
    if (!e) onFile(f);
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); };

  if (file) {
    return (
      <div className="fdrop fdrop--file">
        <FileText size={16} aria-hidden="true" />
        <span className="fdrop__name">{file.name}</span>
        <span className="muted"><Ltr>{kb(file.size)}</Ltr></span>
        {busy ? <span className="muted">מעלה…</span> : <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר את ${file.name}`} onClick={() => onFile(null)}><X size={16} /></button>}
      </div>
    );
  }
  return (
    <>
      <div className={`fdrop ${over ? 'is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
        <Paperclip size={16} aria-hidden="true" />
        <span>גרור לכאן קובץ, או</span>
        <Button size="sm" type="button" onClick={() => input.current?.click()}>{label}</Button>
        <span className="muted fdrop__hint">PDF או תמונה, עד 2MB</span>
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {err && <span className="cform__err" role="alert">{err}</span>}
    </>
  );
}

/* רשימת מסמכים: חדש קודם, וגרסה קודמת מאותו סוג מסומנת */
function DocList({ docs, showOrder }: { docs: OrderDoc[]; showOrder?: boolean }) {
  const toast = useToast();
  const open = async (d: OrderDoc, download: boolean) => {
    try {
      const url = await openOrderDoc(d);
      if (download) { const a = document.createElement('a'); a.href = url; a.download = d.name; a.click(); }
      else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast({ tone: 'error', message: 'פתיחת הקובץ נכשלה' }); }
  };
  if (!docs.length) return null;
  return (
    <ul className="odocs__list">
      {docs.map((d) => {
        const old = isOlderVersion(d, docs);
        return (
          <li key={d.id} className={old ? 'is-old' : ''}>
            <FileText size={16} aria-hidden="true" />
            <span className="odocs__main">
              <b>{d.name}</b>
              <span className="muted">
                <span className="odocs__kind">{d.kindLabel ?? (d.kind === 'po' ? 'תעודת רכש' : d.kind)}</span>
                {showOrder && (d.orderId ? <> · הזמנה <Ltr>{d.orderId}</Ltr></> : <> · מסמך לקוח</>)}
                {' · '}<Ltr>{kb(d.size)}</Ltr> · {d.byName}{d.at && <> · <Ltr>{fmtDate(toISODate(d.at.toDate()))}</Ltr></>}{old && ' · גרסה קודמת'}
              </span>
            </span>
            <button className="icon-btn icon-btn--sm" aria-label={`פתח את ${d.name}`} onClick={() => open(d, false)}><ExternalLink size={16} /></button>
            <button className="icon-btn icon-btn--sm" aria-label={`הורד את ${d.name}`} onClick={() => open(d, true)}><Download size={16} /></button>
          </li>
        );
      })}
    </ul>
  );
}

/* העלאה עם בחירת סוג מסמך */
function Uploader({ target, defaultKind }: { target: { orderId?: number; customerId: string }; defaultKind: string }) {
  const toast = useToast();
  const { lists } = useLists();
  const kinds = (lists?.docTypes ?? []).filter((k) => k.active);
  const [kind, setKind] = useState(defaultKind);
  // סוג ברירת המחדל לא קיים ברשימה (למשל נמחק בהגדרות) – בוחרים את הראשון
  const effKind = kinds.some((k) => k.id === kind) || !kinds.length ? kind : kinds[0].id;
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const label = kinds.find((k) => k.id === effKind)?.label ?? 'מסמך';
  const upload = async (f: File | null) => {
    if (!f) return;
    setPending(f); setBusy(true);
    try {
      await uploadDoc({ ...target, kind: effKind, kindLabel: label }, f);
      toast({ message: <>{label} צורף{target.orderId != null ? <> להזמנה <Ltr>{target.orderId}</Ltr></> : ' לתיק הלקוח'}</> });
    } catch (e) { toast({ tone: 'error', message: e instanceof Error && e.message ? e.message : 'הצירוף נכשל – בדוק חיבור' }); }
    setBusy(false); setPending(null);
  };
  return (
    <div className="odocs__up">
      {kinds.length > 0 && (
        <label className="odocs__kindsel">
          <span className="field__label">סוג מסמך</span>
          <select className="input input--sm" value={effKind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
      )}
      <FileDrop file={pending} busy={busy} onFile={upload} label={`צרף ${label}`} />
    </div>
  );
}

/* בתיק ההזמנה */
export function OrderDocsSection({ orderId, customerId }: { orderId: number; customerId: string }) {
  const docs = useOrderDocs(orderId);
  return (
    <div className="odocs">
      {docs === null ? <p className="muted">טוען…</p> : <DocList docs={docs} />}
      <Uploader target={{ orderId, customerId }} defaultKind="po" />
    </div>
  );
}

/* בתיק הלקוח: מסמכים קבועים של הלקוח וכל מסמכי ההזמנות שלו */
export function CustomerDocsSection({ customerId, mergedFrom = [] }: { customerId: string; mergedFrom?: string[] }) {
  // כולל מסמכים של לקוחות שמוזגו לתוך הלקוח הזה
  const docs = useCustomerDocs([customerId, ...mergedFrom].slice(0, 30));
  const [view, setView] = useState<'all' | 'customer' | 'orders'>('all');
  const list = (docs ?? []).filter((d) => view === 'all' || (view === 'customer' ? !d.orderId : !!d.orderId));
  return (
    <div className="card odocs odocs--card">
      <div className="card__head">
        <h2 className="card__title">מסמכים</h2>
        <div className="seg seg--sm-text" role="group" aria-label="סינון מסמכים">
          {([['all', 'הכל'], ['customer', 'של הלקוח'], ['orders', 'של הזמנות']] as const).map(([k, l]) => (
            <button key={k} className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="odocs__body">
        {docs === null ? <p className="muted">טוען…</p> : list.length ? <DocList docs={list} showOrder /> : <p className="muted odocs__empty">אין עדיין מסמכים{view === 'orders' ? ' בהזמנות' : view === 'customer' ? ' קבועים' : ''}.</p>}
        <p className="odocs__hint">מסמך קבוע של הלקוח – למשל הסכם מחיר או טופס פתיחת הקפה:</p>
        <Uploader target={{ customerId }} defaultKind="agreement" />
      </div>
    </div>
  );
}
