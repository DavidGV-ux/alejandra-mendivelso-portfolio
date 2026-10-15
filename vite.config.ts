import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';

const analyze = process.env.ANALYZE === '1';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    ...(analyze
      ? [
          visualizer({
            filename: 'stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: false,
            emitFile: false,
          }),
          visualizer({
            filename: 'stats.json',
            template: 'raw-data',
            gzipSize: true,
            brotliSize: false,
            emitFile: false,
          }),
        ]
      : []),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
