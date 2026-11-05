const SYNC_INTERVAL_MS = 15000;
let initialized = false;
let activePullPromise: Promise<boolean> | null = null;
let localApiAvailable: boolean | null = null;

const memoryStore = new Map<string, string>();
const lastLocalWriteAt = new Map<string, number>();
const knownServerVersions = new Map<string, number>();

// Telemetria de economia de limites gratuitos (Supabase Egress & Vercel)
const syncTelemetry = {
  deltaPollsCount: 0,
  fullDownloadsCount: 0,
  keysSkippedByDelta: 0,
  estimatedBytesSaved: 0,
  estimatedBytesDownloaded: 0,
  indexedDbActive: false,
  lastKeepAliveAt: null as string | null,
};

// Camada de Cache Assíncrono em IndexedDB para superar o limite de 5 MB do localStorage
const IDB_NAME = 'certam_cloud_cache_v1';
const IDB_STORE = 'kv_entries';
let idbPromise: Promise<IDBDatabase | null> | null = null;

function openCertamIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        syncTelemetry.indexedDbActive = true;
        resolve(req.result);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

async function idbSetItem(key: string, value: string): Promise<void> {
  const db = await openCertamIndexedDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
  } catch {
    // ignore
  }
}

async function idbHydrateMemoryStore(): Promise<void> {
  const db = await openCertamIndexedDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result || [];
        const vals = valsReq.result || [];
        let hydratedAny = false;
        for (let i = 0; i < keys.length; i++) {
          const k = String(keys[i]);
          const v = vals[i];
          if (typeof v === 'string' && !memoryStore.has(k)) {
            memoryStore.set(k, v);
            hydratedAny = true;
          }
        }
        if (hydratedAny && typeof window !== 'undefined') {
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('certam_candidatos_updated'));
          window.dispatchEvent(new CustomEvent('certam_concursos_updated'));
        }
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export interface QuotaAndSyncMetrics {
  totalKeys: number;
  totalStorageBytes: number;
  totalStorageMB: number;
  supabaseFreeDbLimitMB: number;
  supabaseDbUsagePercent: number;
  deltaPollsCount: number;
  keysSkippedByDelta: number;
  estimatedMBDownloaded: number;
  estimatedMBSaved: number;
  indexedDbActive: boolean;
  localApiSkippedInStaticMode: boolean;
  lastKeepAliveAt: string | null;
}

export interface SupabaseConnectionConfig {
  url: string;
  anonKey: string;
}

export interface SyncStatusSnapshot {
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastLocalApiOk: boolean;
  lastSupabaseOk: boolean | null;
  lastSupabaseError: string | null;
  supabaseConfigured: boolean;
  supabaseUrl: string;
}

export interface TableDiagnosticInfo {
  table: string;
  ok: boolean;
  rowCount: number;
  latencyMs: number;
  error?: string;
  conflictKeys?: string[];
  sampleKeys?: string[];
}

export interface FullSyncDiagnosticsReport {
  timestamp: string;
  localApi: {
    ok: boolean;
    latencyMs: number;
    totalKeys: number;
    keys: { key: string; itemCount: number; sizeBytes: number; updatedAt: number }[];
    roundtripOk: boolean;
    error?: string;
  };
  supabase: {
    configured: boolean;
    url: string;
    connected: boolean;
    roundtripOk: boolean;
    error?: string;
    tables: TableDiagnosticInfo[];
    conflictsFound: string[];
  };
}

const syncStatus: SyncStatusSnapshot = {
  lastPullAt: null,
  lastPushAt: null,
  lastLocalApiOk: false,
  lastSupabaseOk: null,
  lastSupabaseError: null,
  supabaseConfigured: false,
  supabaseUrl: '',
};

const SUPABASE_CONFIG_KEY = 'certam_supabase_config';

const SYNC_PREFIXES = [
  'certam_concursos_',
  'certam_lotes_',
  'certam_candidatos_',
  'certam_users_',
  'certam_perfil_audit_',
  'certam_audit_',
  'certam_vinculacao_',
  'certam_vinculacoes_',
  'certam_contact_',
  'certam_notifications_',
  'certam_faq_',
  'certam_chat_',
  'certam_dm_',
  'certam_error_logs_',
  SUPABASE_CONFIG_KEY,
];

// Chaves leves de alta prioridade enviadas em lote rápido;
// Listas de candidatos (certam_candidatos_data_v6_*) são enviadas individualmente (1 POST por cargo) para evitar limite de payload.
const PRIORITY_PREFIXES = [
  'certam_concursos_',
  'certam_lotes_',
  'certam_perfil_audit_',
  'certam_audit_',
  'certam_vinculacao_',
  'certam_vinculacoes_',
  'certam_contact_',
  'certam_notifications_',
  'certam_faq_',
  'certam_error_logs_',
  SUPABASE_CONFIG_KEY,
];

const APPEND_QUEUE_PREFIXES = [
  'certam_perfil_audit_',
  'certam_audit_',
  'certam_vinculacao_',
  'certam_vinculacoes_',
  'certam_contact_',
  'certam_notifications_',
  'certam_error_logs_',
];

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

const LEGACY_KEYS_TO_REMOVE = [
  ...Object.keys(LEGACY_KEY_MIGRATIONS),
  '_test_ping',
  'certam_diag_heartbeat',
];

const BANNED_CONCURSO_IDS = new Set(['tjrs_2024', 'tjrs_analista_2024', 'mprs_2024']);

const ADMIN_AUTHORITATIVE_KEYS = new Set([
  'certam_concursos_cargos_v6',
  'certam_lotes_data_v6',
  'certam_faq_items_v6',
  SUPABASE_CONFIG_KEY,
]);

function isAdminAuthoritativeKey(key: string): boolean {
  if (ADMIN_AUTHORITATIVE_KEYS.has(key)) return true;
  if (key.startsWith('certam_candidatos_data_')) return true;
  return false;
}

function isAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('certam_auth_user_v8');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    const email = String(parsed.email || '').trim().toLowerCase();
    return Boolean(parsed.is_admin) || email === 'rafasms0@hotmail.com';
  } catch {
    return false;
  }
}

