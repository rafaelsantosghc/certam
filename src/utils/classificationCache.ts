import { Candidato } from '../types';

const DB_NAME = 'certam_cache_db';
const STORE_NAME = 'classification_cache';
const DB_VERSION = 1;
const TTL_MS = 10 * 60 * 1000; // 10 minutes short-term persistence

interface CacheItem {
  key: string;
  data: Candidato[];
  timestamp: number;
}

export const classificationCache = {
  async openDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) return null;
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  },

  async get(concursoId: string, cargoId: string): Promise<Candidato[] | null> {
    const cacheKey = `${concursoId}_${cargoId}`;
    try {
      const db = await this.openDB();
      if (db) {
        return new Promise((resolve) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(cacheKey);
          request.onerror = () => resolve(null);
          request.onsuccess = () => {
            const item = request.result as CacheItem;
            if (item && Date.now() - item.timestamp < TTL_MS) {
              resolve(item.data);
            } else {
              resolve(null);
            }
          };
        });
      }
    } catch {
      // Fallback to localStorage
    }

    try {
      const raw = localStorage.getItem(`certam_cache_${cacheKey}`);
      if (raw) {
        const item: CacheItem = JSON.parse(raw);
        if (item && Date.now() - item.timestamp < TTL_MS) {
          return item.data;
        }
      }
    } catch {}

    return null;
  },

  async set(concursoId: string, cargoId: string, data: Candidato[]): Promise<void> {
    const cacheKey = `${concursoId}_${cargoId}`;
    const item: CacheItem = {
      key: cacheKey,
      data,
      timestamp: Date.now(),
    };

    try {
      const db = await this.openDB();
      if (db) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(item);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
        return;
      }
    } catch {}

    try {
      localStorage.setItem(`certam_cache_${cacheKey}`, JSON.stringify(item));
    } catch {}
  },
};
