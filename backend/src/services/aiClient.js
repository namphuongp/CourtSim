import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

export async function createChatCompletion({ model, systemPrompt, messages, temperature = 0.4, json = false }) {
  if (!model || model === 'configure-me') {
    throw new AppError('Model AI chưa được cấu hình. Hãy cập nhật model_id trong AiPersonal.', 503, 'AI_NOT_CONFIGURED');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (env.AI_API_KEY) headers.Authorization = `Bearer ${env.AI_API_KEY}`;

  const requestBody = JSON.stringify({
    model,
    temperature,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
        body: requestBody,
      });
    } catch (error) {
      if (attempt < MAX_ATTEMPTS - 1 && error.name !== 'TimeoutError') {
        await wait(1_500 * (2 ** attempt));
        continue;
      }
      throw new AppError('Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.', 503, 'AI_UNAVAILABLE');
    }

    const responseBody = await response.text();
    if (response.ok) {
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch {
        throw new AppError('AI trả về dữ liệu không hợp lệ.', 502, 'AI_INVALID_RESPONSE');
      }
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new AppError('AI không trả về nội dung.', 502, 'AI_EMPTY_RESPONSE');
      return content;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
      await wait(getRetryDelay(response, responseBody, attempt));
      continue;
    }

    console.error(`AI provider failed with status ${response.status}.`);
    if (response.status === 429) {
      throw new AppError('Gemini đang giới hạn số lượt gọi. Vui lòng chờ khoảng một phút rồi gửi lại.', 429, 'AI_RATE_LIMITED');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError('Khóa Gemini không hợp lệ hoặc không có quyền sử dụng model.', 503, 'AI_AUTH_FAILED');
    }
    throw new AppError('Dịch vụ AI tạm thời gặp lỗi. Vui lòng thử lại.', 502, 'AI_PROVIDER_ERROR');
  }

  throw new AppError('Dịch vụ AI tạm thời không phản hồi.', 503, 'AI_UNAVAILABLE');
}
