import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';

export const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
export const port = Number(process.env.DEMO_PORT || 8812);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('DEMO_PORT must be 1024–65535');
// Alternate developer ports must not race the main service's build pointers or control token.
export const cache = resolve(root, port === 8812 ? '.cache/local-game' : `.cache/local-game-${port}`);
export const origin = `http://127.0.0.1:${port}`;
export const workspace = createHash('sha256').update(process.platform === 'win32' ? root.toLowerCase() : root).digest('hex').slice(0, 16);
export const identity = 'wuzhang-local-game-v1';

export async function health(url = origin) {
  const response = await fetch(`${url}/__local/status`, { signal: AbortSignal.timeout(1500) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
