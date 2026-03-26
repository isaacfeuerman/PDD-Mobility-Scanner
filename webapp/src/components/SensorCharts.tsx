"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from "recharts";
import { ScannerSample } from "@/lib/types";

interface SensorChartsProps {
  samples: ScannerSample[];
  selectedWaypoint: number | null;
}

type ChartType = "acceleration" | "gyroscope" | "quaternion" | "tof" | "gps";

const CHART_CONFIGS: Record<
  ChartType,
  { label: string; keys: { key: string; color: string; label: string }[] }
> = {
  acceleration: {
    label: "Linear Acceleration (m/s²)",
    keys: [
      { key: "ax", color: "#ef4444", label: "X" },
      { key: "ay", color: "#22c55e", label: "Y" },
      { key: "az", color: "#3b82f6", label: "Z" },
    ],
  },
  gyroscope: {
    label: "Gyroscope (°/s)",
    keys: [
      { key: "gx", color: "#f97316", label: "X" },
      { key: "gy", color: "#a855f7", label: "Y" },
      { key: "gz", color: "#06b6d4", label: "Z" },
    ],
  },
  quaternion: {
    label: "Quaternion (orientation)",
    keys: [
      { key: "qw", color: "#f59e0b", label: "W" },
      { key: "qx", color: "#ef4444", label: "X" },
      { key: "qy", color: "#22c55e", label: "Y" },
      { key: "qz", color: "#3b82f6", label: "Z" },
    ],
  },
  tof: {
    label: "Time-of-Flight Distance (mm)",
    keys: [{ key: "tof_mm", color: "#8b5cf6", label: "Distance" }],
  },
  gps: {
    label: "GPS Speed (m/s)",
    keys: [{ key: "speed", color: "#10b981", label: "Speed" }],
  },
};

export default function SensorCharts({
  samples,
  selectedWaypoint,
}: SensorChartsProps) {
  const [activeChart, setActiveChart] = useState<ChartType>("acceleration");

  // Downsample for performance (show every Nth point)
  const maxPoints = 1000;
  const step = Math.max(1, Math.floor(samples.length / maxPoints));
  const chartData = samples.filter((_, i) => i % step === 0);

  const config = CHART_CONFIGS[activeChart];

  // Find waypoint boundaries for reference lines
  const waypointTimes: number[] = [];
  if (selectedWaypoint !== null) {
    const wpSamples = samples.filter((s) => s.wp === selectedWaypoint);
    if (wpSamples.length > 0) {
      waypointTimes.push(wpSamples[0].ms);
      waypointTimes.push(wpSamples[wpSamples.length - 1].ms);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chart type tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {(Object.keys(CHART_CONFIGS) as ChartType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveChart(type)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeChart === type
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {CHART_CONFIGS[type].label.split(" (")[0]}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="ms"
              stroke="#9ca3af"
              fontSize={11}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
            />
            <YAxis stroke="#9ca3af" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: 12,
              }}
              labelFormatter={(v) => `Time: ${(Number(v) / 1000).toFixed(2)}s`}
            />
            <Legend />
            {config.keys.map(({ key, color, label }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                name={label}
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            ))}
            {waypointTimes.map((t, i) => (
              <ReferenceLine
                key={i}
                x={t}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
            ))}
            <Brush
              dataKey="ms"
              height={25}
              stroke="#3b82f6"
              fill="#111827"
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
