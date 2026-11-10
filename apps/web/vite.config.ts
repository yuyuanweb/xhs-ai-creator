import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://127.0.0.1:18472';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 18473,
    strictPort: true,
    proxy: {
      // 转存后的配图必须与页面同源，否则导出时读不进 SVG
      '/api': { target: API, changeOrigin: true, timeout: 0, proxyTimeout: 0 },
      '/static': { target: API, changeOrigin: true },
    },
  },
});
