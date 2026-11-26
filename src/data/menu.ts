/* התפריט (settings/menu): עץ עם שלבים קבועים – קטגוריה ← סוג ← וריאציה ← סוג תוספת ← טקסט תוספות ← חלוקה.
   בלי מחירים (המחירים במחירונים). כולם קוראים, רק מנהל משנה (settings/{key} בכללים). מסמך אחד.
   בשלב הזה רק העורך – הבוחר בהזמנה (שלב 7ג) יקרא מכאן. השם נשמר כטקסט בהזמנה, אז שינוי בתפריט לא משנה הזמנות עבר. */
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type MenuOption = { id: string; name: string; active: boolean };
export type MenuItem = MenuOption & { variations: MenuOption[] };
export type MenuSteps = { variation: boolean; toppingKind: boolean; toppingText: boolean; split: boolean };
export type MenuCategory = { id: string; name: string; active: boolean; steps: MenuSteps; items: MenuItem[]; toppingKinds: MenuOption[] };
export type Menu = { categories: MenuCategory[] };

export const STEP_LABEL: Record<keyof MenuSteps, { title: string; hint: string }> = {
  variation: { title: 'וריאציה', hint: '' },
  toppingKind: { title: 'סוג תוספת', hint: '' },
  toppingText: { title: 'טקסט תוספות', hint: '' },
  split: { title: 'חלוקה', hint: '' },
};

export const newMenuId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const opt = (id: string, name: string): MenuOption => ({ id, name, active: true });
const item = (id: string, name: string, variations: MenuOption[] = []): MenuItem => ({ ...opt(id, name), variations });
const NO_STEPS: MenuSteps = { variation: false, toppingKind: false, toppingText: false, split: false };
const simple = (id: string, name: string): MenuCategory => ({ id, name, active: true, steps: NO_STEPS, items: [], toppingKinds: [] });

/* ברירת מחדל – לפי התוכנית. השמות כמו שהנציגים כותבים היום; מנהל משלים ומתקן בעורך */
export const DEFAULT_MENU: Menu = {
  categories: [
    {
      id: 'pizza', name: 'פיצות', active: true,
      steps: { variation: true, toppingKind: true, toppingText: true, split: true },
      items: [item('personal', 'אישית'), item('family', 'משפחתית'), item('family-thick', 'משפחתית עבה'), item('family-thin', 'משפחתית דקה'),
        item('volcano', 'וולקנו'), item('extra', 'אקסטרה'), item('cheesy', "צ'יזי קראסט")],
      toppingKinds: [opt('with', 'עם תוספת'), opt('without', 'ללא'), opt('meat', 'בשרית'), opt('mix', 'מיקס')],
    },
    simple('sides', 'ליד הפיצה'), simple('sandwiches', 'כריכים'), simple('desserts', 'קינוחים'), simple('drinks', 'משקאות'),
  ],
};
/* קטגוריות מערכת שלא נערכות כאן: משלוח (המנגנון הקיים – דמי משלוח ומדרגות) ו"שונות" (מוצר חופשי) */
export const SYSTEM_CATEGORIES = [{ id: 'delivery', name: 'משלוח' }, { id: 'misc', name: 'שונות' }];

/* קריאה בטוחה של מסמך שנשמר: רק אובייקטים, מזהה יציב (לפי מיקום) כשחסר, בלי מזהים כפולים, ורק השלבים המוכרים */
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
function opts(v: unknown, prefix: string): MenuOption[] {
  const seen = new Set<string>();
  return arr(v).map((x, i) => ({ id: typeof x.id === 'string' && x.id ? x.id : `${prefix}-${i}`, name: typeof x.name === 'string' ? x.name : '', active: x.active !== false }))
    .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}
function normalize(d: unknown): Menu {
  const cats = arr((d as { categories?: unknown })?.categories);
  if (!cats.length) return DEFAULT_MENU;
  const base = opts(cats, 'c');
  return {
    categories: base.map((c) => {
      const raw = cats.find((x) => x.id === c.id) ?? cats[base.indexOf(c)] ?? {};
      const st = (raw.steps && typeof raw.steps === 'object' ? raw.steps : {}) as Partial<MenuSteps>;
      const items = opts(raw.items, `${c.id}-i`);
      const rawItems = arr(raw.items);
      return {
        ...c,
        steps: { variation: !!st.variation, toppingKind: !!st.toppingKind, toppingText: !!st.toppingText, split: !!st.split },
        items: items.map((it, i) => ({ ...it, variations: opts((rawItems.find((x) => x.id === it.id) ?? rawItems[i] ?? {}).variations, `${it.id}-v`) })),
        toppingKinds: opts(raw.toppingKinds, `${c.id}-t`),
      };
    }),
  };
}

export function useMenu() {
  const [state, setState] = useState<{ menu: Menu; saved: boolean; loading: boolean; error: string }>({ menu: DEFAULT_MENU, saved: false, loading: true, error: '' });
  useEffect(() => onSnapshot(doc(db, 'settings', 'menu'),
    (s) => setState({ menu: s.exists() ? normalize(s.data()) : DEFAULT_MENU, saved: s.exists(), loading: false, error: '' }),
    () => setState((x) => ({ ...x, loading: false, error: 'אין הרשאה או אין חיבור' }))), []);
  return state;
}

/* מה תקין לשמירה: שם לכל קטגוריה / סוג / אפשרות, בלי שמות כפולים באותה רמה */
export function menuProblem(m: Menu): string {
  const dup = (xs: MenuOption[]) => { const seen = new Set<string>(); for (const x of xs) { const k = x.name.trim(); if (seen.has(k)) return k; seen.add(k); } return ''; };
  for (const c of m.categories) {
    if (!c.name.trim()) return 'יש קטגוריה בלי שם';
    for (const i of c.items) { if (!i.name.trim()) return `ב"${c.name}" יש סוג בלי שם`; if (i.variations.some((v) => !v.name.trim())) return `ב"${i.name}" יש וריאציה בלי שם`; }
    if (c.toppingKinds.some((t) => !t.name.trim())) return `ב"${c.name}" יש סוג תוספת בלי שם`;
    const d = dup(c.items) || c.items.map((i) => dup(i.variations)).find(Boolean) || dup(c.toppingKinds);
    if (d) return `השם "${d}" מופיע פעמיים ב"${c.name}"`;
  }
  const dc = dup(m.categories);
  return dc ? `הקטגוריה "${dc}" מופיעה פעמיים` : '';
}

const summary = (m: Menu) => m.categories.map((c) => `${c.name}: ${c.items.length}`).join(' · ').slice(0, 500);
export async function saveMenu(next: Menu, before: Menu) {
  const u = auth.currentUser!;
  const clean: Menu = { categories: next.categories.map((c) => ({
    ...c, name: c.name.trim(),
    items: c.items.map((i) => ({ ...i, name: i.name.trim(), variations: i.variations.map((v) => ({ ...v, name: v.name.trim() })) })),
    toppingKinds: c.toppingKinds.map((t) => ({ ...t, name: t.name.trim() })),
  })) };
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'menu'), { ...clean, updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'settings', entityId: 'menu', action: 'update', before: { categories: summary(before) },
    after: { categories: summary(clean) },
    source: 'form', by: u.uid, byName: u.displayName ?? u.email ?? '', at: serverTimestamp(), ok: true,
  });
  await batch.commit();
}
