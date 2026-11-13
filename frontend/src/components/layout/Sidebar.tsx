import React from 'react';
import { 
  LayoutDashboard, 
  Cpu, 
  Activity, 
  Sliders, 
  Bell, 
  BarChart3, 
  PlayCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export type NavigationTab = 'dashboard' | 'devices' | 'telemetry' | 'rules' | 'alerts' | 'analytics' | 'simulator';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  alertCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  alertCount
}) => {
  const { user, logout } = useAuth();

  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'devices', label: 'Device Manager', icon: <Cpu className="w-5 h-5" /> },
    { id: 'telemetry', label: 'Visual Telemetry', icon: <Activity className="w-5 h-5" /> },
    { id: 'rules', label: 'Visual Flow Studio', icon: <Sliders className="w-5 h-5" /> },
    { id: 'alerts', label: 'Alert Center', icon: <Bell className="w-5 h-5" />, badge: alertCount },
    { id: 'analytics', label: 'Analytics & Reports', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'simulator', label: 'IoT Simulator', icon: <PlayCircle className="w-5 h-5" /> },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen bg-nexus-secondary/95 border-r border-nexus-border flex flex-col justify-between transition-all duration-300 backdrop-blur-md ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-nexus-border">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center glow-cyan shadow-lg">
                <Activity className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  Nexus<span className="text-cyan-400">Flow</span>
                </span>
                <span className="text-[10px] uppercase font-semibold text-cyan-400/80 block tracking-widest">
                  RxJS & MongoDB TS
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center glow-cyan">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors hidden md:block"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
                  isActive
                    ? 'bg-nexus-accent/15 text-cyan-400 border border-nexus-accent/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-nexus-card/60'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <span className={isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}

                {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                    {item.badge}
                  </span>
                )}

                {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-nexus-secondary" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile & Logout */}
      <div className="p-3 border-t border-nexus-border bg-nexus-bg/50">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-nexus-card/50 border border-nexus-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-xs">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.full_name || 'Operator'}</p>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" />
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user?.role || 'admin'}</p>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div 
              title={user?.email || 'User'}
              className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-xs"
            >
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
