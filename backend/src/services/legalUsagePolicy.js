import { isPublicWebUrl } from '../../../shared/legalSourcePolicy.mjs';

// Người dùng cho phép tìm mọi website; kiểm tra DNS/redirect vẫn nằm ở tầng tải trang.
export function permittedLegalSource(url) { return isPublicWebUrl(url); }
