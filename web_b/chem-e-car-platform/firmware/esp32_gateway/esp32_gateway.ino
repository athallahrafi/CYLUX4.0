/*
  ESP32-C3 Dev Kit V4 — MQTT Gateway
  ----------------------------------
  Peran device ini HANYA sebagai jembatan:
    WiFi/MQTT  <-->  ESP32-C3  <-->  Serial  <-->  Arduino Nano

  - Command dari backend (topic .../cmd) diteruskan ke Arduino Nano lewat Serial.
  - Telemetry dari Arduino Nano (dibaca lewat Serial) diteruskan ke backend lewat MQTT.
  - Mem-publish status online/offline (pakai Last Will Testament) supaya backend
    tahu kapan device terputus di tengah experiment.

  Library yang dibutuhkan (Arduino Library Manager):
    - PubSubClient (Nick O'Leary)
    - ArduinoJson (Benoit Blanchon)

  INI ADALAH CONTOH DASAR — sesuaikan pin, kredensial, dan penanganan error
  sesuai kebutuhan tim sebelum dipakai di kompetisi.
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ---- Konfigurasi — SESUAIKAN ----
const char* WIFI_SSID     = "NAMA_WIFI";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

const char* MQTT_HOST = "192.168.1.100"; // IP broker Mosquitto / broker cloud
const int   MQTT_PORT = 1883;
const char* MQTT_USER = "";              // kosongkan jika broker tanpa auth
const char* MQTT_PASS = "";

const char* DEVICE_ID   = "esp32-gw-01"; // HARUS sama dengan mqtt_client_id di tabel devices
const char* BASE_TOPIC  = "chemcar";

String topicTelemetry, topicStatus, topicCmd, topicAck;

WiFiClient espClient;
PubSubClient mqtt(espClient);

unsigned long lastStatusPublish = 0;
const unsigned long STATUS_INTERVAL_MS = 5000;

void setup() {
  Serial.begin(115200);      // koneksi serial ke Arduino Nano
  delay(200);

  topicTelemetry = String(BASE_TOPIC) + "/" + DEVICE_ID + "/telemetry";
  topicStatus    = String(BASE_TOPIC) + "/" + DEVICE_ID + "/status";
  topicCmd       = String(BASE_TOPIC) + "/" + DEVICE_ID + "/cmd";
  topicAck       = String(BASE_TOPIC) + "/" + DEVICE_ID + "/ack";

  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  // Teruskan data telemetry dari Arduino Nano (satu baris JSON) ke MQTT
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      mqtt.publish(topicTelemetry.c_str(), line.c_str());
    }
  }

  // Publish status kesehatan device secara berkala
  if (millis() - lastStatusPublish > STATUS_INTERVAL_MS) {
    publishStatus("online");
    lastStatusPublish = millis();
  }
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menyambungkan WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" tersambung.");
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String clientId = String("esp32-") + DEVICE_ID;
    // Last Will: jika koneksi terputus tanpa sempat disconnect bersih,
    // broker otomatis mem-publish pesan "offline" ini ke topic status.
    String lwt = "{\"status\":\"offline\"}";

    bool ok = mqtt.connect(
      clientId.c_str(), MQTT_USER, MQTT_PASS,
      topicStatus.c_str(), 1, true, lwt.c_str()
    );

    if (ok) {
      mqtt.subscribe(topicCmd.c_str());
      publishStatus("online");
    } else {
      delay(2000);
    }
  }
}

void publishStatus(const char* status) {
  StaticJsonDocument<256> doc;
  doc["status"] = status;
  doc["firmware_version"] = "1.0.0";
  JsonObject metadata = doc.createNestedObject("metadata");
  metadata["battery"] = "OK";
  metadata["motor_controller"] = "OK";
  metadata["connection"] = "OK";

  char buffer[256];
  serializeJson(doc, buffer);
  mqtt.publish(topicStatus.c_str(), buffer, true); // retained
}

// Command dari backend (start/stop) diteruskan mentah-mentah ke Arduino Nano
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];

  Serial.println(message); // Arduino Nano membaca baris ini di sisinya

  StaticJsonDocument<256> ackDoc;
  ackDoc["received"] = message;
  char buffer[256];
  serializeJson(ackDoc, buffer);
  mqtt.publish(topicAck.c_str(), buffer);
}
