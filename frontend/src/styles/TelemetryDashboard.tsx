import React, { useMemo, useState } from 'react';
import {
  Activity,
  Cpu,
  RefreshCw,
  Radio,
  AlertTriangle,
  WifiOff,
  Clock,
  MapPin,
} from 'lucide-react';
import { Device, TelemetryReading } from '../types';
import { useTelemetry } from '../hooks/useTelemetry';
import { ConnectionStatus } from '../components/common/ConnectionStatus';
import { SensorMetricCard } from './SensorMetricCard';
import { SensorStatus } from './SensorStatus';
import '../styles/TelemetryDashboard.css';

interface CombinedDeviceView {
  deviceId: string;
  name: string;
  type: string;
  location: string;
  status: string;
  lastSeen: string | null;
  reading: TelemetryReading | null;
}

function formatShortTime(ts?: string | null): string {
  if (!ts) return 'No data';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return 'No data';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatMetricCell(val: number | undefined | null, unit: string): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '--';
  return `${val.toFixed(1)} ${unit}`.trim();
}

function computeRange(
  stream: TelemetryReading[],
  extractor: (r: TelemetryReading) => number | undefined
): { minLabel?: string; maxLabel?: string } {
  const vals = stream
    .map(extractor)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return {};
  return {
    minLabel: `Min ${Math.min(...vals).toFixed(1)}`,
    maxLabel: `Max ${Math.max(...vals).toFixed(1)}`,
  };
}

