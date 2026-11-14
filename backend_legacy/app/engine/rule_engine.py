import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.rule import Rule
from app.models.alert import Alert
from app.models.execution_log import RuleExecutionLog
from app.models.device import Device
from app.websocket.connection_manager import ws_manager

logger = logging.getLogger(__name__)

class RuleEngine:
    """
    Evaluates real-time telemetry readings against active automation rules,
    enforces cooldown deduplication, logs execution traces, and triggers alerts.
    """

    OPERATORS = {
        '>': lambda a, b: a > b,
        '<': lambda a, b: a < b,
        '==': lambda a, b: abs(a - b) < 1e-6,
        '>=': lambda a, b: a >= b,
        '<=': lambda a, b: a <= b,
        '!=': lambda a, b: abs(a - b) >= 1e-6,
    }

    @classmethod
    def evaluate_condition(cls, observed_value: float, operator: str, threshold: float) -> bool:
        func = cls.OPERATORS.get(operator)
        if not func:
            logger.warning(f"Unsupported operator: {operator}")
            return False
        return func(observed_value, threshold)

    @classmethod
    async def process_telemetry(cls, db: Session, telemetry_data: dict) -> List[Alert]:
        """
        Main entry point for incoming telemetry evaluation.
        telemetry_data contains: device_id, temperature, humidity, energy_consumption, air_quality, etc.
        """
        device_id = telemetry_data.get("device_id")
        if not device_id:
            return []

        # Find all active rules matching this device or global (device_id is None)
        active_rules = db.query(Rule).filter(
            Rule.is_active == True,
            (Rule.device_id == device_id) | (Rule.device_id == None)
        ).all()

        device = db.query(Device).filter(Device.id == device_id).first()
        device_name = device.name if device else device_id

        triggered_alerts: List[Alert] = []
        now = datetime.now(timezone.utc)

        for rule in active_rules:
            try:
                param = rule.parameter
                if param not in telemetry_data or telemetry_data[param] is None:
                    continue

                observed_val = float(telemetry_data[param])
                condition_met = cls.evaluate_condition(observed_val, rule.operator, rule.threshold)

                # Log evaluation
                detail_msg = f"Param: {param}, Value: {observed_val}, Op: {rule.operator}, Threshold: {rule.threshold}, Met: {condition_met}"
                log_entry = RuleExecutionLog(
                    rule_id=rule.id,
                    device_id=device_id,
                    condition_met=condition_met,
                    observed_value=observed_val,
                    details=detail_msg,
                    evaluated_at=now
                )
                db.add(log_entry)

                if condition_met:
                    # Check Cooldown logic
                    # Check last active alert for this rule & device to avoid duplicate spamming
                    recent_alert = db.query(Alert).filter(
                        Alert.rule_id == rule.id,
                        Alert.device_id == device_id,
                        Alert.status == "active"
                    ).order_by(Alert.created_at.desc()).first()

                    in_cooldown = False
                    if recent_alert and recent_alert.created_at:
                        # Make timezone-aware comparison
                        alert_time = recent_alert.created_at
                        if alert_time.tzinfo is None:
                            alert_time = alert_time.replace(tzinfo=timezone.utc)
                        elapsed = (now - alert_time).total_seconds()
                        if elapsed < rule.cooldown_seconds:
                            in_cooldown = True

                    if not in_cooldown:
                        # Create Alert
                        alert_message = (
                            f"Rule '{rule.name}' triggered on {device_name}: "
                            f"{param.replace('_', ' ').capitalize()} is {observed_val:.1f} "
                            f"(threshold: {rule.operator} {rule.threshold:.1f})"
                        )
                        new_alert = Alert(
                            rule_id=rule.id,
                            device_id=device_id,
                            parameter=param,
                            observed_value=observed_val,
                            threshold_value=rule.threshold,
                            severity=rule.severity,
                            status="active",
                            message=alert_message,
                            created_at=now
                        )
                        db.add(new_alert)
                        rule.last_triggered = now
                        triggered_alerts.append(new_alert)
            except Exception as e:
                logger.error(f"Error evaluating rule {rule.id} against device {device_id}: {str(e)}", exc_info=True)

        if triggered_alerts:
            db.commit()
            for alert in triggered_alerts:
                db.refresh(alert)
                # Broadcast alert to all active WebSocket listeners
                await ws_manager.broadcast_alert({
                    "event": "new_alert",
                    "alert": {
                        "id": alert.id,
                        "rule_id": alert.rule_id,
                        "rule_name": alert.rule.name if alert.rule else "Custom Rule",
                        "device_id": alert.device_id,
                        "device_name": device_name,
                        "parameter": alert.parameter,
                        "observed_value": alert.observed_value,
                        "threshold_value": alert.threshold_value,
                        "severity": alert.severity,
                        "status": alert.status,
                        "message": alert.message,
                        "created_at": alert.created_at.isoformat() if alert.created_at else now.isoformat()
                    }
                })
        else:
            db.commit()

        return triggered_alerts

rule_engine = RuleEngine()
