"use client";

import { Waypoint } from "@/lib/types";

interface WaypointPanelProps {
  waypoints: Waypoint[];
  selectedWaypoint: number | null;
  onWaypointSelect: (index: number) => void;
  totalCount?: number;
}

export default function WaypointPanel({
  waypoints,
  selectedWaypoint,
  onWaypointSelect,
}: WaypointPanelProps) {
  if (waypoints.length === 0) {
    return (
      <div className="text-gray-500 text-sm p-4">No waypoints recorded</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">
        Waypoints ({waypoints.length})
      </h3>
      <div className="flex-1 overflow-y-auto space-y-1 px-2">
        {waypoints.map((wp) => (
          <button
            key={wp.index}
            onClick={() => onWaypointSelect(wp.index)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedWaypoint === wp.index
                ? "bg-blue-600/30 border border-blue-500/50 text-blue-200"
                : "hover:bg-gray-800 text-gray-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium">WP {wp.index}</span>
              <span className="text-xs text-gray-500">
                {wp.speed.toFixed(1)} km/h
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}
            </div>
            {wp.timestamp && (
              <div className="text-xs text-gray-600 mt-0.5">{wp.timestamp}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
