"use client";

import { SessionData } from "@/lib/types";

interface SessionStatsProps {
  session: SessionData;
}

export default function SessionStats({ session }: SessionStatsProps) {
  const { samples, waypoints } = session;
  const durationMs = samples.length > 0 ? samples[samples.length - 1].ms - samples[0].ms : 0;
  const durationMin = durationMs / 60000;

  const avgSpeed =
    waypoints.length > 0
      ? waypoints.reduce((sum, wp) => sum + wp.speed, 0) / waypoints.length
      : 0;

  const maxSpeed = waypoints.length > 0
    ? Math.max(...waypoints.map((wp) => wp.speed))
    : 0;

  const stats = [
    { label: "Samples", value: samples.length.toLocaleString() },
    { label: "Waypoints", value: waypoints.length },
    { label: "Duration", value: `${durationMin.toFixed(1)} min` },
    { label: "Sample Rate", value: `${(samples.length / (durationMs / 1000) || 0).toFixed(0)} Hz` },
    { label: "Avg Speed", value: `${avgSpeed.toFixed(1)} km/h` },
    { label: "Max Speed", value: `${maxSpeed.toFixed(1)} km/h` },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/50"
        >
          <div className="text-xs text-gray-500 uppercase tracking-wider">
            {stat.label}
          </div>
          <div className="text-lg font-semibold text-gray-200 mt-0.5">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
