import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const r=spawnSync(process.execPath,[fileURLToPath(new URL('../../node_modules/typescript/bin/tsc',import.meta.url)),'-p',fileURLToPath(new URL('tsconfig.json',import.meta.url))],{stdio:'inherit',windowsHide:true});
process.exitCode=r.status??1;
