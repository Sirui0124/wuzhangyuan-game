import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

// One publishing contract for builders and asset checks; historical provenance is not runtime media.
export function validateMedia(config, manifest, webRoot, { verifyFiles = true } = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config) || !Array.isArray(manifest?.clips)) {
    throw new Error('Invalid cinematic config or media manifest');
  }
  const configured = new Set();
  for (const [group, clips] of Object.entries(config)) {
    if (!Array.isArray(clips)) throw new Error(`Invalid cinematic group: ${group}`);
    const ids = new Set();
    for (const clip of clips) {
      if (!clip?.id || ids.has(clip.id)) throw new Error(`Duplicate/missing cinematic ID: ${group}:${clip?.id}`);
      ids.add(clip.id); configured.add(clip.src);
    }
  }
  const mediaRoot = resolve(webRoot, '../../video/current');
  const urls = new Set(), sources = new Set();
  for (const clip of manifest.clips) {
    if (!/^\/video\/current\/[^/\\?#%]+\.mp4$/.test(clip.url)) throw new Error(`Invalid cinematic URL: ${clip.url}`);
    const filename = clip.url.slice('/video/current/'.length);
    if (clip.source !== `../../video/current/${filename}` || clip.file !== `current/${filename}`) {
      throw new Error(`Cinematic source/URL mismatch: ${clip.url}`);
    }
    if (urls.has(clip.url) || sources.has(clip.source)) throw new Error(`Duplicate cinematic media: ${clip.url}`);
    urls.add(clip.url); sources.add(clip.source);
    if (!configured.has(clip.url)) throw new Error(`Unused cinematic media: ${clip.url}`);
    if (!Number.isSafeInteger(clip.bytes) || clip.bytes <= 0 || !/^[a-f0-9]{64}$/.test(clip.sha256)
        || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error(`Invalid cinematic metadata: ${clip.url}`);
    if (verifyFiles) {
      const source = resolve(webRoot, clip.source);
      if (!realpathSync(source).startsWith(realpathSync(mediaRoot) + sep)) throw new Error(`Cinematic source outside media root: ${clip.url}`);
      const stat = statSync(source);
      if (!stat.isFile() || stat.size !== clip.bytes) throw new Error(`Cinematic size mismatch: ${clip.url}`);
      if (createHash('sha256').update(readFileSync(source)).digest('hex') !== clip.sha256) throw new Error(`Cinematic hash mismatch: ${clip.url}`);
    }
  }
  for (const url of configured) if (!urls.has(url)) throw new Error(`Missing cinematic media: ${url}`);
  return manifest.clips;
}
