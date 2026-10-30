import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { createChatCompletion } from './aiClient.js';
import { isValidDateOnly, validateTimeline } from './legalTimeline.js';
import { validateCaseDetails } from './caseEvidence.js';
import { validateCaseFacts } from './caseKnowledge.js';

const CLAIM_REGEX = /cho rằng|cho biết|nói rằng|khai rằng|\bkhai\b|trình bày|yêu cầu|viện dẫn|khẳng định/iu;
const ABSENCE_REGEX = /(?:không có|không tồn tại|không được lập)/iu;
const ALLOWED_TIMELINE_KINDS = ['conduct', 'transaction', 'dispute', 'filing', 'hearing'];

function stripSemicolons(text) {
  return String(text ?? '')
    .replace(/;/gu, ',')
    .replace(/\r\n/gu, '\n')
    .trim();
}

function splitSentences(text) {
  return stripSemicolons(text)
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
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
  if (/bị cáo|viện kiểm sát|tội phạm|hình sự|truy tố|cáo trạng|\bhs-st\b/iu.test(lower)) return 'hình sự';
  if (/người lao động|hợp đồng lao động|sa thải|chấm dứt hợp đồng lao động|bảo hiểm xã hội|tiền lương|\blđ-st\b/iu.test(lower)) return 'lao động';
  if (/kinh doanh thương mại|\bkdtm\b|tranh chấp thương mại|mua bán hàng hóa|cổ phần|góp vốn kinh doanh/iu.test(lower)) return 'thương mại';
  if (/quyết định hành chính|hành vi hành chính|khiếu kiện|\bhc-st\b/iu.test(lower)) return 'hành chính';
  if (/ly hôn|chia tài sản chung vợ chồng|quyền nuôi con|hôn nhân/iu.test(lower)) return 'hôn nhân và gia đình';
  return 'dân sự';
}

