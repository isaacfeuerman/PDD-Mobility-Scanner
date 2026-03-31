#include <TinyGPS++.h>

TinyGPSPlus gps;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial1.begin(9600);
  Serial.println("=== GPS Debug Sketch ===");
  Serial.println("Checking Serial1 @ 9600 baud...");
  Serial.println();
}

void loop() {
  // Read everything available from GPS module
  while (Serial1.available()) {
    char c = Serial1.read();
    Serial.write(c);  // Echo raw NMEA to serial monitor
    gps.encode(c);
  }

  // Every 5 seconds, print a status summary
  static unsigned long lastReport = 0;
  if (millis() - lastReport >= 5000) {
    lastReport = millis();

    Serial.println();
    Serial.println("--- GPS Status ---");
    Serial.print("Chars received:  "); Serial.println(gps.charsProcessed());
    Serial.print("Sentences (OK):  "); Serial.println(gps.sentencesWithFix());
    Serial.print("Sentences (bad): "); Serial.println(gps.failedChecksum());
    Serial.print("Satellites:      "); Serial.println(gps.satellites.value());

    if (gps.location.isValid()) {
      Serial.print("Lat: "); Serial.println(gps.location.lat(), 6);
      Serial.print("Lng: "); Serial.println(gps.location.lng(), 6);
      Serial.print("Alt: "); Serial.print(gps.altitude.meters(), 1); Serial.println(" m");
      Serial.print("Speed: "); Serial.print(gps.speed.kmph(), 1); Serial.println(" km/h");
      Serial.print("HDOP: "); Serial.println(gps.hdop.hdop(), 1);
    } else {
      Serial.println("Location: NO FIX");
    }

    if (gps.date.isValid() && gps.time.isValid()) {
      Serial.printf("UTC: %04d-%02d-%02d %02d:%02d:%02d\n",
        gps.date.year(), gps.date.month(), gps.date.day(),
        gps.time.hour(), gps.time.minute(), gps.time.second());
    }

    Serial.println("------------------");
    Serial.println();

    // Diagnosis hints
    if (gps.charsProcessed() == 0) {
      Serial.println("!! No data from GPS. Check:");
      Serial.println("   - GPS TX -> Serial1 RX wiring");
      Serial.println("   - GPS module power (3.3V)");
      Serial.println("   - Baud rate (try 4800 if 9600 doesn't work)");
    } else if (gps.failedChecksum() > gps.sentencesWithFix()) {
      Serial.println("!! Many bad checksums. Check:");
      Serial.println("   - Wiring (loose connection?)");
      Serial.println("   - Baud rate mismatch");
    } else if (!gps.location.isValid()) {
      Serial.println(">> GPS is talking but no fix yet.");
      Serial.println("   Move to open sky and wait 1-3 min.");
    }

    Serial.println();
  }
}
