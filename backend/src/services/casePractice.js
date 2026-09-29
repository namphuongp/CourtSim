import { AppError } from '../utils/AppError.js';

export function validatePracticeContext(value) {
  if (value === undefined || value === null) return undefined;
  const fail = () => { throw new AppError('Bối cảnh luyện tập không hợp lệ.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const keys = ['hearing_level', 'source_kind', 'source_label', 'hearing_date', 'judgment_number', 'legal_assessment', 'overview', 'role_labels', 'issues', 'limitations', 'absent_participants', 'uncertain_values'];
  if (Object.keys(value).some(key => !keys.includes(key)) || value.hearing_level !== 'appeal' || value.source_kind !== 'transcript' || value.legal_assessment !== 'unverified'
    || value.hearing_date !== null || value.judgment_number !== null) fail();
  for (const key of ['source_label', 'overview']) if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 1500) fail();
  for (const key of ['issues', 'limitations', 'absent_participants', 'uncertain_values']) {
    if (!Array.isArray(value[key]) || value[key].length > 12 || value[key].some(text => typeof text !== 'string' || !text.trim() || text.length > 1000)) fail();
  }
  if (!value.role_labels || Object.keys(value.role_labels).length !== 2
    || ['plaintiff_lawyer', 'defense_lawyer'].some(key => typeof value.role_labels[key] !== 'string' || !value.role_labels[key].trim() || value.role_labels[key].length > 200)) fail();
  return structuredClone(value);
}

export function practiceInstructions(courtCase) {
  if (courtCase.practice_context?.source_kind !== 'transcript') return '';
  return 'Bối cảnh là bài tập phúc thẩm từ bản chép lời chưa đầy đủ, không phải bản án. Chủ tọa làm rõ nội dung kháng cáo và tranh điểm, không tuyên kết quả phúc thẩm. Người học và bên đối lập chỉ bảo vệ lập trường phía được gán, không nhập vai người vắng mặt hoặc tự sinh lời nhân chứng. Bên đối lập không cần bác mọi câu: nếu người học thừa nhận điểm yếu của chính phía họ, dùng sự thừa nhận đó để làm rõ hệ quả cho yêu cầu của phía mình; không đảo sang bảo vệ phía người học. Nội dung provided có source_kind=transcript_statement/transcript_readout chỉ là lời nói/phần đọc lại được biên tập; không phải chứng cứ gốc hay sự thật đã xác minh. Giữ người phát biểu, nguồn biết trực tiếp/gián tiếp, proof_scope và verification_status; số liệu conflicting không được nêu như số chắc chắn. Nhiều lời kể hỗ trợ nhau vẫn chưa xác nhận sự kiện thực tế đã xảy ra; mọi suy luận phải nói rõ điều kiện và nguồn lời kể. Không coi phần sơ thẩm được đọc lại là đáp án, không chấm đoán phán quyết. hearing_date và judgment_number chưa biết thì không tự điền; event_date chỉ là mốc tham chiếu sơ thẩm.';
}

export function openingStatement(courtCase, role) {
  const context = courtCase.practice_context;
  if (!context) return null;
  return `Bắt đầu luyện hỏi đáp phúc thẩm từ bản ghi phiên tòa. Bạn ${context.role_labels[role]}. Mời nêu nội dung kháng cáo phía mình bảo vệ và chọn một vấn đề cần làm rõ. Ngày phúc thẩm chưa xác định; phiên kết thúc bằng đánh giá lập luận, không tuyên án.`;
}
