import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import orgRoutes from './routes/org.js';
import assetRoutes from './routes/assets.js';
import allocationRoutes from './routes/allocations.js';
import bookingRoutes from './routes/bookings.js';
import maintenanceRoutes from './routes/maintenance.js';
import auditRoutes from './routes/audits.js';
import miscRoutes from './routes/misc.js';
import technicianRoutes from './routes/technicians.js';


dotenv.config();

const app = express();

// CORS_ORIGIN can be a comma-separated list of allowed origins.
// Left unset (the default for a single-domain Vercel deploy) it allows all
// origins — harmless there because the frontend is served from the same host.
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.use(cors({ origin: origins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'assetflow' }));
app.use('/api/auth', authRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api', miscRoutes);

// Central error handler — route handlers just throw
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

export default app;
