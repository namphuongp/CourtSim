import { createHash } from 'node:crypto';
import { AiPersonal } from '../models/index.js';
import WebLawSnapshot from '../models/WebLawSnapshot.js';
import { searchLegalWeb } from './aiClient.js';
import { fetchPublicLawPage } from './publicWebPage.js';
import { readWebArticles } from './webLawParser.js';
export { readWebArticles, parseWebLawPage } from './webLawParser.js';
import { getProvisionLocator } from './legalTextParser.js';
import { normalizeLegalSearchText } from './legalTextSearch.js';
import { hasReadableLawSource, hasVerifiedSource, isOfficialLawUrl } from '../../../shared/legalSourcePolicy.mjs';
import { permittedLegalSource } from './legalUsagePolicy.js';
import { loadPublicLaw, publicLawTargets } from './publicLawCatalog.js';
import { buildLegalPlan } from './legalTimeline.js';

export const WEB_REFERENCE_NOTE = 'Đánh giá tham khảo cho bài luyện tập, dựa trên điều luật được trích dẫn.';
export const webReferenceEnabled = () => process.env.LEGAL_WEB_REFERENCE_SCORING !== 'false';
const TTL = 6 * 60 * 60 * 1000;
const pending = new Map();
// Chỉ gửi từ khóa pháp luật và số điều/số hiệu công khai; không gửi tên người, địa chỉ hoặc lời khai lên bộ tìm kiếm.
const TOPICS = ['tặng cho', 'chuyển nhượng', 'ranh giới', 'lấn chiếm', 'hòa giải', 'giấy chứng nhận', 'chia đất', 'bồi thường', 'thiệt hại', 'thừa kế', 'hợp đồng', 'giao dịch', 'nghĩa vụ', 'chứng cứ', 'chứng minh', 'kháng cáo', 'phúc thẩm', 'tố tụng dân sự', 'quyền sử dụng đất', 'đất đai'];

