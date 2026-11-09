import { Suspense, lazy, type ComponentType } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { MotionConfig } from 'motion/react';
import { ToastProvider } from './design/Toast';
import { StoreProvider } from './data/store';
import { PanelProvider } from './app/PanelContext';
import { AppShell } from './app/AppShell';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthScreens } from './auth/AuthScreens';
import { InactivityGuard } from './auth/Inactivity';
import { DominoTile } from './components/DominoTile';
import { Skeleton } from './design/components';
import { TodayPage } from './features/today/TodayPage';
import { OrdersPage } from './features/orders/OrdersPage';

/* מסכים משניים נטענים רק כשנכנסים אליהם – הטעינה הראשונה (כניסה, היום, הזמנות) קלה ומהירה יותר */
/* אחרי עדכון גרסה, טאב פתוח עלול לבקש קובץ ישן שכבר לא קיים – טוענים מחדש פעם אחת ומקבלים את הגרסה החדשה */
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, k: K) => lazy(() => load().then((m) => {
  try { sessionStorage.removeItem("chunkReload"); } catch { /* מצב פרטי */ }
  return { default: m[k] };
}, (e) => {
  let tried = false;
  try { tried = sessionStorage.getItem("chunkReload") === "1"; sessionStorage.setItem("chunkReload", "1"); } catch { /* מצב פרטי */ }
  if (!tried) { window.location.reload(); return new Promise<never>(() => undefined); }
  throw e;
}));
const CreditReportPage = named(() => import('./features/reports/CreditReportPage'), 'CreditReportPage');
const PeriodReport = named(() => import('./features/reports/PeriodReport'), 'PeriodReport');
const MonthClosePage = named(() => import('./features/reports/MonthClosePage'), 'MonthClosePage');
const StyleGuidePage = named(() => import('./features/styleguide/StyleGuidePage'), 'StyleGuidePage');
const SettingsPage = named(() => import('./features/settings/SettingsPage'), 'SettingsPage');
const BranchesPage = named(() => import('./features/branches/BranchesPage'), 'BranchesPage');
const CustomersPage = named(() => import('./features/customers/CustomersPage'), 'CustomersPage');
const CustomerFile = named(() => import('./features/customers/CustomerFile'), 'CustomerFile');
const LeadsPage = named(() => import('./features/leads/LeadsPage'), 'LeadsPage');
const LeadFile = named(() => import('./features/leads/LeadFile'), 'LeadFile');
const PriceListsPage = named(() => import('./features/pricelists/PriceListsPage'), 'PriceListsPage');
const ExceptionsPage = named(() => import('./features/exceptions/ExceptionsPage'), 'ExceptionsPage');
const ReportsHub = named(() => import('./features/reports/ReportsPage'), 'ReportsHub');
const ReportView = named(() => import('./features/reports/ReportsPage'), 'ReportView');
const QuotesPage = named(() => import('./features/quotes/QuotesPage'), 'QuotesPage');
const QuotePage = named(() => import('./features/quotes/QuoteEditor'), 'QuotePage');
const OpsSummaryPage = named(() => import('./features/ops/OpsSummaryPage'), 'OpsSummaryPage');
const BoardPage = named(() => import('./features/board/BoardPage'), 'BoardPage');

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider>
        <ToastProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </ToastProvider>
      </Tooltip.Provider>
    </MotionConfig>
  );
}

/* שלד בזמן טעינת מסך עצל: כותרת ושורות. מופיע רק אם הטעינה לוקחת יותר מרגע, כדי שלא יהבהב */
function ScreenLoading() {
  return (
    <div className="page screen-loading" aria-busy="true" aria-label="טוען מסך">
      <Skeleton w={180} h={24} />
      <Skeleton w={260} h={14} />
      <div className="card screen-loading__rows">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={18} />)}</div>
    </div>
  );
}

/* אף אחד לא נכנס למערכת בלי אישור של מנהל המערכת */
function Gate() {
  const { phase } = useAuth();
  if (phase === 'loading') {
    return (
      <div className="boot" role="status" aria-label="טוען">
        <DominoTile size={72} />
      </div>
    );
  }
  if (phase !== 'active') return <AuthScreens />;
  return (
    <StoreProvider>
      <PanelProvider>
        <HashRouter>
          <InactivityGuard />
          <AppShell>
            <Suspense fallback={<ScreenLoading />}>
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/reports" element={<ReportsHub />} />
              <Route path="/reports/credit" element={<CreditReportPage />} />
              <Route path="/reports/close" element={<MonthClosePage />} />
              <Route path="/reports/period" element={<PeriodReport />} />
              <Route path="/reports/:id" element={<ReportView />} />
              <Route path="/styleguide" element={<StyleGuidePage />} />
              <Route path="/settings/*" element={<SettingsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerFile />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/leads/:id" element={<LeadFile />} />
              <Route path="/pricelists" element={<PriceListsPage />} />
              <Route path="/quotes" element={<QuotesPage />} />
              <Route path="/quotes/new" element={<QuotePage />} />
              <Route path="/quotes/:id" element={<QuotePage />} />
              <Route path="/ops" element={<OpsSummaryPage />} />
              <Route path="/board" element={<BoardPage />} />
              <Route path="/exceptions" element={<ExceptionsPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
            </Suspense>
          </AppShell>
        </HashRouter>
      </PanelProvider>
    </StoreProvider>
  );
}
