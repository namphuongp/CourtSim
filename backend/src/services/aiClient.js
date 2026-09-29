import { recordAiUsage } from './aiUsageService.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { readSse } from '../../../shared/readSse.mjs';
import { consumeAiBudget } from './aiBudget.js';

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function boundedText(response) {
  let length = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 500000) throw new Error('AI_RESPONSE_SIZE');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function buildChatRequest({ model, systemPrompt, messages, temperature, json, maxCompletionTokens, reasoningEffort }, baseUrl = env.AI_BASE_URL) {
  return {
    model,
    // OpenAI dùng sampling mặc định để tương thích model suy luận không nhận temperature.
    ...(new URL(baseUrl).origin === 'https://api.openai.com' ? {} : { temperature }),
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    ...(maxCompletionTokens ? { max_completion_tokens: maxCompletionTokens } : {}),
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
  };
}

function getRetryDelay(response, responseBody, attempt) {
  const retryAfter = Number.parseFloat(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter)) return Math.min(retryAfter * 1_000, 15_000);

  try {
    const payload = JSON.parse(responseBody);
    const retryInfo = payload.error?.details?.find((detail) => detail['@type']?.endsWith('RetryInfo'));
    const seconds = Number.parseFloat(retryInfo?.retryDelay?.replace('s', ''));
    if (Number.isFinite(seconds)) return Math.min(seconds * 1_000, 15_000);
  } catch {
    // Provider có thể trả HTML/text; dùng exponential backoff mặc định.
  }

  return 1_500 * (2 ** attempt);
}

export async function createChatCompletion({ model, systemPrompt, messages, temperature = 0.4, json = false, usageContext = {}, timeoutMs = env.AI_TIMEOUT_MS, maxAttempts = MAX_ATTEMPTS, maxCompletionTokens, reasoningEffort, onMetrics, onDelta }) {
  if (!model || model === 'configure-me') {
    throw new AppError('Dịch vụ mô phỏng chưa sẵn sàng. Vui lòng liên hệ người quản trị.', 503, 'AI_NOT_CONFIGURED');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (env.AI_API_KEY) headers.Authorization = `Bearer ${env.AI_API_KEY}`;

  const requestBody = JSON.stringify({ ...buildChatRequest({ model, systemPrompt, messages, temperature, json, maxCompletionTokens, reasoningEffort }),
    ...(onDelta ? { stream: true, stream_options: { include_usage: true } } : {}) });

  const attempts = Math.max(1, Math.min(MAX_ATTEMPTS, maxAttempts));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Unit test provider không có DB; mọi lời gọi gắn người học và mọi lời gọi production đều bị giới hạn.
    if (usageContext.userId || env.NODE_ENV === 'production') await consumeAiBudget(usageContext.userId);
    let response;
    const started = Date.now();
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      response = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers,
        signal,
        body: requestBody,
      });
    } catch (error) {
      await recordAiUsage({ context: usageContext, model, started, success: false, errorType: error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK' });
      if (attempt < attempts - 1 && error.name !== 'TimeoutError') {
        await wait(1_500 * (2 ** attempt));
        continue;
      }
      throw new AppError(error.name === 'TimeoutError' ? 'Phản hồi quá thời gian chờ. Các lượt đã gửi vẫn được giữ lại; bạn có thể thử lại.' : 'Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.', 503, error.name === 'TimeoutError' ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE');
    }

    const headersMs = Date.now() - started;
    let responseBody, firstTokenMs;
    try {
      if (response.ok && onDelta && response.headers.get('content-type')?.includes('text/event-stream')) {
        let content = '', finishReason, usage;
        for await (const frame of readSse(response.body)) {
          if (frame === '[DONE]') break;
          const chunk = JSON.parse(frame);
          if (chunk.usage) usage = chunk.usage;
          const choice = chunk.choices?.[0];
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (typeof choice?.delta?.content === 'string') {
            firstTokenMs ??= Date.now() - started;
            content += choice.delta.content;
            if (content.length > 40000) throw new Error('AI_RESPONSE_SIZE');
            onDelta(content);
          }
        }
        if (!finishReason) throw new Error('AI_STREAM_INTERRUPTED');
        responseBody = JSON.stringify({ choices: [{ message: { content }, finish_reason: finishReason }], usage });
      } else responseBody = await boundedText(response);
    }
    catch (error) {
      await recordAiUsage({ context: usageContext, model, started, success: false, errorType: signal.aborted ? 'TIMEOUT' : 'RESPONSE_READ_FAILED' });
      if (signal.aborted) throw new AppError('Phản hồi quá thời gian chờ. Các lượt đã gửi vẫn được giữ lại; bạn có thể thử lại.', 503, 'AI_TIMEOUT');
      throw new AppError('Không thể đọc phản hồi AI. Vui lòng thử lại.', 502, 'AI_UNAVAILABLE');
    }
    let payload;
    try { payload = JSON.parse(responseBody); } catch { /* Ghi nhận lỗi định dạng, không lưu nội dung phản hồi. */ }
    const rawContent = payload?.choices?.[0]?.message?.content;
    onMetrics?.({ headers_ms: headersMs, body_ms: Date.now() - started - headersMs, total_ms: Date.now() - started,
      status: response.status, first_token_ms: firstTokenMs, finish_reason: payload?.choices?.[0]?.finish_reason, usage: payload?.usage });
    const validContent = payload?.choices?.[0]?.finish_reason !== 'length' && typeof rawContent === 'string' && rawContent.trim().length > 0 && rawContent.trim().length <= 40000;
    await recordAiUsage({ context: usageContext, model, started, usage: payload?.usage,
      success: response.ok && validContent, errorType: response.ok ? (validContent ? undefined : 'INVALID_RESPONSE') : 'HTTP_' + response.status });
    if (response.ok) {
      if (payload?.choices?.[0]?.finish_reason === 'length') throw new AppError('Phản hồi chưa hoàn chỉnh. Vui lòng thử lại.', 502, 'AI_TRUNCATED_RESPONSE');
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch {
        throw new AppError('AI trả về dữ liệu không hợp lệ.', 502, 'AI_INVALID_RESPONSE');
      }
      const raw = data?.choices?.[0]?.message?.content;
      const content = typeof raw === 'string' ? raw.trim() : '';
      if (content.length > 40_000) throw new AppError('Phản hồi AI quá dài. Vui lòng thử lại.', 502, 'AI_INVALID_RESPONSE');
      if (!content) throw new AppError('AI không trả về nội dung.', 502, 'AI_EMPTY_RESPONSE');
      return content;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < attempts - 1) {
      await wait(getRetryDelay(response, responseBody, attempt));
      continue;
    }

    console.error(`AI provider failed with status ${response.status}.`);
    if (response.status === 429) {
      throw new AppError('Dịch vụ AI đang giới hạn số lượt gọi. Vui lòng chờ khoảng một phút rồi gửi lại.', 429, 'AI_RATE_LIMITED');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError('Dịch vụ AI chưa sẵn sàng. Vui lòng liên hệ người quản trị.', 503, 'AI_AUTH_FAILED');
    }
    throw new AppError('Dịch vụ AI tạm thời gặp lỗi. Vui lòng thử lại.', 502, 'AI_PROVIDER_ERROR');
  }

  throw new AppError('Dịch vụ AI tạm thời không phản hồi.', 503, 'AI_UNAVAILABLE');
}
