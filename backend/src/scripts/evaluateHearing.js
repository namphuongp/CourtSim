import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { generateDebateTurn } from '../services/simulationService.js';
import { createChatCompletion } from '../services/aiClient.js';

// Chỉ gửi hồ sơ giả định bên dưới, không đọc phiên/người dùng trong MongoDB.
const scenarioNames = ['missing-evidence', 'provided-evidence', 'stalled-issue'];
if (process.argv[2] !== '--live' || process.argv.length > 4 || (process.argv[3] && !scenarioNames.includes(process.argv[3]))) throw new Error('Dùng --live [tên tình huống] để chạy model thật; có phát sinh phí API.');
if (new URL(env.AI_BASE_URL).origin !== 'https://api.openai.com') throw new Error('Kiểm thử này chỉ dùng endpoint OpenAI đã được cho phép.');
const session = { user_court_role: 'defense_lawyer', case_event_date: '2024-03-29', turn_count: 2, conversation: { phase: 'debate' } };
const fact = 'Phần đất đang tranh chấp có diện tích 229,7 m².';
const courtCase = { title: 'Tranh chấp đất đai giả định để kiểm thử', category: 'dân sự', summary: fact,
  full_document: fact + ' Nguyên đơn viện dẫn giấy chứng nhận. Nguồn gốc sử dụng và quá trình quản lý còn tranh chấp. Đây là dữ liệu hư cấu.',
  case_facts: [{ kind: 'recorded_event', quote: fact, source_type: 'case_outline' }], evidence_inventory: [] };
const user = { _id: 'u1', sender_type: 'user', content: 'Tôi bảo vệ bị đơn. Nguyên đơn chưa chứng minh phần đất nằm trong giấy chứng nhận; tôi không kết luận rằng nó nằm ngoài.' };
const question = { _id: 'j1', sender_type: 'ai_judge', next_speaker: 'opponent', content: 'Nguyên đơn dựa vào tài liệu cụ thể nào chứng minh sự trùng khớp với phạm vi giấy chứng nhận?' };
const supplied = { ...courtCase, evidence_inventory: [
  { id: 'EV-map-test', name: 'Bản đồ địa chính trong bài tập', availability: 'provided', content: 'Bản đồ địa chính trong bài tập thể hiện ranh giới phần đất được cấp giấy chứng nhận.' },
  { id: 'EV-survey-test', name: 'Kết quả đối chiếu trong bài tập', availability: 'provided', content: 'Kết quả đối chiếu trong bài tập xác định phần đất 229,7 m² trùng với phạm vi giấy chứng nhận.' },
] };
try {
  await connectDatabase();
  const results = [];
  for (const scenario of [
    { name: 'missing-evidence', courtCase, records: [user, question], speakers: ['opponent'] },
    { name: 'provided-evidence', courtCase: supplied, records: [user, question], speakers: ['opponent'] },
    { name: 'stalled-issue', courtCase, records: [1, 2, 3].map(n => ({ ...user, _id: `u${n}` })), speakers: ['judge'] },
  ]) {
    if (process.argv[3] && process.argv[3] !== scenario.name) continue;
    const raw = [];
    try {
      const turns = await generateDebateTurn({ session, ...scenario }, { complete: async input => {
        const value = await createChatCompletion(input); raw.push(value); return value;
      } });
      results.push({ name: scenario.name, turns, raw });
      console.log(JSON.stringify({ name: scenario.name, mode: turns[0].generation_mode, attempts: turns[0].generation_metrics.attempts.length, issue: turns[0].issue }));
    } catch (error) { results.push({ name: scenario.name, error: error.code ?? 'FAILED' }); process.exitCode = 1; }
  }
  const directory = new URL('../../../.test-artifacts/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(`hearing-live${process.argv[3] ? '-' + process.argv[3] : ''}.json`, directory), JSON.stringify({ checked_at: new Date(), synthetic: true, results }, null, 2));
  if (results.some(r => r.error || r.turns.some(t => t.generation_mode !== 'model'))) process.exitCode = 1;
} finally { await disconnectDatabase(); }
