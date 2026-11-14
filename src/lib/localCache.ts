/**
 * Lokalna kopia danych do trybu offline (docs/OFFLINE_PLAN.md, etap 2).
 *
 * Osobny magazyn w IndexedDB, niezależny od cache'u service workera: tamten trzyma
 * powłokę aplikacji, ten — dane użytkownika pobrane z Supabase. Prosty słownik
 * klucz → wartość; każdy błąd (tryb prywatny, brak miejsca, zablokowane dane witryny)
 * kończy się cicho, bo aplikacja online ma działać także bez kopii.
 */

const DB_NAME = 'bridgeloop-offline';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(db => new Promise<T | null>(resolve => {
    if (!db) { resolve(null); return; }
    try {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      // Zapis jest pewny dopiero po zatwierdzeniu transakcji, nie po `onsuccess` żądania.
      tx.oncomplete = () => resolve(req.result ?? null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

export function cacheGet<T>(key: string): Promise<T | null> {
  return run<T>('readonly', s => s.get(key) as IDBRequest<T>);
}

export async function cachePut(key: string, value: unknown): Promise<void> {
  await run('readwrite', s => s.put(value, key));
}

export async function cacheDelete(key: string): Promise<void> {
  await run('readwrite', s => s.delete(key));
}

/** Klucze kopii jednego konta. Rozdania też są per konto: admin widzi zarchiwizowane, reszta nie. */
export const cacheKeys = {
  profile: (userId: string) => `profile:${userId}`,
  deals: (userId: string) => `deals:${userId}`,
  srs: (userId: string) => `srs:${userId}`,
  attempts: (userId: string) => `attempts:${userId}`,
  session: (userId: string) => `session:${userId}`,
};

/** Kasuje całą kopię konta — przy wylogowaniu i po cofnięciu dostępu (O4, O7). */
export async function cacheClearUser(userId: string): Promise<void> {
  await Promise.all(Object.values(cacheKeys).map(key => cacheDelete(key(userId))));
}

/**
 * Prosi przeglądarkę, żeby nie kasowała kopii przy braku miejsca. Bez gwarancji —
 * na iPhonie realną ochroną jest instalacja na ekranie początkowym.
 */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // brak API — nic do zrobienia
  }
}
