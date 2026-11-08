/* תקלה בתצוגה של מסך אחד לא מפילה את כל המערכת: המסך מוחלף בהודעה עם "נסה שוב",
   והתפריט, החיפוש והזמנה חדשה ממשיכים לעבוד. מתאפס במעבר מסך. */
import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { EmptyState } from '../design/components';
import { logError } from '../lib/errorLog';

type Props = { children: ReactNode; resetKey: string };
type State = { failed: boolean; key: string };

export class ScreenBoundary extends Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(p: Props, s: State) { return p.resetKey !== s.key ? { failed: false, key: p.resetKey } : null; }
  componentDidCatch(e: unknown) { console.error('screen error', e); logError('screen', e); }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <div className="card">
          <EmptyState icon={<TriangleAlert size={24} />} title="משהו השתבש בהצגת המסך"
            action={<button className="btn btn--primary btn--md" onClick={() => location.reload()}><span className="btn__label">רענן את הדף</span></button>}>
            הנתונים שמורים. אפשר לעבור למסך אחר מהתפריט, או לרענן.
          </EmptyState>
        </div>
      </div>
    );
  }
}

/* לחיצה על הודעה (למשל "בטל") לא נחשבת "לחיצה מחוץ לחלון" ולא סוגרת תיק או טופס פתוחים */
export function keepOpenOnToast(e: { target: EventTarget | null; preventDefault: () => void }) {
  if ((e.target as HTMLElement | null)?.closest?.('.toasts')) e.preventDefault();
}
