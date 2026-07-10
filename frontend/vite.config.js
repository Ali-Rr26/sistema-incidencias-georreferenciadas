import { defineConfig } from 'vite';

export default defineConfig({
  // index.html vive en la raíz del proyecto (frontend/), igual que hoy.
  root: '.',
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
