import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Invoke Node directly: execFileSync cannot run tsc.cmd on Windows.
export function runTsc(args, options = {}) {
  const compiler = require.resolve('typescript/bin/tsc');
  return execFileSync(process.execPath, [compiler, ...args], options);
}
