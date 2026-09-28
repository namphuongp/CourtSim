import { isValidDateOnly } from './legalTimeline.js';
export { isValidDateOnly } from './legalTimeline.js';
import { legalAuthorities } from '../data/legalAuthorities.js';
import { LegalDocument, LegalProvision } from '../models/index.js';
import { getLegalSearchTerms, normalizeLegalSearchText } from './legalTextSearch.js';
import { createProvisionUnits, parseLegalArticles } from './legalTextParser.js';

const MAX_PROVISIONS = 8;
const MAX_CONTEXT_CHARACTERS = 8_000;
const MAX_PROVISION_CHARACTERS = 8_000;

export function isProvisionEffectiveOn(provision, eventDate) {
  return isValidDateOnly(eventDate)
    && isValidDateOnly(provision.effective_from)
    && provision.effective_from <= eventDate
    && (!provision.effective_to || eventDate <= provision.effective_to);
}

export function isCitationEligibleOnDate(authority, eventDate) {
  return authority.source_status === 'verified_current'
    && (!authority.verified_through || (isValidDateOnly(authority.verified_through) && eventDate <= authority.verified_through))
    && isProvisionEffectiveOn({
      effective_from: authority.effective_from,
      effective_to: authority.effective_to ?? null,
    }, eventDate);
}

export function rankProvisions(provisions, courtCase, records = []) {
  const titleTerms = getLegalSearchTerms(normalizeLegalSearchText(courtCase.title ?? '').replace(/^(tranh chap|vu an)\s+/, ''));
  const recentTerms = getLegalSearchTerms(records.filter((r) => r.sender_type === 'user').slice(-2).map((r) => r.content).join(' '));
  const terms = [...new Set([...titleTerms, ...recentTerms, ...getLegalSearchTerms(courtCase.summary ?? '')])];
  const frequencies = new Map(terms.map((term) => [term, provisions.filter((p) => p.search_tokens.includes(term)).length]));
  return provisions.map((provision) => {
    const tokens = new Set(provision.search_tokens);
    const heading = normalizeLegalSearchText(provision.text.split('\n')[0]);
    let score = 0;
    for (const term of terms) {
      if (!tokens.has(term)) continue;
      // Từ hiếm và tiêu đề có trọng số cao hơn, tránh chọn điều dài chỉ vì nhiều từ chung.
      const idf = Math.log(1 + provisions.length / (1 + frequencies.get(term)));
      score += idf * (titleTerms.includes(term) ? 4 : recentTerms.includes(term) ? 2 : 1) * (heading.includes(term) ? 3 : 1);
    }
    return { provision, score: score / (1 + 0.25 * Math.log(1 + provision.text.length / 1000)) };
  }).sort((a, b) => b.score - a.score);
}

function toCitation(provision, document) {
  return {
    id: String(provision._id),
    law_number: document.law_number,
    title: document.title,
    article: provision.article,
    paragraph: provision.paragraph,
    point: provision.point,
    locator: provision.locator,
    text: provision.text,
    source_files: document.source_files.map((file) => file.name),
    source_url: document.source_url,
    page_from: provision.page_from,
    page_to: provision.page_to,
    page_source_file: provision.page_source_file,
    temporal_note: document.temporal_note,
    effective_from: provision.effective_from,
    verified_through: document.verified_through,
  };
}

export async function getLegalCoverageWarnings(eventDate) {
  const documents = await LegalDocument.find().select('law_number').lean();
  const importedLawNumbers = new Set(documents.map((document) => document.law_number));

  return Object.values(legalAuthorities)
    .filter((authority) => authority.effectiveFrom <= eventDate
      || authority.effectiveRules?.some((rule) => rule.effectiveFrom <= eventDate))
    .map((authority) => {
      if (!importedLawNumbers.has(authority.lawNumber)) {
        return `${authority.title} số ${authority.lawNumber} chưa được nhập từ tệp nguồn.`;
      }
      if (authority.sourceStatus !== 'verified_current') {
        return `${authority.title} số ${authority.lawNumber}: ${authority.temporalNote}`;
      }
      if (eventDate > authority.verifiedThrough) {
        return `${authority.title} số ${authority.lawNumber} chỉ được đối chiếu đến ${authority.verifiedThrough}; ngày vụ việc nằm ngoài thời điểm đã xác minh.`;
      }
      return null;
    })
    .filter(Boolean);
}

