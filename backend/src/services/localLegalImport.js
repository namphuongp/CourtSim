import { readFile, mkdir, copyFile, constants } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLawFile, inspectLawText, containedPath, hash } from './legalFileInventory.js';
import { parseLegalArticles, createProvisionUnits, getProvisionLocator, getProvisionLocatorKey, buildPageOffsets } from './legalTextParser.js';
import { getLegalSearchTerms } from './legalTextSearch.js';

export const legalArchiveRoot = fileURLToPath(new URL('../../storage/legal-sources/', import.meta.url));
export const LOCAL_LAW_NOTE = 'Nội dung đọc từ tài liệu do người dùng cung cấp cho mô phỏng, cần đối chiếu thời điểm, sửa đổi và chuyển tiếp trước khi kết luận luật áp dụng.';

export function localLawArticles(text, pages = []) {
  // Không gộp biểu mẫu/phụ lục đánh số lại thành điều của văn bản chính.
  const appendix = text.search(/\n\s*(?:PHỤ LỤC|Phụ lục)(?:\s+[IVX\d]+)?\s*\n/u);
  const main = appendix < 0 ? text : text.slice(0, appendix);
  const parsed = parseLegalArticles(main, pages);
  const selected = []; let expected = 1, cursor = 0;
  for (const item of parsed) {
    const start = main.indexOf(item.text, cursor);
    if (start < 0) continue;
    cursor = start + item.text.length;
    // Các điều được trích lại trong luật sửa đổi không mang số điều của luật sửa đổi.
    if (item.article !== String(expected)) continue;
    selected.push({ ...item, start }); expected++;
  }
  return selected.map((item, i) => {
    const end = selected[i + 1]?.start ?? main.length;
    const raw = main.slice(item.start, end).replace(/\n\s*(?:Nơi nhận:|TM\.\s*CHÍNH PHỦ|CHỦ TỊCH QUỐC HỘI|VĂN PHÒNG CHÍNH PHỦ XUẤT BẢN)[\s\S]*$/u, '').trim();
    const body = raw.replace(/^Điều\s+\d+[a-z]?[\s.:–-]*/iu, '');
    const covered = pages.filter(p => p.start < end && p.end > item.start);
    return { ...item, text: raw, body, pageFrom: covered[0]?.sourcePageNumber ?? null,
      pageTo: covered.at(-1)?.sourcePageNumber ?? null,
      pageSourceFile: covered.length && covered.every(p => p.sourceFile === covered[0].sourceFile) ? covered[0].sourceFile : item.pageSourceFile };
  });
}

export async function prepareLocalLaw(review, root, { archive = false, archiveRoot = legalArchiveRoot } = {}) {
  if (review.permission?.basis !== 'user_authorized_simulation' || review.permission.status !== 'allowed'
    || typeof review.permission.evidence !== 'string' || review.permission.evidence.length < 30
    || !review.files?.length || review.files.length > 10) throw new Error('LOCAL_AUTHORIZATION_REQUIRED');
  const files = [], groups = [];
  for (const file of review.files) {
    const path = await containedPath(root, file.path), bytes = await readFile(path);
    if (hash(bytes) !== file.sha256) throw new Error('SOURCE_CHANGED_REVIEW_REQUIRED');
    const extracted = await extractLawFile(path);
    const extension = extname(path).toLowerCase();
    if (!['.doc', '.docx', '.pdf', '.html', '.htm', '.txt'].includes(extension)) throw new Error('UNSUPPORTED_SOURCE');
    const archiveFile = `${file.sha256}${extension}`;
    if (archive) {
      await mkdir(archiveRoot, { recursive: true });
      try { await copyFile(path, resolve(archiveRoot, archiveFile), constants.COPYFILE_EXCL); }
      catch (error) { if (error.code !== 'EEXIST' || hash(await readFile(resolve(archiveRoot, archiveFile))) !== file.sha256) throw new Error('ARCHIVE_CONFLICT'); }
    }
    files.push({ path: file.path, sha256: file.sha256, page_count: extracted.pages.length || null, archive_file: archiveFile });
    groups.push({ ...extracted, fileName: file.path, pageOffset: groups.reduce((n, g) => n + g.pages.length, 0) });
  }
  const { text, pages } = buildPageOffsets(groups);
  const metadata = inspectLawText({ text });
  if (!metadata.law_number || metadata.law_number !== review.law_number) throw new Error('DOCUMENT_IDENTITY_MISMATCH');
  const articles = localLawArticles(text, pages);
  if (!articles.length) throw new Error('NO_UNAMBIGUOUS_ARTICLES');
  const fingerprint = hash(JSON.stringify({ parser: 'local-law-1', files: files.map(f => f.sha256) }));
  // Công bố nguồn cục bộ đọc được, không tự gán chứng nhận VBPL hoặc khoảng hiệu lực.
  const document = { fingerprint, law_number: review.law_number, title: review.title || metadata.title,
    issuing_body: metadata.issuing_body, promulgated_at: metadata.extracted_promulgated_at,
    document_kind: review.document_kind ?? metadata.document_kind, status: 'reference', permission_status: 'allowed',
    permission_evidence: review.permission.evidence, source_verification: 'local_read',
    source_url: `/api/v1/legal-sources/${fingerprint}/files/0`, source_sha256: hash(text), checked_at: new Date(),
    version: `Bản tài liệu người dùng cung cấp — ${review.law_number}`, source_files: files, source_priority: review.priority ?? 0,
    version_rules: [], relations: [], import_notes: [LOCAL_LAW_NOTE,
      ...(articles.length !== parseLegalArticles(text).length ? ['Chỉ lập chỉ mục dãy điều chính, giữ nguyên phần sửa đổi lồng trong điều và phụ lục ở tệp gốc.'] : [])] };
  const provisions = articles.flatMap(a => createProvisionUnits(a).map(u => ({ ...u, chapter: a.chapter, section: a.section,
    locator_key: getProvisionLocatorKey(u), locator: getProvisionLocator(u), page_from: a.pageFrom, page_to: a.pageTo,
    page_source_file: a.pageSourceFile, search_tokens: getLegalSearchTerms(u.text, 2000) })));
  return { document, provisions, article_count: articles.length };
}
