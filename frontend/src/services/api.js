import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  timeout: 90_000,
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
    if (error.response?.status === 401) {
      localStorage.removeItem('userToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('currentUser');
    }
    return Promise.reject(error);
  },
);

export function getApiError(error, fallback = 'Không thể kết nối máy chủ.') {
  return error.response?.data?.error?.message ?? error.response?.data?.message ?? fallback;
}

export default api;
