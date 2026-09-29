import http from 'node:http';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { SCORING_RUBRIC } from '../../src/data/scoringRubric.js';

export async function startBrowserHarness() {
  const dbName = `courtsim_test_${randomUUID().replaceAll('-', '')}`;
  const emails = [];
  let calls = 0;
  const control = { delayMs: 0, failNext: false };
  const ai = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls++;
    try {
      if (control.delayMs) await new Promise(resolve => setTimeout(resolve, control.delayMs));
      if (control.failNext) { control.failNext = false; res.writeHead(503); res.end('{}'); return; }
      const request = JSON.parse(body);
      const prompt = request.messages[0].content;
      const context = JSON.parse(prompt.split('<UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[1].split('</UNTRUSTED_CASE_AND_LAW_DATA_JSON>')[0]);
      const user = context.recentProceedings.findLast(r => r.speaker_type === 'user');
      const judge = prompt.includes('Chủ tọa trung lập,');
      const opponentNext = prompt.includes('Người được mời tiếp duy nhất: bên đối lập');
      const replying = context.recentProceedings.filter(r => r.speaker_type === 'user').length > 1;
      const fact_analysis = { established_facts: ['Có hợp đồng vay.'], learner_claims: [], inferences: [], missing_facts: ['Chưa có biên nhận'] };
      const payload = prompt.includes('unassessedReasons') ? {
        verdict: 'Đạt yêu cầu thực hành', score: 1, fact_analysis, citation_ids: [],
        criteria: SCORING_RUBRIC.groups.flatMap(g => g.items.map(i => ({ id: i.id, score: i.max * 0.8, reason: 'Có liên hệ hồ sơ', strength: 'Bám chứng cứ', improvement: 'Giải thích chứng cứ', record_id: user.record_id, quote: user.text.slice(0, 20) }))),
        rubric_scores: { legal_knowledge: 70, reasoning: 80, evidence_use: 90, courtroom_skill: 60 },
        feedback: 'Lập luận có chứng cứ', improvement_suggestions: 'Giải thích giới hạn lời khai',
      } : {
        role: judge ? 'judge' : 'opponent', purpose: judge ? 'clarify_claim' : 'rebut',
        issue: context.state.current_issue.id, next_speaker: context.state.invited_next,
        focus: { learner: context.learner[0].id, dossier: [context.dossier.find(s => s.text === 'Có hợp đồng vay.').id] }, citation_ids: [],
        content: judge ? opponentNext ? 'Mời bên đối lập làm rõ căn cứ phản hồi. Bên đối lập giải thích mối liên hệ giữa hợp đồng và việc thanh toán như thế nào?' : 'Bạn viện dẫn hợp đồng trong hồ sơ. Bạn giải thích chứng cứ nào cho thấy khoản tiền còn phải trả?'
          : replying ? 'Bạn đã phân biệt việc vay với việc thanh toán. Phía tôi đề nghị đối chiếu khoản tiền còn yêu cầu với diễn biến được hồ sơ ghi nhận, thay vì suy ra toàn bộ nghĩa vụ chỉ từ hợp đồng.' : 'Bạn viện dẫn hợp đồng để yêu cầu đối chiếu việc trả tiền. Hợp đồng thể hiện việc vay, nhưng tự nó không chứng minh đã thanh toán; vì vậy lời trình bày trả tiền còn phải được liên kết với diễn biến trong hồ sơ.',
      };
      const raw = JSON.stringify(payload);
      if (request.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        const boundary = raw.indexOf('.', raw.indexOf('"content":')) + 1;
        for (const content of [raw.slice(0, boundary), raw.slice(boundary)]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        res.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
      } else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: raw } }] })); }
    } catch { res.writeHead(500); res.end('{}'); }
  });
  await new Promise(resolve => ai.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, { NODE_ENV: 'test', AUTH_EMAIL_VERIFICATION_DISABLED: 'false', JWT_SECRET: 'browser-integration-only-secret-at-least-32',
    CLIENT_ORIGIN: 'http://127.0.0.1:4175', AI_BASE_URL: `http://127.0.0.1:${ai.address().port}`, GEMINI_API_KEY: '', AI_API_KEY: '', LEGAL_ONLINE_LOOKUP: 'false' });
  const { createApp } = await import('../../src/app.js');
  const { Case, User, SimulationSession, AiPersonal } = await import('../../src/models/index.js');
  const { default: VbplSnapshot } = await import('../../src/models/VbplSnapshot.js');
  const { parseVbplPage } = await import('../../src/services/vbplResearch.js');
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), SimulationSession.init(), VbplSnapshot.init()]);
  await AiPersonal.insertMany(['judge', 'prosecutor', 'evaluator'].map(role_name => ({ role_name, model_id: 'test', system_prompt: 'Bám hồ sơ.', temperature: 0.1 })));
  await Case.create({ title: 'Hồ sơ kiểm thử trình duyệt', category: 'dân sự', summary: 'Tranh chấp vay', full_document: 'Có hợp đồng vay. Chưa có biên nhận trả tiền.',
    evidence_inventory: [{ name: 'Hợp đồng vay', availability: 'provided', content: 'Có hợp đồng vay.', summary: 'Hợp đồng hai bên ký.' }, { name: 'Biên nhận', availability: 'mentioned_only', source_quote: 'Chưa có biên nhận trả tiền.' }] });
  // Fixture chỉ nằm trong DB ngẫu nhiên, không đưa vào kho luật người dùng.
  await VbplSnapshot.create(parseVbplPage({ url: 'https://vbpl.vn/van-ban/chi-tiet/fixture-browser', content: '<h1>Bộ luật Dân sự</h1><p>Số ký hiệu: 91/2015/QH13</p><p>Loại văn bản: Bộ luật</p><article><p>Điều 1. Hợp đồng vay</p><p>Nội dung giả định dùng riêng cho kiểm thử, không phải điều luật thật.</p></article>' }, '91/2015/QH13', new Date('2026-09-01T00:00:00Z')));
  const api = createApp({ sendEmail: async mail => emails.push(mail) }).listen(5019, '127.0.0.1');
  await new Promise(resolve => api.once('listening', resolve));
  return { emails, control, calls: () => calls,
    // Chỉ cấp quyền trong DB kiểm thử ngẫu nhiên, không thay tài khoản thật.
    makeAdmin: async email => {
      if (mongoose.connection.name !== dbName || !/^courtsim_test_[a-f0-9]{32}$/.test(dbName)) throw new Error('Không đúng DB kiểm thử');
      await User.updateOne({ email }, { $set: { system_role: 'admin' } });
    }, close: async () => {
    api.closeAllConnections(); ai.closeAllConnections();
    await new Promise(resolve => api.close(resolve)); await new Promise(resolve => ai.close(resolve));
    if (mongoose.connection.name === dbName && /^courtsim_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } };
}
