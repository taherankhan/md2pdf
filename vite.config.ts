import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envPrefix: ['VITE_', 'GA_', 'GOOGLE_'],
  plugins: [
    react(),
    {
      name: 'api-server-middleware',
      configureServer(server: any) {
        server.middlewares.use((req: any, res: any, next: any) => {
          const url: string = req.url || '';
          if (url.startsWith('/api/') || url === '/api') {
            // @ts-ignore
            import('./server/app.js')
              .then((mod: any) => {
                const app = mod.default;
                app(req, res, next);
              })
              .catch((err: any) => {
                console.error('[vite api middleware error]:', err);
                next(err);
              });
            return;
          }
          next();
        });
      },
    },
    mode === 'analyze' &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }),
  ].filter(Boolean) as PluginOption[],
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ['node_modules'],
      },
    },
  },
  base: '/',
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror/')) {
            return 'codemirror';
          }
          if (id.includes('node_modules/mermaid')) {
            return 'mermaid';
          }
        },
      },
    },
  },
  define: {
    'process.env': {},
  },
  server: {
    open: true,
    port: 5173,
    allowedHosts: true,
  },
}));