export async function retrieveRelevantProvisions({ eventDate, courtCase, records = [] }) {
  const warnings = await getLegalCoverageWarnings(eventDate);
  if (courtCase?.legal_scope_note) warnings.unshift(courtCase.legal_scope_note);
  const category = normalizeLegalSearchText(courtCase?.category ?? '');
  if (!/dan su|dat dai|hon nhan|kinh doanh|thuong mai/.test(category)) {
    return { citations: [], warnings: [...warnings, 'Chưa có nguồn luật chuyên ngành đã xác minh cho loại vụ án này. Phiên chỉ luyện lập luận và chứng cứ, không kết luận quy định pháp luật áp dụng.'] };
  }
  const documents = await LegalDocument.find({
    source_status: 'verified_current',
    effective_from: { $lte: eventDate },
    verified_through: { $gte: eventDate },
    $or: [{ effective_to: null }, { effective_to: { $gte: eventDate } }],
  }).select('-source_text').lean();
  if (!documents.length) return { citations: [], warnings: [...warnings, 'Chưa có văn bản đủ điều kiện viện dẫn cho ngày tra cứu này.'] };

  const documentById = new Map(documents.map((document) => [String(document._id), document]));
  const recentContext = records.filter((record) => record.sender_type === 'user').slice(-2).map((record) => record.content ?? '').join('\n');
  const terms = getLegalSearchTerms([
    courtCase?.title,
    courtCase?.category,
    courtCase?.summary,
    recentContext,
  ].filter(Boolean).join('\n'));
  if (!terms.length) return { citations: [], warnings };
  const provisions = await LegalProvision.find({
    document_id: { $in: documents.map((document) => document._id) },
    citation_eligible: true,
    paragraph: null,
    point: null,
    effective_from: { $lte: eventDate },
    $or: [{ effective_to: null }, { effective_to: { $gte: eventDate } }],
    search_tokens: { $in: terms },
  }).lean();

  const ranked = rankProvisions(provisions, courtCase, records)
    .map(({ provision, score }) => {
      const document = documentById.get(String(provision.document_id));
      return document && isCitationEligibleOnDate({
        source_status: document.source_status,
        effective_from: provision.effective_from,
        effective_to: provision.effective_to ?? document.effective_to,
      }, eventDate)
        ? { provision, document, score }
        : null;
    })
    .filter((item) => item && item.score > 0)
    .sort((left, right) => right.score - left.score || left.provision.article.localeCompare(right.provision.article, 'vi', { numeric: true }));

  const selected = [];
  const selectedArticles = new Set();
  let contextCharacters = 0;
  for (const item of ranked) {
    const articleKey = `${item.document.law_number}:${item.provision.article}`;
    if (selectedArticles.has(articleKey)) continue;
    const citation = toCitation(item.provision, item.document);
    if (citation.text.length > MAX_PROVISION_CHARACTERS) continue;
    const excerpt = citation.text;
    if (contextCharacters + excerpt.length > MAX_CONTEXT_CHARACTERS) continue;
    selected.push({ ...citation, context_text: excerpt });
    selectedArticles.add(articleKey);
    contextCharacters += excerpt.length;
    if (selected.length >= MAX_PROVISIONS) break;
  }

  return { citations: selected, warnings };
}

function getCitationReferences(content) {
  const references = [];
  const citationPattern = /(?:(?:điểm\s+([a-zđ])\s*,?\s*)?(?:khoản\s+(\d+)\s*,?\s*)?Điều\s+(\d+[a-z]?))(?:\s*[,;:]?\s*(?:khoản\s+(\d+))?(?:\s*[,;:]?\s*điểm\s+([a-zđ]))?)?/giu;
  for (const match of content.matchAll(citationPattern)) {
    references.push({
      article: match[3],
      paragraph: match[2] ?? match[4] ?? null,
      point: (match[1] ?? match[5])?.toLowerCase() ?? null,
      lawNumber: content.slice(match.index + match[0].length).split(/Điều\s+\d|[\n.;]/iu)[0].match(/\b\d{1,4}\/\d{4}\/QH\d+\b/iu)?.[0] ?? null,
    });
  }
  return references;
}

function citationCoversReference(citation, reference) {
  if (reference.lawNumber && citation.law_number.toLowerCase() !== reference.lawNumber.toLowerCase()) return false;
  if (citation.article !== reference.article) return false;
  if ((!reference.paragraph || citation.paragraph === reference.paragraph)
      && (!reference.point || citation.point === reference.point)) return true;
  if (citation.paragraph || !citation.text) return false;
  const article = parseLegalArticles(citation.text)[0];
  return Boolean(article && createProvisionUnits(article).some((unit) =>
    (!reference.paragraph || unit.paragraph === reference.paragraph) && (!reference.point || unit.point === reference.point)));
}

export function validateCitationIds({ content, citationIds, availableCitations }) {
  if (!Array.isArray(citationIds) || citationIds.some((id) => typeof id !== 'string')) {
    return { valid: false, citations: [], reason: 'Danh sách mã trích dẫn không hợp lệ.' };
  }

  const citationsById = new Map(availableCitations.map((citation) => [String(citation.id), citation]));
  if (citationIds.some((id) => !citationsById.has(id))) {
    return { valid: false, citations: [], reason: 'AI viện dẫn mã điều luật không có trong nguồn đã truy xuất.' };
  }

  const citations = [...new Set(citationIds)].map((id) => citationsById.get(id));
  const references = getCitationReferences(content);
  if (references.some((reference) => !citations.some((citation) => citationCoversReference(citation, reference)))) {
    return { valid: false, citations: [], reason: 'AI có nhắc điều/khoản/điểm không được dẫn bởi nguồn đã truy xuất.' };
  }

  const mentionedLawNumbers = new Set(content.match(/\b\d{1,4}\/\d{4}\/QH\d+\b/giu) ?? []);
  if ([...mentionedLawNumbers].some((lawNumber) => !citations.some((citation) => citation.law_number.toLowerCase() === lawNumber.toLowerCase()))) {
    return { valid: false, citations: [], reason: 'AI nhắc số hiệu văn bản không có trong nguồn đã truy xuất.' };
  }

  return { valid: true, citations };
}
