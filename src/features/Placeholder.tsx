import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { EmptyState } from '../design/components';
import './pages.css';

export function Placeholder({ title, stage, children }: { title: string; stage: number; children?: ReactNode }) {
  return (
    <div className="page">
      <header className="page__head"><h1 className="page__title">{title}</h1></header>
      <div className="card">
        <EmptyState icon={<Construction size={20} />} title={`ייבנה בשלב ${stage}`}>
          {children ?? 'המסך הזה לא חלק מהאב-טיפוס של שלב 1.'}
        </EmptyState>
      </div>
    </div>
  );
}

export function ReportsHub() {
  return (
    <Placeholder title="דוחות" stage={8}>
      באב-טיפוס זמין <Link to="/reports/credit">דוח הקפות</Link>. שאר הדוחות ייבנו בשלב 8.
    </Placeholder>
  );
}
