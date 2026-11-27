import { telemetryService } from '../ingestion/telemetryService.js';

export interface DeviceSimState {
  deviceId: string;
  name: string;
  type: string;
  baseTemp: number;
  baseHum: number;
  baseEnergy: number;
  baseAqi: number;
  curTemp: number;
  curHum: number;
  curEnergy: number;
  curAqi: number;
}

export class DeviceSimulator {
  private isRunning = false;
  private isPaused = false;
  private intervalMs = 2500;
  private timer: NodeJS.Timeout | null = null;
  private generatedCount = 0;
  private activeDeviceIds: Set<string> = new Set([
    'TURBINE-001',
    'TEMP-001',
    'HUM-002',
    'ENG-003',
    'AQI-004',
  ]);

  private devices: Map<string, DeviceSimState> = new Map([
    [
      'TURBINE-001',
      {
        deviceId: 'TURBINE-001',
        name: 'Main Wind Turbine Alpha',
        type: 'industrial',
        baseTemp: 68.0,
        baseHum: 45.0,
        baseEnergy: 75.0,
        baseAqi: 28.0,
        curTemp: 68.0,
        curHum: 45.0,
        curEnergy: 75.0,
        curAqi: 28.0,
      },
    ],
    [
      'TEMP-001',
      {
        deviceId: 'TEMP-001',
        name: 'Reactor Core Thermocouple',
        type: 'temperature',
        baseTemp: 42.0,
        baseHum: 30.0,
        baseEnergy: 20.0,
        baseAqi: 15.0,
        curTemp: 42.0,
        curHum: 30.0,
        curEnergy: 20.0,
        curAqi: 15.0,
      },
    ],
    [
      'HUM-002',
      {
        deviceId: 'HUM-002',
        name: 'Cleanroom Humidity Monitor',
        type: 'humidity',
        baseTemp: 22.0,
        baseHum: 48.0,
        baseEnergy: 15.0,
        baseAqi: 10.0,
        curTemp: 22.0,
        curHum: 48.0,
        curEnergy: 15.0,
        curAqi: 10.0,
      },
    ],
    [
      'ENG-003',
      {
        deviceId: 'ENG-003',
        name: 'Facility Main Feeder Meter',
        type: 'energy',
        baseTemp: 35.0,
        baseHum: 40.0,
        baseEnergy: 88.0,
        baseAqi: 25.0,
        curTemp: 35.0,
        curHum: 40.0,
        curEnergy: 88.0,
        curAqi: 25.0,
      },
    ],
    [
      'AQI-004',
      {
        deviceId: 'AQI-004',
        name: 'Exhaust Stack Environmental Sensor',
        type: 'air_quality',
        baseTemp: 28.0,
        baseHum: 55.0,
        baseEnergy: 12.0,
        baseAqi: 45.0,
        curTemp: 28.0,
        curHum: 55.0,
        curEnergy: 12.0,
        curAqi: 45.0,
      },
    ],
  ]);

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.scheduleNextTick();
    console.log(`[Simulator] Started IoT simulator (interval: ${this.intervalMs}ms)`);
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[Simulator] Stopped IoT simulator.');
  }

  pause(): void {
    this.isPaused = true;
    console.log('[Simulator] Paused simulation.');
  }

  resume(): void {
    this.isPaused = false;
    console.log('[Simulator] Resumed simulation.');
  }

  setInterval(ms: number): void {
    this.intervalMs = Math.max(100, ms);
    if (this.isRunning && !this.isPaused) {
      if (this.timer) clearTimeout(this.timer);
      this.scheduleNextTick();
    }
  }

  setActiveDevices(deviceIds: string[]): void {
    this.activeDeviceIds = new Set(deviceIds);
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      if (!this.isPaused) {
        await this.generateTick();
      }
      this.scheduleNextTick();
    }, this.intervalMs);
  }

  private async generateTick(): Promise<void> {
    for (const [deviceId, state] of this.devices.entries()) {
      if (!this.activeDeviceIds.has(deviceId)) continue;

      // Realistic Brownian drift with mean-reversion
      const driftTemp = (Math.random() - 0.5) * 1.5;
      const driftHum = (Math.random() - 0.5) * 2.0;
      const driftEng = (Math.random() - 0.5) * 2.5;
      const driftAqi = (Math.random() - 0.5) * 3.0;

      // Gentle pull back toward baseline
      state.curTemp += driftTemp + (state.baseTemp - state.curTemp) * 0.05;
      state.curHum += driftHum + (state.baseHum - state.curHum) * 0.05;
      state.curEnergy += driftEng + (state.baseEnergy - state.curEnergy) * 0.05;
      state.curAqi += driftAqi + (state.baseAqi - state.curAqi) * 0.05;

      // Bound within physical limits
      state.curTemp = Math.max(0, Math.min(120, state.curTemp));
      state.curHum = Math.max(5, Math.min(100, state.curHum));
      state.curEnergy = Math.max(0, Math.min(250, state.curEnergy));
      state.curAqi = Math.max(5, Math.min(500, state.curAqi));

      try {
        await telemetryService.ingestSingle({
          deviceId: state.deviceId,
          deviceType: state.type,
          temperature: state.curTemp,
          humidity: state.curHum,
          energy: state.curEnergy,
          aqi: state.curAqi,
          timestamp: new Date(),
        });
        this.generatedCount++;
      } catch (err) {
        console.error(`[Simulator] Failed to ingest tick for ${deviceId}:`, err);
      }
    }
  }

  /**
   * Inject abnormal out-of-spec readings to demonstrate rule triggering
   */
  async injectAnomaly(scenario: 'heat_spike' | 'humidity_drop' | 'energy_surge' | 'toxic_aqi', deviceId = 'TURBINE-001'): Promise<any> {
    const state = this.devices.get(deviceId) || this.devices.get('TURBINE-001')!;

    let temp = state.curTemp;
    let hum = state.curHum;
    let eng = state.curEnergy;
    let aqi = state.curAqi;

    switch (scenario) {
      case 'heat_spike':
        temp = 94.5; // > critical threshold
        break;
      case 'humidity_drop':
        hum = 12.0; // < critical threshold
        break;
      case 'energy_surge':
        eng = 185.0; // > spike
        break;
      case 'toxic_aqi':
        aqi = 280.0; // severe hazard
        break;
    }

    const doc = await telemetryService.ingestSingle({
      deviceId: state.deviceId,
      deviceType: state.type,
      temperature: temp,
      humidity: hum,
      energy: eng,
      aqi,
      timestamp: new Date(),
    });

    this.generatedCount++;
    console.log(`[Simulator] ⚠️ Injected Anomaly (${scenario}) on ${deviceId}: T=${temp}°C, H=${hum}%, E=${eng}kWh, AQI=${aqi}`);
    return doc;
  }

  /**
   * Generates a batch of synthetic readings
   */
  async generateBatch(count: number, deviceId = 'TURBINE-001'): Promise<number> {
    const items = [];
    const state = this.devices.get(deviceId) || this.devices.get('TURBINE-001')!;
    const now = Date.now();

    for (let i = count - 1; i >= 0; i--) {
      items.push({
        deviceId: state.deviceId,
        deviceType: state.type,
        temperature: state.baseTemp + (Math.random() - 0.5) * 8,
        humidity: state.baseHum + (Math.random() - 0.5) * 10,
        energy: state.baseEnergy + (Math.random() - 0.5) * 15,
        aqi: state.baseAqi + (Math.random() - 0.5) * 12,
        timestamp: new Date(now - i * 1000),
      });
    }

    const res = await telemetryService.ingestBatch(items);
    this.generatedCount += res.insertedCount;
    return res.insertedCount;
  }

  getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    intervalMs: number;
    interval_seconds: number;
    generatedCount: number;
    activeDeviceIds: string[];
    is_running: boolean;
    active_device_ids: string[];
    generated_count: number;
  } {
    const activeArr = Array.from(this.activeDeviceIds);
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      intervalMs: this.intervalMs,
      interval_seconds: this.intervalMs / 1000,
      generatedCount: this.generatedCount,
      activeDeviceIds: activeArr,
      // Compatibility aliases
      is_running: this.isRunning && !this.isPaused,
      active_device_ids: activeArr,
      generated_count: this.generatedCount,
    };
  }
}

export const simulator = new DeviceSimulator();
