/* מסכי הכניסה (אפיון 11 + 2.1): חצי כחול עם אריח הדומינו, חצי לבן עם הטופס. במובייל – לוגו אנכי מעל הטופס. */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Eye, EyeOff, Hourglass, LogOut, Mail, TriangleAlert, X } from 'lucide-react';
import { Button } from '../design/components';
import { DominoTile } from '../components/DominoTile';
import { authErrorMessage, useAuth } from './AuthContext';
import './AuthScreens.css';

const BASE = import.meta.env.BASE_URL;

export function AuthScreens() {
  const { phase } = useAuth();
  const [view, setView] = useState<'login' | 'register'>('login');
  const reduce = useReducedMotion();
  const screen = phase === 'pending' ? 'pending' : view;

  return (
    <div className="auth">
      <section className="auth__brand" aria-hidden="true">
        <DominoTile size={176} animate />
        <p className="auth__brand-title">מערכת CRM</p>
        <p className="auth__brand-sub">לקוחות עסקיים והזמנות</p>
      </section>

      <main className="auth__panel">
        <img className="auth__mobile-logo" src={`${BASE}logo-vertical.svg`} alt="Domino's Pizza" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            className="auth__card"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: screen === 'register' ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
          >
            {screen === 'pending' ? <Pending /> : screen === 'register' ? <Register onBack={() => setView('login')} /> : <Login onRegister={() => setView('register')} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ---------- כניסה ---------- */
function Login({ onRegister }: { onRegister: () => void }) {
  const { loginEmail, loginGoogle, notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'email' | 'google'>('');
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('חובה למלא מייל וסיסמה'); return; }
    setBusy('email'); setError('');
    try { await loginEmail(email, password); } catch (err) { setError(authErrorMessage(err)); setBusy(''); }
  };
  const google = async () => {
    setBusy('google'); setError('');
    try { await loginGoogle(); } catch (err) { setError(authErrorMessage(err)); setBusy(''); }
  };

  return (
    <>
      <h1 className="auth__title">כניסה למערכת</h1>
      <p className="auth__lead">ברוך הבא. היכנס כדי לראות מה צריך לטפל בו עכשיו.</p>

      {notice && <Notice tone="danger" onClose={clearNotice}>{notice}</Notice>}

      <GoogleButton onClick={google} busy={busy === 'google'} disabled={!!busy}>המשך עם Google</GoogleButton>
      <Divider>או עם מייל</Divider>

      <form onSubmit={submit} noValidate>
        <label className="afield">
          <span className="afield__label">מייל</span>
          <input ref={emailRef} className="input input--ltr" type="email" autoComplete="username" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'login-err' : undefined} />
        </label>
        <PasswordField label="סיסמה" value={password} onChange={(v) => { setPassword(v); setError(''); }} autoComplete="current-password" invalid={!!error} describedBy={error ? 'login-err' : undefined} />
        <AnimatePresence>{error && <FieldError id="login-err">{error}</FieldError>}</AnimatePresence>
        <Button variant="primary" size="lg" type="submit" className="auth__submit" loading={busy === 'email'} disabled={!!busy && busy !== 'email'}>כניסה</Button>
      </form>

      <p className="auth__switch">אין לך חשבון? <button className="link" onClick={onRegister}>הרשמה</button></p>
      <p className="auth__help">שכחת סיסמה? פנה למנהל המוקד</p>
    </>
  );
}

/* ---------- הרשמה ---------- */
function Register({ onBack }: { onBack: () => void }) {
  const { register, loginGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'email' | 'google'>('');
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const rules = [
    { ok: password.length >= 8, label: 'לפחות 8 תווים' },
    { ok: /[a-zA-Zא-ת]/.test(password), label: 'לפחות אות אחת' },
    { ok: /\d/.test(password), label: 'לפחות מספר אחד' },
    { ok: !!password && password.toLowerCase() !== email.trim().toLowerCase(), label: 'שונה מהמייל' },
  ];
  const allOk = rules.every((r) => r.ok);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('חובה: שם מלא');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('כתובת המייל לא תקינה. בדוק שיש @ ונקודה.');
    if (!allOk) return setError('הסיסמה לא עומדת בכללים שמסומנים למטה');
    if (password !== confirm) return setError('הסיסמאות לא זהות. הקלד שוב את אימות הסיסמה.');
    setBusy('email'); setError('');
    try { await register(name, email, password); } catch (err) { setError(authErrorMessage(err)); setBusy(''); }
  };
  const google = async () => {
    setBusy('google'); setError('');
    try { await loginGoogle(); } catch (err) { setError(authErrorMessage(err)); setBusy(''); }
  };

  return (
    <>
      <button className="auth__back" onClick={onBack}><ArrowRight size={16} aria-hidden="true" /> חזרה לכניסה</button>
      <h1 className="auth__title">הרשמה</h1>
      <p className="auth__lead">אחרי ההרשמה הבקשה עוברת למנהל המערכת. תוכל להיכנס אחרי שתאושר.</p>

      <GoogleButton onClick={google} busy={busy === 'google'} disabled={!!busy}>הרשמה עם Google</GoogleButton>
      <Divider>או עם מייל וסיסמה</Divider>

      <form onSubmit={submit} noValidate>
        <label className="afield">
          <span className="afield__label">שם מלא <span className="req">חובה</span></span>
          <input ref={nameRef} className="input" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} />
        </label>
        <label className="afield">
          <span className="afield__label">מייל <span className="req">חובה</span></span>
          <input className="input input--ltr" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
        </label>
        <PasswordField label="סיסמה" required value={password} onChange={(v) => { setPassword(v); setError(''); }} autoComplete="new-password" describedBy="pw-rules" />
        <ul className="pwrules" id="pw-rules" aria-label="כללי הסיסמה">
          {rules.map((r) => (
            <li key={r.label} className={r.ok ? 'is-ok' : ''}>
              <span className="pwrules__icon" aria-hidden="true">{r.ok ? <Check size={12} strokeWidth={3} /> : null}</span>
              {r.label}<span className="sr-only">{r.ok ? ' – תקין' : ' – חסר'}</span>
            </li>
          ))}
        </ul>
        <PasswordField label="אימות סיסמה" required value={confirm} onChange={(v) => { setConfirm(v); setError(''); }} autoComplete="new-password"
          hint={confirm && confirm === password ? 'הסיסמאות זהות ✓' : undefined} />
        <AnimatePresence>{error && <FieldError id="reg-err">{error}</FieldError>}</AnimatePresence>
        <Button variant="primary" size="lg" type="submit" className="auth__submit" loading={busy === 'email'} disabled={!!busy && busy !== 'email'}>שלח בקשה</Button>
      </form>
    </>
  );
}

