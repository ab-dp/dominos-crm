/* מדריך סגנון חי – כל הטוקנים והרכיבים במקום אחד (תוכנית בנייה 3.8) */
import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button, EmptyState, HealthBadge, MarkGlyph, RollingNumber, Skeleton } from '../../design/components';
import { useToast } from '../../design/Toast';
import { DominoTile } from '../../components/DominoTile';
import { Ltr } from '../../lib/format';
import '../pages.css';
import './StyleGuidePage.css';

const SWATCHES: [string, string, string][] = [
  ['--brand-600', '#0078AE', 'כחול מותג · כפתור ראשי, קישור, פוקוס'],
  ['--brand-700', '#00668F', 'ריחוף'],
  ['--brand-800', '#004F70', 'לחיצה, טקסט על רקע כחול בהיר'],
  ['--brand-50', '#EAF4FA', 'שורה נבחרת, טאב פעיל'],
  ['--gray-900', '#14181F', 'טקסט ראשי'],
  ['--gray-600', '#5B6472', 'טקסט משני'],
  ['--gray-300', '#C9CED6', 'גבולות שדות'],
  ['--gray-25', '#F7F8FA', 'רקע מסך'],
];
const STATES: [string, string, string, string][] = [
  ['חריגה', '--danger-bg', '--danger-fg', 'אדום'],
  ['דחוף', '--urgent-bg', '--urgent-fg', 'כתום'],
  ['חסר', '--missing-bg', '--missing-fg', 'צהוב'],
  ['תקין', '--ok-bg', '--ok-fg', 'ירוק'],
];

export function StyleGuidePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [n, setN] = useState(4);
  const [replay, setReplay] = useState(0);

  return (
    <div className="page sg">
      <header className="page__head">
        <div>
          <h1 className="page__title">מדריך סגנון</h1>
          <p className="page__sub">המותג בכניסה, השקט בעבודה, הצבע לבעיות.</p>
        </div>
      </header>

      <section className="card sg__sec">
        <h2 className="card__title">צבעים</h2>
        <div className="sg__swatches">
          {SWATCHES.map(([v, hex, use]) => (
            <div key={v} className="swatch">
              <span className="swatch__chip" style={{ background: `var(${v})` }} />
              <code>{v}</code><Ltr className="muted">{hex}</Ltr>
              <span className="swatch__use">{use}</span>
            </div>
          ))}
        </div>
        <h3 className="sg__h3">צבעי מצב – תמיד צבע + אייקון + מילה</h3>
        <div className="sg__row">
          {STATES.map(([word, bg, fg, name]) => (
            <span key={word} className="state-demo" style={{ background: `var(${bg})`, color: `var(${fg})` }}><b>{word}</b> · {name}</span>
          ))}
        </div>
        <div className="sg__row">
          <HealthBadge health="critical" issues={[{ rule: 1, severity: 'red', label: 'לא הועברה ל-Q', action: 'q', actionLabel: '' }]} />
          <HealthBadge health="urgent" issues={[{ rule: 4, severity: 'orange', label: 'אין אישור סניף', action: 'branch', actionLabel: '' }]} />
          <HealthBadge health="missing" issues={[{ rule: 9, severity: 'yellow', label: 'תעודת רכש חסרה', action: 'po', actionLabel: '' }]} />
          <span className="status-demo">אושרה</span>
          <span className="muted">← סטטוס תמיד ניטרלי</span>
        </div>
      </section>

      <section className="card sg__sec">
        <h2 className="card__title">טיפוגרפיה · Rubik</h2>
        <p style={{ fontSize: 28, fontWeight: 600, margin: '4px 0' }}>מונה <Ltr>12</Ltr> · <Ltr>28/600</Ltr></p>
        <p style={{ fontSize: 22, fontWeight: 600, margin: '4px 0' }}>כותרת מסך · <Ltr>22/600</Ltr></p>
        <p style={{ fontSize: 17, fontWeight: 600, margin: '4px 0' }}>כותרת כרטיס · <Ltr>17/600</Ltr></p>
        <p style={{ fontSize: 15, margin: '4px 0' }}>טקסט גוף · <Ltr>15/400</Ltr> · הזמנה <Ltr>1045</Ltr> נשמרה · <Ltr>₪1,250</Ltr> · <Ltr>054-6101010</Ltr></p>
        <p style={{ fontSize: 14, margin: '4px 0' }}>טבלה · <Ltr>14/400</Ltr></p>
        <p style={{ fontSize: 13, fontWeight: 500, margin: '4px 0', color: 'var(--gray-600)' }}>תווית · <Ltr>13/500</Ltr> · אין טקסט קטן מזה</p>
      </section>

      <section className="card sg__sec">
        <h2 className="card__title">כפתורים חכמים</h2>
        <div className="sg__row">
          <Button variant="primary" icon={<Plus size={18} />} kbd="N">הזמנה חדשה</Button>
          <Button>משני</Button>
          <Button variant="ghost">שקט</Button>
          <Button variant="fix">סמן הועברה ל-Q</Button>
          <Button variant="danger" icon={<Trash2 size={16} />}>מחק</Button>
        </div>
        <div className="sg__row">
          <Button variant="primary" icon={done ? undefined : <Save size={16} />} loading={loading}
            onClick={() => { setLoading(true); setDone(false); setTimeout(() => { setLoading(false); setDone(true); toast({ message: 'נשמר', onUndo: () => setDone(false) }); }, 900); }}>
            {done ? 'נשמר ✓' : 'שמור (מצבים מובנים)'}
          </Button>
          <Button onClick={() => toast({ message: <>הזמנה <Ltr>1045</Ltr> נשמרה</>, onUndo: () => toast({ message: 'בוטל' }) })}>הצג הודעה עם "בטל"</Button>
        </div>
      </section>

      <section className="card sg__sec">
        <h2 className="card__title">סימונים ותנועה</h2>
        <div className="sg__row">
          <MarkGlyph done={false} label="סניף" />
          <MarkGlyph done label="Q" drawKey={replay} />
          <MarkGlyph done label="שולם" drawKey={replay} />
          <Button size="sm" onClick={() => setReplay((r) => r + 1)}>הפעל שוב את ה-✓</Button>
        </div>
        <div className="sg__row">
          <span className="sg__count"><RollingNumber value={n} /></span>
          <Button size="sm" onClick={() => setN((v) => Math.max(0, v - 1))}>מונה −1</Button>
          <Button size="sm" onClick={() => setN((v) => v + 1)}>מונה +1</Button>
        </div>
        <div className="sg__row sg__tile">
          <DominoTile key={replay} size={96} animate />
          <span className="muted">רגע המותג – רק במסכי הכניסה. כל התנועה מתבטלת ב"הפחתת תנועה".</span>
        </div>
      </section>

      <section className="card sg__sec">
        <h2 className="card__title">טעינה ומצב ריק</h2>
        <div className="sg__skel"><Skeleton w="40%" h={16} /><Skeleton w="85%" /><Skeleton w="70%" /></div>
        <EmptyState icon={<Plus size={24} />} title="אין הזמנות למחר" action={<Button variant="primary" icon={<Plus size={18} />}>הזמנה חדשה</Button>}>מצב ריק תמיד מסביר מה אפשר לעשות.</EmptyState>
      </section>
    </div>
  );
}
