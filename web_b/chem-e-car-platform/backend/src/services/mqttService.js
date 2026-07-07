const mqtt = require('mqtt');
const env = require('../config/env');
const experimentEngine = require('./experimentEngine');

let client = null;

/**
 * Kontrak topic MQTT (lihat juga firmware/README.md):
 *
 *   {base}/{device_id}/telemetry   ESP32 -> backend   data sensor real-time
 *   {base}/{device_id}/status      ESP32 -> backend   status online/offline & kesehatan subsistem
 *   {base}/{device_id}/cmd         backend -> ESP32   perintah start/stop
 *   {base}/{device_id}/ack         ESP32 -> backend   konfirmasi command diterima (opsional, untuk log)
 *
 * {device_id} = kolom `mqtt_client_id` pada tabel devices (mis. "esp32-gw-01").
 */
function connect() {
  const base = env.mqtt.baseTopic;

  client = mqtt.connect(env.mqtt.url, {
    username: env.mqtt.username,
    password: env.mqtt.password,
    clientId: `chemcar-backend-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log(`[mqtt] Terhubung ke broker ${env.mqtt.url}`);
    client.subscribe(`${base}/+/telemetry`);
    client.subscribe(`${base}/+/status`);
    client.subscribe(`${base}/+/ack`);
  });

  client.on('reconnect', () => console.log('[mqtt] Mencoba menyambung ulang...'));
  client.on('error', (err) => console.error('[mqtt] Error:', err.message));

  client.on('message', async (topic, payloadBuffer) => {
    try {
      const parts = topic.split('/'); // [base, device_id, channel]
      const deviceMqttId = parts[1];
      const channel = parts[2];
      const payload = JSON.parse(payloadBuffer.toString());

      if (channel === 'telemetry') {
        await experimentEngine.handleTelemetry(deviceMqttId, payload);
      } else if (channel === 'status') {
        await experimentEngine.handleDeviceStatus(deviceMqttId, payload);
      } else if (channel === 'ack') {
        console.log(`[mqtt] ACK dari ${deviceMqttId}:`, payload);
      }
    } catch (err) {
      console.error('[mqtt] Gagal memproses pesan masuk:', err.message);
    }
  });

  return client;
}

/**
 * Mengirim perintah ke ESP32 gateway, yang akan diteruskan ke Arduino Nano
 * lewat komunikasi serial di firmware.
 */
function publishCommand(deviceMqttId, command) {
  if (!client) throw new Error('MQTT client belum terhubung.');
  const topic = `${env.mqtt.baseTopic}/${deviceMqttId}/cmd`;
  client.publish(topic, JSON.stringify(command), { qos: 1 });
}

module.exports = { connect, publishCommand };
