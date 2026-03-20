import { openDB } from 'idb';

export const dbPromise = openDB('spars-collector', 3, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    if (!db.objectStoreNames.contains('packages')) db.createObjectStore('packages', { keyPath: 'toolVersionId' });
    if (!db.objectStoreNames.contains('draftVisits')) db.createObjectStore('draftVisits', { keyPath: 'localId' });
    if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id' });
  },
});

export async function setKv(key: string, value: any) {
  const db = await dbPromise;
  await db.put('kv', value, key);
}
export async function getKv<T>(key: string): Promise<T | undefined> {
  const db = await dbPromise;
  return (await db.get('kv', key)) as any;
}

export async function savePackage(toolVersionId: string, pkg: any) {
  const db = await dbPromise;
  await db.put('packages', { toolVersionId, pkg, savedAt: new Date().toISOString() });
}
export async function getPackage(toolVersionId: string): Promise<any | undefined> {
  const db = await dbPromise;
  return db.get('packages', toolVersionId);
}
export async function listPackages(): Promise<any[]> {
  const db = await dbPromise;
  return db.getAll('packages');
}

export async function saveDraftVisit(draft: any) {
  const db = await dbPromise;
  await db.put('draftVisits', draft);
}
export async function getDraftVisit(localId: string): Promise<any | undefined> {
  const db = await dbPromise;
  return db.get('draftVisits', localId);
}
export async function listDraftVisits(): Promise<any[]> {
  const db = await dbPromise;
  return db.getAll('draftVisits');
}

export async function enqueueSync(item: any) {
  const db = await dbPromise;
  await db.put('syncQueue', item);
}
export async function listSyncQueue(): Promise<any[]> {
  const db = await dbPromise;
  return db.getAll('syncQueue');
}
export async function removeSyncItem(id: string) {
  const db = await dbPromise;
  await db.delete('syncQueue', id);
}
