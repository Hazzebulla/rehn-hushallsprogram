"use client";

const DATABASE_NAME = "rvm-husstatus-drafts";
const STORE_NAME = "drafts";
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB saknas"));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB kunde inte öppnas"));
    request.onblocked = () => reject(new Error("IndexedDB är blockerad"));
  });
}

async function readIndexedDraft<T>(key: string) {
  const database = await openDatabase();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Utkastet kunde inte läsas"));
    });
  } finally {
    database.close();
  }
}

async function writeIndexedDraft<T>(key: string, value: T) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Utkastet kunde inte sparas"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Sparningen avbröts"));
    });
  } finally {
    database.close();
  }
}

async function deleteIndexedDraft(key: string) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Utkastet kunde inte tas bort"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Borttagningen avbröts"));
    });
  } finally {
    database.close();
  }
}

export function stripEmbeddedImageData<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripEmbeddedImageData(item)) as T;
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === "string" && typeof record.mimeType === "string") {
    return { ...record, dataUrl: "" } as T;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, stripEmbeddedImageData(item)]),
  ) as T;
}

export async function loadBrowserDraft<T>(key: string): Promise<T | null> {
  try {
    const indexed = await readIndexedDraft<T>(key);
    if (indexed) return indexed;
  } catch {
    // Safari private browsing and restricted webviews can reject IndexedDB.
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : null;
  } catch {
    return null;
  }
}

export async function saveBrowserDraft<T>(key: string, value: T): Promise<"indexeddb" | "localstorage" | "failed"> {
  try {
    await writeIndexedDraft(key, value);
    try {
      window.localStorage.setItem(key, JSON.stringify(stripEmbeddedImageData(value)));
    } catch {
      // IndexedDB is the authoritative draft when the small fallback is unavailable.
    }
    return "indexeddb";
  } catch {
    try {
      window.localStorage.setItem(key, JSON.stringify(stripEmbeddedImageData(value)));
      return "localstorage";
    } catch {
      return "failed";
    }
  }
}

export async function removeBrowserDraft(key: string) {
  try {
    await deleteIndexedDraft(key);
  } catch {
    // Continue and remove the fallback even if IndexedDB is unavailable.
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // There is no remaining recovery action when browser storage is unavailable.
  }
}
