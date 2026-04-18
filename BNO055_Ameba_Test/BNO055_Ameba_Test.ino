/*
  BNO055 I2C Test Sketch for AMB82-mini (Ameba Pro2)

  Uses only the Wire library - no Adafruit_BNO055 / Adafruit_BusIO.
  This avoids the 'portOutputRegister' / 'portInputRegister' compile
  errors the Adafruit stack throws on the Realtek Ameba core.

  Purpose:
    - Report which pins the Wire library is using for SDA and SCL.
    - Scan the I2C bus and announce every responding address.
    - Flag when the BNO055 (0x28 or 0x29) is found.
    - Verify the BNO055 CHIP_ID (0xA0) over I2C.
    - Stream raw Euler angles (heading, roll, pitch) and temperature.

  How to use:
    1. Wire the BNO055 to the AMB82-mini:
         VIN -> 3V3
         GND -> GND
         SDA -> SDA pin (printed at startup)
         SCL -> SCL pin (printed at startup)
    2. Open the Serial Monitor at 115200 baud.
    3. On boot, the sketch prints the SDA/SCL pin numbers it is using.
    4. Swap your wires between board pins. Whichever pair prints
       "BNO055 FOUND" is the working SDA/SCL combination.
*/

#include <Wire.h>

// BNO055 I2C addresses. Default is 0x28; tie ADR high for 0x29.
#define BNO055_ADDR_PRIMARY   0x28
#define BNO055_ADDR_SECONDARY 0x29

// BNO055 register map (subset)
#define BNO055_CHIP_ID_ADDR       0x00
#define BNO055_CHIP_ID_EXPECTED   0xA0
#define BNO055_PAGE_ID_ADDR       0x07
#define BNO055_OPR_MODE_ADDR      0x3D
#define BNO055_PWR_MODE_ADDR      0x3E
#define BNO055_SYS_TRIGGER_ADDR   0x3F
#define BNO055_UNIT_SEL_ADDR      0x3B
#define BNO055_TEMP_ADDR          0x34
#define BNO055_EULER_H_LSB_ADDR   0x1A

// Operating modes
#define OPR_MODE_CONFIG  0x00
#define OPR_MODE_NDOF    0x0C

// ----- Pin reporting helpers -----
#ifndef SDA
#define SDA (-1)
#endif
#ifndef SCL
#define SCL (-1)
#endif

uint8_t bnoAddress = BNO055_ADDR_PRIMARY;
bool    bnoReady   = false;

// ---------- Low-level I2C helpers ----------
bool writeReg(uint8_t addr, uint8_t reg, uint8_t value)
{
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.write(value);
    return (Wire.endTransmission() == 0);
}

bool readRegs(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t len)
{
    Wire.beginTransmission(addr);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) return false;

    uint8_t n = Wire.requestFrom((int)addr, (int)len);
    if (n != len) return false;
    for (uint8_t i = 0; i < len; i++) buf[i] = Wire.read();
    return true;
}

bool readReg(uint8_t addr, uint8_t reg, uint8_t &value)
{
    return readRegs(addr, reg, &value, 1);
}

// ---------- BNO055 init ----------
bool bnoBegin(uint8_t addr)
{
    uint8_t id = 0;
    if (!readReg(addr, BNO055_CHIP_ID_ADDR, id)) return false;
    if (id != BNO055_CHIP_ID_EXPECTED) {
        Serial.print(F("  Got CHIP_ID 0x"));
        Serial.print(id, HEX);
        Serial.print(F(" expected 0x"));
        Serial.println(BNO055_CHIP_ID_EXPECTED, HEX);
        return false;
    }

    // CONFIG mode
    if (!writeReg(addr, BNO055_OPR_MODE_ADDR, OPR_MODE_CONFIG)) return false;
    delay(25);

    // Reset
    writeReg(addr, BNO055_SYS_TRIGGER_ADDR, 0x20);
    delay(650);
    // Wait for CHIP_ID to come back after reset.
    for (uint8_t i = 0; i < 20; i++) {
        if (readReg(addr, BNO055_CHIP_ID_ADDR, id) && id == BNO055_CHIP_ID_EXPECTED) break;
        delay(50);
    }
    delay(50);

    // Normal power mode
    writeReg(addr, BNO055_PWR_MODE_ADDR, 0x00);
    delay(10);
    writeReg(addr, BNO055_PAGE_ID_ADDR, 0x00);
    writeReg(addr, BNO055_SYS_TRIGGER_ADDR, 0x00);
    delay(10);

    // NDOF fusion mode (full orientation)
    if (!writeReg(addr, BNO055_OPR_MODE_ADDR, OPR_MODE_NDOF)) return false;
    delay(25);
    return true;
}

