/*
  BNO055 I2C Test Sketch for AMB82-mini (Ameba Pro2)

  Uses only the Wire library - no Adafruit_BNO055 / Adafruit_BusIO.

  NOTE on scanning:
    The Ameba Pro2 core's Wire.endTransmission() does NOT reliably
    report NACKs. A classic address scan therefore reports "126
    devices found" on this board, which is meaningless. Instead
    this sketch *probes* by actually reading the BNO055 CHIP_ID
    register at 0x28 and 0x29 and checking the returned byte is
    0xA0. If we get no bytes, 0x00, or 0xFF, the wires are wrong.

  How to use:
    1. Wire the BNO055 to the AMB82-mini:
         VIN -> 3V3
         GND -> GND
         SDA -> one of the GPIO pins
         SCL -> another GPIO pin
    2. Open the Serial Monitor at 115200 baud.
    3. On boot, the sketch prints the Wire pin numbers it is using
       and the raw CHIP_ID byte it reads at 0x28/0x29.
    4. Swap the two signal wires between board pins until the
       readout prints "CHIP_ID = 0xA0  -> BNO055 confirmed".
       That pair is your real SDA/SCL.
*/

#include <Wire.h>

#define BNO055_ADDR_PRIMARY   0x28
#define BNO055_ADDR_SECONDARY 0x29

// BNO055 register map (subset)
#define BNO055_CHIP_ID_ADDR       0x00
#define BNO055_CHIP_ID_EXPECTED   0xA0
#define BNO055_PAGE_ID_ADDR       0x07
#define BNO055_OPR_MODE_ADDR      0x3D
#define BNO055_PWR_MODE_ADDR      0x3E
#define BNO055_SYS_TRIGGER_ADDR   0x3F
#define BNO055_TEMP_ADDR          0x34
#define BNO055_EULER_H_LSB_ADDR   0x1A

#define OPR_MODE_CONFIG  0x00
#define OPR_MODE_NDOF    0x0C

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
    // We ignore the return value on Ameba because it lies about ACK status.
    Wire.endTransmission();
    return true;
}

// Returns the number of bytes actually read (0 if device is not responding).
uint8_t readRegsRaw(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t len)
{
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.endTransmission(false);

    uint8_t n = Wire.requestFrom((int)addr, (int)len);
    uint8_t got = 0;
    while (Wire.available() && got < len) {
        buf[got++] = Wire.read();
    }
    // Drain any leftovers.
    while (Wire.available()) Wire.read();
    // Zero-fill missing bytes so caller sees a stable value.
    for (uint8_t i = got; i < len; i++) buf[i] = 0;
    return got;
}

bool readReg(uint8_t addr, uint8_t reg, uint8_t &value)
{
    uint8_t v = 0xFF;
    uint8_t n = readRegsRaw(addr, reg, &v, 1);
    value = v;
    return (n == 1);
}

// ---------- BNO055 driver ----------
// Probe: read CHIP_ID and return the raw byte actually received.
// Sets gotByte=true if Wire returned at least one byte.
uint8_t probeChipId(uint8_t addr, bool &gotByte)
{
    uint8_t v = 0;
    uint8_t n = readRegsRaw(addr, BNO055_CHIP_ID_ADDR, &v, 1);
    gotByte = (n == 1);
    return v;
}

bool bnoBegin(uint8_t addr)
{
    bool gotByte = false;
    uint8_t id = probeChipId(addr, gotByte);
    if (!gotByte || id != BNO055_CHIP_ID_EXPECTED) return false;

    writeReg(addr, BNO055_OPR_MODE_ADDR, OPR_MODE_CONFIG);
    delay(25);

    writeReg(addr, BNO055_SYS_TRIGGER_ADDR, 0x20);     // reset
    delay(650);
    for (uint8_t i = 0; i < 20; i++) {
        if (readReg(addr, BNO055_CHIP_ID_ADDR, id) && id == BNO055_CHIP_ID_EXPECTED) break;
        delay(50);
    }
    delay(50);

    writeReg(addr, BNO055_PWR_MODE_ADDR, 0x00);
    delay(10);
    writeReg(addr, BNO055_PAGE_ID_ADDR, 0x00);
    writeReg(addr, BNO055_SYS_TRIGGER_ADDR, 0x00);
    delay(10);

    writeReg(addr, BNO055_OPR_MODE_ADDR, OPR_MODE_NDOF);
    delay(25);
    return true;
}

bool bnoReadEuler(uint8_t addr, float &heading, float &roll, float &pitch)
{
    uint8_t buf[6] = {0};
    if (readRegsRaw(addr, BNO055_EULER_H_LSB_ADDR, buf, 6) != 6) return false;
    int16_t h = (int16_t)((uint16_t)buf[0] | ((uint16_t)buf[1] << 8));
    int16_t r = (int16_t)((uint16_t)buf[2] | ((uint16_t)buf[3] << 8));
    int16_t p = (int16_t)((uint16_t)buf[4] | ((uint16_t)buf[5] << 8));
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

// ---------- Reporting ----------
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

void printProbe(uint8_t addr)
{
    bool gotByte = false;
    uint8_t id = probeChipId(addr, gotByte);
    Serial.print(F("Probe 0x"));
    Serial.print(addr, HEX);
    Serial.print(F(": "));
    if (!gotByte) {
        Serial.println(F("no bytes received -> wires NOT connected / wrong pins"));
        return;
    }
    Serial.print(F("CHIP_ID = 0x"));
    if (id < 16) Serial.print(F("0"));
    Serial.print(id, HEX);
    if (id == BNO055_CHIP_ID_EXPECTED) {
        Serial.println(F("  -> BNO055 confirmed (SDA/SCL are correct)"));
    } else if (id == 0x00 || id == 0xFF) {
        Serial.println(F("  -> line is floating/stuck; SDA/SCL are NOT correct"));
    } else {
        Serial.println(F("  -> unexpected ID; not a BNO055 on this address"));
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

    printProbe(BNO055_ADDR_PRIMARY);
    printProbe(BNO055_ADDR_SECONDARY);

    if (bnoBegin(BNO055_ADDR_PRIMARY)) {
        bnoAddress = BNO055_ADDR_PRIMARY;
        bnoReady = true;
    } else if (bnoBegin(BNO055_ADDR_SECONDARY)) {
        bnoAddress = BNO055_ADDR_SECONDARY;
        bnoReady = true;
    }

    if (bnoReady) {
        Serial.print(F("BNO055 initialized at 0x"));
        Serial.println(bnoAddress, HEX);
    } else {
        Serial.println(F("BNO055 not initialized. Swap your SDA/SCL wires and try again."));
    }

    Serial.println(F("====================================="));
    delay(500);
}

void loop()
{
    // Probe on every loop so you can hot-swap wires and watch results.
    printProbe(BNO055_ADDR_PRIMARY);
    printProbe(BNO055_ADDR_SECONDARY);

    if (!bnoReady) {
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
            bnoReady = false;
        }

        int8_t tempC;
        if (bnoReadTemp(bnoAddress, tempC)) {
            Serial.print(F("Temperature: "));
            Serial.print(tempC);
            Serial.println(F(" C"));
        }
    }

    Serial.println(F("-------------------------------------"));
    delay(2000);
}
