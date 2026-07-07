const mqtt = require('mqtt');
require('dotenv').config();

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Sesuaikan topic dengan topic yang dipakai ESP32-C3 gateway
const TOPICS = {
  telemetry: process.env.MQTT_TOPIC_TELEMETRY || 'chemecar/telemetry',
  status: process.env.MQTT_TOPIC_STATUS || 'chemecar/status',
  control: process.env.MQTT_TOPIC_CONTROL || 'chemecar/control',
};

function createMqttClient(io) {
  const client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `chemecar-backend-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 2000,
  });

  client.on('connect', () => {
    console.log(`[MQTT] Terhubung ke broker: ${MQTT_BROKER_URL}`);
    client.subscribe(Object.values(TOPICS), (err) => {
      if (err) {
        console.error('[MQTT] Gagal subscribe:', err.message);
      } else {
        console.log('[MQTT] Subscribed ke topic:', Object.values(TOPICS).join(', '));
      }
    });
  });

  client.on('message', (topic, message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (e) {
      payload = message.toString();
    }

    // Teruskan data real-time ke semua client frontend via Socket.IO
    if (topic === TOPICS.telemetry) {
      io.emit('telemetry', payload);
    } else if (topic === TOPICS.status) {
      io.emit('status', payload);
    }

    console.log(`[MQTT] Pesan dari ${topic}:`, payload);
  });

  client.on('error', (err) => {
    console.error('[MQTT] Connection error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Mencoba reconnect ke broker...');
  });

  return { client, TOPICS };
}

module.exports = createMqttClient;
