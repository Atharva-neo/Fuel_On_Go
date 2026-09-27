const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  pumpId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  position: { type: Number, required: true },
  status: { type: String, enum: ['waiting', 'assigned', 'expired'], default: 'waiting' },
}, { timestamps: true });

waitlistSchema.index({ slotId: 1, userId: 1 }, { unique: true });
waitlistSchema.index({ slotId: 1, position: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
