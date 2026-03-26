export interface ScannerSample {
  ms: number;
  utc: string;
  wp: number;
  // Linear acceleration
  ax: number;
  ay: number;
  az: number;
  // Gravity vector
  gvx: number;
  gvy: number;
  gvz: number;
  // Gyroscope
  gx: number;
  gy: number;
  gz: number;
  // Quaternion
  qw: number;
  qx: number;
  qy: number;
  qz: number;
  // Magnetometer
  mx: number;
  my: number;
  mz: number;
  // Time-of-Flight
  tof_mm: number;
  tof_status: number;
  // GPS
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  hdg: number;
  sats: number;
  hdop: number;
  // Calibration
  cal_sys: number;
  cal_gyro: number;
  cal_accel: number;
  cal_mag: number;
}

export interface SessionData {
  filename: string;
  samples: ScannerSample[];
  waypoints: Waypoint[];
}

export interface Waypoint {
  index: number;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  sats: number;
  timestamp: string;
  sampleStart: number;
  sampleEnd: number;
}
