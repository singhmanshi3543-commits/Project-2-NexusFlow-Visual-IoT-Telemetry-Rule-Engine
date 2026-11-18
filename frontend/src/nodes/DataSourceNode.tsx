import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Cpu, Thermometer, Droplets, Zap, Wind, Radio } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';

interface NodeData {
  deviceId?: string;
  metric?: string;
  label?: string;
}

export const DataSourceNode: React.FC<{ id: string; type: string; data: NodeData; selected: boolean }> = ({
  id,
  type,
  data,
  selected,
}) => {
  const { nodeExecutions, latestReadings } = useWebSocket();
  const exec = nodeExecutions[id];
  const deviceId = data.deviceId || 'TURBINE-001';
  const metric = data.metric || 'temperature';

  const reading = latestReadings[deviceId];
  const liveVal = reading ? (reading as any)[metric] ?? reading.temperature : null;

  const isRecent = exec && Date.now() - new Date(exec.timestamp).getTime() < 1500;

  const getIcon = () => {
    switch (type) {
      case 'temperatureSensor': return <Thermometer className="w-4 h-4 text-rose-400" />;
      case 'humiditySensor': return <Droplets className="w-4 h-4 text-cyan-400" />;
      case 'energySensor': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'airQualitySensor': return <Wind className="w-4 h-4 text-emerald-400" />;
      default: return <Cpu className="w-4 h-4 text-sky-400" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'temperatureSensor': return 'Temperature Sensor';
      case 'humiditySensor': return 'Humidity Sensor';
      case 'energySensor': return 'Energy Meter';
      case 'airQualitySensor': return 'Air Quality Sensor';
      case 'turbineSensor': return 'Turbine Sensor';
      default: return data.label || 'IoT Data Source';
    }
  };

  return (
    <div
      className={`min-w-[200px] rounded-xl border bg-nexus-card/95 backdrop-blur-md p-3.5 shadow-xl transition-all duration-300 ${
        selected ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-slate-700/80 hover:border-slate-600'
      } ${isRecent ? 'glow-node-active ring-2 ring-cyan-400' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-700/50 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
            {getIcon()}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 tracking-wide uppercase">{getTitle()}</h4>
            <p className="text-[10px] font-mono text-cyan-400">{deviceId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
          <Radio className="w-3 h-3 text-slate-400" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800">
        <span className="text-slate-400 capitalize">{metric}:</span>
        <span className="font-mono font-bold text-slate-100">
          {liveVal !== null ? `${Number(liveVal).toFixed(1)}` : 'Waiting...'}
        </span>
      </div>

      {isRecent && (
        <div className="mt-2 text-[10px] text-cyan-300 font-mono flex items-center justify-between bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
          <span>STREAMING</span>
          <span>{exec.outputValue !== undefined ? Number(exec.outputValue).toFixed(1) : ''}</span>
        </div>
      )}

      {/* Output socket handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
    </div>
  );
};
