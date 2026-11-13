import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.database.session import engine, Base, SessionLocal
from app.models.user import User
from app.models.device import Device
from app.models.rule import Rule
from app.models.telemetry import TelemetryReading
from app.models.alert import Alert
from app.models.execution_log import RuleExecutionLog
from app.core.security import get_password_hash

def init_db(target_engine=None, custom_session=None):
    use_engine = target_engine or engine
    Base.metadata.create_all(bind=use_engine)
    db = custom_session() if custom_session else SessionLocal()

    try:
        # 1. Seed Demo User
        demo_user = db.query(User).filter(User.email == "demo@nexusflow.io").first()
        if not demo_user:
            demo_user = User(
                email="demo@nexusflow.io",
                full_name="Alex Rivera (Lead IoT Engineer)",
                hashed_password=get_password_hash("Demo@12345"),
                role="admin",
                is_active=True
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

        # 2. Seed Devices
        devices_to_seed = [
            {
                "id": "TEMP-001",
                "name": "Cleanroom Temperature Sensor",
                "type": "temperature",
                "location": "Cleanroom Lab 1",
                "description": "High-precision PT100 RTD sensor with ±0.1°C calibration",
                "status": "online"
            },
            {
                "id": "HUM-002",
                "name": "Warehouse Humidity Monitor",
                "type": "humidity",
                "location": "Storage Zone C",
                "description": "Capacitive hygrometer for pharmaceutical storage humidity tracking",
                "status": "online"
            },
            {
                "id": "ENG-003",
                "name": "Smart Substation Energy Meter",
                "type": "energy",
                "location": "Power Grid Substation 4",
                "description": "Three-phase Modbus energy meter tracking real-time kWh draw",
                "status": "online"
            },
            {
                "id": "AQI-004",
                "name": "Factory Air Quality Sentinel",
                "type": "air_quality",
                "location": "Assembly Line 2",
                "description": "Laser optical particulate counter (PM2.5 / PM10) & VOC sensor",
                "status": "online"
            },
            {
                "id": "IND-005",
                "name": "Turbine Industrial Multi-Sensor",
                "type": "industrial",
                "location": "Main Plant Floor",
                "description": "Ruggedized multi-telemetry unit monitoring heavy generator vibrations and load",
                "status": "online"
            }
        ]

        now = datetime.now(timezone.utc)
        for dev_data in devices_to_seed:
            existing_dev = db.query(Device).filter(Device.id == dev_data["id"]).first()
            if not existing_dev:
                dev = Device(
                    id=dev_data["id"],
                    name=dev_data["name"],
                    type=dev_data["type"],
                    location=dev_data["location"],
                    description=dev_data["description"],
                    status=dev_data["status"],
                    created_by=demo_user.id,
                    last_seen=now
                )
                db.add(dev)
        db.commit()

        # 3. Seed Default Automation Rules
        rules_to_seed = [
            {
                "name": "Thermal Safety Threshold (> 40°C)",
                "description": "IF temperature > 40°C THEN generate a CRITICAL alert",
                "device_id": None, # Global
                "parameter": "temperature",
                "operator": ">",
                "threshold": 40.0,
                "severity": "critical",
                "cooldown_seconds": 60,
                "action_payload": "emergency_cooling_actuator_on"
            },
            {
                "name": "Low Humidity Desiccation Warning (< 30%)",
                "description": "IF humidity < 30% THEN generate a WARNING alert",
                "device_id": "HUM-002",
                "parameter": "humidity",
                "operator": "<",
                "threshold": 30.0,
                "severity": "warning",
                "cooldown_seconds": 60,
                "action_payload": "humidifier_activate"
            },
            {
                "name": "Peak Power Surge Watch (> 80 kWh)",
                "description": "IF energy consumption > 80 kWh THEN generate an ENERGY CONSUMPTION alert",
                "device_id": "ENG-003",
                "parameter": "energy_consumption",
                "operator": ">",
                "threshold": 80.0,
                "severity": "warning",
                "cooldown_seconds": 60,
                "action_payload": "load_shedding_routine"
            },
            {
                "name": "Hazardous Air Quality Alarm (> 150 AQI)",
                "description": "IF air quality index > 150 THEN generate a POOR AIR QUALITY alert",
                "device_id": None, # Global
                "parameter": "air_quality",
                "operator": ">",
                "threshold": 150.0,
                "severity": "critical",
                "cooldown_seconds": 60,
                "action_payload": "hvac_air_scrubber_max"
            }
        ]

        for r_data in rules_to_seed:
            existing_rule = db.query(Rule).filter(Rule.name == r_data["name"]).first()
            if not existing_rule:
                r = Rule(
                    name=r_data["name"],
                    description=r_data["description"],
                    device_id=r_data["device_id"],
                    parameter=r_data["parameter"],
                    operator=r_data["operator"],
                    threshold=r_data["threshold"],
                    severity=r_data["severity"],
                    action_payload=r_data["action_payload"],
                    cooldown_seconds=r_data["cooldown_seconds"],
                    is_active=True,
                    user_id=demo_user.id
                )
                db.add(r)
        db.commit()

        # 4. Pre-seed Historical Telemetry if table is empty
        telemetry_count = db.query(TelemetryReading).count()
        if telemetry_count < 30:
            print("Pre-seeding rich historical telemetry records...")
            # Generate 40 historical readings per device over past 2 hours
            for dev_data in devices_to_seed:
                dev_id = dev_data["id"]
                base_t = 24.0 if dev_id == "TEMP-001" else 28.0
                base_h = 48.0 if dev_id == "HUM-002" else 52.0
                base_e = 65.0 if dev_id == "ENG-003" else 35.0
                base_a = 55.0 if dev_id == "AQI-004" else 45.0

                for step in range(40, 0, -1):
                    reading_time = now - timedelta(minutes=step * 3)
                    t_val = round(base_t + random.uniform(-1.8, 2.2), 2)
                    h_val = round(base_h + random.uniform(-3.5, 3.5), 2)
                    e_val = round(base_e + random.uniform(-4.0, 5.0), 2)
                    a_val = round(base_a + random.uniform(-5.0, 6.0), 2)

                    reading = TelemetryReading(
                        device_id=dev_id,
                        temperature=t_val,
                        humidity=h_val,
                        energy_consumption=e_val,
                        air_quality=a_val,
                        is_abnormal=False,
                        timestamp=reading_time
                    )
                    db.add(reading)
            db.commit()

        # 5. Pre-seed a couple of initial sample alerts
        alerts_count = db.query(Alert).count()
        if alerts_count == 0:
            sample_alert = Alert(
                rule_id=1,
                device_id="TEMP-001",
                parameter="temperature",
                observed_value=41.5,
                threshold_value=40.0,
                severity="critical",
                status="acknowledged",
                message="Rule 'Thermal Safety Threshold (> 40°C)' triggered on Cleanroom Temperature Sensor: Temperature is 41.5 (threshold: > 40.0)",
                acknowledged_at=now - timedelta(minutes=25),
                created_at=now - timedelta(minutes=30)
            )
            db.add(sample_alert)
            db.commit()

    finally:
        db.close()
