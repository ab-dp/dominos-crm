/* ניהול משתמשים (אפיון 11): ממתינים · פעילים · מושבתים · נדחו. אישור ודחייה ישירות בשורה. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, serverTimestamp, updateDoc, doc, type Timestamp } from 'firebase/firestore';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ExternalLink, MoreHorizontal, ShieldCheck, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../auth/AuthContext';
import { BOOT_ADMIN, ROLE_LABEL, type Role, type UserDoc, type AccountStatus } from '../../auth/types';
import { Button, EmptyState, Field, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { logAction } from '../../data/audit';
import { Ltr } from '../../lib/format';
import '../pages.css';
import './UsersPage.css';

type Tab = 'pending' | 'active' | 'disabled' | 'rejected';
const TABS: [Tab, string][] = [['pending', 'ממתינים לאישור'], ['active', 'פעילים'], ['disabled', 'מושבתים'], ['rejected', 'נדחו']];
const CONSOLE_USERS = 'https://console.firebase.google.com/project/dominos-crm/authentication/users';

function fmtTs(ts?: Timestamp) {
  if (!ts) return '—';
  const d = ts.toDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function UsersPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserDoc[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab | null>(null);
  const [dialog, setDialog] = useState<null | { kind: 'approve' | 'reject' | 'edit' | 'delete'; user: UserDoc }>(null);
  const [deletedPassword, setDeletedPassword] = useState<UserDoc | null>(null);

  useEffect(() => onSnapshot(collection(db, 'users'),
    (s) => setUsers(s.docs.map((d) => d.data() as UserDoc)),
    () => setError('אין הרשאה לצפות במשתמשים. ודא שכללי האבטחה פורסמו ב-Firebase.')), []);

  const by = useMemo(() => {
    const m: Record<Tab, UserDoc[]> = { pending: [], active: [], disabled: [], rejected: [] };
    (users ?? []).forEach((u) => { if (u.status in m) m[u.status as Tab].push(u); });
    Object.values(m).forEach((l) => l.sort((a, b) => (b.requestedAt?.seconds ?? 0) - (a.requestedAt?.seconds ?? 0)));
    return m;
  }, [users]);

  // הטאב "ממתינים" נפתח ראשון כשיש בקשות
  const current: Tab = tab ?? (by.pending.length ? 'pending' : 'active');
  const activeAdmins = by.active.filter((u) => u.role === 'admin').length;
  const isProtected = (u: UserDoc) => u.email === BOOT_ADMIN || (u.role === 'admin' && u.status === 'active' && activeAdmins <= 1);

  async function setStatus(u: UserDoc, status: AccountStatus, extra: Partial<UserDoc> = {}, message: ReactNode, action: string) {
    const before = { status: u.status, role: u.role };
    try {
      await updateDoc(doc(db, 'users', u.uid), { status, ...extra, statusChangedAt: serverTimestamp(), statusChangedBy: profile?.uid ?? '' });
      logAction({ entity: 'user', entityId: u.uid, action, before, after: { status, ...extra } });
      toast({ message });
    } catch {
      toast({ message: 'הפעולה נכשלה – אין הרשאה או אין חיבור' });
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">ניהול משתמשים</h1>
          <p className="page__sub">רק מנהל המערכת פותח גישה.</p>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="מצב משתמשים">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={current === k} className={`tab ${current === k ? 'is-on' : ''} ${k === 'pending' && by.pending.length ? 'tab--alert' : ''}`} onClick={() => setTab(k)}>
            {label}<span className="tab__count"><Ltr>{by[k].length}</Ltr></span>
          </button>
        ))}
      </div>

      {deletedPassword && (
        <div className="console-hint" role="status">
          <span>
            <b>עוד צעד אחד כדי ש{deletedPassword.name} יוכל להירשם מחדש באותו מייל:</b> למחוק את החשבון גם ב-Firebase Console
            (<bdi dir="ltr">{deletedPassword.email}</bdi> ← שלוש נקודות ← Delete account).
          </span>
          <a className="btn btn--primary btn--sm" href={CONSOLE_USERS} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /><span className="btn__label">פתח את Firebase Console</span></a>
          <button className="btn btn--ghost btn--sm" onClick={() => setDeletedPassword(null)}><span className="btn__label">סיימתי</span></button>
        </div>
      )}

      {error ? <div className="card"><EmptyState icon={<Users size={24} />} title="לא ניתן לטעון משתמשים">{error}</EmptyState></div>
        : users === null ? <div className="card users-skel">{[0, 1, 2].map((i) => <Skeleton key={i} h={44} />)}</div>
        : by[current].length === 0 ? (
          <div className="card"><EmptyState icon={<UserCheck size={24} />} title={current === 'pending' ? 'אין בקשות הצטרפות ממתינות' : 'אין משתמשים בתצוגה הזו'} /></div>
        ) : (
          <div className="otable-wrap">
            <table className="otable otable--dense users">
              <caption className="sr-only">משתמשים – {TABS.find((t) => t[0] === current)![1]}</caption>
              <thead>
                <tr>
                  <th>שם</th><th>מייל</th><th>כניסה עם</th><th>תפקיד</th>
                  <th>{current === 'pending' ? 'תאריך בקשה' : 'כניסה אחרונה'}</th>
                  <th><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {by[current].map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <span className="ucell">
                        <span className="ucell__avatar" aria-hidden="true">{u.name?.[0] ?? '?'}</span>
                        <span>{u.name}{u.uid === profile?.uid && <span className="you">את/ה</span>}</span>
                      </span>
                    </td>
                    <td><bdi dir="ltr">{u.email}</bdi></td>
                    <td>{u.provider === 'google' ? 'Google' : 'מייל וסיסמה'}</td>
                    <td>{u.role === 'admin' ? <span className="role role--admin"><ShieldCheck size={14} aria-hidden="true" /> {ROLE_LABEL.admin}</span> : ROLE_LABEL.user}</td>
                    <td className="num"><Ltr>{fmtTs(current === 'pending' ? u.requestedAt : u.lastLogin)}</Ltr></td>
                    <td className="users__actions">
                      {current === 'pending' && (
                        <>
                          <Button size="sm" variant="primary" icon={<Check size={16} />} onClick={() => setDialog({ kind: 'approve', user: u })}>אשר</Button>
                          <Button size="sm" onClick={() => setDialog({ kind: 'reject', user: u })}>דחה</Button>
                        </>
                      )}
                      {current === 'rejected' && <Button size="sm" onClick={() => setDialog({ kind: 'approve', user: u })}>אשר בכל זאת</Button>}
                      {current === 'disabled' && <Button size="sm" icon={<UserCheck size={16} />} onClick={() => setStatus(u, 'active', {}, <>{u.name} הופעל מחדש</>, 'enable')}>הפעל מחדש</Button>}
                      {current !== 'pending' && (
                        <UserMenu
                          u={u}
                          protectedUser={isProtected(u)}
                          onEdit={() => setDialog({ kind: 'edit', user: u })}
                          onDisable={() => setStatus(u, 'disabled', {}, <>{u.name} הושבת ונותק מהמערכת</>, 'disable')}
                          onDelete={() => setDialog({ kind: 'delete', user: u })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <UserDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onApprove={(u, role) => setStatus(u, 'active', { role, approvedBy: profile?.uid, rejectReason: '' }, <>{u.name} אושר כ{ROLE_LABEL[role]} – החשבון פעיל</>, 'approve')}
        onReject={(u, reason) => setStatus(u, 'rejected', { rejectReason: reason }, <>הבקשה של {u.name} נדחתה</>, 'reject')}
        onEdit={async (u, name, role) => {
          try {
            await updateDoc(doc(db, 'users', u.uid), { name, role });
            logAction({ entity: 'user', entityId: u.uid, action: 'edit', before: { name: u.name, role: u.role }, after: { name, role } });
            toast({ message: 'פרטי המשתמש עודכנו' });
          } catch { toast({ message: 'העדכון נכשל' }); }
        }}
        onDelete={async (u) => {
          await setStatus(u, 'deleted', {}, <>{u.name} נמחק מהמערכת</>, 'delete');
          if (u.provider === 'password') setDeletedPassword(u);
        }}
        canChangeRole={(u) => !isProtected(u)}
      />
    </div>
  );
}

function UserMenu({ u, protectedUser, onEdit, onDisable, onDelete }: { u: UserDoc; protectedUser: boolean; onEdit: () => void; onDisable: () => void; onDelete: () => void }) {
  return (
    <Dropdown.Root dir="rtl">
      <Dropdown.Trigger asChild>
        <button className="icon-btn" aria-label={`פעולות עבור ${u.name}`}><MoreHorizontal size={18} /></button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu" align="end" sideOffset={4}>
          <Dropdown.Item className="menu__item" onSelect={onEdit}>ערוך שם ותפקיד</Dropdown.Item>
          {u.status === 'active' && (
            <Dropdown.Item className="menu__item" disabled={protectedUser} onSelect={onDisable}>
              <UserX size={16} aria-hidden="true" /> השבת
              {protectedUser && <span className="menu__hint">מנהל אחרון</span>}
            </Dropdown.Item>
          )}
          <Dropdown.Separator className="menu__sep" />
          <Dropdown.Item className="menu__item menu__item--danger" disabled={protectedUser} onSelect={onDelete}>
            <Trash2 size={16} aria-hidden="true" /> מחק
            {protectedUser && <span className="menu__hint">מנהל אחרון</span>}
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function UserDialog({ state, onClose, onApprove, onReject, onEdit, onDelete, canChangeRole }: {
  state: null | { kind: 'approve' | 'reject' | 'edit' | 'delete'; user: UserDoc };
  onClose: () => void;
  onApprove: (u: UserDoc, role: Role) => void;
  onReject: (u: UserDoc, reason: string) => void;
  onEdit: (u: UserDoc, name: string, role: Role) => void;
  onDelete: (u: UserDoc) => void;
  canChangeRole: (u: UserDoc) => boolean;
}) {
  const [role, setRole] = useState<Role>('user');
  const [text, setText] = useState('');
  const u = state?.user;
  useEffect(() => {
    if (!state) return;
    setRole(state.kind === 'edit' ? state.user.role : 'user');
    setText(state.kind === 'edit' ? state.user.name : '');
  }, [state]);
  if (!state || !u) return null;

  const titles = { approve: `אישור ${u.name}`, reject: `דחיית הבקשה של ${u.name}`, edit: `עריכת ${u.name}`, delete: `מחיקת ${u.name}` };
  const submit = () => {
    if (state.kind === 'approve') onApprove(u, role);
    if (state.kind === 'reject') onReject(u, text.trim());
    if (state.kind === 'edit' && text.trim()) onEdit(u, text.trim(), role);
    if (state.kind === 'delete') onDelete(u);
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="udialog" dir="rtl" aria-describedby="udialog-desc">
          <Dialog.Title className="udialog__title">{titles[state.kind]}</Dialog.Title>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div id="udialog-desc">
              {state.kind === 'approve' && <p className="muted">החשבון יהיה פעיל מיד. <bdi dir="ltr">{u.email}</bdi></p>}
              {state.kind === 'reject' && <p className="muted">הבקשה תעבור ל"נדחו". המשתמש יראה הודעה שהבקשה לא אושרה.</p>}
              {state.kind === 'delete' && (
                <div className="udialog__danger">
                  <p>המשתמש ייעלם מהרשימות ולא יוכל להיכנס. הפעולות שלו נשארות ביומן תחת שמו.</p>
                  {u.provider === 'password'
                    ? <p>כדי שיוכל להירשם מחדש באותו מייל, אחרי המחיקה תצטרך למחוק אותו גם ב-Firebase Console – נפתח לך קישור ישיר.</p>
                    : <p>הוא נכנס עם Google – אם ייכנס שוב, תיווצר בקשה חדשה שתחכה לאישורך.</p>}
                </div>
              )}
            </div>
            {(state.kind === 'edit') && (
              <Field label="שם מלא"><input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} /></Field>
            )}
            {(state.kind === 'approve' || state.kind === 'edit') && (
              <fieldset className="rolepick" disabled={state.kind === 'edit' && !canChangeRole(u)}>
                <legend className="field__label">תפקיד</legend>
                {(['user', 'admin'] as Role[]).map((r) => (
                  <label key={r} className={`rolepick__opt ${role === r ? 'is-on' : ''}`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                    <span><b>{ROLE_LABEL[r]}</b><small>{r === 'user' ? 'כל העבודה היומית: הזמנות, לקוחות, דוחות, סגירת חודש' : 'כל מה שמשתמש עושה + משתמשים והגדרות'}</small></span>
                  </label>
                ))}
              </fieldset>
            )}
            {state.kind === 'reject' && (
              <Field label="סיבה (לא חובה)"><input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} /></Field>
            )}
            <div className="udialog__actions">
              <Button type="submit" variant={state.kind === 'delete' ? 'danger' : 'primary'} autoFocus={state.kind === 'approve' || state.kind === 'delete'}>
                {state.kind === 'approve' ? 'אשר והפעל' : state.kind === 'reject' ? 'דחה בקשה' : state.kind === 'edit' ? 'שמור' : 'מחק משתמש'}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">ביטול</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
