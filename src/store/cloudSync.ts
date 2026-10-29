const SYNC_INTERVAL_MS = 3500;
let initialized = false;
let isPulling = false;

const memoryStore = new Map<string, string>();
const lastLocalWriteAt = new Map<string, number>();
const knownServerVersions = new Map<string, number>();

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
];

const APPEND_QUEUE_PREFIXES = [
  'certam_perfil_audit_',
  'certam_audit_',
  'certam_vinculacao_',
  'certam_vinculacoes_',
  'certam_contact_',
  'certam_notifications_',
];

const LEGACY_KEYS_TO_REMOVE = [
  'certam_concursos_cargos_v1',
  'certam_concursos_cargos_v2',
  'certam_concursos_cargos_v3',
  'certam_concursos_cargos_v4',
  'certam_lotes_data_v1',
  'certam_lotes_data_v2',
  'certam_lotes_data_v3',
  'certam_lotes_data_v4',
  'certam_lotes_data_v5',
  'certam_users_registry_v1',
  'certam_perfil_audit_requests_v4',
  'certam_vinculacao_requests_v4',
  'certam_contact_messages_v4',
  'certam_notifications_events_v4',
  'certam_faq_items_v1',
  'certam_faq_items_v2',
  'certam_faq_items_v3',
  'certam_faq_items_v4',
  'certam_faq_items_v5',
  '_test_ping',
];

function shouldSyncKey(key: string): boolean {
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

function cleanupLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const k of LEGACY_KEYS_TO_REMOVE) {
      localStorage.removeItem(k);
    }
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('certam_candidatos_data_v1_') ||
        k.startsWith('certam_candidatos_data_v2_') ||
        k.startsWith('certam_candidatos_data_v3_') ||
        k.startsWith('certam_candidatos_data_v4_') ||
        k.startsWith('certam_candidatos_data_v5_') ||
        k.startsWith('certam_chat_messages_v4_')
      ) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
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
    // QuotaExceededError: limpar chaves antigas primeiro
    cleanupLegacyLocalStorage();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // Se for uma chave prioritária (concursos, lotes, auditoria, contatos, auth), liberar espaço de listas massivas mantendo-as em memoryStore
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
              // continua liberando
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
          const val = localStorage.getItem(k);
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
      result[k] = v;
    }
  }
  return result;
}

