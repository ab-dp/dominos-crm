/* לקוחות פוטנציאליים (אפיון 19.1, שלב 11). ליד עובר שלבים עד "לקוח פעיל" או "לא רלוונטי".
   אין ליד פתוח בלי צעד הבא עם תאריך – נאכף גם בכללי האבטחה. הצעד הבא הופך למשימה במסך החריגים והמשימות.
   אין מחיקה: ליד נסגר כ"לא רלוונטי" (עם סיבה) או "הפך ללקוח" (עם קישור ללקוח שנוצר). */
import { useEffect, useState } from 'react';
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Timestamp, type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { cleanTaxId } from '../lib/taxid';
import { isSimilar } from '../lib/names';
import { EMPTY_CUSTOMER, newId, type Contact, type CustomerInput } from './customers';
import { addTaskTo } from './tasks';

export type LeadStage = 'new' | 'contacted' | 'proposal' | 'trial' | 'won' | 'lost';
export const STAGES: { id: LeadStage; label: string }[] = [
  { id: 'new', label: 'חדש' },
  { id: 'contacted', label: 'נוצר קשר' },
  { id: 'proposal', label: 'הוצגה הצעה' },
  { id: 'trial', label: 'הזמנת ניסיון' },
  { id: 'won', label: 'לקוח פעיל' },
  { id: 'lost', label: 'לא רלוונטי' },
];
export const OPEN_STAGES: LeadStage[] = ['new', 'contacted', 'proposal', 'trial'];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<LeadStage, string>;
export const isOpen = (l: Pick<Lead, 'stage'>) => OPEN_STAGES.includes(l.stage);

export type LeadContact = { id: string; name: string; role: string; phone: string; email: string; decider: boolean };
export type NextStep = { text: string; due: string };

export type Lead = {
  id: string;
  name: string;
  taxId: string;
  field: string; // מזהה מרשימת התחומים
  size: number; // מספר עובדים, 0 = לא ידוע
  area: string;
  branchId: string; // הסניף הקרוב
  source: string; // מזהה מרשימת מקורות הלידים
  contacts: LeadContact[];
  potentialOrders: number; // הזמנות בחודש
  potentialAmount: number; // ₪ בחודש
  tags: string[];
  notes: string;
  stage: LeadStage;
  nextStep: NextStep | null;
  lostReason?: string;
  lostNote?: string;
  customerId?: string; // אחרי הפיכה ללקוח
  ownerUid: string;
  ownerName: string;
  stageAt?: Timestamp;
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
};

export type LeadInput = Omit<Lead, 'id' | 'stage' | 'lostReason' | 'lostNote' | 'customerId' | 'stageAt' | 'createdAt' | 'createdBy' | 'updatedAt'>;

export const EMPTY_LEAD: LeadInput = {
  name: '', taxId: '', field: '', size: 0, area: '', branchId: '', source: '', contacts: [], potentialOrders: 0, potentialAmount: 0,
  tags: [], notes: '', nextStep: null, ownerUid: '', ownerName: '',
};

export type LeadActivityKind = 'call' | 'whatsapp' | 'email' | 'meeting' | 'sample' | 'note' | 'stage';
export const ACTIVITY_LABEL: Record<LeadActivityKind, string> = {
  call: 'שיחה', whatsapp: 'וואטסאפ', email: 'מייל', meeting: 'פגישה', sample: 'דוגמה / טעימה', note: 'הערה', stage: 'מעבר שלב',
};
export type LeadActivity = {
  id: string; kind: LeadActivityKind; text: string;
  asked?: string; objections?: string; outcome?: string;
  nextStep?: NextStep; stage?: LeadStage;
  by: string; byName: string; at?: Timestamp;
};

export const deciderOf = (l: Pick<Lead, 'contacts'>) => l.contacts.find((c) => c.decider) ?? l.contacts[0];

/* ---------- קריאה חיה ---------- */
export function useLeads() {
  const [state, setState] = useState<{ items: Lead[]; loading: boolean; error: string }>({ items: [], loading: true, error: '' });
  useEffect(() => onSnapshot(collection(db, 'leads'),
    (s) => setState({ items: s.docs.map((d) => ({ ...EMPTY_LEAD, stage: 'new', id: d.id, ...d.data() }) as Lead).sort((a, b) => a.name.localeCompare(b.name, 'he')), loading: false, error: '' }),
    () => setState({ items: [], loading: false, error: 'אין הרשאה או אין חיבור' })), []);
  return state;
}

export function useLeadActivity(leadId: string) {
  const [items, setItems] = useState<LeadActivity[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'leads', leadId, 'activity'), orderBy('at', 'desc')),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as LeadActivity)), () => setItems([])), [leadId]);
  return items;
}

