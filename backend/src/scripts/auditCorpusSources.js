import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { lookupVbpl } from '../services/vbplResearch.js';
const root = new URL('../../../reports/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('LEGAL_FILE_MANIFEST.json', root), 'utf8'));
const numbers = [...new Set(manifest.entries.map(e => e.law_number).filter(Boolean))];
const results = [];
// Kiểm tra công khai chỉ theo số hiệu; không gửi nội dung các tệp cách ly.
for (let offset = 0; offset < numbers.length; offset += 3) {
  const batch = await Promise.all(numbers.slice(offset, offset + 3).map(async number => {
    const started = performance.now();
    const research = await lookupVbpl({ question: number }, { enabled: true, cache: { find: async () => [], save: async () => {} } });
    return { law_number: number, elapsed_ms: Math.round(performance.now() - started), source_status: research.source_status,
      results: research.results.map(({ law_number, source_url, checked_at, source_sha256, verification_status }) => ({ law_number, source_url, checked_at, source_sha256, verification_status })), diagnostics: research.diagnostics };
  }));
  results.push(...batch);
  console.log(JSON.stringify(batch.map(({ law_number, source_status, elapsed_ms }) => ({ law_number, source_status, elapsed_ms }))));
}
await writeFile(new URL('LEGAL_OFFICIAL_SOURCE_AUDIT.json', root), JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2));
