import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../node_modules/typescript/bin/tsc',import.meta.url)),'-p',fileURLToPath(new URL('tsconfig.json',import.meta.url))],{stdio:'inherit',windowsHide:true});process.exitCode=result.status??1;
