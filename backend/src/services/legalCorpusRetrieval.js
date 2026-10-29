import LegalCorpusVersion from '../models/LegalCorpusVersion.js';
import LegalCorpusProvision from '../models/LegalCorpusProvision.js';
import { planAssistantSearch } from './vbplResearch.js';
import { assessVersion, buildLegalPlan } from './legalTimeline.js';
import { rankProvisions } from './legalRetrievalService.js';
import { getLegalSearchTerms } from './legalTextSearch.js';
import { hasReadableLawSource } from '../../../shared/legalSourcePolicy.mjs';
import { embed } from './embeddingService.js';
import { search as searchVectorStore, isQdrantAvailable } from './vectorStore.js';

export function resolveCorpusResults({ documents, provisions, question = '', courtCase = {}, eventDate, learnerTimeline = [], records = [] }) {
  const plan = planAssistantSearch(question, courtCase, eventDate);
  const plans = buildLegalPlan(courtCase, eventDate, learnerTimeline);
  const allowed = documents.filter(d => ['verified', 'reference'].includes(d.status) && d.permission_status === 'allowed' && !d.retired_at && hasReadableLawSource(d)
    && (!plan.numbers.length || plan.numbers.includes(d.law_number))
    && (!d.version_rules?.length || !plans.some(p => p.date && p.law_numbers.includes(d.law_number))
      || plans.some(p => p.law_numbers.includes(d.law_number) && d.version_rules.some(r => r.from <= p.date && r.to >= p.date_to))));
  const byId = new Map(allowed.map(d => [String(d._id), d]));
  const units = provisions.filter(p => byId.has(String(p.document_id))
    && (!plan.article || p.article === plan.article) && p.paragraph === (plan.paragraph ?? null) && p.point === (plan.point ?? null));
  const ranked = rankProvisions(units, { ...courtCase, title: question || courtCase.title }, [...records, { sender_type: 'user', content: question }])
    .sort((a, b) => b.score - a.score || (byId.get(String(b.provision.document_id)).source_priority ?? 0) - (byId.get(String(a.provision.document_id)).source_priority ?? 0));
  const results = []; const seen = new Set(); let size = 0;
  for (const { provision: p, score } of ranked) {
    if ((!plan.article && score <= 0) || p.text.length > 8000 || size + p.text.length > 8000 || results.length >= 5) continue;
    const d = byId.get(String(p.document_id));
    const key = `${d.law_number}:${p.article}:${p.paragraph ?? ''}:${p.point ?? ''}`;
    if (seen.has(key)) continue;
    // Khi cùng số hiệu có nhiều tệp, ưu tiên bản PDF gốc đã được người dùng xác nhận.
    if (units.some(other => other.article === p.article && other.paragraph === p.paragraph && other.point === p.point
      && byId.get(String(other.document_id))?.law_number === d.law_number
      && (byId.get(String(other.document_id)).source_priority ?? 0) > (d.source_priority ?? 0))) continue;
    const relevant = plans.filter(t => t.law_numbers.includes(d.law_number));
    const assessments = relevant.map(t => ({ plan: t, assessment: d.document_kind === 'consolidated'
      ? { verified: false, reason: 'Văn bản hợp nhất không có hiệu lực độc lập, cần đối chiếu văn bản gốc và sửa đổi.' } : assessVersion(d, p, t) }));
    const conflicts = units.some(other => other.article === p.article && other.paragraph === p.paragraph && other.point === p.point
      && byId.get(String(other.document_id))?.law_number === d.law_number && other.text !== p.text
      && assessments.some(a => a.assessment.verified && assessVersion(byId.get(String(other.document_id)), other, a.plan).verified));
    const verified = conflicts ? undefined : assessments.find(a => a.assessment.verified);
    const fileIndex = Math.max(0, d.source_files?.findIndex(f => f.path === p.page_source_file) ?? 0);
    results.push({ id: String(p._id), title: d.title, law_number: d.law_number, article: p.article, paragraph: p.paragraph, point: p.point,
      locator: p.locator, text: p.text, context_text: p.text, excerpt: p.text.slice(0, 350),
      source_url: d.source_verification === 'local_read' ? `/api/v1/legal-sources/${d.fingerprint}/files/${fileIndex}` : d.source_files?.find(f => f.path === p.page_source_file)?.official_url ?? d.source_url,
      source_sha256: d.source_sha256, source_verification: d.source_verification, checked_at: d.checked_at,
      permission_status: 'allowed', version: d.version, source_fingerprint: d.fingerprint, retrieval_mode: 'cache',
      verification_status: d.source_verification === 'verified' ? 'verified' : 'unverified', application_status: verified ? 'verified' : 'unverified',
      application_date: verified?.plan.date ?? null, event_kind: verified?.plan.kind ?? null,
      application_reason: conflicts ? 'Có phiên bản xung đột cùng thời kỳ, cần đối chiếu.' : verified?.assessment.reason
        ?? assessments[0]?.assessment.reason ?? 'Cần làm rõ mốc sự kiện, cấp giấy/chuyển quyền, khởi kiện hoặc xét xử liên quan.',
      page_from: p.page_from, page_to: p.page_to });
    size += p.text.length; seen.add(key);
  }
  return { results, plans, source_status: results.length ? 'available' : 'unavailable' };
}

