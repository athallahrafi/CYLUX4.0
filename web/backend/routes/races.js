const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET semua race/trial
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM races ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengambil data race' });
  }
});

// GET detail satu race by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM races WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Race tidak ditemukan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengambil detail race' });
  }
});

// POST buat race/trial baru
router.post('/', async (req, res) => {
  try {
    const { name, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO races (name, notes, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [name, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membuat race baru' });
  }
});

module.exports = router;
