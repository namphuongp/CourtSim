import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchPublicLawPage } from '../services/publicWebPage.js';

// Dữ liệu công khai/giả lập; không kết nối MongoDB và không gọi model tính phí.
process.env.JWT_SECRET ||= 'public-source-smoke-only-not-a-server-secret';
const { researchLegalBasis } = await import('../services/legalResearchService.js');
const { researchWebLaw } = await import('../services/webLegalResearch.js');
const { legalScoringBasis, scoringCitationIds } = await import('../services/scoringBasis.js');
const input = { courtCase: { title: 'Tranh chấp đất đai', category: 'đất đai', summary: 'Chứng minh quyền sử dụng đất.' }, eventDate: '2018-08-07',
  records: [{ sender_type: 'user', content: 'Tôi đối chiếu chứng cứ với Điều 91 Bộ luật 92/2015/QH13 và Điều 203 Luật đất đai 45/2013/QH13.' }] };
const saved = [];
let fetches = 0;
const dependencies = { cache: { find: async () => saved, save: async snapshot => saved.push(snapshot) },
  fetchPage: async url => { fetches++; return fetchPublicLawPage(url); }, persona: async () => null,
  discover: async () => { throw Error('SEARCH_DISABLED_FOR_PUBLIC_SMOKE'); } };
const web = await researchWebLaw(input, dependencies);
const context = await researchLegalBasis(input, {
  corpus: async () => ({ citations: [], candidates: [], issues: [], warnings: [], legal_assessment_available: false }), web: async () => web,
});
const basis = legalScoringBasis(context, input.records);
const requestsBeforeCache = fetches;
await researchWebLaw(input, dependencies);
const report = { mode: context.legal_assessment_mode, content: basis.content, application: basis.application,
  fetches, cache_reused: fetches === requestsBeforeCache,
  citations: context.citations.map(c => ({ law: c.law_number, article: c.article, url: c.source_url, source_verification: c.source_verification, application_status: c.application_status })),
  diagnostics: web.diagnostics, evaluator: 'not_called' };
const directory = new URL('../../../.test-artifacts/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('public-law-smoke.json', directory), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.equal(basis.content, true);
assert.equal(basis.application, true);
assert.equal(context.legal_assessment_mode, 'web_reference');
assert.ok(scoringCitationIds('2.3', basis).length);
assert.ok(report.cache_reused);
