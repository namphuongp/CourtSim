import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const api = process.env.VITE_API_URL ?? loadEnv(mode, process.cwd()).VITE_API_URL ?? '/api';
  if (mode === 'production' && api !== '/api') {
    const url = new URL(api);
    if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('VITE_API_URL production phải là /api hoặc HTTPS API công khai.');
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
  };
})
