import adminRoutes from './routes/AdminRoutes.js';
import cors from 'cors';
import express from 'express';
import { corsOptions, securityHeaders, browserMutationGuard } from './middlewares/security.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { createAuthRoutes } from './routes/AuthRoutes.js';
import caseRoutes from './routes/CaseRoutes.js';
import healthRoutes from './routes/HealthRoutes.js';
import { learnerFeedbackRoutes, adminFeedbackRoutes } from './routes/FeedbackRoutes.js';
import sessionRoutes from './routes/SessionRoutes.js';
import legalSourceRoutes from './routes/LegalSourceRoutes.js';
import checkoutRoutes from './routes/CheckoutRoutes.js';
import surveyRoutes from './routes/SurveyRoutes.js';

export function createApp(authDependencies) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(value => value.trim()));
  app.use(securityHeaders);
  app.use(cors({ origin: corsOptions, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-CourtSim-Request'] }));
  app.use(browserMutationGuard);
  app.use(express.json({
    limit: '1mb',
    verify: (request, _response, buffer) => {
      request.rawBody = Buffer.from(buffer);
    },
  }));

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/survey', surveyRoutes);
  app.use('/api/auth', createAuthRoutes(authDependencies));
  app.use('/api/v1/cases', caseRoutes);
  app.use('/api/v1/legal-sources', legalSourceRoutes);
  app.use('/api/v1/checkout', checkoutRoutes);
  app.use('/api/payment', checkoutRoutes);
  app.use('/api/payments', checkoutRoutes);
  app.use('/api/v1/sessions/:sessionId/feedback', learnerFeedbackRoutes);
  app.use('/api/v1/admin/feedback', adminFeedbackRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/sessions', sessionRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
