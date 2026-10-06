import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { researchLegalBasis } from '../services/legalResearchService.js';
import { evaluateSession } from '../services/simulationService.js';
import { researchWebLaw } from '../services/webLegalResearch.js';
import { searchLegalWeb } from '../services/aiClient.js';
import { fetchPublicLawPage } from '../services/publicWebPage.js';
// Kiểm thử công khai, không nạp hồ sơ thật hoặc phiên của người học.
const courtCase = { title: 'Luyện lập luận tranh chấp đất đai', category: 'đất đai', summary: 'Tranh chấp quyền sử dụng đất và phạm vi chứng minh của lời kể.',
  full_document: 'Tình huống tổng hợp: hai bên bất đồng về ý nghĩa của việc giao vật liệu. Không có biên nhận trong bài tập.',
  reference_date: '2018-08-07', practice_context: { legal_assessment: 'unverified' }, parties: [], evidence_inventory: [] };

try {
  await connectDatabase();
  const records = [{ _id: 'web-smoke-user-1', sender_type: 'user', content: 'Tôi bảo vệ phía nguyên đơn trong tranh chấp đất đai. Lời trình bày về chia miệng và giao gạch cần đối chiếu thêm chứng cứ. Tôi chưa khẳng định việc giao gạch đã chứng minh thỏa thuận chuyển quyền sử dụng đất.' },
    { _id: 'web-smoke-opponent', sender_type: 'ai_prosecutor', content: 'Bạn cần làm rõ giới hạn chứng minh của lời kể trực tiếp.' },
    { _id: 'web-smoke-user-2', sender_type: 'user', content: 'Tôi phân biệt lời tự nhận gánh gạch với việc biết mục đích đổi đất. Thiếu giấy giao nhận không tự chứng minh thỏa thuận không tồn tại; cần đánh giá từng nguồn biết.' }];
  const directory = new URL('../../../.test-artifacts/', import.meta.url);
  await mkdir(directory, { recursive: true });
  let sourceIndex = 0;
  const dependencies = process.argv.includes('--diagnose') ? { web: input => researchWebLaw(input, {
    discover: async request => { const urls = await searchLegalWeb(request, { onDiagnostics: value => console.log(JSON.stringify(value)) }); console.log(JSON.stringify({ discovered: urls })); return urls; },
    fetchPage: async url => {
      try { const page = await fetchPublicLawPage(url); await writeFile(new URL(`web-law-page-${++sourceIndex}.html`, directory), page.content); console.log(JSON.stringify({ loaded: page.url, bytes: page.content.length })); return page; }
      catch (error) { console.log(JSON.stringify({ failed: url, code: error.code ?? error.message, http_status: error.http_status })); throw error; }
    },
  }) } : {};
  const legal = await researchLegalBasis({ courtCase, eventDate: courtCase.reference_date, records }, dependencies);
  const report = { mode: legal.legal_assessment_mode, sources: legal.citations, warnings: legal.warnings };
  if (!legal.citations.length) { process.exitCode = 1; }
  else if (!process.argv.includes('--sources-only')) report.evaluation = await evaluateSession({ session: { user_court_role: 'plaintiff_lawyer', case_event_date: courtCase.reference_date }, courtCase, records }, { research: async () => legal });
  await writeFile(new URL('web-law-smoke.json', directory), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: report.mode, sources: legal.citations.map(c => ({ law: c.law_number, article: c.article, url: c.source_url, source_verification: c.source_verification, application_status: c.application_status })),
    score: report.evaluation?.earned_score, assessed: report.evaluation?.assessed_max, note: report.evaluation?.assessment_note, warnings: legal.citations.length ? undefined : legal.warnings }));
} catch (error) { console.error(error.code ?? error.name); process.exitCode = 1; }
finally { await disconnectDatabase(); }
