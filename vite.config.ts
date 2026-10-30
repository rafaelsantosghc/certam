import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP_SYNC_DB_FILE = path.join(os.tmpdir(), 'certam_sync_db.json');
const PUBLIC_SYNC_DB_FILE = path.join(process.cwd(), 'public', 'certam_sync_db.json');
const LEGACY_CACHE_FILE = path.join(process.cwd(), 'node_modules', '.cache', 'certam_sync_db.json');

interface SyncDbFileFormat {
  entries: Record<string, string>;
  versions: Record<string, number>;
}

const BANNED_CONCURSO_IDS = new Set(['tjrs_2024', 'tjrs_analista_2024', 'mprs_2024']);

function sanitizeSyncEntryValue(key: string, valStr: string): string {
  if (!valStr || typeof valStr !== 'string') return valStr;
  if (key === 'certam_concursos_cargos_v6' && valStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(valStr);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((c: any) => {
          if (!c || typeof c !== 'object') return false;
          const cid = String(c.id || '').toLowerCase();
          if (BANNED_CONCURSO_IDS.has(cid)) return false;
          if (
            String(c.orgao || '').toUpperCase() === 'TJRS' &&
            String(c.ano || '') === '2024'
          ) {
            return false;
          }
          return true;
        });
        return JSON.stringify(filtered);
      }
    } catch {
      // ignore
    }
  }
  if (key === 'certam_notifications_events_v5' && valStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(valStr);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((n: any) => {
          if (!n || typeof n !== 'object') return false;
          const cid = String(n.concurso_id || '').toLowerCase();
          if (BANNED_CONCURSO_IDS.has(cid)) return false;
          if (n.id === 'notif-1' || n.id === 'notif-2' || n.id === 'notif-3') return false;
          return true;
        });
        return JSON.stringify(filtered);
      }
    } catch {
      // ignore
    }
  }
  return valStr;
}

function readDbFile(filePath: string): SyncDbFileFormat | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.entries && typeof parsed.entries === 'object') {
          return {
            entries: parsed.entries,
            versions: parsed.versions && typeof parsed.versions === 'object' ? parsed.versions : {},
          };
        }
        const entries: Record<string, string> = {};
        const versions: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (k === '_test_ping' || typeof v !== 'string') continue;
          if (v === '[]' || v === '{}') continue;
          entries[k] = v;
          versions[k] = Date.now();
        }
        return { entries, versions };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

const LEGACY_KEY_MIGRATIONS: Record<string, string> = {
  certam_concursos_cargos: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v1: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v2: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v3: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v4: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v5: 'certam_concursos_cargos_v6',
  certam_lotes_data: 'certam_lotes_data_v6',
  certam_lotes_data_v1: 'certam_lotes_data_v6',
  certam_lotes_data_v2: 'certam_lotes_data_v6',
  certam_lotes_data_v3: 'certam_lotes_data_v6',
  certam_lotes_data_v4: 'certam_lotes_data_v6',
  certam_lotes_data_v5: 'certam_lotes_data_v6',
  certam_users_registry_v1: 'certam_users_registry_v2',
  certam_perfil_audit_requests_v4: 'certam_perfil_audit_requests_v5',
  certam_vinculacao_requests_v4: 'certam_vinculacao_requests_v5',
  certam_contact_messages_v4: 'certam_contact_messages_v5',
  certam_notifications_events_v3: 'certam_notifications_events_v5',
  certam_notifications_events_v4: 'certam_notifications_events_v5',
  certam_faq_items_v1: 'certam_faq_items_v6',
  certam_faq_items_v2: 'certam_faq_items_v6',
  certam_faq_items_v3: 'certam_faq_items_v6',
  certam_faq_items_v4: 'certam_faq_items_v6',
  certam_faq_items_v5: 'certam_faq_items_v6',
};

function isNonEmptyJsonStr(val: string | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 2 && trimmed !== '[]' && trimmed !== '{}' && trimmed !== 'null';
}

function normalizeAndMigrateDb(db: SyncDbFileFormat): { db: SyncDbFileFormat; migrated: boolean } {
  const entries = { ...db.entries };
  const versions = { ...db.versions };
  let migrated = false;

  if ('_test_ping' in entries) {
    delete entries['_test_ping'];
    delete versions['_test_ping'];
    migrated = true;
  }

  for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MIGRATIONS)) {
    if (oldKey in entries) {
      const oldVal = sanitizeSyncEntryValue(newKey, entries[oldKey]);
      if (isNonEmptyJsonStr(oldVal)) {
        if (!isNonEmptyJsonStr(entries[newKey])) {
          entries[newKey] = oldVal;
          versions[newKey] = versions[oldKey] || Date.now();
        } else {
          entries[newKey] = mergeSyncValues(entries[newKey], oldVal, false);
          versions[newKey] = Math.max(versions[newKey] || 0, versions[oldKey] || Date.now());
        }
      }
      delete entries[oldKey];
      delete versions[oldKey];
      migrated = true;
    }
  }

  for (const key of Object.keys(entries)) {
    const match = key.match(/^certam_candidatos_data_v[1-5]_(.+)$/);
    if (match) {
      const newKey = `certam_candidatos_data_v6_${match[1]}`;
      const oldVal = entries[key];
      if (isNonEmptyJsonStr(oldVal) && !isNonEmptyJsonStr(entries[newKey])) {
        entries[newKey] = oldVal;
        versions[newKey] = versions[key] || Date.now();
      }
      delete entries[key];
      delete versions[key];
      migrated = true;
    }
  }

  for (const key of Object.keys(entries)) {
    const sanitized = sanitizeSyncEntryValue(key, entries[key]);
    if (sanitized !== entries[key]) {
      if (isNonEmptyJsonStr(sanitized)) {
        entries[key] = sanitized;
      } else {
        delete entries[key];
        delete versions[key];
      }
      migrated = true;
    }
  }

  return { db: { entries, versions }, migrated };
}