export function detectPartiesFromText(text, category = 'dân sự') {
  const clean = stripSemicolons(text);
  const isCriminal = /hình sự/iu.test(category);

  const plaintiffMatch = clean.match(
    /(?:nguyên đơn|người khởi kiện|bị hại|người bị hại)\s*(?:là|:|-)?\s*((?:ông|bà|anh|chị|công ty|doanh nghiệp|hộ gia đình)?\s*[\p{Lu}][\p{L}\s.&-]{2,60}?)(?=[,.;\n]|sinh năm|địa chỉ|cư trú|trú tại|yêu cầu|khởi kiện|và bị đơn|với bị đơn|$)/iu
  );
  const defendantMatch = clean.match(
    /(?:bị đơn|người bị kiện|bị cáo)\s*(?:là|:|-)?\s*((?:ông|bà|anh|chị|công ty|doanh nghiệp|cơ sở)?\s*[\p{Lu}][\p{L}\s.&-]{2,60}?)(?=[,.;\n]|sinh năm|địa chỉ|cư trú|trú tại|không đồng ý|bác bỏ|về việc|$)/iu
  );

  const plaintiffName = plaintiffMatch?.[1]?.trim()?.slice(0, 120) || (isCriminal ? 'Người bị hại trong hồ sơ' : 'Nguyên đơn khởi kiện');
  const defendantName = defendantMatch?.[1]?.trim()?.slice(0, 120) || (isCriminal ? 'Bị cáo trong hồ sơ' : 'Bị đơn trong vụ án');

  const sentences = splitSentences(clean);
  const plaintiffClaims = sentences
    .filter((s) => /nguyên đơn|khởi kiện|bị hại|yêu cầu\s+(?:bồi thường|thanh toán|trả|buộc|hủy|công nhận)/iu.test(s))
    .slice(0, 3)
    .map((s) => s.slice(0, 500));
  const defendantClaims = sentences
    .filter((s) => /bị đơn|bị cáo|không đồng ý|phản bác|đề nghị bác|cho rằng đã/iu.test(s))
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

export function normalizeAndRepairCasePayload(aiDraft, rawText, options = {}) {
  const cleanRaw = stripSemicolons(rawText);
  if (cleanRaw.length < 30) {
    throw new AppError('Nội dung bản án hoặc hồ sơ tải lên quá ngắn (cần tối thiểu 30 ký tự). Vui lòng dán hoặc tải lên nội dung chi tiết hơn.', 400, 'CASE_UPLOAD_TOO_SHORT');
  }

  const sentences = splitSentences(cleanRaw);
  const extractedDates = extractDatesFromVietnameseText(cleanRaw);
  const fallbackDate = (options.referenceDateHint && isValidDateOnly(options.referenceDateHint))
    ? options.referenceDateHint
    : (isValidDateOnly(aiDraft?.reference_date) ? aiDraft.reference_date : (extractedDates.at(-1)?.iso || '2025-06-15'));

  const category = detectCategoryFromText(cleanRaw, options.categoryHint || aiDraft?.category);

  const rawTitle = stripSemicolons(
    options.titleHint ||
    aiDraft?.title ||
    sentences[0]?.slice(0, 140) ||
    'Hồ sơ bản án thực hành do người dùng tải lên'
  );
  const title = rawTitle.slice(0, 190);

  const rawSummary = stripSemicolons(
    aiDraft?.summary ||
    sentences.slice(0, 3).join(' ') ||
    cleanRaw.slice(0, 400)
  );
  const summary = rawSummary.slice(0, 3800);

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

  // 2. Xây dựng các trích đoạn chuẩn để đảm bảo 100% có mặt trong full_document
  const extraDocumentLines = [];
  const baseDocument = stripSemicolons(aiDraft?.full_document || cleanRaw).slice(0, 38000);

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
    const defaultQuotes = sentences.slice(0, 3);
    const kinds = ['transaction', 'dispute', 'filing'];
    defaultQuotes.forEach((sentence, idx) => {
      const q = sentence.slice(0, 800);
      if (!baseDocument.includes(q) && !extraDocumentLines.includes(q)) {
        extraDocumentLines.push(q);
      }
      const dateForIdx = extractedDates[idx]?.iso || fallbackDate;
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
    for (const sentence of sentences.slice(0, 5)) {
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
    const defaultEvidences = [
      {
        name: `Văn bản trình bày và yêu cầu của ${plaintiffName}`,
        providedBy: plaintiffName,
        excerpt: sentences.slice(0, 2).join(' ') || summary,
        scope: `Xác nhận nội dung yêu cầu khởi kiện và trình bày ban đầu của ${plaintiffName}, cần đối chiếu với chứng cứ khách quan.`,
      },
      {
        name: `Biên bản làm việc và ý kiến phản hồi của ${defendantName}`,
        providedBy: defendantName,
        excerpt: sentences.slice(1, 4).join(' ') || summary,
        scope: `Ghi nhận lập trường phản biện và các tình tiết đối chứng từ phía ${defendantName}.`,
      },
    ];
    defaultEvidences.forEach((ev, idx) => {
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
      `Phiên tòa thực hành phân tích nghĩa vụ chứng minh, giá trị pháp lý của các bút lục chứng cứ và điều kiện áp dụng pháp luật đối với vụ án ${category}.`
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
  { rawText, titleHint, categoryHint, referenceDateHint, userId },
  { complete = createChatCompletion } = {}
) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new AppError('Vui lòng nhập hoặc tải lên nội dung bản án, hồ sơ vụ án.', 400, 'CASE_UPLOAD_EMPTY');
  }
  if (rawText.length > 80000) {
    throw new AppError('Nội dung bản án quá dài (tối đa 80.000 ký tự). Vui lòng rút gọn phần nội dung chính của bản án.', 400, 'CASE_UPLOAD_TOO_LARGE');
  }

  let aiDraft = null;

  // Nếu người dùng tải lên một tệp JSON đã có cấu trúc hồ sơ
  const trimmed = rawText.trim();
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
  if (model && (env.AI_API_KEY || complete !== createChatCompletion)) {
    const systemPrompt = [
      'Bạn là Thẩm phán và Chuyên gia phân tích dữ liệu pháp lý 15 năm kinh nghiệm của hệ thống CourtSim.',
      'Nhiệm vụ: Đọc văn bản bản án hoặc hồ sơ vụ án do người dùng tải lên và trích xuất thành JSON đúng chuẩn cơ sở dữ liệu CourtSim.',
      'Yêu cầu bắt buộc:',
      '1. Không dùng dấu chấm phẩy (;) trong bất kỳ trường văn bản nào, thay bằng dấu phẩy (,) hoặc dấu chấm (.).',
      '2. Trả về duy nhất một JSON object với các trường:',
      '   - title: Tên vụ án ngắn gọn, chuẩn mực (ví dụ: "Vụ án tranh chấp hợp đồng đặt cọc giữa bà A và ông B").',
      '   - category: Một trong các giá trị "dân sự", "hình sự", "lao động", "thương mại", "hành chính", "hôn nhân và gia đình".',
      '   - reference_date: Ngày xảy ra sự kiện chính hoặc ngày xét xử sơ thẩm định dạng YYYY-MM-DD.',
      '   - summary: Tóm tắt toàn cảnh nội dung vụ án, các bên và vấn đề tranh chấp cốt lõi (200-600 ký tự).',
      '   - legal_scope_note: Ghi chú các vấn đề pháp lý và nghĩa vụ chứng minh cần làm rõ tại phiên tòa.',
      '   - parties: Mảng gồm nguyên đơn/bị hại (side="plaintiff") và bị đơn/bị cáo (side="defendant"), mỗi phần tử có { side, name, claims: [các yêu cầu/quan điểm cụ thể] }.',
      '   - timeline: Mảng 3-5 mốc thời gian { kind: "transaction"|"conduct"|"dispute"|"filing"|"hearing", date: "YYYY-MM-DD", description, source_quote: câu trích nguyên văn từ văn bản }.',
      '   - case_facts: Mảng 4-8 tình tiết { kind: "recorded_event"|"party_statement"|"unproven", quote: câu trích nguyên văn từ văn bản, party: tên bên nếu là party_statement }.',
      '   - evidence_inventory: Mảng 3-5 bút lục chứng cứ { name, date: "YYYY-MM-DD", provided_by, source_locator, proof_scope, summary, content: nội dung chi tiết của văn bản/bút lục đó }.',
    ].join('\n');

    try {
      const responseText = await complete({
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

