import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { validateMedia } from './media.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'wuzhang-media-'));
  t.after(() => {
    assert.ok(realpathSync(root).startsWith(realpathSync(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  });
  const web = resolve(root, 'GameStarter/web-demo');
  const source = resolve(root, 'video/current/clip.mp4');
  mkdirSync(resolve(root, 'video/current'), { recursive: true });
  writeFileSync(source, 'original');
  const clip = { file: 'current/clip.mp4', url: '/video/current/clip.mp4', source: '../../video/current/clip.mp4',
    duration: 1, bytes: 8, sha256: createHash('sha256').update('original').digest('hex') };
  return { web, source, config: { opening: [{ id: 'one', src: clip.url }] }, manifest: { clips: [clip] } };
}

test('publishing accepts shared runtime references but rejects duplicate manifest entries', t => {
  const f = fixture(t);
  f.config.ending = [{ id: 'one', src: f.manifest.clips[0].url }];
  assert.equal(validateMedia(f.config, f.manifest, f.web).length, 1);
  f.manifest.clips.push({ ...f.manifest.clips[0] });
  assert.throws(() => validateMedia(f.config, f.manifest, f.web), /Duplicate cinematic media/);
});

test('publishing rejects missing, orphaned and redirected media', t => {
  const f = fixture(t);
  assert.throws(() => validateMedia(f.config, { clips: [] }, f.web), /Missing cinematic/);
  assert.throws(() => validateMedia({}, f.manifest, f.web), /Unused cinematic/);
  f.manifest.clips[0].source = '../../video/raw/clip.mp4';
  assert.throws(() => validateMedia(f.config, f.manifest, f.web), /source.URL mismatch/);
});

test('publishing detects both truncation and same-size replacement before copying', t => {
  const f = fixture(t);
  writeFileSync(f.source, 'short');
  assert.throws(() => validateMedia(f.config, f.manifest, f.web), /size mismatch/);
  writeFileSync(f.source, 'tampered');
  assert.throws(() => validateMedia(f.config, f.manifest, f.web), /hash mismatch/);
});

test('publishing rejects duplicate film IDs within a playback group', t => {
  const f = fixture(t);
  f.config.opening.push({ ...f.config.opening[0] });
  assert.throws(() => validateMedia(f.config, f.manifest, f.web), /Duplicate.missing cinematic ID/);
});

