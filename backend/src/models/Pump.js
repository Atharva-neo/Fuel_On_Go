const mongoose = require('mongoose');

const pumpSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  cngLevel: { type: Number, default: 100, min: 0, max: 100 },
  cngPricePerKg: { type: Number, default: null },
  fuelDensity: { type: Number, default: 0.75 },
  isActive: { type: Boolean, default: true },
  operatorName: { type: String, default: '' },
  phone: { type: String, default: '' },
  operatingHours: {
    open: { type: String, default: '08:00' },
    close: { type: String, default: '20:00' },
  },
  slotDuration: { type: Number, default: 30 },
  slotCapacity: { type: Number, default: 5 },
  bufferMinutes: { type: Number, default: 5 },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

pumpSchema.virtual('availabilityStatus').get(function () {
  if (this.cngLevel > 50) return 'available';
  if (this.cngLevel > 20) return 'medium';
  return 'low';
});

pumpSchema.set('toJSON', { virtuals: true });
pumpSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Pump', pumpSchema);
