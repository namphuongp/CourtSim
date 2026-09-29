import { readFile } from 'node:fs/promises';
import { hash, containedPath, extractLawFile, compactLaw, inspectLawText } from './legalFileInventory.js';
import { buildPageOffsets, parseLegalArticles, createProvisionUnits, getProvisionLocator, getProvisionLocatorKey } from './legalTextParser.js';
import { getLegalSearchTerms } from './legalTextSearch.js';
import { fetchOfficialPage, fetchOfficialFile } from './officialLegalSources.js';
import { parseVbplPage } from './vbplResearch.js';
import { isVbplUrl } from '../../../shared/legalSourcePolicy.mjs';
import { validateVersionReview } from './legalVersionReview.js';
import LegalCorpusVersion from '../models/LegalCorpusVersion.js';
import LegalCorpusProvision from '../models/LegalCorpusProvision.js';

const PARSER = 'corpus-1';
export async function prepareCorpusImport(review, root, { fetchPage = fetchOfficialPage, fetchFile = fetchOfficialFile } = {}) {
  if (!review || !Array.isArray(review.files) || !review.files.length || review.files.length > 10
    || !review.law_number || !review.title || !['original', 'amendment', 'consolidated', 'annex'].includes(review.document_kind)
    || review.permission?.status !== 'allowed' || !['official_original', 'explicit_permission'].includes(review.permission.basis)
    || typeof review.permission.evidence !== 'string' || review.permission.evidence.length < 30
    || !review.completeness_reviewed || !Number.isInteger(review.expected_articles) || review.expected_articles < 1
    || !isVbplUrl(review.official_url)) throw new Error('INCOMPLETE_SOURCE_OR_PERMISSION_REVIEW');
  const groups = [], sourceFiles = [];
  for (const file of review.files) {
    const path = await containedPath(root, file.path), bytes = await readFile(path);
    if (hash(bytes) !== file.sha256) throw new Error('SOURCE_CHANGED_REVIEW_REQUIRED');
    let zone = ''; try { zone = await readFile(`${path}:Zone.Identifier`, 'utf8'); } catch { /* Không giả định nguồn khi thiếu ADS. */ }
    const extracted = await extractLawFile(path);
    if (/thuvienphapluat|thư\s*viện\s*pháp\s*luật|lược đồ|so sánh điều khoản/iu.test(zone + extracted.text)
      && review.permission.basis !== 'explicit_permission') throw new Error('PENDING_PERMISSION');
    if (extracted.pages.some(p => p.text.replace(/\s/gu, '').length < 40) && !review.page_review_evidence) throw new Error('OCR_OR_PAGE_REVIEW_REQUIRED');
    sourceFiles.push({ path: file.path, sha256: file.sha256, page_count: extracted.pages.length || null, official_url: file.official_file_url ?? null });
    groups.push({ ...extracted, fileName: file.path, pageOffset: groups.reduce((n, g) => n + g.pages.length, 0) });
  }
  const { text, pages } = buildPageOffsets(groups);
  if (inspectLawText({ text }).law_number !== review.law_number) throw new Error('DOCUMENT_IDENTITY_MISMATCH');
  const articles = parseLegalArticles(text, pages);
  if (articles.length !== review.expected_articles || new Set(articles.map(a => a.article)).size !== articles.length) throw new Error('INCOMPLETE_OR_AMBIGUOUS_ARTICLES');
  let snapshot;
  if (sourceFiles.every(f => isVbplUrl(f.official_url))) {
    // PDF gốc: đối chiếu từng byte, không ép văn bản qua HTML hoặc bỏ qua phần bị thiếu.
    for (const file of sourceFiles) {
      const remote = await fetchFile(file.official_url);
      if (remote.sha256 !== file.sha256) throw new Error('OFFICIAL_FILE_MISMATCH');
    }
    snapshot = { source_url: sourceFiles[0].official_url, source_text: text,
      source_sha256: hash(sourceFiles.map(f => f.sha256).join(':')), checked_at: new Date().toISOString() };
  } else {
    const page = await fetchPage(review.official_url);
    snapshot = parseVbplPage(page, review.law_number);
    if (!snapshot?.source_text) throw new Error('OFFICIAL_CONTENT_UNAVAILABLE');
    const official = parseLegalArticles(snapshot.source_text);
    if (official.length !== articles.length || articles.some((a, i) => a.article !== official[i].article || compactLaw(a.text) !== compactLaw(official[i].text))) throw new Error('OFFICIAL_TEXT_MISMATCH');
  }
  // Định danh bất biến gắn với byte nguồn và phiên bản parser; không ghi đè trích dẫn cũ.
  const fingerprint = hash(JSON.stringify({ parser: PARSER, files: sourceFiles.map(f => f.sha256), source: hash(compactLaw(snapshot.source_text)),
    review: { permission: review.permission, version_review: review.version_review, relations: review.relations, version: review.version } }));
  let rules = [];
  if (review.version_review) {
    if (review.document_kind === 'consolidated') throw new Error('CONSOLIDATION_HAS_NO_INDEPENDENT_EFFECTIVE_PERIOD');
    const urls = [...new Set(review.version_review.rules.flatMap(r => r.review_sources ?? []))];
    if (urls.length > 10) throw new Error('TOO_MANY_REVIEW_SOURCES');
    const snapshots = await Promise.all(urls.map(fetchPage));
    rules = validateVersionReview({ ...review.version_review, source_fingerprint: fingerprint, law_number: review.law_number }, { source_fingerprint: fingerprint, law_number: review.law_number }, snapshots);
  }
  for (const relation of review.relations ?? []) {
    const sourceIndex = sourceFiles.findIndex(f => f.official_url === relation.source_url);
    const evidenceText = sourceIndex >= 0 ? groups[sourceIndex].text : relation.source_url === snapshot.source_url ? snapshot.source_text : '';
    if (!['amends', 'supplements', 'replaces', 'guides'].includes(relation.type) || !relation.target
      || typeof relation.quote !== 'string' || relation.quote.length < 20
      || !evidenceText.includes(relation.quote)) throw new Error('UNVERIFIED_RELATION');
  }
  const document = { fingerprint, law_number: review.law_number, title: review.title, issuing_body: review.issuing_body,
    promulgated_at: review.promulgated_at ?? null, document_kind: review.document_kind,
    status: 'verified', permission_status: 'allowed', permission_evidence: review.permission.evidence,
    source_url: snapshot.source_url, source_sha256: snapshot.source_sha256, checked_at: snapshot.checked_at,
    source_verification: 'verified', version: review.version ?? `${review.law_number} — ${PARSER}`,
    source_files: sourceFiles, version_rules: rules, relations: review.relations ?? [] };
  const provisions = articles.flatMap(a => createProvisionUnits(a).map(u => ({ ...u, chapter: a.chapter, section: a.section,
    locator_key: getProvisionLocatorKey(u), locator: getProvisionLocator(u), page_from: a.pageFrom, page_to: a.pageTo,
    page_source_file: a.pageSourceFile, search_tokens: getLegalSearchTerms(u.text, 2000) })));
  return { document, provisions };
}

