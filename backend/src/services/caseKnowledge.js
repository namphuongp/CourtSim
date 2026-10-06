import { evidenceInventory } from './caseEvidence.js';
import { AppError } from '../utils/AppError.js';

const KINDS = ['recorded_event', 'party_statement', 'unproven'];
const CLAIM = /cho rằng|cho biết|nói rằng|khai rằng|\bkhai\b|trình bày|yêu cầu|viện dẫn|khẳng định/iu;
const sentences = (text) => (text ?? '').split(/(?<=[.!?])\s+|\n+/u).map((s) => s.trim()).filter(Boolean);

export function validateCaseFacts(body) {
  const facts = body.case_facts ?? [];
  const source = `${body.summary ?? ''}\n${body.full_document ?? ''}`;
  if (!Array.isArray(facts) || facts.length > 80 || facts.some((f) => !f || !KINDS.includes(f.kind)
    || typeof f.quote !== 'string' || f.quote.trim().length < 10 || f.quote.length > 2000 || !source.includes(f.quote)
    || !['judgment', 'case_outline'].includes(f.source_type)
    || (f.party !== undefined && (typeof f.party !== 'string' || f.party.length > 200))
    || (f.kind === 'party_statement' && !f.party?.trim())
    || (f.kind === 'recorded_event' && CLAIM.test(f.quote)))) {
    throw new AppError('Phân loại tình tiết cần trích đúng hồ sơ, ghi rõ nguồn và bên trình bày, không xếp lời khai thành sự kiện đã được xác nhận.');
  }
  return facts.map(({ kind, quote, source_type, party }) => ({ kind, quote, source_type, party }));
}

export function caseKnowledge(courtCase) {
  const inventory = evidenceInventory(courtCase);
  const text = `${courtCase.summary ?? ''}\n${courtCase.full_document ?? ''}`;
  // Phiên cũ giữ nguyên snapshot. Chỉ nhận nhãn có trích đoạn tồn tại, không suy đoán sự thật.
  const annotations = (courtCase.case_facts ?? []).filter((f) => KINDS.includes(f.kind) && typeof f.quote === 'string' && text.includes(f.quote));
  const statements = annotations.filter((f) => f.kind === 'party_statement');
  const unclassified = sentences(text).filter((s) => !annotations.some((f) => s.includes(f.quote)));
  return {
    recorded_events: annotations.filter((f) => f.kind === 'recorded_event' && !CLAIM.test(f.quote)),
    party_statements: [...statements, ...unclassified.filter((s) => CLAIM.test(s)).map((quote) => ({ quote, source_type: courtCase.source_url ? 'judgment' : 'case_outline', party: 'Theo chủ thể được nêu trong trích đoạn' })),
      ...(courtCase.parties ?? []).flatMap((p) => (p.claims ?? []).map((quote) => ({ quote, party: p.name, source_type: 'case_outline' })))],
    supplied_documents: inventory.filter((e) => e.availability === 'provided'),
    mentioned_documents: inventory.filter((e) => e.availability !== 'provided'),
    unproven: annotations.filter((f) => f.kind === 'unproven'),
    unclassified_context: unclassified.filter((s) => !CLAIM.test(s)),
  };
}

export function dossierQuotes(courtCase) {
  return [courtCase.summary ?? '', courtCase.full_document ?? '', ...evidenceInventory(courtCase).flatMap((e) => [e.summary, ...(e.availability === 'provided' ? [e.content] : [])])];
}
