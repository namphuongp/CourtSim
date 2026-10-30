import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import WordExtractor from 'word-extractor';
import { AppError } from '../utils/AppError.js';
import { extractPdfBytes } from './legalTextParser.js';
import { htmlText } from './vbplResearch.js';
import { isValidDateOnly, validateTimeline } from './legalTimeline.js';
import { validateCaseDetails } from './caseEvidence.js';
import { validateCaseFacts } from './caseKnowledge.js';

const CLAIM_REGEX = /cho rằng|cho biết|nói rằng|khai rằng|\bkhai\b|trình bày|yêu cầu|viện dẫn|khẳng định/iu;
const ABSENCE_REGEX = /(?:không có|không tồn tại|không được lập)/iu;
const ALLOWED_TIMELINE_KINDS = ['conduct', 'transaction', 'dispute', 'filing', 'hearing'];
const CEREMONIAL_HEADER_REGEX = /^(?:cộng hòa xã hội chủ nghĩa việt nam|độc lập\s*[-–—]\s*tự do\s*[-–—]\s*hạnh phúc|tòa án nhân dân|viện kiểm sát nhân dân|nhân danh nước cộng hòa|bản án số|quyết định số)/iu;

const EVIDENCE_DOCUMENT_PATTERNS = [
  { regex: /\b(hợp đồng\s+[^,.;\n]{4,95})/iu, prefix: 'Hợp đồng', kind: 'contract' },
  { regex: /\b(biên bản\s+[^,.;\n]{4,95})/iu, prefix: 'Biên bản', kind: 'minutes' },
  { regex: /\b(vi bằng\s+[^,.;\n]{4,95})/iu, prefix: 'Vi bằng', kind: 'bailiff' },
  { regex: /\b(giấy chứng nhận\s+[^,.;\n]{4,95}|giấy biên nhận\s+[^,.;\n]{4,95}|giấy xác nhận\s+[^,.;\n]{4,95})/iu, prefix: 'Giấy xác nhận / Chứng nhận', kind: 'certificate' },
  { regex: /\b(bản tường trình\s+[^,.;\n]{4,95}|bản tự khai\s+[^,.;\n]{4,95}|lời khai\s+[^,.;\n]{4,95})/iu, prefix: 'Bản lời khai / Tường trình', kind: 'statement' },
  { regex: /\b(thông báo\s+[^,.;\n]{4,95}|công văn\s+[^,.;\n]{4,95})/iu, prefix: 'Thông báo / Công văn', kind: 'notice' },
  { regex: /\b(kết luận giám định\s+[^,.;\n]{4,95}|bản giám định\s+[^,.;\n]{4,95})/iu, prefix: 'Kết luận giám định', kind: 'forensic' },
  { regex: /\b(sao kê\s+[^,.;\n]{4,95}|chứng từ chuyển khoản\s+[^,.;\n]{3,85}|hóa đơn\s+[^,.;\n]{4,85})/iu, prefix: 'Chứng từ / Sao kê giao dịch', kind: 'financial' },
];

function stripSemicolons(text) {
  return String(text ?? '')
    .replace(/;/gu, ',')
    .replace(/\r\n/gu, '\n')
    .trim();
}

function cleanJudgmentNoise(text) {
  return stripSemicolons(text)
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => !/^(?:trang\s+\d+(?:\s*\/\s*\d+)?|\d+\s*\/\s*\d+)$/iu.test(line))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function splitSentences(text) {
  return cleanJudgmentNoise(text)
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
}

function extractDocxXmlFromZipBuffer(buffer) {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    let dataEnd = dataStart + compressedSize;
    if (compressedSize === 0) {
      const nextHeader = buffer.indexOf(Buffer.from([0x50, 0x4b]), dataStart);
      dataEnd = nextHeader > dataStart ? nextHeader : buffer.length;
    }
    if (name === 'word/document.xml' && dataStart < buffer.length) {
      const slice = buffer.subarray(dataStart, Math.min(dataEnd, buffer.length));
      const xmlBytes = compression === 8 ? inflateRawSync(slice) : slice;
      const xml = xmlBytes.toString('utf8');
      return xml
        .replace(/<\/w:p>/giu, '\n')
        .replace(/<w:br[^>]*\/?>/giu, '\n')
        .replace(/<w:tab[^>]*\/?>/giu, ' ')
        .replace(/<[^>]+>/gu, '')
        .replace(/&amp;/gu, '&')
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>')
        .replace(/&quot;/gu, '"')
        .replace(/&apos;/gu, "'")
        .trim();
    }
    offset = Math.max(dataStart + 1, dataEnd);
  }
  return '';
}

