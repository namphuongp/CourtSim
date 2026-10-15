import { readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

let count = 0;
async function check(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) { await check(file); continue; }
    if (!['.js', '.mjs'].includes(extname(file))) continue;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) { process.stderr.write(result.stderr); process.exitCode = 1; }
    count++;
  }
}
for (const dir of ['backend/src', 'backend/tests', 'shared', 'scripts']) await check(resolve(import.meta.dirname, '..', dir));
console.log(`Đã kiểm tra cú pháp ${count} tệp JavaScript. Đây không phải kiểm tra kiểu TypeScript.`);
