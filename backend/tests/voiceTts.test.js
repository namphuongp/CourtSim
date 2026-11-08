process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough';
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  sanitizeTextForTts,
  normalizeVietnameseSpeechForTts,
  ROLE_VOICE_MAP,
  generateCourtroomSpeech,
  fetchGoogleVietnameseSpeech,
  clearSpeechCache
} = await import('../src/services/aiVoiceService.js');

test('aiVoiceService: sanitizeTextForTts làm sạch văn bản tố tụng chuẩn xác', () => {
  const dirty = 'Kính thưa [Chủ tọa](https://court.vn) và Hội đồng xét xử [CC: EV-01] [PL: LAW-02] [Căn cứ: 45/2013/QH13, Điều 100] [Bút lục: 24]. <p>Chúng tôi đề nghị bác đơn! ⚖️ 🛡️</p> --- **Căn cứ** Điều 100.';
  const cleaned = sanitizeTextForTts(dirty);
  assert.equal(cleaned.includes('https://court.vn'), false, 'Không chứa URL');
  assert.equal(cleaned.includes('[CC: EV-01]'), false, 'Không chứa mã chứng cứ');
  assert.equal(cleaned.includes('[PL: LAW-02]'), false, 'Không chứa mã căn cứ luật');
  assert.equal(cleaned.includes('[Căn cứ:'), false, 'Không chứa nhãn [Căn cứ:]');
  assert.equal(cleaned.includes('[Bút lục:'), false, 'Không chứa nhãn [Bút lục:]');
  assert.equal(cleaned.includes('⚖️'), false, 'Không chứa emoji cái cân');
  assert.equal(cleaned.includes('🛡️'), false, 'Không chứa emoji cái khiên');
  assert.equal(cleaned.includes('---'), false, 'Không chứa đường kẻ markdown');
  assert.equal(cleaned.includes('<p>'), false, 'Không chứa thẻ HTML');
  assert.equal(cleaned.includes('**'), false, 'Không chứa ký tự markdown');
  assert.equal(cleaned.includes('Chủ tọa và Hội đồng xét xử'), true, 'Giữ lại nội dung lời nói');
  assert.equal(cleaned.includes('Căn cứ Điều 100.'), true, 'Giữ lại nội dung điều luật');
});

