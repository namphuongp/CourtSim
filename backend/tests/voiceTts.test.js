import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTextForTts, ROLE_VOICE_MAP, generateCourtroomSpeech, clearSpeechCache } from '../src/services/aiVoiceService.js';

test('aiVoiceService: sanitizeTextForTts làm sạch văn bản tố tụng chuẩn xác', () => {
  const dirty = 'Kính thưa [Chủ tọa](https://court.vn) và Hội đồng xét xử [CC: EV-01] [PL: LAW-02]. <p>Chúng tôi đề nghị bác đơn!</p> **Căn cứ** Điều 100.';
  const cleaned = sanitizeTextForTts(dirty);
  assert.equal(cleaned.includes('https://court.vn'), false, 'Không chứa URL');
  assert.equal(cleaned.includes('[CC: EV-01]'), false, 'Không chứa mã chứng cứ');
  assert.equal(cleaned.includes('[PL: LAW-02]'), false, 'Không chứa mã căn cứ luật');
  assert.equal(cleaned.includes('<p>'), false, 'Không chứa thẻ HTML');
  assert.equal(cleaned.includes('**'), false, 'Không chứa ký tự markdown');
  assert.equal(cleaned.includes('Chủ tọa và Hội đồng xét xử'), true, 'Giữ lại nội dung lời nói');
  assert.equal(cleaned.includes('Căn cứ Điều 100.'), true, 'Giữ lại nội dung điều luật');
});

test('aiVoiceService: vai trò tòa án có cấu hình giọng đọc tự nhiên riêng biệt', () => {
  assert.equal(ROLE_VOICE_MAP.judge.voice, 'onyx', 'Chủ tọa dùng giọng Onyx trầm uy nghiêm');
  assert.equal(ROLE_VOICE_MAP.judge.speed, 0.95, 'Chủ tọa đọc tốc độ điềm tĩnh 0.95');
  assert.equal(ROLE_VOICE_MAP.opponent.voice, 'alloy', 'Bên đối lập dùng giọng Alloy sắc bén');
  assert.equal(ROLE_VOICE_MAP.opponent.speed, 1.0, 'Bên đối lập đọc tốc độ chuẩn 1.0');
});

test('aiVoiceService: LRU cache hoạt động tức thì cho câu lặp lại', async () => {
  clearSpeechCache();
  const sampleText = 'Tòa án nhân dân kiểm tra sự có mặt của các đương sự.';
  
  // Lần 1: Gọi AI TTS thật
  const res1 = await generateCourtroomSpeech({ text: sampleText, role: 'judge' });
  assert.ok(res1.buffer instanceof Buffer, 'Kết quả là Buffer âm thanh');
  assert.equal(res1.contentType, 'audio/mpeg');
  assert.equal(res1.cached, false, 'Lần 1 chưa có cache');

  // Lần 2: Lấy từ RAM cache
  const res2 = await generateCourtroomSpeech({ text: sampleText, role: 'judge' });
  assert.equal(res2.cached, true, 'Lần 2 phải lấy từ cache');
  assert.equal(res2.buffer.length, res1.buffer.length, 'Kích thước buffer đồng nhất');
});
