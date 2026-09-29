import { createHash } from 'node:crypto';
import VbplSnapshot from '../models/VbplSnapshot.js';
import { legalAuthorities } from '../data/legalAuthorities.js';
import { fetchOfficialPage, isOfficialUrl } from './officialLegalSources.js';
import { parseLegalArticles, createProvisionUnits, getProvisionLocator } from './legalTextParser.js';
import { normalizeLegalSearchText, getLegalSearchTerms } from './legalTextSearch.js';
import { buildLegalPlan } from './legalTimeline.js';
import { hasVerifiedSource } from '../../../shared/legalSourcePolicy.mjs';

const NUMBER = /\b\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30}\b/giu;
const TTL = 6 * 60 * 60 * 1000;
const PARSER_VERSION = 2;
const inFlight = new Map();
const fold = value => normalizeLegalSearchText(value ?? '');
const isBlockedPage = text => /Sorry, you have been blocked|You are unable to access|Access denied/iu.test(text);

const stripInertHtml = html => html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '').replace(/<!--[^]*?-->/gu, '');

export function htmlText(html) {
  // Không chạy mã/HTML; bỏ cả nội dung script, style, template và phần không hiển thị.
  return stripInertHtml(html).replace(/<(?:br|\/p|\/div|\/tr|\/h[1-6]|\/li)\b[^>]*>/giu, '\n')
    .replace(/<[^>]*>/gu, ' ').replace(/&#(x[\da-f]+|\d+);/giu, (_, code) => {
      const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
    }).replace(/&(nbsp|amp|lt|gt|quot|apos);/giu, (_, key) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[key.toLowerCase()])
    .replace(/[\t \r]+/gu, ' ').replace(/ *\n */gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
}