async function sendEntriesBatch(
  entries: Record<string, string>,
  forceReplace = false
): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;

  const priorityBatch: Record<string, string> = {};
  const bulkKeys: string[] = [];

  for (const k of keys) {
    if (isPriorityKey(k)) {
      priorityBatch[k] = entries[k];
    } else {
      bulkKeys.push(k);
    }
  }

  if (Object.keys(priorityBatch).length > 0) {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: priorityBatch, forceReplace }),
      });
      if (res.ok) {
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

  for (const bk of bulkKeys) {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: { [bk]: entries[bk] }, forceReplace }),
      });
      if (res.ok) {
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

export const cloudSync = {
  getItem(key: string): string | null {
    if (memoryStore.has(key)) {
      return memoryStore.get(key) ?? null;
    }
    if (typeof window === 'undefined') return null;
    try {
      const val = localStorage.getItem(key);
      if (val !== null) {
        memoryStore.set(key, val);
      }
      return val;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: any, forceReplace?: boolean): void {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    memoryStore.set(key, strValue);
    lastLocalWriteAt.set(key, Date.now());
    safeLocalStorageSet(key, strValue);
    void this.pushKey(key, strValue, forceReplace);
  },

  async pushKey(key: string, value: any, forceReplace?: string | boolean): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      memoryStore.set(key, strValue);
      lastLocalWriteAt.set(key, Date.now());
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: { [key]: strValue },
          forceReplace: Boolean(forceReplace),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.versions && typeof data.versions === 'object') {
          for (const [vk, vv] of Object.entries(data.versions)) {
            if (typeof vv === 'number') knownServerVersions.set(vk, vv);
          }
        }
      }
    } catch {
      // Ignore network errors in offline mode
    }
  },

  async pushAllLocal(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const allLocal = getAllLocalSyncEntries();
      const nonEmpty: Record<string, string> = {};
      for (const [k, val] of Object.entries(allLocal)) {
        if (isNonEmptySerialized(val)) {
          nonEmpty[k] = val;
        }
      }
      await sendEntriesBatch(nonEmpty, false);
    } catch {
      // Ignore network errors
    }
  },

  async pullFromServer(): Promise<boolean> {
    if (typeof window === 'undefined' || isPulling) return false;
    isPulling = true;
    try {
      const res = await fetch('/api/sync', { cache: 'no-store' });
      if (!res.ok) {
        isPulling = false;
        return false;
      }
      const data = await res.json();
      const entries: Record<string, string> = data?.entries || {};
      const serverVersions: Record<string, number> = data?.versions || {};
      const changedKeys: string[] = [];
      const toPushBack: Record<string, string> = {};

      const allLocal = getAllLocalSyncEntries();

      // 1. Qualquer chave local não-vazia que ainda não exista no servidor (ou esteja vazia lá) deve ser publicada imediatamente!
      for (const [localKey, localVal] of Object.entries(allLocal)) {
        if (!isNonEmptySerialized(localVal)) continue;
        const srvVal = entries[localKey];
        if (!isNonEmptySerialized(srvVal)) {
          toPushBack[localKey] = localVal;
        }
      }

      // 2. Processar e mesclar chaves vindas do servidor
      for (const [k, serverVal] of Object.entries(entries)) {
        if (!shouldSyncKey(k) || typeof serverVal !== 'string') continue;

        const localVal = this.getItem(k);
        const srvVer = serverVersions[k] || 0;
        const prevKnownVer = knownServerVersions.get(k) || 0;
        const recentlyWrittenLocally = Date.now() - (lastLocalWriteAt.get(k) || 0) < 3500;

        if (!isNonEmptySerialized(serverVal)) {
          if (isNonEmptySerialized(localVal) && !recentlyWrittenLocally) {
            toPushBack[k] = localVal;
          }
          continue;
        }

        if (recentlyWrittenLocally && isNonEmptySerialized(localVal)) {
          // Protege escrita local recém-feita contra resposta antiga em trânsito
          if (localVal !== serverVal) {
            toPushBack[k] = localVal;
          }
          continue;
        }

        if (localVal === serverVal) {
          if (srvVer) knownServerVersions.set(k, srvVer);
          continue;
        }

        // Se o cliente não tem dados locais para esta chave, adota imediatamente o valor do servidor
        if (!isNonEmptySerialized(localVal)) {
          memoryStore.set(k, serverVal);
          safeLocalStorageSet(k, serverVal);
          if (srvVer) knownServerVersions.set(k, srvVer);
          changedKeys.push(k);
          continue;
        }

        // Se ambos possuem arrays JSON
        if (localVal.startsWith('[') && serverVal.startsWith('[')) {
          try {
            const localArr = JSON.parse(localVal);
            const serverArr = JSON.parse(serverVal);
            if (Array.isArray(localArr) && Array.isArray(serverArr)) {
              const hasKeyedItems =
                localArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email)) &&
                serverArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email));

              // Se o cliente já estava sincronizado com uma versão anterior do servidor e não é fila de append,
              // o servidor possui a edição/exclusão mais recente feita pelo admin
              if (prevKnownVer > 0 && srvVer >= prevKnownVer && !isAppendQueueKey(k)) {
                memoryStore.set(k, serverVal);
                safeLocalStorageSet(k, serverVal);
                knownServerVersions.set(k, srvVer);
                changedKeys.push(k);
                continue;
              }

              if (hasKeyedItems) {
                const map = new Map<string, any>();
                // Coloca os itens do servidor primeiro e mescla itens locais inéditos
                serverArr.forEach((item: any) => {
                  const itemKey = String(item.id || item.email);
                  map.set(itemKey, item);
                });
                let localHadExtraItems = false;
                localArr.forEach((item: any) => {
                  const itemKey = String(item.id || item.email);
                  if (!map.has(itemKey)) {
                    map.set(itemKey, item);
                    localHadExtraItems = true;
                  } else {
                    const srvItem = map.get(itemKey);
                    map.set(itemKey, { ...item, ...srvItem });
                  }
                });

                const mergedArr = Array.from(map.values());
                const mergedStr = JSON.stringify(mergedArr);

                if (mergedStr !== localVal) {
                  memoryStore.set(k, mergedStr);
                  safeLocalStorageSet(k, mergedStr);
                  changedKeys.push(k);
                }
                if (localHadExtraItems && mergedStr !== serverVal) {
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

        // Se ambos possuem objetos JSON (ex: certam_users_registry_v2)
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

      isPulling = false;

      if (changedKeys.length > 0) {
        dispatchUpdateEvents(changedKeys);
      }

      if (Object.keys(toPushBack).length > 0) {
        void sendEntriesBatch(toPushBack, false);
      }

      return changedKeys.length > 0;
    } catch {
      isPulling = false;
      return false;
    }
  },

  initAutoSync(): void {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    cleanupLegacyLocalStorage();
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
