import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';

// ── Session directory helpers ──────────────────────────────────────

const SESSION_ROOT = FileSystem.documentDirectory + 'sessions/';

async function ensureSessionRoot() {
  const info = await FileSystem.getInfoAsync(SESSION_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SESSION_ROOT, { intermediates: true });
  }
}

function sessionDir(num) {
  return SESSION_ROOT + `session_${String(num).padStart(2, '0')}/`;
}

// ── Main App ───────────────────────────────────────────────────────

export default function App() {
  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [sessionNum, setSessionNum] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hasFix, setHasFix] = useState(false);
  const [coords, setCoords] = useState(null);
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState([]);

  // Refs (mutable across renders without re-render)
  const cameraRef = useRef(null);
  const locationSub = useRef(null);
  const timerRef = useRef(null);
  const recStartMsRef = useRef(0);
  const csvRowsRef = useRef([]);   // buffered in memory, written on stop
  const sessionDirRef = useRef('');
  const sessionNumRef = useRef(0);

  // ── Request permissions on mount ──

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  // ── Find next session number on mount ──

  useEffect(() => {
    (async () => {
      await ensureSessionRoot();
      let num = 0;
      for (let i = 0; i < 100; i++) {
        const dir = sessionDir(i);
        const info = await FileSystem.getInfoAsync(dir);
        if (info.exists) num = i + 1;
      }
      setSessionNum(num);
      sessionNumRef.current = num;
    })();
  }, []);

  // ── Start recording ──

  const startRecording = useCallback(async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    try {
      const num = sessionNumRef.current;
      const dir = sessionDir(num);
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      sessionDirRef.current = dir;

      // Record start time (Unix epoch ms)
      const recStartMs = Date.now();
      recStartMsRef.current = recStartMs;
      csvRowsRef.current = [];

      // Update UI immediately
      setIsRecording(true);
      setElapsed(0);

      // Start elapsed counter
      const elapsedInterval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      timerRef.current = { elapsedInterval };

      // Start GPS logging (~1Hz)
      try {
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 0,
          },
          (loc) => {
            const { latitude, longitude, altitude, speed, heading } = loc.coords;
            const ms = Date.now();
            const utc = new Date(loc.timestamp).toISOString();
            const spd = speed != null && speed >= 0 ? speed : 0;
            const hdg = heading != null && heading >= 0 ? heading : 0;
            const alt = altitude != null ? altitude : 0;

            csvRowsRef.current.push(`${ms},${utc},${latitude},${longitude},${alt},${spd},${hdg},,`);

            setHasFix(true);
            setCoords({ lat: latitude, lng: longitude });
          }
        );
      } catch (locErr) {
        console.log('GPS unavailable:', locErr.message);
      }

      // Start video recording
      const video = await cameraRef.current.recordAsync({
        maxDuration: 3600,
      });

      // recordAsync resolves when recording stops
      if (video && video.uri) {
        const destPath = dir + 'trail_video.mp4';
        await FileSystem.moveAsync({ from: video.uri, to: destPath });
      }
    } catch (e) {
      Alert.alert('Recording Error', e.message);
      setIsRecording(false);
    }
  }, []);

  // ── Stop recording ──

  const stopRecording = useCallback(async () => {
    // Stop video
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
    }

    // Stop GPS
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }

    // Stop timers
    if (timerRef.current) {
      clearInterval(timerRef.current.elapsedInterval);
    }

    // Write CSV in one shot (header + all buffered rows)
    const dir = sessionDirRef.current;
    const csvPath = dir + 'trail_data.csv';
    const header = `# rec_start_ms=${recStartMsRef.current}\nms,utc,lat,lng,alt,speed,hdg,sats,hdop`;
    const csvContent = header + '\n' + csvRowsRef.current.join('\n') + '\n';
    await FileSystem.writeAsStringAsync(csvPath, csvContent);
    csvRowsRef.current = [];

    setIsRecording(false);
    setHasFix(false);

    // Increment session
    const savedNum = sessionNumRef.current;
    sessionNumRef.current = savedNum + 1;
    setSessionNum(savedNum + 1);

    // Offer to share
    const videoPath = dir + 'trail_video.mp4';
    const videoExists = (await FileSystem.getInfoAsync(videoPath)).exists;

    Alert.alert(
      'Session Saved',
      `Session ${savedNum} recorded.`,
      [
        { text: 'OK' },
        {
          text: 'Share CSV',
          onPress: () => Sharing.shareAsync(csvPath),
        },
        ...(videoExists ? [{
          text: 'Share Video',
          onPress: () => Sharing.shareAsync(videoPath),
        }] : []),
      ]
    );
  }, []);

  // ── Toggle ──

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // ── Load session list ──

  const loadSessions = useCallback(async () => {
    await ensureSessionRoot();
    const found = [];
    for (let i = 0; i < 100; i++) {
      const dir = sessionDir(i);
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        const videoExists = (await FileSystem.getInfoAsync(dir + 'trail_video.mp4')).exists;
        const csvExists = (await FileSystem.getInfoAsync(dir + 'trail_data.csv')).exists;
        if (videoExists || csvExists) {
          found.push({ num: i, dir, hasVideo: videoExists, hasCSV: csvExists });
        }
      }
    }
    setSessions(found);
    setShowSessions(true);
  }, []);

  // ── Format time ──

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ── Permission screens ──

  if (!cameraPermission) {
    return <View style={styles.container}><Text style={styles.text}>Loading...</Text></View>;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera access is required to record trail video.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestCameraPermission}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main UI ──

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Camera preview */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
      />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <View style={styles.topRow}>
          {/* GPS indicator */}
          <View style={styles.badge}>
            <View style={[styles.dot, { backgroundColor: hasFix ? '#4f4' : '#f44' }]} />
            <Text style={styles.badgeText}>{hasFix ? 'GPS' : 'No GPS'}</Text>
          </View>

          {/* Recording indicator */}
          {isRecording && (
            <View style={styles.badge}>
              <View style={[styles.dot, { backgroundColor: '#f44' }]} />
              <Text style={styles.badgeText}>
                Session {sessionNum}  {formatTime(elapsed)}
              </Text>
            </View>
          )}

          {/* Sessions button */}
          <TouchableOpacity style={styles.badge} onPress={loadSessions}>
            <Text style={styles.badgeText}>Sessions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomBar}>
        {/* GPS coords */}
        {coords && (
          <Text style={styles.coordsText}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        )}

        {/* Record button */}
        <TouchableOpacity style={styles.recordBtnOuter} onPress={toggleRecording}>
          {isRecording ? (
            <View style={styles.stopSquare} />
          ) : (
            <View style={styles.recordCircle} />
          )}
        </TouchableOpacity>
      </SafeAreaView>

      {/* Session list modal */}
      <Modal visible={showSessions} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recorded Sessions</Text>
            <TouchableOpacity onPress={() => setShowSessions(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={sessions}
            keyExtractor={(item) => String(item.num)}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No sessions recorded yet.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.sessionRow}>
                <Text style={styles.sessionLabel}>Session {item.num}</Text>
                <View style={styles.sessionBtns}>
                  {item.hasCSV && (
                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={() => Sharing.shareAsync(item.dir + 'trail_data.csv')}
                    >
                      <Text style={styles.shareBtnText}>Share CSV</Text>
                    </TouchableOpacity>
                  )}
                  {item.hasVideo && (
                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={() => Sharing.shareAsync(item.dir + 'trail_video.mp4')}
                    >
                      <Text style={styles.shareBtnText}>Share Video</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  permBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  permBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20,
  },
  coordsText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  recordBtnOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f44',
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#f44',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#111',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sessionLabel: {
    color: '#fff',
    fontSize: 16,
  },
  sessionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  shareBtn: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
