import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventoryFiles } from '../services/legalFileInventory.js';
import { prepareCorpusImport, commitCorpusImport } from '../services/legalCorpusImport.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import LegalCorpusVersion from '../models/LegalCorpusVersion.js';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
const options = { root: resolve(repo, 'LawDoc'), output: resolve(repo, 'reports/LEGAL_FILE_MANIFEST.json') };
try {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') options.apply = true;
    else if (['--root', '--output', '--reviews', '--retire'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
    else throw new Error('INVALID_ARGUMENT');
  }
  if (options.retire) {
    if (!options.apply || !/^[a-f0-9]{64}$/u.test(options.retire)) throw new Error('RETIRE_REQUIRES_FINGERPRINT_AND_APPLY');
    await connectDatabase();
    const result = await LegalCorpusVersion.updateOne({ fingerprint: options.retire }, { $set: { status: 'needs_review', retired_at: new Date() } });
    console.log(JSON.stringify({ retired: result.modifiedCount }));
  } else {
    const manifest = await inventoryFiles(options.root);
    const reviews = options.reviews ? JSON.parse(await readFile(options.reviews, 'utf8')) : [];
    if (!Array.isArray(reviews) || reviews.length > 100) throw new Error('INVALID_REVIEWS');
    manifest.imports = [];
    if (options.apply) await connectDatabase();
    for (const review of reviews) {
      try {
        const prepared = await prepareCorpusImport(review, options.root);
        const result = options.apply ? await commitCorpusImport(prepared) : { status: 'ready_dry_run', provisions: prepared.provisions.length };
        manifest.imports.push({ law_number: review.law_number, fingerprint: prepared.document.fingerprint, ...result });
        for (const file of review.files) {
          const entry = manifest.entries.find(e => e.path === file.path && e.sha256 === file.sha256);
          if (entry) Object.assign(entry, { status: 'verified', permission_status: 'allowed', official_url: review.official_url, review_evidence: review.permission.evidence });
        }
      } catch (error) {
        // Chỉ mã lỗi cố định; không in nội dung tài liệu, parser stack hoặc lời khai.
        manifest.imports.push({ law_number: review.law_number, status: 'not_imported', reason: /^[A-Z_]+$/u.test(error.message) ? error.message : 'SOURCE_REVIEW_FAILED' });
      }
    }
    await mkdir(dirname(resolve(options.output)), { recursive: true });
    await writeFile(options.output, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry_run', files: manifest.entries.length,
      statuses: manifest.entries.reduce((m, e) => ({ ...m, [e.status]: (m[e.status] ?? 0) + 1 }), {}), imports: manifest.imports }));
  }
} catch (error) { console.error(/^[A-Z_]+$/u.test(error.message) ? error.message : 'CORPUS_OPERATION_FAILED'); process.exitCode = 1; }
finally { await disconnectDatabase(); }
