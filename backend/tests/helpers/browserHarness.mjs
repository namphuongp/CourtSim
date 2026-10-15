import http from 'node:http';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { SCORING_RUBRIC } from '../../src/data/scoringRubric.js';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

// Worker có thể chạy nhiều tệp; env của backend đã cache nên giữ cổng AI giữa các harness.
let fixtureAiPort = 0;

export async function startBrowserHarness({ courtCase, webReference = false, localLaw = false, paymentDependencies = {} } = {}) {
  let localArchive;
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
      const fact_analysis = { established_facts: courtCase ? [] : ['Có hợp đồng vay.'], learner_claims: [], inferences: [], missing_facts: ['Chưa có biên nhận'] };
      const payload = prompt.includes('unassessedReasons') ? {
        verdict: 'Đạt yêu cầu thực hành', score: 1, fact_analysis, citation_ids: context.legalAssessmentMode === 'web_reference' ? [context.retrievedLaw[0].citationId] : [],
        criteria: SCORING_RUBRIC.groups.flatMap(g => g.items.map(i => ({ id: i.id, score: i.max * 0.8, reason: 'Có liên hệ hồ sơ', strength: 'Bám chứng cứ', improvement: 'Giải thích chứng cứ', record_id: user.record_id, quote: user.text.slice(0, 20) }))),
        rubric_scores: { legal_knowledge: 70, reasoning: 80, evidence_use: 90, courtroom_skill: 60 },
        feedback: 'Lập luận có chứng cứ', improvement_suggestions: 'Giải thích giới hạn lời khai',
      } : {
        role: judge ? 'judge' : 'opponent', purpose: judge ? 'clarify_claim' : 'rebut',
        issue: context.state.current_issue.id, next_speaker: context.state.invited_next,
        focus: { learner: context.learner[0].id, dossier: [(context.dossier.find(s => s.text === 'Có hợp đồng vay.') ?? context.dossier[0]).id] }, citation_ids: [],
        content: courtCase ? (judge ? (opponentNext ? 'Mời bên đối lập phản hồi về nguồn biết việc giao gạch. Phía đối lập phân biệt lời kể trực tiếp và gián tiếp thế nào?' : 'Bạn đã nêu giới hạn nguồn lời khai. Bạn còn cần đối chiếu tài liệu nào để làm rõ nội dung thỏa thuận?') : replying ? 'Bạn đã giữ giới hạn của lời kể. Phía tôi đề nghị đối chiếu nội dung thỏa thuận với phạm vi điều người kể trực tiếp biết, chưa suy ra quyền sử dụng đất từ lời kể đó.' : 'Lời tự nhận gánh gạch cần được xem trong giới hạn điều người kể biết. Phía tôi chưa đồng ý suy ra đã có thỏa thuận về quyền sử dụng đất chỉ từ lời trình bày này.') : judge ? opponentNext ? 'Mời bên đối lập làm rõ căn cứ phản hồi. Bên đối lập giải thích mối liên hệ giữa hợp đồng và việc thanh toán như thế nào?' : 'Bạn viện dẫn hợp đồng trong hồ sơ. Bạn giải thích chứng cứ nào cho thấy khoản tiền còn phải trả?'
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
  await new Promise((resolve, reject) => { ai.once('error', reject); ai.listen(fixtureAiPort, '127.0.0.1', resolve); });
  fixtureAiPort = ai.address().port;
  Object.assign(process.env, { NODE_ENV: 'test', AUTH_EMAIL_VERIFICATION_DISABLED: 'false', JWT_SECRET: 'browser-integration-only-secret-at-least-32',
    CLIENT_ORIGIN: 'http://127.0.0.1:4175', AI_BASE_URL: `http://127.0.0.1:${ai.address().port}`, GEMINI_API_KEY: '', AI_API_KEY: '', LEGAL_ONLINE_LOOKUP: 'false', LEGAL_WEB_REFERENCE_SCORING: String(webReference) });
  const { createApp } = await import('../../src/app.js');
  const { Case, User, SimulationSession, AiPersonal } = await import('../../src/models/index.js');
  const { default: VbplSnapshot } = await import('../../src/models/VbplSnapshot.js');
  const { parseVbplPage } = await import('../../src/services/vbplResearch.js');
  await mongoose.connect(process.env.COURTSIM_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), SimulationSession.init(), VbplSnapshot.init()]);
  await AiPersonal.insertMany(['judge', 'prosecutor', 'evaluator'].map(role_name => ({ role_name, model_id: 'test', system_prompt: 'Bám hồ sơ.', temperature: 0.1 })));
  await Case.create(courtCase ?? { title: 'Hồ sơ kiểm thử trình duyệt', category: 'dân sự', summary: 'Tranh chấp vay', full_document: 'Có hợp đồng vay. Chưa có biên nhận trả tiền.',
    evidence_inventory: [{ name: 'Hợp đồng vay', availability: 'provided', content: 'Có hợp đồng vay.', summary: 'Hợp đồng hai bên ký.' }, { name: 'Biên nhận', availability: 'mentioned_only', source_quote: 'Chưa có biên nhận trả tiền.' }] });
  if (webReference) {
    const { default: WebLawSnapshot } = await import('../../src/models/WebLawSnapshot.js');
    const { parseWebLawPage } = await import('../../src/services/webLegalResearch.js');
    await WebLawSnapshot.create(parseWebLawPage({ url: 'https://example.org/fixture-land-law', content: '<title>Luật thử nghiệm nguồn đất đai</title><p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p>Số: 999/2020/QH14</p><p>Điều 1. Chứng cứ đất đai</p><p>Nguyên văn hư cấu chỉ để kiểm thử chứng cứ và tranh chấp quyền sử dụng đất; không phải điều luật thật.</p>' }));
  }
  // Fixture chỉ nằm trong DB ngẫu nhiên, không đưa vào kho luật người dùng.
  await VbplSnapshot.create(parseVbplPage({ url: 'https://vbpl.vn/van-ban/chi-tiet/fixture-browser', content: '<h1>Bộ luật Dân sự</h1><p>Số ký hiệu: 91/2015/QH13</p><p>Loại văn bản: Bộ luật</p><article><p>Điều 1. Hợp đồng vay</p><p>Nội dung giả định dùng riêng cho kiểm thử, không phải điều luật thật.</p></article>' }, '91/2015/QH13', new Date('2026-09-01T00:00:00Z')));
  if (localLaw) {
    const { hash } = await import('../../src/services/legalFileInventory.js');
    const { legalArchiveRoot } = await import('../../src/services/localLegalImport.js');
    const { default: Version } = await import('../../src/models/LegalCorpusVersion.js');
    const { default: Provision } = await import('../../src/models/LegalCorpusProvision.js');
    const text = 'Điều 1. Hợp đồng vay\nNội dung giả định chỉ dùng kiểm thử nguồn cục bộ, không phải điều luật thật.';
    const fingerprint = hash(dbName), sourceHash = hash(text);
    await mkdir(legalArchiveRoot, { recursive: true });
    localArchive = resolve(legalArchiveRoot, `${sourceHash}.txt`);
    await writeFile(localArchive, text);
    const document = await Version.create({ fingerprint, law_number: '91/2015/QH13', title: 'Bộ luật Dân sự — fixture',
      document_kind: 'original', status: 'reference', permission_status: 'allowed', source_verification: 'local_read',
      source_url: `/api/v1/legal-sources/${fingerprint}/files/0`, source_sha256: sourceHash, checked_at: new Date(), version: 'Fixture cục bộ',
      source_files: [{ path: 'fixture.txt', sha256: sourceHash, archive_file: `${sourceHash}.txt` }] });
    await Provision.create({ document_id: document._id, article: '1', paragraph: null, point: null, locator: 'Điều 1', locator_key: 'A:1|P:|D:', text, search_tokens: ['hop', 'dong', 'vay'] });
  }
  const api = createApp({ sendEmail: async mail => emails.push(mail) }, paymentDependencies).listen(5019, '127.0.0.1');
  await new Promise(resolve => api.once('listening', resolve));
  return { emails, control, calls: () => calls,
    grantPlan: async (email, type) => {
      if (mongoose.connection.name !== dbName || !/^courtsim_test_[a-f0-9]{32}$/.test(dbName)) throw new Error('Không đúng DB kiểm thử');
      const { applyPaymentEntitlement } = await import('../../src/services/paymentAccess.js');
      const { findPaymentProduct } = await import('../../src/services/pricingPlans.js');
      const user = await User.findOne({ email });
      const product = findPaymentProduct(type);
      if (!user || !product) throw new Error('Thiếu tài khoản/gói kiểm thử');
      await applyPaymentEntitlement({ userId: user._id, entitlement: product.entitlement });
    },
    // Chỉ cấp quyền trong DB kiểm thử ngẫu nhiên, không thay tài khoản thật.
    makeAdmin: async email => {
      if (mongoose.connection.name !== dbName || !/^courtsim_test_[a-f0-9]{32}$/.test(dbName)) throw new Error('Không đúng DB kiểm thử');
      await User.updateOne({ email }, { $set: { system_role: 'admin' } });
    }, close: async () => {
    await Promise.all([api, ai].map(server => new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    })));
    if (mongoose.connection.name === dbName && /^courtsim_test_[a-f0-9]{32}$/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (localArchive) await unlink(localArchive);
  } };
}
