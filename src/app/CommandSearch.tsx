/* חיפוש גלובלי כפלטת פקודות: הזמנות (מס' הזמנה, מס' Q, שם, טלפון), הצעות מחיר, לקוחות ולקוחות פוטנציאליים. חיצים + Enter.
   לקוחות ולידים נטענים רק כשהחלון פתוח – בלי קריאות מהשרת כל עוד לא מחפשים.
   מספר הזמנה/הצעה, מס' Q או מספר קריאה שלא נמצאים ברשימה החיה (מלפני החודש הקודם) – נבדקים מול השרת, עד שלוש קריאות לחיפוש */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fromDoc as orderFromDoc } from '../data/orders';
import { callRefMatch } from '../data/channels';
import { SHORT_STATUS, fromDoc as quoteFromDoc, type Quote } from '../data/quotes';
import type { Order } from '../data/types';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileSignature, FileText, History, Search, Target, UserPlus, UserRound } from 'lucide-react';
import { useStore } from '../data/store';
import { useCustomers } from '../data/customers';
import { STAGE_LABEL, useLeads } from '../data/leads';
import { Ltr, fmtDate } from '../lib/format';
import { STAGE_LABEL as ORDER_STAGE, stageOf } from '../data/types';

type Item = { key: string; group: string; icon: ReactNode; title: string; meta: ReactNode; tag?: string; run: () => void };

