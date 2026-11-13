import React, { useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Play, 
  Pause, 
  Zap, 
  Flame, 
  Droplets, 
  Wind, 
  Menu,
  ChevronDown
} from 'lucide-react';
import { NavigationTab } from './Sidebar';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { api } from '../../services/api';

interface HeaderProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onMobileMenuToggle: () => void;
  isSimRunning: boolean;
  onToggleSim: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onMobileMenuToggle,
  isSimRunning,
  onToggleSim
}) => {
  const { isConnected } = useWebSocket();
  const [isAnomalyOpen, setIsAnomalyOpen] = useState(false);
  const [injecting, setInjecting] = useState<string | null>(null);

  const getTabTitle = (tab: NavigationTab) => {
    switch (tab) {
      case 'dashboard': return 'Command Center Dashboard';
      case 'devices': return 'IoT Device Inventory';
      case 'telemetry': return 'Visual Telemetry Monitor';
      case 'rules': return 'Rule Engine Studio';
      case 'alerts': return 'Incident & Alert Center';
      case 'analytics': return 'Telemetry Analytics & Export';
      case 'simulator': return 'Virtual Device Simulator';
      default: return 'NexusFlow Platform';
    }
  };

  const handleInject = async (scenario: string) => {
    setInjecting(scenario);
    try {
      await api.injectAnomaly(scenario);
      setIsAnomalyOpen(false);
    } catch (err) {
      console.error("Failed to inject anomaly:", err);
    } finally {
      setTimeout(() => setInjecting(null), 1000);
    }
  };

  return (
    <header className="h-16 bg-nexus-secondary/70 border-b border-nexus-border backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
      {/* Left: Mobile trigger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>NexusFlow</span>
            <span>/</span>
            <span className="text-cyan-400 capitalize">{currentTab}</span>
          </div>
          <h1 className="text-base lg:text-lg font-bold text-white tracking-tight leading-tight">
            {getTabTitle(currentTab)}
          </h1>
        </div>
      </div>

      {/* Right: Live Status pills, Simulator Controls, Anomaly Quick Trigger */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* WebSocket Connection Pill */}
        <div 
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            isConnected 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Wifi className="w-3.5 h-3.5 hidden sm:inline" />
              <span>Live WS Stream</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <WifiOff className="w-3.5 h-3.5 hidden sm:inline" />
              <span>Reconnecting</span>
            </>
          )}
        </div>

        {/* Quick Simulator Toggle */}
        <button
          onClick={onToggleSim}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            isSimRunning
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25 glow-cyan'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isSimRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400" />
              <span className="hidden sm:inline">Sim: 3s Loop</span>
              <span className="sm:hidden">Active</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-slate-300 text-slate-300" />
              <span>Start Sim</span>
            </>
          )}
        </button>

        {/* Anomaly Injection Quick Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsAnomalyOpen(!isAnomalyOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-500/20 to-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Trigger Demo Anomaly</span>
            <span className="md:hidden">Spike</span>
            <ChevronDown className="w-3 h-3 text-amber-400" />
          </button>

          {isAnomalyOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-nexus-card border border-nexus-border rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-fadeIn">
              <div className="px-2 py-1 border-b border-nexus-border/60 mb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Instant Scenario Ingestion
                </p>
                <p className="text-[10px] text-slate-400">
                  Triggers immediate threshold breaches for review.
                </p>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => handleInject('heat_spike')}
                  disabled={injecting !== null}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left text-red-200 hover:bg-red-500/20 transition-colors"
                >
                  <Flame className="w-4 h-4 text-red-400" />
                  <div>
                    <span className="font-semibold block text-red-400">🔥 Heat Spike (45.8°C)</span>
                    <span className="text-[10px] text-slate-400">Triggers Critical Temp Rule</span>
                  </div>
                </button>

                <button
                  onClick={() => handleInject('humidity_drop')}
                  disabled={injecting !== null}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left text-amber-200 hover:bg-amber-500/20 transition-colors"
                >
                  <Droplets className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="font-semibold block text-amber-400">💧 Low Humidity (18.2%)</span>
                    <span className="text-[10px] text-slate-400">Triggers Warning Rule</span>
                  </div>
                </button>

                <button
                  onClick={() => handleInject('energy_surge')}
                  disabled={injecting !== null}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left text-yellow-200 hover:bg-yellow-500/20 transition-colors"
                >
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <div>
                    <span className="font-semibold block text-yellow-400">⚡ Energy Surge (96.4 kWh)</span>
                    <span className="text-[10px] text-slate-400">Triggers Peak Draw Rule</span>
                  </div>
                </button>

                <button
                  onClick={() => handleInject('toxic_air')}
                  disabled={injecting !== null}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left text-purple-200 hover:bg-purple-500/20 transition-colors"
                >
                  <Wind className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="font-semibold block text-purple-400">☣️ Toxic Air (AQI 218)</span>
                    <span className="text-[10px] text-slate-400">Triggers Critical AQI Rule</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
