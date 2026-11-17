import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { cleanCueEnding, parseVtt, normalizeVtt } from './vtt.mjs';
export { cleanCueEnding, parseVtt, normalizeVtt } from './vtt.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicRoot = resolve(root, 'GameStarter/web-demo/public');
const catalogPath = resolve(root, 'video/subtitles/catalog.json');
const emptyTracksPath = resolve(root, 'video/subtitles/empty-tracks.json');
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const hash = text => createHash('sha256').update(text).digest('hex');
export function checkEmptyTrack(clip, film, cues, dispositions) {
  if (cues.length) return null;
  const entry = dispositions.find(entry => entry.id === clip.id);
  if (!entry || entry.videoSha256 !== film.sha256 || !entry.reason?.trim()
      || !['planned-no-dialogue', 'unexpected-speech'].includes(entry.status)) {
    throw new Error(`${clip.id}: empty subtitles need a review record for this exact video SHA in video/subtitles/empty-tracks.json`);
  }
  return entry.status === 'unexpected-speech' ? clip.id : null;
}
export function checkSubtitles({ sync = false, normalize = false } = {}) {
  if (normalize && !sync) throw new Error('Normalization requires --sync; read-only checks never modify subtitles.');
  const config = read(resolve(publicRoot, 'cinematics.json'));
  const media = new Map(read(resolve(publicRoot, 'video/media-manifest.json')).clips.map(c => [c.url, c]));
  const dispositions = read(emptyTracksPath).entries;
  const entries = [], errors = [], audioReviewRequired = [], pendingWrites = new Map(), ids = new Set();
  for (const [group, clips] of Object.entries(config)) for (const clip of clips) {
    const identity = `${group}:${clip.id}`;
    if (!clip.id || ids.has(identity)) errors.push(`Duplicate/missing clip ID: ${identity}`);
    ids.add(identity);
    if (!clip.subtitles) { errors.push(`${clip.id}: missing subtitle declaration`); continue; }
    if (!/^\/video\/subtitles\/[^/]+\.vtt$/.test(clip.subtitles)) throw new Error('Invalid subtitle path: ' + clip.subtitles);
    const path = resolve(publicRoot, '.' + clip.subtitles), film = media.get(clip.src);
    if (!film || !Number.isFinite(film.duration) || film.duration <= 0 || !/^[a-f0-9]{64}$/.test(film.sha256)) throw new Error('Missing/invalid media: ' + clip.src);
    let text = readFileSync(path, 'utf8');
    if (normalize) {
      const next = normalizeVtt(text);
      const before = parseVtt(text), after = parseVtt(next);
      if (JSON.stringify(before.map(c => ({...c, text: cleanCueEnding(c.text)}))) !== JSON.stringify(after)) throw new Error('Normalization changed dialogue or timing: ' + path);
      if (next !== text) { pendingWrites.set(path, next); text = next; }
    }
    const cues = parseVtt(text);
    const needsAudioReview = checkEmptyTrack(clip, film, cues, dispositions);
    if (needsAudioReview) audioReviewRequired.push(needsAudioReview);
    let previous = 0;
    for (const cue of cues) {
      if (!cue.text.trim() || cue.start < previous || cue.start < 0 || cue.end <= cue.start || cue.end > film.duration + .15) errors.push(`${clip.id}: invalid cue ${JSON.stringify(cue)}`);
      if (cleanCueEnding(cue.text) !== cue.text) errors.push(`${clip.id}: trailing comma/full stop`);
      previous = cue.end;
    }
    entries.push({ group, id: clip.id, video: clip.src, videoSha256: film.sha256, duration: film.duration, subtitles: clip.subtitles, subtitleSha256: hash(text), cueCount: cues.length, firstCue: cues[0]?.start ?? null, lastCue: cues.at(-1)?.end ?? null });
  }
  const catalog = { version: 1, policy: 'transparent-white; trim-final-comma-or-full-stop; retain-dialogue-and-timing', entries };
  if (errors.length) throw new Error(errors.join('\n'));
  if (sync) {
    for (const [path, text] of pendingWrites) writeFileSync(path, text);
    writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  }
  else if (!existsSync(catalogPath) || JSON.stringify(read(catalogPath)) !== JSON.stringify(catalog)) throw new Error('Subtitle/video pairing changed. Review the actual film and run npm run subtitles:sync to update video/subtitles/catalog.json.');
  const subtitlePaths = [...new Set(entries.map(c => c.subtitles))];
  const unusedFiles = readdirSync(resolve(publicRoot, 'video/subtitles')).filter(name => name.endsWith('.vtt') && !subtitlePaths.includes('/video/subtitles/' + name));
  return { clips: entries.length, cues: entries.reduce((n, c) => n + c.cueCount, 0), changed: pendingWrites.size, audioReviewRequired, subtitlePaths, unusedFiles };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(checkSubtitles({ sync: process.argv.includes('--sync'), normalize: process.argv.includes('--normalize') })));
}