test('aiVoiceService: vai trò tòa án có cấu hình giọng đọc tự nhiên riêng biệt', () => {
  assert.equal(ROLE_VOICE_MAP.judge.voice, 'onyx', 'Chủ tọa dùng giọng Onyx trầm uy nghiêm');
  assert.equal(ROLE_VOICE_MAP.judge.speed, 0.95, 'Chủ tọa đọc tốc độ điềm tĩnh 0.95');
  assert.equal(ROLE_VOICE_MAP.opponent.voice, 'echo', 'Bên đối lập dùng giọng Echo sắc bén');
  assert.equal(ROLE_VOICE_MAP.learner.voice, 'nova', 'Người học dùng giọng Nova nữ sắc sảo');
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

test('aiVoiceService: fetchGoogleVietnameseSpeech fallback tạo âm thanh tiếng Việt thành công', async () => {
  const fallbackText = 'Phiên tòa tiếp tục phần tranh tụng giữa nguyên đơn và bị đơn.';
  const buffer = await fetchGoogleVietnameseSpeech(fallbackText);
  assert.ok(buffer instanceof Buffer, 'Fallback trả về Buffer âm thanh');
  assert.ok(buffer.length > 5000, 'Buffer âm thanh có dữ liệu hợp lệ');
});

test('aiVoiceService: hỗ trợ đầy đủ các vai tố tụng (Chủ tọa, Bên đối lập, Kiểm sát viên)', async () => {
  const roles = ['judge', 'opponent', 'ai_prosecutor', 'defense_lawyer'];
  for (const role of roles) {
    const res = await generateCourtroomSpeech({
      text: `Vai ${role} trình bày ý kiến tại phiên tòa sơ thẩm.`,
      role
    });
    assert.ok(res.buffer instanceof Buffer, `Âm thanh cho vai ${role} phải là Buffer`);
    assert.ok(res.buffer.length > 2000, `Kích thước âm thanh cho vai ${role} phải hợp lệ`);
  }
});

test('aiVoiceService: normalizeVietnameseSpeechForTts chuẩn hóa ngữ âm tiếng Việt tự nhiên và triệt tiêu ký tự dễ đọc sang tiếng Anh', () => {
  const input =
    'Kính thưa HĐXX tại Giai đoạn III, căn cứ Bản án số 17/2026/HC-PT ngày 18/12/2015 do ông Đ. và Ông Hồ Thành L tại phường B viện dẫn diện tích 150m2 với số tiền 1.600.000.000 đồng, lãi 2% theo điểm b khoản 1 Điều 463 BLDS tại TAND tỉnh.';
  const normalized = normalizeVietnameseSpeechForTts(input);

  assert.ok(normalized.includes('Hội đồng xét xử'), 'Mở rộng HĐXX thành Hội đồng xét xử');
  assert.ok(normalized.includes('Giai đoạn 3'), 'Chuyển Giai đoạn III thành Giai đoạn 3');
  assert.ok(normalized.includes('17 năm 2026 hành chính phúc thẩm'), 'Mở rộng mã bản án 17/2026/HC-PT sang tiếng Việt');
  assert.ok(normalized.includes('ngày 18 tháng 12 năm 2015'), 'Đọc ngày tháng tự nhiên');
  assert.ok(normalized.includes('150 mét vuông'), 'Đọc đơn vị diện tích 150m2 sang tiếng Việt');
  assert.ok(normalized.includes('1 tỷ 600 triệu đồng'), 'Đọc số tiền lớn tự nhiên');
  assert.ok(normalized.includes('2 phần trăm'), 'Đọc phần trăm tự nhiên');
  assert.ok(normalized.includes('điểm bê'), 'Phiên âm điểm b thành điểm bê');
  assert.ok(normalized.includes('Bộ luật Dân sự'), 'Mở rộng BLDS');
  assert.ok(normalized.includes('Tòa án nhân dân'), 'Mở rộng TAND');
  assert.ok(normalized.includes('ông Đê'), 'Phiên âm tên tắt ông Đ. thành ông Đê');
  assert.ok(normalized.includes('Ông Hồ Thành Lờ'), 'Phiên âm tên tắt Ông Hồ Thành L thành Ông Hồ Thành Lờ');
  assert.ok(normalized.includes('phường Bê'), 'Phiên âm phường B thành phường Bê');
});

test('aiVoiceService: các tin nhắn khác nhau (Chủ tọa, Luật sư, Bên đối lập) tạo ra luồng âm thanh riêng biệt, không bao giờ đọc lặp cùng 1 nội dung', async () => {
  clearSpeechCache();
  const judgeMsg = 'Hội đồng xét xử tuyên bố mở phiên tòa xét xử vụ án dân sự sơ thẩm.';
  const lawyerMsg = 'Kính thưa Hội đồng xét xử, phía nguyên đơn đề nghị buộc bị đơn hoàn trả số tiền 500.000.000 đồng.';
  const opponentMsg = 'Thưa Hội đồng xét xử, phía bị đơn bác bỏ toàn bộ yêu cầu khởi kiện vì chưa có chứng cứ giao tiền.';

  const resJudge = await generateCourtroomSpeech({ text: judgeMsg, role: 'judge' });
  const resLawyer = await generateCourtroomSpeech({ text: lawyerMsg, role: 'learner' });
  const resOpponent = await generateCourtroomSpeech({ text: opponentMsg, role: 'opponent' });

  assert.equal(resJudge.cached, false);
  assert.equal(resLawyer.cached, false, 'Tin nhắn của luật sư không được lấy nhầm cache của chủ tọa');
  assert.equal(resOpponent.cached, false, 'Tin nhắn của bên đối lập không được lấy nhầm cache trước đó');

  assert.notDeepEqual(resJudge.buffer, resLawyer.buffer, 'Âm thanh của luật sư phải khác âm thanh của chủ tọa');
  assert.notDeepEqual(resLawyer.buffer, resOpponent.buffer, 'Âm thanh của bên đối lập phải khác âm thanh của luật sư');
  assert.notDeepEqual(resJudge.buffer, resOpponent.buffer, 'Âm thanh của bên đối lập phải khác âm thanh của chủ tọa');
});
