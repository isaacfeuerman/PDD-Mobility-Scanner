/*
  BNO055 I2C Test Sketch for AMB82-mini (Ameba Pro2)

  Purpose:
    - Report which pins the Wire library is using for SDA and SCL.
    - Scan the I2C bus and announce every responding address.
    - Flag when the BNO055 (0x28 or 0x29) is found.
    - Read + print orientation data so you can confirm live communication.

  How to use:
    1. Wire the BNO055 to the AMB82-mini:
         VIN -> 3V3
         GND -> GND
         SDA -> SDA pin (see default below / printed at startup)
         SCL -> SCL pin (see default below / printed at startup)
    2. Open the Serial Monitor at 115200 baud.
    3. On boot, the sketch prints the SDA/SCL pin numbers it is using.
    4. Swap your wires between board pins. Whichever pair returns
       "BNO055 FOUND" is the working SDA/SCL combination.

  On the AMB82-mini the default Arduino Wire pins are:
    SDA = PA12  (silkscreen "SDA" / GPIO pin labelled SDA)
    SCL = PA13  (silkscreen "SCL" / GPIO pin labelled SCL)
  If your board breakout labels differ, the Serial Monitor output
  at startup is the source of truth.
*/

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BNO055.h>
#include <utility/imumaths.h>

// BNO055 default I2C address is 0x28. If ADR pin tied high it becomes 0x29.
#define BNO055_ADDR_PRIMARY   0x28
#define BNO055_ADDR_SECONDARY 0x29

// ----- Pin reporting helpers -----
// These macros are defined by the Ameba Arduino core's pins_arduino.h.
// If your core exposes a different symbol, adjust the #ifdef below.
#ifndef SDA
#define SDA (-1)
#endif
#ifndef SCL
#define SCL (-1)
#endif

Adafruit_BNO055 bno = Adafruit_BNO055(55, BNO055_ADDR_PRIMARY);

void printActivePins()
{
    Serial.println(F("----- I2C pin configuration -----"));
    Serial.print(F("Wire SDA pin (as seen by core macro): "));
    Serial.println(SDA);
    Serial.print(F("Wire SCL pin (as seen by core macro): "));
    Serial.println(SCL);
    Serial.println(F("If these read -1 your core does not expose the macro;"));
    Serial.println(F("in that case use the silkscreen labels SDA/SCL on the board."));
    Serial.println(F("---------------------------------"));
}

void i2cScan()
{
    byte error, address;
    int nDevices = 0;

    Serial.println(F("Scanning I2C bus..."));
    for (address = 1; address < 127; address++) {
        Wire.beginTransmission(address);
        error = Wire.endTransmission();

        if (error == 0) {
            Serial.print(F("  Device found at 0x"));
            if (address < 16) Serial.print(F("0"));
            Serial.print(address, HEX);
            if (address == BNO055_ADDR_PRIMARY || address == BNO055_ADDR_SECONDARY) {
                Serial.print(F("  <-- BNO055"));
            }
            Serial.println();
            nDevices++;
        }
    }
    if (nDevices == 0) {
        Serial.println(F("  No I2C devices found."));
        Serial.println(F("  --> SDA/SCL are NOT wired correctly on this pin pair."));
    } else {
        Serial.print(F("  Total devices: "));
        Serial.println(nDevices);
    }
}

void setup()
{
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println();
    Serial.println(F("=== BNO055 AMB82-mini Test Sketch ==="));
    printActivePins();

    Wire.begin();
    delay(50);

    i2cScan();

    Serial.println(F("Initializing BNO055..."));
    if (!bno.begin()) {
        Serial.println(F("ERROR: BNO055 not detected at 0x28."));
        Serial.println(F("  - Check VIN/GND."));
        Serial.println(F("  - Check that SDA/SCL are on the pins printed above."));
        Serial.println(F("  - Swap your two signal wires and reset."));
    } else {
        Serial.println(F("BNO055 FOUND and initialized."));
        Serial.println(F("The SDA/SCL wires are on the correct pins."));
        bno.setExtCrystalUse(true);
    }

    Serial.println(F("====================================="));
    delay(500);
}

void loop()
{
    // Re-scan every loop so the user can hot-swap wires and watch the result.
    i2cScan();

    sensors_event_t event;
    if (bno.getEvent(&event)) {
        Serial.print(F("Orientation -> X: "));
        Serial.print(event.orientation.x, 2);
        Serial.print(F("  Y: "));
        Serial.print(event.orientation.y, 2);
        Serial.print(F("  Z: "));
        Serial.println(event.orientation.z, 2);

        int8_t temp = bno.getTemp();
        Serial.print(F("Temperature: "));
        Serial.print(temp);
        Serial.println(F(" C"));
    } else {
        Serial.println(F("No BNO055 event (sensor not responding)."));
    }

    Serial.println(F("-------------------------------------"));
    delay(2000);
}
