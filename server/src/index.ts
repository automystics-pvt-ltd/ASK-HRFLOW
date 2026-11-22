import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, attachUser } from './middleware/auth.js';
import { mountSwagger } from './swagger.js';
import authRoutes from './routes/auth.js';
import employeesRoutes from './routes/employees.js';
import leaveRoutes from './routes/leave.js';
import attendanceRoutes from './routes/attendance.js';
import timesheetsRoutes from './routes/timesheets.js';
import dashboardRoutes from './routes/dashboard.js';
import noticesRoutes from './routes/notices.js';
import auditRoutes from './routes/audit.js';
import accessRoutes from './routes/access.js';
import brandingRoutes from './routes/branding.js';
import hrDocumentsRoutes from './routes/hr-documents.js';
import holidaysRoutes from './routes/holidays.js';
import approvalsRoutes from './routes/approvals.js';
import claimsRoutes from './routes/claims.js';
import activityRoutes from './routes/activity.js';
import cardsRoutes from './routes/cards.js';
import { runLeaveAutoApprove } from './lib/leave-auto-approve.js';
import {
  payrollRouter,
  recruitmentRouter,
  performanceRouter,
  documentsRouter,
  settingsRouter,
  reportsRouter,
  shiftsRouter,
} from './routes/stubs.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);
app.use(attachUser);

mountSwagger(app);

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timesheets', timesheetsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/hr-documents', hrDocumentsRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/payroll', payrollRouter);
app.use('/api/recruitment', recruitmentRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/shifts', shiftsRouter);

/** @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/api/health', (_req, res) => res.json({ ok: true, db: 'mysql' }));

const dist = path.join(__dirname, '..', '..', 'dist');
app.use(express.static(dist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`ASK HRFlow API (MySQL) on http://localhost:${PORT}`);
  console.log(`Swagger: http://localhost:${PORT}/api/docs`);
  // Scheduled leave auto-approval (never auto-approves expense claims)
  const runJob = () => {
    void runLeaveAutoApprove()
      .then((r) => {
        if (r.approved > 0) console.log(`[leave-auto-approve] approved=${r.approved} skipped=${r.skipped}`);
      })
      .catch((e) => console.error('[leave-auto-approve]', e));
  };
  setTimeout(runJob, 10_000);
  setInterval(runJob, 60 * 60 * 1000);
});