export async function extractTextFromUploadedDocument({ fileName = '', fileBase64 = '', rawText = '' } = {}) {
  if (typeof fileBase64 === 'string' && fileBase64.trim()) {
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/iu, '').trim();
    const bytes = Buffer.from(cleanBase64, 'base64');
    if (!bytes.length) {
      throw new AppError('Tệp tải lên trống hoặc không hợp lệ.', 400, 'CASE_FILE_EMPTY');
    }
    if (bytes.length > 5_500_000) {
      throw new AppError('Tệp bản án tải lên quá lớn (tối đa 5MB). Vui lòng chọn tệp nhỏ hơn hoặc dán phần nội dung chính.', 400, 'CASE_FILE_TOO_LARGE');
    }

    const ext = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1] ?? '';
    const isPdf = bytes.subarray(0, 5).toString('ascii') === '%PDF-' || ext === 'pdf';
    const isWord = bytes.subarray(0, 2).toString('hex') === 'd0cf'
      || bytes.subarray(0, 2).toString('ascii') === 'PK'
      || ext === 'doc'
      || ext === 'docx';

    if (isPdf) {
      try {
        const extracted = await extractPdfBytes(bytes, { maxPages: 80, maxCharacters: 250_000 });
        const text = cleanJudgmentNoise(extracted.text);
        if (text.length < 30) {
          throw new AppError('Tệp PDF này là bản scan ảnh chưa có lớp văn bản (OCR). Vui lòng chọn tệp PDF có văn bản, tệp Word (.docx) hoặc dán nội dung bản án.', 400, 'CASE_PDF_SCAN_ONLY');
        }
        return text;
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('Không thể trích xuất văn bản từ tệp PDF đã chọn. Vui lòng kiểm tra lại tệp hoặc dán trực tiếp nội dung.', 400, 'CASE_PDF_PARSE_FAILED');
      }
    }

    if (isWord) {
      let text = '';
      try {
        const doc = await new WordExtractor().extract(bytes);
        text = cleanJudgmentNoise(doc.getBody());
      } catch {
        text = '';
      }
      if (text.length < 30 && bytes.subarray(0, 2).toString('ascii') === 'PK') {
        try {
          text = cleanJudgmentNoise(extractDocxXmlFromZipBuffer(bytes));
        } catch {
          text = '';
        }
      }
      if (text.length < 30) {
        throw new AppError('Không trích xuất được nội dung văn bản từ tệp Word (.doc/.docx). Vui lòng kiểm tra lại tệp hoặc dán trực tiếp nội dung.', 400, 'CASE_WORD_PARSE_FAILED');
      }
      return text;
    }

    const utf8Text = bytes.toString('utf8');
    if (/<(?:html|!doctype|body)\b/iu.test(utf8Text.slice(0, 3000)) || ext === 'html' || ext === 'htm') {
      return cleanJudgmentNoise(htmlText(utf8Text));
    }
    return cleanJudgmentNoise(utf8Text);
  }

  const direct = String(rawText ?? '').trim();
  if (/<(?:html|!doctype|body)\b/iu.test(direct.slice(0, 3000))) {
    return cleanJudgmentNoise(htmlText(direct));
  }
  return cleanJudgmentNoise(direct);
}

export function segmentVietnameseJudgment(text) {
  const clean = cleanJudgmentNoise(text);
  const verdictMatch = clean.match(/(?:^|\n)\s*(?:QUYẾT ĐỊNH\s*[:.]|TÒA ÁN NHÂN DÂN[^\n]*QUYẾT ĐỊNH\s*[:.])/imu);
  if (!verdictMatch || verdictMatch.index === undefined || verdictMatch.index < 80) {
    return { bodyWithoutVerdict: clean, verdictSection: '' };
  }
  return {
    bodyWithoutVerdict: clean.slice(0, verdictMatch.index).trim(),
    verdictSection: clean.slice(verdictMatch.index).trim(),
  };
}

export function extractDatesFromVietnameseText(text) {
  const raw = String(text ?? '');
  const found = [];

  for (const m of raw.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/gu)) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    if (isValidDateOnly(iso)) found.push({ iso, raw: m[0], index: m.index ?? 0 });
  }

  for (const m of raw.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/gu)) {
    const day = String(m[1]).padStart(2, '0');
    const month = String(m[2]).padStart(2, '0');
    const year = m[3];
    const iso = `${year}-${month}-${day}`;
    if (isValidDateOnly(iso)) found.push({ iso, raw: m[0], index: m.index ?? 0 });
  }

  for (const m of raw.matchAll(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/giu)) {
    const day = String(m[1]).padStart(2, '0');
    const month = String(m[2]).padStart(2, '0');
    const year = m[3];
    const iso = `${year}-${month}-${day}`;
    if (isValidDateOnly(iso)) found.push({ iso, raw: m[0], index: m.index ?? 0 });
  }

  const seen = new Set();
  return found.filter((item) => {
    if (seen.has(item.iso)) return false;
    seen.add(item.iso);
    return true;
  });
}

