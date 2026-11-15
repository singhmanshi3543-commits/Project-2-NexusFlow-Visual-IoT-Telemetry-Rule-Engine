import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.telemetry_connections: List[WebSocket] = []
        self.alert_connections: List[WebSocket] = []

    async def connect_telemetry(self, websocket: WebSocket):
        await websocket.accept()
        self.telemetry_connections.append(websocket)
        logger.info(f"Telemetry WS client connected. Total: {len(self.telemetry_connections)}")

    def disconnect_telemetry(self, websocket: WebSocket):
        if websocket in self.telemetry_connections:
            self.telemetry_connections.remove(websocket)
            logger.info(f"Telemetry WS client disconnected. Total: {len(self.telemetry_connections)}")

    async def connect_alerts(self, websocket: WebSocket):
        await websocket.accept()
        self.alert_connections.append(websocket)
        logger.info(f"Alerts WS client connected. Total: {len(self.alert_connections)}")

    def disconnect_alerts(self, websocket: WebSocket):
        if websocket in self.alert_connections:
            self.alert_connections.remove(websocket)
            logger.info(f"Alerts WS client disconnected. Total: {len(self.alert_connections)}")

    async def broadcast_telemetry(self, message: dict):
        dead_connections = []
        payload = json.dumps(message, default=str)
        for connection in self.telemetry_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect_telemetry(dead)

    async def broadcast_alert(self, message: dict):
        dead_connections = []
        payload = json.dumps(message, default=str)
        for connection in self.alert_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect_alerts(dead)

ws_manager = ConnectionManager()
