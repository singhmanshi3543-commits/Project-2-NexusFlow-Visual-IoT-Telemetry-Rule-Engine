/**
 * NexusFlow Real-Time Telemetry & Chart Series Type Definitions
 */

export type TelemetryMetricType =
  | 'temperature'
  | 'humidity'
  | 'energy'
  | 'air_quality'
  | 'vibration'
  | 'pressure'
  | 'voltage'
  | 'current';

export interface TelemetryDataPoint {
  timestamp: string | number;
  deviceId?: string;
  temperature?: number;
  humidity?: number;
  energy?: number;
  air_quality?: number;
  vibration?: number;
  pressure?: number;
  voltage?: number;
  current?: number;
  [metricKey: string]: any;
}

export interface MetricSeriesConfig {
  key: string;
  label: string;
  color: string;
  unit: string;
  yAxisId?: string;
  minValue?: number;
  maxValue?: number;
  formatter?: (val: number) => string;
}

export interface TelemetryAggregatedStats {
  metric: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  sampleCount: number;
  unit: string;
}

export interface TelemetryStreamFilter {
  deviceIds: string[];
  metrics: TelemetryMetricType[];
  timeRange: '15m' | '1h' | '6h' | '24h' | '7d';
  samplingIntervalMs?: number;
}

/**
 * Standard Telemetry Chart Color Palettes and Series Configurations
 */
export const DEFAULT_TELEMETRY_SERIES: MetricSeriesConfig[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    color: '#06B6D4', // Cyan
    unit: '°C',
    minValue: -20,
    maxValue: 120,
    formatter: (val: number) => `${val.toFixed(1)} °C`,
  },
  {
    key: 'humidity',
    label: 'Humidity',
    color: '#10B981', // Emerald
    unit: '%',
    minValue: 0,
    maxValue: 100,
    formatter: (val: number) => `${val.toFixed(1)} %`,
  },
  {
    key: 'energy',
    label: 'Active Power',
    color: '#F59E0B', // Amber
    unit: 'kWh',
    minValue: 0,
    maxValue: 500,
    formatter: (val: number) => `${val.toFixed(2)} kWh`,
  },
  {
    key: 'air_quality',
    label: 'Air Quality (AQI)',
    color: '#8B5CF6', // Purple
    unit: 'AQI',
    minValue: 0,
    maxValue: 300,
    formatter: (val: number) => `${Math.round(val)} AQI`,
  },
];

export const DEVICE_METRIC_MAP: Record<string, string[]> = {
  'TURBINE-001': ['temperature', 'vibration', 'energy'],
  'TEMP-001': ['temperature'],
  'HUM-002': ['humidity', 'temperature'],
  'ENG-003': ['energy', 'voltage', 'current'],
  'AQI-004': ['air_quality', 'humidity'],
};
