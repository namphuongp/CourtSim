const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/courtsim';

function parsePort(value) {
  const port = Number.parseInt(value ?? '5000', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
  }
  return port;
}

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET phải có ít nhất 32 ký tự.');
}
if (process.env.NODE_ENV === 'production') {
  if (jwtSecret.startsWith('replace-')) throw new Error('Cần thay JWT_SECRET trước khi triển khai.');
  const origins = (process.env.CLIENT_ORIGIN ?? '').split(',');
  if (!origins.length || origins.some(origin => !/^https:\/\/[^/]+$/.test(origin.trim()))) throw new Error('CLIENT_ORIGIN production phải là HTTPS origin.');
  if (process.env.GOOGLE_REDIRECT_URI && !process.env.GOOGLE_REDIRECT_URI.startsWith('https://')) throw new Error('Google redirect production phải dùng HTTPS.');
}

const openAiApiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
const defaultAiBaseUrl = openAiApiKey ? 'https://api.openai.com/v1' : 'http://127.0.0.1:11434/v1';
const aiBaseUrl = (process.env.AI_BASE_URL?.trim() || defaultAiBaseUrl).replace(/\/$/, '');
const aiOrigin = new URL(aiBaseUrl).origin;
const aiTimeout = Number(process.env.AI_TIMEOUT_MS ?? '60000');
if (!Number.isInteger(aiTimeout) || aiTimeout < 1000 || aiTimeout > 60000) {
  throw new Error('AI_TIMEOUT_MS phải là số nguyên từ 1000 đến 60000.');
}

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  // Chỉ bỏ qua xác minh email khi phát triển; không thay đổi trạng thái xác minh đã lưu.
  AUTH_EMAIL_VERIFICATION_DISABLED: (process.env.NODE_ENV ?? 'development') === 'development'
    && process.env.AUTH_EMAIL_VERIFICATION_DISABLED === 'true',
  PORT: parsePort(process.env.PORT),
  MONGO_URI: process.env.MONGO_URI ?? DEFAULT_MONGO_URI,
  JWT_SECRET: jwtSecret,
  // Giữ nhãn cũ để khóa bảng giá AI_MODEL_PRICING_JSON và thống kê sử dụng không bị tách.
  AI_PROVIDER: 'openai-compatible',
  AI_BASE_URL: aiBaseUrl,
  // Không chuyển khóa OpenAI sang endpoint tùy chỉnh nếu chưa cấu hình khóa riêng cho endpoint đó.
  AI_API_KEY: process.env.AI_API_KEY?.trim()
    || (aiOrigin === 'https://api.openai.com' ? openAiApiKey : ''),
  AI_TIMEOUT_MS: aiTimeout,
  CLIENT_ORIGINS: [
    ...new Set([
      ...(process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      ...((process.env.NODE_ENV ?? 'development') === 'development'
        ? ['http://localhost:5173', 'http://127.0.0.1:5173']
        : []),
    ]),
  ],
  QDRANT_URL: (process.env.QDRANT_URL?.trim() || 'http://localhost:6333').replace(/\/$/, ''),
  QDRANT_API_KEY: process.env.QDRANT_API_KEY?.trim() || '',
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER?.trim() || 'openai',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
  EMBEDDING_BASE_URL: (process.env.EMBEDDING_BASE_URL?.trim() || '').replace(/\/$/, ''),
  EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || '',
});
