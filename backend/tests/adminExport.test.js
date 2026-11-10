import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createAdminWorkbook, exportOptions, EXPORT_LIMIT } from '../src/services/adminExport.js';

async function read(kind, data, query = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createAdminWorkbook(kind, data, query));
  return workbook;
}
test('Excel users preserves Vietnamese and treats formula-like input as text, excludes secrets', async () => {
  const workbook = await read('users', { pagination: { total: 1 }, data: [{ _id: '001', username: '=HYPERLINK("https://example.test")', email: 'ánh@example.test', sessions: 12, status: 'active', password_hash: 'SECRET' }] });
  const ws = workbook.getWorksheet('Người dùng');
  assert.equal(ws.getCell('A2').value, '001');
  assert.equal(ws.getCell('B2').type, ExcelJS.ValueType.String);
  assert.equal(ws.getCell('C2').value, 'ánh@example.test');
  assert.equal(ws.getCell('G2').value, 12);
  assert.doesNotMatch(JSON.stringify(workbook.model), /SECRET/);
});
test('Excel payments keeps amounts numeric and summary from all matching rows', async () => {
  const summary = { totalOrders: 1, paidCount: 1, paidAmount: 99000, pendingCount: 0, pendingAmount: 0 };
  const workbook = await read('payments', { pagination: { total: 1 }, summary, data: [{ order_code: '0001', amount: 99000, status: 'paid', paid_at: '2026-01-01T20:00:00Z' }] });
  assert.equal(workbook.getWorksheet('Giao dịch').getCell('F2').value, 99000);
  assert.equal(workbook.getWorksheet('Giao dịch').getCell('G2').value, 'Đã thanh toán');
  assert.match(workbook.getWorksheet('Giao dịch').getCell('I2').value, /2\/1\/2026/);
  assert.equal(workbook.getWorksheet('Tổng hợp').getCell('B4').value, 99000);
  const grouped = await read('payments', { pagination: { total: 1 }, summary, data: [{ _id: 'deleted-user', ...summary }] }, { view: 'users' });
  assert.equal(grouped.getWorksheet('Theo người dùng').getCell('F2').value, 99000);
});
test('Excel empty results and export limit never silently truncate', async () => {
  const workbook = await read('users', { pagination: { total: 0 }, data: [] });
  assert.equal(workbook.getWorksheet('Người dùng').rowCount, 1);
  await assert.rejects(createAdminWorkbook('users', { pagination: { total: EXPORT_LIMIT + 1 }, data: [] }), { code: 'EXPORT_TOO_LARGE' });
  assert.deepEqual(exportOptions({ page: 4, skip: 60, limit: 20 }, true), { page: 1, skip: 0, limit: EXPORT_LIMIT + 1 });
});
