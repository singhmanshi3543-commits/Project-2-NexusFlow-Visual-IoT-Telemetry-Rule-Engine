import { wsHub } from '../websockets/hub.js';

export interface PipelinePacket {
  packetId: string;
  graphId: string;
  timestamp: Date;
  deviceId: string;
  deviceType?: string;
  location?: string;
  rawTelemetry: Record<string, any>;
  currentValue: number;
  evaluatedValues: Record<string, any>; // nodeId -> computed value
  matchedConditions: Record<string, boolean>; // nodeId -> boolean
}

export interface NodeExecutionEvent {
  graphId: string;
  nodeId: string;
  nodeType: string;
  deviceId: string;
  status: 'active' | 'success' | 'filtered' | 'alert' | 'error';
  inputValue?: any;
  outputValue?: any;
  executionTimeMs: number;
  timestamp: string;
}

export class ExecutionContext {
  private graphId: string;
  private nodeWindows: Map<string, number[]> = new Map();
  private lastAlertTimestamps: Map<string, number> = new Map();

  constructor(graphId: string) {
    this.graphId = graphId;
  }

  getGraphId(): string {
    return this.graphId;
  }

  // Rolling window buffer per node (for movingAverage, min, max)
  updateWindow(nodeId: string, val: number, maxSize: number): number[] {
    if (!this.nodeWindows.has(nodeId)) {
      this.nodeWindows.set(nodeId, []);
    }
    const win = this.nodeWindows.get(nodeId)!;
    win.push(val);
    if (win.length > maxSize) {
      win.shift();
    }
    return win;
  }

  getWindow(nodeId: string): number[] {
    return this.nodeWindows.get(nodeId) || [];
  }

  // Cooldown / deduplication logic
  shouldTriggerAlert(nodeId: string, cooldownSeconds: number): boolean {
    const now = Date.now();
    const last = this.lastAlertTimestamps.get(nodeId) || 0;
    if (now - last >= cooldownSeconds * 1000) {
      this.lastAlertTimestamps.set(nodeId, now);
      return true;
    }
    return false;
  }

  // Broadcast real-time execution feedback to connected clients
  emitNodeExecution(event: NodeExecutionEvent): void {
    wsHub.broadcast('node:execution', event);
  }

  reset(): void {
    this.nodeWindows.clear();
    this.lastAlertTimestamps.clear();
  }
}
