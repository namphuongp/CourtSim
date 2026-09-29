import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
export const objectId = value => {
  if (!mongoose.isObjectIdOrHexString(value)) throw new AppError('Mã dữ liệu không hợp lệ.');
  return new mongoose.Types.ObjectId(value);
};
export const literalRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function queryOptions(query, sorts = ['created_at']) {
  if (Object.keys(query).some(key => !['page', 'limit', 'q', 'sort', 'order', 'range', 'from', 'to', 'status', 'role', 'verified'].includes(key))) throw new AppError('Bộ lọc không hợp lệ.');
  for (const value of Object.values(query)) if (typeof value !== 'string') throw new AppError('Bộ lọc không hợp lệ.');
  const { page = '1', limit = '20', q = '', sort = sorts[0], order = 'desc' } = query;
  if (!/^[1-9]\d{0,5}$/.test(page) || !/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > 100 || q.length > 100 || !sorts.includes(sort) || !['asc', 'desc'].includes(order)) throw new AppError('Bộ lọc hoặc phân trang không hợp lệ.');
  return { page: Number(page), limit: Number(limit), skip: (Number(page) - 1) * Number(limit), search: q.trim(), sort: { [sort]: order === 'asc' ? 1 : -1, _id: order === 'asc' ? 1 : -1 } };
}
const DAY = 86400000, OFFSET = 7 * 3600000;
export function dateRange(query = {}, now = new Date()) {
  const range = query.range ?? '30d';
  if (!['today', '7d', '30d', 'month', 'custom'].includes(range)) throw new AppError('Khoảng thời gian không hợp lệ.');
  const local = new Date(now.getTime() + OFFSET);
  const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET);
  let from = range === 'month' ? new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET) : new Date(today.getTime() - ({ today: 0, '7d': 6, '30d': 29 }[range] ?? 0) * DAY);
  let to = new Date(today.getTime() + DAY);
  if (range === 'custom') {
    const parse = value => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new AppError('Ngày không hợp lệ.');
      return new Date(value + 'T00:00:00+07:00');
    };
    from = parse(query.from); to = new Date(parse(query.to).getTime() + DAY);
    if (to <= from || to - from > 366 * DAY) throw new AppError('Chọn khoảng thời gian tối đa 366 ngày.');
  }
  return { from, to, match: { $gte: from, $lt: to }, timezone: 'Asia/Ho_Chi_Minh' };
}
