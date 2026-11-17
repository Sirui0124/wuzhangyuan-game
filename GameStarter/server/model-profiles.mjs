import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const profilesFileFor = settingsFile => `${settingsFile}.profiles.json`;
export async function readProfiles(settingsFile) {
  let p;
  try { p = JSON.parse(await readFile(profilesFileFor(settingsFile), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw new Error('本机模型配置档案无法读取'); }
  if (p?.version !== 1 || !['primary', 'config2'].includes(p.activeId) || !p.profiles?.primary || !p.profiles?.config2
      || !Number.isFinite(Date.parse(p.activeUntil))) throw new Error('本机模型配置档案不完整');
  for (const settings of [p.profiles.primary, p.profiles.config2]) {
    if (['apiKey', 'baseUrl', 'model'].some(k => typeof settings[k] !== 'string' || !settings[k].trim() || /[\r\n\0]/.test(settings[k]))) throw new Error('模型配置字段不完整');
    const url = new URL(settings.baseUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('模型配置网址无效');
    if (settings.systemBaseUrl !== undefined) {
      const alternate = new URL(settings.systemBaseUrl);
      if (alternate.origin !== url.origin || alternate.username || alternate.password || alternate.hash) throw new Error('系统规则接口必须属于同一服务');
    }
  }
  return p;
}
export function selectProfile(primary, profiles, now = Date.now()) {
  if (profiles?.activeId === 'config2' && now < Date.parse(profiles.activeUntil))
    return { config: { ...profiles.profiles.config2 }, profile: 'config2', expiresAt: profiles.activeUntil };
  return { config: { ...primary }, profile: 'primary', expiresAt: null };
}
let queue = Promise.resolve();
/** Editing a temporary profile never overwrites the primary .env or its historical snapshot. */
export function saveTemporaryProfile(settingsFile, next, expectedUntil) {
  const operation = queue.then(async () => {
    const p = await readProfiles(settingsFile);
    if (!p || p.activeId !== 'config2' || p.activeUntil !== expectedUntil || Date.now() >= Date.parse(p.activeUntil)) throw new Error('临时配置已切换或过期，请重新打开设置');
    p.profiles.config2 = { ...next };
    const path = profilesFileFor(settingsFile), temp = `${path}.${randomUUID()}.tmp`;
    try { await writeFile(temp, JSON.stringify(p, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(temp, path); }
    finally { await unlink(temp).catch(() => {}); }
  });
  queue = operation.catch(() => {});
  return operation;
}
