import { defineConfig } from 'vite';
import { cpSync, statSync } from 'node:fs';

// Cada componente carga su propio *.component.html Y *.component.css vía
// fetch() en runtime (ver app-shell.component.js:98 mount(), y
// router.js:171-173 _injectStyle() para el styleUrl de cada página) con
// un string plano, no un import estático — Vite no puede rastrear eso,
// así que nunca los mete en dist/. Sin este plugin, esos fetch devuelven
// 404 y nginx los enmascara sirviendo index.html de vuelta (fallback SPA
// de try_files), rompiendo el mount/estilo de cualquier componente en
// producción.
function copyComponentTemplates() {
  return {
    name: 'copy-component-templates',
    apply: 'build',
    writeBundle() {
      cpSync('app', 'dist/app', {
        recursive: true,
        filter: (src) =>
          statSync(src).isDirectory() ||
          src.endsWith('.html') ||
          src.endsWith('.css'),
      });
    },
  };
}

export default defineConfig({
  // index.html vive en la raíz del proyecto (frontend/), igual que hoy.
  root: '.',
  plugins: [copyComponentTemplates()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // frontend/public/ (antes frontend/assets/) se copia tal cual a dist/,
  // sin procesar — necesario porque dashboard.component.js inyecta
  // <script>/<link> hacia assets/extra-libs/c3/* en runtime con strings,
  // no con import estático, así que Vite no puede rastrearlos.
  publicDir: 'public',
  server: {
    port: 5173,
  },
});
