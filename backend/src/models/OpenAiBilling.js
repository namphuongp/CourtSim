import mongoose from 'mongoose';

const modelUsage = new mongoose.Schema({
  model: { type: String, default: null }, inputTokens: Number, cachedInputTokens: { type: Number, default: null },
  outputTokens: Number, requests: Number,
}, { _id: false });
const costItem = new mongoose.Schema({ lineItem: { type: String, default: null }, amount: mongoose.Schema.Types.Decimal128 }, { _id: false });
const snapshot = { syncedAt: Date, through: Date };
const daily = new mongoose.Schema({
  _id: String, projectId: { type: String, required: true }, day: { type: String, required: true }, generation: Number,
  costs: { ...snapshot, amount: mongoose.Schema.Types.Decimal128, items: [costItem] },
  usage: { ...snapshot, models: [modelUsage] },
}, { bufferCommands: false, minimize: false });
daily.index({ projectId: 1, day: 1 }, { unique: true });

const sync = new mongoose.Schema({
  _id: String, generation: { type: Number, default: 0 }, jobId: String, month: String,
  status: { type: String, enum: ['running', 'success', 'partial', 'failed'] },
  trigger: { type: String, enum: ['manual', 'cron'] }, initiatedBy: mongoose.Schema.Types.ObjectId,
  startedAt: Date, finishedAt: Date, leaseUntil: Date, lastCompletedAt: Date,
  costsError: { type: String, default: null }, usageError: { type: String, default: null },
  costsDays: Number, usageDays: Number, expectedDays: Number,
}, { bufferCommands: false });

export const OpenAiDaily = mongoose.model('OpenAiDaily', daily);
export const OpenAiSync = mongoose.model('OpenAiSync', sync);