bool bnoReadEuler(uint8_t addr, float &heading, float &roll, float &pitch)
{
    uint8_t buf[6];
    if (!readRegs(addr, BNO055_EULER_H_LSB_ADDR, buf, 6)) return false;
    int16_t h = (int16_t)((uint16_t)buf[0] | ((uint16_t)buf[1] << 8));
    int16_t r = (int16_t)((uint16_t)buf[2] | ((uint16_t)buf[3] << 8));
    int16_t p = (int16_t)((uint16_t)buf[4] | ((uint16_t)buf[5] << 8));
    // 1 degree = 16 LSB by default
    heading = h / 16.0f;
    roll    = r / 16.0f;
    pitch   = p / 16.0f;
    return true;
}

bool bnoReadTemp(uint8_t addr, int8_t &tempC)
{
    uint8_t t;
    if (!readReg(addr, BNO055_TEMP_ADDR, t)) return false;
    tempC = (int8_t)t;
    return true;
}

// ---------- Pretty-printers ----------
void printActivePins()
{
    Serial.println(F("----- I2C pin configuration -----"));
    Serial.print(F("Wire SDA pin (core macro): "));
    Serial.println(SDA);
    Serial.print(F("Wire SCL pin (core macro): "));
    Serial.println(SCL);
    Serial.println(F("If those read -1, use the board silkscreen labels."));
    Serial.println(F("---------------------------------"));
}

void i2cScan()
{
    int nDevices = 0;
    Serial.println(F("Scanning I2C bus..."));
    for (uint8_t address = 1; address < 127; address++) {
        Wire.beginTransmission(address);
        uint8_t error = Wire.endTransmission();
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

    Serial.println(F("Probing BNO055 at 0x28..."));
    if (bnoBegin(BNO055_ADDR_PRIMARY)) {
        bnoAddress = BNO055_ADDR_PRIMARY;
        bnoReady = true;
    } else {
        Serial.println(F("  0x28 did not respond. Trying 0x29..."));
        if (bnoBegin(BNO055_ADDR_SECONDARY)) {
            bnoAddress = BNO055_ADDR_SECONDARY;
            bnoReady = true;
        }
    }

    if (bnoReady) {
        Serial.print(F("BNO055 FOUND at 0x"));
        Serial.println(bnoAddress, HEX);
        Serial.println(F("The SDA/SCL wires are on the correct pins."));
    } else {
        Serial.println(F("ERROR: BNO055 not detected."));
        Serial.println(F("  - Check VIN/GND."));
        Serial.println(F("  - Check that SDA/SCL are on the pins printed above."));
        Serial.println(F("  - Swap your two signal wires and reset."));
    }

    Serial.println(F("====================================="));
    delay(500);
}

void loop()
{
    // Re-scan every loop so the user can hot-swap wires and watch the result.
    i2cScan();

    if (bnoReady) {
        float heading, roll, pitch;
        if (bnoReadEuler(bnoAddress, heading, roll, pitch)) {
            Serial.print(F("Euler -> Heading: "));
            Serial.print(heading, 2);
            Serial.print(F("  Roll: "));
            Serial.print(roll, 2);
            Serial.print(F("  Pitch: "));
            Serial.println(pitch, 2);
        } else {
            Serial.println(F("BNO055 read failed (wires may be disconnected)."));
        }

        int8_t tempC;
        if (bnoReadTemp(bnoAddress, tempC)) {
            Serial.print(F("Temperature: "));
            Serial.print(tempC);
            Serial.println(F(" C"));
        }
    } else {
        // Try to bring it up live so the user can plug wires in without resetting.
        if (bnoBegin(BNO055_ADDR_PRIMARY)) {
            bnoAddress = BNO055_ADDR_PRIMARY; bnoReady = true;
        } else if (bnoBegin(BNO055_ADDR_SECONDARY)) {
            bnoAddress = BNO055_ADDR_SECONDARY; bnoReady = true;
        }
        if (bnoReady) {
            Serial.print(F("BNO055 just came online at 0x"));
            Serial.println(bnoAddress, HEX);
        }
    }

    Serial.println(F("-------------------------------------"));
    delay(2000);
}
