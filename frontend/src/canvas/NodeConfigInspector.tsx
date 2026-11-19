import '../styles/NodeConfigInspector.css';
import React from 'react';
import { X, Trash2, Copy, Settings2 } from 'lucide-react';
import { Node } from '@xyflow/react';

interface InspectorProps {
  selectedNode: Node | null;
  onUpdateNodeData: (nodeId: string, newData: Record<string, any>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (node: Node) => void;
  onClose: () => void;
}

const AVAILABLE_DEVICES = [
  { id: 'TURBINE-001', name: 'TURBINE-001 (Turbine Multi-Sensor)' },
  { id: 'TEMP-001', name: 'TEMP-001 (Reactor Thermocouple)' },
  { id: 'HUM-002', name: 'HUM-002 (Cleanroom Hygrometer)' },
  { id: 'ENG-003', name: 'ENG-003 (Facility Feeder Meter)' },
  { id: 'AQI-004', name: 'AQI-004 (Exhaust Stack AQI)' },
];

export const NodeConfigInspector: React.FC<InspectorProps> = ({
  selectedNode,
  onUpdateNodeData,
  onDeleteNode,
  onDuplicateNode,
  onClose,
}) => {
  if (!selectedNode) return null;

  const { id, type, data } = selectedNode;

  const handleChange = (field: string, value: any) => {
    onUpdateNodeData(id, {
      ...data,
      [field]: value,
    });
  };

  const isSource = type === 'dataSource' || type?.endsWith('Sensor');
  const isMath = type === 'movingAverage' || type === 'minimum' || type === 'maximum' || type === 'addition' || type === 'subtraction' || type === 'multiplication' || type === 'division' || type === 'thresholdComparison';
  const isAction = type === 'smsAlert' || type === 'webhook' || type === 'dashboardAlert' || type === 'logEvent';

  return (
    <div className="w-80 h-full bg-nexus-card/95 backdrop-blur-md border-l border-slate-700/60 flex flex-col p-4 shadow-2xl z-20">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Node Properties</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="text-xs text-slate-400 mb-4 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
        <p className="font-semibold text-slate-200">{type}</p>
        <p className="font-mono text-[10px] text-cyan-400">ID: {id}</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
        {/* Source Node Configuration */}
        {isSource && (
          <>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Target IoT Device</label>
              <select
                value={(data.deviceId as string) || 'TURBINE-001'}
                onChange={(e) => handleChange('deviceId', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {AVAILABLE_DEVICES.map(dev => (
                  <option key={dev.id} value={dev.id}>{dev.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Telemetry Metric</label>
              <select
                value={(data.metric as string) || 'temperature'}
                onChange={(e) => handleChange('metric', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="temperature">Temperature (°C)</option>
                <option value="humidity">Relative Humidity (%)</option>
                <option value="energy">Active Energy (kWh)</option>
                <option value="aqi">Air Quality Index (AQI)</option>
              </select>
            </div>
          </>
        )}

        {/* Window-based Math Nodes (movingAverage, min, max) */}
        {(type === 'movingAverage' || type === 'minimum' || type === 'maximum') && (
          <div>
            <label className="block text-slate-300 font-medium mb-1">Window Size (Packets)</label>
            <input
              type="number"
              min="2"
              max="50"
              value={Number(data.windowSize ?? 5)}
              onChange={(e) => handleChange('windowSize', parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Number of consecutive telemetry readings to buffer.</p>
          </div>
        )}

        {/* Arithmetic Nodes */}
        {(type === 'addition' || type === 'subtraction' || type === 'multiplication' || type === 'division') && (
          <div>
            <label className="block text-slate-300 font-medium mb-1">Scalar Value (Operand)</label>
            <input
              type="number"
              step="0.1"
              value={Number(data.operand ?? (type === 'multiplication' || type === 'division' ? 1 : 0))}
              onChange={(e) => handleChange('operand', parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}

        {/* Threshold Comparison */}
        {type === 'thresholdComparison' && (
          <>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Comparison Operator</label>
              <select
                value={(data.operator as string) || '>'}
                onChange={(e) => handleChange('operator', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value=">">Greater than (&gt;)</option>
                <option value="<">Less than (&lt;)</option>
                <option value=">=">Greater or equal (&gt;=)</option>
                <option value="<=">Less or equal (&lt;=)</option>
                <option value="==">Strictly Equal (==)</option>
                <option value="!=">Not Equal (!=)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Threshold Value</label>
              <input
                type="number"
                step="0.5"
                value={Number(data.threshold ?? 50)}
                onChange={(e) => handleChange('threshold', parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
              </input>
            </div>
          </>
        )}

        {/* Mock SMS Node */}
        {type === 'smsAlert' && (
          <>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Recipient Phone / Channel</label>
              <input
                type="text"
                value={(data.recipient as string) || '+1 (555) 019-2834'}
                onChange={(e) => handleChange('recipient', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Cooldown (Seconds)</label>
              <input
                type="number"
                min="0"
                value={Number(data.cooldownSeconds ?? 30)}
                onChange={(e) => handleChange('cooldownSeconds', parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Prevents alert spamming during prolonged spikes.</p>
            </div>
          </>
        )}

        {/* Webhook Node */}
        {type === 'webhook' && (
          <>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Target Endpoint URL</label>
              <input
                type="url"
                value={(data.url as string) || 'http://127.0.0.1:8000/api/mock-webhook-receiver'}
                onChange={(e) => handleChange('url', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Max Retries</label>
              <input
                type="number"
                min="1"
                max="5"
                value={Number(data.retries ?? 3)}
                onChange={(e) => handleChange('retries', parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </>
        )}

        {/* Dashboard Alert Node */}
        {type === 'dashboardAlert' && (
          <>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Severity</label>
              <select
                value={(data.severity as string) || 'critical'}
                onChange={(e) => handleChange('severity', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="critical">Critical (Red Pulse)</option>
                <option value="warning">Warning (Amber)</option>
                <option value="info">Info (Cyan)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Custom Incident Message</label>
              <input
                type="text"
                value={(data.message as string) || 'Threshold violation detected'}
                onChange={(e) => handleChange('message', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Cooldown (Seconds)</label>
              <input
                type="number"
                min="0"
                value={Number(data.cooldownSeconds ?? 30)}
                onChange={(e) => handleChange('cooldownSeconds', parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </>
        )}
      </div>

      <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
        <button
          onClick={() => onDuplicateNode(selectedNode)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
        >
          <Copy className="w-3.5 h-3.5 text-cyan-400" />
          <span>Duplicate</span>
        </button>
        <button
          onClick={() => onDeleteNode(id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium transition-colors border border-rose-800/50"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};

