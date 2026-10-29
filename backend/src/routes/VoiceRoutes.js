import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateCourtroomSpeech } from '../services/aiVoiceService.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// Xác thực người dùng để bảo vệ hạn ngạch TTS
router.use(authenticate);

/**
 * POST /api/v1/voice/tts
 * Chuyển văn bản lời thoại thành giọng nói tiếng Việt tự nhiên chuẩn phòng xử án
 */
router.post('/tts', asyncHandler(async (request, response) => {
  const { text, role, voice, speed } = request.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AppError('Vui lòng cung cấp nội dung văn bản để đọc.', 400, 'INVALID_SPEECH_TEXT');
  }

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
