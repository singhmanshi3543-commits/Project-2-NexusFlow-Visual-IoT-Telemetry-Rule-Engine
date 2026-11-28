from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from app.database.session import get_db
from app.models.device import Device
from app.models.telemetry import TelemetryReading
from app.schemas.telemetry import TelemetryCreate, TelemetryOut, TelemetryStats
from app.engine.rule_engine import rule_engine
from app.websocket.connection_manager import ws_manager

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.post("", response_model=TelemetryOut, status_code=status.HTTP_201_CREATED)
async def ingest_telemetry(reading_in: TelemetryCreate, db: Session = Depends(get_db)):
    """
    Ingests an external or simulated telemetry packet, stores it,
    evaluates it against active rules, and broadcasts via WebSocket.
    """
    device = db.query(Device).filter(Device.id == reading_in.device_id).first()
    if not device:
        # Auto-register device if unknown for seamless external hardware/sim ingestion
        device = Device(
            id=reading_in.device_id,
            name=f"Device {reading_in.device_id}",
            type="multisensor",
            status="online",
            last_seen=datetime.now(timezone.utc)
        )
        db.add(device)
        db.commit()
        db.refresh(device)
    else:
        device.last_seen = datetime.now(timezone.utc)
        device.status = "online"

    now = reading_in.timestamp or datetime.now(timezone.utc)
    reading = TelemetryReading(
        device_id=reading_in.device_id,
        temperature=reading_in.temperature,
        humidity=reading_in.humidity,
        energy_consumption=reading_in.energy_consumption,
        air_quality=reading_in.air_quality,
        is_abnormal=reading_in.is_abnormal or False,
        timestamp=now
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # Convert to dict for Rule Engine evaluation
    reading_dict = {
        "device_id": reading.device_id,
        "temperature": reading.temperature,
        "humidity": reading.humidity,
        "energy_consumption": reading.energy_consumption,
        "air_quality": reading.air_quality,
        "is_abnormal": reading.is_abnormal,
        "timestamp": now
    }

    # Evaluate rules
    await rule_engine.process_telemetry(db, reading_dict)

    # Broadcast via WebSocket
    await ws_manager.broadcast_telemetry({
        "event": "new_telemetry",
        "telemetry": {
            "id": reading.id,
            "device_id": reading.device_id,
            "device_name": device.name,
            "temperature": reading.temperature,
            "humidity": reading.humidity,
            "energy_consumption": reading.energy_consumption,
            "air_quality": reading.air_quality,
            "is_abnormal": reading.is_abnormal,
            "timestamp": reading.timestamp.isoformat()
        }
    })

    return reading

@router.get("", response_model=List[TelemetryOut])
def get_telemetry_history(
    device_id: Optional[str] = None,
    time_range: Optional[str] = "1h", # 15m, 1h, 6h, 24h, 7d, all
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(TelemetryReading)
    if device_id and device_id != "all":
        query = query.filter(TelemetryReading.device_id == device_id)

    now = datetime.now(timezone.utc)
    if time_range == "15m":
        cutoff = now - timedelta(minutes=15)
        query = query.filter(TelemetryReading.timestamp >= cutoff)
    elif time_range == "1h":
        cutoff = now - timedelta(hours=1)
        query = query.filter(TelemetryReading.timestamp >= cutoff)
    elif time_range == "6h":
        cutoff = now - timedelta(hours=6)
        query = query.filter(TelemetryReading.timestamp >= cutoff)
    elif time_range == "24h":
        cutoff = now - timedelta(hours=24)
        query = query.filter(TelemetryReading.timestamp >= cutoff)
    elif time_range == "7d":
        cutoff = now - timedelta(days=7)
        query = query.filter(TelemetryReading.timestamp >= cutoff)

    readings = query.order_by(TelemetryReading.timestamp.desc()).limit(limit).all()
    # Reverse to chronological order for charts
    return readings[::-1]

@router.get("/{device_id}/latest", response_model=Optional[TelemetryOut])
def get_latest_device_telemetry(device_id: str, db: Session = Depends(get_db)):
    reading = db.query(TelemetryReading).filter(
        TelemetryReading.device_id == device_id
    ).order_by(TelemetryReading.timestamp.desc()).first()
    return reading

@router.get("/stats/summary")
def get_telemetry_stats(
    device_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Calculates min, max, avg and current values for all 4 parameters."""
    query = db.query(TelemetryReading)
    if device_id and device_id != "all":
        query = query.filter(TelemetryReading.device_id == device_id)

    total_count = query.count()
    if total_count == 0:
        return {
            "temperature": {"current": 0, "min": 0, "max": 0, "avg": 0, "count": 0},
            "humidity": {"current": 0, "min": 0, "max": 0, "avg": 0, "count": 0},
            "energy_consumption": {"current": 0, "min": 0, "max": 0, "avg": 0, "count": 0},
            "air_quality": {"current": 0, "min": 0, "max": 0, "avg": 0, "count": 0},
        }

    latest = query.order_by(TelemetryReading.timestamp.desc()).first()

    stats_agg = db.query(
        func.min(TelemetryReading.temperature).label("min_temp"),
        func.max(TelemetryReading.temperature).label("max_temp"),
        func.avg(TelemetryReading.temperature).label("avg_temp"),
        func.min(TelemetryReading.humidity).label("min_hum"),
        func.max(TelemetryReading.humidity).label("max_hum"),
        func.avg(TelemetryReading.humidity).label("avg_hum"),
        func.min(TelemetryReading.energy_consumption).label("min_energy"),
        func.max(TelemetryReading.energy_consumption).label("max_energy"),
        func.avg(TelemetryReading.energy_consumption).label("avg_energy"),
        func.min(TelemetryReading.air_quality).label("min_aqi"),
        func.max(TelemetryReading.air_quality).label("max_aqi"),
        func.avg(TelemetryReading.air_quality).label("avg_aqi"),
    )
    if device_id and device_id != "all":
        stats_agg = stats_agg.filter(TelemetryReading.device_id == device_id)
    
    res = stats_agg.first()

    return {
        "temperature": {
            "current": round(latest.temperature, 2) if latest else 0,
            "min": round(res.min_temp, 2) if res.min_temp is not None else 0,
            "max": round(res.max_temp, 2) if res.max_temp is not None else 0,
            "avg": round(res.avg_temp, 2) if res.avg_temp is not None else 0,
            "count": total_count,
        },
        "humidity": {
            "current": round(latest.humidity, 2) if latest else 0,
            "min": round(res.min_hum, 2) if res.min_hum is not None else 0,
            "max": round(res.max_hum, 2) if res.max_hum is not None else 0,
            "avg": round(res.avg_hum, 2) if res.avg_hum is not None else 0,
            "count": total_count,
        },
        "energy_consumption": {
            "current": round(latest.energy_consumption, 2) if latest else 0,
            "min": round(res.min_energy, 2) if res.min_energy is not None else 0,
            "max": round(res.max_energy, 2) if res.max_energy is not None else 0,
            "avg": round(res.avg_energy, 2) if res.avg_energy is not None else 0,
            "count": total_count,
        },
        "air_quality": {
            "current": round(latest.air_quality, 2) if latest else 0,
            "min": round(res.min_aqi, 2) if res.min_aqi is not None else 0,
            "max": round(res.max_aqi, 2) if res.max_aqi is not None else 0,
            "avg": round(res.avg_aqi, 2) if res.avg_aqi is not None else 0,
            "count": total_count,
        },
    }
