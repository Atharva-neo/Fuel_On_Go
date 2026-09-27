require('dotenv').config();
console.log("MAIN INDEX LOADED");

const express = require('express');
const cors    = require('cors');
const { supabase } = require('./config/supabase');

const authRoutes    = require('./routes/authRoutes');
console.log("AUTH ROUTES LOADED");

const pumpRoutes    = require('./routes/pumpRoutes');
const slotRoutes    = require('./routes/slotRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const ratingsRouter = require('./routes/ratingsRoutes');
const userRoutes    = require('./routes/userRoutes');
const cronService   = require('./services/cronService');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
    if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'fuel-on-go-backend' });
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'fuel-on-go' });
});
app.get('/ready', async (_req, res) => {
  const { error } = await supabase.from('pumps').select('id').limit(1);
  if (error) {
    return res.status(503).json({ status: 'error', dependency: 'supabase' });
  }
  return res.json({ status: 'ok', dependency: 'supabase' });
});

// ─── Debug Middleware ────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/pumps',    pumpRoutes);
app.use('/api/slots',    slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/ratings',  ratingsRouter);
app.use('/api/users',    userRoutes);

// ─── 404 ─────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Error handler ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Listening on 0.0.0.0:${PORT}`);
  cronService.start();
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] ${signal} received; closing HTTP server`);
  const stopCron = cronService.stop;
  if (typeof stopCron === 'function') stopCron();
  server.close((error) => {
    if (error) {
      console.error('[Server] Shutdown error:', error.message);
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
