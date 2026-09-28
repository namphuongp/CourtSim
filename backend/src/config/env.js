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

const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
const defaultAiBaseUrl = geminiApiKey
  ? 'https://generativelanguage.googleapis.com/v1beta/openai'
  : 'http://127.0.0.1:11434/v1';
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
  AI_PROVIDER: geminiApiKey ? 'gemini' : 'openai-compatible',
  AI_BASE_URL: (process.env.AI_BASE_URL ?? defaultAiBaseUrl).replace(/\/$/, ''),
  AI_API_KEY: geminiApiKey || process.env.AI_API_KEY?.trim() || '',
  AI_TIMEOUT_MS: aiTimeout,
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});
