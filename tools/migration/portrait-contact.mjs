import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
const m=JSON.parse(readFileSync('GameStarter/web-demo/visual-assets.json'));
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1500,height:1000}});
await p.setContent(`<body style="margin:0;background:#666;display:grid;grid-template-columns:repeat(7,1fr);font:16px sans-serif;color:white">${Object.entries(m.characters).filter(([id])=>!id.includes('resolved')).map(([id,path])=>`<div style="height:310px;text-align:center">${id}<img style="width:100%;height:280px;object-fit:contain" src="data:image/png;base64,${readFileSync('source-art/visuals/'+path).toString('base64')}"></div>`).join('')}</body>`);
await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));mkdirSync('outputs/portrait-staging-20261027',{recursive:true});await p.screenshot({path:'outputs/portrait-staging-20261027/contact-before.png',fullPage:true});await b.close();
