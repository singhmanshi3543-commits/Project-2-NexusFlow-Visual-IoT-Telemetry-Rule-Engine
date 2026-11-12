import asyncio
import random
import math
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.database.session import SessionLocal
from app.models.device import Device
from app.models.telemetry import TelemetryReading
from app.engine.rule_engine import rule_engine
from app.websocket.connection_manager import ws_manager

logger = logging.getLogger(__name__)

class DeviceSimulator:
    """
    Virtual IoT Device Simulator that models physics-inspired sensor readings,
    supports dynamic anomaly injection for instant demonstrations, and integrates
    with the Rule Engine and WebSocket pipelines.
    """

    def __init__(self, interval: float = 3.0):
        self.interval: float = interval
        self.is_running: bool = False
        self._task: Optional[asyncio.Task] = None
        self.tick_count: int = 0
        self.total_generated: int = 0
        
        # State tracking for smooth realistic drift
        self.device_states: Dict[str, Dict[str, float]] = {
            "TEMP-001": {"temp": 24.5, "hum": 48.0, "energy": 32.0, "aqi": 42.0},
            "HUM-002":  {"temp": 22.0, "hum": 55.0, "energy": 28.5, "aqi": 38.0},
            "ENG-003":  {"temp": 31.0, "hum": 42.0, "energy": 64.0, "aqi": 58.0},
            "AQI-004":  {"temp": 23.5, "hum": 51.0, "energy": 35.0, "aqi": 62.0},
            "IND-005":  {"temp": 28.0, "hum": 44.0, "energy": 52.0, "aqi": 75.0},
        }

        # Anomaly queue for deliberate spike demonstrations
        self.anomaly_queue: Dict[str, Dict[str, float]] = {}

    def inject_anomaly(self, scenario: str, device_id: Optional[str] = None):
        """
        Injects a deliberate anomaly scenario into the simulation stream.
        Scenarios: 'heat_spike', 'humidity_drop', 'energy_surge', 'toxic_air'
        """
        target_id = device_id or "TEMP-001"
        if scenario == "heat_spike":
            target_id = device_id or "TEMP-001"
            self.anomaly_queue[target_id] = {"temperature": 45.8, "is_abnormal": True}
        elif scenario == "humidity_drop":
            target_id = device_id or "HUM-002"
            self.anomaly_queue[target_id] = {"humidity": 18.2, "is_abnormal": True}
        elif scenario == "energy_surge":
            target_id = device_id or "ENG-003"
            self.anomaly_queue[target_id] = {"energy_consumption": 96.4, "is_abnormal": True}
        elif scenario == "toxic_air":
            target_id = device_id or "AQI-004"
            self.anomaly_queue[target_id] = {"air_quality": 218.0, "is_abnormal": True}
        elif scenario == "multi_critical":
            target_id = device_id or "IND-005"
            self.anomaly_queue[target_id] = {
                "temperature": 48.2,
                "energy_consumption": 89.0,
                "air_quality": 185.0,
                "is_abnormal": True
            }
        logger.info(f"Anomaly injected: {scenario} on device {target_id}")

    def generate_reading_for_device(self, device_id: str, device_type: str) -> Dict[str, Any]:
        """
        Simulates realistic sensor readings using gentle Brownian drift and trigonometric baseline.
        """
        state = self.device_states.get(device_id, {"temp": 25.0, "hum": 50.0, "energy": 40.0, "aqi": 50.0})
        t = self.tick_count * 0.1

        # Smooth drift
        d_temp = 0.3 * math.sin(t) + random.uniform(-0.25, 0.25)
        d_hum = 0.5 * math.cos(t * 0.8) + random.uniform(-0.4, 0.4)
        d_energy = 0.4 * math.sin(t * 1.2) + random.uniform(-0.3, 0.3)
        d_aqi = 0.6 * math.cos(t * 0.5) + random.uniform(-0.5, 0.5)

        # Baseline per device type
        if "temp" in device_type.lower():
            temp = max(18.0, min(36.0, state["temp"] + d_temp))
            hum = max(40.0, min(65.0, state["hum"] + d_hum))
            energy = max(20.0, min(50.0, state["energy"] + d_energy))
            aqi = max(30.0, min(70.0, state["aqi"] + d_aqi))
        elif "hum" in device_type.lower():
            temp = max(19.0, min(30.0, state["temp"] + d_temp))
            hum = max(35.0, min(75.0, state["hum"] + d_hum))
            energy = max(15.0, min(45.0, state["energy"] + d_energy))
            aqi = max(25.0, min(60.0, state["aqi"] + d_aqi))
        elif "eng" in device_type.lower():
            temp = max(25.0, min(38.0, state["temp"] + d_temp))
            hum = max(35.0, min(55.0, state["hum"] + d_hum))
            energy = max(45.0, min(78.0, state["energy"] + d_energy)) # normal high energy
            aqi = max(40.0, min(80.0, state["aqi"] + d_aqi))
        elif "air" in device_type.lower():
            temp = max(20.0, min(32.0, state["temp"] + d_temp))
            hum = max(40.0, min(65.0, state["hum"] + d_hum))
            energy = max(25.0, min(45.0, state["energy"] + d_energy))
            aqi = max(45.0, min(110.0, state["aqi"] + d_aqi))
        else: # industrial / multisensor
            temp = max(24.0, min(37.0, state["temp"] + d_temp))
            hum = max(30.0, min(60.0, state["hum"] + d_hum))
            energy = max(40.0, min(75.0, state["energy"] + d_energy))
            aqi = max(50.0, min(120.0, state["aqi"] + d_aqi))

        # Check if an injected anomaly exists for this device
        is_abnormal = False
        if device_id in self.anomaly_queue:
            anomaly = self.anomaly_queue.pop(device_id)
            if "temperature" in anomaly:
                temp = anomaly["temperature"]
            if "humidity" in anomaly:
                hum = anomaly["humidity"]
            if "energy_consumption" in anomaly:
                energy = anomaly["energy_consumption"]
            if "air_quality" in anomaly:
                aqi = anomaly["air_quality"]
            is_abnormal = anomaly.get("is_abnormal", True)

        # Update cached state
        state["temp"] = temp
        state["hum"] = hum
        state["energy"] = energy
        state["aqi"] = aqi
        self.device_states[device_id] = state

        return {
            "device_id": device_id,
            "temperature": round(temp, 2),
            "humidity": round(hum, 2),
            "energy_consumption": round(energy, 2),
            "air_quality": round(aqi, 2),
            "is_abnormal": is_abnormal,
            "timestamp": datetime.now(timezone.utc)
        }

    async def _simulation_loop(self):
        logger.info("Simulator loop started.")
        while self.is_running:
            try:
                db = SessionLocal()
                try:
                    # Query active devices
                    devices = db.query(Device).filter(Device.status != "offline").all()
                    if not devices:
                        # Fallback query all
                        devices = db.query(Device).all()

                    for device in devices:
                        reading_data = self.generate_reading_for_device(device.id, device.type)
                        
                        # Save to database
                        db_reading = TelemetryReading(
                            device_id=reading_data["device_id"],
                            temperature=reading_data["temperature"],
                            humidity=reading_data["humidity"],
                            energy_consumption=reading_data["energy_consumption"],
                            air_quality=reading_data["air_quality"],
                            is_abnormal=reading_data["is_abnormal"],
                            timestamp=reading_data["timestamp"]
                        )
                        db.add(db_reading)
                        
                        # Update device last_seen and online status
                        device.last_seen = reading_data["timestamp"]
                        device.status = "online"
                        db.commit()
                        db.refresh(db_reading)

                        # Evaluate through Rule Engine
                        await rule_engine.process_telemetry(db, reading_data)

                        # Broadcast live telemetry over WebSocket
                        await ws_manager.broadcast_telemetry({
                            "event": "new_telemetry",
                            "telemetry": {
                                "id": db_reading.id,
                                "device_id": db_reading.device_id,
                                "device_name": device.name,
                                "temperature": db_reading.temperature,
                                "humidity": db_reading.humidity,
                                "energy_consumption": db_reading.energy_consumption,
                                "air_quality": db_reading.air_quality,
                                "is_abnormal": db_reading.is_abnormal,
                                "timestamp": db_reading.timestamp.isoformat()
                            }
                        })

                        self.total_generated += 1

                    self.tick_count += 1
                finally:
                    db.close()

            except Exception as e:
                logger.error(f"Error in simulator loop iteration: {str(e)}", exc_info=True)

            await asyncio.sleep(self.interval)

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._simulation_loop())
            logger.info("Simulator service started successfully.")

    def stop(self):
        if self.is_running:
            self.is_running = False
            if self._task:
                self._task.cancel()
                self._task = None
            logger.info("Simulator service stopped.")

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "interval_seconds": self.interval,
            "total_generated": self.total_generated,
            "active_devices": list(self.device_states.keys())
        }

simulator = DeviceSimulator(interval=3.0)