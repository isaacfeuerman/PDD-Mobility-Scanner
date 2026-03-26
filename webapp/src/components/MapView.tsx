"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Waypoint, ScannerSample } from "@/lib/types";

// Prevent multiple script loads across hot-reloads
let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existing) {
      if (window.google?.maps) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
      }
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,geometry`;
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

interface MapViewProps {
  waypoints: Waypoint[];
  samples: ScannerSample[];
  selectedWaypoint: number | null;
  onWaypointSelect: (index: number) => void;
  apiKey: string;
}

export default function MapView({
  waypoints,
  samples,
  selectedWaypoint,
  onWaypointSelect,
  apiKey,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const selectedMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const startMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const endMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load Google Maps script (only once, ever)
  useEffect(() => {
    loadGoogleMaps(apiKey).then(() => setLoaded(true));
  }, [apiKey]);

  // Find nearest waypoint to a clicked point on the polyline
  const findNearestWaypoint = useCallback(
    (clickLatLng: google.maps.LatLng) => {
      let nearest = waypoints[0];
      let minDist = Infinity;

      for (const wp of waypoints) {
        const wpLatLng = new google.maps.LatLng(wp.lat, wp.lng);
        const dist =
          google.maps.geometry.spherical.computeDistanceBetween(
            clickLatLng,
            wpLatLng
          );
        if (dist < minDist) {
          minDist = dist;
          nearest = wp;
        }
      }
      return nearest;
    },
    [waypoints]
  );

  const initMap = useCallback(() => {
    if (!mapRef.current || !loaded || waypoints.length === 0) return;

    const center = { lat: waypoints[0].lat, lng: waypoints[0].lng };

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 17,
      mapTypeId: "hybrid",
      mapId: "pdd-scanner-map",
    });
    googleMapRef.current = map;

    // Info window for waypoint details
    const infoWindow = new google.maps.InfoWindow();
    infoWindowRef.current = infoWindow;

    // Draw route polyline — clickable
    const path = waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }));
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map,
      clickable: true,
    });
    polylineRef.current = polyline;

    // Click on the route line to select nearest waypoint
    polyline.addListener("click", (e: google.maps.PolyMouseEvent) => {
      if (e.latLng) {
        const wp = findNearestWaypoint(e.latLng);
        onWaypointSelect(wp.index);
      }
    });

    // Start marker (green)
    const startDiv = document.createElement("div");
    startDiv.style.cssText =
      "width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
    startMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: waypoints[0].lat, lng: waypoints[0].lng },
      content: startDiv,
      title: "Start",
    });

    // End marker (red)
    const last = waypoints[waypoints.length - 1];
    const endDiv = document.createElement("div");
    endDiv.style.cssText =
      "width:14px;height:14px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
    endMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: last.lat, lng: last.lng },
      content: endDiv,
      title: "End",
    });

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    waypoints.forEach((wp) => bounds.extend({ lat: wp.lat, lng: wp.lng }));
    map.fitBounds(bounds, 50);
  }, [loaded, waypoints, onWaypointSelect, findNearestWaypoint]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  // Show/move selected waypoint marker + info window
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !loaded) return;

    // Remove previous selected marker
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.map = null;
      selectedMarkerRef.current = null;
    }

    if (selectedWaypoint === null) {
      infoWindowRef.current?.close();
      return;
    }

    const wp = waypoints.find((w) => w.index === selectedWaypoint);
    if (!wp) return;

    // Create selected waypoint marker (amber)
    const markerDiv = document.createElement("div");
    markerDiv.style.cssText =
      "width:18px;height:18px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 0 12px rgba(245,158,11,0.7);cursor:pointer;";

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: wp.lat, lng: wp.lng },
      content: markerDiv,
      title: `Waypoint ${wp.index}`,
      zIndex: 999,
    });
    selectedMarkerRef.current = marker;

    // Show info window
    infoWindowRef.current?.setContent(`
      <div style="color:#111;font-family:system-ui;font-size:13px;line-height:1.5;min-width:160px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Waypoint ${wp.index}</div>
        <div>Speed: ${wp.speed.toFixed(2)} m/s</div>
        <div>Alt: ${wp.alt.toFixed(1)} m</div>
        <div>Sats: ${wp.sats}</div>
        <div style="color:#666;font-size:11px;margin-top:4px;">
          ${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)}
        </div>
        ${wp.timestamp ? `<div style="color:#666;font-size:11px;">${wp.timestamp}</div>` : ""}
      </div>
    `);
    infoWindowRef.current?.open(map, marker);

    // Pan to selected waypoint
    map.panTo({ lat: wp.lat, lng: wp.lng });
  }, [selectedWaypoint, waypoints, loaded]);

  if (waypoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No GPS data available
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full rounded-lg" />;
}
