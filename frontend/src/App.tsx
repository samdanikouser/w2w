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
import DepotsPage from './pages/DepotsPage';
import BeneficiaryPage from './pages/BeneficiaryPage';
import OnboardingPage from './pages/OnboardingPage';
import AttendancePage from './pages/AttendancePage';
import VehiclesPage from './pages/VehiclesPage';
import TrainingPage from './pages/TrainingPage';
import ViolationsPage from './pages/ViolationsPage';
import PLRegisterPage from './pages/PLRegisterPage';
import EPRReportsPage from './pages/EPRReportsPage';
import ReportsPage from './pages/ReportsPage';
import StockRegisterPage from './pages/StockRegisterPage';
import StockVariancePage from './pages/StockVariancePage';
import DepotScannerPage from './pages/DepotScannerPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  const { isAuthenticated } = useAuthStore();
  const { activePage } = useNavStore();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'employees': return <EmployeesPage />;
      case 'waste-logs': return <WasteLogsPage />;
      case 'sites': return <SitesPage />;
      case 'epr-reports': return <EPRReportsPage />;
      case 'pl-register': return <PLRegisterPage />;
      case 'reports': return <ReportsPage />;
      case 'demographics': return <DemographicsPage />;
      case 'onboarding': return <OnboardingPage />;
      case 'attendance': return <AttendancePage />;
      case 'beneficiary': return <BeneficiaryPage />;
      case 'stock-register': return <StockRegisterPage />;
      case 'stock-variance': return <StockVariancePage />;
      case 'vehicles': return <VehiclesPage />;
      case 'depots': return <DepotsPage />;
      case 'depot-scanner': return <DepotScannerPage />;
      case 'training': return <TrainingPage />;
      case 'violations': return <ViolationsPage />;
      case 'audit-log': return <AuditLogPage />;
      case 'settings': return <SettingsPage />;
      case 'profile': return <ProfilePage />;
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
