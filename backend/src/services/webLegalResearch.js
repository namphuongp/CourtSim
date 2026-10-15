import { createHash } from 'node:crypto';
import { AiPersonal } from '../models/index.js';
import WebLawSnapshot from '../models/WebLawSnapshot.js';
import { searchLegalWeb } from './aiClient.js';
import { fetchPublicLawPage } from './publicWebPage.js';
import { readWebArticles, parseWebLawPage } from './webLawParser.js';
export { readWebArticles, parseWebLawPage } from './webLawParser.js';
import { getProvisionLocator } from './legalTextParser.js';
import { normalizeLegalSearchText } from './legalTextSearch.js';
import { hasReadableLawSource, hasVerifiedSource, isOfficialLawUrl } from '../../../shared/legalSourcePolicy.mjs';
import { permittedLegalSource } from './legalUsagePolicy.js';

export const WEB_REFERENCE_NOTE = 'Điểm tham khảo từ nguồn web đã đọc được, chưa xác minh đầy đủ hiệu lực, sửa đổi và điều kiện áp dụng.';
export const webReferenceEnabled = () => process.env.LEGAL_WEB_REFERENCE_SCORING !== 'false';
const TTL = 6 * 60 * 60 * 1000;
const pending = new Map();
// Chỉ gửi từ khóa pháp luật và số điều/số hiệu công khai; không gửi tên người, địa chỉ hoặc lời khai lên bộ tìm kiếm.
const TOPICS = ['quyền sử dụng đất', 'đất đai', 'giấy chứng nhận', 'chia đất', 'tặng cho', 'chuyển nhượng', 'bồi thường', 'thiệt hại', 'thừa kế', 'hợp đồng', 'giao dịch', 'nghĩa vụ', 'chứng cứ', 'chứng minh', 'kháng cáo', 'phúc thẩm', 'tố tụng dân sự'];

export function legalWebQuery({ courtCase = {}, records = [], question = '', eventDate }) {
  const latest = [question, ...records.filter(r => r.sender_type === 'user').slice(-3).map(r => r.content)].join(' ');
  const context = `${latest} ${courtCase.category ?? ''} ${courtCase.summary ?? ''}`;
  const folded = normalizeLegalSearchText(context);
  if (!/dat dai|quyen su dung dat|tranh chap dat|chia dat/iu.test(folded)) return null;
  const topics = TOPICS.filter(topic => folded.includes(normalizeLegalSearchText(topic))).slice(0, 8);
  const numbers = [...new Set(latest.match(/\b\d{1,4}\/\d{4}\/[A-ZĐ][A-ZĐ0-9-]{1,20}\b/giu) ?? [])].slice(0, 3);
  const articles = [...new Set(latest.match(/điều\s+\d{1,4}[a-z]?/giu) ?? [])].slice(0, 3);
  const year = /^\d{4}-\d{2}-\d{2}$/u.test(eventDate ?? '') ? eventDate.slice(0, 4) : null;
  return topics.length || numbers.length ? { topics, numbers, articles,
    query: ['Pháp luật Việt Nam về tranh chấp đất đai. Tìm nhiều nguồn, không giới hạn website. Ưu tiên văn bản gốc từ Chính phủ, Công báo, Quốc hội hoặc cơ quan ban hành. Đối chiếu số hiệu, nguyên văn, hiệu lực, sửa đổi, thay thế và chuyển tiếp.', year ? `Mốc tham khảo bài tập: ${year}, cần kiểm tra phiên bản phù hợp thời điểm này.` : '', 'Tìm nguyên văn văn bản và điều khoản liên quan:', ...numbers, ...articles, ...topics].join(' ') } : null;
}

export function webReferenceCitations(snapshots, search, now = new Date()) {
  if (!search) return [];
  let length = 0;
  const ranked = snapshots.filter(s => permittedLegalSource(s.source_url) && hasReadableLawSource(s) && (hasVerifiedSource(s) ? s.parser_version === 2 : s.parser_version === 1) && now - new Date(s.checked_at) >= 0 && now - new Date(s.checked_at) <= TTL
    && (!search.numbers.length || search.numbers.includes(s.law_number)))
    .flatMap(snapshot => readWebArticles(snapshot.source_text).map(article => {
      const text = normalizeLegalSearchText(article.text);
      const score = search.topics.reduce((n, topic) => n + Number(text.includes(normalizeLegalSearchText(topic))), 0)
        + (search.articles.some(a => a.match(/\d+[a-z]?/iu)?.[0] === article.article) ? 5 : 0);
      return { snapshot, article, score };
    })).filter(item => item.score > 0 && item.article.text.length <= 8000).sort((a, b) => b.score - a.score);
  const seen = new Set();
  return ranked.filter(({ snapshot, article }) => {
    const key = `${snapshot.law_number}:${article.article}:${snapshot.source_sha256}`;
    if (seen.has(key) || seen.size >= 5 || length + article.text.length > 16000) return false;
    seen.add(key); length += article.text.length; return true;
  }).map(({ snapshot: s, article }) => {
    const normalize = value => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
    const contentHash = createHash('sha256').update(normalize(article.text)).digest('hex');
    // Bản đăng lại được đối chiếu theo từng điều với bản chính thức đã tải, không tin nhãn của website.
    const evidence = snapshots.filter(other => hasVerifiedSource(other) && isOfficialLawUrl(other.source_url)
      && other.law_number === s.law_number && now - new Date(other.checked_at) >= 0 && now - new Date(other.checked_at) <= TTL
      && readWebArticles(other.source_text).some(a => a.article === article.article && normalize(a.text) === normalize(article.text)))
      .map(other => ({ source_url: other.source_url, source_sha256: other.source_sha256, checked_at: other.checked_at,
        law_number: s.law_number, article: article.article, content_sha256: contentHash }));
    const verified = hasVerifiedSource(s) || evidence.length > 0;
    return {
    id: `WEB-${createHash('sha256').update(`${s.source_sha256}:${article.article}`).digest('hex').slice(0, 24)}`,
    law_number: s.law_number, title: s.title, document_type: s.document_type, article: article.article,
    paragraph: null, point: null, locator: getProvisionLocator(article), text: article.text, context_text: article.text,
    source_url: s.source_url, source_verification: verified ? 'verified' : 'web_read', source_sha256: s.source_sha256,
    content_sha256: contentHash, verification_evidence: evidence,
    law_country: 'VN', research_scope: 'land_dispute',
    checked_at: s.checked_at, version: s.version, retrieval_mode: 'cache',
    verification_status: verified ? 'verified' : 'unverified', application_status: 'unverified', application_date: null,
    application_reason: WEB_REFERENCE_NOTE, temporal_note: WEB_REFERENCE_NOTE, assessment_mode: 'web_reference',
  }; });
}

