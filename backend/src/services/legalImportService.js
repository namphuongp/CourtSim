import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { getAuthorityMetadata } from '../data/legalAuthorities.js';
import { LegalDocument, LegalProvision } from '../models/index.js';
import {
  buildPageOffsets,
  createProvisionUnits,
  extractLegacyDocText,
  extractPdfText,
  getProvisionLocator,
  getProvisionLocatorKey,
  parseLegalArticles,
} from './legalTextParser.js';
import { isCitationEligibleOnDate } from './legalRetrievalService.js';
import { getLegalSearchTerms } from './legalTextSearch.js';

const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export function getSourceFingerprint(sourceFiles) {
  const stableFiles = [...sourceFiles]
    .sort((left, right) => collator.compare(left.name, right.name))
    .map(({ sha256 }) => sha256)
    .sort();
  return createHash('sha256').update(JSON.stringify(stableFiles)).digest('hex');
}

async function readSource(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.pdf') {
    const extracted = await extractPdfText(filePath);
    return { ...extracted, pageCount: extracted.pages.length };
  }
  if (extension === '.doc') {
    const extracted = await extractLegacyDocText(filePath);
    return { ...extracted, pageCount: null };
  }
  throw new Error(`Chỉ hỗ trợ tệp PDF hoặc DOC cũ: ${basename(filePath)}.`);
}

export async function importLegalDocument({ lawNumber, filePaths }) {
  const authority = getAuthorityMetadata(lawNumber);
  if (!authority) throw new Error(`Chưa có metadata đã rà soát cho văn bản ${lawNumber}.`);
  if (!Array.isArray(filePaths) || filePaths.length === 0) throw new Error('Cần cung cấp ít nhất một tệp nguồn.');

  const orderedPaths = [...filePaths].sort((left, right) => collator.compare(basename(left), basename(right)));
  const extractedFiles = [];
  const sourceFiles = [];
  for (const filePath of orderedPaths) {
    const source = await readSource(filePath);
    const bytes = await readFile(filePath);
    const fileName = basename(filePath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    extractedFiles.push({ name: fileName, ...source });
    sourceFiles.push({ name: fileName, sha256, page_count: source.pageCount });
  }

  const pageGroups = [];
  let pageOffset = 0;
  for (const file of extractedFiles) {
    pageGroups.push({ pages: file.pages, pageOffset, text: file.text, fileName: file.name });
    pageOffset += file.pages.length;
  }

  const { text: sourceText, pages } = buildPageOffsets(pageGroups);
  if (!sourceText.slice(0, 2000).includes(lawNumber)) throw new Error('Số hiệu trong đầu văn bản không khớp metadata.');
  const articles = parseLegalArticles(sourceText, pages);
  if (!articles.length) throw new Error(`Không tìm thấy cấu trúc "Điều" trong văn bản ${lawNumber}.`);
  const expectedArticles = { '45/2013/QH13': 212, '31/2024/QH15': 260, '91/2015/QH13': 689, '92/2015/QH13': 517 }[lawNumber];
  // Chặn tệp thiếu phần hoặc sai thứ tự trước khi ghi bất kỳ dữ liệu nào.
  if (expectedArticles && (articles.length !== expectedArticles || articles.some((article, index) => article.article !== String(index + 1)))) {
    throw new Error('Văn bản thiếu điều, trùng điều hoặc sai thứ tự. Hãy cung cấp đầy đủ các phần của bản gốc.');
  }

  const fingerprint = getSourceFingerprint(sourceFiles);
  const document = await LegalDocument.findOneAndUpdate(
    { law_number: lawNumber, source_fingerprint: fingerprint },
    {
      $set: {
        title: authority.title,
        issuing_body: authority.issuingBody,
        promulgated_at: authority.promulgatedAt,
        original_effective_from: authority.originalEffectiveFrom,
        effective_from: authority.effectiveFrom,
        effective_to: authority.effectiveTo ?? null,
        verified_through: authority.verifiedThrough,
        scope_locator: authority.scopeLocator,
        scope_text: articles.find((article) => article.article === '1')?.text ?? '',
        source_text: sourceText,
        source_status: authority.sourceStatus,
        temporal_note: authority.temporalNote,
        source_url: authority.sourceUrl,
        history_url: authority.historyUrl,
        version_label: `Bản gốc ${authority.lawNumber} — ${authority.promulgatedAt}`,
        consolidated_source_url: authority.consolidatedSourceUrl ?? null,
        amendments: authority.amendments.map((amendment) => ({
          law_number: amendment.lawNumber,
          title: amendment.title,
          promulgated_at: amendment.promulgatedAt,
          effective_from: amendment.effectiveFrom,
          source_url: amendment.sourceUrl,
          note: amendment.note,
        })),
        effective_rules: (authority.effectiveRules ?? []).map((rule) => ({
          articles: rule.articles,
          effective_from: rule.effectiveFrom,
          source_locator: rule.sourceLocator,
          note: rule.note,
        })),
        source_files: sourceFiles,
      },
      $setOnInsert: { law_number: lawNumber, source_fingerprint: fingerprint },
    },
    { returnDocument: 'after', upsert: true, runValidators: true },
  );

  const operations = articles.flatMap((article) => createProvisionUnits(article).map((unit) => {
    const locatorKey = getProvisionLocatorKey(unit);
    return {
      updateOne: {
        filter: { document_id: document._id, locator_key: locatorKey },
        update: {
          $set: {
            law_number: lawNumber,
            article: unit.article,
            paragraph: unit.paragraph,
            point: unit.point,
            locator: getProvisionLocator(unit),
            text: unit.text,
            effective_from: authority.effectiveRules?.find((rule) => rule.articles.includes(unit.article))?.effectiveFrom ?? authority.effectiveFrom,
            effective_to: authority.effectiveTo ?? null,
            search_tokens: getLegalSearchTerms(unit.text, 2_000),
            source_files: sourceFiles.map((file) => file.name),
            page_source_file: article.pageSourceFile,
            page_from: article.pageFrom,
            page_to: article.pageTo,
            citation_eligible: isCitationEligibleOnDate({
              source_status: authority.sourceStatus,
              effective_from: authority.effectiveFrom,
            }, authority.effectiveFrom),
          },
          $setOnInsert: { document_id: document._id, locator_key: locatorKey },
        },
        upsert: true,
      },
    };
  }));

  if (operations.length) await LegalProvision.bulkWrite(operations, { ordered: true });
  // Giữ bản ghi cũ để đối chiếu, nhưng không cho viện dẫn locator parser mới không còn xác định chắc chắn.
  await LegalProvision.updateMany({
    document_id: document._id,
    locator_key: { $nin: operations.map((operation) => operation.updateOne.filter.locator_key) },
  }, { $set: { citation_eligible: false } });
  return {
    lawNumber,
    sourceFingerprint: fingerprint,
    articleCount: articles.length,
    provisionCount: operations.length,
    sourceStatus: authority.sourceStatus,
    effectiveFrom: authority.effectiveFrom,
    sourceFiles: sourceFiles.map((file) => file.name),
  };
}
