import { SURFACE_APPEARANCE, LANDSCAPE, AIRCRAFT } from './config.js';

export const SURFACE_CACHE_FORMAT_VERSION = 1;

// 仅缓存可重建的像素和几何；键同时约束项目、版本、关卡、种子及生成配置。
export class SurfaceCache {
  constructor(levelId, manifest) {
    const configuration = JSON.stringify({surface: SURFACE_APPEARANCE, terrain: LANDSCAPE.terrain, aircraft: AIRCRAFT, seed: LANDSCAPE.seed});
    let hash = 2166136261;
    for (const character of configuration) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    this.scope = `cloud-cockpit/${levelId}/`;
    this.prefix = `${this.scope}${SURFACE_APPEARANCE.generatorVersion}/${hash >>> 0}/${SURFACE_APPEARANCE.seed}/`;
    this.resources = new Map(manifest.map(([name, configuration]) => {
      let signature = 2166136261;
      for (const character of JSON.stringify({format: SURFACE_CACHE_FORMAT_VERSION, generator: SURFACE_APPEARANCE.generatorVersion, configuration})) {
        signature = Math.imul(signature ^ character.charCodeAt(0), 16777619);
      }
      return [name, `${this.scope}resource/${name}/${signature >>> 0}`];
    }));
    this.available = true; this.ready = this.open();
  }

  open() {
    return new Promise(resolve => {
      let settled = false;
      const finish = database => {
        if (settled) { database?.close(); return; }
        settled = true; clearTimeout(timer); this.database = database; this.available = Boolean(database); resolve();
      };
      const timer = setTimeout(() => finish(null), SURFACE_APPEARANCE.cacheOpenTimeoutMs);
      try {
        const request = indexedDB.open('cloud-cockpit-generated', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('assets');
        request.onerror = request.onblocked = () => finish(null);
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close(); this.available = false; };
          finish(database);
        };
      } catch { finish(null); }
    });
  }

  prune() {
    if (!this.available) return Promise.resolve(false);
    return new Promise(resolve => {
      try {
        const transaction = this.database.transaction('assets', 'readwrite'), store = transaction.objectStore('assets');
        const cursor = store.openKeyCursor(IDBKeyRange.bound(this.scope, this.scope + '\uffff'));
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          if (![...this.resources.values()].some(key => entry.key === key || entry.key.startsWith(key + '/'))) store.delete(entry.key);
          entry.continue();
        };
        transaction.oncomplete = () => resolve(true);
        transaction.onabort = transaction.onerror = () => { this.available = false; resolve(false); };
      } catch { this.available = false; resolve(false); }
    });
  }

  key(name) {
    const resource = name.split('/').slice(0, 2).join('/'), prefix = this.resources.get(resource);
    if (!prefix) throw new Error(`Unknown generated resource: ${name}`);
    return prefix + name.slice(resource.length);
  }

  async read(name) {
    const key = this.key(name), current = await this.request(key, undefined, false);
    if (current !== undefined || !this.available) return current;
    // 旧版整组配置键只在配置完全相同的情况下迁移，不重算兼容数据。
    const previous = await this.request(this.prefix + name, undefined, false);
    if (previous !== undefined) await this.request(key, previous, true);
    return previous;
  }

  write(name, value) { return this.request(this.key(name), value, true); }
  readVersion() { return this.request('cloud-cockpit/meta/completed-version', undefined, false); }
  writeVersion(value) { return this.request('cloud-cockpit/meta/completed-version', value, true); }

  request(name, value, write) {
    if (!this.available) return Promise.resolve(undefined);
    return new Promise(resolve => {
      try {
        const transaction = this.database.transaction('assets', write ? 'readwrite' : 'readonly'), store = transaction.objectStore('assets');
        const request = write ? store.put(value, name) : store.get(name);
        let result;
        request.onsuccess = () => { result = write ? true : request.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () => { this.available = false; resolve(undefined); };
      } catch { this.available = false; resolve(undefined); }
    });
  }
}
