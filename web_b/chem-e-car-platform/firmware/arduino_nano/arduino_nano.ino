/*
  Arduino Nano — Motor Driver + Sensor Controller
  ------------------------------------------------
  Menerima perintah start/stop dari ESP32-C3 (lewat Serial, satu baris JSON),
  menjalankan motor (mode 'race') atau diam (mode 'calibration'),
  membaca sensor, dan mengirim telemetry balik ke ESP32-C3 (satu baris JSON per sample).

  Library: ArduinoJson (Benoit Blanchon)

  INI ADALAH CONTOH DASAR. Sesuaikan:
    - Pin motor driver (contoh pakai driver 2-pin sederhana / L298N style)
    - Kalibrasi ADC ke satuan nyata (voltage divider, sensor arus, sensor suhu)
    - Sumber pembacaan jarak (di sini pakai encoder roda; ganti sesuai desain tim)
*/

#include <ArduinoJson.h>

// ---- Pin — SESUAIKAN dengan wiring tim ----
const int PIN_MOTOR_IN1   = 5;
const int PIN_MOTOR_IN2   = 6;
const int PIN_TURBIDITY   = A0;
const int PIN_VOLTAGE     = A1;
const int PIN_CURRENT     = A2;
const int PIN_TEMPERATURE = A3;
const int PIN_ENCODER     = 2;   // interrupt pin untuk hitung pulsa roda

// ---- Parameter kendaraan — SESUAIKAN sebelum lomba ----
const float WHEEL_DIAMETER_M   = 0.1016; // 4 inch
const float GEAR_RATIO         = 6.75;
const int   PULSES_PER_REV     = 20;     // sesuai encoder yang dipakai

volatile unsigned long pulseCount = 0;
void onEncoderPulse() { pulseCount++; }

// ---- State experiment ----
bool running = false;
String mode = "";           // "race" | "calibration"
unsigned long durationMs = 120000;
float turbidityThreshold = 9999;
unsigned long startedAtMs = 0;
const unsigned long SAMPLE_INTERVAL_MS = 200; // 5 sample/detik
unsigned long lastSampleMs = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_MOTOR_IN1, OUTPUT);
  pinMode(PIN_MOTOR_IN2, OUTPUT);
  pinMode(PIN_ENCODER, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ENCODER), onEncoderPulse, RISING);
  stopMotor();
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) handleCommand(line);
  }

  if (running) {
    unsigned long elapsed = millis() - startedAtMs;

    if (millis() - lastSampleMs >= SAMPLE_INTERVAL_MS) {
      lastSampleMs = millis();
      sendTelemetry(elapsed);
    }

    // Fail-safe lokal: Arduino tetap menghormati durasi maksimum meski
    // perintah stop dari backend/ESP32 terlambat/telat sampai.
    if (elapsed >= durationMs) {
      running = false;
      stopMotor();
    }
  }
}

void handleCommand(const String& line) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, line) != DeserializationError::Ok) return;

  String action = doc["action"] | "";

  if (action == "start") {
    mode = String((const char*)(doc["mode"] | "race"));
    durationMs = doc["duration_ms"] | 120000;
    turbidityThreshold = doc["turbidity_threshold"] | 9999.0;
    pulseCount = 0;
    startedAtMs = millis();
    lastSampleMs = 0;
    running = true;

    if (mode == "race") startMotor();
    // mode "calibration": motor TETAP mati, hanya mengumpulkan data sensor
  } else if (action == "stop") {
    running = false;
    stopMotor();
  }
}

void startMotor() {
  digitalWrite(PIN_MOTOR_IN1, HIGH);
  digitalWrite(PIN_MOTOR_IN2, LOW);
}

void stopMotor() {
  digitalWrite(PIN_MOTOR_IN1, LOW);
  digitalWrite(PIN_MOTOR_IN2, LOW);
}

float readDistanceMeters() {
  float wheelCircumference = PI * WHEEL_DIAMETER_M;
  float wheelRevolutions = (float)pulseCount / PULSES_PER_REV / GEAR_RATIO;
  return wheelRevolutions * wheelCircumference;
}

float readVoltage() {
  // Contoh voltage divider R1/R2 — ganti faktor kalibrasi sesuai rangkaian nyata
  int raw = analogRead(PIN_VOLTAGE);
  return (raw / 1023.0) * 5.0 * 3.0; // asumsi divider 1:3
}

float readCurrent() {
  // Contoh sensor arus tipe ACS712 (sensitivitas ~185mV/A, offset 2.5V @0A)
  int raw = analogRead(PIN_CURRENT);
  float voltage = (raw / 1023.0) * 5.0;
  return (voltage - 2.5) / 0.185;
}

float readTemperature() {
  // Contoh sensor analog (mis. LM35: 10mV/°C)
  int raw = analogRead(PIN_TEMPERATURE);
  float voltage = (raw / 1023.0) * 5.0;
  return voltage * 100.0;
}

float readTurbidity() {
  // Kalibrasi sensor turbidity analog (mis. modul TS-300B) ke satuan NTU
  // perlu kurva kalibrasi sendiri — ini hanya placeholder linear.
  int raw = analogRead(PIN_TURBIDITY);
  return map(raw, 0, 1023, 0, 3000) / 10.0;
}

void sendTelemetry(unsigned long elapsedMs) {
  StaticJsonDocument<256> doc;
  doc["elapsed_ms"]     = elapsedMs;
  doc["distance_m"]     = readDistanceMeters();
  doc["voltage_v"]      = readVoltage();
  doc["current_a"]      = readCurrent();
  doc["temperature_c"]  = readTemperature();
  doc["turbidity_ntu"]  = readTurbidity();

  char buffer[256];
  serializeJson(doc, buffer);
  Serial.println(buffer); // dibaca & diteruskan oleh ESP32-C3 ke MQTT
}