function sanitizeSyncValue(key: string, valStr: string | null | undefined): string | null {
  if (valStr === null || valStr === undefined || typeof valStr !== 'string') return null;
  if (key === 'certam_concursos_cargos_v6' && valStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(valStr);
      if (Array.isArray(parsed)) {
        const filtered = parsed
          .filter((c: any) => {
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
          })
          .map((c: any) => {
            if (
              c.id === 'tjrs_2025' &&
              c.nome === 'Concurso TJRS - Tribunal de Justiça do Rio Grande do Sul' &&
              c.status === 'Homologado' &&
              c.tipo_lotacao === 'Comarca'
            ) {
              return {
                ...c,
                nome: 'Tribunal de Justiça do Estado do Rio Grande do Sul',
                status: 'Convocando',
                tipo_lotacao: 'Lotação',
              };
            }
            return c;
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

function isRicherConcursosJson(localStr: string | null | undefined, serverStr: string | null | undefined): boolean {
  if (!isNonEmptySerialized(localStr)) return false;
  if (!isNonEmptySerialized(serverStr)) return true;
  try {
    const locArr = JSON.parse(localStr);
    const srvArr = JSON.parse(serverStr);
    if (!Array.isArray(locArr) || !Array.isArray(srvArr)) return false;
    const score = (arr: any[]) =>
      arr.reduce((acc, c) => {
        if (!c || typeof c !== 'object') return acc;
        const lotLen = Array.isArray(c.catalogo_lotacoes) ? c.catalogo_lotacoes.length : 0;
        const cronLen = Array.isArray(c.cronograma) ? c.cronograma.length : 0;
        const docLen = Array.isArray(c.documentos) ? c.documentos.length : 0;
        const comLen = Array.isArray(c.comunicados) ? c.comunicados.length : 0;
        return acc + lotLen * 10 + cronLen * 5 + docLen * 5 + comLen * 5;
      }, 0);
    return score(locArr) > score(srvArr);
  } catch {
    return false;
  }
}

function shouldSyncKey(key: string): boolean {
  if (key in LEGACY_KEY_MIGRATIONS || key === '_test_ping' || key === 'certam_diag_heartbeat') {
    return false;
  }
  if (/^certam_candidatos_data_v[1-5]_/.test(key)) {
    return false;
  }
  if (
    key.endsWith('_tjrs_2024') ||
    key.includes('_tjrs_2024_') ||
    key.endsWith('_mprs_2024') ||
    key.includes('_mprs_2024_')
  ) {
    return false;
  }
  return SYNC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isPriorityKey(key: string): boolean {
  return PRIORITY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isAppendQueueKey(key: string): boolean {
  return APPEND_QUEUE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isNonEmptySerialized(val: string | null | undefined): val is string {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 2 && trimmed !== '[]' && trimmed !== '{}' && trimmed !== 'null';
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
  const existingTs = Number(existingItem?.updated_at_ms || 0);
  const incomingTs = Number(incomingItem?.updated_at_ms || 0);
  const base = existingTs > incomingTs ? incomingItem : existingItem;
  const newer = existingTs > incomingTs ? existingItem : incomingItem;
  const merged = { ...base, ...newer };

  if (existingTs > 0 || incomingTs > 0) {
    merged.updated_at_ms = Math.max(existingTs, incomingTs);
  }

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
  } else if (
    isResolvedModerationStatus(incomingItem?.status) &&
    (existingItem?.status === 'pendente' || existingItem?.status === 'aberto')
  ) {
    merged.status = incomingItem.status;
  }
  return merged;
}

function mergeCandidateArraysJson(
  localStr: string,
  serverStr: string
): { mergedStr: string; localHadNewerCandidate: boolean } {
  try {
    const localArr = JSON.parse(localStr);
    const serverArr = JSON.parse(serverStr);
    if (!Array.isArray(localArr) || !Array.isArray(serverArr)) {
      return { mergedStr: serverStr, localHadNewerCandidate: false };
    }
    const map = new Map<string, any>();
    for (const sItem of serverArr) {
      if (!sItem || typeof sItem !== 'object') continue;
      const key = String(sItem.id || `pos_${sItem.posicao}`);
      map.set(key, sItem);
    }
    let localHadNewerCandidate = false;
    for (const lItem of localArr) {
      if (!lItem || typeof lItem !== 'object') continue;
      const key = String(lItem.id || `pos_${lItem.posicao}`);
      const sItem = map.get(key);
      if (!sItem) {
        continue;
      }
      const lTs = Number(lItem.updated_at_ms || 0);
      const sTs = Number(sItem.updated_at_ms || 0);
      if (lTs > sTs) {
        const mergedCand = mergeKeyedObjectItems(sItem, lItem);
        map.set(key, mergedCand);
        localHadNewerCandidate = true;
      }
    }
    if (!localHadNewerCandidate) {
      return { mergedStr: serverStr, localHadNewerCandidate: false };
    }
    return {
      mergedStr: JSON.stringify(Array.from(map.values())),
      localHadNewerCandidate: true,
    };
  } catch {
    return { mergedStr: serverStr, localHadNewerCandidate: false };
  }
}

function resolveSupabaseConfig(): SupabaseConnectionConfig | null {
  try {
    const env = (import.meta as any).env || {};
    const envUrl = (
      env.VITE_SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL ||
      env.SUPABASE_URL ||
      env.PUBLIC_SUPABASE_URL ||
      ''
    ).trim();
    const envKey = (
      env.VITE_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.PUBLIC_SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      ''
    ).trim();
    if (envUrl && envKey && envUrl.startsWith('http')) {
      return { url: envUrl.replace(/\/+$/, ''), anonKey: envKey };
    }
  } catch {
    // ignore
  }

  try {
    const raw =
      memoryStore.get(SUPABASE_CONFIG_KEY) ||
      (typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_CONFIG_KEY) : null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.url === 'string' &&
        typeof parsed.anonKey === 'string' &&
        parsed.url.trim().startsWith('http') &&
        parsed.anonKey.trim().length > 10
      ) {
        return {
          url: parsed.url.trim().replace(/\/+$/, ''),
          anonKey: parsed.anonKey.trim(),
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function getSupabaseHeaders(anonKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function migrateAndCleanupLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MIGRATIONS)) {
      const rawOld = localStorage.getItem(oldKey);
      const oldVal = sanitizeSyncValue(newKey, rawOld);
      if (isNonEmptySerialized(oldVal)) {
        const currentVal = sanitizeSyncValue(newKey, localStorage.getItem(newKey));
        if (!isNonEmptySerialized(currentVal)) {
          localStorage.setItem(newKey, oldVal);
          memoryStore.set(newKey, oldVal);
        }
      }
      localStorage.removeItem(oldKey);
      memoryStore.delete(oldKey);
    }

    for (const activeKey of ['certam_concursos_cargos_v6', 'certam_notifications_events_v5']) {
      const rawCurrent = localStorage.getItem(activeKey);
      if (rawCurrent) {
        const sanitized = sanitizeSyncValue(activeKey, rawCurrent);
        if (sanitized !== rawCurrent) {
          if (isNonEmptySerialized(sanitized)) {
            localStorage.setItem(activeKey, sanitized);
            memoryStore.set(activeKey, sanitized);
          } else {
            localStorage.removeItem(activeKey);
            memoryStore.delete(activeKey);
          }
        }
      }
    }

    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const candMatch = k.match(/^certam_candidatos_data_v[1-5]_(.+)$/);
      if (candMatch) {
        const newKey = `certam_candidatos_data_v6_${candMatch[1]}`;
        const oldVal = localStorage.getItem(k);
        if (isNonEmptySerialized(oldVal) && !isNonEmptySerialized(localStorage.getItem(newKey))) {
          try {
            localStorage.setItem(newKey, oldVal);
            memoryStore.set(newKey, oldVal);
          } catch {
            // ignore quota
          }
        }
        keysToDelete.push(k);
      } else if (
        k.startsWith('certam_chat_messages_v4_') ||
        k === '_test_ping' ||
        k === 'certam_diag_heartbeat' ||
        k.endsWith('_tjrs_2024') ||
        k.includes('_tjrs_2024_') ||
        k.endsWith('_mprs_2024') ||
        k.includes('_mprs_2024_')
      ) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => {
      localStorage.removeItem(k);
      memoryStore.delete(k);
    });
  } catch {
    // ignore
  }
}

function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  // Sempre persiste de forma assíncrona no IndexedDB (sem limite de 5 MB)
  void idbSetItem(key, value);

  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    migrateAndCleanupLegacyLocalStorage();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      try {
        const evictableKeys: { k: string; len: number; isHeavyCandidates: boolean }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || k === key || k.startsWith('certam_auth_')) continue;
          const v = localStorage.getItem(k) || '';
          memoryStore.set(k, v);
          void idbSetItem(k, v);
          const isHeavyCandidates = k.startsWith('certam_candidatos_data_v6_');
          if (
            isHeavyCandidates ||
            (!k.startsWith('certam_concursos_') &&
              !k.startsWith('certam_lotes_') &&
              !k.startsWith('certam_perfil_audit_'))
          ) {
            evictableKeys.push({ k, len: v.length, isHeavyCandidates });
          }
        }
        // Remove primeiro chaves secundárias, e se ainda faltar espaço no localStorage de 5MB,
        // move as listas pesadas de candidatos apenas para memoryStore + IndexedDB
        evictableKeys.sort((a, b) => {
          if (a.isHeavyCandidates !== b.isHeavyCandidates) {
            return a.isHeavyCandidates ? 1 : -1;
          }
          return b.len - a.len;
        });
        for (const item of evictableKeys) {
          localStorage.removeItem(item.k);
          try {
            localStorage.setItem(key, value);
            return true;
          } catch {
            // continue freeing space
          }
        }
      } catch {
        // ignore
      }
      return false;
    }
  }
}

function getAllLocalSyncEntries(): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && shouldSyncKey(k)) {
          const val = sanitizeSyncValue(k, localStorage.getItem(k));
          if (val !== null) {
            result[k] = val;
            if (!memoryStore.has(k)) {
              memoryStore.set(k, val);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  for (const [k, v] of memoryStore.entries()) {
    if (shouldSyncKey(k)) {
      const sanitized = sanitizeSyncValue(k, v);
      if (sanitized !== null) {
        result[k] = sanitized;
      }
    }
  }
  return result;
}

async function upsertSingleRowViaPatchOrInsert(
  cfg: SupabaseConnectionConfig,
  chave: string,
  valor: any
): Promise<{ ok: boolean; error?: string }> {
  const encodedKey = encodeURIComponent(chave);
  const strValor = typeof valor === 'string' ? valor : JSON.stringify(valor);

  // 1. Tenta PATCH filtrando por chave=eq.<chave> (não exige UNIQUE constraint nem coluna updated_at)
  for (const candidateValor of [valor, strValor]) {
    try {
      const patchRes = await fetch(`${cfg.url}/rest/v1/configuracoes?chave=eq.${encodedKey}`, {
        method: 'PATCH',
        headers: getSupabaseHeaders(cfg.anonKey, {
          Prefer: 'return=representation',
        }),
        body: JSON.stringify({ valor: candidateValor }),
      });

      if (patchRes.ok) {
        const updatedRows = await patchRes.json().catch(() => []);
        if (Array.isArray(updatedRows) && updatedRows.length > 0) {
          // Se existiam linhas duplicadas para a mesma chave (com id), remove as cópias excedentes
          if (updatedRows.length > 1 && updatedRows[0]?.id !== undefined) {
            const keepId = updatedRows[0].id;
            await fetch(
              `${cfg.url}/rest/v1/configuracoes?chave=eq.${encodedKey}&id=neq.${encodeURIComponent(String(keepId))}`,
              {
                method: 'DELETE',
                headers: getSupabaseHeaders(cfg.anonKey),
              }
            ).catch(() => {});
          }
          return { ok: true };
        }
        // Nenhuma linha existia com essa chave -> prossegue para INSERT simples abaixo
        break;
      }
    } catch {
      // ignore and try next
    }
  }

  // 2. Faz INSERT simples (sem ?on_conflict=chave) para funcionar mesmo sem índice UNIQUE em chave
  let lastError = '';
  for (const candidateValor of [valor, strValor]) {
    try {
      const postRes = await fetch(`${cfg.url}/rest/v1/configuracoes`, {
        method: 'POST',
        headers: getSupabaseHeaders(cfg.anonKey, {
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({ chave, valor: candidateValor }),
      });
      if (postRes.ok) {
        return { ok: true };
      }
      lastError = await postRes.text().catch(() => `HTTP ${postRes.status}`);
    } catch (e: any) {
      lastError = e?.message || 'Erro de rede';
    }
  }

  return {
    ok: false,
    error: `Erro ao gravar chave ${chave} no Supabase: ${lastError.slice(0, 180)}`,
  };
}

async function upsertConfigRowsToSupabase(
  cfg: SupabaseConnectionConfig,
  rowsWithTimestamp: { chave: string; valor: any; updated_at: string }[]
): Promise<{ ok: boolean; error?: string }> {
  if (rowsWithTimestamp.length === 0) return { ok: true };
  try {
    // Estratégia 1: Upsert em lote com updated_at
    const res = await fetch(`${cfg.url}/rest/v1/configuracoes?on_conflict=chave`, {
      method: 'POST',
      headers: getSupabaseHeaders(cfg.anonKey, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(rowsWithTimestamp),
    });

    if (res.ok) {
      return { ok: true };
    }

    // Estratégia 2: Upsert em lote sem updated_at (caso a coluna não exista)
    const rowsWithoutTimestamp = rowsWithTimestamp.map(({ chave, valor }) => ({
      chave,
      valor,
    }));
    const retryRes = await fetch(`${cfg.url}/rest/v1/configuracoes?on_conflict=chave`, {
      method: 'POST',
      headers: getSupabaseHeaders(cfg.anonKey, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(rowsWithoutTimestamp),
    });
    if (retryRes.ok) {
      return { ok: true };
    }

    // Estratégia 3: Fallback universal PATCH + INSERT por chave (funciona mesmo sem UNIQUE(chave), sem updated_at ou com valor TEXT)
    let allOk = true;
    let lastErr: string | undefined;
    for (const row of rowsWithTimestamp) {
      const singleRes = await upsertSingleRowViaPatchOrInsert(cfg, row.chave, row.valor);
      if (!singleRes.ok) {
        allOk = false;
        lastErr = singleRes.error;
      }
    }
    return { ok: allOk, error: lastErr };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Falha de rede ao conectar ao Supabase',
    };
  }
}

async function pushEntriesToSupabase(entries: Record<string, string>): Promise<boolean> {
  const cfg = resolveSupabaseConfig();
  syncStatus.supabaseConfigured = Boolean(cfg);
  syncStatus.supabaseUrl = cfg?.url || '';
  if (!cfg) return false;

  const keys = Object.keys(entries).filter((k) => k !== SUPABASE_CONFIG_KEY && shouldSyncKey(k));
  if (keys.length === 0) return true;

  const nowIso = new Date().toISOString();
  const smallRows: { chave: string; valor: any; updated_at: string }[] = [];
  const largeRows: { chave: string; valor: any; updated_at: string }[] = [];

  for (const chave of keys) {
    const cleanStr = sanitizeSyncValue(chave, entries[chave]) || entries[chave];
    let parsedValor: any = cleanStr;
    try {
      parsedValor = JSON.parse(cleanStr);
    } catch {
      parsedValor = cleanStr;
    }
    const row = {
      chave,
      valor: parsedValor,
      updated_at: nowIso,
    };
    if (chave.startsWith('certam_candidatos_') || cleanStr.length > 35000) {
      largeRows.push(row);
    } else {
      smallRows.push(row);
    }
  }

  let allOk = true;
  let lastErr: string | null = null;

  if (smallRows.length > 0) {
    const res = await upsertConfigRowsToSupabase(cfg, smallRows);
    if (!res.ok) {
      allOk = false;
      lastErr = res.error || null;
    }
  }

  for (const largeRow of largeRows) {
    const res = await upsertConfigRowsToSupabase(cfg, [largeRow]);
    if (!res.ok) {
      allOk = false;
      lastErr = res.error || null;
    }
  }

  syncStatus.lastSupabaseOk = allOk;
  syncStatus.lastSupabaseError = allOk ? null : lastErr;
  if (allOk) {
    syncStatus.lastPushAt = nowIso;
  }
  return allOk;
}

async function fetchEntriesFromSupabase(): Promise<{
  entries: Record<string, string>;
  versions: Record<string, number>;
} | null> {
  const cfg = resolveSupabaseConfig();
  syncStatus.supabaseConfigured = Boolean(cfg);
  syncStatus.supabaseUrl = cfg?.url || '';
  if (!cfg) return null;

  try {
    // PLANO 1 — DELTA SYNC:
    // Passo 1: Consulta leve apenas de metadados (chave, updated_at) ~1 KB
    const metaRes = await fetch(`${cfg.url}/rest/v1/configuracoes?select=chave,updated_at`, {
      method: 'GET',
      headers: getSupabaseHeaders(cfg.anonKey),
      cache: 'no-store',
    });

    if (metaRes.ok) {
      const metaRows = await metaRes.json();
      if (Array.isArray(metaRows)) {
        syncTelemetry.deltaPollsCount++;
        const entries: Record<string, string> = {};
        const versions: Record<string, number> = {};
        const keysToDownload: string[] = [];

        for (const row of metaRows) {
          if (!row || typeof row.chave !== 'string') continue;
          const rawKey = row.chave;
          if (!rawKey.startsWith('certam_')) continue;
          if (rawKey === '_test_ping' || rawKey === 'certam_diag_heartbeat') continue;
          const canonicalKey = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
          if (!shouldSyncKey(canonicalKey)) continue;

          const ts = row.updated_at ? new Date(row.updated_at).getTime() : 0;
          versions[canonicalKey] = Math.max(versions[canonicalKey] || 0, ts);

          const cachedVal = memoryStore.get(canonicalKey) ?? (typeof window !== 'undefined' ? localStorage.getItem(canonicalKey) : null);
          const knownTs = knownServerVersions.get(canonicalKey) || 0;

          if (isNonEmptySerialized(cachedVal) && ts > 0 && knownTs > 0 && ts <= knownTs) {
            // Chave não mudou no Supabase! Reaproveita o cache em memória sem gastar Egress
            entries[canonicalKey] = cachedVal;
            syncTelemetry.keysSkippedByDelta++;
            syncTelemetry.estimatedBytesSaved += cachedVal.length;
          } else {
            keysToDownload.push(rawKey);
          }
        }

        // Passo 2: Baixa o payload (valor) APENAS das chaves novas ou modificadas
        if (keysToDownload.length > 0) {
          const inList = keysToDownload.map((k) => `"${k.replace(/"/g, '')}"`).join(',');
          const deltaRes = await fetch(
            `${cfg.url}/rest/v1/configuracoes?select=chave,valor,updated_at&chave=in.(${encodeURIComponent(inList)})`,
            {
              method: 'GET',
              headers: getSupabaseHeaders(cfg.anonKey),
              cache: 'no-store',
            }
          );

          if (deltaRes.ok) {
            const deltaRows = await deltaRes.json();
            if (Array.isArray(deltaRows)) {
              for (const row of deltaRows) {
                if (!row || typeof row.chave !== 'string') continue;
                const rawKey = row.chave;
                const canonicalKey = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
                if (!shouldSyncKey(canonicalKey)) continue;

                const rawSerialized =
                  typeof row.valor === 'string' ? row.valor : JSON.stringify(row.valor ?? null);
                const serialized = sanitizeSyncValue(canonicalKey, rawSerialized);
                const ts = row.updated_at ? new Date(row.updated_at).getTime() : Date.now() - 5000;

                if (!isNonEmptySerialized(serialized)) continue;
                syncTelemetry.estimatedBytesDownloaded += serialized.length;

                if (!entries[canonicalKey] || (versions[canonicalKey] || 0) <= ts) {
                  entries[canonicalKey] = serialized;
                  versions[canonicalKey] = ts;
                }
              }
            }
          }
        }

        syncStatus.lastSupabaseOk = true;
        syncStatus.lastSupabaseError = null;
        return { entries, versions };
      }
    }

    // Fallback para select=* caso a tabela legada não possua a coluna updated_at
    syncTelemetry.fullDownloadsCount++;
    const res = await fetch(`${cfg.url}/rest/v1/configuracoes?select=*`, {
      method: 'GET',
      headers: getSupabaseHeaders(cfg.anonKey),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      syncStatus.lastSupabaseOk = false;
      syncStatus.lastSupabaseError = `Erro ao ler configuracoes (${res.status}): ${errText.slice(0, 180)}`;
      return null;
    }

    const rows = await res.json();
    const entries: Record<string, string> = {};
    const versions: Record<string, number> = {};

    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (!row || typeof row.chave !== 'string') continue;
        const rawKey = row.chave;
        if (!rawKey.startsWith('certam_')) continue;
        if (rawKey === '_test_ping' || rawKey === 'certam_diag_heartbeat') continue;
        const canonicalKey = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
        if (!shouldSyncKey(canonicalKey)) continue;

        const rawSerialized =
          typeof row.valor === 'string' ? row.valor : JSON.stringify(row.valor ?? null);
        const serialized = sanitizeSyncValue(canonicalKey, rawSerialized);
        const ts = row.updated_at ? new Date(row.updated_at).getTime() : Date.now() - 5000;

        if (!isNonEmptySerialized(serialized)) continue;
        syncTelemetry.estimatedBytesDownloaded += serialized.length;

        if (!entries[canonicalKey] || (versions[canonicalKey] || 0) < ts) {
          entries[canonicalKey] = serialized;
          versions[canonicalKey] = ts;
        }
      }
    }

    syncStatus.lastSupabaseOk = true;
    syncStatus.lastSupabaseError = null;
    return { entries, versions };
  } catch (err: any) {
    syncStatus.lastSupabaseOk = false;
    syncStatus.lastSupabaseError = err?.message || 'Falha de rede ao consultar Supabase';
    return null;
  }
}

async function sendEntriesBatch(
  entries: Record<string, string>,
  forceReplace = false,
  cleanConflicts = false,
  deleteKeys: string[] = []
): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0 && !cleanConflicts && deleteKeys.length === 0) return;

  const priorityBatch: Record<string, string> = {};
  const bulkKeys: string[] = [];

  for (const k of keys) {
    const cleanVal = sanitizeSyncValue(k, entries[k]);
    if (!cleanVal) continue;
    if (isPriorityKey(k)) {
      priorityBatch[k] = cleanVal;
    } else {
      bulkKeys.push(k);
    }
  }

  // Só chama /api/sync se não tiver sido detectado modo estático (ex: Vercel sem backend Express)
  if (localApiAvailable !== false) {
    if (Object.keys(priorityBatch).length > 0 || cleanConflicts || deleteKeys.length > 0) {
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: priorityBatch,
            forceReplace,
            cleanConflicts,
            deleteKeys,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          localApiAvailable = true;
          syncStatus.lastLocalApiOk = true;
          syncStatus.lastPushAt = new Date().toISOString();
          const data = await res.json();
          if (data?.versions && typeof data.versions === 'object') {
            for (const [vk, vv] of Object.entries(data.versions)) {
              if (typeof vv === 'number') knownServerVersions.set(vk, vv);
            }
          }
        } else if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          localApiAvailable = false;
          syncStatus.lastLocalApiOk = false;
        }
      } catch {
        syncStatus.lastLocalApiOk = false;
      }
    }

    if (localApiAvailable !== false) {
      for (const bk of bulkKeys) {
        const cleanVal = sanitizeSyncValue(bk, entries[bk]);
        if (!cleanVal) continue;
        try {
          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entries: { [bk]: cleanVal },
              forceReplace: forceReplace || isAdminAuthoritativeKey(bk),
            }),
          });
          if (res.ok) {
            syncStatus.lastLocalApiOk = true;
            syncStatus.lastPushAt = new Date().toISOString();
            const data = await res.json();
            if (data?.versions && typeof data.versions === 'object') {
              for (const [vk, vv] of Object.entries(data.versions)) {
                if (typeof vv === 'number') knownServerVersions.set(vk, vv);
              }
            }
          }
        } catch {
          // ignore network error
        }
      }
    }
  }

  if (Object.keys(entries).length > 0) {
    await pushEntriesToSupabase(entries);
  }
}

