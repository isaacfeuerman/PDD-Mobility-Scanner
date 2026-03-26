"use client";

import { useState } from "react";
import { FilterSettings } from "@/lib/types";

interface FilterPanelProps {
  settings: FilterSettings;
  onSettingsChange: (settings: FilterSettings) => void;
  removedCount?: { quality: number; jump: number; dwell: number };
  totalWaypoints: number;
  filteredWaypoints: number;
}

export default function FilterPanel({
  settings,
  onSettingsChange,
  removedCount,
  totalWaypoints,
  filteredWaypoints,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  const update = (partial: Partial<FilterSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  const totalRemoved = removedCount
    ? removedCount.quality + removedCount.jump + removedCount.dwell
    : 0;

  return (
    <div className="border-b border-gray-800">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold
                   text-gray-400 uppercase tracking-wider hover:text-gray-200 transition-colors"
      >
        <span>GPS Filters</span>
        <div className="flex items-center gap-2">
          {totalRemoved > 0 && (
            <span className="text-xs bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">
              -{totalRemoved}
            </span>
          )}
          <span className="text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Summary */}
          <div className="text-xs text-gray-500">
            Showing {filteredWaypoints} of {totalWaypoints} waypoints
          </div>

          {/* Min Satellites */}
          <FilterSlider
            label="Min Satellites"
            value={settings.minSats}
            min={0}
            max={12}
            step={1}
            badge={removedCount?.quality}
            badgeLabel="quality"
            onChange={(v) => update({ minSats: v })}
          />

          {/* Max HDOP */}
          <FilterSlider
            label="Max HDOP"
            value={settings.maxHDOP}
            min={0.5}
            max={20}
            step={0.5}
            onChange={(v) => update({ maxHDOP: v })}
          />

          {/* Max Jump Distance */}
          <FilterSlider
            label="Max Jump (m)"
            value={settings.maxJumpMeters}
            min={5}
            max={500}
            step={5}
            badge={removedCount?.jump}
            badgeLabel="jumps"
            onChange={(v) => update({ maxJumpMeters: v })}
          />

          {/* Dwell Radius */}
          <FilterSlider
            label="Dwell Radius (m)"
            value={settings.dwellRadiusMeters}
            min={1}
            max={20}
            step={1}
            badge={removedCount?.dwell}
            badgeLabel="dwell"
            onChange={(v) => update({ dwellRadiusMeters: v })}
          />

          {/* Dwell Time */}
          <FilterSlider
            label="Dwell Time (s)"
            value={settings.dwellTimeSeconds}
            min={5}
            max={120}
            step={5}
            onChange={(v) => update({ dwellTimeSeconds: v })}
          />

          {/* Dwell Markers Toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showDwellMarkers}
              onChange={(e) => update({ showDwellMarkers: e.target.checked })}
              className="rounded border-gray-600 bg-gray-800 text-blue-500
                         focus:ring-blue-500 focus:ring-offset-0"
            />
            Show dwell markers on map
          </label>
        </div>
      )}
    </div>
  );
}

function FilterSlider({
  label,
  value,
  min,
  max,
  step,
  badge,
  badgeLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  badge?: number;
  badgeLabel?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <div className="flex items-center gap-1.5">
          {badge !== undefined && badge > 0 && (
            <span className="text-xs bg-red-600/20 text-red-400 px-1 py-0.5 rounded">
              -{badge} {badgeLabel}
            </span>
          )}
          <span className="text-xs font-mono text-gray-300">{value}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer
                   accent-blue-500"
      />
    </div>
  );
}
