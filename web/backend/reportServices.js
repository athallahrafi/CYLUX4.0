const { query } = require('../config/db');

/**
 * Menghitung metrik analisa dari seluruh sensor_readings sebuah experiment,
 * lalu menyimpan/update baris di tabel `reports`.
 *
 * Metrik distance_error_m mengikuti kriteria penjurian AIChE Chem-E-Car:
 * skor performa dihitung dari selisih absolut |jarak target - jarak aktual|,
 * bukan dari persentase — sehingga kita simpan keduanya untuk kebutuhan berbeda:
 * distance_error_m untuk laporan formal, accuracy_percent untuk tampilan dashboard.
 */
async function generateReport(experimentId) {
  const expResult = await query('SELECT * FROM experiments WHERE id = $1', [experimentId]);
  const experiment = expResult.rows[0];
  if (!experiment) throw new Error('Experiment tidak ditemukan.');

  const readingsResult = await query(
    `SELECT * FROM sensor_readings WHERE experiment_id = $1 ORDER BY elapsed_ms ASC`,
    [experimentId]
  );
  const readings = readingsResult.rows;

  if (readings.length === 0) {
    return null; // tidak ada data untuk dianalisa
  }

  const voltages = readings.map((r) => Number(r.voltage_v)).filter((v) => !Number.isNaN(v));
  const currents = readings.map((r) => Number(r.current_a)).filter((v) => !Number.isNaN(v));
  const powers = readings.map((r) => Number(r.power_w)).filter((v) => !Number.isNaN(v));
  const temps = readings.map((r) => Number(r.temperature_c)).filter((v) => !Number.isNaN(v));

  const avgPower = powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : null;
  const peakCurrent = currents.length ? Math.max(...currents) : null;
  const peakTemperature = temps.length ? Math.max(...temps) : null;
  const peakVoltageDrop = voltages.length ? Math.max(...voltages) - Math.min(...voltages) : null;
  const totalEnergy = readings[readings.length - 1].energy_wh
    ? Number(readings[readings.length - 1].energy_wh)
    : null;

  const actualDistance = experiment.actual_distance_m != null
    ? Number(experiment.actual_distance_m)
    : (readings[readings.length - 1].distance_m != null
        ? Number(readings[readings.length - 1].distance_m)
        : null);

  let distanceError = null;
  let accuracyPercent = null;
  let efficiency = null;

  if (experiment.mode === 'race' && experiment.target_distance_m != null && actualDistance != null) {
    const target = Number(experiment.target_distance_m);
    distanceError = Math.abs(target - actualDistance);
    accuracyPercent = target > 0 ? Math.max(0, (1 - distanceError / target) * 100) : null;
    if (totalEnergy != null && actualDistance > 0) {
      efficiency = totalEnergy / actualDistance;
    }
  }

  const summary = {
    mode: experiment.mode,
    sample_count: readings.length,
    duration_ms: readings[readings.length - 1].elapsed_ms,
    target_distance_m: experiment.target_distance_m,
    actual_distance_m: actualDistance,
    stop_reason: experiment.stop_reason,
    threshold_crossed_ms: experiment.threshold_crossed_ms,
  };

  const upsert = await query(
    `INSERT INTO reports (
        experiment_id, distance_error_m, accuracy_percent, efficiency_wh_per_m,
        avg_power_w, peak_current_a, peak_temperature_c, peak_voltage_drop_v,
        total_energy_wh, summary_json, generated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     ON CONFLICT (experiment_id) DO UPDATE SET
        distance_error_m = EXCLUDED.distance_error_m,
        accuracy_percent = EXCLUDED.accuracy_percent,
        efficiency_wh_per_m = EXCLUDED.efficiency_wh_per_m,
        avg_power_w = EXCLUDED.avg_power_w,
        peak_current_a = EXCLUDED.peak_current_a,
        peak_temperature_c = EXCLUDED.peak_temperature_c,
        peak_voltage_drop_v = EXCLUDED.peak_voltage_drop_v,
        total_energy_wh = EXCLUDED.total_energy_wh,
        summary_json = EXCLUDED.summary_json,
        generated_at = now()
     RETURNING *`,
    [
      experimentId, distanceError, accuracyPercent, efficiency,
      avgPower, peakCurrent, peakTemperature, peakVoltageDrop,
      totalEnergy, JSON.stringify(summary),
    ]
  );

  return upsert.rows[0];
}

/**
 * Statistik repeatability lintas beberapa experiment dengan target sama —
 * relevan untuk AIChE "Most Consistent Performance Award" (rata-rata 2 run terbaik).
 */
function computeRepeatability(experiments) {
  const distances = experiments
    .map((e) => Number(e.actual_distance_m))
    .filter((v) => !Number.isNaN(v) && v != null);

  if (distances.length === 0) return null;

  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length;
  const stdDev = Math.sqrt(variance);

  return { mean_distance_m: mean, std_dev_m: stdDev, sample_count: distances.length };
}

module.exports = { generateReport, computeRepeatability };