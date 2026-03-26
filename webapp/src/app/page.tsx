"use client";

import { useState, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import MapView from "@/components/MapView";
import SensorCharts from "@/components/SensorCharts";
import WaypointPanel from "@/components/WaypointPanel";
import SessionStats from "@/components/SessionStats";
import { parseCSV } from "@/lib/parseCSV";
import { SessionData } from "@/lib/types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState(GOOGLE_MAPS_API_KEY);
  const [tempApiKey, setTempApiKey] = useState("");

  const handleFileLoaded = useCallback((filename: string, content: string) => {
    const data = parseCSV(filename, content);
    setSession(data);
    setSelectedWaypoint(null);
  }, []);

  const handleWaypointSelect = useCallback((index: number) => {
    setSelectedWaypoint((prev) => (prev === index ? null : index));
  }, []);

  // Landing / upload screen
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-xl w-full">
          <h1 className="text-3xl font-bold text-center mb-2">
            PDD Mobility Scanner
          </h1>
          <p className="text-gray-500 text-center mb-8">
            Upload a <code className="text-blue-400">trail_data.csv</code> file
            from your scanner to visualize the session data.
          </p>

          <FileUpload onFileLoaded={handleFileLoaded} />

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

  // Dashboard view
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">PDD Mobility Scanner</h1>
          <span className="text-sm text-gray-500">{session.filename}</span>
        </div>
        <button
          onClick={() => {
            setSession(null);
            setSelectedWaypoint(null);
          }}
          className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1
                     bg-gray-800 rounded hover:bg-gray-700"
        >
          Load New File
        </button>
      </header>

      {/* Stats bar */}
      <div className="px-4 py-3 bg-gray-900/50 border-b border-gray-800">
        <SessionStats session={session} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Waypoint sidebar */}
        <aside className="w-56 border-r border-gray-800 bg-gray-900/30 overflow-hidden flex flex-col">
          <WaypointPanel
            waypoints={session.waypoints}
            selectedWaypoint={selectedWaypoint}
            onWaypointSelect={handleWaypointSelect}
          />
        </aside>

        {/* Map and charts */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Map */}
          <div className="h-1/2 border-b border-gray-800 p-2">
            {apiKey ? (
              <MapView
                waypoints={session.waypoints}
                samples={session.samples}
                selectedWaypoint={selectedWaypoint}
                onWaypointSelect={handleWaypointSelect}
                apiKey={apiKey}
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

          {/* Charts */}
          <div className="h-1/2 p-4">
            <SensorCharts
              samples={session.samples}
              selectedWaypoint={selectedWaypoint}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