export function CommandSearch({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (id: number) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="cmd" dir="rtl" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">חיפוש</Dialog.Title>
          <SearchBody close={() => onOpenChange(false)} onPick={onPick} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SearchBody({ close, onPick }: { close: () => void; onPick: (id: number) => void }) {
  const { orders, quotes, openNewOrder } = useStore();
  const { items: customers } = useCustomers();
  const { items: leads } = useLeads();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<Item[]>([]);

  const orderItem = (o: Order, group: string): Item => ({
    key: `o${o.id}`, group, icon: <FileText size={16} aria-hidden="true" />, title: o.customerName,
    meta: <>הזמנה <Ltr>{o.id}</Ltr> · <Ltr>{fmtDate(o.date)}</Ltr> <Ltr>{o.time}</Ltr> · {o.branchName}{o.qNumber && <> · <Ltr>{o.qNumber}</Ltr></>}{o.callRef && <> · קריאה <Ltr>{o.callRef}</Ltr></>}</>,
    tag: ORDER_STAGE[stageOf(o)], run: () => onPick(o.id),
  });
  const quoteItem = (x: Quote): Item => ({
    key: `q${x.id}`, group: 'הצעות מחיר', icon: <FileSignature size={16} aria-hidden="true" />, title: x.customer.name || 'ללא לקוח',
    meta: <>הצעה <Ltr>{x.id}</Ltr>{x.date && <> · <Ltr>{fmtDate(x.date)}</Ltr></>}</>, tag: SHORT_STATUS[x.status],
    run: () => { close(); nav(`/quotes/${x.id}`); },
  });

  /* חיפוש בשרת: מספר (4–7 ספרות) – הזמנה והצעה באותו מספר; מס' Q (אותיות ואז ספרות, למשל cs669) – הזמנה לפי Q.
     שאילתה של 3–60 תווים שיש בה ספרה – גם הזמנה לפי מספר קריאה (callRef, שוויון מדויק – בלי אינדקס).
     חיפוש שם לא שולח שאילתה לשרת, כדי לא לבזבז קריאות */
  useEffect(() => {
    const raw = q.trim();
    setRemote([]);
    const isNum = /^\d{4,7}$/.test(raw);
    const isQ = !isNum && /^[a-z]{1,4}\d{2,}$/i.test(raw);
    const isRef = raw.length >= 3 && raw.length <= 60 && /d/.test(raw);
    if (!isNum && !isQ && !isRef) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const out: Item[] = [];
        const [o, qt, qs, refs] = await Promise.all([
          isNum ? getDoc(doc(db, 'orders', raw)) : null, isNum ? getDoc(doc(db, 'quotes', raw)) : null,
          isQ ? getDocs(query(collection(db, 'orders'), where('qNumber', 'in', [...new Set([raw, raw.toLowerCase(), raw.toUpperCase()])]), limit(3))) : null,
          isRef ? getDocs(query(collection(db, 'orders'), where('callRef', '==', raw), limit(3))) : null,
        ]);
        const add = (id: string, data: DocumentData) => { if (!out.some((x) => x.key === `o${id}`)) out.push(orderItem(orderFromDoc(id, data), 'הזמנות')); };
        if (o?.exists()) add(o.id, o.data());
        qs?.docs.forEach((d) => add(d.id, d.data()));
        refs?.docs.forEach((d) => add(d.id, d.data()));
        if (qt?.exists()) out.push(quoteItem(quoteFromDoc(qt.id, qt.data())));
        if (alive) setRemote(out);
      } catch { /* בלי חיבור – נשארות התוצאות מהרשימה החיה */ }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const results = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, '');
    const phoneHit = (p?: string) => digits.length >= 3 && !!p && p.includes(digits);
    if (!s) return orders.filter((o) => o.health === 'critical' || o.health === 'urgent').slice(0, 6).map((o) => orderItem(o, 'דורש טיפול עכשיו'));
    const os = orders.filter((o) =>
      String(o.id).includes(s) || o.customerName.toLowerCase().includes(s) || (o.qNumber ?? '').toLowerCase().includes(s) || callRefMatch(o, s)
      || phoneHit(o.contactPhone) || phoneHit(o.accountPhone)).slice(0, 6).map((o) => orderItem(o, 'הזמנות'));
    const qs = quotes.filter((x) => (digits.length >= 3 && String(x.id).includes(digits)) || (s.length >= 2 && x.customer.name.toLowerCase().includes(s)))
      .slice(0, 3).map(quoteItem);
    const cs = customers.filter((c) => c.status !== 'merged' && (c.name.toLowerCase().includes(s) || (digits.length >= 5 && c.taxId.includes(digits))
      || phoneHit(c.accountPhone) || c.contacts.some((x) => phoneHit(x.phone) || (s.length >= 2 && x.name.toLowerCase().includes(s)))))
      .slice(0, 4).map<Item>((c) => ({
        key: `c${c.id}`, group: 'לקוחות', icon: <UserRound size={16} aria-hidden="true" />, title: c.name,
        meta: <>{c.type === 'regular' ? 'לקוח קבוע' : 'לקוח מזדמן'}{c.taxId && <> · ח.פ <Ltr>{c.taxId}</Ltr></>}{c.status === 'inactive' && ' · לא פעיל'}</>,
        run: () => { close(); nav(`/customers/${c.id}`); },
      }));
    /* הזמנות ישנות לפי שם לקוח: תיק הלקוח מכיל את כל ההיסטוריה – קיצור ישר ללשונית ההזמנות, בלי קריאות נוספות */
    const top = cs[0] && customers.find((c) => `c${c.id}` === cs[0].key);
    const history: Item[] = top && s.length >= 2 && !/^\d+$/.test(s) ? [{
      key: `h${top.id}`, group: 'הזמנות', icon: <History size={16} aria-hidden="true" />, title: `כל ההזמנות של ${top.name}`,
      meta: 'כולל הזמנות ישנות – בתיק הלקוח', run: () => { close(); nav(`/customers/${top.id}?tab=orders`); },
    }] : [];
    const ls = leads.filter((l) => l.stage !== 'won' && (l.name.toLowerCase().includes(s) || l.contacts.some((x) => phoneHit(x.phone) || (s.length >= 2 && x.name.toLowerCase().includes(s)))))
      .slice(0, 3).map<Item>((l) => ({
        key: `l${l.id}`, group: 'לקוחות פוטנציאליים', icon: <Target size={16} aria-hidden="true" />, title: l.name,
        meta: <>{l.nextStep ? <>צעד הבא: {l.nextStep.text}</> : STAGE_LABEL[l.stage]}</>, tag: STAGE_LABEL[l.stage],
        run: () => { close(); nav(`/leads/${l.id}`); },
      }));
    /* מהשרת – רק מה שלא נמצא כבר ברשימה, בקבוצה שלו */
    const extra = remote.filter((r) => ![...os, ...qs].some((x) => x.key === r.key));
    return [...os, ...extra.filter((r) => r.key.startsWith('o')), ...history, ...qs, ...extra.filter((r) => r.key.startsWith('q')), ...cs, ...ls];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, orders, quotes, customers, leads, remote, onPick, close, nav]);

  const total = results.length + 1; // + "הזמנה ללקוח חדש"
  const pick = (i: number) => {
    if (i < results.length) results[i].run();
    else { close(); openNewOrder({ mode: 'newCustomer', customerName: /\d{3}/.test(q) ? '' : q.trim() }); }
  };

  return (
    <>
      <div className="cmd__input">
        <Search size={20} aria-hidden="true" />
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          placeholder="מס' הזמנה, מס' Q, מס' קריאה, הצעה, לקוח, ליד או טלפון"
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
      <ul className="cmd__list" id="cmd-list" role="listbox" aria-label="תוצאות">
        {results.map((r, i) => (
          <li key={r.key} role="presentation">
            {(i === 0 || results[i - 1].group !== r.group) && <p className="cmd__group" aria-hidden="true">{r.group}</p>}
            <div id={`cmd-${i}`} role="option" aria-selected={active === i}
              className={`cmd__item ${active === i ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
              {r.icon}
              <span className="cmd__main">
                <span>{r.title}</span>
                <span className="cmd__meta">{r.meta}</span>
              </span>
              {r.tag && <span className="cmd__status">{r.tag}</span>}
              {active === i && <CornerDownLeft size={16} className="cmd__enter" aria-hidden="true" />}
            </div>
          </li>
        ))}
        {q && results.length === 0 && <li className="cmd__none">לא נמצאה תוצאה</li>}
        <li role="presentation">
          <div id={`cmd-${results.length}`} role="option" aria-selected={active === results.length}
            className={`cmd__item cmd__item--new ${active === results.length ? 'is-active' : ''}`}
            onMouseEnter={() => setActive(results.length)} onClick={() => pick(results.length)}>
            <UserPlus size={16} aria-hidden="true" />
            <span className="cmd__main"><span>הזמנה ללקוח חדש{q && !/\d{3}/.test(q) && <> · "{q}"</>}</span></span>
          </div>
        </li>
      </ul>
      <div className="cmd__foot"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> מעבר · <kbd className="kbd">Enter</kbd> פתיחה · <kbd className="kbd">Esc</kbd> סגירה</div>
    </>
  );
}
