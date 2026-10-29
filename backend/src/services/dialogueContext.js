import { caseKnowledge } from './caseKnowledge.js';
import { evidenceInventory } from './caseEvidence.js';
import { AppError } from '../utils/AppError.js';
import { classifyDialogueInput } from './dialogueInput.js';
import { hasReadableLawSource } from '../../../shared/legalSourcePolicy.mjs';
import { hearingState } from './hearingState.js';

const sentences = text => (text ?? '').split(/(?<=[.!?])\s+|\n+/u).map(s => s.trim()).filter(Boolean);
const words = text => new Set((text.toLocaleLowerCase('vi').match(/[\p{L}\p{N}]{3,}/gu) ?? []));

export function needsLegalResearch(records, courtCase) {
  const last = records.findLast(r => r.sender_type === 'user');
  const mentionsLaw = Boolean(last?.legal_reference_ids?.length || last?.citations?.length
    || /\b\d+\/\d{4}\/|(?:bộ luật|pháp luật|luật |nghị định|thông tư|hiệu lực|quy định|điều\s+\d+|khoản\s+\d+|căn cứ|pháp lý|văn bản)/iu.test(last?.content ?? ''));
  if (mentionsLaw) return true;
  // Tự động nạp căn cứ pháp lý khi phiên đã bước vào tranh luận (từ lượt 1 trở đi) và vụ án có mốc thời gian/danh mục luật
  const userTurns = records.filter(r => r.sender_type === 'user').length;
  if (userTurns >= 1 && (courtCase?.timeline?.length || courtCase?.category)) {
    return true;
  }
  return false;
}

export function extractDossierSentences(courtCase) {
  const knowledge = caseKnowledge(courtCase);
  const sources = [
    ...knowledge.recorded_events.map(f => f.quote),
    ...knowledge.party_statements.map(f => f.quote),
    ...knowledge.unproven.map(f => f.quote),
    ...knowledge.unclassified_context,
    ...evidenceInventory(courtCase).flatMap(e => [e.summary, ...(e.availability === 'provided' ? [e.content] : [])]).filter(Boolean),
  ];
  return [...new Set(sources.flatMap(sentences))];
}

