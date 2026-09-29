// Chỉ dùng hồ sơ công khai và phát biểu tổng hợp; không đọc phiên của người dùng.
import 'dotenv/config';
import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { case1Appeal } from '../data/case1Appeal.js';
import { sampleLandCase } from '../data/sampleLandCase.js';
import { generateDebateTurn, evaluateSession, getPersona } from '../services/simulationService.js';
import { createChatCompletion } from '../services/aiClient.js';
import { chooseSpeakingPlan } from '../services/conversationPolicy.js';

const label = process.argv[2];
const courtCase = label === 'case1' ? case1Appeal : sampleLandCase;
if (!['case1', 'before', 'after', 'review', 'edge', 'long-before', 'long-after'].includes(label)) throw new Error('Dùng: node src/scripts/evaluateDialogue.js before|after|review|edge|long-before|long-after');
if (new URL(env.AI_BASE_URL).origin !== 'https://api.openai.com') throw new Error('Bộ đo chỉ gửi dữ liệu tới OpenAI chính thức.');
process.env.AI_USAGE_TRACKING = 'false';
await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
const settings = Object.fromEntries(await Promise.all(['judge', 'prosecutor', 'evaluator'].map(async role => [role, await getPersona(role)])));
await mongoose.disconnect();
const emptyLaw = { citations: [], candidates: [], issues: [], warnings: [], legal_assessment_available: false };
const inputs = [
  ['greeting', 'Xin chào Chủ tọa.'], ['noise', 'abc'],
  ['short', 'Tôi không đồng ý.'],
  ['argument', 'Việc sử dụng đất lâu dài không tự chứng minh quyền đối với toàn bộ diện tích tranh chấp. Cần đối chiếu ranh giới được ghi trong hồ sơ với phần đất hai bên đang yêu cầu.'],
  ['mentioned', 'Bản án nhắc đến giấy chứng nhận nhưng bài tập chưa cung cấp toàn văn. Tôi chỉ dùng thông tin được bản án thuật lại để so sánh phạm vi yêu cầu, không coi mình đã kiểm tra bản gốc.'],
  ['missing-law', 'Tôi muốn áp dụng Luật Đất đai cho việc sử dụng đất từ năm 2005. Nếu chưa xác minh được phiên bản luật thì tôi chỉ phân tích tình tiết sử dụng đất trong hồ sơ.'],
  ['answered', 'Tôi chỉ dựa vào nội dung được bản án thuật lại, chưa khẳng định đã xem bản gốc giấy chứng nhận.'],
  ['procedure', 'Xin hỏi Chủ tọa, tôi có thể dẫn tài liệu được bản án nhắc đến không?'],
];
const datasetHash = createHash('sha256').update(JSON.stringify({ inputs, case: courtCase })).digest('hex');
const results = [];
let sequence = 0;
const user = content => ({ _id: `synthetic-${++sequence}`, sender_type: 'user', content });
const directory = new URL('../../../.test-artifacts/ai-eval/', import.meta.url);
await mkdir(directory, { recursive: true });
async function save() {
  await writeFile(new URL(`${label}.json`, directory), JSON.stringify({ label, created_at: new Date(), datasetHash,
    evaluated_inputs_sha256: createHash('sha256').update(JSON.stringify(results.map(item => ({ name: item.name, role: item.learner_role, content: item.input.findLast(record => record.sender_type === 'user')?.content })))).digest('hex'),
    configuration: Object.fromEntries(Object.entries(settings).map(([role, p]) => [role, { model: p.model_id, temperature: p.temperature,
      persona_sha256: createHash('sha256').update(p.system_prompt).digest('hex') }])),
    law_mode: 'controlled unavailable (no external law assertion)', results }, null, 2));
}
async function run(name, session, records, scoring = false) {
  const calls = [], started = performance.now();
  const dependencies = { persona: async role => settings[role], research: async () => emptyLaw,
    complete: async input => {
      const call = { role: input.usageContext.role, model: input.model, input_chars: input.systemPrompt.length + JSON.stringify(input.messages).length };
      calls.push(call);
      try { const raw = await createChatCompletion({ ...input, usageContext: {}, onMetrics: value => { Object.assign(call, value); input.onMetrics?.(value); } }); call.raw = raw; return raw; }
      catch (error) { call.error = error.code; throw error; }
    } };
  try {
    const selection = chooseSpeakingPlan(session, records.at(-1).content);
    session = { ...session, conversation: { ...session.conversation, ...selection } };
    const output = scoring ? await evaluateSession({ session, courtCase, records }, dependencies)
      : await generateDebateTurn({ session, courtCase, records, speakers: selection.plan }, dependencies);
    // Giữ ảnh chụp đầu vào: vòng nhiều lượt sẽ push lời AI vào records sau khi run trả về.
    results.push({ name, learner_role: session.user_court_role, input: structuredClone(records), selection, output, calls, elapsed_ms: performance.now() - started });
    console.log(JSON.stringify({ name, learner_role: session.user_court_role, calls: calls.length, ms: Math.round(performance.now() - started), modes: Array.isArray(output) ? output.map(t => t.generation_mode ?? 'model') : ['evaluation'] }));
    await save(); return Array.isArray(output) ? output : [];
  } catch (error) {
    results.push({ name, learner_role: session.user_court_role, input: structuredClone(records), error: error.code ?? error.name, calls, elapsed_ms: performance.now() - started });
    console.log(JSON.stringify({ name, error: error.code ?? error.name })); process.exitCode = 1; await save(); return [];
  }
}
for (const role of ['plaintiff_lawyer', 'defense_lawyer']) {
  const session = { user_court_role: role, difficulty: 'balanced', case_event_date: '2024-03-29', turn_count: 0 };
  if (label === 'case1') {
    session.case_snapshot = courtCase;
    session.case_event_date = courtCase.reference_date;
    const sequence = [
      role === 'plaintiff_lawyer' ? 'Tôi bảo vệ kháng cáo phía ông Kiên về phần đất được cho là chia miệng. Theo bản ghi, yêu cầu chủ yếu là 58,5 m² nhưng có chỗ 58,2 m²; chưa đủ cơ sở xác nhận con số nào từ bản gốc.' : 'Tôi bảo vệ lập trường phía ông Xây đang vắng mặt. Tôi viện dẫn lời được Chủ tọa đọc lại về 200 đồng và 3.000 viên gạch, nhưng chưa coi thỏa thuận đã được chứng minh vì không có giấy giao nhận.',
      'Lời chị Dụ và chị Luân tự nhận gánh gạch chỉ cho biết điều họ nói đã trực tiếp làm. Chưa thể suy ra mục đích đổi đất hoặc đã giao đủ gạch; anh Nguyên kể việc thỏa thuận qua bố nên phải đối chiếu nguồn biết.',
      'Giấy chứng nhận chỉ được nhắc đến, chưa có bản gốc. Tôi đề nghị làm rõ chủ thể được cấp và căn cứ cấp giấy; chưa kết luận hợp pháp hoặc vô hiệu. Căn cứ bồi thường nhà cũng thiếu tài liệu định giá và bản ghi có số tiền bất nhất.',
    ];
    const records = [];
    for (const [index, content] of sequence.entries()) {
      session.turn_count = index;
      records.push(user(content));
      const output = await run('case1-turn-' + (index + 1), session, records);
      records.push(...output);
      const last = output.at(-1);
      if (last) session.conversation = { ...results.at(-1).selection, last_speaker: last.role, last_purpose: last.purpose };
    }
    await run('case1-scoring', session, records, true);
    continue;
  }
  if (label === 'edge') {
    let records = [], conversation = {};
    const sequence = [
      'Tôi chưa có chứng cứ xác định ranh giới nên chưa thể khẳng định quyền trên toàn bộ phần đất.',
      'Tôi chưa có chứng cứ xác định ranh giới nên chưa thể khẳng định quyền trên toàn bộ phần đất.',
      'Tôi muốn dùng Điều 999 Luật Đất đai nhưng chưa kiểm tra được điều này có tồn tại không.',
      'Tôi muốn nói thêm về việc chuẩn bị buổi học, thời gian đi lại và cách tôi sắp xếp tài liệu. '.repeat(20) + 'Về vụ án, tôi chỉ đề nghị làm rõ sự tương ứng giữa giấy chứng nhận được thuật lại và phạm vi yêu cầu.',
      'Tóm lại, tôi chỉ giữ quan điểm cần đối chiếu thêm, chưa kết luận ai có quyền.',
    ];
    for (const [index, content] of sequence.entries()) {
      records = JSON.parse(JSON.stringify([...records, user(content)]));
      const output = await run(`edge-${index + 1}`, { ...session, turn_count: index, conversation }, records);
      if (!output.length) break;
      records.push(...output);
      const last = output.at(-1);
      conversation = { ...results.at(-1).selection, last_speaker: last.role, last_purpose: last.purpose };
    }
    continue;
  }
  if (label.startsWith('long-')) {
    if (role === 'defense_lawyer') continue;
    await run('long-argument', session, [user([
      'Tôi bảo vệ nguyên đơn A và giữ yêu cầu đối với 229,7 m² đất mương và bờ mương đang tranh chấp. Tôi không đưa phần mương 217 m² khác vào yêu cầu vì hồ sơ nói phần đó không thuộc phạm vi đang xét.',
      'A viện dẫn giấy chứng nhận được cấp cho hộ gia đình năm 1996. Tôi xem đây là điểm xuất phát để đối chiếu phạm vi yêu cầu, chưa khẳng định giấy chứng nhận đương nhiên bao phủ toàn bộ phần đất đang tranh chấp. Hồ sơ bài tập chỉ thuật lại tài liệu, không có bản gốc hoặc sơ đồ đo đạc để tôi tự xác nhận ranh giới.',
      'B trình bày đất có nguồn gốc từ gia đình mình và đã sử dụng lâu dài. Tôi không phủ nhận việc sử dụng chỉ vì chưa có bản gốc chứng cứ, nhưng lời trình bày đó cần phân biệt với kết luận về phạm vi quyền. Việc sử dụng lâu dài tự nó chưa giải quyết được sự tương ứng giữa phần đất sử dụng và phần diện tích A yêu cầu.',
      'Lời khai nhân chứng về nguồn gốc và quá trình sử dụng không thống nhất; một số người có quan hệ với các bên. Quan hệ đó không làm mọi lời khai tự động sai, cần đối chiếu nội dung cụ thể. Vì chưa có toàn văn lời khai, tôi không tự tạo một mâu thuẫn hoặc lời xác nhận để củng cố yêu cầu.',
      'Tôi đề nghị tập trung so sánh giá trị và giới hạn của từng nguồn được thuật lại. Nếu chưa có thông tin đủ xác định sự trùng khớp về diện tích, kết luận của tôi chỉ dừng ở việc yêu cầu của A có căn cứ cần xem xét, chưa coi quyền trên toàn bộ phần đất đã được chứng minh.',
    ].join('\n\n'))]);
    continue;
  }
  for (const [name, content] of inputs) {
    if (label === 'review' && name !== 'answered') continue;
    const history = name === 'answered' ? [{ _id: 'question', sender_type: 'ai_judge', content: 'Bạn dựa vào bản gốc hay nội dung được bản án thuật lại?' }] : [];
    await run(name, session, [...history, user(content)]);
  }
  let records = [];
  for (const [index, content] of [inputs[3][1], inputs[4][1], 'Tôi đã phân biệt bản gốc và nội dung được thuật lại. Luận điểm của tôi là phải đối chiếu phạm vi diện tích, không phủ nhận toàn bộ giá trị giấy chứng nhận.'].entries()) {
    // JSON round-trip mô phỏng dữ liệu nạp lại; kiểm thử HTTP/reload nằm trong E2E.
    records = JSON.parse(JSON.stringify([...records, user(content)]));
    records.push(...await run(`multi-${index + 1}`, { ...session, turn_count: index }, records));
  }
  if (label !== 'review') await run('scoring', session, records, true);
}
await save();
