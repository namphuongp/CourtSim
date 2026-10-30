import { caseRoleLabel } from '../../../shared/casePresentation.mjs';
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
  return 'Bối cảnh là bài tập phúc thẩm từ bản chép lời chưa đầy đủ, không phải bản án. Chủ tọa làm rõ nội dung kháng cáo và tranh điểm, không tuyên kết quả phúc thẩm. Người học và bên đối lập chỉ bảo vệ lập trường phía được gán, không nhập vai người vắng mặt hoặc tự sinh lời nhân chứng. Bên đối lập không cần bác mọi câu: nếu người học thừa nhận điểm yếu của chính phía họ, dùng sự thừa nhận đó để làm rõ hệ quả cho yêu cầu của phía mình, không đảo sang bảo vệ phía người học. Áp dụng giả định chứng cứ gốc cho cả transcript_statement/transcript_readout; lời khai vẫn phải được phân tích theo người phát biểu và phạm vi chứng minh. Giữ người phát biểu, nguồn biết trực tiếp/gián tiếp, proof_scope và verification_status, số liệu conflicting không được nêu như số chắc chắn. Nhiều lời kể hỗ trợ nhau vẫn chưa xác nhận sự kiện thực tế đã xảy ra, mọi suy luận phải nói rõ điều kiện và nguồn lời kể. Không coi phần sơ thẩm được đọc lại là đáp án, không chấm đoán phán quyết. hearing_date và judgment_number chưa biết thì không tự điền, event_date chỉ là mốc tham chiếu sơ thẩm.';
}

export function openingStatement(courtCase, role) {
  const context = courtCase?.practice_context;
  if (context) {
    return `Thay mặt Hội đồng xét xử phúc thẩm, Chủ tọa tuyên bố mở phiên tòa xét xử phúc thẩm vụ án “${courtCase.title}”. Tại phiên tòa hôm nay, Luật sư tham gia với tư cách ${caseRoleLabel(role, courtCase)}. Sau phần công bố tóm tắt nội dung bản án sơ thẩm và phạm vi kháng cáo, Hội đồng xét xử chuyển sang phần nghe trình bày và tranh tụng. Mời Luật sư nêu rõ nội dung kháng cáo của phía mình bảo vệ, chỉ dẫn chứng cứ trong hồ sơ và làm rõ vấn đề trọng tâm cần Hội đồng xét xử xem xét.`;
  }
  const isCriminal = /hình sự/iu.test(courtCase?.category ?? '');
  const sideLabel = isCriminal
    ? (role === 'defense_lawyer' ? 'Bị cáo' : 'Người bị hại')
    : (role === 'defense_lawyer' ? 'Bị đơn' : 'Nguyên đơn');
  const plaintiffParty = (courtCase?.parties ?? []).find(p => p.side === 'plaintiff');
  const defendantParty = (courtCase?.parties ?? []).find(p => p.side === 'defendant');
  const partiesIntro = plaintiffParty && defendantParty
    ? ` giữa bên khởi kiện/bị hại là ${plaintiffParty.name} và phía bị đơn/bị cáo là ${defendantParty.name}`
    : '';
  return `Thay mặt Hội đồng xét xử, Chủ tọa tuyên bố khai mạc phiên tòa xét xử sơ thẩm công khai vụ án “${courtCase?.title ?? 'Vụ án thực hành'}”${partiesIntro}. Căn cứ thủ tục tố tụng tại phiên tòa, sau khi hoàn tất phần kiểm tra sự có mặt và phổ biến quyền, nghĩa vụ của những người tham gia tố tụng, Hội đồng xét xử chuyển sang phần Tranh tụng tại phiên tòa gồm các bước: Trình bày yêu cầu mở đầu, Xét hỏi làm rõ chứng cứ, Tranh luận đối đáp pháp lý và Tổng kết nghị án. Tại phiên tòa hôm nay, Luật sư tham gia bảo vệ quyền và lợi ích hợp pháp cho phía ${sideLabel}. Mời Luật sư trình bày quan điểm mở đầu, xác định rõ yêu cầu cần bảo vệ và viện dẫn các tài liệu, chứng cứ có trong hồ sơ vụ án.`;
}
