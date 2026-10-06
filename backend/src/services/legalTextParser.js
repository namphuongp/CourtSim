import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import WordExtractor from 'word-extractor';

const articleHeading = /(?:^|\n)[\t \u00a0]*Điều[\t \u00a0]+(\d+[a-z]?)[\t \u00a0]*(?:[.:–-][\t \u00a0]*|\r?\n)/giu;
const paragraphHeading = /^\s*(\d+)\.\s+(?=\S)/gmu;
const pointHeading = /^\s*([a-zđ])\)\s+(?=\S)/gimu;

function getPdfLineText(items) {
  const lines = [];
  let currentLine = [];
  let currentY = null;

  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;

    if (currentY !== null && Math.abs(currentY - y) > 1.5) {
      lines.push(currentLine);
      currentLine = [];
    }
    currentLine.push({ x, y, width: item.width ?? 0, fontSize: Math.abs(item.transform?.[0] ?? 0), text: item.str });
    currentY = y;
  }
  if (currentLine.length) lines.push(currentLine);

  const pageText = lines.map((line) => {
    line.sort((left, right) => left.x - right.x);
    let text = '';
    let previous = null;
    for (const item of line) {
      if (previous) {
        const gap = item.x - (previous.x + previous.width);
        const spaceThreshold = Math.max(1.25, Math.min(item.fontSize, previous.fontSize) * 0.18);
        if (gap > spaceThreshold && !text.endsWith(' ')) text += ' ';
      }
      text += item.text;
      previous = item;
    }
    return text.trimEnd();
  }).join('\n');
  return pageText.split('\n')
    .filter((line) => !/^(?:\d+\s+)?CÔNG BÁO\/Số\s/iu.test(line.trim())
      && !/^VĂN BẢN QUY PHẠM PHÁP LUẬT\b/iu.test(line.trim())
      && !/^Luật số 31\/2024\/QH15 ngày .*Luật Đất đai \(Tiếp theo\b/iu.test(line.trim())
      && !/^\(Xem tiếp Công báo số\s/iu.test(line.trim()))
    .join('\n');
}

export async function extractPdfText(filePath) {
  return extractPdfBytes(await readFile(filePath));
}

export async function extractPdfBytes(bytes, { maxPages = 1000, maxCharacters = 4_000_000 } = {}) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise;
  const pages = [];
  let size = 0;
  try {
    if (document.numPages > maxPages) throw new Error('PDF_PAGE_LIMIT');
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = getPdfLineText(content.items);
      size += text.length;
      if (size > maxCharacters) throw new Error('PDF_TEXT_LIMIT');
      pages.push({ pageNumber, text });
    }
  } finally {
    await document.destroy();
  }

  return { pages, text: pages.map((page) => page.text).join('\n') };
}

export async function extractLegacyDocText(filePath) {
  const document = await new WordExtractor().extract(filePath);
  const text = document.getBody();
  if (!text.trim()) throw new Error(`Không trích xuất được nội dung từ ${basename(filePath)}.`);
  return { pages: [], text };
}