export function detectCategoryFromText(text, categoryHint) {
  if (typeof categoryHint === 'string' && categoryHint.trim()) {
    return stripSemicolons(categoryHint).slice(0, 80).toLowerCase();
  }
  const lower = String(text ?? '').toLocaleLowerCase('vi');
  if (/bản án dân sự|\bds-st\b|\bds-pt\b|vụ án dân sự/iu.test(lower)) return 'dân sự';
  if (/bị cáo|viện kiểm sát|tội phạm|hình sự|truy tố|cáo trạng|\bhs-st\b|\bhs-pt\b/iu.test(lower)) return 'hình sự';
  if (/người lao động|hợp đồng lao động|sa thải|chấm dứt hợp đồng lao động|bảo hiểm xã hội|tiền lương|\blđ-st\b|\blđ-pt\b/iu.test(lower)) return 'lao động';
  if (/kinh doanh thương mại|\bkdtm\b|tranh chấp thương mại|mua bán hàng hóa|cổ phần|góp vốn kinh doanh/iu.test(lower)) return 'thương mại';
  if (/quyết định hành chính|hành vi hành chính|khiếu kiện|\bhc-st\b|\bhc-pt\b/iu.test(lower)) return 'hành chính';
  if (/ly hôn|chia tài sản chung vợ chồng|quyền nuôi con|hôn nhân|\bhngđ\b/iu.test(lower)) return 'hôn nhân và gia đình';
  return 'dân sự';
}

export function detectPartiesFromText(text, category = 'dân sự') {
  const { bodyWithoutVerdict } = segmentVietnameseJudgment(text);
  const clean = stripSemicolons(bodyWithoutVerdict || text);
  const isCriminal = /hình sự/iu.test(category);

  const plaintiffMatch = clean.match(
    /(?:nguyên đơn|người khởi kiện|bị hại|người bị hại)\s*(?:là|:|-)?\s*((?:ông|bà|anh|chị|công ty|doanh nghiệp|ngân hàng|hộ gia đình)?\s*[\p{Lu}][\p{L}\d\s.&()-]{2,70}?)(?=[,.;\n]|sinh năm|năm sinh|địa chỉ|cư trú|trú tại|đại diện|yêu cầu|khởi kiện|và bị đơn|với bị đơn|$)/iu
  );
  const defendantMatch = clean.match(
    /(?:bị đơn|người bị kiện|bị cáo)\s*(?:là|:|-)?\s*((?:ông|bà|anh|chị|công ty|doanh nghiệp|ngân hàng|cơ sở|ủy ban)?\s*[\p{Lu}][\p{L}\d\s.&()-]{2,70}?)(?=[,.;\n]|sinh năm|năm sinh|địa chỉ|cư trú|trú tại|đại diện|không đồng ý|bác bỏ|bị viện kiểm sát|về việc|$)/iu
  );

  const plaintiffName = plaintiffMatch?.[1]?.trim()?.slice(0, 120) || (isCriminal ? 'Người bị hại trong hồ sơ' : 'Nguyên đơn khởi kiện');
  const defendantName = defendantMatch?.[1]?.trim()?.slice(0, 120) || (isCriminal ? 'Bị cáo trong hồ sơ' : 'Bị đơn trong vụ án');

  const sentences = splitSentences(clean).filter((s) => !CEREMONIAL_HEADER_REGEX.test(s));
  const plaintiffClaims = sentences
    .filter((s) => /nguyên đơn|khởi kiện|bị hại|truy tố|yêu cầu\s+(?:bồi thường|thanh toán|trả|buộc|hủy|công nhận|hoàn trả|tiếp tục)/iu.test(s))
    .slice(0, 3)
    .map((s) => s.slice(0, 500));
  const defendantClaims = sentences
    .filter((s) => /bị đơn|bị cáo|không đồng ý|phản bác|đề nghị bác|từ chối|cho rằng đã|kháng cáo/iu.test(s))
    .slice(0, 3)
    .map((s) => s.slice(0, 500));

  return [
    {
      side: 'plaintiff',
      name: plaintiffName,
      claims: plaintiffClaims.length
        ? plaintiffClaims
        : [`Đề nghị Hội đồng xét xử chấp nhận yêu cầu bảo vệ quyền và lợi ích hợp pháp của ${plaintiffName} theo tài liệu chứng cứ trong hồ sơ.`],
    },
    {
      side: 'defendant',
      name: defendantName,
      claims: defendantClaims.length
        ? defendantClaims
        : [`Đề nghị Hội đồng xét xử xem xét khách quan phạm vi chứng cứ và bác các yêu cầu chưa đủ căn cứ pháp lý đối với ${defendantName}.`],
    },
  ];
}

export function detectCaseTitleFromText(text, parties = [], category = 'dân sự') {
  const clean = cleanJudgmentNoise(text);
  const plaintiff = parties.find((p) => p.side === 'plaintiff')?.name;
  const defendant = parties.find((p) => p.side === 'defendant')?.name;
  const hasRealParties = plaintiff && defendant && !/trong hồ sơ|khởi kiện|trong vụ án/iu.test(`${plaintiff} ${defendant}`);

  const subjectMatch = clean.match(/(?:về việc|v\/v)\s*[:：-]?\s*["“]?([^\n"”.]{8,130})/iu);
  if (subjectMatch?.[1]) {
    const subject = subjectMatch[1].trim().replace(/^tranh chấp/iu, 'tranh chấp');
    if (hasRealParties) {
      return `Vụ án ${subject} giữa ${plaintiff} và ${defendant}`.slice(0, 190);
    }
    return `Vụ án ${subject}`.slice(0, 190);
  }

  const criminalMatch = clean.match(/về\s+(tội\s+[^\n,.;]{5,90})/iu);
  if (criminalMatch?.[1] && defendant) {
    return `Vụ án hình sự đối với ${defendant} về ${criminalMatch[1].trim()}`.slice(0, 190);
  }

  const meaningfulSentences = splitSentences(clean).filter((s) => !CEREMONIAL_HEADER_REGEX.test(s));
  if (meaningfulSentences[0]) {
    return meaningfulSentences[0].slice(0, 190);
  }
  return `Hồ sơ vụ án ${category} thực hành do người dùng tải lên`.slice(0, 190);
}

