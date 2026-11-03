import { roleLabel } from './simulation.js';

export const actorFor = (record) => {
  if (!record) return 'judge';
  if (record.sender_type === 'user') return 'learner';
  if (record.sender_type === 'ai_prosecutor' || record.sender_type === 'ai_opponent') return 'opponent';
  return 'judge';
};

export function courtroomRoles(session) {
  const category = session?.case_id?.category ?? '';
  const isCriminal = /hình sự/iu.test(category);
  const opposite = session?.user_court_role === 'defense_lawyer' ? 'plaintiff_lawyer' : 'defense_lawyer';
  const opponentName = isCriminal
    ? (session?.user_court_role === 'defense_lawyer' ? 'Kiểm sát viên' : 'Luật sư bào chữa / Bị cáo')
    : 'Bên đối lập';

  return {
    judge: { name: 'Thẩm phán', detail: 'Chủ tọa phiên tòa', asset: 'judge' },
    opponent: { name: opponentName, detail: roleLabel(opposite, category, session?.case_id), asset: 'opposing-lawyer' },
    learner: { name: 'Bạn', detail: roleLabel(session?.user_court_role, category, session?.case_id), asset: 'learner-lawyer' },
  };
}

export function getSpeakerInfo(record, session) {
  if (!record) {
    return { actor: 'judge', name: 'Thẩm phán - Chủ tọa', roleTag: 'Thẩm phán', side: 'court' };
  }

  const category = session?.case_id?.category ?? '';
  const isCriminal = /hình sự/iu.test(category);
  const userCourtRole = session?.user_court_role;
  const senderType = record.sender_type;

  // 1. Phía người dùng (Bạn / Người học)
  if (senderType === 'user') {
    let roleText = 'Bạn';
    let roleTag = 'Luật sư';
    if (userCourtRole === 'defense_lawyer') {
      roleText = isCriminal ? 'Luật sư bào chữa (Bạn)' : 'Luật sư bảo vệ bị đơn (Bạn)';
      roleTag = isCriminal ? 'Luật sư bào chữa' : 'Luật sư bị đơn';
    } else if (userCourtRole === 'plaintiff_lawyer') {
      roleText = isCriminal ? 'Luật sư bảo vệ bị hại (Bạn)' : 'Luật sư bảo vệ nguyên đơn (Bạn)';
      roleTag = isCriminal ? 'Luật sư bị hại' : 'Luật sư nguyên đơn';
    }
    return {
      actor: 'learner',
      name: roleText,
      roleTag,
      side: userCourtRole === 'defense_lawyer' ? 'defendant' : 'plaintiff',
    };
  }

  // 2. Thẩm phán / Chủ tọa
  if (senderType === 'ai_judge') {
    return {
      actor: 'judge',
      name: 'Thẩm phán - Chủ tọa phiên tòa',
      roleTag: 'Thẩm phán',
      side: 'court',
    };
  }

  // 3. Phía Viện kiểm sát / Bên đối lập / Bị cáo
  if (senderType === 'ai_prosecutor' || senderType === 'ai_opponent') {
    if (isCriminal) {
      if (userCourtRole === 'defense_lawyer') {
        return {
          actor: 'opponent',
          name: 'Kiểm sát viên',
          roleTag: 'Kiểm sát viên',
          side: 'prosecutor',
        };
      }
      return {
        actor: 'opponent',
        name: 'Bị cáo / Bên đối lập',
        roleTag: 'Bị cáo',
        side: 'defendant',
      };
    }

    if (userCourtRole === 'defense_lawyer') {
      return {
        actor: 'opponent',
        name: 'Luật sư bảo vệ nguyên đơn',
        roleTag: 'Luật sư đối lập',
        side: 'plaintiff',
      };
    }
    return {
      actor: 'opponent',
      name: 'Luật sư bảo vệ bị đơn',
      roleTag: 'Luật sư đối lập',
      side: 'defendant',
    };
  }

  // 4. Ưu tiên sender_name cụ thể nếu có
  if (record.sender_name && record.sender_name !== 'Người tham gia') {
    return {
      actor: 'opponent',
      name: record.sender_name,
      roleTag: record.sender_name,
      side: 'other',
    };
  }

  return {
    actor: 'judge',
    name: 'Chủ tọa phiên tòa',
    roleTag: 'Thẩm phán',
    side: 'court',
  };
}

// Chọn lời đang đọc; người đang chuẩn bị do trạng thái backend quyết định ở Stage.
export function courtroomView({ records, selectedId, sending, pendingContent, processing, ending }) {
  if (sending) return { record: { _id: 'pending', sender_type: 'user', content: pendingContent }, actor: 'learner', pending: true };
  const record = records.find((r) => r._id === selectedId) ?? records.at(-1);
  return { record, actor: processing || ending || !record ? null : actorFor(record), pending: false };
}
