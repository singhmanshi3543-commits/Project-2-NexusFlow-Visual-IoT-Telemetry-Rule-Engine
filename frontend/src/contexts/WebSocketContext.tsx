import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { TelemetryReading, Alert, NodeExecutionEvent } from '../types';

interface ToastAlert {
  id: number | string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  latestReadings: Record<string, TelemetryReading>; // deviceId -> reading
  recentTelemetryStream: TelemetryReading[];
  activeToasts: ToastAlert[];
  nodeExecutions: Record<string, NodeExecutionEvent>; // nodeId -> latest event
  removeToast: (id: number | string) => void;
  subscribeTelemetry: (callback: (data: TelemetryReading) => void) => () => void;
  subscribeAlerts: (callback: (alert: Alert) => void) => () => void;
  subscribeNodeExecution: (callback: (event: NodeExecutionEvent) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestReadings, setLatestReadings] = useState<Record<string, TelemetryReading>>({});
  const [recentTelemetryStream, setRecentTelemetryStream] = useState<TelemetryReading[]>([]);
  const [activeToasts, setActiveToasts] = useState<ToastAlert[]>([]);
  const [nodeExecutions, setNodeExecutions] = useState<Record<string, NodeExecutionEvent>>({});

  const telemetrySubscribers = useRef<Set<(data: TelemetryReading) => void>>(new Set());
  const alertSubscribers = useRef<Set<(alert: Alert) => void>>(new Set());
  const nodeSubscribers = useRef<Set<(event: NodeExecutionEvent) => void>>(new Set());

  const removeToast = useCallback((id: number | string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const subscribeTelemetry = useCallback((callback: (data: TelemetryReading) => void) => {
    telemetrySubscribers.current.add(callback);
    return () => {
      telemetrySubscribers.current.delete(callback);
    };
  }, []);

  const subscribeAlerts = useCallback((callback: (alert: Alert) => void) => {
    alertSubscribers.current.add(callback);
    return () => {
      alertSubscribers.current.delete(callback);
    };
  }, []);

  const subscribeNodeExecution = useCallback((callback: (event: NodeExecutionEvent) => void) => {
    nodeSubscribers.current.add(callback);
    return () => {
      nodeSubscribers.current.delete(callback);
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Connect to backend WS directly or through dev proxy
    const wsUrl = `${protocol}//${host}/ws`;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const evtName = data.event;

            // 1. Telemetry updates
            if (evtName === 'telemetry:update' || evtName === 'new_telemetry') {
              const reading: TelemetryReading = data.data || data.telemetry;
              if (reading) {
                const devId = reading.deviceId || reading.device_id;
                setLatestReadings(prev => ({
                  ...prev,
                  [devId]: reading,
                }));
                setRecentTelemetryStream(prev => {
                  const next = [...prev, reading];
                  return next.slice(-60); // keep last 60 streaming points
                });
                telemetrySubscribers.current.forEach(cb => cb(reading));
              }
            }

            // 2. Alert notifications
            if (evtName === 'alert:created' || evtName === 'new_alert') {
              const alert: Alert = data.data || data.alert;
              if (alert) {
                const newToast: ToastAlert = {
                  id: alert.id || Date.now(),
                  message: alert.message,
                  severity: alert.severity,
                  timestamp: new Date().toLocaleTimeString(),
                };
                setActiveToasts(prev => [newToast, ...prev].slice(0, 5));
                alertSubscribers.current.forEach(cb => cb(alert));
              }
            }

            // 3. Visual Node execution events for live canvas glow & wires
            if (evtName === 'node:execution') {
              const execEvent: NodeExecutionEvent = data.data;
              if (execEvent && execEvent.nodeId) {
                setNodeExecutions(prev => ({
                  ...prev,
                  [execEvent.nodeId]: execEvent,
                }));
                nodeSubscribers.current.forEach(cb => cb(execEvent));
              }
            }
          } catch (e) {
            console.error('[WebSocket] Parse error:', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (err) {
        console.error('[WebSocket] Connection failed:', err);
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        latestReadings,
        recentTelemetryStream,
        activeToasts,
        nodeExecutions,
        removeToast,
        subscribeTelemetry,
        subscribeAlerts,
        subscribeNodeExecution,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
