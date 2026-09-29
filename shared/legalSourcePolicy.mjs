// Dùng chung ở API và giao diện, chặn tên miền giả và URL có thông tin đăng nhập.
export function isVbplUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (url.hostname === 'vbpl.vn' || url.hostname.endsWith('.vbpl.vn'));
  } catch { return false; }
}

export function hasVerifiedSource(value) {
  return isVbplUrl(value?.source_url) && value?.source_verification === 'verified'
    && Number.isFinite(Date.parse(value.checked_at)) && /^[a-f0-9]{64}$/.test(value.source_sha256 ?? '')
    && Boolean(value.version);
}

export const legalReferenceLabel = value => `[Căn cứ: ${value.law_number}, ${value.locator}]`;
