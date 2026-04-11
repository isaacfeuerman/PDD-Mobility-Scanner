import SwiftUI

@main
struct MobilityScannerApp: App {
    @StateObject private var recorder = RecordingManager()
    @StateObject private var location = LocationManager()

    var body: some Scene {
        WindowGroup {
            ContentView(recorder: recorder, location: location)
                .onAppear {
                    location.recordingManager = recorder
                }
        }
    }
}