export async function researchCorpus(input) {
  input = { ...input, question: input.question ?? input.records?.findLast(r => r.sender_type === 'user')?.content ?? '' };
  const plan = planAssistantSearch(input.question ?? '', input.courtCase, input.eventDate);
  const documents = await LegalCorpusVersion.find({ status: { $in: ['verified', 'reference'] }, permission_status: 'allowed', retired_at: null,
    ...(plan.numbers.length ? { law_number: { $in: plan.numbers } } : {}) }).limit(40).lean();
  if (!documents.length) return { results: [], plans: plan.plans, source_status: 'unavailable' };

  const queryText = [input.question, input.courtCase?.title, input.courtCase?.summary,
    ...(input.records ?? []).filter(r => r.sender_type === 'user').slice(-2).map(r => r.content)].filter(Boolean).join(' ');

  let provisions = [];
  const vectorScores = new Map();
  let vectorUsed = false;

  // Lớp Semantic Vector Search qua Qdrant (nếu có)
  if (queryText && await isQdrantAvailable()) {
    try {
      const vector = await embed(queryText, 'query');
      const mustFilters = [
        { key: 'permission_status', match: { value: 'allowed' } },
      ];
      if (plan.numbers.length) {
        mustFilters.push({ key: 'law_number', match: { any: plan.numbers } });
      }
      if (plan.article) {
        mustFilters.push({ key: 'article', match: { value: plan.article } });
      }

      const hits = await searchVectorStore('legal_provisions_corpus', {
        vector,
        limit: 50,
        scoreThreshold: 0.25,
        filter: { must: mustFilters },
      });

      if (hits.length > 0) {
        const pointIds = hits.map(h => String(h.id));
        for (const h of hits) {
          vectorScores.set(String(h.id), h.score);
        }
        provisions = await LegalCorpusProvision.find({
          _id: { $in: pointIds },
          document_id: { $in: documents.map(d => d._id) },
          paragraph: plan.paragraph ?? null,
          point: plan.point ?? null,
          ...(plan.article ? { article: plan.article } : {}),
        }).lean();
        for (const p of provisions) {
          p.vector_score = vectorScores.get(String(p._id));
        }
        vectorUsed = provisions.length > 0;
      }
    } catch {
      // Fallback an toàn về keyword
    }
  }

  // Kết hợp Keyword Search (nếu chưa dùng vector hoặc bổ sung để không sót điều khoản chính xác)
  const terms = getLegalSearchTerms(queryText);
  if (!vectorUsed) {
    provisions = await LegalCorpusProvision.find({
      document_id: { $in: documents.map(d => d._id) },
      paragraph: plan.paragraph ?? null,
      point: plan.point ?? null,
      ...(plan.article ? { article: plan.article } : { search_tokens: { $in: terms } }),
    }).limit(500).lean();
  } else if (plan.article || terms.length > 0) {
    const keywordProvisions = await LegalCorpusProvision.find({
      document_id: { $in: documents.map(d => d._id) },
      paragraph: plan.paragraph ?? null,
      point: plan.point ?? null,
      ...(plan.article ? { article: plan.article } : { search_tokens: { $in: terms } }),
    }).limit(100).lean();
    const existingIds = new Set(provisions.map(p => String(p._id)));
    for (const kp of keywordProvisions) {
      if (!existingIds.has(String(kp._id))) {
        provisions.push(kp);
        existingIds.add(String(kp._id));
      }
    }
  }

  return resolveCorpusResults({ ...input, documents, provisions });
}

export async function researchCorpusForSimulation(input) {
  const research = await researchCorpus(input);
  const citations = research.results.filter(hasReadableLawSource);
  const issues = research.plans.map(p => ({ ...p, verification_status: p.date && p.status !== 'assumed'
    && p.law_numbers.length && p.law_numbers.every(n => citations.some(c => c.application_status === 'verified' && c.law_number === n && c.event_kind === p.kind && c.application_date === p.date)) ? 'verified' : 'unverified' }));
  return { citations, candidates: [], issues,
    legal_assessment_available: issues.length > 0 && issues.every(i => i.verification_status === 'verified'),
    warnings: issues.some(i => i.verification_status !== 'verified') ? ['Chưa đủ nguồn đã xác minh về nội dung, thời điểm và mức liên quan cho mọi vấn đề, tiêu chí luật chưa đủ căn cứ sẽ chưa được đánh giá.'] : [] };
}
