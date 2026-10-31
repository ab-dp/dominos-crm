/* הגדרות (מנהל מערכת בלבד): משתמשים · רשימות · ספי התראות */
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Placeholder } from '../Placeholder';
import { UsersPage } from './UsersPage';

export function SettingsPage() {
  const { isAdmin } = useAuth();
  // משתמש רגיל לא רואה את ההגדרות בכלל (והשרת חוסם אותו בכל מקרה)
  if (!isAdmin) return <Navigate to="/today" replace />;
  return (
    <>
      <nav className="subnav" aria-label="הגדרות">
        <NavLink to="/settings/users" className={({ isActive }) => (isActive ? 'is-on' : '')}>משתמשים</NavLink>
        <NavLink to="/settings/lists" className={({ isActive }) => (isActive ? 'is-on' : '')}>רשימות</NavLink>
        <NavLink to="/settings/thresholds" className={({ isActive }) => (isActive ? 'is-on' : '')}>ספי התראות</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="lists" element={<Placeholder title="רשימות" stage={3}>ערוצי קבלה, סיבות ביטול, אמצעי תשלום וסוגי מסמכים.</Placeholder>} />
        <Route path="thresholds" element={<Placeholder title="ספי התראות" stage={6}>"שעות סמוכות", "היום או מחר" וספים נוספים לחריגים.</Placeholder>} />
      </Routes>
    </>
  );
}
