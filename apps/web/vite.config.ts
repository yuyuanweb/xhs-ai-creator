import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://127.0.0.1:18472';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 18473,
    strictPort: true,
    proxy: {
      '/api': { target: API, changeOrigin: true, timeout: 0, proxyTimeout: 0 },
    },
  },
});
