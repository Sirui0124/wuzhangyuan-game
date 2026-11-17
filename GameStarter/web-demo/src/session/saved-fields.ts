/** Keep only supported schema fields when importing an older save. */
export function savedFields<T extends object>(value: T, keys: readonly string[]): T {
    return Object.fromEntries(keys.filter(key => Object.prototype.hasOwnProperty.call(value, key)).map(key => [key, (value as Record<string, unknown>)[key]])) as T;
}
