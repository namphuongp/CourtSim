import ExcelJS from 'exceljs';
import { AppError } from '../utils/AppError.js';

export const EXPORT_LIMIT = 10000;
export function exportOptions(opts, exporting) {
  return exporting ? { ...opts, page: 1, skip: 0, limit: EXPORT_LIMIT + 1 } : opts;
}
const text = value => value == null ? '' : String(value);
const date = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
const status = value => ({ paid: 'Đã thanh toán', pending: 'Chờ thanh toán', processing: 'Đang xác minh', expired: 'Đã hết hạn', cancelled: 'Đã hủy', refunded: 'Đã hoàn tiền' })[value] ?? text(value);

function sheet(workbook, name, headers, rows) {
  const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = headers.map(header => ({ header, width: 26 }));
  // Only primitive strings/numbers are accepted: untrusted text cannot become an Excel formula.
  for (const row of rows) ws.addRow(row);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: headers.length } };
  ws.eachRow((row, index) => { if (index > 1) row.eachCell(cell => { if (typeof cell.value === 'number') cell.numFmt = '#,##0'; }); });
  return ws;
}

export async function createAdminWorkbook(kind, result, query = {}) {
  if (result.pagination.total > EXPORT_LIMIT) throw new AppError('Có quá 10.000 dòng. Hãy thu hẹp bộ lọc trước khi xuất Excel.', 400, 'EXPORT_TOO_LARGE');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CourtSim';
  if (kind === 'users') {
    sheet(workbook, 'Người dùng', ['Mã người dùng', 'Tên người dùng', 'Email', 'Xác thực email', 'Vai trò', 'Ngày đăng ký (GMT+7)', 'Số phiên', 'Hoạt động gần nhất (GMT+7)', 'Trạng thái'],
      result.data.map(u => [text(u._id), text(u.username), text(u.email), u.email_verified ? 'Đã xác thực' : 'Chưa xác thực', u.system_role === 'admin' ? 'Quản trị viên' : 'Người học', date(u.created_at), u.sessions ?? 0, date(u.lastActivityAt), u.status === 'active' ? 'Hoạt động' : 'Đã vô hiệu hóa']));
  } else {
    if (query.view === 'users') {
      sheet(workbook, 'Theo người dùng', ['Mã người dùng', 'Tên người dùng', 'Email', 'Tổng đơn', 'Đơn đã thanh toán', 'Đã thanh toán (VND)', 'Đơn chờ hoặc đang xác minh', 'Chờ hoặc đang xác minh (VND)', 'Thanh toán gần nhất (GMT+7)'],
        result.data.map(p => [text(p._id), text(p.user?.username), text(p.user?.email), p.totalOrders, p.paidCount, p.paidAmount, p.pendingCount, p.pendingAmount, date(p.lastPaymentAt)]));
    } else {
      sheet(workbook, 'Giao dịch', ['Mã đơn', 'Mã giao dịch', 'Tên người dùng', 'Email', 'Gói', 'Số tiền (VND)', 'Trạng thái', 'Ngày tạo (GMT+7)', 'Ngày thanh toán (GMT+7)'],
        result.data.map(p => [text(p.order_code), text(p.transaction_id), text(p.user?.username), text(p.user?.email), text(p.plan?.name || p.type), p.amount, status(p.status), date(p.created_at), date(p.paid_at)]));
    }
    const s = result.summary;
    sheet(workbook, 'Tổng hợp', ['Chỉ tiêu', 'Giá trị'], [['Tổng đơn', s.totalOrders], ['Đơn đã thanh toán', s.paidCount], ['Đã thanh toán (VND)', s.paidAmount], ['Đơn chờ hoặc đang xác minh', s.pendingCount], ['Chờ hoặc đang xác minh (VND)', s.pendingAmount]]);
  }
  sheet(workbook, 'Thông tin', ['Thông tin', 'Giá trị'], [['Thời điểm xuất (GMT+7)', date(new Date())], ['Số dòng', result.data.length],
    ...Object.entries(query).filter(([key, value]) => !['page', 'limit'].includes(key) && value).map(([key, value]) => [text(key), text(value)])]);
  return workbook.xlsx.writeBuffer();
}

export async function sendAdminExport(res, kind, result, query) {
  const buffer = await createAdminWorkbook(kind, result, query);
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="courtsim-${kind}.xlsx"`);
  res.send(Buffer.from(buffer));
}
