import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
export const auditKey = value => createHmac('sha256', env.JWT_SECRET).update(String(value)).digest('hex');
export function securityAudit(event, account = '') {
  // Không ghi email, nội dung yêu cầu, mật khẩu, mã hoặc token vào log.
  console.info('Security audit', { event, subject: auditKey(account), at: new Date().toISOString() });
}
