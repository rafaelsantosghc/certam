const SYNC_INTERVAL_MS = 4000;
let initialized = false;
let isPulling = false;

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

function shouldSyncKey(key: string): boolean {
  return SYNC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export const cloudSync = {
  async pushKey(key: string, value: any, forceReplace?: string | boolean): Promise<void> {
    if (isPulling || typeof window === 'undefined') return;
    try {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: { [key]: strValue },
          forceReplace: Boolean(forceReplace),
        }),
      });
    } catch {
      // Ignore network errors in offline mode
    }
  },

  async pushAllLocal(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const entries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && shouldSyncKey(k)) {
          const val = localStorage.getItem(k);
          if (val && val !== '[]' && val !== '{}') {
            entries[k] = val;
          }
        }
      }
      if (Object.keys(entries).length > 0) {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });
      }
    } catch {
      // Ignore network errors
    }
  },

  async pullFromServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const res = await fetch('/api/sync');
      if (!res.ok) return false;
      const data = await res.json();
      const entries: Record<string, string> = data?.entries || {};
      const changedKeys: string[] = [];

      isPulling = true;
      for (const [k, serverVal] of Object.entries(entries)) {
        if (!shouldSyncKey(k) || typeof serverVal !== 'string') continue;
        const localVal = localStorage.getItem(k);
        if (localVal !== serverVal) {
          if ((serverVal === '[]' || serverVal === '{}') && localVal && localVal.length > 2) {
            continue;
          }
          if (localVal && localVal.startsWith('[') && serverVal.startsWith('[')) {
            try {
              const localArr = JSON.parse(localVal);
              const serverArr = JSON.parse(serverVal);
              if (Array.isArray(localArr) && Array.isArray(serverArr)) {
                const hasKeyedItems =
                  localArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email)) &&
                  serverArr.every((item: any) => item && typeof item === 'object' && (item.id || item.email));
                if (hasKeyedItems) {
                  const map = new Map<string, any>();
                  localArr.forEach((item: any) => {
                    const itemKey = item.id || item.email;
                    map.set(String(itemKey), item);
                  });
                  serverArr.forEach((item: any) => {
                    const itemKey = item.id || item.email;
                    const prev = map.get(String(itemKey));
                    map.set(String(itemKey), prev ? { ...prev, ...item } : item);
                  });
                  const mergedStr = JSON.stringify(Array.from(map.values()));
                  if (mergedStr !== localVal) {
                    localStorage.setItem(k, mergedStr);
                    changedKeys.push(k);
                  }
                  continue;
                }
              }
            } catch {
              // Fallback to serverVal
            }
          }
          if (localVal && localVal.startsWith('{') && serverVal.startsWith('{')) {
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
                  localStorage.setItem(k, mergedStr);
                  changedKeys.push(k);
                }
                continue;
              }
            } catch {
              // Fallback to serverVal
            }
          }
          localStorage.setItem(k, serverVal);
          changedKeys.push(k);
        }
      }
      isPulling = false;

      if (changedKeys.length > 0) {
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
        }
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
