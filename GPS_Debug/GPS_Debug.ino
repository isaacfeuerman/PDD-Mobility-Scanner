#include <TinyGPS++.h>

TinyGPSPlus gps;
uint32_t goodSentences = 0;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial1.begin(9600);
  Serial.println("=== GPS Debug Sketch ===");
  Serial.println("Checking Serial1 @ 9600 baud...");
  Serial.println();
}

void loop() {
  while (Serial1.available()) {
    char c = Serial1.read();
    Serial.write(c);  // Echo raw NMEA
    if (gps.encode(c)) {
      goodSentences++;
    }
  }

  static unsigned long lastReport = 0;
  if (millis() - lastReport >= 5000) {
    lastReport = millis();

    Serial.println();
    Serial.println("--- GPS Status ---");
    Serial.print("Chars received:    "); Serial.println(gps.charsProcessed());
    Serial.print("Sentences parsed:  "); Serial.println(goodSentences);
    Serial.print("Sentences w/ fix:  "); Serial.println(gps.sentencesWithFix());
    Serial.print("Bad checksums:     "); Serial.println(gps.failedChecksum());
    Serial.print("Satellites:        "); Serial.println(gps.satellites.value());

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
      char ts[32];
      sprintf(ts, "%04d-%02d-%02d %02d:%02d:%02d",
        gps.date.year(), gps.date.month(), gps.date.day(),
        gps.time.hour(), gps.time.minute(), gps.time.second());
      Serial.print("UTC: "); Serial.println(ts);
    }

    Serial.println("------------------");

    if (gps.charsProcessed() == 0) {
      Serial.println("!! No data from GPS module.");
    } else if (goodSentences == 0) {
      Serial.println("!! Chars arriving but no valid sentences.");
      Serial.println("   Check baud rate or wiring.");
    } else if (!gps.location.isValid()) {
      Serial.println(">> GPS parsing OK, just no satellite fix.");
      Serial.println("   Move outside with clear sky view.");
    }

    Serial.println();
  }
}
