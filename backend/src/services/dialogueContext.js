import { caseKnowledge } from './caseKnowledge.js';
import { evidenceInventory } from './caseEvidence.js';
import { AppError } from '../utils/AppError.js';
import { classifyDialogueInput } from './dialogueInput.js';
import { hasVerifiedSource } from '../../../shared/legalSourcePolicy.mjs';

const sentences = text => (text ?? '').split(/(?<=[.!?])\s+|\n+/u).map(s => s.trim()).filter(Boolean);
const words = text => new Set((text.toLocaleLowerCase('vi').match(/[\p{L}\p{N}]{3,}/gu) ?? []));

export function needsLegalResearch(records) {
  const last = records.findLast(r => r.sender_type === 'user');
  return Boolean(last?.legal_reference_ids?.length || last?.citations?.length
    || /\b\d+\/\d{4}\/|(?:bộ luật|pháp luật|luật |nghị định|thông tư|hiệu lực|quy định|điều\s+\d+|khoản\s+\d+)/iu.test(last?.content ?? ''));
}

export function dialogueContext(session, courtCase, records, legalContext) {
  const knowledge = caseKnowledge(courtCase);
  const latest = records.findLast(r => r.sender_type === 'user');
  const terms = words(latest?.content ?? '');
  const sources = [
    ...knowledge.recorded_events.map(f => ({ kind: 'recorded_event', text: f.quote })),
    ...knowledge.party_statements.map(f => ({ kind: 'party_statement', party: f.party, text: f.quote })),
    ...knowledge.unproven.map(f => ({ kind: 'unproven', text: f.quote })),
    ...knowledge.unclassified_context.map(text => ({ kind: 'unclassified_context', text })),
    ...evidenceInventory(courtCase).flatMap(e => [e.summary, ...(e.availability === 'provided' ? [e.content] : [])]
      .filter(Boolean).map(text => ({ kind: e.availability, evidence_id: e.id, document: e.name, text }))),
  ];
  // Chọn trích đoạn có liên quan, giữ nhãn lời khai; không dùng model tóm tắt thành sự thật.
  const seen = new Set();
  const ranked = sources.flatMap(source => sentences(source.text).map(text => ({ ...source, text })))
    .filter(source => { if (seen.has(source.text)) return false; seen.add(source.text); return true; })
    .map((source, index) => ({ ...source, index, relevance: [...words(source.text)].filter(w => terms.has(w)).length }))
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index);
  let size = 0;
  const dossier = ranked.filter(source => {
    if (size + source.text.length > 12000) return false;
    size += source.text.length; return true;
  }).slice(0, 28).map(({ relevance, index, ...source }, i) => ({ id: `D${i + 1}`, ...source }));
  const learnerSentences = sentences(latest?.content);
  const positions = learnerSentences.filter(text => !/^(?:Phiên kiểm thử|Nội dung người học mô phỏng)/iu.test(text));
  const learner = (positions.length ? positions : learnerSentences).map((text, i) => ({ id: `L${i + 1}`, text }));
  const questions = records.flatMap((record, index) => {
    if (record.sender_type !== 'ai_judge') return [];
    const invited = record.next_speaker ?? 'learner';
    const replyType = invited === 'opponent' ? 'ai_prosecutor' : 'user';
    const reply = records.slice(index + 1).find(r => r.sender_type === replyType);
    return ((record.content ?? '').match(/[^.!?\n]*\?/gu) ?? []).map(text => ({
      record_id: String(record._id ?? index), text: text.trim(),
      invited_speaker: invited,
      status: reply ? 'reply_received' : 'awaiting_reply',
      reply_record_id: reply ? String(reply._id ?? records.indexOf(reply)) : null,
      reply: reply ? sentences(reply.content) : [],
    }));
  }).slice(-10);
  const issue = { id: `I:${latest?._id ?? records.lastIndexOf(latest)}`, learner_points: learner.map(s => s.text) };
  const brief = r => ({ record_id: String(r._id ?? records.indexOf(r)), speaker_type: r.sender_type,
    text: sentences(r.content).slice(0, 2).join(' '), issue: r.issue ?? null, purpose: r.purpose ?? null,
    evidence_ids: r.evidence_ids ?? [] });
  return {
    schema_version: 2,
    title: courtCase.title, category: courtCase.category, userRole: session.user_court_role,
    state: { phase: session.conversation?.phase ?? 'debate', learner_turns: records.filter(r => r.sender_type === 'user').length,
      input_kind: latest?.input_kind ?? classifyDialogueInput(latest?.content ?? ''),
      current_issue: issue, questions,
      pending_question: questions.findLast(q => q.status === 'awaiting_reply') ?? null,
      last_question_with_reply: questions.findLast(q => q.status === 'reply_received') ?? null,
      // Có lượt trả lời không đồng nghĩa đã giải quyết câu hỏi; không suy diễn sự thống nhất.
      agreed_facts: [], agreement_status: 'not_recorded',
      event_date: session.case_event_date, timeline: courtCase.timeline ?? [],
      earlier_positions: records.slice(0, -6).filter(r => r.sender_type !== 'ai_judge').slice(-12).map(brief),
      party_positions: (courtCase.parties ?? []).map(p => ({ side: p.side, party: p.name, claims: p.claims, status: 'party_statement' })),
      previous_questions: records.filter(r => r.sender_type !== 'user').flatMap(r => (r.content ?? '').match(/[^.!?\n]*\?/gu) ?? []).slice(-16) },
    learner, dossier,
    recentProceedings: records.slice(-6).map(r => ({ ...brief(r), text: r.content })),
    retrievedLaw: legalContext.citations.filter(hasVerifiedSource).map(c => ({ citationId: c.id, lawNumber: c.law_number, title: c.title, locator: c.locator,
      text: c.context_text ?? c.text, source_url: c.source_url, checked_at: c.checked_at, version: c.version,
      applicationDate: c.application_date, applicationReason: c.application_reason })),
  };
}

