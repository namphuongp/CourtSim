export function caseRoleLabel(role, courtCase) {
  if (!['defense_lawyer', 'plaintiff_lawyer'].includes(role)) return null;
  const label = courtCase?.practice_context?.role_labels?.[role];
  return typeof label === 'string' ? label.replace(/\s*\(mô phỏng\)/giu, '').trim() : null;
}

export function canCiteEvidence(item, courtCase) {
  // Có thể viện dẫn phần mô tả đã có, không tự bổ sung nội dung tài liệu.
  return courtCase?.practice_context?.source_kind !== 'transcript'
    || [item.content, item.summary, item.source_quote].some(value => typeof value === 'string' && Boolean(value.trim()));
}

export const EVIDENCE_ASSUMPTION = 'Trong bài tập, giả định mọi chứng cứ được đề cập trong hồ sơ đều có bản gốc và tài liệu kèm theo. Lập luận dựa trên nội dung đã nêu; không tự bổ sung tình tiết. Bản gốc không đồng nghĩa mọi lời khai hoặc kết luận đều đúng.';

export const EVIDENCE_ASSUMPTION_POLICY = `${EVIDENCE_ASSUMPTION} Đây là giả định luyện tập, không phải xác minh tài liệu thực tế. Không yêu cầu xuất trình lại bản gốc, không bác chứng cứ hoặc trừ điểm vì thiếu bản gốc, bản sao hay tài liệu kèm theo. provided/mentioned_only chỉ mô tả mức nội dung được cung cấp để đọc, không phủ nhận sự tồn tại của chứng cứ. Chỉ khẳng định nội dung có trích đoạn hỗ trợ; giữ nguyên mâu thuẫn, nguồn lời khai và phạm vi chứng minh. Giả định này được ưu tiên hơn ghi chú cũ về thiếu bản gốc trong hồ sơ và lịch sử.`;

// Chỉ bỏ ghi chú biên tập đã được giả định bài tập thay thế; giữ lời khai và số liệu.
export function practiceText(value = '') {
  return value.replace('Nội dung biên tập từ bản chép lời, không phải tài liệu gốc.\n', '')
    .replace(/[,;] không có bản gốc giấy tờ trong bài tập\./gu, '.')
    .replace('Đây là thông tin trong bản chép, chưa đối chiếu hồ sơ địa chính gốc.', '')
    .replace(' khi chưa có bản gốc?', '?')
    .replace('các số liệu phiên âm bất nhất', 'các số liệu chưa thống nhất');
}

function buildDefaultDevelopments(courtCase) {
  const parties = courtCase?.parties ?? [];
  const plaintiff = parties.find(p => p.side === 'plaintiff');
  const defendant = parties.find(p => p.side === 'defendant');
  const evidence = courtCase?.evidence_inventory ?? [];
  const absences = courtCase?.evidence_absences ?? [];

  const steps = [];
  if (courtCase?.summary) {
    steps.push({
      title: 'Bối cảnh khởi phát vụ việc',
      text: courtCase.summary.replace(/;/g, ','),
    });
  }
  if (plaintiff || defendant) {
    const pClaims = plaintiff?.claims?.length ? `${plaintiff.name}: ${plaintiff.claims.join(' ')}` : '';
    const dClaims = defendant?.claims?.length ? `${defendant.name}: ${defendant.claims.join(' ')}` : '';
    const combined = [pClaims, dClaims].filter(Boolean).join(' — ').replace(/;/g, ',');
    if (combined) {
      steps.push({
        title: 'Yêu cầu khởi kiện và quan điểm phản bác của các bên',
        text: combined,
      });
    }
  }
  if (evidence.length) {
    const evNames = evidence.slice(0, 4).map(e => `${e.name} (${e.provided_by || 'Trong hồ sơ'})`).join(', ').replace(/;/g, ',');
    const absenceNote = absences.length ? ` Đồng thời hồ sơ ghi nhận điểm khuyết cần lưu ý: ${absences.map(a => a.title).join(', ').replace(/;/g, ',')}.` : '';
    steps.push({
      title: 'Hệ thống tài liệu, chứng cứ trọng tâm trong hồ sơ',
      text: `Hồ sơ hiện có ${evidence.length} bút lục chứng cứ gồm: ${evNames}.${absenceNote}`,
    });
  }
  if (courtCase?.legal_scope_note) {
    steps.push({
      title: 'Trọng tâm pháp lý và định hướng tranh tụng tại phiên tòa',
      text: courtCase.legal_scope_note.replace(/;/g, ','),
    });
  }
  return steps;
}

export function caseIntroduction(courtCase) {
  // Nhận đúng hồ sơ để các vụ án khác không nhận nhầm diễn biến.
  if (courtCase?.practice_context?.source_label !== 'Bản chép lời Case1.docx'
    && courtCase?.title !== 'Phúc thẩm tranh chấp đất giữa ông Kiên và ông Xây — từ bản ghi phiên tòa') {
    return {
      title: courtCase?.title,
      summary: courtCase?.summary,
      developments: buildDefaultDevelopments(courtCase),
    };
  }
  return {
    title: 'Phúc thẩm tranh chấp đất giữa ông Kiên và ông Xây',
    summary: 'Ông Kiên và ông Xây tranh chấp phần đất của cha mẹ. Hai bên bất đồng về việc chia đất, thỏa thuận tiền và gạch khi ông Kiên ra ở riêng, cùng yêu cầu bồi thường căn nhà. Phiên phúc thẩm xem xét các nội dung kháng cáo sau xét xử sơ thẩm.',
    developments: [
      { title: 'Nguồn gốc tranh chấp', text: 'Ông Kiên cho rằng cha mẹ chia miệng đất cho hai con trai, mỗi người một nửa. Ông khẳng định việc chuyển đi không đồng nghĩa từ bỏ phần đất của mình.' },
      { title: 'Hai bên bất đồng về thỏa thuận', text: 'Phía ông Xây trình bày đã giao 200 đồng và 3.000 viên gạch để sử dụng toàn bộ thửa đất. Ông Kiên phủ nhận thỏa thuận này. Cần làm rõ việc giao tiền, gạch và ý nghĩa của việc giao nhận.' },
      { title: 'Yêu cầu về đất và căn nhà', text: 'Tranh luận còn liên quan đến giấy chứng nhận đứng tên ông Xây, quá trình sử dụng đất, người xây nhà, việc phá dỡ và căn cứ yêu cầu bồi thường.' },
      { title: 'Nội dung cần giải quyết tại phúc thẩm', text: 'Ông Kiên tiếp tục bảo vệ yêu cầu về đất, giấy chứng nhận và bồi thường nhà. Phía ông Xây không đồng ý yêu cầu của ông Kiên và kháng cáo toàn bộ sơ thẩm.' },
    ],
  };
}