export const TelemetryDashboard: React.FC = () => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');

  const {
    readingsByDevice,
    readingsList,
    stream,
    devices,
    isLoading,
    isRefreshing,
    hasData,
    error,
    isConnected,
    connectionStatus,
    lastUpdated,
    reconnect,
    refresh,
  } = useTelemetry();

  // Merge API device inventory with any devices discovered from live WebSocket packets
  const deviceEntries: CombinedDeviceView[] = useMemo(() => {
    const map = new Map<string, CombinedDeviceView>();

    for (const dev of devices) {
      const id = dev.deviceId || dev.id;
      if (!id) continue;
      const reading = readingsByDevice[id] || null;
      map.set(id, {
        deviceId: id,
        name: dev.name || id,
        type: dev.type || 'industrial',
        location: dev.location || 'Facility Floor',
        status: reading
          ? reading.is_abnormal
            ? 'abnormal'
            : 'online'
          : dev.status || 'unknown',
        lastSeen: reading?.timestamp || dev.last_seen || null,
        reading,
      });
    }

    for (const [id, reading] of Object.entries(readingsByDevice)) {
      if (!map.has(id)) {
        map.set(id, {
          deviceId: id,
          name: reading.device_name || id,
          type: 'multisensor',
          location: 'Live Telemetry Stream',
          status: reading.is_abnormal ? 'abnormal' : 'online',
          lastSeen: reading.timestamp || null,
          reading,
        });
      }
    }

    return Array.from(map.values());
  }, [devices, readingsByDevice]);

  // Resolve the reading currently highlighted in the top SensorMetricCard grid
  const activeReading: TelemetryReading | null = useMemo(() => {
    if (selectedDeviceId !== 'all') {
      return readingsByDevice[selectedDeviceId] ?? null;
    }
    if (stream.length > 0) {
      return stream[stream.length - 1];
    }
    return readingsList[0] ?? null;
  }, [selectedDeviceId, readingsByDevice, stream, readingsList]);

  const activeDeviceInfo: Device | undefined = useMemo(() => {
    const targetId =
      selectedDeviceId !== 'all'
        ? selectedDeviceId
        : activeReading?.deviceId || activeReading?.device_id;
    if (!targetId) return undefined;
    return devices.find((d) => (d.deviceId || d.id) === targetId);
  }, [selectedDeviceId, activeReading, devices]);

  const filteredStream = useMemo(() => {
    if (selectedDeviceId === 'all') return stream;
    return stream.filter(
      (r) => (r.deviceId || r.device_id) === selectedDeviceId
    );
  }, [stream, selectedDeviceId]);

  const tempRange = useMemo(
    () => computeRange(filteredStream, (r) => r.temperature),
    [filteredStream]
  );
  const humRange = useMemo(
    () => computeRange(filteredStream, (r) => r.humidity),
    [filteredStream]
  );
  const energyRange = useMemo(
    () =>
      computeRange(
        filteredStream,
        (r) => r.energy_consumption ?? r.energy
      ),
    [filteredStream]
  );
  const aqiRange = useMemo(
    () => computeRange(filteredStream, (r) => r.air_quality ?? r.aqi),
    [filteredStream]
  );

  const onlineDevicesCount = deviceEntries.filter(
    (d) => d.status === 'online' || d.status === 'abnormal'
  ).length;
  const abnormalCount = readingsList.filter((r) => r.is_abnormal).length;

  const activeDeviceLabel =
    selectedDeviceId !== 'all'
      ? activeDeviceInfo?.name || selectedDeviceId
      : activeReading
      ? `Latest: ${activeDeviceInfo?.name || activeReading.device_name || activeReading.device_id}`
      : 'No active source';

  const cardBaseStatus = activeReading
    ? activeReading.is_abnormal
      ? 'abnormal'
      : isConnected
      ? 'online'
      : 'stale'
    : activeDeviceInfo?.status || (isConnected ? 'unknown' : 'offline');

  return (
    <section className="nf-dashboard" aria-label="Telemetry Dashboard">
      {/* Header */}
      <header className="nf-dashboard-header">
        <div className="nf-dashboard-title-group">
          <span className="nf-dashboard-eyebrow">
            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
            NexusFlow Real-Time Telemetry
          </span>
          <h1 className="nf-dashboard-title">IoT Sensor Telemetry Dashboard</h1>
          <p className="nf-dashboard-subtitle">
            Live multi-sensor device readings, health status, and WebSocket stream telemetry
          </p>
        </div>

        <div className="nf-dashboard-controls">
          <ConnectionStatus />

          <select
            aria-label="Filter by sensor device"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="nf-dashboard-select"
          >
            <option value="all">All Devices ({deviceEntries.length})</option>
            {deviceEntries.map((dev) => (
              <option key={dev.deviceId} value={dev.deviceId}>
                {dev.deviceId} — {dev.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="nf-dashboard-btn"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* Fleet Summary Strip */}
      <div className="nf-summary-grid">
        <div className="nf-summary-tile">
          <div>
            <span className="nf-summary-label">Reporting Devices</span>
            <span className="nf-summary-value">{deviceEntries.length}</span>
          </div>
          <Cpu className="w-5 h-5 text-cyan-400" aria-hidden="true" />
        </div>

        <div className="nf-summary-tile">
          <div>
            <span className="nf-summary-label">Online Sensors</span>
            <span className="nf-summary-value text-emerald-400">
              {onlineDevicesCount}
            </span>
          </div>
          <Activity className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        </div>

        <div className="nf-summary-tile">
          <div>
            <span className="nf-summary-label">Abnormal Alerts</span>
            <span
              className={`nf-summary-value ${
                abnormalCount > 0 ? 'text-red-400' : 'text-slate-200'
              }`}
            >
              {abnormalCount}
            </span>
          </div>
          <AlertTriangle
            className={`w-5 h-5 ${
              abnormalCount > 0 ? 'text-red-400' : 'text-slate-500'
            }`}
            aria-hidden="true"
          />
        </div>

        <div className="nf-summary-tile">
          <div>
            <span className="nf-summary-label">Last Packet</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              {formatShortTime(lastUpdated)}
            </span>
          </div>
          <Clock className="w-5 h-5 text-blue-400" aria-hidden="true" />
        </div>
      </div>

      {/* Loading / Empty / Live Content */}
      {isLoading ? (
        <div className="nf-empty-state" role="status" aria-live="polite">
          <div className="nf-empty-icon">
            <RefreshCw className="w-6 h-6 animate-spin" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-white">
            Connecting to Telemetry Stream...
          </h2>
          <p className="text-xs text-slate-400 max-w-md">
            Waiting for initial sensor inventory and live WebSocket telemetry packets.
          </p>
        </div>
      ) : !hasData && deviceEntries.length === 0 ? (
        <div className="nf-empty-state">
          <div className="nf-empty-icon">
            {isConnected ? (
              <Radio className="w-6 h-6" aria-hidden="true" />
            ) : (
              <WifiOff className="w-6 h-6 text-amber-400" aria-hidden="true" />
            )}
          </div>
          <h2 className="text-base font-bold text-white">
            {isConnected
              ? 'No Telemetry Readings Available Yet'
              : 'Telemetry Stream Unavailable'}
          </h2>
          <p className="text-xs text-slate-400 max-w-md">
            {isConnected
              ? 'WebSocket connected to NexusFlow Hub. Waiting for devices or the IoT simulator to emit telemetry.'
              : error ||
                'Unable to reach live telemetry stream. Ensure the NexusFlow backend server is running and reconnect.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {connectionStatus !== 'connected' && (
              <button
                type="button"
                onClick={reconnect}
                className="nf-dashboard-btn nf-dashboard-btn--primary"
              >
                Reconnect WebSocket
              </button>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              className="nf-dashboard-btn"
            >
              Retry Fetch
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Primary Metric Cards Section */}
          <div className="nf-section">
            <div className="nf-section-header">
              <h2 className="nf-section-title">
                <Activity className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                Live Sensor Metrics
              </h2>
              <span className="nf-section-meta">{activeDeviceLabel}</span>
            </div>

            <div className="nf-metrics-grid">
              <SensorMetricCard
                sensorName="Temperature"
                sensorType="temperature"
                value={activeReading?.temperature ?? null}
                unit="°C"
                status={
                  activeReading && activeReading.temperature > 80
                    ? 'abnormal'
                    : cardBaseStatus
                }
                deviceId={activeReading?.deviceId || activeReading?.device_id}
                location={activeDeviceInfo?.location}
                timestamp={activeReading?.timestamp}
                isAbnormal={Boolean(
                  activeReading && activeReading.temperature > 80
                )}
                minLabel={tempRange.minLabel}
                maxLabel={tempRange.maxLabel}
              />

              <SensorMetricCard
                sensorName="Humidity"
                sensorType="humidity"
                value={activeReading?.humidity ?? null}
                unit="%"
                status={
                  activeReading && activeReading.humidity < 20
                    ? 'warning'
                    : cardBaseStatus
                }
                deviceId={activeReading?.deviceId || activeReading?.device_id}
                location={activeDeviceInfo?.location}
                timestamp={activeReading?.timestamp}
                minLabel={humRange.minLabel}
                maxLabel={humRange.maxLabel}
              />

              <SensorMetricCard
                sensorName="Energy Consumption"
                sensorType="energy"
                value={
                  activeReading
                    ? activeReading.energy_consumption ?? activeReading.energy ?? null
                    : null
                }
                unit="kWh"
                status={cardBaseStatus}
                deviceId={activeReading?.deviceId || activeReading?.device_id}
                location={activeDeviceInfo?.location}
                timestamp={activeReading?.timestamp}
                minLabel={energyRange.minLabel}
                maxLabel={energyRange.maxLabel}
              />

              <SensorMetricCard
                sensorName="Air Quality Index"
                sensorType="aqi"
                value={
                  activeReading
                    ? activeReading.air_quality ?? activeReading.aqi ?? null
                    : null
                }
                unit="AQI"
                status={
                  activeReading &&
                  (activeReading.air_quality ?? activeReading.aqi ?? 0) > 150
                    ? 'abnormal'
                    : cardBaseStatus
                }
                deviceId={activeReading?.deviceId || activeReading?.device_id}
                location={activeDeviceInfo?.location}
                timestamp={activeReading?.timestamp}
                isAbnormal={Boolean(
                  activeReading &&
                    (activeReading.air_quality ?? activeReading.aqi ?? 0) > 150
                )}
                minLabel={aqiRange.minLabel}
                maxLabel={aqiRange.maxLabel}
              />
            </div>
          </div>

          {/* Device Fleet Matrix */}
          <div className="nf-section">
            <div className="nf-section-header">
              <h2 className="nf-section-title">
                <Cpu className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                Connected Sensor Devices
              </h2>
              <span className="nf-section-meta">
                Click a device card to inspect its metrics
              </span>
            </div>

            <div className="nf-devices-grid">
              {deviceEntries.map((dev) => {
                const isSelected = selectedDeviceId === dev.deviceId;
                const r = dev.reading;
                const isAbn = Boolean(r?.is_abnormal);

                return (
                  <div
                    key={dev.deviceId}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedDeviceId(isSelected ? 'all' : dev.deviceId)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDeviceId(isSelected ? 'all' : dev.deviceId);
                      }
                    }}
                    className={`nf-device-card ${
                      isSelected ? 'nf-device-card--selected' : ''
                    } ${isAbn ? 'nf-device-card--abnormal' : ''}`.trim()}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold text-cyan-400 block">
                          {dev.deviceId}
                        </span>
                        <h3 className="text-sm font-bold text-white truncate">
                          {dev.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                          <span>
                            {dev.location} &bull; {dev.type}
                          </span>
                        </p>
                      </div>

                      <SensorStatus status={dev.status} lastUpdated={dev.lastSeen} />
                    </div>

                    <div className="nf-device-readings">
                      <div className="nf-device-reading-cell">
                        <span className="text-[10px] uppercase text-slate-400 block">
                          Temp
                        </span>
                        <span className="text-xs font-bold font-mono text-red-400">
                          {formatMetricCell(r?.temperature, '°C')}
                        </span>
                      </div>
                      <div className="nf-device-reading-cell">
                        <span className="text-[10px] uppercase text-slate-400 block">
                          Humidity
                        </span>
                        <span className="text-xs font-bold font-mono text-blue-400">
                          {formatMetricCell(r?.humidity, '%')}
                        </span>
                      </div>
                      <div className="nf-device-reading-cell">
                        <span className="text-[10px] uppercase text-slate-400 block">
                          Energy
                        </span>
                        <span className="text-xs font-bold font-mono text-amber-400">
                          {formatMetricCell(
                            r ? r.energy_consumption ?? r.energy : null,
                            'kWh'
                          )}
                        </span>
                      </div>
                      <div className="nf-device-reading-cell">
                        <span className="text-[10px] uppercase text-slate-400 block">
                          AQI
                        </span>
                        <span className="text-xs font-bold font-mono text-cyan-400">
                          {formatMetricCell(r ? r.air_quality ?? r.aqi : null, '')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-nexus-border/60">
                      <span>Updated</span>
                      <span className="font-mono">{formatShortTime(dev.lastSeen)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Incoming Packet Feed */}
          <div className="nf-stream-panel">
            <div className="nf-section-header mb-3">
              <h2 className="nf-section-title">
                <Clock className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                Recent Live Telemetry Packets
              </h2>
              <span className="nf-section-meta">
                Showing {Math.min(filteredStream.length, 10)} of {filteredStream.length} buffered
              </span>
            </div>

            {filteredStream.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No live WebSocket packets buffered in this session yet. Waiting for incoming telemetry...
              </p>
            ) : (
              <div className="nf-stream-table-wrap">
                <table className="nf-stream-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Device</th>
                      <th>Temp</th>
                      <th>Humidity</th>
                      <th>Energy</th>
                      <th>AQI</th>
                      <th className="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStream
                      .slice(-10)
                      .reverse()
                      .map((packet, idx) => {
                        const devId = packet.deviceId || packet.device_id;
                        return (
                          <tr
                            key={`${devId}-${packet.timestamp}-${idx}`}
                            className={packet.is_abnormal ? 'bg-red-950/20' : ''}
                          >
                            <td className="font-mono text-slate-300">
                              {formatShortTime(packet.timestamp)}
                            </td>
                            <td className="font-semibold text-white">
                              {packet.device_name || devId}
                            </td>
                            <td className="font-mono text-red-400">
                              {formatMetricCell(packet.temperature, '°C')}
                            </td>
                            <td className="font-mono text-blue-400">
                              {formatMetricCell(packet.humidity, '%')}
                            </td>
                            <td className="font-mono text-amber-400">
                              {formatMetricCell(
                                packet.energy_consumption ?? packet.energy,
                                'kWh'
                              )}
                            </td>
                            <td className="font-mono text-cyan-400">
                              {formatMetricCell(
                                packet.air_quality ?? packet.aqi,
                                'AQI'
                              )}
                            </td>
                            <td className="text-right">
                              <SensorStatus
                                status={packet.is_abnormal ? 'abnormal' : 'normal'}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default TelemetryDashboard;
