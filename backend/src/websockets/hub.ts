import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface WebSocketEvent<T = any> {
  event: string;
  data?: T;
  telemetry?: T;
  alert?: T;
  timestamp: string;
}

class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  init(server: Server): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.clients.add(ws);
      const url = req.url || '/';

      // Send initial connection ack
      ws.send(JSON.stringify({
        event: 'connected',
        url,
        message: 'Connected to NexusFlow Real-time Stream Hub',
        timestamp: new Date().toISOString(),
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Client error:', err.message);
        this.clients.delete(ws);
      });
    });

    console.log('[WebSocket] Real-time Hub initialized on HTTP server.');
  }

  broadcast(eventName: string, payload: any): void {
    if (!this.wss || this.clients.size === 0) return;

    // Build payload compatible with both legacy and new frontend expectations
    const message = JSON.stringify({
      event: eventName,
      data: payload,
      // Compatibility aliases
      telemetry: eventName === 'telemetry:update' || eventName === 'new_telemetry' ? payload : undefined,
      alert: eventName === 'alert:created' || eventName === 'new_alert' ? payload : undefined,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (err) {
          console.error('[WebSocket] Send failed:', err);
        }
      }
    }
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}

export const wsHub = new WebSocketHub();
