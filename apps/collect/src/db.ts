import { openDB } from 'idb';
export const dbPromise = openDB('spars-collector', 1, {
  upgrade(db) {
    db.createObjectStore('kv');
    db.createObjectStore('packages', { keyPath: 'toolVersionId' });
  }
});
export async function setKv(key: string, value: any) { const db = await dbPromise; await db.put('kv', value, key); }
export async function getKv<T>(key: string): Promise<T|undefined> { const db = await dbPromise; return (await db.get('kv', key)) as any; }