export function dialogueContext(session, courtCase, records, legalContext) {
  const knowledge = caseKnowledge(courtCase);
  const hearing = hearingState(session, courtCase, records);
  const latest = records.findLast(r => r.sender_type === 'user');
  const terms = words(`${latest?.content ?? ''} ${hearing.pending_question?.text ?? ''}`);
  const sources = [
    ...knowledge.recorded_events.map(f => ({ kind: 'recorded_event', text: f.quote })),
    ...knowledge.party_statements.map(f => ({ kind: 'party_statement', party: f.party, text: f.quote })),
    ...knowledge.unproven.map(f => ({ kind: 'unproven', text: f.quote })),
    ...knowledge.unclassified_context.map(text => ({ kind: 'unclassified_context', text })),
    ...evidenceInventory(courtCase).flatMap(e => [e.summary, ...(e.availability === 'provided' ? [e.content] : [])]
      .filter(Boolean).map(text => ({ kind: e.source_kind === 'transcript_statement' ? 'party_statement' : e.availability, availability: e.availability,
        source_kind: e.source_kind, party: e.provided_by, source_locator: e.source_locator, proof_scope: e.proof_scope, verification_status: e.verification_status,
        evidence_id: e.id, document: e.name, text }))),
  ];
  // Chọn trích đoạn có liên quan, giữ nhãn lời khai; không dùng model tóm tắt thành sự thật.
  const seen = new Set();
  const ranked = sources.flatMap(source => sentences(source.text).map(text => ({ ...source, text })))
    .filter(source => { const key = `${source.evidence_id ?? ''}:${source.text}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .map((source, index) => {
      const keywordScore = [...words(source.text)].filter(w => terms.has(w)).length;
      const semanticScore = legalContext?.dossierSemanticScores?.get(source.text);
      const relevance = semanticScore != null
        ? (Number(semanticScore) * 10) + keywordScore
        : keywordScore;
      return { ...source, index, relevance, semanticScore: semanticScore ?? null, keywordScore };
    })
    .sort((a, b) => b.relevance - a.relevance || a.index - b.index);
  let size = 0;
  const dossier = ranked.filter(source => {
    if (size + source.text.length > 12000) return false;
    size += source.text.length; return true;
  }).slice(0, 28).map(({ relevance, index, semanticScore, keywordScore, ...source }, i) => ({ id: `D${i + 1}`, ...source }));
  const learnerSentences = sentences(latest?.content);
  const positions = learnerSentences.filter(text => !/^(?:Phiên kiểm thử|Nội dung người học mô phỏng)/iu.test(text));
  const learner = (positions.length ? positions : learnerSentences).map((text, i) => ({ id: `L${i + 1}`, text }));
  const questions = records.flatMap((record, index) => {
    if (!['ai_judge', 'ai_prosecutor'].includes(record.sender_type)) return [];
    const invited = record.next_speaker ?? 'learner';
    const replyType = invited === 'opponent' ? 'ai_prosecutor' : invited === 'judge' ? 'ai_judge' : 'user';
    const reply = records.slice(index + 1).find(r => r.sender_type === replyType);
    return ((record.content ?? '').match(/[^.!?\n]*\?/gu) ?? []).map(text => ({
      record_id: String(record._id ?? index), asked_by: record.sender_type, text: text.trim(),
      invited_speaker: invited,
      status: reply ? 'reply_received' : 'awaiting_reply',
      reply_record_id: reply ? String(reply._id ?? records.indexOf(reply)) : null,
      reply: reply ? sentences(reply.content) : [],
    }));
  }).slice(-10);
  // Không chép cả lời mới nhất lần thứ ba; nội dung đầy đủ nằm trong learner.
  const issue = { ...hearing.current_issue, learner_points: learner.map(s => s.id) };
  const latestIndex = records.lastIndexOf(latest);
  const normalize = text => text.normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const earlierPoints = new Set(records.slice(0, latestIndex).filter(r => r.sender_type === 'user').flatMap(r => sentences(r.content)).map(normalize));
  const opponentReply = records.slice(latestIndex + 1).findLast(r => r.sender_type === 'ai_prosecutor');
  const brief = r => ({ record_id: String(r._id ?? records.indexOf(r)), speaker_type: r.sender_type,
    text: sentences(r.content).slice(0, 2).join(' '), issue: r.issue ?? null, purpose: r.purpose ?? null,
    evidence_ids: r.evidence_ids ?? [] });
  // Prompt chỉ nhận metadata của toàn danh mục; nội dung dài đi qua bộ chọn dossier.
  const hearingForPrompt = { ...hearing, available_evidence: hearing.available_evidence.map(e => ({
    id: e.id, name: e.name, title: e.title, availability: e.availability, has_content: e.has_content,
    date: e.date, source_kind: e.source_kind, source_locator: e.source_locator,
    proof_scope: e.proof_scope, verification_status: e.verification_status,
    evidence_state: e.evidence_state, referenced: e.referenced,
  })), presented_evidence: hearing.presented_evidence.map(e => e.id) };
  return {
    schema_version: 2,
    title: courtCase.title, category: courtCase.category, userRole: session.user_court_role,
    practice_context: courtCase.practice_context,
    hearing: hearingForPrompt,
    state: { phase: session.conversation?.phase ?? 'debate', learner_turns: records.filter(r => r.sender_type === 'user').length,
      input_kind: latest?.input_kind ?? classifyDialogueInput(latest?.content ?? ''),
      current_issue: issue, questions,
      repeated_learner_points: learner.filter(point => earlierPoints.has(normalize(point.text))).map(point => point.id),
      last_opponent_reply: opponentReply ? String(opponentReply._id ?? records.indexOf(opponentReply)) : null,
      pending_question: questions.findLast(q => q.status === 'awaiting_reply') ?? null,
      last_question_with_reply: questions.findLast(q => q.status === 'reply_received') ?? null,
      // Có lượt trả lời không đồng nghĩa đã giải quyết câu hỏi; không suy diễn sự thống nhất.
      agreed_facts: [], agreement_status: 'not_recorded',
      event_date: session.case_event_date, timeline: courtCase.timeline ?? [],
      earlier_positions: records.slice(0, -6).filter(r => r.sender_type !== 'ai_judge').slice(-12).map(brief),
      party_positions: (courtCase.parties ?? []).map(p => ({ side: p.side, party: p.name, claims: p.claims, status: 'party_statement' })),
      previous_questions: records.filter(r => r.sender_type !== 'user').flatMap(r => (r.content ?? '').match(/[^.!?\n]*\?/gu) ?? []).slice(-16) },
    learner, dossier, legal_assessment_mode: legalContext.legal_assessment_mode, assessment_note: legalContext.assessment_note,
    recentProceedings: records.slice(-6).map(r => ({ ...brief(r), text: r.content })),
    retrievedLaw: legalContext.citations.filter(hasReadableLawSource).map(c => ({ citationId: c.id, lawNumber: c.law_number, title: c.title, locator: c.locator,
      text: c.context_text ?? c.text, source_url: c.source_url, checked_at: c.checked_at, version: c.version,
      applicationStatus: c.application_status, applicationDate: c.application_date, applicationReason: c.application_reason })),
  };
}

export function resolveDialogueFocus(response, context) {
  const focus = response.focus;
  // Phục hồi hình dạng nhỏ tại chỗ: mọi mã vẫn phải có thật, không tự thêm căn cứ.
  const learnerIds = Array.isArray(focus?.learner) ? focus.learner : [focus?.learner];
  const learners = learnerIds.map(id => context.learner.find(s => s.id === id));
  const learner = learners[0];
  // Phản biện mắt xích suy luận/nguồn luật có thể chỉ dựa vào lời vừa nói, không ép gán hồ sơ không liên quan.
  const requiresDossier = response.purpose === 'clarify_evidence';
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

export function validateDialogueQuantities(content, context) {
  // Chặn số đo/số tiền mới; phép kiểm này không thay thế thẩm định ý nghĩa lời thoại.
  const quantities = text => (text.match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*\s*(?:m²|m2|km²|ha|triệu đồng|tỷ đồng|đồng|%)(?!\p{L})/giu) ?? [])
    .map(value => value.toLocaleLowerCase('vi').replace(/\s+/gu, '').replaceAll('m2', 'm²'));
  const sources = new Set(quantities(context.dossier.map(s => s.text).join('\n')));
  const claims = new Set(quantities(context.learner.map(s => s.text).join('\n')));
  const law = new Set(quantities(context.retrievedLaw.map(s => s.text).join('\n')));
  for (const sentence of sentences(content)) {
    const attributed = /(?:bạn|người học)\s+(?:nêu|nói|viện dẫn|cho rằng)|theo lời bạn/iu.test(sentence);
    const legal = /(?:quy định|điều luật|pháp luật)/iu.test(sentence);
    if (quantities(sentence).some(value => !sources.has(value) && !(attributed && claims.has(value)) && !(legal && law.has(value)))) {
      throw new AppError('Lời thoại có số đo/số tiền chưa có trong hồ sơ hoặc chưa giữ đúng nguồn lời trình bày.', 502, 'AI_UNGROUNDED_FACT');
    }
  }
}
