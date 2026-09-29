import 'dotenv/config';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { answerLegalQuestion } from '../services/legalAssistantService.js';
import { lookupVbpl } from '../services/vbplResearch.js';
import { researchCorpus } from '../services/legalCorpusRetrieval.js';

// API loopback kiểm tra service thật, chỉ câu hỏi công khai; không tạo tài khoản/phiên.
process.env.LEGAL_WEB_REFERENCE_SCORING = 'false';
const questions = ['Điều 202 Luật 45/2013/QH13 về hòa giải tranh chấp đất đai',
  'Điều 252 Luật 31/2024/QH15 về hiệu lực của Luật Đất đai', 'Điều 999 Luật 13/2003/QH11 về tranh chấp đất đai'];
const courtCase = { title: 'Bài kiểm thử tranh chấp đất đai tổng hợp', category: 'đất đai' };
let server;
try {
  await connectDatabase();
  server = createServer(async (req, res) => {
    const question = new URL(req.url, 'http://127.0.0.1').searchParams.get('q');
    if (!questions.includes(question)) { res.writeHead(400).end(); return; }
    try {
      const answer = await answerLegalQuestion({ session: {}, courtCase, question });
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer));
    } catch { res.writeHead(503).end(JSON.stringify({ error: 'SOURCE_UNAVAILABLE' })); }
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const results = [];
  for (const question of questions) {
    let start = performance.now();
    const before = await lookupVbpl({ question, courtCase });
    const beforeMs = performance.now() - start;
    start = performance.now(); await researchCorpus({ question, courtCase });
    const retrievalMs = performance.now() - start;
    start = performance.now();
    const response = await fetch(`http://127.0.0.1:${server.address().port}/?q=${encodeURIComponent(question)}`);
    const answer = await response.json();
    results.push({ question, before_direct_official_ms: Math.round(beforeMs), before_result_count: before.results.length,
      after_local_retrieval_ms: Math.round(retrievalMs), after_loopback_answer_ms: Math.round(performance.now() - start), status: response.status, answer });
  }
  await writeFile(new URL('../../../reports/LEGAL_CORPUS_LIVE_QUERIES.json', import.meta.url), JSON.stringify({
    checked_at: new Date().toISOString(), scope: 'Real MongoDB and live vbpl.vn; loopback service API, no LLM, no session writes', results }, null, 2));
  console.log(JSON.stringify(results.map(({ question, status, before_direct_official_ms, after_local_retrieval_ms, after_loopback_answer_ms, answer }) => ({ question, status, before_direct_official_ms, after_local_retrieval_ms, after_loopback_answer_ms, citations: answer.citations?.length }))));
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await disconnectDatabase();
}
