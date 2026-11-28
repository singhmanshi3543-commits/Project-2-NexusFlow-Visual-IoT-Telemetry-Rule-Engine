from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.session import get_db
from app.models.rule import Rule
from app.models.execution_log import RuleExecutionLog
from app.models.device import Device
from app.schemas.rule import RuleCreate, RuleUpdate, RuleOut, RuleExecutionLogOut
from app.api.deps import get_optional_current_user
from app.models.user import User

router = APIRouter(prefix="/rules", tags=["Rules"])

@router.get("", response_model=List[RuleOut])
def list_rules(
    device_id: Optional[str] = None,
    parameter: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Rule)
    if device_id and device_id != "all":
        query = query.filter((Rule.device_id == device_id) | (Rule.device_id == None))
    if parameter and parameter != "all":
        query = query.filter(Rule.parameter == parameter)
    if is_active is not None:
        query = query.filter(Rule.is_active == is_active)
    
    rules = query.order_by(Rule.created_at.desc()).all()
    # Enrich with device names if present
    result = []
    for r in rules:
        dev_name = None
        if r.device_id:
            dev = db.query(Device).filter(Device.id == r.device_id).first()
            if dev:
                dev_name = dev.name
        rule_dict = {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "device_id": r.device_id,
            "device_name": dev_name,
            "parameter": r.parameter,
            "operator": r.operator,
            "threshold": r.threshold,
            "severity": r.severity,
            "action_payload": r.action_payload,
            "is_active": r.is_active,
            "cooldown_seconds": r.cooldown_seconds,
            "last_triggered": r.last_triggered,
            "created_at": r.created_at,
            "user_id": r.user_id,
        }
        result.append(rule_dict)
    return result

@router.post("", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(
    rule_in: RuleCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # Verify device exists if specified
    if rule_in.device_id:
        dev = db.query(Device).filter(Device.id == rule_in.device_id).first()
        if not dev:
            raise HTTPException(status_code=400, detail=f"Device '{rule_in.device_id}' does not exist.")

    rule = Rule(
        name=rule_in.name.strip(),
        description=rule_in.description or "",
        device_id=rule_in.device_id,
        parameter=rule_in.parameter,
        operator=rule_in.operator,
        threshold=rule_in.threshold,
        severity=rule_in.severity,
        action_payload=rule_in.action_payload or "",
        is_active=rule_in.is_active if rule_in.is_active is not None else True,
        cooldown_seconds=rule_in.cooldown_seconds or 60,
        user_id=current_user.id if current_user else None
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.get("/{rule_id}", response_model=RuleOut)
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
    return rule

@router.put("/{rule_id}", response_model=RuleOut)
def update_rule(
    rule_id: int,
    rule_in: RuleUpdate,
    db: Session = Depends(get_db)
):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")

    update_data = rule_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(rule, field, val)

    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")

    db.delete(rule)
    db.commit()
    return None

@router.patch("/{rule_id}/toggle", response_model=RuleOut)
def toggle_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")

    rule.is_active = not rule.is_active
    db.commit()
    db.refresh(rule)
    return rule

@router.get("/logs/history", response_model=List[RuleExecutionLogOut])
def get_execution_logs(
    rule_id: Optional[int] = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(RuleExecutionLog)
    if rule_id:
        query = query.filter(RuleExecutionLog.rule_id == rule_id)
    
    logs = query.order_by(RuleExecutionLog.evaluated_at.desc()).limit(limit).all()
    results = []
    for log in logs:
        rule_name = log.rule.name if log.rule else "Deleted Rule"
        results.append({
            "id": log.id,
            "rule_id": log.rule_id,
            "rule_name": rule_name,
            "device_id": log.device_id,
            "condition_met": log.condition_met,
            "observed_value": log.observed_value,
            "details": log.details,
            "evaluated_at": log.evaluated_at
        })
    return results
