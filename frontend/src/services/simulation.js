export function roleLabel(role, category = '') {
  const criminal = /hình sự/iu.test(category);
  if (role === 'defense_lawyer') return criminal ? 'Luật sư bào chữa cho bị cáo' : 'Luật sư bảo vệ bị đơn';
  if (role === 'plaintiff_lawyer') return criminal ? 'Luật sư bảo vệ người bị hại' : 'Luật sư bảo vệ nguyên đơn';
  return 'Chưa chọn vai';
}
