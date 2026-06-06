import { useAuthStore } from './stores/authStore';
import { useNavStore } from './stores/navStore';
import LoginPage from './components/login/LoginPage';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import DashboardPage from './components/dashboard/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import WasteLogsPage from './pages/WasteLogsPage';
import SitesPage from './pages/SitesPage';
import DemographicsPage from './pages/DemographicsPage';
import FacilityDashboard from './pages/FacilityDashboard';
import DepotsPage from './pages/DepotsPage';
import CheckInOutPage from './pages/CheckInOutPage';
import BeneficiaryPage from './pages/BeneficiaryPage';
import OnboardingPage from './pages/OnboardingPage';
import AttendancePage from './pages/AttendancePage';
import VehiclesPage from './pages/VehiclesPage';
import TrainingPage from './pages/TrainingPage';
import ViolationsPage from './pages/ViolationsPage';
import PLRegisterPage from './pages/PLRegisterPage';
import EPRReportsPage from './pages/EPRReportsPage';
import ReportsPage from './pages/ReportsPage';
import WasteReportPage from './pages/WasteReportPage';
import TrainingReportPage from './pages/TrainingReportPage';
import DemographicsReportPage from './pages/DemographicsReportPage';
import AttendanceReportPage from './pages/AttendanceReportPage';
import PLReportPage from './pages/PLReportPage';
import StockRegisterPage from './pages/StockRegisterPage';

import DepotScannerPage from './pages/DepotScannerPage';
import AuditLogPage from './pages/AuditLogPage';
import W2WSettingsPage from './pages/W2WSettingsPage';
import ProfilePage from './pages/ProfilePage';
import HelpDocsPage from './pages/HelpDocsPage';

import RegisterOrgPage from './components/login/RegisterOrgPage';
import { useState, useEffect } from 'react';

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { activePage } = useNavStore();
  const [showLogin, setShowLogin] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      import('./api/endpoints').then(({ authApi }) => {
        authApi.setupStatus().then((res) => {
          setIsSetupComplete(res.isSetupComplete);
          // If setup is complete, always show login (never register)
          setShowLogin(res.isSetupComplete ? true : false);
        }).catch(() => {
          // On error (backend down etc), default to login — never expose register
          setIsSetupComplete(true);
          setShowLogin(true);
        });
      });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    if (isSetupComplete === null) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;

    // If setup is complete, ALWAYS show login — never allow register
    if (isSetupComplete || showLogin) {
      return <LoginPage onGoToRegister={isSetupComplete ? undefined : () => setShowLogin(false)} />;
    }
    return <RegisterOrgPage onGoToLogin={() => setShowLogin(true)} />;
  }

  const renderPage = () => {
    // Pages that don't require module checking
    const publicPages = ['dashboard', 'profile', 'help-docs'];
    
    // Some nested report pages might be under 'reports' module
    const reportPages = ['waste-report', 'training-report', 'demographics-report', 'attendance-report', 'pl-report'];
    
    const isReportPage = reportPages.includes(activePage);
    const requiredModule = isReportPage ? 'reports' : activePage;

    if (!publicPages.includes(activePage) && !user?.modules?.includes(requiredModule)) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page. Please contact your administrator.</p>
        </div>
      );
    }

    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'facilities': return <FacilityDashboard />;
      case 'employees': return <EmployeesPage />;
      case 'waste-logs': return <WasteLogsPage />;
      case 'sites': return <SitesPage />;
      case 'epr-reports': return <EPRReportsPage />;
      case 'pl-register': return <PLRegisterPage />;
      case 'reports': return <ReportsPage />;
      case 'waste-report': return <WasteReportPage />;
      case 'training-report': return <TrainingReportPage />;
      case 'demographics-report': return <DemographicsReportPage />;
      case 'attendance-report': return <AttendanceReportPage />;
      case 'pl-report': return <PLReportPage />;
      case 'demographics': return <DemographicsPage />;
      case 'onboarding': return <OnboardingPage />;
      case 'attendance': return <AttendancePage />;
      case 'check-in-out': return <CheckInOutPage />;
      case 'beneficiary': return <BeneficiaryPage />;
      case 'stock-register': return <StockRegisterPage />;

      case 'vehicles': return <VehiclesPage />;
      case 'depots': return <DepotsPage />;
      case 'depot-scanner': return <DepotScannerPage />;
      case 'training': return <TrainingPage />;
      case 'violations': return <ViolationsPage />;
      case 'audit-log': return <AuditLogPage />;
      case 'w2w-settings': return <W2WSettingsPage />;
      case 'profile': return <ProfilePage />;
      case 'help-docs': return <HelpDocsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Sidebar />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,        // ← critical: lets the column shrink below content width
          overflow: 'hidden', // ← critical: stops wide content from blowing out the column
        }}
      >
        <TopBar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '18px 22px',
            background: 'var(--color-surface2)',
            width: '100%',
          }}
        >
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
