import { AppError } from '../utils/AppError.js';

export const DAY_MS = 86400000;
export const BILLING_ERRORS = Object.freeze({
  INVALID_BILLING_MONTH: 'Chọn tháng hợp lệ, không nằm trong tương lai.',
  INVALID_BILLING_ARGUMENTS: 'Dùng --month YYYY-MM hoặc không truyền tham số.',
  OPENAI_NOT_CONFIGURED: 'Chưa cấu hình khóa quản trị hoặc Project ID OpenAI trên backend.',
  OPENAI_INVALID_KEY: 'OpenAI từ chối khóa quản trị. Kiểm tra khóa đã hết hiệu lực hoặc bị thu hồi.',
  OPENAI_FORBIDDEN: 'Khóa quản trị chưa có quyền đọc chi phí hoặc usage của project.',
  OPENAI_RATE_LIMITED: 'OpenAI giới hạn tần suất. Vui lòng đồng bộ lại sau.',
  OPENAI_UNAVAILABLE: 'OpenAI tạm thời không khả dụng. Dữ liệu đã lưu được giữ nguyên.',
  OPENAI_TIMEOUT: 'Đồng bộ quá thời gian chờ. Vui lòng thử lại.',
  OPENAI_INVALID_RESPONSE: 'Dữ liệu OpenAI không đúng định dạng hoặc không thuộc project đã cấu hình.',
  OPENAI_INCOMPLETE: 'OpenAI chưa trả đủ các ngày được yêu cầu. Không coi ngày thiếu là chi phí bằng 0.',
  OPENAI_STORAGE_ERROR: 'Chưa lưu được toàn bộ kết quả đồng bộ. Vui lòng thử lại.',
  OPENAI_SYNC_BUSY: 'Một tác vụ đồng bộ đang chạy. Vui lòng chờ hoàn tất.',
  OPENAI_SYNC_INTERRUPTED: 'Tác vụ trước bị gián đoạn hoặc quá hạn. Có thể đồng bộ lại.',
});
export const billingError = (code, status = 502) => new AppError(BILLING_ERRORS[code], status, code);
export const safeBillingCode = error => Object.hasOwn(BILLING_ERRORS, error?.code) ? error.code : 'OPENAI_STORAGE_ERROR';

export function billingConfig(source = process.env) {
  const projectId = source.OPENAI_PROJECT_ID?.trim();
  const key = source.OPENAI_ADMIN_KEY?.trim();
  const projectConfigured = typeof projectId === 'string' && /^proj_[A-Za-z0-9_-]{1,180}$/.test(projectId);
  const keyConfigured = typeof key === 'string' && key.length > 0 && !/[\r\n]/.test(key);
  return { projectId: projectConfigured ? projectId : null, key, projectConfigured, keyConfigured, ready: projectConfigured && keyConfigured };
}

export function billingMonth(value, now = new Date()) {
  const month = value ?? now.toISOString().slice(0, 7);
  if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month > now.toISOString().slice(0, 7)) {
    throw billingError('INVALID_BILLING_MONTH', 400);
  }
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const to = new Date(Math.min(nextMonth.getTime(), Math.floor(now.getTime() / 1000) * 1000));
  const days = [];
  for (let time = from.getTime(); time < to.getTime(); time += DAY_MS) days.push(new Date(time).toISOString().slice(0, 10));
  return { month, from, to, days, timezone: 'UTC', currentMonth: now < nextMonth };
}

// Cộng thập phân chính xác trước khi lưu Decimal128, không cộng tiền bằng số thực nhị phân.
export function sumUsd(values) {
  const parts = values.map(value => {
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
    if (!match || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > 1e12) throw billingError('OPENAI_INVALID_RESPONSE');
    let scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
    if (Math.abs(scale) > 24) throw billingError('OPENAI_INVALID_RESPONSE');
    let amount = BigInt(`${match[1]}${match[2]}${match[3] ?? ''}`);
    if (scale < 0) { amount *= 10n ** BigInt(-scale); scale = 0; }
    return { amount, scale };
  });
  const scale = Math.max(0, ...parts.map(part => part.scale));
  const total = parts.reduce((sum, part) => sum + part.amount * 10n ** BigInt(scale - part.scale), 0n);
  const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, '0');
  return `${total < 0n ? '-' : ''}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`;
}
