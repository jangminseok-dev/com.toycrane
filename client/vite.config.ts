import { defineConfig } from 'vite';

// 개발 중에는 /api·/ws를 로컬 Worker(uv run pywrangler dev, 8787)로 넘긴다
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
});
