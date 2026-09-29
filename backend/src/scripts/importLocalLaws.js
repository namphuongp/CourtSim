import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { prepareLocalLaw } from '../services/localLegalImport.js';
import { commitCorpusImport } from '../services/legalCorpusImport.js';

const reviewPath = new URL('../../../reports/LEGAL_LOCAL_USE_REVIEWS.json', import.meta.url);
const sourceRoot = new URL('../../../LawDoc/', import.meta.url);
try {
  const apply = process.argv.slice(2).includes('--apply');
  if (process.argv.slice(2).some(a => a !== '--apply')) throw new Error('INVALID_ARGUMENT');
  const reviews = JSON.parse(await readFile(reviewPath, 'utf8'));
  if (apply) await connectDatabase();
  const results = [];
  for (const review of reviews) {
    try {
      const prepared = await prepareLocalLaw(review, sourceRoot, { archive: apply });
      const outcome = apply ? await commitCorpusImport(prepared) : { status: 'ready' };
      results.push({ law_number: review.law_number, files: review.files.map(f => f.path), fingerprint: prepared.document.fingerprint,
        articles: prepared.article_count, provisions: prepared.provisions.length, source_verification: 'local_read', ...outcome });
    } catch (error) { results.push({ law_number: review.law_number, files: review.files.map(f => f.path), status: 'not_imported',
      error: /^[A-Z_]+$/u.test(error.message) ? error.message : 'LOCAL_IMPORT_FAILED' }); }
  }
  await writeFile(new URL('../../../reports/LEGAL_LOCAL_USE_RESULT.json', import.meta.url), JSON.stringify({ mode: apply ? 'apply' : 'dry_run', checked_at: new Date(), results }, null, 2));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry_run', documents: results.length,
    statuses: results.reduce((counts, r) => ({ ...counts, [r.status]: (counts[r.status] ?? 0) + 1 }), {}),
    articles: results.reduce((n, r) => n + (r.articles ?? 0), 0), provisions: results.reduce((n, r) => n + (r.provisions ?? 0), 0),
    failures: results.filter(r => r.status === 'not_imported') }));
  if (results.some(r => r.status === 'not_imported')) process.exitCode = 1;
} finally { await disconnectDatabase(); }
