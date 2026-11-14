import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import { 
  Play, 
  Pause, 
  Square, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Activity, 
  Sparkles, 
  FolderOpen,
  Maximize2,
  Trash2,
  Plus
} from 'lucide-react';

import { customNodeTypes } from '../nodes';
import { NodePalette } from './NodePalette';
import { NodeConfigInspector } from './NodeConfigInspector';
import { api } from '../services/api';
import { VisualGraphDefinition } from '../types';
import { useWebSocket } from '../contexts/WebSocketContext';

const INITIAL_NODES: Node[] = [
  {
    id: 'source-1',
    type: 'turbineSensor',
    position: { x: 50, y: 120 },
    data: { deviceId: 'TURBINE-001', metric: 'temperature', label: 'Turbine Temp Stream' },
  },
  {
    id: 'avg-1',
    type: 'movingAverage',
    position: { x: 320, y: 120 },
    data: { windowSize: 3, label: '3-Packet Rolling Mean' },
  },
  {
    id: 'thresh-1',
    type: 'thresholdComparison',
    position: { x: 580, y: 120 },
    data: { operator: '>', threshold: 75, label: 'Threshold (> 75°C)' },
  },
  {
    id: 'sms-1',
    type: 'smsAlert',
    position: { x: 840, y: 60 },
    data: { recipient: '+1 (555) 019-2834', cooldownSeconds: 20 },
  },
  {
    id: 'alert-1',
    type: 'dashboardAlert',
    position: { x: 840, y: 220 },
    data: { severity: 'critical', message: 'Turbine Overheat Moving Average Breach!', cooldownSeconds: 20 },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'source-1', target: 'avg-1', animated: true, className: 'animated-flow-edge' },
  { id: 'e2-3', source: 'avg-1', target: 'thresh-1', animated: true, className: 'animated-flow-edge' },
  { id: 'e3-4', source: 'thresh-1', target: 'sms-1', animated: true, className: 'animated-flow-edge' },
  { id: 'e3-5', source: 'thresh-1', target: 'alert-1', animated: true, className: 'animated-flow-edge' },
];

