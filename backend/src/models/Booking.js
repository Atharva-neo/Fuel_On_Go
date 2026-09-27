const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  pumpId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  vehicleType: { type: String, default: 'Car' },
  tokenNumber: { type: Number, required: true },
  qrToken: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled', 'expired'],
    default: 'confirmed',
  },
  checkedInAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  noShowAt: { type: Date },
  expiredAt: { type: Date },
}, { timestamps: true });

bookingSchema.pre('validate', function (next) {
  if (this.vehicleNumber) {
    this.vehicleNumber = String(this.vehicleNumber).trim().toUpperCase().replace(/\s+/g, '');
  }
  if (this.phone) this.phone = String(this.phone).trim();
  if (this.userName) this.userName = String(this.userName).trim();
  next();
});

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ slotId: 1, userId: 1 });
bookingSchema.index({ pumpId: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
