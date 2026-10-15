import { buildLegalPlan } from './legalTimeline.js';
import { fetchPublicLawPage } from './publicWebPage.js';
import { lawPdfLinks, parseWebLawPage } from './webLawParser.js';

// Địa chỉ xuất bản công khai, không chứa nội dung phiên hay dữ liệu người học.
const CATALOG = Object.freeze({
  '13/2003/QH11': 'https://chinhphu.vn/default.aspx?docid=32479&pageid=27160',
  '45/2013/QH13': 'https://congbao.chinhphu.vn/van-ban/luat-so-45-2013-qh13-5391/6773.htm',
  '31/2024/QH15': 'https://vanban.chinhphu.vn/?classid=1&docid=211189&orggroupid=1&pageid=27160',
  '91/2015/QH13': 'https://congbao.chinhphu.vn/tai-ve-van-ban-so-91-2015-qh13-18397-12965?format=pdf',
  '92/2015/QH13': 'https://congbao.chinhphu.vn/van-ban/luat-so-92-2015-qh13-18411/28624.htm',
});

export function publicLawTargets(input, search) {
  const planned = buildLegalPlan(input.courtCase ?? {}, input.eventDate, input.learnerTimeline).flatMap(p => p.law_numbers);
  const numbers = [...new Set([...search.numbers, ...planned, ...(!planned.length ? ['45/2013/QH13'] : []), '92/2015/QH13', '91/2015/QH13'])];
  return numbers.filter(number => CATALOG[number]).slice(0, 5).map(number => ({ url: CATALOG[number], law_number: number }));
}

export async function loadPublicLaw(target, { fetchPage = fetchPublicLawPage, now = new Date() } = {}) {
  const diagnostics = [], snapshots = [];
  const read = async (url, attachments) => {
    try {
      const page = await fetchPage(url);
      const snapshot = parseWebLawPage(page, now);
      const matched = snapshot && (!target.law_number || snapshot.law_number === target.law_number);
      diagnostics.push({ url, final_url: page.url, reason: matched ? 'document_content' : snapshot ? 'wrong_document' : 'identity_or_content_missing' });
      if (matched) snapshots.push(snapshot);
      // Trang thuộc tính không có toàn văn: đọc các PDF đính kèm, không dò URL tùy ý.
      if (!snapshot && attachments) for (const link of lawPdfLinks(page)) await read(link, false);
    } catch (error) {
      diagnostics.push({ url, reason: 'fetch_failed', code: error.code ?? error.message, http_status: error.http_status ?? null });
    }
  };
  await read(target.url, true);
  return { snapshots, diagnostics };
}
