import { AppError } from '../utils/AppError.js';
export function assertEmailReady() {
  if (!process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) throw new AppError('Chưa thể gửi email xác thực. Vui lòng thử lại sau.', 503, 'EMAIL_UNAVAILABLE');
}
export async function sendVerificationEmail({ email, otp, idempotencyKey }) {
  assertEmailReady();
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'CourtSim — Xác thực địa chỉ email',
        text: `CourtSim\nMã xác thực của bạn: ${otp}\nMã có hiệu lực trong 5 phút. Không chia sẻ mã này. Nếu bạn không yêu cầu mã này, có thể bỏ qua email.`,
        html: `<div style="font-family:Arial,sans-serif;background:#f3f7fc;padding:32px;color:#16324b"><h1>CourtSim</h1><h2>Xác thực địa chỉ email</h2><p>Mã xác thực của bạn:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${otp}</p><p>Mã có hiệu lực trong 5 phút. Không chia sẻ mã này.</p><p>Nếu bạn không yêu cầu mã này, có thể bỏ qua email.</p></div>` }),
    });
    if (!response.ok) throw new Error('Email delivery failed');
  } catch {
    throw new AppError('Chưa thể gửi email xác thực. Vui lòng thử lại sau.', 503, 'EMAIL_UNAVAILABLE');
  }
}
