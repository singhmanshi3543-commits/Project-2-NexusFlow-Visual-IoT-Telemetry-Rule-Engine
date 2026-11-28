from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database.session import get_db
from app.models.device import Device
from app.models.telemetry import TelemetryReading
from app.models.alert import Alert
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceOut
from app.api.deps import get_optional_current_user
from app.models.user import User

router = APIRouter(prefix="/devices", tags=["Devices"])

@router.get("", response_model=List[DeviceOut])
def list_devices(
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Device)
    if type and type != "all":
        query = query.filter(Device.type == type)
    if status and status != "all":
        query = query.filter(Device.status == status)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Device.name.ilike(search_fmt)) |
            (Device.id.ilike(search_fmt)) |
            (Device.location.ilike(search_fmt))
        )
    return query.order_by(Device.created_at.desc()).all()

@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
def create_device(
    device_in: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    existing = db.query(Device).filter(Device.id == device_in.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Device with ID '{device_in.id}' already exists."
        )

    device = Device(
        id=device_in.id.upper().strip(),
        name=device_in.name.strip(),
        type=device_in.type,
        location=device_in.location or "Default Zone",
        description=device_in.description or "",
        status="online",
        created_by=current_user.id if current_user else None,
        last_seen=datetime.now(timezone.utc)
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device

@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")
    return device

@router.put("/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: str,
    device_in: DeviceUpdate,
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")

    update_data = device_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(device, field, val)

    db.commit()
    db.refresh(device)
    return device

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")

    db.delete(device)
    db.commit()
    return None

@router.patch("/{device_id}/toggle-status", response_model=DeviceOut)
def toggle_device_status(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")

    device.status = "offline" if device.status == "online" else "online"
    db.commit()
    db.refresh(device)
    return device
