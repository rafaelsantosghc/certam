const SYNC_INTERVAL_MS = 8000;
let initialized = false;
let isPulling = false;

const SYNC_PREFIXES = [
  'certam_concursos_',
  'certam_lotes_',
  'certam_candidatos_',
  'certam_users_',
  'certam_audit_',
  'certam_vinculacoes_',
  'certam_contact_',
  'certam_notifications_',
  'certam_faq_',
];

function shouldSyncKey(key: string): boolean {
  return SYNC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export const cloudSync = {
  async pushKey(key: string, value: any, extra?: string | boolean): Promise<void> {
    if (isPulling || typeof window === 'undefined') return;
    try {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: { [key]: strValue }, extra }),
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
          if (val) entries[k] = val;
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
                    map.set(String(itemKey), item);
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
          localStorage.setItem(k, serverVal);
          changedKeys.push(k);
        }
      }
      isPulling = false;

      if (changedKeys.length > 0) {
        if (changedKeys.some((k) => k.startsWith('certam_concursos_') || k.startsWith('certam_lotes_') || k.startsWith('certam_candidatos_'))) {
          window.dispatchEvent(new Event('storage'));
        }
        if (changedKeys.some((k) => k.startsWith('certam_audit_'))) {
          window.dispatchEvent(new Event('certam_audit_updated'));
        }
        if (changedKeys.some((k) => k.startsWith('certam_vinculacoes_'))) {
          window.dispatchEvent(new Event('certam_vinculacoes_updated'));
        }
        if (changedKeys.some((k) => k.startsWith('certam_contact_'))) {
          window.dispatchEvent(new Event('certam_contact_updated'));
        }
        if (changedKeys.some((k) => k.startsWith('certam_notifications_'))) {
          window.dispatchEvent(new Event('certam_notifications_updated'));
        }
        if (changedKeys.some((k) => k.startsWith('certam_users_'))) {
          window.dispatchEvent(new Event('certam_users_updated'));
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
  },
};
