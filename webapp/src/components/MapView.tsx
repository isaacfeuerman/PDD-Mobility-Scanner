"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Waypoint, ScannerSample } from "@/lib/types";

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
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load Google Maps script (only once)
  useEffect(() => {
    if (window.google?.maps) {
      setLoaded(true);
      return;
    }
    // Check if script tag already exists
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true));
      if (window.google?.maps) setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [apiKey]);

  const initMap = useCallback(() => {
    if (!mapRef.current || !loaded || waypoints.length === 0) return;

    // Center on first waypoint
    const center = { lat: waypoints[0].lat, lng: waypoints[0].lng };

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 17,
      mapTypeId: "hybrid",
      mapId: "pdd-scanner-map",
      styles: [
        {
          featureType: "all",
          elementType: "labels",
          stylers: [{ visibility: "on" }],
        },
      ],
    });
    googleMapRef.current = map;

    // Draw route polyline
    const path = waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }));

    // Color segments by speed
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });
    polylineRef.current = polyline;

    // Clear old markers
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    // Add waypoint markers
    waypoints.forEach((wp) => {
      const isFirst = wp.index === waypoints[0].index;
      const isLast = wp.index === waypoints[waypoints.length - 1].index;

      const markerDiv = document.createElement("div");
      markerDiv.style.width = isFirst || isLast ? "16px" : "10px";
      markerDiv.style.height = isFirst || isLast ? "16px" : "10px";
      markerDiv.style.borderRadius = "50%";
      markerDiv.style.border = "2px solid white";
      markerDiv.style.cursor = "pointer";
      markerDiv.style.backgroundColor = isFirst
        ? "#22c55e"
        : isLast
          ? "#ef4444"
          : "#3b82f6";

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: wp.lat, lng: wp.lng },
        content: markerDiv,
        title: `Waypoint ${wp.index}`,
      });

      marker.addListener("click", () => {
        onWaypointSelect(wp.index);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    waypoints.forEach((wp) => bounds.extend({ lat: wp.lat, lng: wp.lng }));
    map.fitBounds(bounds, 50);
  }, [loaded, waypoints, onWaypointSelect]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  // Highlight selected waypoint
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      const div = marker.content as HTMLDivElement;
      if (!div) return;
      const wp = waypoints[i];
      if (!wp) return;

      const isSelected = wp.index === selectedWaypoint;
      const isFirst = i === 0;
      const isLast = i === waypoints.length - 1;

      div.style.width = isSelected ? "20px" : isFirst || isLast ? "16px" : "10px";
      div.style.height = isSelected ? "20px" : isFirst || isLast ? "16px" : "10px";
      div.style.backgroundColor = isSelected
        ? "#f59e0b"
        : isFirst
          ? "#22c55e"
          : isLast
            ? "#ef4444"
            : "#3b82f6";
      div.style.boxShadow = isSelected ? "0 0 12px rgba(245,158,11,0.7)" : "none";
    });
  }, [selectedWaypoint, waypoints]);

  if (waypoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No GPS data available
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full rounded-lg" />;
}
