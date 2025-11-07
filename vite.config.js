import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const itineraryIndexPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'public',
  'itinerary',
  'index.html',
);

const itineraryDevMiddleware = () => ({
  name: 'itinerary-dev-middleware',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url) {
        next();
        return;
      }

      const method = req.method ?? 'GET';
      if (method !== 'GET' && method !== 'HEAD') {
        next();
        return;
      }

      const [pathname] = req.url.split('?', 2);
      if (pathname !== '/itinerary' && pathname !== '/itinerary/') {
        next();
        return;
      }

      readFile(itineraryIndexPath, 'utf8')
        .then((html) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        })
        .catch((error) => {
          next(error);
        });
    });
  },
});

export default defineConfig({
  plugins: [react(), itineraryDevMiddleware()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
