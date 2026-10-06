// Dùng chung ở API và giao diện, chặn tên miền giả và URL có thông tin đăng nhập.
export function isVbplUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (url.hostname === 'vbpl.vn' || url.hostname.endsWith('.vbpl.vn'));
  } catch { return false; }
}

export function hasVerifiedSource(value) {
  return value?.permission_status !== 'pending_permission' && value?.status !== 'pending_permission'
    && (isOfficialLawUrl(value?.source_url) || hasCorroboratingSource(value)) && value?.source_verification === 'verified'
    && Number.isFinite(Date.parse(value.checked_at)) && /^[a-f0-9]{64}$/.test(value.source_sha256 ?? '')
    && Boolean(value.version);
}

// Nguồn chính thức không giới hạn ở một cổng. Tên miền chỉ xác định nơi xuất bản, parser vẫn phải đối chiếu văn bản.
export function isOfficialLawUrl(value) {
  if (!isPublicWebUrl(value)) return false;
  const url = new URL(value);
  return url.protocol === 'https:' && (isVbplUrl(value) || url.hostname.endsWith('.gov.vn')
    || ['chinhphu.vn', 'quochoi.vn'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)));
}

function hasCorroboratingSource(value) {
  return isPublicWebUrl(value?.source_url) && Boolean(value.law_number && value.article)
    && Array.isArray(value.verification_evidence) && value.verification_evidence.some(e => e && isOfficialLawUrl(e.source_url)
      && e.law_number === value.law_number && e.article === value.article
      && e.content_sha256 === value.content_sha256 && /^[a-f0-9]{64}$/u.test(e.content_sha256 ?? '')
      && /^[a-f0-9]{64}$/u.test(e.source_sha256 ?? '') && Number.isFinite(Date.parse(e.checked_at)));
}

export const legalReferenceLabel = value => `[Căn cứ: ${value.law_number}, ${value.locator}]`;

export const isLocalLawUrl = value => typeof value === 'string' && /^\/api\/v1\/legal-sources\/[a-f0-9]{64}\/files\/\d{1,2}$/u.test(value);

export function isPublicWebUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.port
      && !/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/iu.test(url.hostname)
      && url.hostname.includes('.') && !/\.(?:local|localhost|internal)$/iu.test(url.hostname);
  } catch { return false; }
}

// Nguồn web chỉ xác nhận đã đọc được nội dung; không tương đương xác minh hiệu lực.
export function hasReadableLawSource(value) {
  if (value?.permission_status === 'pending_permission' || value?.status === 'pending_permission') return false;
  if (value?.source_verification === 'local_read') return value.permission_status === 'allowed'
    && isLocalLawUrl(value.source_url) && Number.isFinite(Date.parse(value.checked_at))
    && /^[a-f0-9]{64}$/u.test(value.source_sha256 ?? '') && Boolean(value.version);
  return hasVerifiedSource(value) || (value?.source_verification === 'web_read'
    && value.law_country === 'VN' && value.research_scope === 'land_dispute' && isPublicWebUrl(value.source_url)
    && Number.isFinite(Date.parse(value.checked_at)) && /^[a-f0-9]{64}$/.test(value.source_sha256 ?? '') && Boolean(value.version));
}
