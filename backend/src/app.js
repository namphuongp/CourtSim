import cors from 'cors';
import express from 'express';
import { corsOptions, securityHeaders } from './middlewares/security.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/AuthRoutes.js';
import caseRoutes from './routes/CaseRoutes.js';
import healthRoutes from './routes/HealthRoutes.js';
import sessionRoutes from './routes/SessionRoutes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(cors({ origin: corsOptions, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/auth', authRoutes); // Giữ tương thích với frontend hiện tại.
  app.use('/api/v1/cases', caseRoutes);
  app.use('/api/v1/sessions', sessionRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
