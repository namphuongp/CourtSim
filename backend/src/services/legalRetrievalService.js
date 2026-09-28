import { legalAuthorities } from '../data/legalAuthorities.js';
import { LegalDocument, LegalProvision } from '../models/index.js';
import { getLegalSearchTerms } from './legalTextSearch.js';

const MAX_PROVISIONS = 8;
const MAX_CONTEXT_CHARACTERS = 8_000;
const MAX_PROVISION_CHARACTERS = 1_500;

export function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

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

function scoreProvision(provision, terms) {
  const searchTokens = provision.search_tokens ?? [];
  let score = 0;
  for (const term of terms) {
    const occurrences = searchTokens.filter((token) => token === term).length;
    if (occurrences) score += 1 + Math.min(3, occurrences - 1) * 0.15;
  }
  return score;
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
  const documents = await LegalDocument.find({
    source_status: 'verified_current',
    effective_from: { $lte: eventDate },
    verified_through: { $gte: eventDate },
    $or: [{ effective_to: null }, { effective_to: { $gte: eventDate } }],
  }).lean();
  if (!documents.length) return { citations: [], warnings };

  const documentById = new Map(documents.map((document) => [String(document._id), document]));
  const recentContext = records.slice(-8).map((record) => record.content ?? '').join('\n');
  const terms = getLegalSearchTerms([
    courtCase?.title,
    courtCase?.category,
    courtCase?.summary,
    courtCase?.full_document,
    recentContext,
  ].filter(Boolean).join('\n'));
  if (!terms.length) return { citations: [], warnings };
  const provisions = await LegalProvision.find({
    document_id: { $in: documents.map((document) => document._id) },
    citation_eligible: true,
    effective_from: { $lte: eventDate },
    $or: [{ effective_to: null }, { effective_to: { $gte: eventDate } }],
    search_tokens: { $in: terms },
  }).lean();

  const ranked = provisions
    .map((provision) => {
      const document = documentById.get(String(provision.document_id));
      return document && isCitationEligibleOnDate({
        source_status: document.source_status,
        effective_from: provision.effective_from,
        effective_to: provision.effective_to ?? document.effective_to,
      }, eventDate)
        ? { provision, document, score: scoreProvision(provision, terms) }
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
    const excerpt = citation.text.slice(0, MAX_PROVISION_CHARACTERS);
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
    });
  }
  return references;
}

function citationCoversReference(citation, reference) {
  return citation.article === reference.article
    && (!reference.paragraph || citation.paragraph === reference.paragraph)
    && (!reference.point || citation.point === reference.point);
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
