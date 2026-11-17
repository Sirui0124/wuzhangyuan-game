export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

export function recoveryKeys(storage: SaveStorage, key: string): string[] {
    const prefix = `${key}:recovery:`;
    return Array.from({ length: storage.length }, (_, i) => storage.key(i))
        .filter((value): value is string => !!value?.startsWith(prefix)).sort().reverse();
}

/** Preserve the original bytes, including malformed JSON; verify before any replacement. */
export function backupSave(storage: SaveStorage, key: string, raw: string): string {
    for (const candidate of recoveryKeys(storage, key)) if (storage.getItem(candidate) === raw) return candidate;
    const base = `${key}:recovery:${Date.now()}`;
    let candidate = base, suffix = 0;
    while (storage.getItem(candidate) !== null) candidate = `${base}:${++suffix}`;
    storage.setItem(candidate, raw);
    if (storage.getItem(candidate) !== raw) throw new Error('旧进度备份未能核实');
    return candidate;
}

export function verifyBackup(storage: SaveStorage, key: string, raw: string, backupKey: string): boolean {
    return !!backupKey && storage.getItem(key) === raw && storage.getItem(backupKey) === raw;
}

/** Protect an invalid record until a verified backup and unchanged source permit one write. */
export function protectSave(storage: SaveStorage, key: string, raw: string) {
    let backupKey = '', released = false;
    return {
        backup() { backupKey = backupSave(storage, key, raw); return backupKey; },
        write(value: string) {
            if (!released && !verifyBackup(storage, key, raw, backupKey)) throw new Error('旧进度未安全备份或已被其他窗口修改，自动存档暂未覆盖。');
            storage.setItem(key, value);
            if (storage.getItem(key) !== value) throw new Error('当前进度未能核实');
            released = true;
        },
    };
}
