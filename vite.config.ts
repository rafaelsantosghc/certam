import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP_SYNC_DB_FILE = path.join(os.tmpdir(), 'certam_sync_db.json');
const CACHE_SYNC_DB_FILE = path.join(process.cwd(), 'node_modules', '.cache', 'certam_sync_db.json');

function getSyncDbFilePath(): string {
  try {
    const dir = path.dirname(CACHE_SYNC_DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(CACHE_SYNC_DB_FILE) && fs.existsSync(TMP_SYNC_DB_FILE)) {
      fs.copyFileSync(TMP_SYNC_DB_FILE, CACHE_SYNC_DB_FILE);
    }
    return CACHE_SYNC_DB_FILE;
  } catch {
    return TMP_SYNC_DB_FILE;
  }
}

function loadSyncDb(): Record<string, string> {
  try {
    const filePath = getSyncDbFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
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
    const filePath = getSyncDbFilePath();
    fs.writeFileSync(filePath, JSON.stringify(db), 'utf-8');
  } catch {
    // ignore
  }
}

function mergeSyncValues(
  existingStr: string | undefined,
  incomingStr: string,
  forceReplace?: boolean
): string {
  if (!existingStr || existingStr === incomingStr) return incomingStr;
  if ((incomingStr === '[]' || incomingStr === '{}') && existingStr.length > 2 && !forceReplace) {
    return existingStr;
  }
  if (forceReplace) {
    return incomingStr;
  }
  if (existingStr.startsWith('[') && incomingStr.startsWith('[')) {
    try {
      const existingArr = JSON.parse(existingStr);
      const incomingArr = JSON.parse(incomingStr);
      if (Array.isArray(existingArr) && Array.isArray(incomingArr)) {
        if (incomingArr.length === 0 && existingArr.length > 0) {
          return existingStr;
        }
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
          const prev = map.get(String(k));
          map.set(String(k), prev ? { ...prev, ...item } : item);
        });
        return JSON.stringify(Array.from(map.values()));
      }
    } catch {
      // fallback
    }
  }
  if (existingStr.startsWith('{') && incomingStr.startsWith('{')) {
    try {
      const existingObj = JSON.parse(existingStr);
      const incomingObj = JSON.parse(incomingStr);
      if (
        existingObj &&
        incomingObj &&
        typeof existingObj === 'object' &&
        typeof incomingObj === 'object' &&
        !Array.isArray(existingObj) &&
        !Array.isArray(incomingObj)
      ) {
        const merged: Record<string, any> = { ...existingObj };
        for (const [key, val] of Object.entries(incomingObj)) {
          if (
            merged[key] &&
            typeof merged[key] === 'object' &&
            val &&
            typeof val === 'object' &&
            !Array.isArray(val)
          ) {
            merged[key] = { ...merged[key], ...val };
          } else {
            merged[key] = val;
          }
        }
        return JSON.stringify(merged);
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
            const forceReplace = Boolean(payload?.forceReplace);
            const db = loadSyncDb();
            let modified = false;
            for (const [k, v] of Object.entries(incoming)) {
              if (typeof v === 'string') {
                const nextVal = mergeSyncValues(db[k], v, forceReplace);
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
