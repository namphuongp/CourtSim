import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();
router.get('/', (_request, response) => {
  const connected = mongoose.connection.readyState === 1;
  response.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'degraded', database: connected ? 'connected' : 'disconnected', timestamp: new Date().toISOString() });
});
export default router;
