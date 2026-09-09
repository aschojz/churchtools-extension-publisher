const DATABASE_NAME = 'churchtools-publisher-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'entries';

let databaseRequest: Promise<IDBDatabase | null> | null = null;

const openPublisherCache = (): Promise<IDBDatabase | null> => {
    if (databaseRequest) return databaseRequest;
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    databaseRequest = new Promise((resolve) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });
    return databaseRequest;
};

export const readPublisherBrowserCache = async <Value>(key: string): Promise<Value | null> => {
    const database = await openPublisherCache();
    if (!database) return null;
    return await new Promise((resolve) => {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve((request.result as Value | undefined) ?? null);
        request.onerror = () => resolve(null);
    });
};

export const writePublisherBrowserCache = async (key: string, value: unknown): Promise<boolean> => {
    const database = await openPublisherCache();
    if (!database) return false;
    return await new Promise((resolve) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(value, key);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
    });
};
