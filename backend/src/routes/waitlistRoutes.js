const express = require('express');
const { authenticate } = require('./authRoutes');

const router = express.Router();

const waitlistStore = [];

router.post('/', authenticate, async (req, res) => {
  try {
    const { pump_id, slot_id, slot_date, note } = req.body;

    if (!pump_id && !slot_id) {
      return res.status(400).json({ error: 'pump_id or slot_id is required' });
    }

    const exists = waitlistStore.find(
      (entry) =>
        entry.user_id === req.user.sub &&
        entry.pump_id === (pump_id || null) &&
        entry.slot_id === (slot_id || null) &&
        entry.slot_date === (slot_date || null) &&
        entry.status === 'waiting'
    );

    if (exists) {
      return res.json({
        success: true,
        entry: exists,
        position: exists.position,
        message: 'Already on waitlist',
      });
    }

    const position =
      waitlistStore.filter(
        (entry) =>
          entry.pump_id === (pump_id || null) &&
          entry.slot_id === (slot_id || null) &&
          entry.slot_date === (slot_date || null) &&
          entry.status === 'waiting'
      ).length + 1;

    const entry = {
      id: `wl_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      user_id: req.user.sub,
      pump_id: pump_id || null,
      slot_id: slot_id || null,
      slot_date: slot_date || null,
      note: note || null,
      status: 'waiting',
      position,
      created_at: new Date().toISOString(),
    };

    waitlistStore.push(entry);

    return res.status(201).json({ success: true, entry, position });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const idx = waitlistStore.findIndex(
      (entry) => entry.id === req.params.id && entry.user_id === req.user.sub && entry.status === 'waiting'
    );

    if (idx === -1) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    waitlistStore[idx].status = 'removed';
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
