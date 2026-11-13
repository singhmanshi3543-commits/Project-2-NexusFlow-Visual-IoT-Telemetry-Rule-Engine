import React from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { activeToasts, removeToast } = useWebSocket();

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
      {activeToasts.map((toast) => {
        let borderClass = 'border-blue-500/30 bg-nexus-card/95 text-slate-100';
        let icon = <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />;

        if (toast.severity === 'critical') {
          borderClass = 'border-red-500/60 bg-red-950/90 text-red-100 glow-critical';
          icon = <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 animate-pulse" />;
        } else if (toast.severity === 'warning') {
          borderClass = 'border-amber-500/60 bg-amber-950/90 text-amber-100';
          icon = <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slideIn ${borderClass}`}
          >
            {icon}
            <div className="flex-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold uppercase tracking-wider text-xs opacity-90">
                  {toast.severity} Alert
                </span>
                <span className="text-xs text-slate-400">{toast.timestamp}</span>
              </div>
              <p className="mt-1 leading-snug font-medium text-slate-200">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-100 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
