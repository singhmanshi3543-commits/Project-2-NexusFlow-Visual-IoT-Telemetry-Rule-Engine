import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bell, MessageSquare, Globe, FileText, CheckCircle2 } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';

interface NodeData {
  recipient?: string;
  url?: string;
  severity?: string;
  cooldownSeconds?: number;
  label?: string;
}

export const ActionNode: React.FC<{ id: string; type: string; data: NodeData; selected: boolean }> = ({
  id,
  type,
  data,
  selected,
}) => {
  const { nodeExecutions } = useWebSocket();
  const exec = nodeExecutions[id];
  const isRecent = exec && Date.now() - new Date(exec.timestamp).getTime() < 2500;

  const getDetails = () => {
    switch (type) {
      case 'smsAlert':
        return {
          title: 'Mock SMS Alert',
          desc: data.recipient || '+1 (555) 019-2834',
          icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
          badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        };
      case 'webhook':
        return {
          title: 'HTTP Webhook',
          desc: data.url ? data.url.replace(/https?:\/\//, '').slice(0, 22) + '...' : 'POST /webhook',
          icon: <Globe className="w-4 h-4 text-sky-400" />,
          badgeColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
        };
      case 'dashboardAlert':
        return {
          title: 'Live Incident Alert',
          desc: `Severity: ${data.severity || 'critical'}`,
          icon: <Bell className="w-4 h-4 text-rose-400" />,
          badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
        };
      case 'logEvent':
        return {
          title: 'Audit Log Event',
          desc: 'Persist DB Event',
          icon: <FileText className="w-4 h-4 text-amber-400" />,
          badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        };
      default:
        return {
          title: data.label || 'Action Trigger',
          desc: 'Trigger',
          icon: <Bell className="w-4 h-4 text-rose-400" />,
          badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
        };
    }
  };

  const { title, desc, icon, badgeColor } = getDetails();

  return (
    <div
      className={`min-w-[190px] rounded-xl border bg-nexus-card/95 backdrop-blur-md p-3.5 shadow-xl transition-all duration-300 ${
        selected ? 'border-rose-400 ring-2 ring-rose-400/30' : 'border-slate-700/80 hover:border-slate-600'
      } ${isRecent ? 'glow-node-alert ring-2 ring-rose-500 scale-105' : ''}`}
    >
      {/* Input socket handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />

      <div className="flex items-center justify-between gap-2 border-b border-slate-700/50 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
            {icon}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 tracking-wide uppercase">{title}</h4>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{desc}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800">
        <span className="text-slate-400">Trigger State:</span>
        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
          {isRecent ? 'DISPATCHED' : 'ARMED'}
        </span>
      </div>

      {isRecent && (
        <div className="mt-2 text-[10px] font-mono flex items-center justify-between px-2 py-0.5 rounded border bg-rose-950/60 text-rose-300 border-rose-800/50 animate-pulse">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-rose-400" />
            <span>ACTION FIRED</span>
          </div>
          <span>LIVE</span>
        </div>
      )}
    </div>
  );
};
