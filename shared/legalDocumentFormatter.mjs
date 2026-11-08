// Bộ phân tích & định dạng văn bản hồ sơ vụ án / bản án Tiếng Việt
// Khắc phục triệt để tình trạng gãy dòng cứng từ PDF/Word và phân cấp thị giác rõ ràng.

function isAllCapsLine(line) {
  if (!line || line.length > 160) return false;
  const letters = line.match(/\p{L}/gu);
  if (!letters || letters.length < 3) return false;
  return line === line.toUpperCase();
}

function isStandaloneCeremonialLine(line) {
  if (!line) return false;
  if (/^(?:độc lập\s*[-–—]\s*tự do\s*[-–—]\s*hạnh phúc|bản án số\s*:|quyết định số\s*:|ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}\.?$)/iu.test(line)) {
    return true;
  }
  if (isAllCapsLine(line) && /^(?:cộng hòa xã hội chủ nghĩa việt nam|tòa án nhân dân|tòa phúc thẩm|tại thành phố|tại tỉnh|viện kiểm sát nhân dân|nhân danh|nước cộng hòa xã hội chủ nghĩa việt nam|hồ sơ tóm tắt)/iu.test(line)) {
    return true;
  }
  return false;
}

function isSubjectLineStart(line) {
  return /^(?:v\/v|về việc)\s*[:"]/iu.test(line);
}

function isSectionHeadingLine(line) {
  if (!line || line.length > 180) return false;
  if (/^(?:nội dung vụ án|nội dung vụ việc|nhận thấy|nhận định của tòa án|nhận định của hội đồng xét xử|xét thấy|quyết định|vì các lẽ trên|phần nội dung|tóm tắt nội dung vụ án|diễn biến vụ án)\s*[:.]?$/iu.test(line)) {
    return true;
  }
  if (/^(?:phần\s+[IVXLCDM\d]+|[IVXLCDM]+)\.\s+\p{L}/iu.test(line) && line.length <= 140) {
    return true;
  }
  if (/^\d+\.\s+[\p{Lu}\p{L}][^.!?\n]{3,130}:?$/u.test(line)) {
    if (line.endsWith(':') || line.length <= 115) return true;
  }
  return false;
}

const ROLE_START_REGEX = /^(?:chủ tọa|thẩm phán|các thẩm phán|các chủ tọa|hội thẩm|thư ký|đại diện viện|kiểm sát viên|nguyên đơn|bị đơn|người khởi kiện|người bị kiện|người có quyền lợi|người đại diện|người bảo vệ|người kháng cáo|người làm chứng|người giám định|bị cáo|bị hại|cư trú|địa chỉ|trụ sở|tạm trú|nơi cư trú|sinh năm)(?![\p{L}\p{N}])/iu;

function isBulletOrNumberedStart(line) {
  return /^(?:[-+•*]|\[\d+(?:\.\d+)?\]|[a-zđ]\))\s+/iu.test(line);
}

function isRoleDefinitionLine(line, prevEndedSentence = false) {
  if (!ROLE_START_REGEX.test(line)) return false;
  if (line.includes(':')) return true;
  if (/^(?:chủ tọa|các chủ tọa|thẩm phán|các thẩm phán|hội thẩm|thư ký|đại diện viện)\s*[-–—]/iu.test(line)) return true;
  return prevEndedSentence && line.length < 90;
}