export type LeadAuditRow = { id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; byName: string; at?: Timestamp; note?: string };
export function useLeadHistory(leadId: string) {
  const [items, setItems] = useState<LeadAuditRow[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'auditLog'), where('entity', '==', 'lead'), where('entityId', '==', leadId)),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as LeadAuditRow).sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0))),
    () => setItems([])), [leadId]);
  return items;
}

/* ---------- כתיבה – תמיד יחד עם רשומת יומן ---------- */
const me = () => { const u = auth.currentUser!; return { uid: u.uid, name: u.displayName ?? u.email ?? '' }; };

function audit(batch: WriteBatch, entityId: string, action: string, before: unknown, after: unknown, note?: string) {
  const u = me();
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'lead', entityId, action, before: before ?? null, after: after ?? null, source: 'form', ...(note ? { note } : {}),
    by: u.uid, byName: u.name, at: serverTimestamp(), ok: true,
  });
}

function normalize(input: LeadInput): LeadInput {
  return {
    ...input, name: input.name.trim(), taxId: cleanTaxId(input.taxId), area: input.area.trim(), notes: input.notes.trim(),
    contacts: input.contacts.filter((c) => c.name.trim() || c.phone).map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.replace(/\D/g, ''), email: c.email.trim(), role: c.role.trim() })),
    tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
    nextStep: input.nextStep ? { text: input.nextStep.text.trim(), due: input.nextStep.due } : null,
  };
}

/* כל המשימות הפתוחות של הליד נסגרות כשנקבע צעד הבא חדש או כשהליד נסגר – כדי שלא יצטברו משימות ישנות */
async function closeLeadTasks(batch: WriteBatch, leadId: string) {
  const u = me();
  const open = await getDocs(query(collection(db, 'tasks'), where('leadId', '==', leadId), where('done', '==', false)));
  open.docs.forEach((d) => batch.update(d.ref, { done: true, doneBy: u.uid, doneByName: u.name, doneAt: serverTimestamp() }));
}

function stepTask(batch: WriteBatch, leadId: string, leadName: string, step: NextStep) {
  addTaskTo(batch, { customerId: '', leadId, customerName: leadName, text: step.text, due: step.due });
}

export async function createLead(raw: LeadInput, stage: LeadStage = 'new'): Promise<string> {
  const input = normalize(raw);
  const u = me();
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'leads'));
  batch.set(ref, {
    ...input, ownerUid: input.ownerUid || u.uid, ownerName: input.ownerName || u.name, stage,
    stageAt: serverTimestamp(), createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid,
  });
  if (input.nextStep) stepTask(batch, ref.id, input.name, input.nextStep);
  audit(batch, ref.id, 'create', null, { name: input.name, stage });
  await batch.commit();
  return ref.id;
}

/* עדכון פרטים: רק השדות ששונו, עם ערך קודם ← חדש ביומן. צעד הבא חדש מחליף את המשימה הקודמת */
export async function updateLead(l: Lead, raw: Partial<LeadInput>) {
  const next = normalize({ ...l, ...raw });
  const changed = Object.fromEntries(Object.keys(raw).map((k) => [k, next[k as keyof LeadInput]])
    .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(l[k as keyof Lead])));
  if (!Object.keys(changed).length) return;
  const u = me();
  const batch = writeBatch(db);
  batch.update(doc(db, 'leads', l.id), { ...changed, updatedAt: serverTimestamp(), updatedBy: u.uid });
  if ('nextStep' in changed && next.nextStep && isOpen(l)) {
    await closeLeadTasks(batch, l.id);
    stepTask(batch, l.id, next.name, next.nextStep);
  }
  const before = Object.fromEntries(Object.keys(changed).map((k) => [k, l[k as keyof Lead] ?? null]));
  audit(batch, l.id, 'update', before, changed);
  await batch.commit();
}

/* תיעוד פעילות: צעד הבא חובה בליד פתוח. אפשר גם להעביר שלב באותה פעולה */
export async function addLeadActivity(l: Lead, a: Pick<LeadActivity, 'kind' | 'text' | 'asked' | 'objections' | 'outcome'>, nextStep: NextStep, stage?: LeadStage) {
  const u = me();
  const batch = writeBatch(db);
  const step = { text: nextStep.text.trim(), due: nextStep.due };
  const clean = (s?: string) => (s ?? '').trim();
  batch.set(doc(collection(db, 'leads', l.id, 'activity')), {
    kind: a.kind, text: a.text.trim(),
    ...(clean(a.asked) ? { asked: clean(a.asked) } : {}), ...(clean(a.objections) ? { objections: clean(a.objections) } : {}), ...(clean(a.outcome) ? { outcome: clean(a.outcome) } : {}),
    nextStep: step, ...(stage && stage !== l.stage ? { stage } : {}),
    by: u.uid, byName: u.name, at: serverTimestamp(),
  });
  const patch: Record<string, unknown> = { nextStep: step, updatedAt: serverTimestamp(), updatedBy: u.uid };
  if (stage && stage !== l.stage) { patch.stage = stage; patch.stageAt = serverTimestamp(); }
  batch.update(doc(db, 'leads', l.id), patch);
  await closeLeadTasks(batch, l.id);
  stepTask(batch, l.id, l.name, step);
  audit(batch, l.id, stage && stage !== l.stage ? 'stage' : 'activity', { stage: l.stage, nextStep: l.nextStep }, { ...(stage && stage !== l.stage ? { stage } : {}), nextStep: step, kind: a.kind });
  await batch.commit();
}

