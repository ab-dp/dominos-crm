/* צירוף תעודת רכש: גרירה או "בחר קובץ". בטופס ההזמנה הקובץ נשמר יחד עם ההזמנה; בתיק ההזמנה – מיד. */
import { useRef, useState, type DragEvent } from 'react';
import { Download, ExternalLink, FileText, Paperclip, X } from 'lucide-react';
import { Button } from '../../design/components';
import { useToast } from '../../design/Toast';
import { ACCEPT, MAX_FILE, fileError, openOrderDoc, uploadOrderDoc, useOrderDocs, type OrderDoc } from '../../data/orderDocs';
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
        <FileText size={18} aria-hidden="true" />
        <span className="fdrop__name">{file.name}</span>
        <span className="muted"><Ltr>{kb(file.size)}</Ltr></span>
        {!busy && <button type="button" className="icon-btn icon-btn--sm" aria-label={`הסר את ${file.name}`} onClick={() => onFile(null)}><X size={16} /></button>}
      </div>
    );
  }
  return (
    <>
      <div className={`fdrop ${over ? 'is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
        <Paperclip size={18} aria-hidden="true" />
        <span>גרור לכאן קובץ, או</span>
        <Button size="sm" type="button" onClick={() => input.current?.click()}>{label}</Button>
        <span className="muted fdrop__hint">PDF או תמונה, עד 2MB</span>
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {err && <span className="cform__err" role="alert">{err}</span>}
    </>
  );
}

/* בתיק ההזמנה: המסמכים שצורפו + העלאה מיידית */
export function OrderDocsSection({ orderId }: { orderId: number }) {
  const docs = useOrderDocs(orderId);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);

  const upload = async (f: File | null) => {
    if (!f) return;
    setPending(f); setBusy(true);
    try { await uploadOrderDoc(orderId, f); toast({ message: <>תעודת הרכש צורפה להזמנה <Ltr>{orderId}</Ltr></> }); }
    catch (e) { toast({ message: e instanceof Error && e.message ? e.message : 'הצירוף נכשל – בדוק חיבור' }); }
    setBusy(false); setPending(null);
  };
  const open = async (d: OrderDoc, download: boolean) => {
    try {
      const url = await openOrderDoc(d);
      if (download) { const a = document.createElement('a'); a.href = url; a.download = d.name; a.click(); }
      else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast({ message: 'פתיחת הקובץ נכשלה' }); }
  };

  return (
    <div className="odocs">
      {docs === null ? <p className="muted">טוען…</p> : docs.length > 0 && (
        <ul className="odocs__list">
          {docs.map((d, i) => (
            <li key={d.id} className={i > 0 ? 'is-old' : ''}>
              <FileText size={18} aria-hidden="true" />
              <span className="odocs__main">
                <b>{d.name}</b>
                <span className="muted">תעודת רכש · <Ltr>{kb(d.size)}</Ltr> · {d.byName}{d.at && <> · <Ltr>{fmtDate(toISODate(d.at.toDate()))}</Ltr></>}{i > 0 && ' · גרסה קודמת'}</span>
              </span>
              <button className="icon-btn icon-btn--sm" aria-label={`פתח את ${d.name}`} onClick={() => open(d, false)}><ExternalLink size={16} /></button>
              <button className="icon-btn icon-btn--sm" aria-label={`הורד את ${d.name}`} onClick={() => open(d, true)}><Download size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <FileDrop file={pending} busy={busy} onFile={upload} label={docs?.length ? 'צרף תעודה חדשה' : 'צרף תעודת רכש'} />
    </div>
  );
}
