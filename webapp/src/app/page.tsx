"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import FileUpload from "@/components/FileUpload";
import MapView from "@/components/MapView";
import SensorCharts from "@/components/SensorCharts";
import WaypointPanel from "@/components/WaypointPanel";
import SessionStats from "@/components/SessionStats";
import FilterPanel from "@/components/FilterPanel";
import ResizableSplit from "@/components/ResizableSplit";
import { parseCSV, parseImages } from "@/lib/parseCSV";
import { applyAllFilters } from "@/lib/gpsFilters";
import { SessionData, FilterSettings, DEFAULT_FILTER_SETTINGS } from "@/lib/types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(DEFAULT_FILTER_SETTINGS);
  const [statsOpen, setStatsOpen] = useState(true);
  const [imageCount, setImageCount] = useState(0);
  const [apiKey, setApiKey] = useState(() => {
    if (GOOGLE_MAPS_API_KEY) return GOOGLE_MAPS_API_KEY;
    if (typeof window !== "undefined") {
      return localStorage.getItem("pdd_google_maps_key") || "";
    }
    return "";
  });
  const [tempApiKey, setTempApiKey] = useState("");

  // Persist API key to localStorage
  useEffect(() => {
    if (apiKey && !GOOGLE_MAPS_API_KEY) {
      localStorage.setItem("pdd_google_maps_key", apiKey);
    }
  }, [apiKey]);

  // Apply GPS filters
  const filterResult = useMemo(() => {
    if (!session) return null;
    return applyAllFilters(session.waypoints, filterSettings);
  }, [session, filterSettings]);

  const handleFileLoaded = useCallback((filename: string, content: string) => {
    const data = parseCSV(filename, content);
    setSession(data);
    setSelectedWaypoint(null);
  }, []);

  const handleImagesLoaded = useCallback((files: FileList) => {
    const imageMap = parseImages(files);
    setImageCount(imageMap.size);
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, waypointImages: imageMap };
    });
  }, []);

  const handleWaypointSelect = useCallback((index: number) => {
    setSelectedWaypoint((prev) => (prev === index ? null : index));
  }, []);

  const handleReady = useCallback(() => {
    setShowDashboard(true);
  }, []);

  // Landing / upload screen — stay here until user clicks "View Dashboard"
  if (!session || !showDashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-xl w-full">
          <h1 className="text-3xl font-bold text-center mb-2">
            PDD Mobility Scanner
          </h1>
          <p className="text-gray-500 text-center mb-8">
            Upload your data files from the scanner to visualize the session.
          </p>

          <FileUpload
            onFileLoaded={handleFileLoaded}
            onImagesLoaded={handleImagesLoaded}
            onReady={handleReady}
            hasCSV={session !== null}
            hasImages={imageCount > 0}
            imageCount={imageCount}
          />

          {/* API key input if not set via env */}
          {!GOOGLE_MAPS_API_KEY && (
            <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
              <label className="text-sm text-gray-400 block mb-2">
                Google Maps API Key (optional — needed for map view)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm
                             text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => setApiKey(tempApiKey)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500
                             transition-colors"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const filteredWaypoints = filterResult?.waypoints ?? session.waypoints;
  const dwellMarkers = filterResult?.dwellMarkers ?? [];

  // Dashboard view
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">PDD Mobility Scanner</h1>
          <span className="text-sm text-gray-500">{session.filename}</span>
          {imageCount > 0 && (
            <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">
              {imageCount} images
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatsOpen(!statsOpen)}
            className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1
                       bg-gray-800 rounded hover:bg-gray-700"
          >
            {statsOpen ? "Hide Stats" : "Show Stats"}
          </button>
          <button
            onClick={() => {
              setSession(null);
              setShowDashboard(false);
              setSelectedWaypoint(null);
              setImageCount(0);
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1
                       bg-gray-800 rounded hover:bg-gray-700"
          >
            Load New File
          </button>
        </div>
      </header>

      {/* Collapsible stats bar */}
      {statsOpen && (
        <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800">
          <SessionStats session={session} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar: filters + waypoints */}
        <aside className="w-56 border-r border-gray-800 bg-gray-900/30 overflow-hidden flex flex-col">
          <FilterPanel
            settings={filterSettings}
            onSettingsChange={setFilterSettings}
            removedCount={filterResult?.removedCount}
            totalWaypoints={session.waypoints.length}
            filteredWaypoints={filteredWaypoints.length}
          />
          <WaypointPanel
            waypoints={filteredWaypoints}
            selectedWaypoint={selectedWaypoint}
            onWaypointSelect={handleWaypointSelect}
          />
        </aside>

        {/* Map and charts — resizable split */}
        <main className="flex-1 min-w-0">
          <ResizableSplit
            top={
              <div className="h-full p-2">
                {apiKey ? (
                  <MapView
                    waypoints={filteredWaypoints}
                    samples={session.samples}
                    selectedWaypoint={selectedWaypoint}
                    onWaypointSelect={handleWaypointSelect}
                    apiKey={apiKey}
                    dwellMarkers={dwellMarkers}
                    showDwellMarkers={filterSettings.showDwellMarkers}
                    waypointImages={session.waypointImages}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <p>Google Maps API key required for map view</p>
                      <p className="text-sm mt-1 text-gray-600">
                        Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in{" "}
                        <code>.env.local</code> or enter it on the upload screen
                      </p>
                    </div>
                  </div>
                )}
              </div>
            }
            bottom={
              <div className="h-full p-4">
                <SensorCharts
                  samples={session.samples}
                  selectedWaypoint={selectedWaypoint}
                />
              </div>
            }
            defaultRatio={0.55}
          />
        </main>
      </div>
    </div>
  );
}
