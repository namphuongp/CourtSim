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
  if (features.detailedScoring) return { ...displayed, features };
  const { criteria, rubric_scores, rubric_feedback, citations, legal_research, ...summary } = displayed;
  return { ...summary, features };
}
