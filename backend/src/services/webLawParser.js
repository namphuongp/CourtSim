import { createHash } from 'node:crypto';
import { htmlText, parseVbplPage } from './vbplResearch.js';
import { parseLegalArticles } from './legalTextParser.js';
import { isPublicWebUrl, isOfficialLawUrl } from '../../../shared/legalSourcePolicy.mjs';
import { permittedLegalSource } from './legalUsagePolicy.js';

export function readWebArticles(text) {
  const articles = parseLegalArticles(text.replace(/\[\s*sửa\s*\]/giu, ''));
  const groups = new Map();
  for (const article of articles) {
    const body = article.text.slice(article.text.indexOf('\n') + 1);
    // Mục lục có số điều nhưng không có quy định: không được đưa vào nguồn chấm.
    if (article.text.indexOf('\n') < 0 || (body.match(/\p{L}+/gu) ?? []).length < 8) continue;
    const group = groups.get(article.article) ?? new Map();
    group.set(article.text.replace(/\s+/gu, ' ').trim(), article);
    groups.set(article.article, group);
  }
  // Có hai nội dung khác nhau cùng số điều thì chưa chọn được bản chuẩn trên trang.
  return [...groups.values()].filter(group => group.size === 1).map(group => [...group.values()][0]);
}

export function parseWebLawPage(page, now = new Date()) {
  if (!isPublicWebUrl(page.url)) return null;
  if (!permittedLegalSource(page.url)) return null;
  if (/dự\s*thảo/iu.test(page.content.slice(0, 2000))) return null;
  if (page.format === 'pdf') {
    const text = page.content.normalize('NFC');
    const number = text.match(/(?:Luật\s+số|Số\s*(?:ký hiệu|hiệu)?)\s*[:：]\s*(\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30})/iu)?.[1]?.toUpperCase();
    if (!number || !/CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/iu.test(text) || !/^[a-f0-9]{64}$/u.test(page.source_sha256 ?? '')) return null;
    const articles = readWebArticles(text);
    // PDF có thể là một phần Công báo. Không chấm điều cuối khi chưa có đầu điều tiếp để xác nhận ranh giới.
    if (articles.length < 2) return null;
    return { source_url: page.url, law_number: number, title: `Văn bản số ${number}`, document_type: 'Văn bản pháp luật',
      source_text: articles.slice(0, -1).map(a => a.text).join('\n'), source_sha256: page.source_sha256,
      checked_at: now.toISOString(), parser_version: isOfficialLawUrl(page.url) ? 2 : 1,
      source_verification: isOfficialLawUrl(page.url) ? 'verified' : 'web_read', law_country: 'VN', research_scope: 'land_dispute',
      version: `Nội dung PDF đối chiếu ngày ${now.toISOString().slice(0, 10)}, chưa xác minh thời điểm áp dụng` };
  }
  const official = parseVbplPage(page, undefined, now);
  if (official && readWebArticles(official.source_text).length) return {
    ...official, law_country: 'VN', research_scope: 'land_dispute',
  };
  const text = htmlText(page.content);
  if (/Sorry, you have been blocked|Access denied|Just a moment/iu.test(text)) return null;
  // Chỉ nhận trang chứa dấu hiệu văn bản Việt Nam và số hiệu; không lấy bài tổng hợp chỉ nhắc điều luật.
  if (!/CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/iu.test(text)) return null;
  const number = text.match(/Số\s*(?:ký hiệu|hiệu)?\s*[:：]\s*(\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30})/iu)?.[1]?.toUpperCase();
  if (!number) return null;
  const title = htmlText(page.content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1]
    ?? page.content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1] ?? '').slice(0, 500);
  if (!title || /dự\s*thảo/iu.test(title) || !readWebArticles(text).length) return null;
  return { source_url: page.url, law_number: number, title, source_text: text,
    document_type: title.match(/Bộ luật|Luật|Nghị định|Nghị quyết|Thông tư/iu)?.[0] ?? 'Văn bản pháp luật',
    source_sha256: createHash('sha256').update(page.content).digest('hex'), checked_at: now.toISOString(), parser_version: isOfficialLawUrl(page.url) ? 2 : 1,
    source_verification: isOfficialLawUrl(page.url) ? 'verified' : 'web_read', law_country: 'VN', research_scope: 'land_dispute',
    version: `Nội dung trang đọc ngày ${now.toISOString().slice(0, 10)}, chưa xác minh hiệu lực` };
}

