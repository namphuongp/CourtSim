import { roleLabel } from './simulation';

export const actorFor = (record) => record?.sender_type === 'user' ? 'learner' : record?.sender_type === 'ai_prosecutor' ? 'opponent' : 'judge';
export function courtroomRoles(session) {
  const category = session?.case_id?.category ?? '';
  const opposite = session?.user_court_role === 'defense_lawyer' ? 'plaintiff_lawyer' : 'defense_lawyer';
  return {
    judge: { name: 'Chủ tọa', detail: 'Điều hành phiên tòa', asset: 'judge' },
    opponent: { name: 'Bên đối lập', detail: roleLabel(opposite, category), asset: 'opposing-lawyer' },
    learner: { name: 'Bạn', detail: roleLabel(session?.user_court_role, category), asset: 'learner-lawyer' },
  };
}

// Chọn lời đang đọc; người đang chuẩn bị do trạng thái backend quyết định ở Stage.
export function courtroomView({ records, selectedId, sending, pendingContent, processing, ending }) {
  if (sending) return { record: { _id: 'pending', sender_type: 'user', content: pendingContent }, actor: 'learner', pending: true };
  const record = records.find((r) => r._id === selectedId) ?? records.at(-1);
  return { record, actor: processing || ending || !record ? null : actorFor(record), pending: false };
}
