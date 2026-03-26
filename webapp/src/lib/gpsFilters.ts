import { Waypoint, FilterSettings, FilterResult, DwellMarker } from "./types";

/** Haversine distance between two lat/lng points in meters */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Remove waypoints with poor satellite count or high HDOP */
function filterByQuality(
  waypoints: Waypoint[],
  minSats: number,
  maxHDOP: number
): { filtered: Waypoint[]; removed: number } {
  const filtered = waypoints.filter(
    (wp) => wp.sats >= minSats && wp.hdop <= maxHDOP
  );
  return { filtered, removed: waypoints.length - filtered.length };
}

/** Remove waypoints that jump too far from the previous accepted point */
function filterByJump(
  waypoints: Waypoint[],
  maxJumpMeters: number
): { filtered: Waypoint[]; removed: number } {
  if (waypoints.length === 0) return { filtered: [], removed: 0 };
  const result = [waypoints[0]];
  let removed = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const prev = result[result.length - 1];
    const dist = haversineMeters(prev.lat, prev.lng, waypoints[i].lat, waypoints[i].lng);
    if (dist <= maxJumpMeters) {
      result.push(waypoints[i]);
    } else {
      removed++;
    }
  }
  return { filtered: result, removed };
}

/** Detect and collapse stationary dwell periods */
function filterDwells(
  waypoints: Waypoint[],
  radiusMeters: number,
  timeSeconds: number
): { filtered: Waypoint[]; dwellMarkers: DwellMarker[]; removed: number } {
  if (waypoints.length === 0)
    return { filtered: [], dwellMarkers: [], removed: 0 };

  const result: Waypoint[] = [];
  const dwellMarkers: DwellMarker[] = [];
  let removed = 0;

  let i = 0;
  while (i < waypoints.length) {
    // Start a potential dwell group
    const group = [waypoints[i]];
    let centroidLat = waypoints[i].lat;
    let centroidLng = waypoints[i].lng;
    let j = i + 1;

    while (j < waypoints.length) {
      const dist = haversineMeters(
        centroidLat,
        centroidLng,
        waypoints[j].lat,
        waypoints[j].lng
      );
      if (dist <= radiusMeters) {
        group.push(waypoints[j]);
        // Update centroid
        centroidLat =
          group.reduce((sum, wp) => sum + wp.lat, 0) / group.length;
        centroidLng =
          group.reduce((sum, wp) => sum + wp.lng, 0) / group.length;
        j++;
      } else {
        break;
      }
    }

    // Check if this group qualifies as a dwell
    const durationMs =
      group[group.length - 1].elapsedMs - group[0].elapsedMs;
    const durationSec = durationMs / 1000;

    if (group.length > 1 && durationSec >= timeSeconds) {
      // Collapse to a single representative waypoint (first in group)
      const representative = {
        ...group[0],
        lat: centroidLat,
        lng: centroidLng,
      };
      result.push(representative);
      removed += group.length - 1;

      dwellMarkers.push({
        lat: centroidLat,
        lng: centroidLng,
        durationSeconds: durationSec,
        waypointCount: group.length,
      });
    } else {
      // Not a dwell — keep all points
      result.push(...group);
    }

    i = j;
  }

  return { filtered: result, dwellMarkers, removed };
}

/** Apply all GPS filters in sequence */
export function applyAllFilters(
  waypoints: Waypoint[],
  settings: FilterSettings
): FilterResult {
  const quality = filterByQuality(waypoints, settings.minSats, settings.maxHDOP);
  const jump = filterByJump(quality.filtered, settings.maxJumpMeters);
  const dwell = filterDwells(
    jump.filtered,
    settings.dwellRadiusMeters,
    settings.dwellTimeSeconds
  );

  return {
    waypoints: dwell.filtered,
    dwellMarkers: dwell.dwellMarkers,
    removedCount: {
      quality: quality.removed,
      jump: jump.removed,
      dwell: dwell.removed,
    },
  };
}