function endsWithTerminalPunctuation(line) {
  if (!line) return false;
  return /[.!?:;]$|[.!?]["”')\]»]$/u.test(line.trim());
}

export function normalizeRawLines(rawText) {
  const rawLines = String(rawText ?? '')
    .replace(/\r\n/gu, '\n')
    .split('\n');

  const cleaned = [];
  for (const rawLine of rawLines) {
    const line = rawLine
      .replace(/\s+/gu, ' ')
      .replace(/(\b\d{1,2}\/\d{1,2}\/\d{4})(?=\p{L})/gu, '$1 ')
      .replace(/^-\s*(?=\p{L})/u, '- ')
      .trim();

    if (/^(?:trang\s+\d+(?:\s*\/\s*\d+)?|\d+\s*\/\s*\d+)$/iu.test(line)) {
      continue;
    }
    cleaned.push(line);
  }
  return cleaned;
}

export function reflowVietnameseLegalLines(rawText) {
  const lines = normalizeRawLines(rawText);
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const curr = lines[i];
    if (!curr) {
      if (blocks.length > 0 && blocks[blocks.length - 1] !== '') {
        blocks.push('');
      }
      continue;
    }

    if (blocks.length === 0 || blocks[blocks.length - 1] === '') {
      blocks.push(curr);
      continue;
    }

    const prev = blocks[blocks.length - 1];
    const prevEnded = endsWithTerminalPunctuation(prev);

    // Trường hợp nối tên thành viên HĐXX bị xuống dòng (VD: "Các Chủ tọa: Bà Huỳnh Thanh Duyên" + "Ông Phan Đức Phương")
    if (
      /^(?:các\s+(?:chủ tọa|thẩm phán|hội thẩm)|hội thẩm nhân dân|thẩm phán)(?![\p{L}\p{N}])/iu.test(prev) &&
      !prevEnded &&
      /^(?:ông|bà)\s+\p{Lu}[\p{L}\s]{2,45}$/iu.test(curr) &&
      !curr.includes(':')
    ) {
      blocks[blocks.length - 1] = `${prev}; ${curr}`;
      continue;
    }

    // Không nối nếu dòng hiện tại hoặc dòng trước là tiêu đề IN HOA, mục lớn, gạch đầu dòng hoặc định nghĩa vai trò mới
    if (
      isAllCapsLine(curr) ||
      isSectionHeadingLine(curr) ||
      isStandaloneCeremonialLine(curr) ||
      isSubjectLineStart(curr) ||
      isBulletOrNumberedStart(curr) ||
      isRoleDefinitionLine(curr, prevEnded)
    ) {
      blocks.push(curr);
      continue;
    }

    if (isAllCapsLine(prev) || isSectionHeadingLine(prev) || isStandaloneCeremonialLine(prev)) {
      blocks.push(curr);
      continue;
    }

    // Nếu dòng trước là "V/v: ..." nhưng chưa đóng ngoặc kép hoặc chưa kết thúc câu -> nối dòng bị gãy
    if (isSubjectLineStart(prev) && !/[.!?]$|["”']\.?$/u.test(prev)) {
      blocks[blocks.length - 1] = `${prev} ${curr}`;
      continue;
    }

    // Nếu dòng trước chưa kết thúc câu hoặc dòng hiện tại bắt đầu bằng chữ thường / dấu câu nối tiếp -> nối liền câu PDF
    const currStartsLowerOrContinuation = /^[\p{Ll},;)\]]/u.test(curr);
    if (!prevEnded || currStartsLowerOrContinuation) {
      blocks[blocks.length - 1] = `${prev} ${curr}`;
      continue;
    }

    blocks.push(curr);
  }

  return blocks.filter((b) => b !== '');
}

export function reflowVietnameseLegalText(rawText) {
  return reflowVietnameseLegalLines(rawText).join('\n\n');
}

