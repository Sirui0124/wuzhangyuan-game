import { mkdir, readFile, writeFile, rename, readdir, rm, realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

// Each build gets a separate directory. Failed builds never become the served root.
export class LocalBuilds {
  constructor(cache, build, onChange = () => {}) {
    this.cache = resolve(cache);
    this.build = build;
    this.onChange = onChange;
    this.current = null;
    this.phase = 'starting';
    this.error = null;
    this.requested = 0;
    this.running = null;
    this.closed = false;
  }
  path(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid local build identifier');
    return resolve(this.cache, 'builds', id);
  }
  async init() {
    await mkdir(resolve(this.cache, 'builds'), { recursive: true });
    try {
      const current = JSON.parse(await readFile(resolve(this.cache, 'current.json'), 'utf8'));
      await stat(resolve(this.path(current.id), 'index.html'));
      this.current = current;
      this.phase = 'ready';
    } catch { /* A fresh checkout has no last successful build. */ }
  }
  status() {
    return { phase: this.phase, current: this.current, error: this.error };
  }
  request() {
    if (this.closed) return Promise.resolve();
    this.requested++;
    if (!this.running) this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  }
  async drain() {
    while (this.requested && !this.closed) {
      const revision = this.requested;
      const id = randomUUID();
      const target = this.path(id);
      this.phase = 'building'; this.error = null; this.onChange();
      try {
        await this.build(target, id);
        if (revision !== this.requested || this.closed) {
          // A source edit during compilation requires another build, never a mixed promotion.
          await this.remove(id);
          continue;
        }
        const manifest = JSON.parse(await readFile(resolve(target, 'story/session-manifest.json'), 'utf8'));
        const next = { id, builtAt: new Date().toISOString(), contentVersion: manifest.contentVersion };
        await writeFile(resolve(this.cache, 'current.next.json'), JSON.stringify(next, null, 2));
        await rename(resolve(this.cache, 'current.next.json'), resolve(this.cache, 'current.json'));
        const previous = this.current;
        this.current = next; this.phase = 'ready';
        // Keep the preceding successful build for rollback diagnosis; never clean source directories.
        await this.prune(new Set([id, previous?.id])).catch(error => console.warn('Build cleanup:', error.message));
      } catch (error) {
        this.phase = 'error'; this.error = error.message;
        await this.remove(id).catch(() => {});
      }
      this.requested -= revision;
      this.onChange();
    }
  }
  async remove(id) {
    const target = this.path(id);
    try {
      const actual = await realpath(target);
      const parent = await realpath(resolve(this.cache, 'builds'));
      if (!actual.startsWith(parent + sep)) throw new Error('Unsafe build cleanup target');
      await rm(actual, { recursive: true, force: true });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  async prune(keep) {
    for (const item of await readdir(resolve(this.cache, 'builds'))) {
      if (/^[a-f0-9-]{36}$/.test(item) && !keep.has(item)) await this.remove(item);
    }
  }
}
