import { setTimeout as delay } from 'node:timers/promises';
import { billingError, DAY_MS, sumUsd } from './openAiBillingPolicy.js';

const endpoints = { costs: '/organization/costs', usage: '/organization/usage/completions' };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const label = value => value == null || (typeof value === 'string' && value.length <= 300 && !/[\u0000-\u001f]/.test(value));

async function getPage(url, key, { fetcher, signal, sleep }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw billingError('OPENAI_TIMEOUT');
    let response;
    try {
      response = await fetcher(url, { headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), redirect: 'error' });
    } catch {
      if (signal.aborted) throw billingError('OPENAI_TIMEOUT');
      if (attempt === 2) throw billingError('OPENAI_UNAVAILABLE');
      await sleep(500 * 2 ** attempt, undefined, { signal }).catch(() => { throw billingError('OPENAI_TIMEOUT'); });
      continue;
    }
    if (response.ok) {
      try { return await response.json(); } catch { throw billingError(signal.aborted ? 'OPENAI_TIMEOUT' : 'OPENAI_INVALID_RESPONSE'); }
    }
    // Không đọc/lưu/log body lỗi của provider: chỉ ánh xạ HTTP status sang lỗi cố định.
    const status = response.status;
    await response.body?.cancel().catch(() => {});
    if (status === 401) throw billingError('OPENAI_INVALID_KEY');
    if (status === 403) throw billingError('OPENAI_FORBIDDEN');
    const retryable = status === 429 || status >= 500;
    const code = status === 429 ? 'OPENAI_RATE_LIMITED' : retryable ? 'OPENAI_UNAVAILABLE' : 'OPENAI_INVALID_RESPONSE';
    if (!retryable || attempt === 2) throw billingError(code);
    const retryAfter = response.headers.get('retry-after');
    const wait = retryAfter == null ? 500 * 2 ** attempt : /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
    if (!Number.isFinite(wait) || wait > 5000) throw billingError(code);
    await sleep(wait, undefined, { signal }).catch(() => { throw billingError('OPENAI_TIMEOUT'); });
  }
}

export async function fetchOpenAiDays(source, config, range, { fetcher = fetch, signal = AbortSignal.timeout(120000), sleep = delay } = {}) {
  if (!Object.hasOwn(endpoints, source)) throw billingError('OPENAI_INVALID_RESPONSE');
  const url = new URL(`https://api.openai.com/v1${endpoints[source]}`);
  url.searchParams.set('start_time', String(range.from.getTime() / 1000));
  url.searchParams.set('end_time', String(range.to.getTime() / 1000));
  url.searchParams.set('bucket_width', '1d');
  url.searchParams.set('limit', '31');
  url.searchParams.append('project_ids[]', config.projectId);
  for (const field of ['project_id', source === 'costs' ? 'line_item' : 'model']) url.searchParams.append('group_by[]', field);
  const rows = new Map(), cursors = new Set();
  for (let page = 0; page < 20; page++) {
    const data = await getPage(url, config.key, { fetcher, signal, sleep });
    if (!data || !Array.isArray(data.data) || data.data.length > 31 || typeof data.has_more !== 'boolean') throw billingError('OPENAI_INVALID_RESPONSE');
    for (const bucket of data.data) {
      const start = bucket.start_time * 1000, end = bucket.end_time * 1000;
      if (!integer(bucket.start_time) || !integer(bucket.end_time) || start % DAY_MS !== 0 || start < range.from.getTime()
        || start >= range.to.getTime() || end <= start || end > start + DAY_MS || end < Math.min(start + DAY_MS, range.to.getTime())
        || !Array.isArray(bucket.results) || bucket.results.length > 10000) throw billingError('OPENAI_INVALID_RESPONSE');
      const day = new Date(start).toISOString().slice(0, 10);
      if (rows.has(day)) throw billingError('OPENAI_INVALID_RESPONSE');
      const dimensions = new Set();
      const entries = bucket.results.map(result => {
        if (!result || result.project_id !== config.projectId) throw billingError('OPENAI_INVALID_RESPONSE');
        const dimension = (source === 'costs' ? result.line_item : result.model) ?? null;
        if (!label(dimension) || dimensions.has(dimension)) throw billingError('OPENAI_INVALID_RESPONSE');
        dimensions.add(dimension);
        if (source === 'costs') {
          if (result.object !== 'organization.costs.result' || result.amount?.currency?.toLowerCase() !== 'usd'
            || !['string', 'number'].includes(typeof result.amount?.value)) throw billingError('OPENAI_INVALID_RESPONSE');
          return { lineItem: dimension, amount: sumUsd([result.amount.value]) };
        }
        if (result.object !== 'organization.usage.completions.result'
          || ![result.input_tokens, result.output_tokens, result.num_model_requests].every(integer)
          || (result.input_cached_tokens != null && (!integer(result.input_cached_tokens) || result.input_cached_tokens > result.input_tokens))) throw billingError('OPENAI_INVALID_RESPONSE');
        return { model: dimension, inputTokens: result.input_tokens, outputTokens: result.output_tokens,
          cachedInputTokens: result.input_cached_tokens ?? null, requests: result.num_model_requests };
      });
      rows.set(day, { through: new Date(Math.min(end, range.to.getTime())), ...(source === 'costs'
        ? { amount: sumUsd(entries.map(entry => entry.amount)), items: entries } : { models: entries }) });
    }
    if (!data.has_more) return rows;
    if (typeof data.next_page !== 'string' || !data.next_page || data.next_page.length > 4096 || cursors.has(data.next_page)) throw billingError('OPENAI_INVALID_RESPONSE');
    cursors.add(data.next_page);
    url.searchParams.set('page', data.next_page);
  }
  throw billingError('OPENAI_INCOMPLETE');
}
