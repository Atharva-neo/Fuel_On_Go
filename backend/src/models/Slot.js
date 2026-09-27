const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  pumpId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  capacity: { type: Number, default: 5, min: 1, max: 5 },
  booked: { type: Number, default: 0 },
  nextTokenNumber: { type: Number, default: 1, min: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Virtual: available spots
slotSchema.virtual('available').get(function () {
  return this.capacity - this.booked;
});

// Virtual: slot status
slotSchema.virtual('status').get(function () {
  const avail = this.capacity - this.booked;
  if (avail === 0) return 'full';
  if (avail <= 2) return 'filling';
  return 'open';
});

slotSchema.set('toJSON', { virtuals: true });
slotSchema.set('toObject', { virtuals: true });
slotSchema.index({ pumpId: 1, startTime: 1 }, { unique: true });
slotSchema.index({ pumpId: 1, startTime: 1, isActive: 1 });

module.exports = mongoose.model('Slot', slotSchema);
