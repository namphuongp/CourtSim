import { readFile, readdir, stat, realpath } from 'node:fs/promises';
import { resolve, relative, extname, basename, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { extractPdfText, extractLegacyDocText, parseLegalArticles, createProvisionUnits } from './legalTextParser.js';
import { htmlText } from './vbplResearch.js';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const formats = new Set(['.pdf', '.doc', '.docx', '.html', '.htm', '.txt', '.rtf']);
const thirdParty = /thuvienphapluat|thư\s*viện\s*pháp\s*luật|lược đồ|so sánh điều khoản|bình luận chuyên gia/iu;
export const compactLaw = text => text.normalize('NFC').replace(/\s+/gu, ' ').trim();

export async function containedPath(root, file) {
  const base = await realpath(root), target = await realpath(resolve(base, file));
  const rel = relative(base, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('FILE_OUTSIDE_SOURCE_ROOT');
  return target;
}

export async function extractLawFile(path) {
  const bytes = await readFile(path);
  if (bytes.length > 30_000_000) throw new Error('SOURCE_TOO_LARGE');
  if (bytes.subarray(0, 5).toString() === '%PDF-') return { ...await extractPdfText(path), format: 'pdf' };
  if (bytes.subarray(0, 2).toString('hex') === 'd0cf' || bytes.subarray(0, 2).toString() === 'PK') {
    return { ...await extractLegacyDocText(path), format: bytes.subarray(0, 2).toString() === 'PK' ? 'docx' : 'doc' };
  }
  const text = bytes.toString('utf8');
  if (/<(?:html|!doctype|body)\b/iu.test(text.slice(0, 3000))) return { text: htmlText(text), pages: [], format: 'html' };
  if (extname(path).toLowerCase() === '.txt') return { text, pages: [], format: 'txt' };
  throw new Error('UNSUPPORTED_OR_CORRUPT_SOURCE');
}

export function inspectLawText({ text, pages = [], format }, provenance = '', fileName = '') {
  const head = text.slice(0, 5000);
  const identity = head.match(/Số\s*[:：]\s*([\d]+(?:[-/][\p{L}\d]+)+)/iu)?.[1]?.toUpperCase() ?? null;
  const filenameNumber = fileName.match(/^(\d+)_(\d{4})_([A-ZĐ]+\d*(?:-[A-ZĐ]+)?)/iu);
  const expected = filenameNumber ? `${filenameNumber[1]}/${filenameNumber[2]}/${filenameNumber[3]}`.toUpperCase().replace('ND-', 'NĐ-') : null;
  const articles = parseLegalArticles(text);
  const numbers = articles.map(a => a.article);
  const isEditorial = thirdParty.test(provenance) || thirdParty.test(text);
  const scanPages = pages.filter(p => p.text.replace(/\s/gu, '').length < 40).map(p => p.pageNumber);
  const problems = [];
  if (!identity) problems.push('identity_not_confirmed');
  if (expected && identity && expected !== identity) problems.push('filename_identity_mismatch');
  if (!articles.length) problems.push('no_articles');
  if (new Set(numbers).size !== numbers.length) problems.push('duplicate_article_numbers_or_amendment_quotes');
  if (numbers.some((n, i) => /^\d+$/u.test(n) && i && Number(n) > Number(numbers[i - 1]) + 1)) problems.push('article_gaps_or_partial_document');
  if (numbers.length && numbers[0] !== '1') problems.push('starts_mid_document');
  if (scanPages.length) problems.push('ocr_or_page_review_required');
  const kind = /VĂN BẢN HỢP NHẤT|\bVBHN\b/iu.test(head) ? 'consolidated'
    : /^(?:\s*PHỤ LỤC)/iu.test(text) ? 'annex'
      : /(?:LUẬT|NGHỊ ĐỊNH)[\s\S]{0,350}SỬA ĐỔI/iu.test(head) ? 'amendment' : 'original';
  const heading = head.match(/(?:^|\n)\s*((?:BỘ LUẬT|LUẬT|NGHỊ ĐỊNH|VĂN BẢN HỢP NHẤT)[^\n]*)(?:\n([^\n]+))?/iu);
  const title = heading ? [heading[1].trim(), /^(?:BỘ LUẬT|LUẬT|NGHỊ ĐỊNH)$/iu.test(heading[1].trim()) ? heading[2]?.trim() : null].filter(Boolean).join(' ') : null;
  const issued = head.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu);
  return { law_number: identity, title,
    issuing_body: head.match(/QUỐC HỘI|CHÍNH PHỦ|HỘI ĐỒNG NHÀ NƯỚC/iu)?.[0] ?? null,
    promulgated_at: null, effective_from: null, effective_to: null,
    extracted_promulgated_at: issued ? `${issued[3]}-${issued[2].padStart(2, '0')}-${issued[1].padStart(2, '0')}` : null,
    metadata_verification: 'needs_review',
    document_kind: kind, format, article_count: articles.length,
    provision_count: articles.flatMap(createProvisionUnits).length,
    page_count: pages.length || null, ocr_pages: scanPages, completeness: 'not_verified',
    has_annex: /(?:^|\n)\s*PHỤ LỤC/imu.test(text),
    readability: scanPages.length ? 'needs_ocr_review' : text.trim() ? 'readable' : 'unreadable',
    status: isEditorial ? 'pending_permission' : 'needs_review',
    permission_status: 'pending_permission',
    reasons: [...(isEditorial ? ['third_party_download_or_editorial_content'] : ['provenance_and_usage_not_verified']), ...problems] };
}

export async function inventoryFiles(root) {
  const declarations = JSON.parse(await readFile(new URL('../data/legalFileDeclarations.json', import.meta.url), 'utf8'));
  const paths = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (formats.has(extname(entry.name).toLowerCase())) paths.push(path);
    }
  }
  await walk(root);
  const entries = [], seen = new Map(), seenText = new Map();
  for (const path of paths.sort()) {
    const bytes = await readFile(path), sha256 = hash(bytes);
    let zone = ''; try { zone = await readFile(`${path}:Zone.Identifier`, 'utf8'); } catch { /* ADS chỉ có trên Windows. */ }
    const sourceUrl = zone.match(/^HostUrl=(.+)$/mu)?.[1]?.replace(/\0/gu, '').trim() ?? null;
    // Chỉ xuất metadata; tuyệt đối không ghi nguyên văn tệp cách ly vào log/manifest.
    let host = null; try { host = sourceUrl ? new URL(sourceUrl).hostname : null; } catch { /* ADS không hợp lệ không làm hỏng cả đợt nhập. */ }
    const entry = { path: relative(root, path).replaceAll('\\', '/'), extension: extname(path), size: (await stat(path)).size,
      sha256, download_source: host, source_url: sourceUrl,
      official_url: null, checked_at: new Date().toISOString(), duplicate_of: seen.get(sha256) ?? null };
    if (/^(?:Case1|Tiêu chí chấm điểm)/iu.test(basename(path))) {
      Object.assign(entry, { status: 'needs_review', excluded: true, source_url: null, download_source: null, reasons: ['not_a_legal_authority'] });
    } else try {
      const extracted = await extractLawFile(path);
      Object.assign(entry, inspectLawText(extracted, zone, basename(path)));
      entry.text_sha256 = hash(compactLaw(extracted.text));
      entry.equivalent_text_of = seenText.get(entry.text_sha256) ?? null;
      seenText.set(entry.text_sha256, entry.path);
    }
    catch { Object.assign(entry, { status: thirdParty.test(zone) ? 'pending_permission' : 'unavailable', permission_status: 'pending_permission', readability: 'unreadable', reasons: ['extraction_failed'], format: extname(path).slice(1) }); }
    const declaration = declarations.find(d => d.sha256 === sha256);
    if (declaration && entry.format === 'pdf') {
      entry.permission_status = declaration.permission_status;
      entry.permission_evidence = declaration.evidence;
      entry.download_source = declaration.source_origin;
      entry.page_review = declaration.page_review;
      entry.ocr_pages = (entry.ocr_pages ?? []).filter(p => !declaration.page_review?.non_content_pages.includes(p));
      if (!entry.ocr_pages.length) { entry.readability = 'readable'; entry.reasons = entry.reasons.filter(r => r !== 'ocr_or_page_review_required'); }
      entry.reasons = entry.reasons.map(r => r === 'provenance_and_usage_not_verified' ? 'official_document_url_and_text_not_verified' : r);
    }
    entries.push(entry); seen.set(sha256, entry.path);
  }
  for (const entry of entries) entry.same_number_as = entry.law_number ? entries.filter(other => other !== entry && other.law_number === entry.law_number).map(other => other.path) : [];
  return { schema_version: 1, generated_at: new Date().toISOString(), entries };
}
