import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useWebSocket } from './contexts/WebSocketContext';
import { AuthPage } from './pages/AuthPage';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ToastContainer } from './components/common/ToastContainer';
import { DashboardPage } from './pages/DashboardPage';
import { DevicesPage } from './pages/DevicesPage';
import { TelemetryPage } from './pages/TelemetryPage';
import { RulesPage } from './pages/RulesPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { api } from './services/api';
import { Activity } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [alertStats, setAlertStats] = useState({ active_total: 0, critical: 0, warning: 0, info: 0 });

  const { subscribeAlerts } = useWebSocket();

  // Load simulator state and alert stats
  useEffect(() => {
    if (isAuthenticated) {
      api.getSimulatorStatus().then(s => setIsSimRunning(s.is_running)).catch(() => {});
      api.getAlertStats().then(s => setAlertStats(s)).catch(() => {});
    }
  }, [isAuthenticated, currentTab]);

  // Real-time alert counter update
  useEffect(() => {
    const unsub = subscribeAlerts(() => {
      setAlertStats(prev => ({
        ...prev,
        active_total: prev.active_total + 1,
      }));
    });
    return () => unsub();
  }, [subscribeAlerts]);

  const handleToggleSimulator = async () => {
    try {
      if (isSimRunning) {
        await api.stopSimulator();
        setIsSimRunning(false);
      } else {
        await api.startSimulator();
        setIsSimRunning(true);
      }
    } catch (err) {
      console.error('Error toggling simulator:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nexus-bg flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center glow-cyan mb-4 animate-bounce">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Initializing NexusFlow Engine...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigateTab={setCurrentTab} />;
      case 'devices':
        return <DevicesPage />;
      case 'telemetry':
        return <TelemetryPage />;
      case 'rules':
        return <RulesPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'simulator':
        return <SimulatorPage />;
      default:
        return <DashboardPage onNavigateTab={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg text-slate-100 flex">
      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Sidebar for Desktop */}
      <div className="hidden md:block">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          alertCount={alertStats.active_total}
        />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64">
            <Sidebar
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setCurrentTab(tab);
                setIsMobileMenuOpen(false);
              }}
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileMenuOpen(false)}
              alertCount={alertStats.active_total}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <Header
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
          isSimRunning={isSimRunning}
          onToggleSim={handleToggleSimulator}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
