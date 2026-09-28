import axios from 'axios';
import { clearAuth } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  timeout: 480_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('userToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
      clearAuth();
      window.location.assign('/login?returnTo=' + encodeURIComponent(window.location.pathname));
    }
    return Promise.reject(error);
  },
);

export function getApiError(error, fallback = 'Không thể kết nối máy chủ.') {
  if (error.code === 'ECONNABORTED') return 'Xử lý lâu hơn dự kiến. Nội dung nhập được giữ lại; hãy thử lại để kiểm tra kết quả.';
  const code = error.response?.data?.error?.code;
  if (code?.startsWith('AI_INVALID') || code === 'AI_UNGROUNDED_FACT' || code === 'AI_UNVERIFIED_CITATION') return 'Phản hồi chưa đáp ứng yêu cầu kiểm chứng. Biên bản và bản nháp được giữ lại; hãy thử lại.';
  const message = error.response?.data?.error?.message ?? error.response?.data?.message;
  if (typeof message !== 'string' || /stack|TypeError|MongoServer|Cannot (GET|POST|PATCH)|Không tìm thấy (GET|POST|PATCH)|<html/i.test(message)) return fallback;
  return message;
}

export default api;
