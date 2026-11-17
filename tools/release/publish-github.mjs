import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..');
const option=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3);
const tag=option('tag'),windows=option('windows'),mac=option('mac'),notes=option('notes');
if(!tag||!windows||!mac||!notes||!/^v[\w.-]+$/.test(tag))throw Error('Usage: --tag=v... --windows=outputs/windows-release-... --mac=outputs/mac-web-... --notes=path.md');
function run(file,args,capture=false){const r=spawnSync(file,args,{cwd:root,encoding:'utf8',stdio:capture?'pipe':'inherit',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error(`${file} failed: ${r.stderr||r.status}`);return r.stdout?.trim();}
if(run('git',['status','--porcelain'],true))throw Error('Commit current source before publishing. Working tree must be clean.');
const repo='Sirui0124/wuzhangyuan-game';
if(run('gh',['repo','view',repo,'--json','visibility','--jq','.visibility'],true)!=='PRIVATE')throw Error('Expected private repository');
const sha=run('git',['rev-parse','HEAD'],true);
const artifacts=[windows,mac].flatMap(dir=>JSON.parse(readFileSync(resolve(root,dir,'release-artifacts.json'),'utf8')).artifacts);
for(const a of artifacts){if(!existsSync(a.path))throw Error(`Missing ${a.path}`);if(createHash('sha256').update(readFileSync(a.path)).digest('hex')!==a.sha256)throw Error(`Hash mismatch: ${a.path}`);}
const out=resolve(root,'outputs',`github-${tag}`);mkdirSync(out,{recursive:true});
const sums=resolve(out,'SHA256SUMS.txt');writeFileSync(sums,artifacts.map(a=>`${a.sha256}  ${basename(a.path)}`).join('\n')+'\n');
run('git',['push','origin',`HEAD:refs/heads/codex/delivery-${tag}`]);
run('gh',['release','create',tag,'--repo',repo,'--target',sha,'--title',`逆转五丈原 ${tag} · Windows / Mac 网页版`,'--notes-file',resolve(root,notes),'--draft']);
run('gh',['release','upload',tag,'--repo',repo,...artifacts.map(a=>a.path),sums]);
const remote=JSON.parse(run('gh',['release','view',tag,'--repo',repo,'--json','assets'],true));
for(const a of artifacts){const uploaded=remote.assets.find(x=>x.name===basename(a.path));if(!uploaded||uploaded.size!==a.bytes)throw Error(`Remote size mismatch: ${a.path}`);}
run('gh',['release','edit',tag,'--repo',repo,'--draft=false','--prerelease']);
console.log(run('gh',['release','view',tag,'--repo',repo,'--json','url','--jq','.url'],true));