export function legalWebQuery({ courtCase = {}, records = [], question = '', eventDate, learnerTimeline }) {
  const latest = [question, ...records.filter(r => r.sender_type === 'user').slice(-3).map(r => r.content)].join(' ');
  const context = `${latest} ${courtCase.category ?? ''} ${courtCase.summary ?? ''}`;
  const folded = normalizeLegalSearchText(context);
  if (!/dat dai|quyen su dung dat|tranh chap dat|chia dat/iu.test(folded)) return null;
  const topics = TOPICS.filter(topic => folded.includes(normalizeLegalSearchText(topic))).slice(0, 12);
  const claims = [question, ...records.filter(r => r.sender_type === 'user').map(r => r.content)].join(' ');
  const numbers = [...new Set((claims.match(/\b\d{1,4}\/\d{4}\/[A-ZĐ][A-ZĐ0-9-]{1,20}\b/giu) ?? []).map(n => n.toUpperCase()))].slice(0, 8);
  const articles = [...new Set(claims.match(/điều\s+\d{1,4}[a-z]?/giu) ?? [])].slice(0, 8);
  const plannedNumbers = [...new Set(buildLegalPlan(courtCase, eventDate, learnerTimeline).flatMap(p => p.law_numbers))].filter(n => /^\d+\//u.test(n));
  const year = /^\d{4}-\d{2}-\d{2}$/u.test(eventDate ?? '') ? eventDate.slice(0, 4) : null;
  return topics.length || numbers.length ? { topics, numbers, articles, plannedNumbers,
    query: ['Pháp luật Việt Nam về tranh chấp đất đai. Tìm nhiều nguồn, không giới hạn website. Ưu tiên văn bản gốc từ Chính phủ, Công báo, Quốc hội hoặc cơ quan ban hành. Đối chiếu số hiệu, nguyên văn, hiệu lực, sửa đổi, thay thế và chuyển tiếp.', year ? `Mốc tham khảo bài tập: ${year}, cần kiểm tra phiên bản phù hợp thời điểm này.` : '', 'Tìm nguyên văn văn bản và điều khoản liên quan:', ...new Set([...numbers, ...plannedNumbers]), ...articles, ...topics].join(' ') } : null;
}

export function webReferenceCitations(snapshots, search, now = new Date()) {
  if (!search) return [];
  let length = 0;
  const required = [...new Set([...search.numbers, ...(search.plannedNumbers ?? [])])];
  const allowed = required.length ? [...required, '91/2015/QH13', '92/2015/QH13'] : [];
  const ranked = snapshots.filter(s => permittedLegalSource(s.source_url) && hasReadableLawSource(s) && (hasVerifiedSource(s) ? s.parser_version === 2 : s.parser_version === 1) && now - new Date(s.checked_at) >= 0 && now - new Date(s.checked_at) <= TTL
    && (!allowed.length || allowed.includes(s.law_number)))
    .flatMap(snapshot => readWebArticles(snapshot.source_text).map(article => {
      const text = normalizeLegalSearchText(article.text);
      const score = search.topics.reduce((n, topic) => n + Number(text.includes(normalizeLegalSearchText(topic))), 0)
        + (search.articles.some(a => a.match(/\d+[a-z]?/iu)?.[0] === article.article) ? 5 : 0);
      return { snapshot, article, score };
    })).filter(item => item.score > 0 && item.article.text.length <= 8000).sort((a, b) => b.score - a.score);
  const seen = new Set();
  // Ưu tiên điều đã viện dẫn và ít nhất một điều liên quan mỗi luật cần tra, tránh một luật chiếm hết ngữ cảnh.
  const prioritized = [
    ...ranked.filter(({ article }) => search.articles.some(a => a.match(/\d+[a-z]?/iu)?.[0] === article.article)),
    ...required.map(number => ranked.find(({ snapshot }) => snapshot.law_number === number)).filter(Boolean),
    ...ranked,
  ];
  return prioritized.filter(({ snapshot, article }) => {
    const key = `${snapshot.law_number}:${article.article}`;
    if (seen.has(key) || seen.size >= 8 || length + article.text.length > 24000) return false;
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
  find: search => {
    const required = [...new Set([...search.numbers, ...search.plannedNumbers])];
    const numbers = required.length ? [...required, '91/2015/QH13', '92/2015/QH13'] : [];
    return WebLawSnapshot.find({ ...(numbers.length ? { law_number: { $in: numbers } } : {}), checked_at: { $gte: new Date(Date.now() - TTL) } }).sort({ checked_at: -1 }).limit(30).lean();
  },
  save: snapshot => WebLawSnapshot.updateOne({ source_url: snapshot.source_url }, { $set: snapshot }, { upsert: true, runValidators: true }),
};

export async function researchWebLaw(input, dependencies = {}) {
  const search = legalWebQuery(input);
  if (!search) return { citations: [], warnings: ['Chưa xác định được chủ đề luật cần tìm.'] };
  const cache = dependencies.cache ?? repository;
  const now = dependencies.now ?? new Date();
  const coveredBy = sources => sources.length
    && [...search.numbers, ...search.plannedNumbers].every(n => sources.some(c => c.law_number === n))
    && search.articles.every(a => sources.some(c => c.article === a.match(/\d+[a-z]?/iu)?.[0]));
  // Cache hỏng vẫn tìm trực tiếp. Tái dùng nguồn trong TTL nhưng giữ nguyên mức xác minh.
  let snapshots = [];
  try { snapshots = await cache.find(search); } catch { /* Tiếp tục với nguồn công khai. */ }
  let citations = webReferenceCitations(snapshots, search, now);
  const covered = coveredBy(citations);
  if (covered || input.online === false || process.env.LEGAL_ONLINE_LOOKUP === 'false') return { citations, warnings: citations.length ? [WEB_REFERENCE_NOTE] : ['Tra cứu web đang tắt hoặc bản lưu chưa đủ nội dung.'] };
  // Chỉ gộp việc tải nguồn công khai; không chia sẻ nội dung phiên giữa người học.
  const key = `${search.query}:${search.plannedNumbers.join(',')}`;
  if (!pending.has(key)) pending.set(key, (async () => {
    const found = [], diagnostics = [];
    const visited = new Set();
    const load = async targets => {
      // Giới hạn hai tài liệu cùng lúc để tránh giữ nhiều PDF trong bộ nhớ.
      for (let i = 0; i < targets.length; i += 2) {
        const batch = await Promise.all(targets.slice(i, i + 2).filter(t => !visited.has(t.url)).map(target => {
          visited.add(target.url);
          return loadPublicLaw(target, { now, fetchPage: dependencies.fetchPage ?? fetchPublicLawPage });
        }));
        for (const result of batch) {
          diagnostics.push(...result.diagnostics);
          for (const snapshot of result.snapshots) {
            try { await cache.save(snapshot); } catch { /* Vẫn dùng toàn văn vừa tải nếu cache lỗi. */ }
            found.push(snapshot);
          }
        }
      }
    };
    await load(dependencies.catalogue ?? publicLawTargets(input, search));
    const hasCoverage = webReferenceCitations([...found, ...snapshots], search, now);
    const enough = coveredBy(hasCoverage);
    if (!enough) {
      try {
        const persona = await (dependencies.persona ?? (() => AiPersonal.findOne({ role_name: 'evaluator' }).lean()))();
        const urls = await (dependencies.discover ?? searchLegalWeb)({ model: process.env.AI_EVALUATOR_MODEL || persona?.model_id, query: search.query, usageContext: input.usageContext });
        await load(urls.filter(url => permittedLegalSource(url)).slice(0, 4).map(url => ({ url })));
      } catch (error) { diagnostics.push({ reason: 'search_unavailable', code: error.code ?? error.name }); }
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
