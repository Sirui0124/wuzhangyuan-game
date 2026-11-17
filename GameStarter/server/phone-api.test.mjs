import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('retired phone endpoints cannot purchase, guard or confirm; health advertises no shopping', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'retired-phone-'));
    const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
    const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
    const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), windowsHide: true,
        env: { ...process.env, PORT: String(port), GAME_SETTINGS_FILE: join(directory, '.env'), DEEPSEEK_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let diagnostics = ''; child.stderr.on('data', chunk => { diagnostics += chunk; });
    try {
        await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('API failed to start: ' + diagnostics); })]);
        const base = `http://127.0.0.1:${port}`;
        assert.equal((await (await fetch(base + '/health')).json()).shopping, false);
        for (const path of ['/api/game/shop', '/api/game/shop/confirm', '/api/game/phone/guard']) {
            const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(response.status, 404, path);
        }
    } finally {
        if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
        await rm(directory, { recursive: true, force: true });
    }
});