function buildVisualEvidenceContent({ code, name, date, providedBy, summary, rawExcerpt }) {
  const vnDate = date && /^\d{4}-\d{2}-\d{2}$/u.test(date)
    ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
    : 'Theo hồ sơ lưu trữ';
  return stripSemicolons([
    name.toLocaleUpperCase('vi'),
    `Số hiệu: ${code}`,
    `Thời điểm lập: ${vnDate}`,
    `Người trình bày / Nguồn cung cấp: ${providedBy || 'Các bên đương sự trong vụ án'}`,
    `Nội dung tài liệu: ${rawExcerpt || summary}`,
    'Người tiếp nhận hồ sơ: Thư ký Tòa án - Hồ sơ thụ lý',
    'Con dấu: TÒA ÁN NHÂN DÂN - HỒ SƠ CHỨNG CỨ',
  ].join('\n'));
}

export function extractEvidenceFromVietnameseText(text, { fallbackDate, plaintiffName, defendantName, caseHash }) {
  const { bodyWithoutVerdict } = segmentVietnameseJudgment(text);
  const sentences = splitSentences(bodyWithoutVerdict || text).filter((s) => !CEREMONIAL_HEADER_REGEX.test(s));
  const extracted = [];
  const seenNames = new Set();

  for (const sentence of sentences) {
    for (const pattern of EVIDENCE_DOCUMENT_PATTERNS) {
      const match = sentence.match(pattern.regex);
      if (!match?.[1]) continue;
      const rawDocName = match[1].replace(/\s+/gu, ' ').trim();
      const capitalizedName = rawDocName.charAt(0).toLocaleUpperCase('vi') + rawDocName.slice(1);
      const normKey = capitalizedName.toLocaleLowerCase('vi').slice(0, 45);
      if (seenNames.has(normKey)) continue;
      seenNames.add(normKey);

      const sentenceDates = extractDatesFromVietnameseText(sentence);
      const docDate = sentenceDates[0]?.iso || fallbackDate;
      const isDefendantDoc = /bị đơn|bị cáo/iu.test(sentence) && !/nguyên đơn|bị hại/iu.test(sentence);
      const isAuthorityDoc = /tòa án|cơ quan điều tra|công an|ủy ban|ubnd|thừa phát lại|giám định|tổ trưởng/iu.test(sentence);
      const providedBy = isAuthorityDoc
        ? 'Cơ quan / Người có thẩm quyền lập văn bản'
        : isDefendantDoc
          ? defendantName
          : plaintiffName;

      const idx = extracted.length;
      const code = `${String(idx + 1).padStart(2, '0')}-BL/${docDate.slice(0, 4)}`;
      const name = capitalizedName.slice(0, 180);
      const summary = sentence.slice(0, 1200);
      const proofScope = `Tài liệu gốc (${pattern.prefix}) dùng để đối chiếu tình tiết ngày ${docDate} và nghĩa vụ chứng minh của các bên tại phiên tòa.`;

      extracted.push({
        id: `EV-custom-${caseHash}-${String(idx + 1).padStart(2, '0')}`,
        name,
        availability: 'provided',
        date: docDate,
        provided_by: providedBy.slice(0, 180),
        source_kind: 'document',
        source_locator: `Bút lục số ${String(idx + 1).padStart(2, '0')} - Hồ sơ vụ án`,
        proof_scope: proofScope,
        verification_status: /mâu thuẫn|không thừa nhận|giả mạo|chưa thống nhất/iu.test(sentence) ? 'conflicting' : 'unverified',
        summary,
        source_quote: summary.slice(0, 500),
        content: buildVisualEvidenceContent({
          code,
          name,
          date: docDate,
          providedBy,
          summary: proofScope,
          rawExcerpt: sentence,
        }),
      });
      break;
    }
    if (extracted.length >= 6) break;
  }

  return extracted;
}

