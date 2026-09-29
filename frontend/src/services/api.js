import { publicErrorMessage } from '../../../shared/userCopy.mjs';
import { learnerPayload, learnerText } from '../../../shared/learnerText.mjs';
import axios from 'axios';
import { clearAuth } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 480_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-CourtSim-Request': '1' },
});

api.interceptors.request.use((config) => {
  if (config.method === 'get' || config.url?.startsWith('/auth/')) config.timeout = 15000;
  if (config.url?.endsWith('/complete')) config.timeout = 210_000;
  if (config.url?.endsWith('/dialogue')) config.timeout = 150_000;
  return config;
});

api.interceptors.response.use(
  // Góp ý là nguyên văn người dùng, có thể chứa lỗi kỹ thuật cần admin đọc.
  (response) => response.config.url?.startsWith('/v1/admin/') || response.config.url?.startsWith('/auth/') ? response : ({ ...response, data: learnerPayload(response.data) }),
  (error) => {
    if (error.response?.status === 401 && (!error.config?.url?.startsWith('/auth/') || error.config?.url?.startsWith('/auth/account') || error.config?.url === '/auth/google/link')) {
      clearAuth();
      window.location.assign('/login?returnTo=' + encodeURIComponent(window.location.pathname));
    }
    return Promise.reject(error);
  },
);

export function getApiError(error, fallback = 'Chưa thể tải nội dung. Kiểm tra kết nối và thử lại.') {
  const status = error.response?.status;
  const code = error.response?.data?.error?.code;
  const message = error.response?.data?.error?.message ?? error.response?.data?.message;
  if (import.meta.env.DEV) console.warn('Request failed', { status, code: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : undefined });
  if (!error.response || error.code === 'ECONNABORTED') return fallback;
  return learnerText(publicErrorMessage(message, code, status, fallback), fallback).replace(/\s+/gu, ' ');
}

export default api;
