import { lstat, realpath, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const root = await realpath(resolve(import.meta.dirname, '..'));
const target = resolve(root, '.test-artifacts');
const info = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
if (info) {
  // Không đi theo junction/symlink để tránh xóa dữ liệu ngoài thư mục kiểm thử.
  if (info.isSymbolicLink() || !(await realpath(target)).startsWith(root + sep)) throw new Error('Thư mục kết quả không nằm trong workspace.');
  await rm(target, { recursive: true });
}
console.log('Đã dọn kết quả kiểm thử cục bộ.');
