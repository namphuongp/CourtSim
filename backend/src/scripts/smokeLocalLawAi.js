import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { researchLegalBasis } from '../services/legalResearchService.js';
import { generateDebateTurn } from '../services/simulationService.js';
import { searchLegalWeb } from '../services/aiClient.js';
import { AiPersonal } from '../models/index.js';

// Tình huống tổng hợp công khai; không đọc hồ sơ Case1 hay phiên người dùng.
const courtCase = { title: 'Thực hành hòa giải tranh chấp đất đai', category: 'đất đai',
  summary: 'Hai bên chưa thống nhất quyền sử dụng đất. Bài tập chưa cung cấp giấy chứng nhận hay biên bản hòa giải.',
  full_document: 'Bài tập tổng hợp: chưa có giấy chứng nhận hoặc biên bản hòa giải được cung cấp.' };
const records = [{ sender_type: 'user', content: 'Tôi viện dẫn Điều 202 Luật 45/2013/QH13 về hòa giải tranh chấp đất đai. Tôi cho rằng cần xác định vụ việc đã qua hòa giải hay chưa; tôi chưa dùng điều luật này để chứng minh bên nào có quyền sử dụng đất.' }];
try {
  await connectDatabase();
  const legal = await researchLegalBasis({ courtCase, records, eventDate: '2018-08-07', online: false });
  const turns = await generateDebateTurn({ courtCase, records, session: { case_event_date: '2018-08-07', user_court_role: 'plaintiff_lawyer', phase: 'debate', turn_count: 1 }, speakers: ['opponent'] }, { research: async () => legal });
  const persona = await AiPersonal.findOne({ role_name: 'evaluator' }).lean();
  const urls = await searchLegalWeb({ model: persona.model_id, query: 'Pháp luật Việt Nam về tranh chấp đất đai. Tìm toàn văn Bộ luật Tố tụng dân sự 92/2015/QH13 Điều 91 về nghĩa vụ chứng minh. Tìm nguồn từ nhiều website nếu có.' });
  await writeFile(new URL('../../../reports/LEGAL_LOCAL_AI_SMOKE.json', import.meta.url), JSON.stringify({ checked_at: new Date(),
    source: legal.citations.map(c => ({ law: c.law_number, article: c.article, source: c.source_verification, url: c.source_url })),
    turns, web_urls: urls }, null, 2));
  console.log(JSON.stringify({ local_sources: legal.citations.length, turns: turns.length, mode: turns[0]?.generation_mode,
    cited_sources: turns[0]?.citations?.length, web_domains: [...new Set(urls.map(u => new URL(u).hostname))] }));
} finally { await disconnectDatabase(); }
