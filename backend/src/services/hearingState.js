import { createHash } from 'node:crypto';
import { caseKnowledge } from './caseKnowledge.js';
import { evidenceInventory } from './caseEvidence.js';

export const normalizeHearingText = value => (value ?? '').normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stableId = text => createHash('sha256').update(text).digest('hex').slice(0, 16);
const opponentRecord = r => ['ai_prosecutor', 'ai_opponent'].includes(r.sender_type);

export function participantSides(session) {
  const player = session.user_court_role === 'defense_lawyer' ? 'defendant' : 'plaintiff';
  return { player, opponent: player === 'defendant' ? 'plaintiff' : 'defendant', source: 'session.user_court_role' };
}

export function roleMismatch(session, content) {
  if (!['defense_lawyer', 'plaintiff_lawyer'].includes(session.user_court_role)) return false;
  // Chỉ bắt tự xưng trực tiếp ở đầu câu, không bắt lời trích dẫn hoặc phủ định.
  const claims = [...content.matchAll(/(?:^|[.!?\n]\s*)(?:tôi|chúng tôi)\s+(?:là\s+(?:luật sư|người đại diện)\s+)?(?:đang\s+)?(?:bảo vệ|đại diện(?:\s+cho)?)\s+(?:phía\s+|bên\s+)?(nguyên đơn|bị đơn)/giu)];
  const expected = participantSides(session).player === 'defendant' ? 'bị đơn' : 'nguyên đơn';
  return claims.some(match => match[1].toLocaleLowerCase('vi') !== expected);
}

function referencedIds(record, inventory) {
  const explicit = [...(record.evidence_ids ?? []), ...(record.source_anchors ?? []).map(s => s.evidence_id)];
  // Lịch sử cũ: chỉ nhận dấu trích dẫn hoặc lời viện dẫn rõ, không coi câu hỏi là xuất trình.
  const text = normalizeHearingText(record.content);
  return inventory.filter(e => explicit.includes(e.id) || (e.name?.length >= 12
    && (record.content?.includes(`[Chứng cứ: ${e.name}]`) || ['theo', 'viện dẫn', 'xuất trình', 'căn cứ vào'].some(prefix => text.includes(`${prefix} ${normalizeHearingText(e.name)}`))))).map(e => e.id);
}

function issueCatalog(courtCase) {
  const source = `${courtCase.title ?? ''} ${courtCase.summary ?? ''} ${courtCase.full_document ?? ''} ${(courtCase.evidence_inventory ?? []).map(e => `${e.name} ${e.summary ?? ''}`).join(' ')}`;
  const templates = [
    ['overlap', 'Phạm vi giấy chứng nhận và phần đất tranh chấp', /giấy chứng nhận|\bgcn\b|trùng khớp|đối chiếu|ranh giới/iu],
    ['burden', 'Phạm vi yêu cầu và trách nhiệm chứng minh của mỗi bên', /nghĩa vụ chứng minh|trách nhiệm chứng minh|gánh nặng|phạm vi yêu cầu/iu],
    ['origin', 'Nguồn gốc hình thành và sử dụng đất', /nguồn gốc|khai hoang|thừa kế|chuyển nhượng|tặng cho/iu],
    ['possession', 'Quá trình quản lý và sử dụng đất', /quản lý|sử dụng đất|canh tác|chiếm hữu/iu],
    ['timeline', 'Diễn biến và thời điểm phát sinh tranh chấp', /thời điểm|diễn biến|phát sinh|hòa giải/iu],
  ];
  const land = /đất|địa chính/iu.test(source);
  const topics = land ? templates.filter(([key, , pattern]) => key === 'burden' || pattern.test(source)) : [];
  return topics.length ? topics.map(([id, label, pattern]) => ({ id: `issue:${id}`, label, pattern }))
    : [{ id: `issue:${stableId(courtCase.title ?? 'case')}`, label: 'Yêu cầu của các bên và căn cứ chứng minh', pattern: /./u }];
}

