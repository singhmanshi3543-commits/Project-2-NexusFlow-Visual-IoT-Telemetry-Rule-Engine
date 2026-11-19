import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Calculator, TrendingUp, Sliders, ArrowDownUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';

interface NodeData {
  operand?: number;
  windowSize?: number;
  operator?: string;
  threshold?: number;
  label?: string;
}

export const MathNode: React.FC<{ id: string; type: string; data: NodeData; selected: boolean }> = ({
  id,
  type,
  data,
  selected,
}) => {
  const { nodeExecutions } = useWebSocket();
  const exec = nodeExecutions[id];
  const isRecent = exec && Date.now() - new Date(exec.timestamp).getTime() < 1500;
  const isAlert = exec && exec.status === 'alert';

  const getDetails = () => {
    switch (type) {
      case 'addition':
        return { title: 'Addition (+)', desc: `+ ${data.operand ?? 0}`, icon: <Calculator className="w-4 h-4 text-indigo-400" /> };
      case 'subtraction':
        return { title: 'Subtraction (-)', desc: `- ${data.operand ?? 0}`, icon: <Calculator className="w-4 h-4 text-indigo-400" /> };
      case 'multiplication':
        return { title: 'Multiplication (×)', desc: `× ${data.operand ?? 1}`, icon: <Calculator className="w-4 h-4 text-indigo-400" /> };
      case 'division':
        return { title: 'Division (÷)', desc: `÷ ${data.operand ?? 1}`, icon: <Calculator className="w-4 h-4 text-indigo-400" /> };
      case 'movingAverage':
        return { title: 'Moving Average', desc: `Window: ${data.windowSize ?? 5} pkts`, icon: <TrendingUp className="w-4 h-4 text-sky-400" /> };
      case 'minimum':
        return { title: 'Rolling Minimum', desc: `Window: ${data.windowSize ?? 5} pkts`, icon: <ArrowDownUp className="w-4 h-4 text-emerald-400" /> };
      case 'maximum':
        return { title: 'Rolling Maximum', desc: `Window: ${data.windowSize ?? 5} pkts`, icon: <ArrowDownUp className="w-4 h-4 text-amber-400" /> };
      case 'thresholdComparison':
        return {
          title: 'Threshold Compare',
          desc: `Condition: ${data.operator ?? '>'} ${data.threshold ?? 50}`,
          icon: <Sliders className="w-4 h-4 text-violet-400" />,
        };
      default:
        return { title: data.label || 'Math Node', desc: '', icon: <Calculator className="w-4 h-4 text-indigo-400" /> };
    }
  };

  const { title, desc, icon } = getDetails();

  return (
    <div
      className={`min-w-[190px] rounded-xl border bg-nexus-card/95 backdrop-blur-md p-3.5 shadow-xl transition-all duration-300 ${
        selected ? 'border-indigo-400 ring-2 ring-indigo-400/30' : 'border-slate-700/80 hover:border-slate-600'
      } ${isAlert ? 'glow-node-alert ring-2 ring-rose-500' : isRecent ? 'glow-node-active ring-2 ring-indigo-400' : ''}`}
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
            <p className="text-[10px] text-slate-400 font-mono">{desc}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800">
        <span className="text-slate-400">Evaluated:</span>
        <span className="font-mono font-bold text-slate-100">
          {exec ? (
            typeof exec.outputValue === 'number'
              ? exec.outputValue.toFixed(2)
              : exec.status === 'alert'
              ? 'TRIGGERED'
              : exec.status === 'filtered'
              ? 'NORMAL'
              : 'OK'
          ) : (
            'Idle'
          )}
        </span>
      </div>

      {isRecent && (
        <div className={`mt-2 text-[10px] font-mono flex items-center justify-between px-2 py-0.5 rounded border ${
          isAlert ? 'bg-rose-950/60 text-rose-300 border-rose-800/50' : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40'
        }`}>
          <div className="flex items-center gap-1">
            {isAlert ? <AlertTriangle className="w-3 h-3 text-rose-400" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
            <span>{exec.status.toUpperCase()}</span>
          </div>
          <span>{exec.executionTimeMs}ms</span>
        </div>
      )}

      {/* Output socket handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
    </div>
  );
};
