import mongoose from 'mongoose';
import AiUsage from '../models/AiUsage.js';
import { estimateCost } from '../config/aiPricing.js';
import { env } from '../config/env.js';
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
export async function recordAiUsage({ context = {}, model, usage, started, success, errorType }) {
  if (process.env.AI_USAGE_TRACKING === 'false') return;
  const price = estimateCost(env.AI_PROVIDER, model, usage);
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('StorageUnavailable');
    await AiUsage.create({
      user_id: mongoose.isObjectIdOrHexString(context.userId) ? context.userId : undefined,
      session_id: mongoose.isObjectIdOrHexString(context.sessionId) ? context.sessionId : undefined,
      role: ['judge', 'opponent', 'evaluator', 'legal_assistant', 'voice'].includes(context.role) ? context.role : 'other',
      provider: env.AI_PROVIDER, model, input_tokens: count(usage?.prompt_tokens),
      cached_input_tokens: count(usage?.prompt_tokens_details?.cached_tokens), output_tokens: count(usage?.completion_tokens),
      latency_ms: Date.now() - started, success, error_type: errorType,
      estimated_cost: price?.cost ?? null, pricing_version: price?.version,
    });
  } catch { console.warn('AI_USAGE_WRITE_FAILED'); } // Lỗi theo dõi không làm hỏng phiên học.
}