function dispatchUpdateEvents(changedKeys: string[]): void {
  if (typeof window === 'undefined' || changedKeys.length === 0) return;
  window.dispatchEvent(new Event('storage'));
  if (changedKeys.some((k) => k.startsWith('certam_concursos_'))) {
    window.dispatchEvent(new CustomEvent('certam_concursos_updated'));
  }
  if (changedKeys.some((k) => k.startsWith('certam_lotes_'))) {
    window.dispatchEvent(new CustomEvent('certam_lotes_updated'));
  }
  if (changedKeys.some((k) => k.startsWith('certam_candidatos_'))) {
    window.dispatchEvent(new CustomEvent('certam_candidatos_updated'));
  }
  if (changedKeys.some((k) => k.includes('audit'))) {
    window.dispatchEvent(new CustomEvent('certam_audit_updated'));
  }
  if (changedKeys.some((k) => k.includes('vinculac'))) {
    window.dispatchEvent(new CustomEvent('certam_vinculacoes_updated'));
  }
  if (changedKeys.some((k) => k.startsWith('certam_contact_'))) {
    window.dispatchEvent(new CustomEvent('certam_contact_updated'));
  }
  if (changedKeys.some((k) => k.startsWith('certam_notifications_'))) {
    window.dispatchEvent(new CustomEvent('certam_notifications_updated'));
  }
  if (changedKeys.some((k) => k.startsWith('certam_users_'))) {
    window.dispatchEvent(new CustomEvent('certam_users_updated'));
    window.dispatchEvent(new CustomEvent('certam_registry_updated'));
  }
  if (changedKeys.some((k) => k.startsWith('certam_faq_'))) {
    window.dispatchEvent(new CustomEvent('certam_faqs_updated'));
  }
  if (changedKeys.some((k) => k.startsWith('certam_error_logs_'))) {
    window.dispatchEvent(new CustomEvent('certam_error_logs_updated'));
  }
}

