import { memberFeatures, sessionFeatures } from '../../../shared/membershipPolicy.mjs';
import { AppError } from '../utils/AppError.js';
import { learnerEvaluation } from './learnerPresentation.js';

export function requireMemberFeature(user, feature) {
  if (!memberFeatures(user)[feature]) throw new AppError('Phân tích kỹ năng nâng cao dành cho gói Pro. Bạn vẫn có thể xem lịch sử và kết quả tổng quan.', 403, 'MEMBERSHIP_REQUIRED');
}

export function requireSessionFeature(session, user, feature) {
  if (!sessionFeatures(session, user)[feature]) throw new AppError('Trợ lý luật dành cho các gói trả phí. Chọn mua lượt lẻ, Lite hoặc Pro để sử dụng.', 403, 'MEMBERSHIP_REQUIRED');
}

export function memberEvaluation(result, session, user, courtCase = {}) {
  const features = sessionFeatures(session, user);
  const displayed = learnerEvaluation(result, courtCase);
  // Cả tài khoản Pro lẫn 02 case dùng thử miễn phí của tài khoản Free đều có features.detailedScoring === true,
  // đảm bảo BẮT BUỘC hiển thị đầy đủ bảng điểm theo từng tiêu chí, nhận xét chi tiết và gợi ý cải thiện.
  if (features.detailedScoring) {
    return { ...displayed, features };
  }
  // Nếu tài khoản Free ngoài 2 case dùng thử (không có detailedScoring), chỉ hiển thị tổng quan
  const { criteria, rubric_scores, rubric_feedback, citations, legal_research, ...summary } = displayed;
  return { ...summary, features };
}