/* מעבר שלב (גרירה בלוח או בחירה בתיק) – בין השלבים הפתוחים, תמיד עם צעד הבא */
export async function moveLead(l: Lead, stage: LeadStage, nextStep: NextStep) {
  const u = me();
  const batch = writeBatch(db);
  const step = { text: nextStep.text.trim(), due: nextStep.due };
  batch.update(doc(db, 'leads', l.id), { stage, stageAt: serverTimestamp(), nextStep: step, updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'leads', l.id, 'activity')), { kind: 'stage', text: `${STAGE_LABEL[l.stage]} ← ${STAGE_LABEL[stage]}`, stage, nextStep: step, by: u.uid, byName: u.name, at: serverTimestamp() });
  await closeLeadTasks(batch, l.id);
  stepTask(batch, l.id, l.name, step);
  audit(batch, l.id, 'stage', { stage: l.stage, nextStep: l.nextStep }, { stage, nextStep: step });
  await batch.commit();
}

export async function markLost(l: Lead, reason: string, note: string) {
  const u = me();
  const batch = writeBatch(db);
  batch.update(doc(db, 'leads', l.id), { stage: 'lost', lostReason: reason, lostNote: note.trim(), nextStep: null, stageAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'leads', l.id, 'activity')), { kind: 'stage', text: `${STAGE_LABEL[l.stage]} ← לא רלוונטי${note.trim() ? ` · ${note.trim()}` : ''}`, stage: 'lost', by: u.uid, byName: u.name, at: serverTimestamp() });
  await closeLeadTasks(batch, l.id);
  audit(batch, l.id, 'stage', { stage: l.stage }, { stage: 'lost', lostReason: reason }, note.trim() || undefined);
  await batch.commit();
}

/* ליד שנסגר כלא רלוונטי חוזר לעבודה – עם צעד הבא */
export async function reopenLead(l: Lead, nextStep: NextStep) {
  const u = me();
  const batch = writeBatch(db);
  const step = { text: nextStep.text.trim(), due: nextStep.due };
  batch.update(doc(db, 'leads', l.id), { stage: 'contacted', lostReason: '', lostNote: '', nextStep: step, stageAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'leads', l.id, 'activity')), { kind: 'stage', text: 'לא רלוונטי ← נוצר קשר (נפתח מחדש)', stage: 'contacted', nextStep: step, by: u.uid, byName: u.name, at: serverTimestamp() });
  stepTask(batch, l.id, l.name, step);
  audit(batch, l.id, 'stage', { stage: 'lost' }, { stage: 'contacted', nextStep: step });
  await batch.commit();
}

/* הפיכה ללקוח (אפיון 19.1): לקוח חדש עם כל הפרטים ואנשי הקשר, וכל הפעילות של הליד מועתקת לתיק הלקוח
   עם התאריך המקורי. הליד נשאר מקושר ללקוח – למדידת המרה. הכל בפעולה אחת. */
