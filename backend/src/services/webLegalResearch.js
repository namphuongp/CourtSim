import { createHash } from 'node:crypto';
import { AiPersonal } from '../models/index.js';
import WebLawSnapshot from '../models/WebLawSnapshot.js';
import { searchLegalWeb } from './aiClient.js';
import { fetchPublicLawPage } from './publicWebPage.js';
import { htmlText } from './vbplResearch.js';
import { parseLegalArticles, getProvisionLocator } from './legalTextParser.js';
import { normalizeLegalSearchText } from './legalTextSearch.js';
import { hasReadableLawSource, isPublicWebUrl } from '../../../shared/legalSourcePolicy.mjs';
import { permittedLegalSource } from './legalUsagePolicy.js';

export const WEB_REFERENCE_NOTE = 'Điểm tham khảo từ nguồn web đã đọc được; chưa xác minh đầy đủ hiệu lực, sửa đổi và điều kiện áp dụng.';
export const webReferenceEnabled = () => process.env.LEGAL_WEB_REFERENCE_SCORING === 'true';
const TTL = 6 * 60 * 60 * 1000;
const pending = new Map();
// Chỉ gửi từ khóa pháp luật và số điều/số hiệu công khai; không gửi tên người, địa chỉ hoặc lời khai lên bộ tìm kiếm.
const TOPICS = ['quyền sử dụng đất', 'đất đai', 'giấy chứng nhận', 'chia đất', 'tặng cho', 'chuyển nhượng', 'bồi thường', 'thiệt hại', 'thừa kế', 'hợp đồng', 'giao dịch', 'nghĩa vụ', 'chứng cứ', 'chứng minh', 'kháng cáo', 'phúc thẩm', 'tố tụng dân sự'];

export function readWebArticles(text) {
  const articles = parseLegalArticles(text.replace(/\[\s*sửa\s*\]/giu, ''));
  const groups = new Map();
  for (const article of articles) {
    const body = article.text.slice(article.text.indexOf('\n') + 1);
    // Mục lục có số điều nhưng không có quy định: không được đưa vào nguồn chấm.
    if (article.text.indexOf('\n') < 0 || (body.match(/\p{L}+/gu) ?? []).length < 8) continue;
    const group = groups.get(article.article) ?? new Map();
    group.set(article.text.replace(/\s+/gu, ' ').trim(), article);
    groups.set(article.article, group);
  }
  // Có hai nội dung khác nhau cùng số điều thì chưa chọn được bản chuẩn trên trang.
  return [...groups.values()].filter(group => group.size === 1).map(group => [...group.values()][0]);
}

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
    query: ['Pháp luật Việt Nam về tranh chấp đất đai.', year ? `Mốc tham khảo bài tập: ${year}, chưa xác định đầy đủ các thời điểm áp dụng.` : '', 'Tìm nguyên văn văn bản và điều khoản liên quan:', ...numbers, ...articles, ...topics].join(' ') } : null;
}

export function parseWebLawPage(page, now = new Date()) {
  if (!isPublicWebUrl(page.url)) return null;
  if (!permittedLegalSource(page.url)) return null;
  const text = htmlText(page.content);
  if (/Sorry, you have been blocked|Access denied|Just a moment/iu.test(text)) return null;
  // Chỉ nhận trang chứa dấu hiệu văn bản Việt Nam và số hiệu; không lấy bài tổng hợp chỉ nhắc điều luật.
  if (!/CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/iu.test(text)) return null;
  const number = text.match(/Số\s*(?:ký hiệu|hiệu)?\s*[:：]\s*(\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30})/iu)?.[1]?.toUpperCase();
  if (!number) return null;
  const title = htmlText(page.content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1]
    ?? page.content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1] ?? '').slice(0, 500);
  if (!title || !readWebArticles(text).length) return null;
  return { source_url: page.url, law_number: number, title, source_text: text,
    document_type: title.match(/Bộ luật|Luật|Nghị định|Nghị quyết|Thông tư/iu)?.[0] ?? 'Văn bản pháp luật',
    source_sha256: createHash('sha256').update(page.content).digest('hex'), checked_at: now.toISOString(), parser_version: 1,
    source_verification: 'web_read', law_country: 'VN', research_scope: 'land_dispute',
    version: `Nội dung trang đọc ngày ${now.toISOString().slice(0, 10)}; chưa xác minh hiệu lực` };
}

export function webReferenceCitations(snapshots, search, now = new Date()) {
  if (!search) return [];
  let length = 0;
  const ranked = snapshots.filter(s => permittedLegalSource(s.source_url) && hasReadableLawSource(s) && s.parser_version === 1 && now - new Date(s.checked_at) <= TTL
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
  }).map(({ snapshot: s, article }) => ({
    id: `WEB-${createHash('sha256').update(`${s.source_sha256}:${article.article}`).digest('hex').slice(0, 24)}`,
    law_number: s.law_number, title: s.title, document_type: s.document_type, article: article.article,
    paragraph: null, point: null, locator: getProvisionLocator(article), text: article.text, context_text: article.text,
    source_url: s.source_url, source_verification: 'web_read', source_sha256: s.source_sha256,
    law_country: 'VN', research_scope: 'land_dispute',
    checked_at: s.checked_at, version: s.version, retrieval_mode: 'cache',
    verification_status: 'unverified', application_status: 'unverified', application_date: null,
    application_reason: WEB_REFERENCE_NOTE, temporal_note: WEB_REFERENCE_NOTE, assessment_mode: 'web_reference',
  }));
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
  const snapshots = await cache.find(search);
  let citations = webReferenceCitations(snapshots, search, now);
  if (citations.length || process.env.LEGAL_ONLINE_LOOKUP === 'false') return { citations, warnings: citations.length ? [WEB_REFERENCE_NOTE] : ['Tra cứu web đang tắt hoặc bản lưu chưa đủ nội dung.'] };
  // Chỉ gộp việc tải nguồn công khai; không chia sẻ nội dung phiên giữa người học.
  const key = search.query;
  if (!pending.has(key)) pending.set(key, (async () => {
    const persona = await (dependencies.persona ?? (() => AiPersonal.findOne({ role_name: 'evaluator' }).lean()))();
    const urls = await (dependencies.discover ?? searchLegalWeb)({ model: persona?.model_id, query: search.query, usageContext: input.usageContext });
    const pages = await Promise.allSettled(urls.filter(url => permittedLegalSource(url)).slice(0, 4).map(url => (dependencies.fetchPage ?? fetchPublicLawPage)(url)));
    const found = [];
    for (const page of pages) {
      if (page.status !== 'fulfilled') continue;
      const snapshot = parseWebLawPage(page.value, now);
      if (!snapshot?.source_text) continue;
      await cache.save(snapshot); found.push(snapshot);
    }
    return found;
  })());
  try {
    const loaded = await pending.get(key);
    citations = webReferenceCitations(loaded, search, now).map(c => ({ ...c, retrieval_mode: 'live' }));
    return { citations, warnings: citations.length ? [WEB_REFERENCE_NOTE] : ['Đã tìm web nhưng chưa đọc được nguyên văn điều khoản Việt Nam phù hợp; chưa chấm phần luật.'] };
  } catch (error) {
    console.warn('WEB_LAW_LOOKUP_FAILED', { code: error.code ?? error.name });
    return { citations: [], warnings: ['Công cụ tìm kiếm hoặc nguồn luật chưa truy cập được; phần luật chưa được chấm.'] };
  } finally { pending.delete(key); }
}
