export function feedbackFormUrl(value) {
  try {
    const url = new URL(value?.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    // Chỉ nhận link trả lời Google Forms, tránh mở URL thực thi hoặc trang giả mạo.
    const shortForm = url.hostname === 'forms.gle' && /^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname);
    const fullForm = url.hostname === 'docs.google.com'
      && /^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[a-zA-Z0-9_-]+\/viewform\/?$/.test(url.pathname);
    return shortForm || fullForm ? url.href : '';
  } catch { return ''; }
}