export function hearingState(session, courtCase, records) {
  const inventory = evidenceInventory(courtCase);
  const knowledge = caseKnowledge(courtCase);
  const presented = new Set(records.flatMap(r => referencedIds(r, inventory)));
  const available = inventory.map(({ content, ...e }) => ({ ...e, title: e.name, has_content: Boolean(content?.trim()),
    evidence_state: e.availability === 'provided' ? (presented.has(e.id) ? 'available_presented' : 'available_not_presented') : 'not_determined',
    referenced: presented.has(e.id),
  }));
  const source = `${courtCase.summary ?? ''}\n${courtCase.full_document ?? ''}`;
  // Xác nhận vắng phải do dữ liệu hồ sơ có trích đoạn; không suy từ danh sách rỗng.
  const absent = (courtCase.evidence_absences ?? []).filter(e => e.title && e.source_quote && source.includes(e.source_quote))
    .map(e => ({ ...e, evidence_state: 'confirmed_absent', scope: 'case_record_only' }));
  const catalog = issueCatalog(courtCase);
  const entries = new Map(catalog.map(({ id, label }) => [id, { id, label, status: 'unresolved', rounds_without_new_evidence: 0, visits: 0, evidence_ids: [], previous_questions: [] }]));
  let current = catalog[0].id;
  for (const record of records) {
    const topic = catalog.find(t => t.id === record.issue) ?? catalog.find(t => t.pattern.test(record.content ?? ''));
    if (topic) current = topic.id;
    const item = entries.get(current);
    item.visits++;
    const ids = referencedIds(record, inventory);
    const fresh = ids.filter(id => !item.evidence_ids.includes(id));
    item.evidence_ids = [...new Set([...item.evidence_ids, ...ids])];
    if (fresh.length) item.rounds_without_new_evidence = 0;
    else if (record.sender_type === 'user') item.rounds_without_new_evidence++;
    if (record.sender_type === 'ai_judge') item.previous_questions.push(...((record.content ?? '').match(/[^.!?\n]*\?/gu) ?? []));
  }
  const issues = [...entries.values()];
  const active = entries.get(current);
  const exhausted = active.rounds_without_new_evidence >= 3;
  const next = exhausted ? issues.filter(i => i.id !== current && i.rounds_without_new_evidence < 3).sort((a, b) => a.visits - b.visits)[0] ?? null : null;
  const questions = [];
  for (const [index, record] of records.entries()) {
    if (record.sender_type !== 'ai_judge') continue;
    const text = (record.content ?? '').match(/[^.!?\n]*\?/gu)?.at(-1)?.trim();
    if (!text) continue;
    const invited = record.next_speaker ?? 'learner';
    const reply = records.slice(index + 1).find(r => invited === 'opponent' ? opponentRecord(r) : r.sender_type === 'user');
    const asksEvidence = /(?:tài liệu|chứng cứ|biên bản|bản đồ|trích đo).*?(?:nào|cụ thể)|dựa vào (?:đâu|gì)/iu.test(text);
    const replyHasSource = reply && referencedIds(reply, inventory).length > 0;
    const limitation = /(?:chưa|không)\s+(?:có|tìm thấy|xác định|chỉ ra|được cung cấp)/iu.test(reply?.content ?? '');
    questions.push({ id: `question:${record._id ?? index}`, text, invited_speaker: invited, asks_evidence: asksEvidence,
      status: !reply ? 'awaiting_reply' : asksEvidence && !replyHasSource && !limitation ? 'possibly_evaded' : 'reply_received',
      reply_record_id: reply ? String(reply._id ?? records.indexOf(reply)) : null });
  }
  const lastQuestion = questions.at(-1) ?? null;
  return { version: 1, participants: participantSides(session),
    role_mismatch: roleMismatch(session, records.findLast(r => r.sender_type === 'user')?.content ?? ''),
    case_facts: knowledge.recorded_events, party_statements: knowledge.party_statements,
    unproven_facts: knowledge.unproven, undisputed_facts: [],
    available_evidence: available, presented_evidence: available.filter(e => e.evidence_state === 'available_presented'),
    evidence_referenced: available.filter(e => e.referenced).map(e => e.id), absent_evidence: absent,
    evidence_search_status: 'inventory_only_not_full_record_certification',
    issues, current_issue: active, next_issue: next, stalled: exhausted,
    resolved_issues: [], pending_issues: issues.map(i => i.id),
    previous_questions: questions, pending_question: lastQuestion?.status === 'awaiting_reply' ? lastQuestion : null,
    judge_intervention: lastQuestion?.status === 'possibly_evaded' ? 'request_direct_answer' : exhausted ? 'move_issue' : null,
    last_question: lastQuestion,
  };
}