export function parseLegalArticles(sourceText, pages = []) {
  articleHeading.lastIndex = 0;
  const matches = [...sourceText.matchAll(articleHeading)];
  if (!matches.length) return [];

  const headings = [...sourceText.matchAll(/(?:^|\n)[\t ]*((Chương|Mục)[\t ]+[IVX\d]+[^\n]*)/giu)];
  let headingIndex = 0, chapter = null, section = null;
  return matches.map((match, index) => {
    const start = match.index + (match[0].startsWith('\n') ? 1 : 0);
    while (headings[headingIndex]?.index < start) {
      const heading = headings[headingIndex++];
      if (/^chương$/iu.test(heading[2])) { chapter = heading[1].trim(); section = null; }
      else section = heading[1].trim();
    }
    const contentStart = match.index + match[0].length;
    let end = index + 1 < matches.length ? matches[index + 1].index : sourceText.length;
    // Tiêu đề chương tiếp theo và phần ký/xuất bản không thuộc nội dung điều cuối.
    const tail = sourceText.slice(contentStart, end).search(/\n\s*(?:Chương\s+[IVX]+\b|Luật này đã được Quốc hội|VĂN PHÒNG CHÍNH PHỦ XUẤT BẢN)/u);
    if (tail >= 0) end = contentStart + tail;
    const text = sourceText.slice(start, end).trim();
    const sourcePages = pages
      .filter((page) => page.start < end && page.end > start)
      .map((page) => ({ file: page.sourceFile, number: page.sourcePageNumber ?? page.pageNumber }));
    const pageNumbers = sourcePages.map((page) => page.number);
    const sourcePageFiles = [...new Set(sourcePages.map((page) => page.file).filter(Boolean))];

    return {
      article: match[1],
      chapter, section,
      text,
      body: sourceText.slice(contentStart, end).trim(),
      pageFrom: pageNumbers.length ? Math.min(...pageNumbers) : null,
      pageTo: pageNumbers.length ? Math.max(...pageNumbers) : null,
      pageSourceFile: sourcePageFiles.length === 1 ? sourcePageFiles[0] : null,
    };
  });
}

function getHeadingMatches(text, expression) {
  expression.lastIndex = 0;
  return [...text.matchAll(expression)];
}

export function createProvisionUnits(article) {
  const articleUnit = { article: article.article, paragraph: null, point: null, text: article.text };
  const paragraphs = getHeadingMatches(article.body, paragraphHeading);
  if (!paragraphs.length) return [articleUnit];

  const units = [articleUnit];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const start = paragraph.index;
    const end = index + 1 < paragraphs.length ? paragraphs[index + 1].index : article.body.length;
    const paragraphText = article.body.slice(start, end).trim();
    const paragraphNumber = paragraph[1];
    const points = getHeadingMatches(paragraphText, pointHeading);

    units.push({
      article: article.article,
      paragraph: paragraphNumber,
      point: null,
      text: paragraphText,
    });

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      const pointEnd = pointIndex + 1 < points.length ? points[pointIndex + 1].index : paragraphText.length;
      units.push({
        article: article.article,
        paragraph: paragraphNumber,
        point: point[1].toLowerCase(),
        text: paragraphText.slice(point.index, pointEnd).trim(),
      });
    }
  }

  // Phần sửa luật có thể trích lại khoản/điểm trùng số: giữ nguyên điều thay vì gán sai locator.
  const keys = units.map(getProvisionLocatorKey);
  return new Set(keys).size === keys.length ? units : [articleUnit];
}

export function getProvisionLocator({ article, paragraph, point }) {
  const locator = [];
  if (point) locator.push(`điểm ${point}`);
  if (paragraph) locator.push(`khoản ${paragraph}`);
  locator.push(`Điều ${article}`);
  return locator.join(' ');
}

export function getProvisionLocatorKey({ article, paragraph, point }) {
  return `A:${article}|P:${paragraph ?? ''}|D:${point ?? ''}`;
}

export function buildPageOffsets(pageGroups) {
  let offset = 0;
  const text = [];
  const pages = [];

  for (const group of pageGroups) {
    const groupText = group.pages.map((page) => page.text);
    let cursor = offset;
    for (let index = 0; index < group.pages.length; index += 1) {
      const pageText = groupText[index];
      pages.push({
        pageNumber: group.pages[index].pageNumber + group.pageOffset,
        sourcePageNumber: group.pages[index].pageNumber,
        sourceFile: group.fileName ?? null,
        start: cursor,
        end: cursor + pageText.length,
      });
      cursor += pageText.length + 1;
    }
    const joined = group.text ?? groupText.join('\n');
    text.push(joined);
    offset += joined.length + 1;
  }

  return { text: text.join('\n'), pages };
}