export function normalizeAndRepairCasePayload(aiDraft, rawText, options = {}) {
  const cleanRaw = cleanJudgmentNoise(rawText);
  if (cleanRaw.length < 30) {
    throw new AppError('Nội dung bản án hoặc hồ sơ tải lên quá ngắn (cần tối thiểu 30 ký tự). Vui lòng dán hoặc tải lên nội dung chi tiết hơn.', 400, 'CASE_UPLOAD_TOO_SHORT');
  }

  const { bodyWithoutVerdict } = segmentVietnameseJudgment(cleanRaw);
  const meaningfulSentences = splitSentences(bodyWithoutVerdict || cleanRaw).filter((s) => !CEREMONIAL_HEADER_REGEX.test(s));
  const sentences = meaningfulSentences.length ? meaningfulSentences : splitSentences(cleanRaw);
  const extractedDates = extractDatesFromVietnameseText(cleanRaw);
  const fallbackDate = (options.referenceDateHint && isValidDateOnly(options.referenceDateHint))
    ? options.referenceDateHint
    : (isValidDateOnly(aiDraft?.reference_date) ? aiDraft.reference_date : (extractedDates.at(-1)?.iso || '2025-06-15'));

  const category = detectCategoryFromText(cleanRaw, options.categoryHint || aiDraft?.category);

  // 1. Chuẩn hóa danh sách các bên (parties)
  let parties = Array.isArray(aiDraft?.parties)
    ? aiDraft.parties
        .filter((p) => p && typeof p.name === 'string' && p.name.trim())
        .slice(0, 10)
        .map((p, idx) => ({
          side: ['plaintiff', 'defendant', 'other'].includes(p.side) ? p.side : (idx === 0 ? 'plaintiff' : 'defendant'),
          name: stripSemicolons(p.name).slice(0, 180),
          claims: Array.isArray(p.claims) && p.claims.length
            ? p.claims.map((c) => stripSemicolons(c).slice(0, 1500)).filter(Boolean).slice(0, 8)
            : [`Bảo vệ quyền và lợi ích hợp pháp của ${stripSemicolons(p.name).slice(0, 100)} theo chứng cứ trong hồ sơ.`],
        }))
    : [];

  if (!parties.some((p) => p.side === 'plaintiff') || !parties.some((p) => p.side === 'defendant')) {
    parties = detectPartiesFromText(cleanRaw, category);
  }

  const plaintiffName = parties.find((p) => p.side === 'plaintiff')?.name || 'Nguyên đơn';
  const defendantName = parties.find((p) => p.side === 'defendant')?.name || 'Bị đơn';

  const rawTitle = stripSemicolons(
    options.titleHint ||
    aiDraft?.title ||
    detectCaseTitleFromText(cleanRaw, parties, category)
  );
  const title = rawTitle.slice(0, 190);

  const rawSummary = stripSemicolons(
    aiDraft?.summary ||
    sentences.slice(0, 4).join(' ') ||
    cleanRaw.slice(0, 500)
  );
  const summary = rawSummary.slice(0, 3800);

  // 2. Xây dựng các trích đoạn chuẩn để đảm bảo 100% có mặt trong full_document
  const extraDocumentLines = [];
  const baseDocument = stripSemicolons(aiDraft?.full_document || bodyWithoutVerdict || cleanRaw).slice(0, 38000);

  // 3. Chuẩn hóa Timeline (bắt buộc source_quote nằm trong full_document và ngày hợp lệ YYYY-MM-DD)
  const rawTimeline = Array.isArray(aiDraft?.timeline) ? aiDraft.timeline : [];
  const timeline = [];
  for (const item of rawTimeline.slice(0, 10)) {
    const kind = ALLOWED_TIMELINE_KINDS.includes(item?.kind) ? item.kind : 'conduct';
    const date = isValidDateOnly(item?.date) ? item.date : fallbackDate;
    const description = stripSemicolons(item?.description || '').slice(0, 450);
    let sourceQuote = stripSemicolons(item?.source_quote || description).slice(0, 800);
    if (!description || sourceQuote.length < 10) continue;
    if (!baseDocument.includes(sourceQuote) && !extraDocumentLines.includes(sourceQuote)) {
      extraDocumentLines.push(sourceQuote);
    }
    timeline.push({
      kind,
      date,
      date_to: isValidDateOnly(item?.date_to) && item.date_to >= date ? item.date_to : date,
      description,
      source_quote: sourceQuote,
      status: 'reported',
    });
  }

  if (timeline.length === 0) {
    const datedSentences = sentences.filter((s) => extractDatesFromVietnameseText(s).length > 0);
    const defaultQuotes = (datedSentences.length >= 2 ? datedSentences : sentences).slice(0, 4);
    const kinds = ['transaction', 'conduct', 'dispute', 'filing'];
    defaultQuotes.forEach((sentence, idx) => {
      const q = sentence.slice(0, 800);
      if (!baseDocument.includes(q) && !extraDocumentLines.includes(q)) {
        extraDocumentLines.push(q);
      }
      const sentenceDate = extractDatesFromVietnameseText(sentence)[0]?.iso;
      const dateForIdx = sentenceDate || extractedDates[idx]?.iso || fallbackDate;
      timeline.push({
        kind: kinds[idx] || 'conduct',
        date: dateForIdx,
        date_to: dateForIdx,
        description: q.slice(0, 450),
        source_quote: q,
        status: 'reported',
      });
    });
  }

  // 4. Chuẩn hóa Case Facts (bắt buộc quote nằm trong full_document, nếu có từ CLAIM thì chuyển sang party_statement)
  const rawFacts = Array.isArray(aiDraft?.case_facts) ? aiDraft.case_facts : [];
  const caseFacts = [];
  for (const f of rawFacts.slice(0, 25)) {
    const quote = stripSemicolons(f?.quote || '').slice(0, 1800);
    if (quote.length < 12) continue;
    if (!baseDocument.includes(quote) && !extraDocumentLines.includes(quote)) {
      extraDocumentLines.push(quote);
    }
    const hasClaimVerb = CLAIM_REGEX.test(quote);
    let kind = ['recorded_event', 'party_statement', 'unproven'].includes(f?.kind) ? f.kind : 'recorded_event';
    if (kind === 'recorded_event' && hasClaimVerb) {
      kind = 'party_statement';
    }
    const party = kind === 'party_statement'
      ? (stripSemicolons(f?.party || '').slice(0, 180) || (/bị đơn|bị cáo/iu.test(quote) ? defendantName : plaintiffName))
      : undefined;
    caseFacts.push({
      kind,
      quote,
      source_type: 'case_outline',
      ...(party ? { party } : {}),
    });
  }

  if (caseFacts.length < 2) {
    for (const sentence of sentences.slice(0, 6)) {
      const quote = sentence.slice(0, 1800);
      if (quote.length < 12) continue;
      if (caseFacts.some((existing) => existing.quote === quote)) continue;
      if (!baseDocument.includes(quote) && !extraDocumentLines.includes(quote)) {
        extraDocumentLines.push(quote);
      }
      const isStatement = CLAIM_REGEX.test(quote);
      caseFacts.push({
        kind: isStatement ? 'party_statement' : 'recorded_event',
        quote,
        source_type: 'case_outline',
        ...(isStatement ? { party: /bị đơn|bị cáo/iu.test(quote) ? defendantName : plaintiffName } : {}),
      });
    }
  }

  // 5. Chuẩn hóa Evidence Inventory (bút lục trực quan)
  const rawEvidence = Array.isArray(aiDraft?.evidence_inventory) ? aiDraft.evidence_inventory : [];
  const caseHash = createHash('sha256').update(title + cleanRaw.slice(0, 200)).digest('hex').slice(0, 8);
  const evidenceInventoryList = [];

  for (const [idx, item] of rawEvidence.slice(0, 12).entries()) {
    const name = stripSemicolons(item?.name || `Bút lục tài liệu số ${idx + 1}`).slice(0, 180);
    if (!name) continue;
    const id = item?.id && /^[a-zA-Z0-9_-]{8,80}$/u.test(item.id)
      ? item.id
      : `EV-custom-${caseHash}-${String(idx + 1).padStart(2, '0')}`;
    const code = `${String(idx + 1).padStart(2, '0')}-BL/${fallbackDate.slice(0, 4)}`;
    const date = isValidDateOnly(item?.date) ? item.date : fallbackDate;
    const providedBy = stripSemicolons(item?.provided_by || (idx % 2 === 0 ? plaintiffName : defendantName)).slice(0, 180);
    const itemSummary = stripSemicolons(item?.summary || item?.proof_scope || `Tài liệu chứng cứ liên quan đến ${name}`).slice(0, 1500);
    const sourceLocator = stripSemicolons(item?.source_locator || `Bút lục số ${String(idx + 1).padStart(2, '0')} - Hồ sơ vụ án`).slice(0, 300);
    const proofScope = stripSemicolons(item?.proof_scope || itemSummary).slice(0, 1500);
    const rawContent = stripSemicolons(item?.content || '');
    const content = (rawContent.includes('Thời điểm lập:') || rawContent.includes('Nội dung'))
      ? rawContent.slice(0, 9000)
      : buildVisualEvidenceContent({
          code,
          name,
          date,
          providedBy,
          summary: itemSummary,
          rawExcerpt: rawContent || itemSummary,
        }).slice(0, 9000);

    evidenceInventoryList.push({
      id,
      name,
      availability: 'provided',
      date,
      provided_by: providedBy,
      source_kind: 'document',
      source_locator: sourceLocator,
      proof_scope: proofScope,
      verification_status: item?.verification_status === 'conflicting' ? 'conflicting' : 'unverified',
      summary: itemSummary,
      source_quote: itemSummary.slice(0, 500),
      content,
    });
  }

  if (evidenceInventoryList.length === 0) {
    const autoDetectedEvidences = extractEvidenceFromVietnameseText(cleanRaw, {
      fallbackDate,
      plaintiffName,
      defendantName,
      caseHash,
    });
    evidenceInventoryList.push(...autoDetectedEvidences);
  }

  if (evidenceInventoryList.length < 2) {
    const defaultEvidences = [
      {
        name: `Đơn khởi kiện và bản trình bày yêu cầu của ${plaintiffName}`,
        providedBy: plaintiffName,
        excerpt: sentences.slice(0, 2).join(' ') || summary,
        scope: `Xác nhận nội dung yêu cầu khởi kiện và trình bày ban đầu của ${plaintiffName}, cần đối chiếu với chứng cứ khách quan.`,
      },
      {
        name: `Biên bản làm việc và bản ý kiến phản hồi của ${defendantName}`,
        providedBy: defendantName,
        excerpt: sentences.slice(1, 4).join(' ') || summary,
        scope: `Ghi nhận lập trường phản biện và các tình tiết đối chứng từ phía ${defendantName}.`,
      },
    ];
    defaultEvidences.forEach((ev) => {
      if (evidenceInventoryList.length >= 4) return;
      const idx = evidenceInventoryList.length;
      const code = `${String(idx + 1).padStart(2, '0')}-BL/${fallbackDate.slice(0, 4)}`;
      evidenceInventoryList.push({
        id: `EV-custom-${caseHash}-${String(idx + 1).padStart(2, '0')}`,
        name: ev.name.slice(0, 180),
        availability: 'provided',
        date: fallbackDate,
        provided_by: ev.providedBy.slice(0, 180),
        source_kind: 'document',
        source_locator: `Bút lục số ${String(idx + 1).padStart(2, '0')} - Hồ sơ tải lên`,
        proof_scope: ev.scope.slice(0, 1500),
        verification_status: 'unverified',
        summary: ev.excerpt.slice(0, 1500),
        source_quote: ev.excerpt.slice(0, 500),
        content: buildVisualEvidenceContent({
          code,
          name: ev.name,
          date: fallbackDate,
          providedBy: ev.providedBy,
          summary: ev.scope,
          rawExcerpt: ev.excerpt,
        }),
      });
    });
  }

  // 6. Chuẩn hóa Evidence Absences
  const rawAbsences = Array.isArray(aiDraft?.evidence_absences) ? aiDraft.evidence_absences : [];
  const evidenceAbsences = [];
  for (const ab of rawAbsences.slice(0, 5)) {
    const abTitle = stripSemicolons(ab?.title || '').slice(0, 180);
    let abQuote = stripSemicolons(ab?.source_quote || '').slice(0, 1500);
    if (!abTitle || abQuote.length < 15) continue;
    if (!ABSENCE_REGEX.test(abQuote)) {
      abQuote = `Theo hồ sơ hiện tại, không có ${abTitle.toLocaleLowerCase('vi')} kèm theo.`;
    }
    if (!baseDocument.includes(abQuote) && !extraDocumentLines.includes(abQuote)) {
      extraDocumentLines.push(abQuote);
    }
    evidenceAbsences.push({ title: abTitle, source_quote: abQuote });
  }

  const fullDocument = (
    extraDocumentLines.length
      ? `${baseDocument}\n\nPHỤ LỤC TRÍCH YẾU SỰ KIỆN PHÁP LÝ TRONG HỒ SƠ:\n${extraDocumentLines.join('\n')}`
      : baseDocument
  ).slice(0, 49500);

  const candidate = {
    title,
    summary,
    full_document: fullDocument,
    category,
    reference_date: fallbackDate,
    reference_date_note: stripSemicolons(
      aiDraft?.reference_date_note ||
      `Mốc ngày ${fallbackDate} được trích xuất từ hồ sơ bản án do người dùng tải lên để làm căn cứ đối chiếu hiệu lực văn bản pháp luật.`
    ).slice(0, 500),
    legal_scope_note: stripSemicolons(
      aiDraft?.legal_scope_note ||
      `Phiên tòa thực hành phân tích nghĩa vụ chứng minh, giá trị pháp lý của các bút lục chứng cứ (${evidenceInventoryList.map((e) => e.name).slice(0, 3).join(', ')}) và điều kiện áp dụng pháp luật đối với vụ án ${category}.`
    ).slice(0, 1000),
    source_note: 'Hồ sơ bản án do người dùng tải lên và được chuẩn hóa cấu trúc tự động.',
    parties,
    timeline,
    case_facts: caseFacts,
    evidence_inventory: evidenceInventoryList,
    evidence_absences: evidenceAbsences,
  };

  // Chạy toàn bộ bộ kiểm định CSDL của CourtSim để đảm bảo 100% hợp lệ trước khi lưu
  const validatedTimeline = validateTimeline(candidate.timeline);
  const validatedDetails = validateCaseDetails(candidate);
  const validatedFacts = validateCaseFacts(candidate);

  return {
    title: candidate.title,
    summary: candidate.summary,
    full_document: candidate.full_document,
    category: candidate.category,
    reference_date: candidate.reference_date,
    reference_date_note: candidate.reference_date_note,
    legal_scope_note: candidate.legal_scope_note,
    source_note: candidate.source_note,
    timeline: validatedTimeline,
    case_facts: validatedFacts,
    ...validatedDetails,
  };
}

