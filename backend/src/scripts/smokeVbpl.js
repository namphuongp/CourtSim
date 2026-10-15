import { mkdir, writeFile } from 'node:fs/promises';
import { fetchOfficialPage } from '../services/officialLegalSources.js';
import { lookupVbpl, inspectVbplPage, htmlText } from '../services/vbplResearch.js';

// Kiểm tra mạng thật không chạm DB/tài khoản, không chuyển sang website khác.
const report = { checked_at: new Date().toISOString(), pages: [], questions: [] };
const targets = [
  ['https://vbpl.vn/', null],
  ['https://vbpl.vn/bonoivu/Pages/vbpq-toanvan.aspx?ItemID=32833', '45/2013/QH13'],
  ['https://vbpl.vn/van-ban/chi-tiet/van-ban-hop-nhat-so-11-vbhn-vpqh-to-tung-dan-su--175590', '11/VBHN-VPQH'],
];
for (const [url, number] of targets) {
  try {
    const page = await fetchOfficialPage(url);
    const { snapshot, reason } = inspectVbplPage(page, number);
    report.pages.push({ requested_url: url, final_url: page.url, http_status: page.http_status, sha256: page.sha256,
      redirects: page.redirects, reason, visible_excerpt: htmlText(page.content).slice(0, 300),
      document_verified: Boolean(snapshot), content_verified: Boolean(snapshot?.source_text),
      note: snapshot?.source_text ? 'Đối chiếu được nội dung.' : 'Chưa đối chiếu được nội dung văn bản/điều khoản.' });
  } catch (error) { report.pages.push({ requested_url: url, document_verified: false, note: error.name === 'TimeoutError' ? 'Hết thời gian chờ nguồn.' : 'Chưa truy cập được nguồn.' }); }
}
const cache = { find: async () => [], save: async () => {} };
for (const question of ['Điều 202 Luật Đất đai 45/2013/QH13', 'Luật Đất đai 31/2024/QH15', 'Bộ luật Dân sự 91/2015/QH13', '11/VBHN-VPQH', 'Luật Đất đai']) {
  const result = await lookupVbpl({ question }, { cache, enabled: true });
  report.questions.push({ question, source_status: result.source_status, diagnostics: result.diagnostics,
    results: result.results.map(({ law_number, source_url, checked_at, source_verification, verification_status }) => ({ law_number, source_url, checked_at, source_verification, verification_status })) });
}
const reportDirectory = new URL('../../../.test-artifacts/', import.meta.url);
await mkdir(reportDirectory, { recursive: true });
await writeFile(new URL('VBPL_LIVE_CHECK.json', reportDirectory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