async function executePullFromServer(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    migrateAndCleanupLegacyLocalStorage();
    const isCurrentUserAdmin = isAdminSession();

    let localApiEntries: Record<string, string> = {};
    let localApiVersions: Record<string, number> = {};
    let usedStaticFallback = false;

    if (localApiAvailable !== false) {
      try {
        const res = await fetch('/api/sync', { cache: 'no-store' });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          localApiAvailable = true;
          syncStatus.lastLocalApiOk = true;
          const data = await res.json();
          localApiEntries = data?.entries || {};
          localApiVersions = data?.versions || {};
        } else {
          localApiAvailable = false;
          syncStatus.lastLocalApiOk = false;
        }
      } catch {
        syncStatus.lastLocalApiOk = false;
      }
    }

    // Fallback para arquivo estático /certam_sync_db.json apenas na primeira carga caso /api/sync não esteja rodando
    if (!syncStatus.lastLocalApiOk && memoryStore.size === 0) {
      try {
        const snapRes = await fetch('/certam_sync_db.json', { cache: 'no-store' });
        const snapType = snapRes.headers.get('content-type') || '';
        if (snapRes.ok && snapType.includes('json')) {
          const snapData = await snapRes.json();
          if (snapData?.entries && typeof snapData.entries === 'object') {
            localApiEntries = snapData.entries;
            localApiVersions = {};
            for (const k of Object.keys(snapData.entries)) {
              localApiVersions[k] = 1;
            }
            usedStaticFallback = true;
          }
        }
      } catch {
        // ignore
      }
    }

    if (
      localApiEntries[SUPABASE_CONFIG_KEY] &&
      !memoryStore.has(SUPABASE_CONFIG_KEY) &&
      !localStorage.getItem(SUPABASE_CONFIG_KEY)
    ) {
      memoryStore.set(SUPABASE_CONFIG_KEY, localApiEntries[SUPABASE_CONFIG_KEY]);
      safeLocalStorageSet(SUPABASE_CONFIG_KEY, localApiEntries[SUPABASE_CONFIG_KEY]);
    }

    const supabaseData = await fetchEntriesFromSupabase();

    if (
      supabaseData?.entries?.[SUPABASE_CONFIG_KEY] &&
      !memoryStore.has(SUPABASE_CONFIG_KEY) &&
      !localStorage.getItem(SUPABASE_CONFIG_KEY)
    ) {
      memoryStore.set(SUPABASE_CONFIG_KEY, supabaseData.entries[SUPABASE_CONFIG_KEY]);
      safeLocalStorageSet(SUPABASE_CONFIG_KEY, supabaseData.entries[SUPABASE_CONFIG_KEY]);
    }

    const entries: Record<string, string> = {};
    const serverVersions: Record<string, number> = {};
    const nowMs = Date.now();

    for (const [k, rawVal] of Object.entries(localApiEntries)) {
      const cleanVal = sanitizeSyncValue(k, rawVal);
      if (cleanVal !== null) {
        entries[k] = cleanVal;
        const rawVer = localApiVersions[k] || 0;
        serverVersions[k] = rawVer === 1793400000000 || rawVer > nowMs + 60000 ? 1 : rawVer;
      }
    }

    if (supabaseData) {
      for (const [k, rawSupVal] of Object.entries(supabaseData.entries)) {
        const supVal = sanitizeSyncValue(k, rawSupVal);
        if (!supVal) continue;
        const supVer = supabaseData.versions[k] || 0;
        const locSrvVal = entries[k];
        const locSrvVer = serverVersions[k] || 0;

        if (!isNonEmptySerialized(locSrvVal) || usedStaticFallback || locSrvVer <= 1) {
          entries[k] = supVal;
          serverVersions[k] = supVer;
        } else if (supVal !== locSrvVal) {
          if (isAdminAuthoritativeKey(k)) {
            if (supVer >= locSrvVer) {
              entries[k] = supVal;
              serverVersions[k] = supVer;
            }
            continue;
          }
          if (locSrvVal.startsWith('[') && supVal.startsWith('[')) {
            try {
              const arrA = JSON.parse(locSrvVal);
              const arrB = JSON.parse(supVal);
              if (
                Array.isArray(arrA) &&
                Array.isArray(arrB) &&
                arrA.every((x: any) => x && typeof x === 'object' && (x.id || x.email)) &&
                arrB.every((x: any) => x && typeof x === 'object' && (x.id || x.email))
              ) {
                const map = new Map<string, any>();
                const base = supVer >= locSrvVer ? arrA : arrB;
                const newer = supVer >= locSrvVer ? arrB : arrA;
                base.forEach((item: any) => map.set(String(item.id || item.email), item));
                newer.forEach((item: any) => {
                  const ik = String(item.id || item.email);
                  const prev = map.get(ik);
                  map.set(ik, prev ? mergeKeyedObjectItems(prev, item) : item);
                });
                entries[k] = JSON.stringify(Array.from(map.values()));
                serverVersions[k] = Math.max(supVer, locSrvVer);
                continue;
              }
            } catch {
              // fallback
            }
          }
          if (supVer >= locSrvVer) {
            entries[k] = supVal;
            serverVersions[k] = supVer;
          }
        }
      }
    }

    const changedKeys: string[] = [];
    const toPushBack: Record<string, string> = {};
    const toForcePushAdmin: Record<string, string> = {};
    const allLocal = getAllLocalSyncEntries();

    // 1. Garantir que dados autoritativos do Admin e listas de classificação locais que ainda não estejam no servidor/Supabase sejam publicados
    for (const [localKey, localVal] of Object.entries(allLocal)) {
      if (!isNonEmptySerialized(localVal)) continue;

      const srvVal = entries[localKey];
      const apiVal = localApiEntries[localKey];
      const supVal = supabaseData?.entries?.[localKey];

      if (isAdminAuthoritativeKey(localKey)) {
        if (isCurrentUserAdmin) {
          const missingInApi = syncStatus.lastLocalApiOk && apiVal !== localVal;
          const missingInSupabase = Boolean(
            supabaseData && localKey !== SUPABASE_CONFIG_KEY && supVal !== localVal
          );
          if (srvVal !== localVal || missingInApi || missingInSupabase) {
            toForcePushAdmin[localKey] = localVal;
          }
        } else {
          // Se este navegador já possui listas de classificação ou concursos mais completos salvos pelo Admin (ex: admin deslogou para testar como usuário comum), publica imediatamente para o servidor/Supabase!
          const srvVerForLocal = serverVersions[localKey] || 0;
          const missingOnServer = !isNonEmptySerialized(srvVal) || srvVerForLocal <= 1;
          const missingOnSupabase = Boolean(
            supabaseData && localKey !== SUPABASE_CONFIG_KEY && !isNonEmptySerialized(supVal)
          );
          const localIsRicherConcursos =
            localKey === 'certam_concursos_cargos_v6' && isRicherConcursosJson(localVal, srvVal);
          if (
            localKey.startsWith('certam_candidatos_data_v6_') &&
            (missingOnServer || missingOnSupabase)
          ) {
            toForcePushAdmin[localKey] = localVal;
          } else if (
            (missingOnServer || localIsRicherConcursos) &&
            localVal !== srvVal
          ) {
            toForcePushAdmin[localKey] = localVal;
          }
        }
        continue;
      }

      if (
        !isNonEmptySerialized(srvVal) ||
        (syncStatus.lastLocalApiOk && !isNonEmptySerialized(apiVal)) ||
        (supabaseData && !isNonEmptySerialized(supVal))
      ) {
        toPushBack[localKey] = localVal;
      }
    }

    // 2. Processar e mesclar chaves vindas do servidor / Supabase
    for (const [rawKey, rawServerVal] of Object.entries(entries)) {
      const k = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
      if (!shouldSyncKey(k) || typeof rawServerVal !== 'string') continue;

      const serverVal = sanitizeSyncValue(k, rawServerVal);
      if (!serverVal) continue;

      const localVal = cloudSync.getItem(k);
      const srvVer = serverVersions[rawKey] || serverVersions[k] || 0;
      const prevKnownVer = knownServerVersions.get(k) || 0;
      const recentlyWrittenLocally = Date.now() - (lastLocalWriteAt.get(k) || 0) < 3500;

      if (!isNonEmptySerialized(serverVal)) {
        if (isNonEmptySerialized(localVal) && !recentlyWrittenLocally) {
          if (
            !isAdminAuthoritativeKey(k) ||
            isCurrentUserAdmin ||
            k.startsWith('certam_candidatos_data_v6_')
          ) {
            toPushBack[k] = localVal;
          }
        }
        continue;
      }

      // REGRA DE AUTORIDADE PARA CONCURSOS, LOTES, CANDIDATOS E FAQs:
      if (isAdminAuthoritativeKey(k)) {
        // PLANO 3 — Merge atômico por candidato em listas certam_candidatos_data_v6_*
        if (k.startsWith('certam_candidatos_data_v6_') && isNonEmptySerialized(localVal) && isNonEmptySerialized(serverVal)) {
          const { mergedStr, localHadNewerCandidate } = mergeCandidateArraysJson(localVal, serverVal);
          if (localHadNewerCandidate) {
            if (mergedStr !== localVal) {
              memoryStore.set(k, mergedStr);
              safeLocalStorageSet(k, mergedStr);
              changedKeys.push(k);
            }
            if (mergedStr !== serverVal) {
              toPushBack[k] = mergedStr;
            }
            if (srvVer) knownServerVersions.set(k, srvVer);
            continue;
          }
        }

        if (isCurrentUserAdmin) {
          if (isNonEmptySerialized(localVal)) {
            if (localVal !== serverVal) {
              toForcePushAdmin[k] = localVal;
            }
            if (srvVer) knownServerVersions.set(k, srvVer);
            continue;
          }
          memoryStore.set(k, serverVal);
          safeLocalStorageSet(k, serverVal);
          if (srvVer) knownServerVersions.set(k, srvVer);
          changedKeys.push(k);
          continue;
        } else {
          // Nunca permite que um seed estático (srvVer <= 1) ou um seed sem catálogo de lotações sobrescreva dados reais já existentes neste navegador
          if (
            isNonEmptySerialized(localVal) &&
            (srvVer <= 1 ||
              (k === 'certam_concursos_cargos_v6' && isRicherConcursosJson(localVal, serverVal)))
          ) {
            if (localVal !== serverVal) {
              toForcePushAdmin[k] = localVal;
            }
            continue;
          }
          if (localVal !== serverVal) {
            memoryStore.set(k, serverVal);
            safeLocalStorageSet(k, serverVal);
            changedKeys.push(k);
          }
          if (srvVer) knownServerVersions.set(k, srvVer);
          continue;
        }
      }

      if (recentlyWrittenLocally && isNonEmptySerialized(localVal)) {
        if (localVal !== serverVal) {
          toPushBack[k] = localVal;
        }
        continue;
      }

      if (localVal === serverVal) {
        if (srvVer) knownServerVersions.set(k, srvVer);
        continue;
      }

      if (!isNonEmptySerialized(localVal)) {
        memoryStore.set(k, serverVal);
        safeLocalStorageSet(k, serverVal);
        if (srvVer) knownServerVersions.set(k, srvVer);
        changedKeys.push(k);
        continue;
      }

      if (localVal.startsWith('[') && serverVal.startsWith('[')) {
        try {
          const localArr = JSON.parse(localVal);
          const serverArr = JSON.parse(serverVal);
          if (Array.isArray(localArr) && Array.isArray(serverArr)) {
            const hasKeyedItems =
              localArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email)) &&
              serverArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email));

            if (prevKnownVer > 0 && srvVer > prevKnownVer && !isAppendQueueKey(k)) {
              memoryStore.set(k, serverVal);
              safeLocalStorageSet(k, serverVal);
              knownServerVersions.set(k, srvVer);
              changedKeys.push(k);
              continue;
            }

            if (hasKeyedItems) {
              const map = new Map<string, any>();
              serverArr.forEach((item: any) => {
                const itemKey = String(item.id || item.email);
                map.set(itemKey, item);
              });
              let localHadExtraOrUpdatedItems = false;
              localArr.forEach((item: any) => {
                const itemKey = String(item.id || item.email);
                if (!map.has(itemKey)) {
                  if (isAppendQueueKey(k) || prevKnownVer === 0) {
                    map.set(itemKey, item);
                    localHadExtraOrUpdatedItems = true;
                  }
                } else {
                  const srvItem = map.get(itemKey);
                  const finalItem = mergeKeyedObjectItems(item, srvItem);
                  if (JSON.stringify(finalItem) !== JSON.stringify(srvItem)) {
                    localHadExtraOrUpdatedItems = true;
                  }
                  map.set(itemKey, finalItem);
                }
              });

              const mergedArr = Array.from(map.values());
              const mergedStr = JSON.stringify(mergedArr);

              if (mergedStr !== localVal) {
                memoryStore.set(k, mergedStr);
                safeLocalStorageSet(k, mergedStr);
                changedKeys.push(k);
              }
              if (localHadExtraOrUpdatedItems && mergedStr !== serverVal) {
                toPushBack[k] = mergedStr;
              }
              if (srvVer) knownServerVersions.set(k, srvVer);
              continue;
            }
          }
        } catch {
          // Fallback to serverVal
        }
      }

      if (localVal.startsWith('{') && serverVal.startsWith('{')) {
        try {
          const localObj = JSON.parse(localVal);
          const serverObj = JSON.parse(serverVal);
          if (
            localObj &&
            serverObj &&
            typeof localObj === 'object' &&
            typeof serverObj === 'object' &&
            !Array.isArray(localObj) &&
            !Array.isArray(serverObj)
          ) {
            const merged: Record<string, any> = { ...localObj };
            let localHadExtraKeys = false;
            const serverKeys = new Set(Object.keys(serverObj));
            for (const lk of Object.keys(localObj)) {
              if (!serverKeys.has(lk)) {
                localHadExtraKeys = true;
              }
            }
            for (const [key, val] of Object.entries(serverObj)) {
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
            const mergedStr = JSON.stringify(merged);
            if (mergedStr !== localVal) {
              memoryStore.set(k, mergedStr);
              safeLocalStorageSet(k, mergedStr);
              changedKeys.push(k);
            }
            if (localHadExtraKeys && mergedStr !== serverVal) {
              toPushBack[k] = mergedStr;
            }
            if (srvVer) knownServerVersions.set(k, srvVer);
            continue;
          }
        } catch {
          // Fallback to serverVal
        }
      }

      memoryStore.set(k, serverVal);
      safeLocalStorageSet(k, serverVal);
      if (srvVer) knownServerVersions.set(k, srvVer);
      changedKeys.push(k);
    }

    syncStatus.lastPullAt = new Date().toISOString();

    if (changedKeys.length > 0) {
      dispatchUpdateEvents(changedKeys);
    }

    if (Object.keys(toForcePushAdmin).length > 0) {
      void sendEntriesBatch(toForcePushAdmin, true);
    }

    if (Object.keys(toPushBack).length > 0) {
      void sendEntriesBatch(toPushBack, false);
    }

    return changedKeys.length > 0;
  } catch {
    return false;
  }
}