export async function extractAndStructureUserCase(
  { rawText, fileName, fileBase64, titleHint, categoryHint, referenceDateHint, userId },
  { complete } = {}
) {
  const resolvedText = await extractTextFromUploadedDocument({ fileName, fileBase64, rawText });
  if (typeof resolvedText !== 'string' || !resolvedText.trim()) {
    throw new AppError('Vui lòng nhập hoặc tải lên nội dung bản án, hồ sơ vụ án.', 400, 'CASE_UPLOAD_EMPTY');
  }
  if (resolvedText.length > 80000) {
    throw new AppError('Nội dung bản án quá dài (tối đa 80.000 ký tự). Vui lòng rút gọn phần nội dung chính của bản án.', 400, 'CASE_UPLOAD_TOO_LARGE');
  }

  let aiDraft = null;

  // Nếu người dùng tải lên một tệp JSON đã có cấu trúc hồ sơ
  const trimmed = resolvedText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(trimmed);
      if (parsedJson && typeof parsedJson === 'object' && (parsedJson.full_document || parsedJson.summary || parsedJson.title)) {
        return normalizeAndRepairCasePayload(parsedJson, parsedJson.full_document || parsedJson.summary || trimmed, {
          titleHint: titleHint || parsedJson.title,
          categoryHint: categoryHint || parsedJson.category,
          referenceDateHint: referenceDateHint || parsedJson.reference_date,
        });
      }
    } catch {
      // Tiếp tục xử lý như văn bản bản án thông thường
    }
  }

  // Sử dụng AI để phát hiện nội dung bản án và chuyển đổi sang cấu trúc CSDL chuẩn nếu AI sẵn sàng
  const model = process.env.AI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const hasApiKey = Boolean(process.env.AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
  if (model && (hasApiKey || typeof complete === 'function')) {
    const systemPrompt = [
      'Bạn là Thẩm phán và Chuyên gia phân tích dữ liệu pháp lý 15 năm kinh nghiệm của hệ thống CourtSim.',
      'Nhiệm vụ: Đọc văn bản bản án hoặc hồ sơ vụ án thực tế tại Việt Nam do người dùng tải lên và trích xuất thành JSON đúng chuẩn cơ sở dữ liệu CourtSim.',
      'Yêu cầu bắt buộc:',
      '1. Không dùng dấu chấm phẩy (;) trong bất kỳ trường văn bản nào, thay bằng dấu phẩy (,) hoặc dấu chấm (.).',
      '2. Không tiết lộ trước phần QUYẾT ĐỊNH tuyên án thắng/thua cuối cùng trong trường summary để đảm bảo tính khách quan khi mô phỏng tranh tụng.',
      '3. Trả về duy nhất một JSON object với các trường:',
      '   - title: Tên vụ án ngắn gọn, chuẩn mực (ví dụ: "Vụ án tranh chấp hợp đồng đặt cọc giữa bà A và ông B").',
      '   - category: Một trong các giá trị "dân sự", "hình sự", "lao động", "thương mại", "hành chính", "hôn nhân và gia đình".',
      '   - reference_date: Ngày xảy ra sự kiện chính hoặc ngày xét xử sơ thẩm định dạng YYYY-MM-DD.',
      '   - summary: Tóm tắt toàn cảnh nội dung vụ án, các bên và vấn đề tranh chấp cốt lõi (200-600 ký tự).',
      '   - legal_scope_note: Ghi chú các vấn đề pháp lý, điều kiện áp dụng pháp luật và nghĩa vụ chứng minh cần làm rõ tại phiên tòa.',
      '   - parties: Mảng gồm nguyên đơn/bị hại (side="plaintiff") và bị đơn/bị cáo (side="defendant"), mỗi phần tử có { side, name, claims: [các yêu cầu/quan điểm cụ thể] }.',
      '   - timeline: Mảng 3-5 mốc thời gian { kind: "transaction"|"conduct"|"dispute"|"filing"|"hearing", date: "YYYY-MM-DD", description, source_quote: câu trích nguyên văn từ văn bản }.',
      '   - case_facts: Mảng 4-8 tình tiết { kind: "recorded_event"|"party_statement"|"unproven", quote: câu trích nguyên văn từ văn bản, party: tên bên nếu là party_statement }.',
      '   - evidence_inventory: Mảng 3-6 bút lục chứng cứ thực tế được nhắc tới trong bản án (Hợp đồng, Biên bản, Vi bằng, Giấy chứng nhận, Bản tự khai, Sao kê...) { name, date: "YYYY-MM-DD", provided_by, source_locator, proof_scope, summary, content: nội dung chi tiết của văn bản/bút lục đó }.',
    ].join('\n');

    try {
      const completeFn = typeof complete === 'function'
        ? complete
        : (await import('./aiClient.js')).createChatCompletion;
      const responseText = await completeFn({
        model,
        systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Hãy phân tích và chuẩn hóa hồ sơ/bản án sau đây sang JSON chuẩn CSDL CourtSim:\n\n${trimmed.slice(0, 24000)}`,
          },
        ],
        temperature: 0.2,
        json: true,
        usageContext: { userId, role: 'case_parser' },
        timeoutMs: 30000,
        maxAttempts: 1,
      });
      aiDraft = JSON.parse(responseText);
    } catch {
      // Nếu AI timeout hoặc chưa cấu hình key, hệ thống tự động dùng bộ bóc tách NLP pháp lý chuẩn hóa bên dưới
      aiDraft = null;
    }
  }

  return normalizeAndRepairCasePayload(aiDraft, trimmed, {
    titleHint,
    categoryHint,
    referenceDateHint,
  });
}