export const VisualGraphBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [graphId, setGraphId] = useState<string>('graph-turbine-safety');
  const [graphName, setGraphName] = useState<string>('Turbine Thermal Moving Average Safety Pipeline');
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'active' | 'paused'>('idle');
  
  // Validation Banner state
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodeExecutions } = useWebSocket();

  // Load existing graph or active pipeline state on mount
  useEffect(() => {
    api.getActivePipelines().then(pipelines => {
      const active = pipelines.find(p => p.graphId === graphId);
      if (active) {
        setPipelineStatus(active.status === 'active' ? 'active' : active.status === 'paused' ? 'paused' : 'idle');
      }
    }).catch(() => {});
  }, [graphId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      className: 'animated-flow-edge',
    }, eds)),
    []
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Drag and drop from palette onto canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 80,
        y: event.clientY - reactFlowBounds.top - 20,
      };

      const newNodeId = `node-${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: { label: `${type} node` },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    },
    []
  );

  const handleUpdateNodeData = (nodeId: string, newData: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          const updated = { ...n, data: newData };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  };

  const handleDuplicateNode = (node: Node) => {
    const newId = `node-${Date.now()}`;
    const clone: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      data: { ...node.data },
    };
    setNodes((nds) => nds.concat(clone));
    setSelectedNode(clone);
  };

  const handleSaveGraph = async () => {
    try {
      setStatusMessage('Saving graph to MongoDB...');
      const graphDef: Partial<VisualGraphDefinition> = {
        id: graphId,
        name: graphName,
        nodes,
        edges,
        isActive: pipelineStatus === 'active',
      };
      const res = await api.createGraph(graphDef);
      setValidationResult(res.validation);
      setStatusMessage('Graph successfully saved to database.');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      alert(`Error saving graph: ${err.message}`);
    }
  };

  const handleCompileGraph = async () => {
    try {
      setStatusMessage('Validating and compiling graph DAG into RxJS pipeline...');
      const res = await api.compileGraph(graphId, { id: graphId, name: graphName, nodes, edges });
      setValidationResult(res.validation);
      setStatusMessage('✓ Graph compiled successfully. No structural or acyclic errors found.');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setValidationResult({
        isValid: false,
        errors: [err.message],
        warnings: [],
      });
    }
  };

  const handleActivatePipeline = async () => {
    try {
      // Save first
      await api.createGraph({ id: graphId, name: graphName, nodes, edges, isActive: true });
      const res = await api.activateGraph(graphId);
      setPipelineStatus('active');
      setStatusMessage(`⚡ Pipeline "${graphName}" is LIVE and executing incoming telemetry streams.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Activation failed: ${err.message}`);
    }
  };

  const handlePausePipeline = async () => {
    try {
      await api.pauseGraph(graphId);
      setPipelineStatus('paused');
      setStatusMessage('Pipeline execution paused.');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResumePipeline = async () => {
    try {
      await api.resumeGraph(graphId);
      setPipelineStatus('active');
      setStatusMessage('Pipeline execution resumed.');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStopPipeline = async () => {
    try {
      await api.stopGraph(graphId);
      setPipelineStatus('idle');
      setStatusMessage('Pipeline stopped and detached from telemetry ingestion.');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLoadPreset = (preset: 'turbine' | 'humidity' | 'energy') => {
    if (preset === 'turbine') {
      setGraphId('graph-turbine-safety');
      setGraphName('Turbine Thermal Moving Average Safety Pipeline');
      setNodes(INITIAL_NODES);
      setEdges(INITIAL_EDGES);
    } else if (preset === 'humidity') {
      setGraphId('graph-humidity-cleanroom');
      setGraphName('Cleanroom Relative Humidity Webhook Pipeline');
      setNodes([
        { id: 'src-hum', type: 'humiditySensor', position: { x: 60, y: 150 }, data: { deviceId: 'HUM-002', metric: 'humidity' } },
        { id: 'thresh-hum', type: 'thresholdComparison', position: { x: 380, y: 150 }, data: { operator: '<', threshold: 25 } },
        { id: 'wh-hum', type: 'webhook', position: { x: 700, y: 150 }, data: { url: 'http://127.0.0.1:8000/api/mock-webhook-receiver' } },
      ]);
      setEdges([
        { id: 'e-h1', source: 'src-hum', target: 'thresh-hum', animated: true, className: 'animated-flow-edge' },
        { id: 'e-h2', source: 'thresh-hum', target: 'wh-hum', animated: true, className: 'animated-flow-edge' },
      ]);
    } else if (preset === 'energy') {
      setGraphId('graph-energy-feeder');
      setGraphName('Facility Main Feeder Surge Audit Pipeline');
      setNodes([
        { id: 'src-eng', type: 'energySensor', position: { x: 60, y: 150 }, data: { deviceId: 'ENG-003', metric: 'energy' } },
        { id: 'thresh-eng', type: 'thresholdComparison', position: { x: 380, y: 150 }, data: { operator: '>', threshold: 120 } },
        { id: 'log-eng', type: 'logEvent', position: { x: 700, y: 90 }, data: { logLevel: 'WARN' } },
        { id: 'sms-eng', type: 'smsAlert', position: { x: 700, y: 220 }, data: { recipient: '+1 (555) 998-1122' } },
      ]);
      setEdges([
        { id: 'e-e1', source: 'src-eng', target: 'thresh-eng', animated: true, className: 'animated-flow-edge' },
        { id: 'e-e2', source: 'thresh-eng', target: 'log-eng', animated: true, className: 'animated-flow-edge' },
        { id: 'e-e3', source: 'thresh-eng', target: 'sms-eng', animated: true, className: 'animated-flow-edge' },
      ]);
    }
    setPipelineStatus('idle');
    setValidationResult(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] w-full rounded-2xl border border-slate-800 bg-nexus-bg overflow-hidden shadow-2xl">
      {/* Top Professional Toolbar */}
      <div className="bg-nexus-card/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <input
              type="text"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              className="bg-transparent font-bold text-sm text-slate-100 hover:bg-slate-800/60 focus:bg-slate-900 border border-transparent focus:border-cyan-500 rounded px-1.5 py-0.5 focus:outline-none transition-colors"
            />
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="font-mono text-cyan-400">{graphId}</span>
              <span>•</span>
              <span className={`px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                pipelineStatus === 'active'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : pipelineStatus === 'paused'
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {pipelineStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Preset templates */}
          <select
            onChange={(e) => handleLoadPreset(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            defaultValue="turbine"
          >
            <option value="turbine">Preset: Turbine Overheat Moving Avg</option>
            <option value="humidity">Preset: Cleanroom Humidity Webhook</option>
            <option value="energy">Preset: Energy Surge Audit & SMS</option>
          </select>

          <button
            onClick={handleSaveGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-slate-300" />
            <span>Save</span>
          </button>

          <button
            onClick={handleCompileGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold border border-indigo-800/60 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Validate & Compile</span>
          </button>

          {pipelineStatus !== 'active' ? (
            <button
              onClick={handleActivatePipeline}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/40 glow-cyan transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Activate Live Pipeline</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePausePipeline}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 text-xs font-semibold border border-amber-800/60 transition-colors"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
              <button
                onClick={handleStopPipeline}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold border border-rose-800/60 transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Status / Validation Banner */}
      {(statusMessage || (validationResult && !validationResult.isValid)) && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
          validationResult && !validationResult.isValid
            ? 'bg-rose-950/80 border-rose-800 text-rose-200'
            : 'bg-cyan-950/70 border-cyan-800 text-cyan-200'
        }`}>
          <div className="flex items-center gap-2">
            {validationResult && !validationResult.isValid ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <span>
              {validationResult && !validationResult.isValid
                ? `Validation Error: ${validationResult.errors.join(' | ')}`
                : statusMessage}
            </span>
          </div>
          <button
            onClick={() => { setStatusMessage(null); setValidationResult(null); }}
            className="text-xs opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative" ref={reactFlowWrapper}>
        {/* Left Palette */}
        <NodePalette />

        {/* Center React Flow Canvas */}
        <div className="flex-1 h-full w-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={customNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
            className="bg-[#0B1120]"
          >
            <Background color="#1E293B" gap={20} size={1.5} variant={BackgroundVariant.Dots} />
            <Controls className="!bg-slate-900 !border-slate-700 !text-slate-100" />
            <MiniMap
              className="!bg-slate-950 !border-slate-800"
              nodeColor={(n) => {
                if (n.type?.includes('Sensor') || n.type === 'dataSource') return '#06B6D4';
                if (n.type?.includes('Alert') || n.type === 'webhook') return '#EF4444';
                return '#6366F1';
              }}
            />
            <Panel position="bottom-center" className="bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700 text-[11px] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse-dot" />
              <span>Reactive Stream Graph Engine • {nodes.length} Nodes • {edges.length} Streaming Edges</span>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Configuration Drawer */}
        <NodeConfigInspector
          selectedNode={selectedNode}
          onUpdateNodeData={handleUpdateNodeData}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onClose={() => setSelectedNode(null)}
        />
      </div>
    </div>
  );
};
