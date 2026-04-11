import AVFoundation
import CoreLocation
import UIKit

/// Manages video recording at 2 FPS via AVAssetWriter and CSV writing,
/// synced by a shared rec_start_ms timestamp (Unix epoch milliseconds).
class RecordingManager: NSObject, ObservableObject {
    // MARK: - Published state
    @Published var isRecording = false
    @Published var sessionNumber = 0
    @Published var elapsedSeconds: Int = 0
    @Published var errorMessage: String?
    @Published var cameraAuthorized = false

    // MARK: - AV capture pipeline
    let captureSession = AVCaptureSession()
    private var videoDataOutput = AVCaptureVideoDataOutput()
    private var videoDevice: AVCaptureDevice?
    private let sessionQueue = DispatchQueue(label: "com.pdd.camera", qos: .userInitiated)

    // MARK: - AVAssetWriter (for H.264 MP4)
    private var assetWriter: AVAssetWriter?
    private var writerInput: AVAssetWriterInput?
    private var writerStarted = false

    // MARK: - Session paths
    private var sessionDir: URL?
    private var videoURL: URL?
    private var csvURL: URL?
    private var csvHandle: FileHandle?

    // MARK: - Timing
    private var recStartMs: Int64 = 0
    private var elapsedTimer: Timer?

    // MARK: - GPS buffer (written by LocationManager, read here)
    var latestLocation: CLLocation?

    // MARK: - Init

    override init() {
        super.init()
        checkAuthorization()
    }

    // MARK: - Camera authorization

