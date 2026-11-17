import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = resolve('.'), output = resolve('docs/art/campaign-style-20261117');
mkdirSync(output,{recursive:true});
const manifest=JSON.parse(readFileSync('GameStarter/web-demo/visual-assets.json','utf8'));
const rows=[];
const add=(group,id,path,status)=>{
 const absolute=resolve(path), present=existsSync(absolute);
 rows.push({group,id,path:relative(root,absolute).replaceAll('\\','/'),status,exists:present,bytes:present?statSync(absolute).size:0,sha256:present?createHash('sha256').update(readFileSync(absolute)).digest('hex'):null});
};
for(const group of ['characters','scenes','cinematics','ui']) for(const [id,path] of Object.entries(manifest[group]??{}))
 add(group,id,resolve('GameStarter/web-demo',manifest.sourceRoot,path),group==='ui'&&/evidence|grip/.test(id)?'旧机制资源，保留兼容；不恢复入口':'当前发布映射（不等于所有流程均使用）');
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(png|jpg|webp|svg|woff2?)$/i.test(p))add('public-ui',relative(resolve('GameStarter/web-demo/public'),p),p,'公共资源；按界面引用使用');}}
walk('GameStarter/web-demo/public/ui');walk('GameStarter/web-demo/public/fonts');
for(const name of readdirSync('GameStarter/web-demo/public'))if(/^(main-menu|campaign-landscape).*\.(png|jpg)$/.test(name))add('menu-map',name,resolve('GameStarter/web-demo/public',name),/button/.test(name)?'历史按钮，已被共享案牍样式替代，保留源文件':'保留');
add('chapter-four','material-atlas', 'demos/yiling-ui-prototype-v1/public/art/material-atlas-v1.png','第四章当前材质基准；正式UI复用同字节副本');
add('chapter-four','ledger-frame', 'demos/yiling-ui-prototype-v1/public/art/ledger-frame.svg','第四章当前铜角基准');
const data={date:'2026-11-17',scope:'发布映射、公共UI与字体、第四章材质；不是全库逐图审核',rows};
writeFileSync(resolve(output,'资产索引.json'),JSON.stringify(data,null,2)+'\n');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
writeFileSync(resolve(output,'资产审阅.html'),`<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>美术资产审阅 · 2026-11-17</title><style>body{margin:32px auto;padding:0 24px;max-width:1400px;background:#f6f5f1;color:#272722;font:16px/1.65 system-ui}h1{font-size:28px}input{padding:12px;width:min(90%,600px);font:inherit;border:1px solid #aaa}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin-top:24px}article{background:white;border:1px solid #ddd;padding:14px;overflow-wrap:anywhere}article[hidden]{display:none}img{width:100%;height:190px;object-fit:contain;background:#e8e6df}small{color:#666}a{color:#76532d}h2{font-size:17px;margin:8px 0}</style><h1>美术资产审阅</h1><p>2026-11-17 · ${rows.length}条路径记录。区分现用映射、保留资源与替代项；缩略图用于人工复查，不代表用户已通过。剧情影像仍按独立台账管理。</p><input aria-label="筛选资产" placeholder="按名称、类别或状态筛选"><main>${rows.map(r=>`<article data-search="${esc(r.group+' '+r.id+' '+r.status)}">${/\.(png|jpg|webp|svg)$/i.test(r.path)?`<img loading="lazy" src="${esc(pathToFileURL(resolve(r.path)).href)}" alt="${esc(r.id)}">`:''}<small>${esc(r.group)}</small><h2>${esc(r.id)}</h2><p>${esc(r.status)}</p><a href="${esc(pathToFileURL(resolve(r.path)).href)}">打开原文件</a><p><small>${esc(r.path)}<br>${r.exists?Math.round(r.bytes/1024)+' KiB':'缺失'}</small></p></article>`).join('')}</main><script>document.querySelector('input').oninput=e=>{for(const a of document.querySelectorAll('article'))a.hidden=!a.dataset.search.toLowerCase().includes(e.target.value.toLowerCase())}</script></html>`);
console.log(JSON.stringify({count:rows.length,missing:rows.filter(r=>!r.exists),output}));
