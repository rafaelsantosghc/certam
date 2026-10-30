const SYNC_INTERVAL_MS = 3500;
let initialized = false;
let activePullPromise: Promise<boolean> | null = null;

const memoryStore = new Map<string, string>();
const lastLocalWriteAt = new Map<string, number>();
const knownServerVersions = new Map<string, number>();

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
  SUPABASE_CONFIG_KEY,
];

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
  SUPABASE_CONFIG_KEY,
];

const APPEND_QUEUE_PREFIXES = [
  'certam_perfil_audit_',
  'certam_audit_',
  'certam_vinculacao_',
  'certam_vinculacoes_',
  'certam_contact_',
  'certam_notifications_',
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
]);

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

function shouldSyncKey(key: string): boolean {
  if (key in LEGACY_KEY_MIGRATIONS || key === '_test_ping' || key === 'certam_diag_heartbeat') {
    return false;
  }
  if (/^certam_candidatos_data_v[1-5]_/.test(key)) {
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
  } else if (
    isResolvedModerationStatus(incomingItem?.status) &&
    (existingItem?.status === 'pendente' || existingItem?.status === 'aberto')
  ) {
    merged.status = incomingItem.status;
  }
  return merged;
}

function resolveSupabaseConfig(): SupabaseConnectionConfig | null {
  try {
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.trim?.() || '';
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim?.() || '';
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

    // Higieniza também as chaves atuais caso contenham tjrs_2024 em cache no navegador
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
        k.includes('_tjrs_2024_')
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
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    migrateAndCleanupLegacyLocalStorage();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      if (isPriorityKey(key) || key.startsWith('certam_auth_')) {
        try {
          const bulkKeys: { k: string; len: number }[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('certam_candidatos_') || k.startsWith('certam_users_'))) {
              const v = localStorage.getItem(k) || '';
              memoryStore.set(k, v);
              bulkKeys.push({ k, len: v.length });
            }
          }
          bulkKeys.sort((a, b) => b.len - a.len);
          for (const item of bulkKeys) {
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

async function pushEntriesToSupabase(entries: Record<string, string>): Promise<boolean> {
  const cfg = resolveSupabaseConfig();
  syncStatus.supabaseConfigured = Boolean(cfg);
  syncStatus.supabaseUrl = cfg?.url || '';
  if (!cfg) return false;

  const keys = Object.keys(entries).filter((k) => k !== SUPABASE_CONFIG_KEY && shouldSyncKey(k));
  if (keys.length === 0) return true;

  const nowIso = new Date().toISOString();
  const rows = keys.map((chave) => {
    const cleanStr = sanitizeSyncValue(chave, entries[chave]) || entries[chave];
    let parsedValor: any = cleanStr;
    try {
      parsedValor = JSON.parse(cleanStr);
    } catch {
      parsedValor = cleanStr;
    }
    return {
      chave,
      valor: parsedValor,
      updated_at: nowIso,
    };
  });

  try {
    const res = await fetch(`${cfg.url}/rest/v1/configuracoes?on_conflict=chave`, {
      method: 'POST',
      headers: getSupabaseHeaders(cfg.anonKey, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      syncStatus.lastSupabaseOk = false;
      syncStatus.lastSupabaseError = `Erro ao gravar em configuracoes (${res.status}): ${errText.slice(0, 180)}`;
      return false;
    }

    if (entries['certam_concursos_cargos_v6']) {
      try {
        const cleanConcStr =
          sanitizeSyncValue('certam_concursos_cargos_v6', entries['certam_concursos_cargos_v6']) ||
          '[]';
        const concursosArr = JSON.parse(cleanConcStr);
        if (Array.isArray(concursosArr) && concursosArr.length > 0) {
          const concursoRows = concursosArr
            .filter((c: any) => c && c.id && c.nome)
            .map((c: any) => ({
              id: String(c.id),
              nome: String(c.nome),
              cargo: Array.isArray(c.cargos)
                ? c.cargos.map((cg: any) => cg.nome).join(', ')
                : String(c.cargo || ''),
              orgao: String(c.orgao || c.banca || 'TJRS'),
              ativo: c.status !== 'suspenso',
            }));
          if (concursoRows.length > 0) {
            await fetch(`${cfg.url}/rest/v1/concursos?on_conflict=id`, {
              method: 'POST',
              headers: getSupabaseHeaders(cfg.anonKey, {
                Prefer: 'resolution=merge-duplicates,return=minimal',
              }),
              body: JSON.stringify(concursoRows),
            }).catch(() => {});
          }
        }
      } catch {
        // ignore mirror error
      }
    }

    syncStatus.lastSupabaseOk = true;
    syncStatus.lastSupabaseError = null;
    syncStatus.lastPushAt = nowIso;
    return true;
  } catch (err: any) {
    syncStatus.lastSupabaseOk = false;
    syncStatus.lastSupabaseError = err?.message || 'Falha de rede ao conectar ao Supabase';
    return false;
  }
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
    const res = await fetch(`${cfg.url}/rest/v1/configuracoes?select=chave,valor,updated_at`, {
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
        if (rawKey === '_test_ping' || rawKey === 'certam_diag_heartbeat') continue;
        const canonicalKey = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
        const rawSerialized =
          typeof row.valor === 'string' ? row.valor : JSON.stringify(row.valor ?? null);
        const serialized = sanitizeSyncValue(canonicalKey, rawSerialized);
        const ts = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();

        if (!isNonEmptySerialized(serialized)) continue;

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
      syncStatus.lastLocalApiOk = false;
    }
  }

  for (const bk of bulkKeys) {
    const cleanVal = sanitizeSyncValue(bk, entries[bk]);
    if (!cleanVal) continue;
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: { [bk]: cleanVal }, forceReplace }),
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
}

async function executePullFromServer(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    migrateAndCleanupLegacyLocalStorage();
    const isCurrentUserAdmin = isAdminSession();

    let localApiEntries: Record<string, string> = {};
    let localApiVersions: Record<string, number> = {};

    try {
      const res = await fetch('/api/sync', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        syncStatus.lastLocalApiOk = true;
        const data = await res.json();
        localApiEntries = data?.entries || {};
        localApiVersions = data?.versions || {};
      } else {
        syncStatus.lastLocalApiOk = false;
      }
    } catch {
      syncStatus.lastLocalApiOk = false;
    }

    // Fallback para arquivo estático /certam_sync_db.json caso /api/sync não esteja rodando (ex: deploy estático)
    if (!syncStatus.lastLocalApiOk) {
      try {
        const snapRes = await fetch('/certam_sync_db.json', { cache: 'no-store' });
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (snapData?.entries && typeof snapData.entries === 'object') {
            localApiEntries = snapData.entries;
            localApiVersions = snapData.versions || {};
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

    const entries: Record<string, string> = {};
    const serverVersions: Record<string, number> = {};

    for (const [k, rawVal] of Object.entries(localApiEntries)) {
      const cleanVal = sanitizeSyncValue(k, rawVal);
      if (cleanVal !== null) {
        entries[k] = cleanVal;
        serverVersions[k] = localApiVersions[k] || 0;
      }
    }

    if (supabaseData) {
      for (const [k, rawSupVal] of Object.entries(supabaseData.entries)) {
        const supVal = sanitizeSyncValue(k, rawSupVal);
        if (!supVal) continue;
        const supVer = supabaseData.versions[k] || 0;
        const locSrvVal = entries[k];
        const locSrvVer = serverVersions[k] || 0;

        if (!isNonEmptySerialized(locSrvVal)) {
          entries[k] = supVal;
          serverVersions[k] = supVer;
        } else if (supVal !== locSrvVal) {
          if (ADMIN_AUTHORITATIVE_KEYS.has(k)) {
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

    // 1. Se o usuário conectado for o ADMIN, suas bases autoritativas locais (Concursos, Lotes, FAQs) prevalecem e são publicadas para todos!
    for (const [localKey, localVal] of Object.entries(allLocal)) {
      if (!isNonEmptySerialized(localVal)) continue;
      if (ADMIN_AUTHORITATIVE_KEYS.has(localKey)) {
        if (isCurrentUserAdmin) {
          const srvVal = entries[localKey];
          if (srvVal !== localVal) {
            toForcePushAdmin[localKey] = localVal;
          }
        }
        continue;
      }

      const srvVal = entries[localKey];
      const supVal = supabaseData?.entries?.[localKey];
      if (!isNonEmptySerialized(srvVal) || (supabaseData && !isNonEmptySerialized(supVal))) {
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
          if (!ADMIN_AUTHORITATIVE_KEYS.has(k) || isCurrentUserAdmin) {
            toPushBack[k] = localVal;
          }
        }
        continue;
      }

      // REGRA DE AUTORIDADE PARA CONCURSOS, LOTES E FAQs:
      if (ADMIN_AUTHORITATIVE_KEYS.has(k)) {
        if (isCurrentUserAdmin) {
          // Se o Admin já tem dados locais para esta chave, o Admin é a fonte da verdade
          if (isNonEmptySerialized(localVal)) {
            if (localVal !== serverVal) {
              toForcePushAdmin[k] = localVal;
            }
            if (srvVer) knownServerVersions.set(k, srvVer);
            continue;
          }
          // Se o Admin está em um navegador novo sem dados locais, adota os do servidor
          memoryStore.set(k, serverVal);
          safeLocalStorageSet(k, serverVal);
          if (srvVer) knownServerVersions.set(k, srvVer);
          changedKeys.push(k);
          continue;
        } else {
          // Usuário comum ou visitante: adota 100% a lista oficial do servidor (nunca mantém lixo antigo do localStorage)
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

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: { [canonicalKey]: strValue },
          forceReplace: Boolean(forceReplace) || ADMIN_AUTHORITATIVE_KEYS.has(canonicalKey),
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
      syncStatus.lastLocalApiOk = false;
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
        // Usuários comuns nunca sobem chaves exclusivas da administração (Concursos, Lotes, FAQ)
        if (!isCurrentUserAdmin && ADMIN_AUTHORITATIVE_KEYS.has(k)) {
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
    await this.pushAllLocal(false);
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
      report.localApi.latencyMs = Math.round(performance.now() - t0);
      if (res.ok) {
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

        // Roundtrip write/read test
        const postRes = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: {} }),
        });
        report.localApi.roundtripOk = postRes.ok;
      } else {
        report.localApi.error = `HTTP ${res.status}`;
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

    const tablesToCheck = [
      'configuracoes',
      'concursos',
      'lotes',
      'respostas',
      'candidatos_base',
      'comarcas_tjrs',
    ];

    for (const table of tablesToCheck) {
      const st = performance.now();
      try {
        const selectParam = table === 'configuracoes' ? 'chave,updated_at' : 'id';
        const res = await fetch(`${cfg.url}/rest/v1/${table}?select=${selectParam}`, {
          method: 'GET',
          headers: getSupabaseHeaders(cfg.anonKey),
          cache: 'no-store',
        });
        const latencyMs = Math.round(performance.now() - st);
        if (res.ok) {
          const rows = await res.json();
          const rowCount = Array.isArray(rows) ? rows.length : 0;
          const conflictKeys: string[] = [];
          const sampleKeys: string[] = [];

          if (table === 'configuracoes' && Array.isArray(rows)) {
            for (const r of rows) {
              if (r?.chave) {
                sampleKeys.push(String(r.chave));
                if (
                  r.chave in LEGACY_KEY_MIGRATIONS ||
                  r.chave === '_test_ping' ||
                  /^certam_candidatos_data_v[1-5]_/.test(r.chave)
                ) {
                  conflictKeys.push(String(r.chave));
                  report.supabase.conflictsFound.push(`configuracoes.${r.chave}`);
                }
              }
            }
          }
          if (table === 'concursos' && Array.isArray(rows)) {
            for (const r of rows) {
              if (r?.id) {
                sampleKeys.push(String(r.id));
                if (r.id === 'tjrs_analista_2024') {
                  conflictKeys.push('tjrs_analista_2024 (seed legado)');
                  report.supabase.conflictsFound.push('concursos.tjrs_analista_2024');
                }
              }
            }
          }

          report.supabase.tables.push({
            table,
            ok: true,
            rowCount,
            latencyMs,
            conflictKeys,
            sampleKeys,
          });
        } else {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          report.supabase.tables.push({
            table,
            ok: false,
            rowCount: 0,
            latencyMs,
            error: `HTTP ${res.status}: ${errText.slice(0, 140)}`,
          });
        }
      } catch (err: any) {
        report.supabase.tables.push({
          table,
          ok: false,
          rowCount: 0,
          latencyMs: Math.round(performance.now() - st),
          error: err?.message || 'Erro de rede',
        });
      }
    }

    const configTable = report.supabase.tables.find((t) => t.table === 'configuracoes');
    report.supabase.connected = Boolean(configTable?.ok);

    // Teste real de Escrita + Leitura + Limpeza no Supabase
    if (report.supabase.connected) {
      try {
        const testToken = `ok_${Date.now()}`;
        const writeRes = await fetch(`${cfg.url}/rest/v1/configuracoes?on_conflict=chave`, {
          method: 'POST',
          headers: getSupabaseHeaders(cfg.anonKey, {
            Prefer: 'resolution=merge-duplicates,return=representation',
          }),
          body: JSON.stringify([
            {
              chave: 'certam_diag_heartbeat',
              valor: { status: testToken, testedAt: timestamp },
              updated_at: timestamp,
            },
          ]),
        });
        if (writeRes.ok) {
          report.supabase.roundtripOk = true;
          // Remove chave de teste para manter a tabela limpa
          await fetch(`${cfg.url}/rest/v1/configuracoes?chave=eq.certam_diag_heartbeat`, {
            method: 'DELETE',
            headers: getSupabaseHeaders(cfg.anonKey),
          }).catch(() => {});
        } else {
          const errText = await writeRes.text().catch(() => '');
          report.supabase.error = `Falha na escrita (${writeRes.status}): ${errText.slice(0, 140)}`;
        }
      } catch (err: any) {
        report.supabase.error = err?.message || 'Falha no teste de escrita no Supabase';
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

    // 1. Puxa antes para resgatar qualquer dado que esteja apenas no servidor/Supabase sob chave legada
    await this.pullFromServer();

    const allLocal = getAllLocalSyncEntries();
    const nonEmpty: Record<string, string> = {};
    for (const [k, val] of Object.entries(allLocal)) {
      if (isNonEmptySerialized(val)) {
        nonEmpty[k] = val;
      }
    }

    // 2. Limpa chaves legadas no servidor /api/sync e força publicação das chaves atuais
    await sendEntriesBatch(nonEmpty, true, true, LEGACY_KEYS_TO_REMOVE);

    // 3. Se o Supabase estiver configurado, limpa chaves legadas em public.configuracoes e o registro legado em public.concursos
    let supabaseCleaned = false;
    const cfg = resolveSupabaseConfig();
    if (cfg) {
      try {
        const inList = LEGACY_KEYS_TO_REMOVE.map((k) => `"${k}"`).join(',');
        await fetch(`${cfg.url}/rest/v1/configuracoes?chave=in.(${encodeURIComponent(inList)})`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        });
        await fetch(`${cfg.url}/rest/v1/concursos?id=eq.tjrs_analista_2024`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        });
        supabaseCleaned = await pushEntriesToSupabase(nonEmpty);
      } catch {
        supabaseCleaned = false;
      }
    }

    return {
      cleanedKeysCount: LEGACY_KEYS_TO_REMOVE.length,
      publishedKeysCount: Object.keys(nonEmpty).length,
      supabaseCleaned,
    };
  },

  initAutoSync(): void {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    migrateAndCleanupLegacyLocalStorage();
    this.pullFromServer().then(() => {
      this.pushAllLocal();
    });
    window.setInterval(() => {
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

