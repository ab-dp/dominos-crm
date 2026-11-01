/* חיפוש גלובלי כפלטת פקודות: מס' הזמנה, מס' Q, שם לקוח, טלפון, טלפון הקפה. חיצים + Enter. */
import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CornerDownLeft, FileText, Search, UserPlus } from 'lucide-react';
import { useStore } from '../data/store';
import { Ltr, fmtDate } from '../lib/format';
import { STATUS_LABEL } from '../data/types';

export function CommandSearch({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (id: number) => void }) {
  const { orders, openNewOrder } = useStore();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orders.filter((o) => o.health === 'critical' || o.health === 'urgent').slice(0, 6);
    const digits = s.replace(/\D/g, '');
    return orders.filter((o) =>
      String(o.id).includes(s) ||
      o.customerName.toLowerCase().includes(s) ||
      (o.qNumber ?? '').toLowerCase().includes(s) ||
      (digits.length >= 3 && ((o.contactPhone ?? '').includes(digits) || (o.accountPhone ?? '').includes(digits))),
    ).slice(0, 8);
  }, [q, orders]);

  const total = results.length + 1; // + "הזמנה ללקוח חדש"
  const pick = (i: number) => {
    if (i < results.length) onPick(results[i].id);
    else { onOpenChange(false); openNewOrder({ mode: 'newCustomer', customerName: /d{3}/.test(q) ? '' : q.trim() }); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setQ(''); setActive(0); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="cmd" dir="rtl" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">חיפוש</Dialog.Title>
          <div className="cmd__input">
            <Search size={20} aria-hidden="true" />
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              placeholder="הקלד מס' הזמנה, מס' Q, שם לקוח או טלפון"
              aria-label="חיפוש"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmd-list"
              aria-activedescendant={`cmd-${active}`}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % total); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + total) % total); }
                if (e.key === 'Enter') { e.preventDefault(); pick(active); }
              }}
            />
          </div>
          <p className="cmd__group">{q ? 'הזמנות' : 'דורש טיפול עכשיו'}</p>
          <ul className="cmd__list" id="cmd-list" role="listbox">
            {results.map((o, i) => (
              <li key={o.id} id={`cmd-${i}`} role="option" aria-selected={active === i}
                className={`cmd__item ${active === i ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                <FileText size={18} aria-hidden="true" />
                <span className="cmd__main">
                  <span>{o.customerName}</span>
                  <span className="cmd__meta">הזמנה <Ltr>{o.id}</Ltr> · <Ltr>{fmtDate(o.date)}</Ltr> <Ltr>{o.time}</Ltr> · {o.branchName}{o.qNumber && <> · <Ltr>{o.qNumber}</Ltr></>}</span>
                </span>
                <span className="cmd__status">{STATUS_LABEL[o.status]}</span>
                {active === i && <CornerDownLeft size={16} className="cmd__enter" aria-hidden="true" />}
              </li>
            ))}
            {q && results.length === 0 && <li className="cmd__none">לא נמצאה הזמנה מתאימה</li>}
            <li id={`cmd-${results.length}`} role="option" aria-selected={active === results.length}
              className={`cmd__item cmd__item--new ${active === results.length ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(results.length)} onClick={() => pick(results.length)}>
              <UserPlus size={18} aria-hidden="true" />
              <span className="cmd__main"><span>הזמנה ללקוח חדש{q && <> · "{q}"</>}</span></span>
            </li>
          </ul>
          <div className="cmd__foot"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> מעבר · <kbd className="kbd">Enter</kbd> פתיחה · <kbd className="kbd">Esc</kbd> סגירה</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
