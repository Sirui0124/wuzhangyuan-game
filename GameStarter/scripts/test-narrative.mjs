import { runTsc } from './run-tsc.mjs';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
runTsc(['-p', 'tsconfig.narrative.json'], { cwd: project, stdio: 'inherit' });
execFileSync(process.execPath, ['--test', ...readdirSync(resolve(project, 'tests/narrative')).filter(f => f.endsWith('.test.mjs')).map(f => `tests/narrative/${f}`)], { cwd: project, stdio: 'inherit' });
