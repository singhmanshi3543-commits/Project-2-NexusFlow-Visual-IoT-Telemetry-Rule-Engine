from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
from app.websocket.connection_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSockets"])

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect_telemetry(websocket)
    try:
        while True:
            # Keep-alive ping from client or wait for incoming messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect_telemetry(websocket)
    except Exception as e:
        logger.debug(f"WS Telemetry connection error: {e}")
        ws_manager.disconnect_telemetry(websocket)

@router.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    await ws_manager.connect_alerts(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect_alerts(websocket)
    except Exception as e:
        logger.debug(f"WS Alerts connection error: {e}")
        ws_manager.disconnect_alerts(websocket)