export function resolveDialogueFocus(response, context) {
  const focus = response.focus;
  // Phục hồi hình dạng nhỏ tại chỗ: mọi mã vẫn phải có thật, không tự thêm căn cứ.
  const learnerIds = Array.isArray(focus?.learner) ? focus.learner : [focus?.learner];
  const learners = learnerIds.map(id => context.learner.find(s => s.id === id));
  const learner = learners[0];
  const requiresDossier = response.purpose === 'rebut' || response.purpose === 'clarify_evidence';
  if (!learnerIds.length || learnerIds.length > 3 || learners.some(s => !s) || new Set(learnerIds).size !== learnerIds.length
    || !Array.isArray(focus?.dossier) || (requiresDossier && context.dossier.length && !focus.dossier.length) || focus.dossier.length > 3
    || focus.dossier.some(id => !context.dossier.some(s => s.id === id))) {
    throw new AppError('Lời thoại chưa đối chiếu đúng nguồn trong hồ sơ.', 502, 'AI_UNGROUNDED_FACT');
  }
  const dossier = context.dossier.find(s => s.id === focus.dossier[0]);
  // Metadata lấy từ nguồn gốc, tránh buộc model chép lại văn bản dài rồi sai dấu/chữ.
  return {
    normalizations: Array.isArray(focus?.learner) ? ['focus_learner_array'] : [],
    dialogue_focus: { learner_quote: learner.text, dossier_quote: dossier?.text ?? '',
      next_question: response.content.match(/[^.!?\n]*\?/gu)?.at(-1)?.trim() ?? '' },
    fact_analysis: { established_facts: [], learner_claims: learners.map(s => s.text), inferences: [], missing_facts: [] },
    source_anchors: focus.dossier.map(id => context.dossier.find(s => s.id === id)),
  };
}
