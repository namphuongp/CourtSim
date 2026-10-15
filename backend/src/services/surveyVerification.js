import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { SimulationSession, User } from '../models/index.js';

const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');
const equalHex = (a, b) => typeof a === 'string' && /^[a-f0-9]{64}$/.test(a)
  && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

function webhookSecret() {
  const secret = process.env.SURVEY_WEBHOOK_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
    throw new AppError('Khảo sát chưa sẵn sàng. Kết quả được lưu; vui lòng quay lại sau.', 503, 'SURVEY_UNAVAILABLE');
  }
  return secret;
}

export async function surveyVerified(user) {
  if (user.survey_verified_at) return true;
  // Khôi phục từ biên nhận đã xác minh nếu callback trước đó bị ngắt giữa hai lần ghi.
  const receipt = await SimulationSession.findOne({ user_id: user._id, 'survey_receipt.verified_at': { $type: 'date' } })
    .select('survey_receipt.verified_at').lean();
  if (!receipt) return false;
  await User.updateOne({ _id: user._id, survey_verified_at: null }, { $set: { survey_verified_at: receipt.survey_receipt.verified_at } });
  return true;
}

export async function requireSurvey(user) {
  if (!await surveyVerified(user)) throw new AppError('Vui lòng gửi khảo sát Google Forms trước khi xem kết quả.', 403, 'SURVEY_REQUIRED');
}

export function surveyToken(session) {
  // Chữ ký gắn phiên và chủ sở hữu; không thể sửa mã để xác minh cho tài khoản khác.
  return `${session._id}.${hmac(webhookSecret(), `survey:${session._id}:${session.user_id}`)}`;
}

export function surveyLink(session) {
  const entry = process.env.SURVEY_TOKEN_ENTRY;
  const url = URL.parse(process.env.VITE_FEEDBACK_FORM_URL?.trim() ?? '');
  // Đọc cấu hình backend; chỉ dùng link đầy đủ để Google giữ mã phiên điền sẵn.
  if (!/^entry\.\d{1,20}$/.test(entry ?? '') || !url
    || url.protocol !== 'https:' || url.hostname !== 'docs.google.com'
    || url.username || url.password || url.port
    || !/^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[a-zA-Z0-9_-]+\/viewform\/?$/.test(url.pathname)) {
    throw new AppError('Khảo sát chưa sẵn sàng. Kết quả được lưu; vui lòng quay lại sau.', 503, 'SURVEY_UNAVAILABLE');
  }
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(entry, surveyToken(session));
  return url.href;
}

export function verifySurveyToken(token, session) {
  const expected = surveyToken(session).split('.')[1];
  return typeof token === 'string' && token.split('.')[0] === String(session._id)
    && equalHex(token.split('.')[1], expected) && token.split('.').length === 2;
}

export function verifySurveyWebhook(request, now = Date.now()) {
  const secret = webhookSecret();
  const timestamp = request.get('x-courtsim-timestamp');
  const signature = request.get('x-courtsim-signature');
  // Ký nguyên byte nhận được, giới hạn thời gian để chống phát lại callback cũ.
  if (!/^\d{13}$/.test(timestamp ?? '') || Math.abs(now - Number(timestamp)) > 300_000
    || !Buffer.isBuffer(request.rawBody)
    || !equalHex(signature, hmac(secret, `${timestamp}.${request.rawBody.toString('utf8')}`))) {
    throw new AppError('Xác nhận khảo sát không hợp lệ.', 403, 'SURVEY_SIGNATURE_INVALID');
  }
}
