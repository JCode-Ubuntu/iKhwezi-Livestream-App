import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function emilCreditBanner() {
  return {
    name: 'emil-credit-banner',
    configureServer() {
      console.log('\n  UI motion · Emil Kowalski — https://emilkowal.ski/\n');
    },
  };
}

export default defineConfig({
  plugins: [react(), emilCreditBanner()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/storage': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/hls': {
        target: 'http://localhost:8081',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true
      },
      // LiveKit SFU (meeting A/V) — only used if you run livekit-server
      // locally (docker run -p 7880:7880 livekit/livekit-server --dev).
      // Without it, the backend reports 501 on media tokens and meetings
      // stay presence-only.
      '/livekit': {
        target: 'http://localhost:7880',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/livekit/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/hls.js')) {
            return 'hls';
          }
          // WebRTC stack for meeting calls — its own cacheable chunk, pulled
          // lazily by the MeetingRoom dynamic import (never on page load).
          if (
            id.includes('node_modules/livekit-client')
            || id.includes('node_modules/@livekit/')
          ) {
            return 'livekit';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