    func checkAuthorization() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            cameraAuthorized = true
            setupSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    self?.cameraAuthorized = granted
                    if granted { self?.setupSession() }
                }
            }
        default:
            cameraAuthorized = false
        }
    }

    // MARK: - Capture session setup

    private func setupSession() {
        captureSession.beginConfiguration()
        captureSession.sessionPreset = .hd1920x1080

        // Video input
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            DispatchQueue.main.async { self.errorMessage = "No back camera found." }
            captureSession.commitConfiguration()
            return
        }
        videoDevice = device

        do {
            let input = try AVCaptureDeviceInput(device: device)
            if captureSession.canAddInput(input) {
                captureSession.addInput(input)
            }
        } catch {
            DispatchQueue.main.async { self.errorMessage = "Camera input error: \(error.localizedDescription)" }
            captureSession.commitConfiguration()
            return
        }

        // Set 2 FPS AFTER adding input (addInput can reset format)
        do {
            try device.lockForConfiguration()
            device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 2)
            device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 2)
            device.unlockForConfiguration()
        } catch {
            DispatchQueue.main.async { self.errorMessage = "Cannot configure 2 FPS: \(error.localizedDescription)" }
        }

        // Video data output — we write frames to AVAssetWriter ourselves
        videoDataOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        ]
        videoDataOutput.setSampleBufferDelegate(self, queue: sessionQueue)
        videoDataOutput.alwaysDiscardsLateVideoFrames = true

        if captureSession.canAddOutput(videoDataOutput) {
            captureSession.addOutput(videoDataOutput)
        }

        captureSession.commitConfiguration()

        sessionQueue.async {
            self.captureSession.startRunning()
        }
    }

    // MARK: - Start recording

    func startRecording() {
        guard cameraAuthorized else {
            errorMessage = "Camera not authorized."
            return
        }

        // Create session directory
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dirName = String(format: "session_%02d", sessionNumber)
        let dir = docs.appendingPathComponent(dirName)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        sessionDir = dir

        // Paths
        videoURL = dir.appendingPathComponent("trail_video.mp4")
        csvURL = dir.appendingPathComponent("trail_data.csv")

        // Remove old files if re-recording same session number
        if let v = videoURL { try? FileManager.default.removeItem(at: v) }
        if let c = csvURL { try? FileManager.default.removeItem(at: c) }

        // Record start timestamp (Unix epoch milliseconds)
        recStartMs = Int64(Date().timeIntervalSince1970 * 1000)

        // Write CSV header — matches format expected by video_object_detection.ipynb
        if let c = csvURL {
            let header = "# rec_start_ms=\(recStartMs)\nms,utc,lat,lng,alt,speed,hdg,sats,hdop\n"
            try? header.write(to: c, atomically: true, encoding: .utf8)
            csvHandle = try? FileHandle(forWritingTo: c)
            csvHandle?.seekToEndOfFile()
        }

        // Set up AVAssetWriter for H.264 MP4
        guard let v = videoURL else { return }
        do {
            let writer = try AVAssetWriter(outputURL: v, fileType: .mp4)

            let videoSettings: [String: Any] = [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: 1920,
                AVVideoHeightKey: 1080,
                AVVideoCompressionPropertiesKey: [
                    AVVideoAverageBitRateKey: 1_000_000,
                    AVVideoExpectedSourceFrameRateKey: 2
                ]
            ]

            let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
            input.expectsMediaDataInRealTime = true
            writer.add(input)

            assetWriter = writer
            writerInput = input
            writerStarted = false

            writer.startWriting()
        } catch {
            DispatchQueue.main.async { self.errorMessage = "Writer error: \(error.localizedDescription)" }
            return
        }

        isRecording = true
        elapsedSeconds = 0
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.elapsedSeconds += 1
        }
    }

    // MARK: - Stop recording

    func stopRecording() {
        isRecording = false

        elapsedTimer?.invalidate()
        elapsedTimer = nil

        csvHandle?.closeFile()
        csvHandle = nil

        // Finalize MP4 on the session queue
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            self.writerInput?.markAsFinished()
            self.assetWriter?.finishWriting {
                DispatchQueue.main.async {
                    if let err = self.assetWriter?.error {
                        self.errorMessage = "MP4 finalize error: \(err.localizedDescription)"
                    }
                    self.assetWriter = nil
                    self.writerInput = nil
                    self.sessionNumber += 1
                    print("Session saved.")
                }
            }
        }
    }

    // MARK: - Write a GPS row to CSV

    /// Called by LocationManager each time a new GPS fix arrives (~1 Hz).
    func writeGPSRow(location: CLLocation) {
        guard isRecording, let handle = csvHandle else { return }

        let nowMs = Int64(location.timestamp.timeIntervalSince1970 * 1000)

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let utc = formatter.string(from: location.timestamp)

        let lat = location.coordinate.latitude
        let lng = location.coordinate.longitude
        let alt = location.altitude
        let speed = max(location.speed, 0)
        let hdg = location.course >= 0 ? location.course : 0.0

        // sats and hdop not available from CoreLocation — leave empty
        let row = "\(nowMs),\(utc),\(lat),\(lng),\(alt),\(speed),\(hdg),,\n"

        if let data = row.data(using: .utf8) {
            handle.write(data)
        }
    }

    // MARK: - Export files

    func sessionFiles() -> [URL] {
        var files: [URL] = []
        if let v = videoURL, FileManager.default.fileExists(atPath: v.path) { files.append(v) }
        if let c = csvURL, FileManager.default.fileExists(atPath: c.path) { files.append(c) }
        return files
    }

    func allSessions() -> [(number: Int, dir: URL, video: URL?, csv: URL?)] {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        var sessions: [(number: Int, dir: URL, video: URL?, csv: URL?)] = []

        for i in 0..<100 {
            let dirName = String(format: "session_%02d", i)
            let dir = docs.appendingPathComponent(dirName)
            let video = dir.appendingPathComponent("trail_video.mp4")
            let csv = dir.appendingPathComponent("trail_data.csv")
            let hasVideo = FileManager.default.fileExists(atPath: video.path)
            let hasCSV = FileManager.default.fileExists(atPath: csv.path)
            if hasVideo || hasCSV {
                sessions.append((i, dir, hasVideo ? video : nil, hasCSV ? csv : nil))
            }
        }
        return sessions
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

extension RecordingManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard isRecording,
              let writer = assetWriter, writer.status == .writing,
              let input = writerInput, input.isReadyForMoreMediaData else { return }

        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

        // Start the writer session on the first frame
        if !writerStarted {
            writer.startSession(atSourceTime: timestamp)
            writerStarted = true
        }

        input.append(sampleBuffer)
    }
}
