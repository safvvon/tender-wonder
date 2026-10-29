import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes'
    }
  },
  preview: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes'
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three';
          }
        }
      }
    }
  }
});
