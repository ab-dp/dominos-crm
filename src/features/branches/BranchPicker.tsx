/* בחירת סניף בתוך הזמנה (אפיון 6.10): רשימה עם חיפוש תוך כדי הקלדה, כל סניף עם האשכול שלו,
   הסניף המועדף ראשון, ובתחתית "+ הוסף סניף / אשכול חדש" – בלי לצאת מהטופס. */
import { useId, useMemo, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, Plus, Star } from 'lucide-react';
import { addBranch, addCluster, useBranches, useClusters, type Branch } from '../../data/branches';
import { Button, Field } from '../../design/components';
import { useToast } from '../../design/Toast';
import { cleanPhone, findSimilar, phoneError } from '../../lib/names';
import { DupePrompt } from './BranchesPage';
import './BranchPicker.css';

export type BranchChoice = { branchId: string; clusterId: string };

export function BranchPicker({ value, onChange, preferredId, label = 'סניף' }: {
  value: BranchChoice | null; onChange: (v: BranchChoice) => void; preferredId?: string; label?: string;
}) {
  const { items: branches } = useBranches();
  const { items: clusters } = useClusters();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const clusterName = (id: string) => clusters.find((c) => c.id === id)?.name ?? '';
  const selected = branches.find((b) => b.id === value?.branchId);

  const options = useMemo(() => {
    const s = q.trim();
    const list = branches.filter((b) => b.active && (!s || b.name.includes(s) || clusterName(b.clusterId).includes(s)));
    return list.sort((a, b) => (a.id === preferredId ? -1 : b.id === preferredId ? 1 : a.name.localeCompare(b.name, 'he')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, clusters, q, preferredId]);

  const total = options.length + 1;
  const pick = (i: number) => {
    if (i < options.length) {
      const b = options[i];
      onChange({ branchId: b.id, clusterId: b.clusterId });
      setOpen(false); setQ('');
    } else {
      setOpen(false);
      setAdding(q.trim());
    }
  };

  return (
    <div className="bpick">
      <span className="field__label" id={`${listId}-label`}>{label}</span>
      <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
        <Popover.Trigger asChild>
          <button type="button" className="bpick__trigger" aria-labelledby={`${listId}-label`} aria-haspopup="listbox" aria-expanded={open}>
            {selected ? (
              <span className="bpick__value"><b>{selected.name}</b><span className="bpick__cluster">{clusterName(selected.clusterId)}</span></span>
            ) : <span className="bpick__placeholder">בחר סניף…</span>}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="pop bpick__pop" align="start" sideOffset={4} dir="rtl" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
            <input
              ref={inputRef}
              className="input input--sm"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              placeholder="הקלד שם סניף או אשכול"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={`${listId}-${active}`}
              aria-label="חיפוש סניף"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % total); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + total) % total); }
                if (e.key === 'Enter') { e.preventDefault(); pick(active); }
              }}
            />
            <ul className="bpick__list" id={listId} role="listbox" aria-label="סניפים">
              {options.map((b, i) => (
                <li key={b.id} id={`${listId}-${i}`} role="option" aria-selected={value?.branchId === b.id}
                  className={`bpick__opt ${active === i ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                  <span className="bpick__check">{value?.branchId === b.id && <Check size={14} />}</span>
                  <span className="bpick__name">{b.name}</span>
                  {b.id === preferredId && <span className="bpick__pref"><Star size={12} aria-hidden="true" /> מועדף</span>}
                  <span className="bpick__cluster">{clusterName(b.clusterId)}</span>
                </li>
              ))}
              {options.length === 0 && <li className="bpick__none">{q ? `לא נמצא סניף בשם "${q}"` : 'אין עדיין סניפים פעילים'}</li>}
              <li id={`${listId}-${options.length}`} role="option" aria-selected={false}
                className={`bpick__opt bpick__add ${active === options.length ? 'is-active' : ''}`} onMouseEnter={() => setActive(options.length)} onClick={() => pick(options.length)}>
                <Plus size={16} aria-hidden="true" /> הוסף סניף / אשכול חדש{q && <> · "{q}"</>}
              </li>
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {adding !== null && (
        <QuickAddBranch
          initialName={adding}
          branches={branches}
          onClose={() => setAdding(null)}
          onAdded={(b) => { onChange(b); setAdding(null); }}
        />
      )}
    </div>
  );
}

/* חלון קטן: שם הסניף (מולא ממה שהוקלד) · אשכול מהרשימה או "+ אשכול חדש" באותו חלון */
function QuickAddBranch({ initialName, branches, onClose, onAdded }: {
  initialName: string; branches: Branch[]; onClose: () => void; onAdded: (v: BranchChoice) => void;
}) {
  const { items: clusters } = useClusters();
  const toast = useToast();
  const active = clusters.filter((c) => c.active);
  const [name, setName] = useState(initialName);
  const [clusterId, setClusterId] = useState(active[0]?.id ?? '__new');
  const [newCluster, setNewCluster] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [dupe, setDupe] = useState<Branch | null>(null);
  const [clusterDupe, setClusterDupe] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const isNewCluster = clusterId === '__new' || active.length === 0;

  const save = async (force = false) => {
    if (!name.trim()) return setErr('חובה: שם הסניף');
    if (isNewCluster && !newCluster.trim()) return setErr('חובה: שם האשכול החדש');
    const pErr = phoneError(phone); if (pErr) return setErr(pErr);
    if (!force) {
      const sb = findSimilar(name, branches);
      if (sb) return setDupe(sb);
      if (isNewCluster) { const sc = findSimilar(newCluster, clusters); if (sc) return setClusterDupe(sc); }
    }
    setBusy(true);
    try {
      const cid = isNewCluster ? await addCluster(newCluster) : clusterId;
      const id = await addBranch({ name, clusterId: cid, phone: cleanPhone(phone) }, 'form');
      toast({ message: <>סניף "{name.trim()}" נוסף ונבחר בהזמנה</> });
      onAdded({ branchId: id, clusterId: cid });
    } catch { setErr('השמירה נכשלה – אין הרשאה או אין חיבור'); setBusy(false); }
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog" dir="rtl" aria-describedby="qab-desc">
          <Dialog.Title className="udialog__title">סניף חדש</Dialog.Title>
          <p id="qab-desc" className="muted">הסניף נוסף לרשימה הקבועה ונבחר בהזמנה מיד.</p>
          <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); save(); }}>
            <Field label="שם הסניף (חובה)">
              <input className="input" autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(''); setDupe(null); }} placeholder="עיר – רחוב" />
            </Field>
            {dupe && (
              <DupePrompt existing={dupe.name} kind="סניף" onUseExisting={() => onAdded({ branchId: dupe.id, clusterId: dupe.clusterId })} onCreateAnyway={() => { setDupe(null); save(true); }} />
            )}
            <Field label="אשכול (חובה)">
              <select className="input" value={isNewCluster ? '__new' : clusterId} onChange={(e) => { setClusterId(e.target.value); setErr(''); }}>
                {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new">+ אשכול חדש</option>
              </select>
            </Field>
            {isNewCluster && (
              <Field label="שם האשכול החדש">
                <input className="input" value={newCluster} onChange={(e) => { setNewCluster(e.target.value); setClusterDupe(null); setErr(''); }} placeholder="למשל שרון" />
              </Field>
            )}
            {clusterDupe && (
              <DupePrompt existing={clusterDupe.name} kind="אשכול" onUseExisting={() => { setClusterId(clusterDupe.id); setClusterDupe(null); setNewCluster(''); }} onCreateAnyway={() => { setClusterDupe(null); save(true); }} />
            )}
            <Field label="טלפון (לא חובה)">
              <input className="input input--ltr" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(''); }} placeholder="03-1234567" />
            </Field>
            {err && <p className="pop__err" role="alert">{err}</p>}
            <div className="udialog__actions">
              <Button type="submit" variant="primary" loading={busy}>הוסף ובחר</Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">ביטול</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
