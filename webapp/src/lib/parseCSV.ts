import Papa from "papaparse";
import { ScannerSample, SessionData, Waypoint } from "./types";

export function parseCSV(filename: string, csvText: string): SessionData {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const samples: ScannerSample[] = result.data.map((row) => ({
    ms: parseFloat(row.ms) || 0,
    utc: row.utc || "",
    wp: parseInt(row.wp) || 0,
    ax: parseFloat(row.ax) || 0,
    ay: parseFloat(row.ay) || 0,
    az: parseFloat(row.az) || 0,
    gvx: parseFloat(row.gvx) || 0,
    gvy: parseFloat(row.gvy) || 0,
    gvz: parseFloat(row.gvz) || 0,
    gx: parseFloat(row.gx) || 0,
    gy: parseFloat(row.gy) || 0,
    gz: parseFloat(row.gz) || 0,
    qw: parseFloat(row.qw) || 0,
    qx: parseFloat(row.qx) || 0,
    qy: parseFloat(row.qy) || 0,
    qz: parseFloat(row.qz) || 0,
    mx: parseFloat(row.mx) || 0,
    my: parseFloat(row.my) || 0,
    mz: parseFloat(row.mz) || 0,
    tof_mm: parseFloat(row.tof_mm) || 0,
    tof_status: parseInt(row.tof_status) || 0,
    lat: parseFloat(row.lat) || 0,
    lng: parseFloat(row.lng) || 0,
    alt: parseFloat(row.alt) || 0,
    speed: parseFloat(row.speed) || 0,
    hdg: parseFloat(row.hdg) || 0,
    sats: parseInt(row.sats) || 0,
    hdop: parseFloat(row.hdop) || 0,
    cal_sys: parseInt(row.cal_sys) || 0,
    cal_gyro: parseInt(row.cal_gyro) || 0,
    cal_accel: parseInt(row.cal_accel) || 0,
    cal_mag: parseInt(row.cal_mag) || 0,
  }));

  // Extract waypoints (samples that have GPS data)
  const waypointMap = new Map<number, Waypoint>();
  samples.forEach((s, i) => {
    if (s.lat !== 0 && s.lng !== 0 && !waypointMap.has(s.wp)) {
      waypointMap.set(s.wp, {
        index: s.wp,
        lat: s.lat,
        lng: s.lng,
        alt: s.alt,
        speed: s.speed,
        sats: s.sats,
        timestamp: s.utc,
        sampleStart: i,
        sampleEnd: i,
      });
    }
    // Update sampleEnd for this waypoint
    const wp = waypointMap.get(s.wp);
    if (wp) wp.sampleEnd = i;
  });

  const waypoints = Array.from(waypointMap.values()).sort(
    (a, b) => a.index - b.index
  );

  return { filename, samples, waypoints };
}
