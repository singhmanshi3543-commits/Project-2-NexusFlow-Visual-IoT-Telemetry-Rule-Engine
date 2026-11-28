from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.simulator.device_simulator import simulator

router = APIRouter(prefix="/simulator", tags=["Simulator"])

class IntervalUpdate(BaseModel):
    interval_seconds: float = Field(..., ge=0.5, le=60.0)

class AnomalyRequest(BaseModel):
    scenario: str = Field(..., description="heat_spike, humidity_drop, energy_surge, toxic_air, multi_critical")
    device_id: Optional[str] = None

@router.get("/status")
def get_simulator_status():
    return simulator.get_status()

@router.post("/start")
def start_simulator():
    simulator.start()
    return {"message": "IoT Simulator started successfully.", "status": simulator.get_status()}

@router.post("/stop")
def stop_simulator():
    simulator.stop()
    return {"message": "IoT Simulator stopped successfully.", "status": simulator.get_status()}

@router.post("/interval")
def set_simulator_interval(payload: IntervalUpdate):
    simulator.interval = payload.interval_seconds
    return {"message": f"Simulation interval updated to {payload.interval_seconds}s.", "status": simulator.get_status()}

@router.post("/inject-anomaly")
def inject_anomaly(payload: AnomalyRequest):
    simulator.inject_anomaly(payload.scenario, payload.device_id)
    return {
        "message": f"Anomaly scenario '{payload.scenario}' scheduled for execution on next tick.",
        "status": simulator.get_status()
    }
