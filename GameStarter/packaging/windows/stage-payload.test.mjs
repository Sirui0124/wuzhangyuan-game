import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { excludedReason, validatedStageDirectory, validatePayload, workspaceRoot } from './stage-payload.mjs';

test('private configuration and debug saves stay out, but live shared styles and voice pages remain', () => {
    for (const name of ['yiling-rescue/index.html', 'yiling-rescue/app.js', '.env', '.env.example', 'nested/.env.profiles.json', 'keys/customer.pfx', 'api-defaults.json', 'nested/service-credentials.json', 'playtest/weiyan-second.json', 'art-review/index.json', 'art-review.html', 'GameStarter/web-demo/src/art-review.js']) {
        assert.ok(excludedReason(name), name);
    }
    for (const name of ['art-review/themes.css', 'art-review/mindmap.css', 'GameStarter/assets/scripts/GameApi.js', 'GameStarter/assets/scripts/narrative/state.js', 'voice-demo.html', 'video-review.html', 'audio/licenses/kenney_interface-sounds.txt', 'video/current/CH2-V01.mp4']) {
        assert.equal(excludedReason(name), null, name);
    }
});

test('recursive staging cleanup is limited to a named workspace cache directory', () => {
    for (const name of [workspaceRoot, resolve(workspaceRoot, '.cache'), resolve(workspaceRoot, '..', 'elsewhere'), resolve(workspaceRoot, '.cache', '..', 'source-art')]) {
        assert.throws(() => validatedStageDirectory(name), /named directory/);
    }
    const stage = resolve(workspaceRoot, '.cache', 'packaging-test-stage');
    assert.equal(validatedStageDirectory(stage).game, stage + sep + 'game');
});

test('dependency validation detects both essential shared GameApi and relative module omissions', () => {
    const cache = resolve(workspaceRoot, '.cache'); mkdirSync(cache, { recursive: true });
    const testRoot = mkdtempSync(resolve(cache, 'payload-test-'));
    try {
        const game = resolve(testRoot, 'game'); mkdirSync(resolve(game, 'web', 'src'), { recursive: true });
        writeFileSync(resolve(game, 'web', 'src', 'entry.js'), "import {example} from './missing.js';\n");
        assert.throws(() => validatePayload(game), error => /GameApi\.js/.test(error.message) && /Missing import \.\/missing\.js/.test(error.message));
        writeFileSync(resolve(game, 'web', 'src', 'missing.js'), 'export const example=1;\n');
        assert.throws(() => validatePayload(game), error => /GameApi\.js/.test(error.message) && !/Missing import/.test(error.message));
    } finally {
        if (!testRoot.startsWith(cache + sep)) throw new Error('Unsafe test cleanup');
        rmSync(testRoot, { recursive: true, force: true });
    }
});
