import '../styles/NodePalette.css';
import React, { useState } from 'react';
import { 
  Database, 
  Calculator, 
  Send, 
  Thermometer, 
  Droplets, 
  Zap, 
  Wind, 
  Cpu, 
  TrendingUp, 
  Sliders, 
  MessageSquare, 
  Globe, 
  Bell, 
  FileText,
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface PaletteNodeItem {
  type: string;
  name: string;
  category: 'source' | 'math' | 'action';
  desc: string;
  icon: React.ReactNode;
}

const PALETTE_ITEMS: PaletteNodeItem[] = [
  // Sources
  { type: 'turbineSensor', name: 'Turbine Multi-Sensor', category: 'source', desc: 'Industrial generation turbine metrics', icon: <Cpu className="w-4 h-4 text-sky-400" /> },
  { type: 'temperatureSensor', name: 'Temperature Sensor', category: 'source', desc: 'PT100 thermal probe (°C)', icon: <Thermometer className="w-4 h-4 text-rose-400" /> },
  { type: 'humiditySensor', name: 'Humidity Sensor', category: 'source', desc: 'Relative humidity (%)', icon: <Droplets className="w-4 h-4 text-cyan-400" /> },
  { type: 'energySensor', name: 'Energy Meter', category: 'source', desc: 'Active power draw (kWh)', icon: <Zap className="w-4 h-4 text-amber-400" /> },
  { type: 'airQualitySensor', name: 'Air Quality Sensor', category: 'source', desc: 'Laser particulate AQI', icon: <Wind className="w-4 h-4 text-emerald-400" /> },
  
  // Math
  { type: 'movingAverage', name: 'Moving Average', category: 'math', desc: 'Rolling window arithmetic mean', icon: <TrendingUp className="w-4 h-4 text-sky-400" /> },
  { type: 'thresholdComparison', name: 'Threshold Compare', category: 'math', desc: 'Evaluate condition (>, <, ==)', icon: <Sliders className="w-4 h-4 text-violet-400" /> },
  { type: 'addition', name: 'Addition (+)', category: 'math', desc: 'Add constant offset', icon: <Calculator className="w-4 h-4 text-indigo-400" /> },
  { type: 'subtraction', name: 'Subtraction (-)', category: 'math', desc: 'Subtract scalar offset', icon: <Calculator className="w-4 h-4 text-indigo-400" /> },
  { type: 'multiplication', name: 'Multiplication (×)', category: 'math', desc: 'Scale by scalar factor', icon: <Calculator className="w-4 h-4 text-indigo-400" /> },
  { type: 'division', name: 'Division (÷)', category: 'math', desc: 'Divide by scalar factor', icon: <Calculator className="w-4 h-4 text-indigo-400" /> },

  // Actions
  { type: 'smsAlert', name: 'Mock SMS Alert', category: 'action', desc: 'Local simulated SMS dispatch', icon: <MessageSquare className="w-4 h-4 text-emerald-400" /> },
  { type: 'webhook', name: 'HTTP Webhook', category: 'action', desc: 'POST payload to external URL', icon: <Globe className="w-4 h-4 text-sky-400" /> },
  { type: 'dashboardAlert', name: 'Live Dashboard Alert', category: 'action', desc: 'Create alert incident banner', icon: <Bell className="w-4 h-4 text-rose-400" /> },
  { type: 'logEvent', name: 'Audit Log Event', category: 'action', desc: 'Persist execution log record', icon: <FileText className="w-4 h-4 text-amber-400" /> },
];

export const NodePalette: React.FC = () => {
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState({ source: true, math: true, action: true });

  const toggleSection = (cat: 'source' | 'math' | 'action') => {
    setOpenSections(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredItems = PALETTE_ITEMS.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.desc.toLowerCase().includes(search.toLowerCase())
  );

  const sources = filteredItems.filter(i => i.category === 'source');
  const math = filteredItems.filter(i => i.category === 'math');
  const actions = filteredItems.filter(i => i.category === 'action');

  return (
    <div className="w-64 h-full bg-nexus-card/90 backdrop-blur-md border-r border-slate-700/60 flex flex-col p-3 select-none">
      <div className="mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Node Library</span>
        </h3>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* Data Sources */}
        <div>
          <button
            onClick={() => toggleSection('source')}
            className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 hover:text-slate-200"
          >
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>Data Sources ({sources.length})</span>
            </span>
            {openSections.source ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSections.source && (
            <div className="space-y-1.5">
              {sources.map(item => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/50 hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors"
                >
                  <div className="p-1 rounded bg-slate-900 border border-slate-700">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Math Operations */}
        <div>
          <button
            onClick={() => toggleSection('math')}
            className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 hover:text-slate-200"
          >
            <span className="flex items-center gap-1">
              <Calculator className="w-3 h-3 text-indigo-400" />
              <span>Math Operations ({math.length})</span>
            </span>
            {openSections.math ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSections.math && (
            <div className="space-y-1.5">
              {math.map(item => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors"
                >
                  <div className="p-1 rounded bg-slate-900 border border-slate-700">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Triggers */}
        <div>
          <button
            onClick={() => toggleSection('action')}
            className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 hover:text-slate-200"
          >
            <span className="flex items-center gap-1">
              <Send className="w-3 h-3 text-rose-400" />
              <span>Action Triggers ({actions.length})</span>
            </span>
            {openSections.action ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openSections.action && (
            <div className="space-y-1.5">
              {actions.map(item => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-rose-500/50 hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors"
                >
                  <div className="p-1 rounded bg-slate-900 border border-slate-700">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-700/50 text-[10px] text-slate-400 text-center">
        Drag & drop nodes into canvas
      </div>
    </div>
  );
};

