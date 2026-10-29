import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateCourtroomSpeech } from '../services/aiVoiceService.js';
import { AppError } from '../utils/AppError.js';
import { consumeAiLimit } from '../middlewares/rateLimit.js';

const router = Router();

// Xác thực người dùng để bảo vệ hạn ngạch TTS
router.use(authenticate);

/**
 * POST /api/v1/voice/tts
 * Chuyển văn bản lời thoại thành giọng nói tiếng Việt tự nhiên chuẩn phòng xử án
 * Tích hợp cơ chế bảo vệ: Chống gửi văn bản quá dài, chống spam tần suất cao làm cạn kiệt tài khoản OpenAI
 */
router.post('/tts', asyncHandler(async (request, response) => {
  const { text, role, voice, speed } = request.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AppError('Vui lòng cung cấp nội dung văn bản để đọc.', 400, 'INVALID_SPEECH_TEXT');
  }

  // 1. Chặn văn bản quá dài: Lời thoại phòng xử mỗi lượt tối đa 800 ký tự (chống cố tình đốt ký tự OpenAI TTS)
  if (text.length > 800) {
    throw new AppError('Đoạn văn bản quá dài (tối đa 800 ký tự cho mỗi lượt đọc âm thanh).', 400, 'SPEECH_TEXT_TOO_LONG');
  }

  // 2. Chống spam gọi TTS liên tục theo user và theo IP
  await consumeAiLimit(
    `voice:tts:user:${request.auth.userId}`,
    25,
    3 * 60000,
    'Bạn đã sử dụng giọng đọc quá nhiều lần trong thời gian ngắn. Vui lòng chờ 3 phút trước khi tiếp tục.'
  );
  await consumeAiLimit(
    `voice:tts:ip:${request.ip}`,
    60,
    10 * 60000,
    'Địa chỉ mạng của bạn đang gửi yêu cầu giọng đọc quá nhanh. Vui lòng chờ 10 phút.'
  );

  const { buffer, contentType, cached, engine } = await generateCourtroomSpeech({
    text,
    role,
    customVoice: voice,
    customSpeed: typeof speed === 'number' ? speed : undefined
  });

  response.set({
    'Content-Type': contentType || 'audio/mpeg',
    'Content-Length': buffer.length,
    'Cache-Control': 'public, max-age=86400',
    'X-TTS-Cached': cached ? '1' : '0',
    'X-TTS-Engine': engine || 'openai'
  });

  response.end(buffer);
}));

export default router;
