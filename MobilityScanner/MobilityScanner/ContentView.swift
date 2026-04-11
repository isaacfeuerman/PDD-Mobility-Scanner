import SwiftUI
import AVFoundation

// MARK: - Camera preview (UIKit wrapper)

struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        context.coordinator.previewLayer = layer
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.previewLayer?.frame = uiView.bounds
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var previewLayer: AVCaptureVideoPreviewLayer?
    }
}

// MARK: - Main view

struct ContentView: View {
    @ObservedObject var recorder: RecordingManager
    @ObservedObject var location: LocationManager
    @State private var showExport = false
    @State private var showSessions = false
    @State private var exportItems: [Any] = []

    var body: some View {
        ZStack {
            // Camera preview fills the screen
            if recorder.cameraAuthorized {
                CameraPreview(session: recorder.captureSession)
                    .ignoresSafeArea()
            } else {
                Color.black.ignoresSafeArea()
                Text("Camera access required.\nGo to Settings to enable.")
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
            }

            // Overlay controls
            VStack {
                // Top status bar
                HStack {
                    // GPS indicator
                    HStack(spacing: 4) {
                        Circle()
                            .fill(location.hasFix ? .green : .red)
                            .frame(width: 10, height: 10)
                        Text(location.hasFix ? "GPS" : "No GPS")
                            .font(.caption)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.black.opacity(0.6))
                    .cornerRadius(8)

                    Spacer()

                    // Session + elapsed time
                    if recorder.isRecording {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(.red)
                                .frame(width: 8, height: 8)
                            Text("Session \(recorder.sessionNumber)")
                                .font(.caption.bold())
                            Text(formatTime(recorder.elapsedSeconds))
                                .font(.caption.monospacedDigit())
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(.black.opacity(0.6))
                        .cornerRadius(8)
                    }

                    Spacer()

                    // Sessions list button
                    Button {
                        showSessions = true
                    } label: {
                        Image(systemName: "folder")
                            .font(.title3)
                            .padding(8)
                            .background(.black.opacity(0.6))
                            .cornerRadius(8)
                    }
                }
                .foregroundColor(.white)
                .padding(.horizontal)
                .padding(.top, 8)

                Spacer()

                // GPS coordinates
                if let loc = location.lastLocation {
                    Text(String(format: "%.5f, %.5f", loc.coordinate.latitude, loc.coordinate.longitude))
                        .font(.caption.monospacedDigit())
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(.black.opacity(0.5))
                        .cornerRadius(6)
                }

                // Error message
                if let err = recorder.errorMessage {
                    Text(err)
                        .font(.caption)
                        .foregroundColor(.yellow)
                        .padding(8)
                        .background(.black.opacity(0.7))
                        .cornerRadius(8)
                }

                // Record / Stop button
                HStack {
                    Spacer()

                    Button(action: toggleRecording) {
                        ZStack {
                            Circle()
                                .stroke(.white, lineWidth: 4)
                                .frame(width: 72, height: 72)
                            if recorder.isRecording {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(.red)
                                    .frame(width: 28, height: 28)
                            } else {
                                Circle()
                                    .fill(.red)
                                    .frame(width: 58, height: 58)
                            }
                        }
                    }

                    Spacer()
                }
                .padding(.bottom, 30)
            }
        }
        .onAppear {
            location.requestPermission()
        }
        .sheet(isPresented: $showExport) {
            ActivityView(items: exportItems)
        }
        .sheet(isPresented: $showSessions) {
            SessionListView(recorder: recorder)
        }
    }

    private func toggleRecording() {
        if recorder.isRecording {
            recorder.stopRecording()
            location.stopUpdating()

            // Offer export after a short delay for file finalization
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                let files = recorder.sessionFiles()
                if !files.isEmpty {
                    exportItems = files
                    showExport = true
                }
            }
        } else {
            recorder.startRecording()
            location.startUpdating()
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}

// MARK: - Share sheet

struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Session list for exporting past sessions

struct SessionListView: View {
    @ObservedObject var recorder: RecordingManager
    @Environment(\.dismiss) var dismiss
    @State private var exportItems: [Any] = []
    @State private var showExport = false

    var body: some View {
        NavigationView {
            List {
                let sessions = recorder.allSessions()
                if sessions.isEmpty {
                    Text("No recorded sessions yet.")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(sessions, id: \.number) { session in
                        Button {
                            var items: [URL] = []
                            if let v = session.video { items.append(v) }
                            if let c = session.csv { items.append(c) }
                            exportItems = items
                            showExport = true
                        } label: {
                            HStack {
                                Image(systemName: "film")
                                Text("Session \(session.number)")
                                Spacer()
                                Image(systemName: "square.and.arrow.up")
                                    .foregroundColor(.blue)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Sessions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showExport) {
                ActivityView(items: exportItems)
            }
        }
    }
}