export async function commitCorpusImport({ document, provisions }) {
  const existing = await LegalCorpusVersion.findOne({ fingerprint: document.fingerprint }).lean();
  if (['verified', 'reference'].includes(existing?.status) && !existing.retired_at) return { status: 'unchanged', id: String(existing._id), provisions: provisions.length };
  // Chỉ công bố sau khi ghi đủ units; lỗi giữa chừng để needs_review, có thể chạy lại.
  const draft = await LegalCorpusVersion.findOneAndUpdate({ fingerprint: document.fingerprint },
    { $setOnInsert: { ...document, status: 'needs_review' } }, { upsert: true, returnDocument: 'after', runValidators: true });
  if (draft.retired_at) throw new Error('RETIRED_VERSION_REQUIRES_NEW_REVIEW');
  await LegalCorpusProvision.bulkWrite(provisions.map(p => ({ updateOne: { filter: { document_id: draft._id, locator_key: p.locator_key },
    update: { $setOnInsert: { ...p, document_id: draft._id } }, upsert: true } })), { ordered: true });
  const count = await LegalCorpusProvision.countDocuments({ document_id: draft._id });
  if (count !== provisions.length) throw new Error('INCOMPLETE_IMPORT');
  await LegalCorpusVersion.updateOne({ _id: draft._id, retired_at: null }, { $set: document }, { runValidators: true });
  return { status: 'imported', id: String(draft._id), provisions: count };
}