const repository = {
  find: search => WebLawSnapshot.find({ ...(search.numbers.length ? { law_number: { $in: search.numbers } } : {}), checked_at: { $gte: new Date(Date.now() - TTL) } }).sort({ checked_at: -1 }).limit(30).lean(),
  save: snapshot => WebLawSnapshot.updateOne({ source_url: snapshot.source_url }, { $set: snapshot }, { upsert: true, runValidators: true }),
};

export async function researchWebLaw(input, dependencies = {}) {
  const search = legalWebQuery(input);
  if (!search) return { citations: [], warnings: ['Chưa xác định được chủ đề luật cần tìm.'] };
  const cache = dependencies.cache ?? repository;
  const now = dependencies.now ?? new Date();
  // Cache hỏng vẫn tìm trực tiếp. Tái dùng nguồn trong TTL nhưng giữ nguyên mức xác minh.
  let snapshots = [];
  try { snapshots = await cache.find(search); } catch { /* Tiếp tục với nguồn công khai. */ }
  let citations = webReferenceCitations(snapshots, search, now);
  const covered = citations.length
    && search.numbers.every(n => citations.some(c => c.law_number === n))
    && search.articles.every(a => citations.some(c => c.article === a.match(/\d+[a-z]?/iu)?.[0]));
  if (covered || input.online === false || process.env.LEGAL_ONLINE_LOOKUP === 'false') return { citations, warnings: citations.length ? [WEB_REFERENCE_NOTE] : ['Tra cứu web đang tắt hoặc bản lưu chưa đủ nội dung.'] };
  // Chỉ gộp việc tải nguồn công khai; không chia sẻ nội dung phiên giữa người học.
  const key = search.query;
  if (!pending.has(key)) pending.set(key, (async () => {
    const persona = await (dependencies.persona ?? (() => AiPersonal.findOne({ role_name: 'evaluator' }).lean()))();
    const urls = await (dependencies.discover ?? searchLegalWeb)({ model: persona?.model_id, query: search.query, usageContext: input.usageContext });
    const selected = urls.filter(url => permittedLegalSource(url)).slice(0, 4);
    const pages = await Promise.allSettled(selected.map(url => (dependencies.fetchPage ?? fetchPublicLawPage)(url)));
    const found = [], diagnostics = [];
    for (const [index, page] of pages.entries()) {
      if (page.status !== 'fulfilled') {
        diagnostics.push({ url: selected[index], reason: 'fetch_failed', http_status: page.reason?.http_status ?? null });
        continue;
      }
      const snapshot = parseWebLawPage(page.value, now);
      diagnostics.push({ url: selected[index], final_url: page.value.url, reason: snapshot ? 'document_content' : 'identity_or_content_missing' });
      if (!snapshot?.source_text) continue;
      try { await cache.save(snapshot); } catch { /* Lỗi lưu cache không làm mất nguồn vừa đọc. */ }
      found.push(snapshot);
    }
    return { found, diagnostics };
  })());
  try {
    const { found: loaded, diagnostics } = await pending.get(key);
    const liveHashes = new Set(loaded.map(s => s.source_sha256));
    citations = webReferenceCitations([...loaded, ...snapshots], search, now).map(c => ({ ...c, retrieval_mode: liveHashes.has(c.source_sha256) ? 'live' : 'cache' }));
    return { citations, diagnostics, warnings: citations.length ? [WEB_REFERENCE_NOTE] : ['Đã tìm web nhưng chưa đọc được nguyên văn điều khoản Việt Nam phù hợp, chưa chấm phần luật.'] };
  } catch (error) {
    console.warn('WEB_LAW_LOOKUP_FAILED', { code: error.code ?? error.name });
    return { citations, warnings: ['Công cụ tìm kiếm hoặc nguồn luật chưa truy cập được, giữ các nguồn đã đọc trong bản lưu.'] };
  } finally { pending.delete(key); }
}
