// Giá USD do người vận hành xác minh và cấu hình; thiếu giá không được tính thành 0.
export function readPricing(raw = process.env.AI_MODEL_PRICING_JSON) {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    for (const entry of Object.values(value)) {
      if (!entry || typeof entry.version !== 'string' || !entry.version.trim()
        || ['inputPerMillion', 'cachedInputPerMillion', 'outputPerMillion'].some(key => typeof entry[key] !== 'number' || !Number.isFinite(entry[key]) || entry[key] < 0)) throw new Error();
    }
    return value;
  } catch { throw new Error('AI_MODEL_PRICING_JSON không hợp lệ. Kiểm tra bảng giá và phiên bản.'); }
}
export const modelPricing = readPricing();
export function estimateCost(provider, model, usage, pricing = modelPricing) {
  const rate = Object.hasOwn(pricing, `${provider}:${model}`) ? pricing[`${provider}:${model}`] : null;
  if (!rate || !usage || !Number.isSafeInteger(usage.prompt_tokens) || !Number.isSafeInteger(usage.completion_tokens)) return null;
  const input = usage.prompt_tokens, output = usage.completion_tokens;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  if (input < 0 || output < 0 || !Number.isSafeInteger(cached) || cached < 0 || cached > input) return null;
  return { cost: ((input - cached) * rate.inputPerMillion + cached * rate.cachedInputPerMillion + output * rate.outputPerMillion) / 1e6, version: rate.version };
}
