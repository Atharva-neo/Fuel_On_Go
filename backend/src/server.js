require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const pumpRoutes = require('./routes/pumpRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');

const { startCronJobs } = require('./cron/cronJobs');
const { seedIfEmpty } = require('./utils/seeder');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fuel_on_go';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', serverTime: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pumps', pumpRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB');

    await seedIfEmpty();

    startCronJobs();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('[Startup Error]', err);
    process.exit(1);
  }
}

startServer();