function loadSyncDb(): SyncDbFileFormat {
  try {
    if (fs.existsSync(LEGACY_CACHE_FILE)) {
      fs.unlinkSync(LEGACY_CACHE_FILE);
    }
  } catch {
    // ignore
  }

  const fromPublic = readDbFile(PUBLIC_SYNC_DB_FILE);
  const fromTmp = readDbFile(TMP_SYNC_DB_FILE);

  const rawEntries: Record<string, string> = {
    ...(fromPublic?.entries || {}),
    ...(fromTmp?.entries || {}),
  };
  const rawVersions: Record<string, number> = {
    ...(fromPublic?.versions || {}),
    ...(fromTmp?.versions || {}),
  };

  // Sempre prioriza a entrada com versão mais recente entre public e tmp
  if (fromPublic && fromTmp) {
    for (const k of new Set([...Object.keys(fromPublic.entries), ...Object.keys(fromTmp.entries)])) {
      const vPub = fromPublic.versions[k] || 0;
      const vTmp = fromTmp.versions[k] || 0;
      if (vPub >= vTmp && fromPublic.entries[k]) {
        rawEntries[k] = fromPublic.entries[k];
        rawVersions[k] = vPub;
      } else if (fromTmp.entries[k]) {
        rawEntries[k] = fromTmp.entries[k];
        rawVersions[k] = vTmp;
      }
    }
  }

  const { db, migrated } = normalizeAndMigrateDb({
    entries: rawEntries,
    versions: rawVersions,
  });

  if (migrated) {
    saveSyncDb(db);
  }

  return db;
}

function saveSyncDb(db: SyncDbFileFormat) {
  const serialized = JSON.stringify(db, null, 2);
  try {
    const dir = path.dirname(PUBLIC_SYNC_DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PUBLIC_SYNC_DB_FILE, serialized, 'utf-8');
  } catch {
    // ignore
  }
  try {
    fs.writeFileSync(TMP_SYNC_DB_FILE, serialized, 'utf-8');
  } catch {
    // ignore
  }
}

function isResolvedModerationStatus(status: unknown): boolean {
  return (
    status === 'aprovado' ||
    status === 'rejeitado' ||
    status === 'respondido' ||
    status === 'arquivado'
  );
}

function mergeKeyedObjectItems(existingItem: any, incomingItem: any): any {
  const merged = { ...existingItem, ...incomingItem };
  if (
    isResolvedModerationStatus(existingItem?.status) &&
    (incomingItem?.status === 'pendente' || incomingItem?.status === 'aberto')
  ) {
    merged.status = existingItem.status;
    if (existingItem.data_avaliacao) merged.data_avaliacao = existingItem.data_avaliacao;
    if (existingItem.avaliado_por) merged.avaliado_por = existingItem.avaliado_por;
    if (existingItem.motivo_rejeicao) merged.motivo_rejeicao = existingItem.motivo_rejeicao;
    if (existingItem.candidato_id_vinculado) {
      merged.candidato_id_vinculado = existingItem.candidato_id_vinculado;
    }
    if (existingItem.respondido_em) merged.respondido_em = existingItem.respondido_em;
    if (existingItem.respondido_por) merged.respondido_por = existingItem.respondido_por;
  }
  return merged;
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
          map.set(String(k), prev ? mergeKeyedObjectItems(prev, item) : item);
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
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      if (req.method === 'GET') {
        const db = loadSyncDb();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            entries: db.entries,
            versions: db.versions,
            serverTime: new Date().toISOString(),
          })
        );
        return;
      }
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: any) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            const payload = JSON.parse(body || '{}');
            const incoming = payload?.entries || {};
            const forceReplace = Boolean(payload?.forceReplace);
            const cleanConflicts = Boolean(payload?.cleanConflicts);
            const keysToDelete: string[] = Array.isArray(payload?.deleteKeys) ? payload.deleteKeys : [];
            let db = loadSyncDb();
            let modified = false;
            const now = Date.now();

            if (cleanConflicts) {
              const normalized = normalizeAndMigrateDb(db);
              db = normalized.db;
              modified = true;
            }

            for (const delKey of keysToDelete) {
              if (typeof delKey === 'string' && delKey in db.entries) {
                delete db.entries[delKey];
                delete db.versions[delKey];
                modified = true;
              }
            }

            for (const [rawKey, v] of Object.entries(incoming)) {
              if (rawKey === '_test_ping') continue;
              const k = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
              if (typeof v === 'string') {
                const sanitizedIncoming = sanitizeSyncEntryValue(k, v);
                // Para certam_concursos_cargos_v6 vindo do Admin, usa forceReplace para que exclusões sejam definitivas
                const shouldForceKey =
                  forceReplace || k === 'certam_concursos_cargos_v6' || k === 'certam_lotes_data_v6';
                const nextVal = mergeSyncValues(
                  db.entries[k],
                  sanitizedIncoming,
                  shouldForceKey
                );
                if (db.entries[k] !== nextVal || !db.versions[k] || shouldForceKey) {
                  db.entries[k] = nextVal;
                  db.versions[k] = now;
                  modified = true;
                }
              }
            }
            if (modified) {
              saveSyncDb(db);
            }
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                ok: true,
                versions: db.versions,
                totalKeys: Object.keys(db.entries).length,
                serverTime: new Date().toISOString(),
              })
            );
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
      ignored: ['**/.certam_sync_db.json', '**/certam_sync_db.json'],
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
