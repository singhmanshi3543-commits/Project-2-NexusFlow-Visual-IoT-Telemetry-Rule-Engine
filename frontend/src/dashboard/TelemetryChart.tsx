import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TelemetryDataPoint,
  MetricSeriesConfig,
  DEFAULT_TELEMETRY_SERIES,
} from '../types/telemetry';
import '../styles/TelemetryChart.css';

export interface TelemetryChartProps {
  data: TelemetryDataPoint[];
  metrics?: MetricSeriesConfig[];
  chartType?: 'area' | 'line';
  height?: number;
  title?: string;
  isLive?: boolean;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  metrics = DEFAULT_TELEMETRY_SERIES,
  chartType = 'area',
  height = 320,
  title = 'Real-Time IoT Telemetry Stream',
  isLive = true,
}) => {
  const formatXAxisTime = (value: string | number) => {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return String(value);
    }
  };

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="telemetry-chart-tooltip">
        <div className="telemetry-chart-tooltip-header">
          {formatXAxisTime(label)}
        </div>
        {payload.map((entry: any, index: number) => {
          const metricConfig = metrics.find((m) => m.key === entry.dataKey);
          const rawValue = typeof entry.value === 'number' ? entry.value : Number(entry.value);
          const formattedVal = metricConfig?.formatter
            ? metricConfig.formatter(rawValue)
            : `${rawValue.toFixed(2)} ${metricConfig?.unit || ''}`;

          return (
            <div key={`tooltip-${index}`} className="telemetry-chart-tooltip-row">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{metricConfig?.label || entry.name}</span>
              </span>
              <span className="font-mono font-semibold text-white">
                {formattedVal}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl telemetry-chart-container">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
          )}
          <h4 className="text-sm font-bold text-slate-100">{title}</h4>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {data.length} readings
        </span>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {metrics.map((metric) => (
                  <linearGradient
                    key={`gradient-${metric.key}`}
                    id={`grad-${metric.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={metric.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={metric.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxisTime}
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
              <Tooltip content={renderTooltip} />
              {metrics.map((metric) => (
                <Area
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  name={metric.label}
                  stroke={metric.color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#grad-${metric.key})`}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxisTime}
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
              <Tooltip content={renderTooltip} />
              {metrics.map((metric) => (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  name={metric.label}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export { DEFAULT_TELEMETRY_SERIES };
