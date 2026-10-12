import 'dotenv/config';
import mongoose from 'mongoose';
import { OpenAiDaily, OpenAiSync } from '../models/OpenAiBilling.js';
import { syncOpenAiMonth } from '../services/openAiBillingService.js';
import { billingConfig, billingError, billingMonth, safeBillingCode } from '../services/openAiBillingPolicy.js';

try {
  if (!billingConfig().ready) throw billingError('OPENAI_NOT_CONFIGURED');
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--month')) throw billingError('INVALID_BILLING_ARGUMENTS', 400);
  const now = new Date();
  // Quét lại tháng trước để nhận dữ liệu đến muộn qua ranh giới tháng.
  const months = args.length ? [billingMonth(args[1], now).month] : [
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7), now.toISOString().slice(0, 7),
  ];
  if (!process.env.MONGO_URI) throw new Error('Missing database');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await OpenAiDaily.createIndexes();
  await OpenAiSync.createIndexes();
  for (const month of months) {
    const result = await syncOpenAiMonth({ month, trigger: 'cron' });
    console.info('OPENAI_BILLING_SYNC', { month, ...result });
    if (result.status !== 'success') process.exitCode = 1;
  }
} catch (error) {
  console.error('OPENAI_BILLING_SYNC_FAILED', { code: safeBillingCode(error) });
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