export const cloudSync = {
  getAllKeys(): string[] {
    const keys = new Set<string>();
    for (const k of memoryStore.keys()) {
      keys.add(k);
    }
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) keys.add(k);
        }
      } catch {
        // ignore
      }
    }
    return Array.from(keys);
  },

  getItem(key: string): string | null {
    const canonicalKey = LEGACY_KEY_MIGRATIONS[key] || key;
    if (memoryStore.has(canonicalKey)) {
      return sanitizeSyncValue(canonicalKey, memoryStore.get(canonicalKey) ?? null);
    }
    if (typeof window === 'undefined') return null;
    try {
      let val = sanitizeSyncValue(canonicalKey, localStorage.getItem(canonicalKey));
      if (!isNonEmptySerialized(val)) {
        for (const [oldKey, mappedKey] of Object.entries(LEGACY_KEY_MIGRATIONS)) {
          if (mappedKey === canonicalKey) {
            const legacyVal = sanitizeSyncValue(canonicalKey, localStorage.getItem(oldKey));
            if (isNonEmptySerialized(legacyVal)) {
              val = legacyVal;
              safeLocalStorageSet(canonicalKey, legacyVal);
              localStorage.removeItem(oldKey);
              break;
            }
          }
        }
      }
      if (val !== null) {
        memoryStore.set(canonicalKey, val);
      }
      return val;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: any, forceReplace?: boolean): void {
    const canonicalKey = LEGACY_KEY_MIGRATIONS[key] || key;
    const rawStr = typeof value === 'string' ? value : JSON.stringify(value);
    const strValue = sanitizeSyncValue(canonicalKey, rawStr) || rawStr;
    memoryStore.set(canonicalKey, strValue);
    lastLocalWriteAt.set(canonicalKey, Date.now());
    safeLocalStorageSet(canonicalKey, strValue);
    void this.pushKey(canonicalKey, strValue, forceReplace);
  },

  async pushKey(key: string, value: any, forceReplace?: string | boolean): Promise<void> {
    if (typeof window === 'undefined') return;
    const canonicalKey = LEGACY_KEY_MIGRATIONS[key] || key;
    const rawStr = typeof value === 'string' ? value : JSON.stringify(value);
    const strValue = sanitizeSyncValue(canonicalKey, rawStr) || rawStr;
    memoryStore.set(canonicalKey, strValue);
    lastLocalWriteAt.set(canonicalKey, Date.now());

    if (localApiAvailable !== false) {
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: { [canonicalKey]: strValue },
            forceReplace: Boolean(forceReplace) || isAdminAuthoritativeKey(canonicalKey),
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          localApiAvailable = true;
          syncStatus.lastLocalApiOk = true;
          syncStatus.lastPushAt = new Date().toISOString();
          const data = await res.json();
          if (data?.versions && typeof data.versions === 'object') {
            for (const [vk, vv] of Object.entries(data.versions)) {
              if (typeof vv === 'number') knownServerVersions.set(vk, vv);
            }
          }
        } else if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          localApiAvailable = false;
          syncStatus.lastLocalApiOk = false;
        }
      } catch {
        syncStatus.lastLocalApiOk = false;
      }
    }

    await pushEntriesToSupabase({ [canonicalKey]: strValue });
  },

  async pushAllLocal(forceReplace = false): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      migrateAndCleanupLegacyLocalStorage();
      const isCurrentUserAdmin = isAdminSession();
      const allLocal = getAllLocalSyncEntries();
      const nonEmpty: Record<string, string> = {};
      for (const [k, val] of Object.entries(allLocal)) {
        if (!isNonEmptySerialized(val)) continue;
        if (!isCurrentUserAdmin && isAdminAuthoritativeKey(k) && !k.startsWith('certam_candidatos_data_v6_')) {
          continue;
        }
        nonEmpty[k] = val;
      }
      await sendEntriesBatch(nonEmpty, forceReplace || isCurrentUserAdmin);
    } catch {
      // Ignore network errors
    }
  },

  async pullFromServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (activePullPromise) {
      return activePullPromise;
    }
    activePullPromise = executePullFromServer().finally(() => {
      activePullPromise = null;
    });
    return activePullPromise;
  },

  getStatus(): SyncStatusSnapshot {
    const cfg = resolveSupabaseConfig();
    return {
      ...syncStatus,
      supabaseConfigured: Boolean(cfg),
      supabaseUrl: cfg?.url || '',
    };
  },

  getSupabaseConfig(): SupabaseConnectionConfig | null {
    return resolveSupabaseConfig();
  },

  async setSupabaseConfig(url: string, anonKey: string): Promise<boolean> {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = anonKey.trim();
    if (!cleanUrl || !cleanKey) return false;
    const serialized = JSON.stringify({ url: cleanUrl, anonKey: cleanKey });
    memoryStore.set(SUPABASE_CONFIG_KEY, serialized);
    safeLocalStorageSet(SUPABASE_CONFIG_KEY, serialized);
    await this.pushKey(SUPABASE_CONFIG_KEY, serialized, true);
    await this.pullFromServer();
    await this.pushAllLocal(true);
    return Boolean(syncStatus.lastSupabaseOk);
  },

  async clearSupabaseConfig(): Promise<void> {
    memoryStore.delete(SUPABASE_CONFIG_KEY);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SUPABASE_CONFIG_KEY);
    }
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteKeys: [SUPABASE_CONFIG_KEY] }),
      });
    } catch {
      // ignore
    }
    syncStatus.supabaseConfigured = false;
    syncStatus.supabaseUrl = '';
    syncStatus.lastSupabaseOk = null;
    syncStatus.lastSupabaseError = null;
  },

  async runDiagnostics(): Promise<FullSyncDiagnosticsReport> {
    const timestamp = new Date().toISOString();
    const report: FullSyncDiagnosticsReport = {
      timestamp,
      localApi: {
        ok: false,
        latencyMs: 0,
        totalKeys: 0,
        keys: [],
        roundtripOk: false,
      },
      supabase: {
        configured: false,
        url: '',
        connected: false,
        roundtripOk: false,
        tables: [],
        conflictsFound: [],
      },
    };

    // 1. Testar Servidor Local (/api/sync)
    const t0 = performance.now();
    try {
      const res = await fetch('/api/sync', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      report.localApi.latencyMs = Math.round(performance.now() - t0);
      if (res.ok && contentType.includes('application/json')) {
        report.localApi.ok = true;
        const data = await res.json();
        const entries: Record<string, string> = data?.entries || {};
        const versions: Record<string, number> = data?.versions || {};
        const keyList = Object.keys(entries);
        report.localApi.totalKeys = keyList.length;
        report.localApi.keys = keyList.map((k) => {
          const val = entries[k] || '';
          let itemCount = 1;
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) itemCount = parsed.length;
            else if (parsed && typeof parsed === 'object') itemCount = Object.keys(parsed).length;
          } catch {
            itemCount = 1;
          }
          return {
            key: k,
            itemCount,
            sizeBytes: val.length,
            updatedAt: versions[k] || 0,
          };
        });

        const postRes = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: {} }),
        });
        report.localApi.roundtripOk = postRes.ok;
      } else {
        report.localApi.error = 'Modo estático (usando Supabase)';
      }
    } catch (err: any) {
      report.localApi.error = err?.message || 'Servidor /api/sync indisponível (modo estático)';
    }

    // 2. Testar Supabase (se configurado)
    const cfg = resolveSupabaseConfig();
    if (!cfg) {
      report.supabase.configured = false;
      return report;
    }

    report.supabase.configured = true;
    report.supabase.url = cfg.url;

    // 2.1 Verificar a tabela oficial única do site atual: public.configuracoes
    const stConf = performance.now();
    try {
      const res = await fetch(`${cfg.url}/rest/v1/configuracoes?select=*`, {
        method: 'GET',
        headers: getSupabaseHeaders(cfg.anonKey),
        cache: 'no-store',
      });
      const latencyMs = Math.round(performance.now() - stConf);
      if (res.ok) {
        const rows = await res.json();
        const rowCount = Array.isArray(rows) ? rows.length : 0;
        const conflictKeys: string[] = [];
        const sampleKeys: string[] = [];

        if (Array.isArray(rows)) {
          for (const r of rows) {
            if (r?.chave) {
              const k = String(r.chave);
              sampleKeys.push(k);
              if (!k.startsWith('certam_')) {
                conflictKeys.push(`${k} (outro site)`);
                report.supabase.conflictsFound.push(`configuracoes.${k} (outro site)`);
              } else if (
                k in LEGACY_KEY_MIGRATIONS ||
                k === '_test_ping' ||
                k === 'certam_diag_heartbeat' ||
                /^certam_candidatos_data_v[1-5]_/.test(k) ||
                k.includes('tjrs_2024') ||
                k.includes('mprs_2024')
              ) {
                conflictKeys.push(`${k} (legado)`);
                report.supabase.conflictsFound.push(`configuracoes.${k}`);
              }
            }
          }
        }

        report.supabase.tables.push({
          table: 'configuracoes (Tabela Oficial CERTAM)',
          ok: true,
          rowCount,
          latencyMs,
          conflictKeys,
          sampleKeys,
        });
        report.supabase.connected = true;
      } else {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        report.supabase.tables.push({
          table: 'configuracoes (Tabela Oficial CERTAM)',
          ok: false,
          rowCount: 0,
          latencyMs,
          error: `HTTP ${res.status}: ${errText.slice(0, 140)}`,
        });
      }
    } catch (err: any) {
      report.supabase.tables.push({
        table: 'configuracoes (Tabela Oficial CERTAM)',
        ok: false,
        rowCount: 0,
        latencyMs: Math.round(performance.now() - stConf),
        error: err?.message || 'Erro de rede',
      });
    }

    // 2.1.b Verificar a tabela dedicada de logs centralizados de erros: public.system_logs
    const stErr = performance.now();
    try {
      const errRes = await fetch(`${cfg.url}/rest/v1/system_logs?select=id&limit=100`, {
        method: 'GET',
        headers: getSupabaseHeaders(cfg.anonKey),
        cache: 'no-store',
      });
      const errLat = Math.round(performance.now() - stErr);
      if (errRes.ok) {
        const errRows = await errRes.json().catch(() => []);
        report.supabase.tables.push({
          table: 'system_logs (Logs de Falhas ErrorBoundary)',
          ok: true,
          rowCount: Array.isArray(errRows) ? errRows.length : 0,
          latencyMs: errLat,
          conflictKeys: [],
        });
      } else if (errRes.status === 404) {
        // Fallback para verificar se existe a tabela legada error_logs
        const fallbackRes = await fetch(`${cfg.url}/rest/v1/error_logs?select=id&limit=100`, {
          method: 'GET',
          headers: getSupabaseHeaders(cfg.anonKey),
          cache: 'no-store',
        });
        if (fallbackRes.ok) {
          const fallbackRows = await fallbackRes.json().catch(() => []);
          report.supabase.tables.push({
            table: 'error_logs (Legado • Use system_logs)',
            ok: true,
            rowCount: Array.isArray(fallbackRows) ? fallbackRows.length : 0,
            latencyMs: errLat,
            conflictKeys: [],
          });
        } else {
          report.supabase.tables.push({
            table: 'system_logs (Logs de Falhas ErrorBoundary)',
            ok: false,
            rowCount: 0,
            latencyMs: errLat,
            error: 'Tabela opcional (use o SQL abaixo para criar public.system_logs)',
          });
        }
      }
    } catch {
      // ignore
    }

    // 2.2 Verificar se tabelas do outro site ainda existem no banco
    const foreignTables = ['concursos', 'lotes', 'respostas', 'candidatos_base', 'comarcas_tjrs'];
    for (const table of foreignTables) {
      const st = performance.now();
      try {
        const res = await fetch(`${cfg.url}/rest/v1/${table}?select=*&limit=5`, {
          method: 'GET',
          headers: getSupabaseHeaders(cfg.anonKey),
          cache: 'no-store',
        });
        const latencyMs = Math.round(performance.now() - st);
        if (res.status === 404) {
          // Tabela do outro site já foi eliminada com sucesso via DROP TABLE!
          report.supabase.tables.push({
            table: `${table} (Outro Site — Eliminada)`,
            ok: true,
            rowCount: 0,
            latencyMs,
            conflictKeys: [],
          });
        } else if (res.ok) {
          const rows = await res.json();
          const rowCount = Array.isArray(rows) ? rows.length : 0;
          const conflictMsg =
            rowCount > 0
              ? [`Tabela do outro site com dados residuais (execute o SQL para DROP TABLE)`]
              : [`Tabela do outro site vazia (execute o SQL para DROP TABLE)`];
          if (rowCount > 0) {
            report.supabase.conflictsFound.push(`public.${table} (tabela do outro site)`);
          }
          report.supabase.tables.push({
            table: `${table} (Outro Site)`,
            ok: true,
            rowCount,
            latencyMs,
            conflictKeys: conflictMsg,
          });
        }
      } catch {
        // ignore
      }
    }

    // 2.3 Teste real de Escrita + Leitura + Limpeza na tabela public.configuracoes
    if (report.supabase.connected) {
      const testToken = `ok_${Date.now()}`;
      const writeRes = await upsertConfigRowsToSupabase(cfg, [
        {
          chave: 'certam_diag_heartbeat',
          valor: { status: testToken, testedAt: timestamp },
          updated_at: timestamp,
        },
      ]);
      if (writeRes.ok) {
        report.supabase.roundtripOk = true;
        await fetch(`${cfg.url}/rest/v1/configuracoes?chave=eq.certam_diag_heartbeat`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        }).catch(() => {});
      } else {
        report.supabase.error = writeRes.error || 'Falha no teste de escrita no Supabase';
      }
    }

    return report;
  },

  async cleanConflictsAndSyncAll(): Promise<{
    cleanedKeysCount: number;
    publishedKeysCount: number;
    supabaseCleaned: boolean;
  }> {
    migrateAndCleanupLegacyLocalStorage();

    // 1. Puxa antes para resgatar qualquer dado válido que esteja no servidor/Supabase
    await this.pullFromServer();

    const allLocal = getAllLocalSyncEntries();
    const nonEmpty: Record<string, string> = {};
    for (const [k, val] of Object.entries(allLocal)) {
      if (isNonEmptySerialized(val)) {
        nonEmpty[k] = val;
      }
    }

    let cleanedKeysCount = LEGACY_KEYS_TO_REMOVE.length;

    // 2. Limpa chaves legadas no servidor /api/sync e força publicação de todas as chaves atuais (incluindo listas de classificação!)
    await sendEntriesBatch(nonEmpty, true, true, LEGACY_KEYS_TO_REMOVE);

    // 3. Se o Supabase estiver configurado, limpa TODOS os dados do outro site e chaves obsoletas, e publica tudo em public.configuracoes
    let supabaseCleaned = false;
    const cfg = resolveSupabaseConfig();
    if (cfg) {
      try {
        // 3.1 Buscar todas as chaves existentes em public.configuracoes para remover qualquer chave de outro site (!certam_*) ou legada
        const getRes = await fetch(`${cfg.url}/rest/v1/configuracoes?select=*`, {
          method: 'GET',
          headers: getSupabaseHeaders(cfg.anonKey),
          cache: 'no-store',
        });
        if (getRes.ok) {
          const rows = await getRes.json();
          if (Array.isArray(rows)) {
            const keysToPurge: string[] = [];
            for (const r of rows) {
              const k = String(r?.chave || '');
              if (!k) continue;
              if (
                !k.startsWith('certam_') ||
                k in LEGACY_KEY_MIGRATIONS ||
                k === '_test_ping' ||
                k === 'certam_diag_heartbeat' ||
                /^certam_candidatos_data_v[1-5]_/.test(k) ||
                k.includes('tjrs_2024') ||
                k.includes('mprs_2024')
              ) {
                keysToPurge.push(k);
              }
            }
            for (const purgeKey of keysToPurge) {
              await fetch(
                `${cfg.url}/rest/v1/configuracoes?chave=eq.${encodeURIComponent(purgeKey)}`,
                {
                  method: 'DELETE',
                  headers: getSupabaseHeaders(cfg.anonKey),
                }
              ).catch(() => {});
              cleanedKeysCount++;
            }
          }
        }

        // 3.2 Esvaziar registros de tabelas do outro site caso ainda não tenham sido excluídas com DROP TABLE no SQL Editor
        for (const oldTable of ['respostas', 'lotes', 'concursos', 'candidatos_base']) {
          await fetch(`${cfg.url}/rest/v1/${oldTable}?id=not.is.null`, {
            method: 'DELETE',
            headers: getSupabaseHeaders(cfg.anonKey),
          }).catch(() => {});
        }
        await fetch(`${cfg.url}/rest/v1/comarcas_tjrs?nome=not.is.null`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        }).catch(() => {});

        // 3.3 Publicar todas as chaves atuais do CERTAM em public.configuracoes
        supabaseCleaned = await pushEntriesToSupabase(nonEmpty);
      } catch {
        supabaseCleaned = false;
      }
    }

    return {
      cleanedKeysCount,
      publishedKeysCount: Object.keys(nonEmpty).length,
      supabaseCleaned,
    };
  },

  // PLANO 7 — Monitor de Limites Gratuitos (Supabase & Vercel) + Backup Completo em 1 Clique + Keep-Alive
  getQuotaAndSyncMetrics(): QuotaAndSyncMetrics {
    const allEntries = getAllLocalSyncEntries();
    const keys = Object.keys(allEntries);
    let totalBytes = 0;
    for (const k of keys) {
      totalBytes += (allEntries[k] || '').length;
    }
    const totalStorageMB = Number((totalBytes / (1024 * 1024)).toFixed(2));
    const supabaseFreeDbLimitMB = 500;
    const supabaseDbUsagePercent = Number(
      Math.min(100, (totalStorageMB / supabaseFreeDbLimitMB) * 100).toFixed(2)
    );

    return {
      totalKeys: keys.length,
      totalStorageBytes: totalBytes,
      totalStorageMB,
      supabaseFreeDbLimitMB,
      supabaseDbUsagePercent,
      deltaPollsCount: syncTelemetry.deltaPollsCount,
      keysSkippedByDelta: syncTelemetry.keysSkippedByDelta,
      estimatedMBDownloaded: Number((syncTelemetry.estimatedBytesDownloaded / (1024 * 1024)).toFixed(2)),
      estimatedMBSaved: Number((syncTelemetry.estimatedBytesSaved / (1024 * 1024)).toFixed(2)),
      indexedDbActive: syncTelemetry.indexedDbActive,
      localApiSkippedInStaticMode: localApiAvailable === false,
      lastKeepAliveAt: syncTelemetry.lastKeepAliveAt,
    };
  },

  exportFullBackupJson(): string {
    const entries = getAllLocalSyncEntries();
    const payload = {
      app: 'CERTAM',
      version: 'v6',
      exportedAt: new Date().toISOString(),
      totalKeys: Object.keys(entries).length,
      entries,
    };
    return JSON.stringify(payload, null, 2);
  },

  async importFullBackupJson(rawJson: string): Promise<{ ok: boolean; restoredKeys: number; error?: string }> {
    try {
      const parsed = JSON.parse(rawJson);
      const rawEntries: Record<string, any> =
        parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object'
          ? parsed.entries
          : parsed;

      if (!rawEntries || typeof rawEntries !== 'object' || Array.isArray(rawEntries)) {
        return { ok: false, restoredKeys: 0, error: 'Formato de arquivo JSON inválido.' };
      }

      const cleanEntries: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawEntries)) {
        const canonicalKey = LEGACY_KEY_MIGRATIONS[k] || k;
        if (!shouldSyncKey(canonicalKey)) continue;
        const serialized = typeof v === 'string' ? v : JSON.stringify(v);
        const sanitized = sanitizeSyncValue(canonicalKey, serialized) || serialized;
        if (isNonEmptySerialized(sanitized)) {
          cleanEntries[canonicalKey] = sanitized;
          memoryStore.set(canonicalKey, sanitized);
          lastLocalWriteAt.set(canonicalKey, Date.now());
          safeLocalStorageSet(canonicalKey, sanitized);
        }
      }

      const restoredKeys = Object.keys(cleanEntries).length;
      if (restoredKeys === 0) {
        return { ok: false, restoredKeys: 0, error: 'Nenhuma chave válida do CERTAM encontrada no backup.' };
      }

      await sendEntriesBatch(cleanEntries, true);
      dispatchUpdateEvents(Object.keys(cleanEntries));
      return { ok: true, restoredKeys };
    } catch (err: any) {
      return {
        ok: false,
        restoredKeys: 0,
        error: err?.message || 'Erro ao processar arquivo de backup JSON.',
      };
    }
  },

  async triggerKeepAlivePing(): Promise<boolean> {
    const cfg = resolveSupabaseConfig();
    if (!cfg) return false;
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch(`${cfg.url}/rest/v1/configuracoes?select=chave&limit=1`, {
        method: 'GET',
        headers: getSupabaseHeaders(cfg.anonKey),
        cache: 'no-store',
      });
      if (res.ok) {
        syncTelemetry.lastKeepAliveAt = nowIso;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  initAutoSync(): void {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    migrateAndCleanupLegacyLocalStorage();
    void idbHydrateMemoryStore().finally(() => {
      this.pullFromServer().then(() => {
        this.pushAllLocal();
      });
      void this.triggerKeepAlivePing();
    });

    // Polling adaptativo por visibilidade: só consulta em segundo plano quando a aba está visível
    window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      this.pullFromServer();
    }, SYNC_INTERVAL_MS);

    window.addEventListener('focus', () => {
      this.pullFromServer();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pullFromServer();
      }
    });
  },
};