function splitLongParagraphIntoReadableChunks(text, maxChars = 540) {
  if (!text || text.length <= maxChars) return [text];

  // Tách theo ranh giới câu nhưng không cắt ở viết tắt như "ông Đ.", "bà N.", "TP."
  const sentences = text
    .split(/(?<=[.!?])\s+(?=\p{Lu}|["“(-])/gu)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return [text];

  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    const startsTransition = /^(?:ngày\s+\d|theo\s+|tuy nhiên|mặt khác|ngoài ra|tại\s+phiên|do\s+đó|vì\s+vậy|xét\s+thấy|như\s+vậy)/iu.test(sentence);
    if ((current.length + 1 + sentence.length > maxChars) || (startsTransition && current.length >= 240)) {
      chunks.push(current);
      current = sentence;
    } else {
      current = `${current} ${sentence}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function isPreambleCandidateLine(line, index) {
  if (index > 14) return false;
  if (isAllCapsLine(line) && !isSectionHeadingLine(line)) return true;
  if (isStandaloneCeremonialLine(line)) return true;
  if (isSubjectLineStart(line)) return true;
  return false;
}

function classifyContentBlock(line, blockIndex) {
  // 1. Đoạn nhận định đánh số [1], [2], [2.1]
  const bracketMatch = /^\[(\d+(?:\.\d+)?)\]\s*(.*)$/u.exec(line);
  if (bracketMatch) {
    const rest = bracketMatch[2].trim();
    const colonIdx = rest.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 65) {
      return {
        id: `block-${blockIndex}`,
        type: 'numbered_point',
        badge: `[${bracketMatch[1]}]`,
        label: rest.slice(0, colonIdx + 1),
        body: rest.slice(colonIdx + 1).trim(),
        raw: line,
      };
    }
    return {
      id: `block-${blockIndex}`,
      type: 'numbered_point',
      badge: `[${bracketMatch[1]}]`,
      label: '',
      body: rest,
      raw: line,
    };
  }

  // 2. Mục đánh chữ cái a), b), c) hoặc gạch đầu dòng hoặc thông tin vai trò / đương sự
  const bulletClean = line.replace(/^[-+•*]\s*/u, '').trim();
  const isBullet = /^[-+•*]\s+/u.test(line);
  const isRole = ROLE_START_REGEX.test(bulletClean);

  if (isBullet || isRole) {
    const colonIdx = bulletClean.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 125) {
      return {
        id: `block-${blockIndex}`,
        type: 'meta_item',
        isBullet,
        label: bulletClean.slice(0, colonIdx + 1),
        body: bulletClean.slice(colonIdx + 1).trim(),
        raw: line,
      };
    }
    if (isBullet) {
      return {
        id: `block-${blockIndex}`,
        type: 'meta_item',
        isBullet: true,
        label: '',
        body: bulletClean,
        raw: line,
      };
    }
  }

  // 3. Đoạn văn thông thường (có thể có nhãn ngắn mở đầu trước dấu hai chấm)
  const colonIdx = line.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 55 && !/^(?:http|https)/iu.test(line)) {
    const candidateLabel = line.slice(0, colonIdx + 1);
    if (!/[.!?]/u.test(candidateLabel)) {
      return {
        id: `block-${blockIndex}`,
        type: 'paragraph',
        label: candidateLabel,
        body: line.slice(colonIdx + 1).trim(),
        raw: line,
      };
    }
  }

  return {
    id: `block-${blockIndex}`,
    type: 'paragraph',
    label: '',
    body: line,
    raw: line,
  };
}

export function parseLegalDossierDocument(rawText) {
  const reflowedLines = reflowVietnameseLegalLines(rawText);
  if (!reflowedLines.length) {
    return {
      preamble: null,
      sections: [],
      totalBlocks: 0,
    };
  }

  // 1. Tách phần Quốc hiệu / Tiêu đề mở đầu bản án hoặc hồ sơ (Preamble)
  const preambleLines = [];
  let cursor = 0;
  while (cursor < reflowedLines.length && isPreambleCandidateLine(reflowedLines[cursor], cursor)) {
    preambleLines.push(reflowedLines[cursor]);
    cursor += 1;
  }

  let preamble = null;
  if (preambleLines.length > 0) {
    const courtLines = [];
    const mottoLines = [];
    const metaLines = [];
    const authorityLines = [];
    const titleLines = [];
    let subjectLine = '';
    let seenNhanDanh = false;

    for (const pLine of preambleLines) {
      if (/^nhân danh(?![\p{L}\p{N}])/iu.test(pLine)) {
        seenNhanDanh = true;
        authorityLines.push(pLine);
      } else if (seenNhanDanh) {
        authorityLines.push(pLine);
      } else if (/^(?:cộng hòa xã hội chủ nghĩa việt nam|độc lập\s*[-–—]\s*tự do)/iu.test(pLine)) {
        mottoLines.push(pLine);
      } else if (/^(?:bản án số|quyết định số|ngày\s+\d{1,2}\s+tháng)/iu.test(pLine)) {
        metaLines.push(pLine);
      } else if (isSubjectLineStart(pLine)) {
        subjectLine = pLine;
      } else if (/^(?:tòa án|tòa phúc thẩm|tại thành phố|tại tỉnh|viện kiểm sát)/iu.test(pLine)) {
        courtLines.push(pLine);
      } else {
        titleLines.push(pLine);
      }
    }

    preamble = {
      courtLines,
      mottoLines,
      metaLines,
      subjectLine,
      authorityLines,
      titleLines,
      rawLines: preambleLines,
    };
  }

  // 2. Phân tách các phần (Sections) và khối nội dung (Blocks)
  const sections = [];
  let currentSection = null;
  let blockCounter = 0;

  const ensureSection = (defaultTitle = 'Thông tin mở đầu & Đương sự') => {
    if (!currentSection) {
      currentSection = {
        id: `doc-sec-${sections.length + 1}`,
        title: defaultTitle,
        badge: String(sections.length + 1).padStart(2, '0'),
        blocks: [],
      };
      sections.push(currentSection);
    }
    return currentSection;
  };

  for (let i = cursor; i < reflowedLines.length; i += 1) {
    const line = reflowedLines[i];

    // Kiểm tra nếu đây là tiêu đề phần lớn (Section Heading)
    if (isSectionHeadingLine(line) || (isAllCapsLine(line) && line.length <= 95)) {
      const cleanTitle = line.replace(/[:.]$/u, '').trim();
      const numMatch = /^(\d+|[IVXLCDM]+)\.\s*(.+)$/iu.exec(cleanTitle);
      currentSection = {
        id: `doc-sec-${sections.length + 1}`,
        title: numMatch ? numMatch[2] : cleanTitle,
        badge: numMatch ? String(numMatch[1]) : String(sections.length + 1).padStart(2, '0'),
        rawHeading: line,
        blocks: [],
      };
      sections.push(currentSection);
      continue;
    }

    const activeSec = ensureSection(
      reflowedLines.some((l) => isSectionHeadingLine(l))
        ? 'Hội đồng xét xử & Các đương sự'
        : 'Nội dung chi tiết hồ sơ vụ án'
    );

    const classified = classifyContentBlock(line, blockCounter + 1);
    if (classified.type === 'paragraph' && !classified.label && classified.body.length > 560) {
      const subChunks = splitLongParagraphIntoReadableChunks(classified.body, 540);
      for (const chunk of subChunks) {
        blockCounter += 1;
        activeSec.blocks.push({
          id: `block-${blockCounter}`,
          type: 'paragraph',
          label: '',
          body: chunk,
          raw: chunk,
        });
      }
    } else {
      blockCounter += 1;
      classified.id = `block-${blockCounter}`;
      activeSec.blocks.push(classified);
    }
  }

  return {
    preamble,
    sections: sections.filter((s) => s.blocks.length > 0 || s.rawHeading),
    totalBlocks: blockCounter,
  };
}
