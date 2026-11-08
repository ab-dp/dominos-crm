/* הגדרות (מנהל מערכת בלבד): משתמשים · רשימות · ספי התראות */
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { UsersPage } from './UsersPage';
import { ListsPage } from './ListsPage';
import { ThresholdsPage } from './ThresholdsPage';
import { QuoteTermsPage } from './QuoteTermsPage';
import { ErrorsPage } from './ErrorsPage';

export function SettingsPage() {
  const { isAdmin } = useAuth();
  // משתמש רגיל לא רואה את ההגדרות בכלל (והשרת חוסם אותו בכל מקרה)
  if (!isAdmin) return <Navigate to="/today" replace />;
  return (
    <>
      <nav className="subnav" aria-label="הגדרות">
        <span className="subnav__label" aria-hidden="true">הגדרות</span>
        <NavLink to="/settings/users" className={({ isActive }) => (isActive ? 'is-on' : '')}>משתמשים</NavLink>
        <NavLink to="/settings/lists" className={({ isActive }) => (isActive ? 'is-on' : '')}>רשימות</NavLink>
        <NavLink to="/settings/thresholds" className={({ isActive }) => (isActive ? 'is-on' : '')}>ספי התראות</NavLink>
        <NavLink to="/settings/quotes" className={({ isActive }) => (isActive ? 'is-on' : '')}>הצעות מחיר</NavLink>
        <NavLink to="/settings/errors" className={({ isActive }) => (isActive ? 'is-on' : '')}>תקלות</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="lists" element={<ListsPage />} />
        <Route path="thresholds" element={<ThresholdsPage />} />
        <Route path="quotes" element={<QuoteTermsPage />} />
        <Route path="errors" element={<ErrorsPage />} />
      </Routes>
    </>
  );
}
