import CoreLocation
import Combine

/// Manages CoreLocation GPS updates and feeds them to RecordingManager's CSV.
class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var authorized = false
    @Published var lastLocation: CLLocation?
    @Published var hasFix = false

    private let manager = CLLocationManager()
    weak var recordingManager: RecordingManager?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
        manager.allowsBackgroundLocationUpdates = false
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func startUpdating() {
        manager.startUpdatingLocation()
    }

    func stopUpdating() {
        manager.stopUpdatingLocation()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            authorized = true
            manager.startUpdatingLocation()
        case .notDetermined:
            authorized = false
        default:
            authorized = false
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        // Filter out stale or inaccurate fixes
        let age = -location.timestamp.timeIntervalSinceNow
        guard age < 5, location.horizontalAccuracy >= 0, location.horizontalAccuracy < 50 else { return }

        DispatchQueue.main.async {
            self.lastLocation = location
            self.hasFix = true
        }

        // Feed to recording manager for CSV logging
        recordingManager?.latestLocation = location
        recordingManager?.writeGPSRow(location: location)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error.localizedDescription)")
    }
}