/* ---------- ממתין לאישור: מתעדכן לבד ברגע שהמנהל מאשר ---------- */
function Pending() {
  const { profile, user, logout } = useAuth();
  return (
    <div className="pending">
      <span className="pending__icon" aria-hidden="true"><Hourglass size={28} /></span>
      <h1 className="auth__title">הבקשה שלך נשלחה</h1>
      <p className="auth__lead">הבקשה הועברה למנהל המערכת. תוכל להיכנס אחרי שתאושר – המסך הזה יתעדכן לבד ברגע האישור, אין צורך לרענן.</p>
      <div className="pending__who">
        <Mail size={16} aria-hidden="true" />
        <span>{profile?.name}</span>
        <bdi dir="ltr" className="muted">{user?.email}</bdi>
      </div>
      <div className="pending__dots" aria-hidden="true"><span /><span /><span /></div>
      <Button variant="secondary" icon={<LogOut size={16} />} onClick={() => logout()}>חזרה לכניסה</Button>
    </div>
  );
}

/* ---------- רכיבים קטנים ---------- */
function PasswordField({ label, value, onChange, autoComplete, invalid, describedBy, required, hint }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string; required?: boolean; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="afield">
      <span className="afield__label">{label} {required && <span className="req">חובה</span>}</span>
      <span className="pw">
        <input className="input input--ltr" type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value}
          onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
        <button type="button" className="pw__toggle" onClick={() => setShow(!show)} aria-label={show ? 'הסתר סיסמה' : 'הצג סיסמה'} aria-pressed={show}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {hint && <span className="afield__hint">{hint}</span>}
    </label>
  );
}

function GoogleButton({ children, onClick, busy, disabled }: { children: ReactNode; onClick: () => void; busy: boolean; disabled: boolean }) {
  return (
    <button type="button" className="gbtn" onClick={onClick} disabled={disabled} aria-busy={busy || undefined}>
      {busy ? <span className="gbtn__spin" aria-hidden="true" /> : (
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13.7 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
          <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.8-6z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.7-4.2-13.6-10l-7.8 6C6.6 42.6 14.6 48 24 48z" />
        </svg>
      )}
      <span>{children}</span>
    </button>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return <div className="adivider" role="separator"><span>{children}</span></div>;
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.p id={id} role="alert" className="aerror"
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: [0, -6, 6, -3, 0] }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}>
      <TriangleAlert size={16} aria-hidden="true" /> {children}
    </motion.p>
  );
}

function Notice({ tone, children, onClose }: { tone: 'danger'; children: ReactNode; onClose: () => void }) {
  return (
    <div className={`anotice anotice--${tone}`} role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <span>{children}</span>
      <button onClick={onClose} aria-label="סגור הודעה"><X size={16} /></button>
    </div>
  );
}
