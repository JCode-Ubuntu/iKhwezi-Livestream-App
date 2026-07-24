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
        },
      },
    },
  }
});