export type ConvertInput = Pick<CustomerInput, 'name' | 'type' | 'taxId' | 'paymentMethod' | 'accountPhone' | 'businessAddress'>;
export async function convertLead(l: Lead, c: ConvertInput, activity: LeadActivity[]): Promise<string> {
  const u = me();
  const batch = writeBatch(db);
  const ref = doc(collection(db, 'customers'));
  const taxId = cleanTaxId(c.taxId);
  const contacts: Contact[] = l.contacts.map((x, i) => ({
    id: newId(), name: x.name, phone: x.phone, email: x.email, primary: x.decider || (i === 0 && !l.contacts.some((y) => y.decider)),
    role: [x.role, x.decider ? 'מקבל החלטות' : ''].filter(Boolean).join(' · '),
  }));
  const customer: CustomerInput = {
    ...EMPTY_CUSTOMER, ...c, name: c.name.trim(), taxId, accountPhone: c.paymentMethod === 'account' ? c.accountPhone.replace(/\D/g, '') : '',
    businessAddress: c.businessAddress.trim(), contacts, instructions: '',
  };
  batch.set(ref, { ...customer, leadId: l.id, status: 'active', createdAt: serverTimestamp(), createdBy: u.uid, updatedAt: serverTimestamp(), updatedBy: u.uid });
  if (taxId) batch.set(doc(db, 'taxIds', taxId), { customerId: ref.id });
  batch.set(doc(collection(db, 'auditLog')), {
    entity: 'customer', entityId: ref.id, action: 'create', before: null, after: { name: customer.name, taxId, type: customer.type, leadId: l.id }, source: 'form', note: 'נוצר מליד',
    by: u.uid, byName: u.name, at: serverTimestamp(), ok: true,
  });
  // ההיסטוריה עוברת לתיק הלקוח: שיחה נשארת שיחה, כל השאר נרשם כהערה עם סוג הפעולה
  [...activity].reverse().slice(0, 300).forEach((a) => {
    const parts = [a.text, a.asked && `ביקש: ${a.asked}`, a.objections && `התנגדויות: ${a.objections}`, a.outcome && `תוצאה: ${a.outcome}`].filter(Boolean).join(' · ');
    batch.set(doc(collection(db, 'customers', ref.id, 'activity')), {
      kind: a.kind === 'call' ? 'call' : 'note', text: `[ליד · ${ACTIVITY_LABEL[a.kind]}] ${parts}`.slice(0, 2000), fromLead: true,
      by: u.uid, byName: a.byName, at: a.at ?? serverTimestamp(),
    });
  });
  batch.update(doc(db, 'leads', l.id), { stage: 'won', customerId: ref.id, nextStep: null, stageAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: u.uid });
  batch.set(doc(collection(db, 'leads', l.id, 'activity')), { kind: 'stage', text: `${STAGE_LABEL[l.stage]} ← לקוח פעיל`, stage: 'won', by: u.uid, byName: u.name, at: serverTimestamp() });
  await closeLeadTasks(batch, l.id);
  audit(batch, l.id, 'convert', { stage: l.stage }, { stage: 'won', customerId: ref.id, customerName: customer.name });
  await batch.commit();
  return ref.id;
}

export const emptyContact = (): LeadContact => ({ id: newId(), name: '', role: '', phone: '', email: '', decider: false });

/* מניעת כפילות (אפיון 19.1): מול הלקוחות ומול הלידים הפתוחים. ח.פ זהה חוסם; שם דומה או טלפון זהה מזהירים */
export type Twin = { kind: 'customer' | 'lead'; id: string; name: string; why: string };
export function findTwins(input: { name: string; taxId: string; phones: string[] }, customers: { id: string; name: string; taxId: string; status: string; accountPhone: string; contacts: { phone: string }[] }[], leads: Lead[], selfId?: string) {
  const tax = cleanTaxId(input.taxId);
  const phones = input.phones.map((p) => p.replace(/\D/g, '')).filter((p) => p.length >= 9);
  const liveCustomers = customers.filter((c) => c.status !== 'merged');
  const openLeads = leads.filter((l) => l.id !== selfId && isOpen(l));
  let block: Twin | undefined;
  if (tax) {
    const c = liveCustomers.find((x) => x.taxId === tax);
    const l = openLeads.find((x) => x.taxId === tax);
    if (c) block = { kind: 'customer', id: c.id, name: c.name, why: 'ח.פ זהה ללקוח קיים' };
    else if (l) block = { kind: 'lead', id: l.id, name: l.name, why: 'ח.פ זהה לליד פתוח' };
  }
  const warns: Twin[] = [];
  const add = (t: Twin) => { if (t.id !== block?.id && !warns.some((w) => w.id === t.id)) warns.push(t); };
  if (input.name.trim().length >= 3) {
    liveCustomers.filter((c) => isSimilar(c.name, input.name)).forEach((c) => add({ kind: 'customer', id: c.id, name: c.name, why: 'שם דומה ללקוח קיים' }));
    openLeads.filter((l) => isSimilar(l.name, input.name)).forEach((l) => add({ kind: 'lead', id: l.id, name: l.name, why: 'שם דומה לליד פתוח' }));
  }
  if (phones.length) {
    liveCustomers.filter((c) => phones.includes(c.accountPhone) || c.contacts.some((x) => phones.includes(x.phone))).forEach((c) => add({ kind: 'customer', id: c.id, name: c.name, why: 'אותו טלפון כמו לקוח קיים' }));
    openLeads.filter((l) => l.contacts.some((x) => phones.includes(x.phone))).forEach((l) => add({ kind: 'lead', id: l.id, name: l.name, why: 'אותו טלפון כמו ליד פתוח' }));
  }
  return { block, warns };
}
