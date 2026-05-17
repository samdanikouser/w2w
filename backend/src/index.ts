import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import wasteLogRoutes from './routes/wasteLogs.js';
import siteRoutes from './routes/sites.js';
import wasteTypeRoutes from './routes/wasteTypes.js';
import vehicleRoutes from './routes/vehicles.js';
import trainingRoutes from './routes/training.js';
import transactionRoutes from './routes/transactions.js';
import eprReportRoutes from './routes/eprReports.js';
import auditLogRoutes from './routes/auditLogs.js';
import attendanceRoutes from './routes/attendance.js';
import violationRoutes from './routes/violations.js';
import stockItemRoutes from './routes/stockItems.js';
import roleRoutes from './routes/roles.js';
import userRoutes from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ── Security ──
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate limiting ──
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Body parsing ──
app.use(express.json({ limit: '2mb' }));

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// ── Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/waste-logs', wasteLogRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/waste-types', wasteTypeRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/epr-reports', eprReportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/violations', violationRoutes);
app.use('/api/stock-items', stockItemRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Start ──
app.listen(PORT, () => {
  console.log(`🟢 W2W API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
