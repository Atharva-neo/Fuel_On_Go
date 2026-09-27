const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema({
  name: { type: String, default: null },
  phone: { type: String, required: true, unique: true },
  vehicleNumber: { type: String, default: null },
  vehicleType: { type: String, default: 'car' },
  email: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  password: { type: String },
  pumpId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pump' },
  trustScore: { type: Number, default: 100, min: 0, max: 100 },
  isBlocked: { type: Boolean, default: false },
  noShowCount: { type: Number, default: 0 },
  expoPushToken: { type: String, default: null },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
