import { Router } from 'express';
import { SimulationSession, User } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { verifySurveyToken, verifySurveyWebhook } from '../services/surveyVerification.js';

const router = Router();
router.post('/google-forms', asyncHandler(async (request, response) => {
  verifySurveyWebhook(request);
  const { token, response_id: responseId } = request.body ?? {};
  if (typeof token !== 'string' || !/^[a-f0-9]{24}\.[a-f0-9]{64}$/.test(token)
    || typeof responseId !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(responseId)) {
    throw new AppError('Dữ liệu xác nhận khảo sát không hợp lệ.', 400);
  }
  const session = await SimulationSession.findById(token.split('.')[0]).select('user_id status survey_receipt').lean();
  if (!session || session.status !== 'completed' || !verifySurveyToken(token, session)) {
    throw new AppError('Không tìm thấy phiên phù hợp với khảo sát.', 403, 'SURVEY_TOKEN_INVALID');
  }
  // Callback gửi lại là hợp lệ; không ghi đè biên nhận đã xác minh.
  if (!session.survey_receipt?.verified_at) {
    await SimulationSession.updateOne({ _id: session._id, 'survey_receipt.verified_at': null }, {
      $set: { survey_receipt: { response_id: responseId, verified_at: new Date() }, feedback_prompted_at: new Date() },
    }, { runValidators: true });
  }
  // Một lần gửi hợp lệ mở quyền xem kết quả cho mọi phiên của cùng tài khoản.
  await User.updateOne({ _id: session.user_id, survey_verified_at: null }, { $set: { survey_verified_at: new Date() } });
  response.set('Cache-Control', 'no-store').json({ data: { verified: true } });
}));
export default router;
