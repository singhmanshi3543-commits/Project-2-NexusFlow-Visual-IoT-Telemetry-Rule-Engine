from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone
from app.database.session import get_db
from app.models.alert import Alert
from app.models.device import Device
from app.models.rule import Rule
from app.schemas.alert import AlertOut

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertOut])
def list_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    device_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if severity and severity != "all":
        query = query.filter(Alert.severity == severity)
    if status and status != "all":
        query = query.filter(Alert.status == status)
    if device_id and device_id != "all":
        query = query.filter(Alert.device_id == device_id)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Alert.message.ilike(search_fmt)) |
            (Alert.device_id.ilike(search_fmt)) |
            (Alert.parameter.ilike(search_fmt))
        )

    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()
    
    result = []
    for a in alerts:
        dev_name = a.device.name if a.device else a.device_id
        rule_name = a.rule.name if a.rule else "Custom Threshold"
        result.append({
            "id": a.id,
            "rule_id": a.rule_id,
            "device_id": a.device_id,
            "device_name": dev_name,
            "rule_name": rule_name,
            "parameter": a.parameter,
            "observed_value": a.observed_value,
            "threshold_value": a.threshold_value,
            "severity": a.severity,
            "status": a.status,
            "message": a.message,
            "acknowledged_at": a.acknowledged_at,
            "resolved_at": a.resolved_at,
            "created_at": a.created_at,
        })
    return result

@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    
    dev_name = alert.device.name if alert.device else alert.device_id
    rule_name = alert.rule.name if alert.rule else "Custom Threshold"
    return {
        "id": alert.id,
        "rule_id": alert.rule_id,
        "device_id": alert.device_id,
        "device_name": dev_name,
        "rule_name": rule_name,
        "parameter": alert.parameter,
        "observed_value": alert.observed_value,
        "threshold_value": alert.threshold_value,
        "severity": alert.severity,
        "status": alert.status,
        "message": alert.message,
        "acknowledged_at": alert.acknowledged_at,
        "resolved_at": alert.resolved_at,
        "created_at": alert.created_at,
    }

@router.patch("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return get_alert(alert_id, db)

@router.patch("/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return get_alert(alert_id, db)

@router.post("/acknowledge-all")
def acknowledge_all_alerts(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    count = db.query(Alert).filter(Alert.status == "active").update(
        {"status": "acknowledged", "acknowledged_at": now}
    )
    db.commit()
    return {"message": f"Successfully acknowledged {count} active alerts."}

@router.post("/resolve-all")
def resolve_all_alerts(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    count = db.query(Alert).filter(Alert.status.in_(["active", "acknowledged"])).update(
        {"status": "resolved", "resolved_at": now}
    )
    db.commit()
    return {"message": f"Successfully resolved {count} alerts."}

@router.get("/summary/stats")
def get_alerts_summary(db: Session = Depends(get_db)):
    critical_count = db.query(Alert).filter(Alert.severity == "critical", Alert.status == "active").count()
    warning_count = db.query(Alert).filter(Alert.severity == "warning", Alert.status == "active").count()
    info_count = db.query(Alert).filter(Alert.severity == "info", Alert.status == "active").count()
    total_active = critical_count + warning_count + info_count
    
    return {
        "active_total": total_active,
        "critical": critical_count,
        "warning": warning_count,
        "info": info_count
    }
