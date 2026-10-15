/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { visualizer } from 'rollup-plugin-visualizer';

const analyze = process.env.ANALYZE === '1';
const contentScript = fileURLToPath(new URL('./scripts/content-pipeline.mjs', import.meta.url));

function runContentPipeline(): void {
  execFileSync(process.execPath, [contentScript], { stdio: 'inherit' });
}

/**
 * Valida y normaliza los JSON de contenido antes de compilar/cargar.
 * En dev además observa cambios y fuerza recarga completa.
 */
function contentPipelinePlugin(): Plugin {
  let regenerating = false;
  return {
    name: 'content-pipeline',
    buildStart(): void {
      runContentPipeline();
    },
    configureServer(server): void {
      runContentPipeline();
      server.watcher.on('change', (file) => {
        const normalized = file.split('\\').join('/');
        if (
          regenerating ||
          !normalized.includes('/src/content/') ||
          !normalized.endsWith('.json') ||
          normalized.includes('/generated/')
        ) {
          return;
        }
        regenerating = true;
        try {
          runContentPipeline();
          server.ws.send({ type: 'full-reload' });
        } catch {
          /* el error ya se imprimió; vite seguirá sirviendo el contenido anterior */
        } finally {
          regenerating = false;
        }
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    contentPipelinePlugin(),
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
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
