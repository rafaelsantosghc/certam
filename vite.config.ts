import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SYNC_DB_FILE = path.join(os.tmpdir(), 'certam_sync_db.json');

function loadSyncDb(): Record<string, string> {
  try {
    if (fs.existsSync(SYNC_DB_FILE)) {
      const raw = fs.readFileSync(SYNC_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveSyncDb(db: Record<string, string>) {
  try {
    fs.writeFileSync(SYNC_DB_FILE, JSON.stringify(db), 'utf-8');
  } catch {
    // ignore
  }
}

function mergeJsonArrayStrings(existingStr: string | undefined, incomingStr: string): string {
  if (!existingStr || existingStr === incomingStr) return incomingStr;
  if (existingStr.startsWith('[') && incomingStr.startsWith('[')) {
    try {
      const existingArr = JSON.parse(existingStr);
      const incomingArr = JSON.parse(incomingStr);
      if (Array.isArray(existingArr) && Array.isArray(incomingArr)) {
        const hasKeyedItems =
          existingArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email)) &&
          incomingArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email));
        if (!hasKeyedItems) {
          return incomingStr;
        }
        const map = new Map<string, any>();
        existingArr.forEach((item: any) => {
          const k = item.id || item.email;
          map.set(String(k), item);
        });
        incomingArr.forEach((item: any) => {
          const k = item.id || item.email;
          map.set(String(k), item);
        });
        return JSON.stringify(Array.from(map.values()));
      }
    } catch {
      // fallback
    }
  }
  return incomingStr;
}

function certamSyncPlugin(): Plugin {
  const attachMiddleware = (middlewares: any) => {
    middlewares.use('/api/sync', (req: any, res: any, next: any) => {
      if (req.method === 'GET') {
        const db = loadSyncDb();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ entries: db }));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const incoming = payload?.entries || {};
            const db = loadSyncDb();
            let modified = false;
            for (const [k, v] of Object.entries(incoming)) {
              if (typeof v === 'string') {
                const nextVal = mergeJsonArrayStrings(db[k], v);
                if (db[k] !== nextVal) {
                  db[k] = nextVal;
                  modified = true;
                }
              }
            }
            if (modified) {
              saveSyncDb(db);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false }));
          }
        });
        return;
      }
      next();
    });
  };

  return {
    name: 'certam-sync-api',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), certamSyncPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: false,
    watch: {
      ignored: ['**/.certam_sync_db.json'],
    },
  },
  esbuild: {
    // Remove console e debugger em builds de producao para evitar vazamento de informacoes
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },
  build: {
    // Desativa source maps em producao para impedir que terceiros inspecionem o codigo-fonte original
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Gera nomes opacos com hashes criptograficos para dificultar engenharia reversa
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
      },
    },
  },
}));