function linksFrom(html, base) {
  const urls = [];
  for (const match of stripInertHtml(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/giu)) {
    try {
      const url = new URL(match[1].replaceAll('&amp;', '&'), base);
      url.hash = '';
      if (isOfficialUrl(url.href) && (/\/van-ban\/chi-tiet\//iu.test(url.pathname) || /\/vbpq-(?:toanvan|thuoctinh)\.aspx$/iu.test(url.pathname))) urls.push(url.href);
    } catch { /* Liên kết hỏng không phải ứng viên. */ }
  }
  return [...new Set(urls)];
}

function fullTextRegion(html) {
  const start = /<(article|div)\b[^>]*>/giu;
  for (const match of html.matchAll(start)) {
    if (match[1].toLowerCase() !== 'article' && !/(?:id|class)=["'][^"']*(?:divContent|content1|full-text|fulltext|document-content)[^"']*["']/iu.test(match[0])) continue;
    const tail = html.slice(match.index + match[0].length);
    const tags = new RegExp(`<(/?)${match[1]}\\b[^>]*>`, 'giu');
    let depth = 1;
    for (const tag of tail.matchAll(tags)) {
      depth += tag[1] ? -1 : 1;
      if (!depth) return tail.slice(0, tag.index);
    }
  }
  return '';
}

export function parseVbplPage(page, expectedNumber, now = new Date()) {
  if (!isOfficialUrl(page.url) || !(/\/van-ban\/chi-tiet\//iu.test(new URL(page.url).pathname) || /\/vbpq-(?:toanvan|thuoctinh)\.aspx$/iu.test(new URL(page.url).pathname))) return null;
  const content = stripInertHtml(page.content);
  const text = htmlText(content);
  if (isBlockedPage(text)) return null;
  // Số hiệu phải ở thuộc tính/đầu văn bản, không phải số được nhắc trong văn bản liên quan.
  const identity = text.match(/(?:Số\s*(?:ký hiệu|hiệu)?\s*[:：]\s*)(\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30})/iu)?.[1]?.toUpperCase();
  if (!identity || (expectedNumber && identity !== expectedNumber.toUpperCase())) return null;
  const heading = content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1];
  const title = text.match(/Trích yếu\s*[:：]?\s*\n?([^\n]{5,500})/iu)?.[1]?.trim() || (heading && htmlText(heading));
  const documentType = text.match(/Loại văn bản\s*[:：]?\s*\n?([^\n]{2,80})/iu)?.[1]?.trim()
    || title?.match(/^(Bộ luật|Luật|Nghị định|Thông tư|Nghị quyết|Quyết định|Văn bản hợp nhất)/iu)?.[1];
  if (!title || !documentType || /(?:không tìm thấy|lỗi truy cập|access denied)/iu.test(title)) return null;
  // Chỉ tách điều trong vùng toàn văn, không lấy mục lục/danh sách văn bản liên quan.
  const sourceText = htmlText(fullTextRegion(content));
  return { source_url: page.url, law_number: identity, title, document_type: documentType,
    source_text: sourceText, source_sha256: createHash('sha256').update(page.content).digest('hex'),
    source_verification: 'verified', checked_at: now.toISOString(), parser_version: PARSER_VERSION,
    version: `Nội dung trang được đối chiếu ngày ${now.toISOString().slice(0, 10)}` };
}

// HTTP 200 có thể chỉ là vỏ giao diện; chẩn đoán không được biến thành chứng nhận nguồn.
export function inspectVbplPage(page, expectedNumber, now = new Date()) {
  const snapshot = parseVbplPage(page, expectedNumber, now);
  if (snapshot) return { snapshot, reason: snapshot.source_text ? 'document_content' : 'document_metadata_only' };
  const text = htmlText(page.content);
  const reason = isBlockedPage(text) ? 'source_blocked' : new URL(page.url).pathname === '/' ? 'homepage'
    : /Đang tải dữ liệu|Đang tải nội dung/iu.test(text) ? 'dynamic_shell'
      : /Số\s*(?:ký hiệu|hiệu)?\s*[:：]/iu.test(text) ? 'identity_or_metadata_mismatch' : 'missing_document_identity';
  return { snapshot: null, reason };
}

export function planAssistantSearch(question, courtCase = {}, eventDate) {
  // URL trong câu hỏi không bao giờ trở thành địa chỉ tải; chỉ gửi từ khóa pháp luật công khai.
  const clean = question.replace(/https?:\/\/\S+/giu, '');
  const explicit = [...new Set((clean.match(NUMBER) ?? []).map(n => n.toUpperCase()))].slice(0, 3);
  const normalized = fold(clean);
  const named = Object.values(legalAuthorities).filter(a => normalized.includes(fold(a.title)));
  let numbers = explicit;
  if (!numbers.length && named.length) {
    const year = clean.match(/\b(19\d{2}|20\d{2})\b/u)?.[0];
    const exactYear = named.filter(a => a.lawNumber.split('/')[1] === year);
    // Khi chỉ biết năm sự kiện, giữ cả hai luật nếu năm giao thời; không tự gán ngày.
    numbers = (exactYear.length ? exactYear : named).map(a => a.lawNumber);
    if (/giao dịch|sự kiện|tranh chấp|năm/iu.test(clean) && year && named.some(a => a.title === 'Luật Đất đai')) {
      const y = Number(year);
      numbers = y < 2004 ? [] : y < 2014 ? ['13/2003/QH11'] : y === 2014 ? ['13/2003/QH11', '45/2013/QH13'] : y < 2024 ? ['45/2013/QH13'] : y === 2024 ? ['45/2013/QH13', '31/2024/QH15'] : ['31/2024/QH15'];
    }
  }
  const plans = buildLegalPlan(courtCase, eventDate);
  if (!numbers.length && !/(?:luật|nghị định|thông tư|nghị quyết)/iu.test(clean)) numbers = [...new Set(plans.flatMap(p => p.law_numbers))].filter(n => /^\d+\//u.test(n)).slice(0, 3);
  return { explicit, numbers, terms: getLegalSearchTerms(clean, 6),
    query: explicit[0] || named[0]?.title || getLegalSearchTerms(clean, 6).join(' '),
    article: clean.match(/điều\s+(\d+[a-z]?)/iu)?.[1], paragraph: clean.match(/khoản\s+(\d+)/iu)?.[1], point: clean.match(/điểm\s+([a-zđ])/iu)?.[1]?.toLowerCase(), plans };
}

export function snapshotResult(snapshot, plan, mode) {
  const articles = parseLegalArticles(snapshot.source_text);
  const matching = articles.filter(a => a.article === plan.article);
  let unit;
  if (plan.article && matching.length === 1) {
    unit = createProvisionUnits(matching[0]).find(p => p.paragraph === (plan.paragraph ?? null) && p.point === (plan.point ?? null));
  } else if (!plan.article) {
    const ranked = articles.map(a => ({ a, score: plan.terms.reduce((n, word) => n + Number(fold(a.text).includes(word)), 0) })).sort((a, b) => b.score - a.score);
    if (ranked[0]?.score > 0 && articles.filter(a => a.article === ranked[0].a.article).length === 1) unit = createProvisionUnits(ranked[0].a)[0];
  }
  // Giữ toàn đơn vị; điều quá dài hoặc cấu trúc không rõ chỉ dẫn trang văn bản.
  if (unit?.text.length > 8000) unit = null;
  return { id: createHash('sha256').update(`${snapshot.source_url}:${unit ? getProvisionLocator(unit) : 'document'}`).digest('hex'),
    title: snapshot.title, law_number: snapshot.law_number, document_type: snapshot.document_type,
    source_url: snapshot.source_url, source_verification: 'verified', source_sha256: snapshot.source_sha256,
    checked_at: snapshot.checked_at, retrieval_mode: mode, version: snapshot.version,
    article: unit?.article ?? null, paragraph: unit?.paragraph ?? null, point: unit?.point ?? null,
    locator: unit ? getProvisionLocator(unit) : 'Trang văn bản', text: unit?.text ?? '', excerpt: unit?.text.slice(0, 350) ?? snapshot.title,
    verification_status: unit ? 'verified' : 'unverified', application_status: 'unverified',
    application_date: null, application_reason: 'Đã đối chiếu nội dung nguồn; cần kiểm tra thời điểm, sửa đổi và chuyển tiếp trước khi áp dụng.',
    provision_note: unit ? null : 'Chưa xác minh được điều/khoản/điểm cụ thể. Mở trang văn bản để đối chiếu.' };
}

const repository = {
  find: numbers => VbplSnapshot.find(numbers.length ? { law_number: { $in: numbers } } : {}).sort({ checked_at: -1 }).limit(30).lean(),
  save: value => VbplSnapshot.updateOne({ source_url: value.source_url }, { $set: value }, { upsert: true, runValidators: true }),
};

export async function lookupVbpl({ question, courtCase = {}, eventDate }, { fetcher = fetch, cache = repository, enabled = process.env.LEGAL_ONLINE_LOOKUP !== 'false', now = new Date(), clock = () => performance.now() } = {}) {
  const deadline = clock() + 15000;
  const diagnostics = [];
  // Một hạn chờ chung tránh cộng dồn timeout khi nguồn ngoài bị gián đoạn.
  const fetchPage = url => fetchOfficialPage(url, fetcher, { timeoutMs: Math.max(1, Math.min(6000, Math.ceil(deadline - clock()))) });
  const plan = planAssistantSearch(question, courtCase, eventDate);
  const cached = (await cache.find(plan.numbers)).filter(s => hasVerifiedSource(s) && s.parser_version === PARSER_VERSION
    && (!plan.numbers.length ? plan.terms.some(t => fold(s.title).includes(t)) : plan.numbers.includes(s.law_number)));
  const results = new Map();
  const stale = [];
  for (const item of cached) {
    if (now - new Date(item.checked_at) < TTL || !enabled) results.set(item.source_url, snapshotResult(item, plan, 'cache'));
    else stale.push(item);
  }
  if (enabled) {
    const candidates = [...new Set([...stale.map(s => s.source_url), ...plan.numbers.map(n => legalAuthorities[n]?.sourceUrl).filter(isOfficialUrl)])];
    const queries = plan.numbers.length ? plan.numbers.filter(n => ![...results.values()].some(r => r.law_number === n)) : [plan.query];
    for (const query of queries.filter(Boolean).slice(0, 3)) {
      if (clock() >= deadline) break;
      try {
        // Giao diện hiện tại chỉ nạp keyword từ URL khi có cờ tìm từ trang chi tiết.
        const search = await fetchPage(`https://vbpl.vn/van-ban/trung-uong?keyword=${encodeURIComponent(query)}&isSearchFromDetail=true`);
        const links = linksFrom(search.content, search.url);
        candidates.push(...links);
        diagnostics.push({ stage: 'search', query, url: search.url, http_status: search.http_status, redirects: search.redirects,
          reason: isBlockedPage(htmlText(search.content)) ? 'source_blocked' : links.length ? 'candidates_found' : 'html_without_candidates', candidate_count: links.length });
      } catch (error) { diagnostics.push({ stage: 'search', query, reason: error.name === 'TimeoutError' ? 'timeout' : 'source_unavailable' }); }
    }
    for (const url of [...new Set(candidates)].slice(0, 5)) {
      if (clock() >= deadline) break;
      if (results.has(url) || [...results.values()].some(r => legalAuthorities[r.law_number]?.sourceUrl === url)) continue;
      try {
        const page = await fetchPage(url);
        const { snapshot, reason } = inspectVbplPage(page, plan.explicit.length === 1 ? plan.explicit[0] : undefined, now);
        diagnostics.push({ stage: 'document', requested_url: url, url: page.url, http_status: page.http_status, redirects: page.redirects, reason });
        if (!snapshot || (plan.numbers.length && !plan.numbers.includes(snapshot.law_number))
          || (!plan.numbers.length && !plan.terms.some(t => fold(snapshot.title).includes(t)))) continue;
        await cache.save(snapshot);
        results.set(snapshot.source_url, snapshotResult(snapshot, plan, 'live'));
      } catch (error) { diagnostics.push({ stage: 'document', requested_url: url, reason: error.name === 'TimeoutError' ? 'timeout' : 'source_unavailable' }); }
    }
  }
  for (const item of stale) if (!results.has(item.source_url)) results.set(item.source_url, snapshotResult(item, plan, 'cache'));
  return { results: [...results.values()].sort((a, b) => Number(plan.explicit.includes(b.law_number)) - Number(plan.explicit.includes(a.law_number))).slice(0, 5), plans: plan.plans,
    source_status: results.size ? 'available' : enabled ? 'unavailable' : 'disabled', diagnostics };
}

export async function researchAssistant(input) {
  const key = JSON.stringify(input);
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = lookupVbpl(input);
  inFlight.set(key, promise);
  try { return await promise; } finally { inFlight.delete(key); }
}
