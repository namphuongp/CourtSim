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
    const number = documentNumber(text);
    if (!number || !/CỘNG H[OÒ][ÀA] XÃ HỘI CHỦ NGHĨA VIỆT NAM/iu.test(text) || !/^[a-f0-9]{64}$/u.test(page.source_sha256 ?? '')) return null;
    const firstArticle = text.search(/(?:^|\n)\s*Điều\s+\d+[a-z]?\s*[.:]/iu);
    const nextDocument = [...text.matchAll(/(?:^|\n)[\t ]*(?:Luật\s+số|Số\s*(?:ký hiệu|hiệu)?)\s*[:：]?\s*(\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30})/giu)]
      .find(m => m.index > firstArticle && m[1].toUpperCase() !== number);
    const articles = readWebArticles(nextDocument ? text.slice(0, nextDocument.index) : text);
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
  if (!/CỘNG H[OÒ][ÀA] XÃ HỘI CHỦ NGHĨA VIỆT NAM/iu.test(text)) return null;
  const number = documentNumber(text);
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

function documentNumber(text) {
  // Chỉ nhận số hiệu ở phần đầu, không nhận số luật được viện dẫn trong điều khoản.
  const header = text.split(/(?:^|\n)\s*Điều\s+\d+[a-z]?\s*[.:]/iu)[0].slice(0, 12000);
  // Công báo có thể đặt lệnh công bố trước luật: lấy đầu văn bản sát phần điều khoản nhất.
  return [...header.matchAll(/(?:^|\n)[\t ]*(?:Luật\s+số|Số\s*(?:ký hiệu|hiệu)?)\s*[:：]?\s*(\d{1,4}\/(?:\d{4}\/)?[A-ZĐ][A-ZĐ0-9-]{1,30})/giu)].at(-1)?.[1]?.toUpperCase();
}

export function lawPdfLinks(page) {
  if (page.format === 'pdf') return [];
  const urls = new Set();
  const html = page.content.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/giu, '');
  for (const tag of html.matchAll(/<a\b[^>]*>/giu)) {
    for (const match of tag[0].matchAll(/\b(?:data-href|href)\s*=\s*["']([^"']+)["']/giu)) {
      try {
        const url = new URL(htmlText(match[1]), page.url);
        if (/(?:\.pdf|\/CongBaoCP\/VanBan\/[^?#]*pdf)(?:$|[?&#])/iu.test(url.href) && permittedLegalSource(url.href)) urls.add(url.href);
      } catch { /* Bỏ liên kết lỗi; mọi URL còn lại vẫn qua kiểm tra DNS khi tải. */ }
    }
  }
  const official = [...urls].filter(isOfficialLawUrl);
  return (official.length ? official : [...urls]).slice(0, 3);
}

