import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out=resolve('outputs/windows-release-20261027-1630');mkdirSync(out,{recursive:true});
const project=resolve('GameStarter/packaging/windows');
const env={...process.env,DEEPSEEK_API_KEY:'fake-environment-value-must-not-be-inherited'};delete env.ELECTRON_RUN_AS_NODE;
let application;
try {
 application=await electron.launch({executablePath:resolve(project,'node_modules/electron/dist/electron.exe'),args:[project,
  `--game-root=${resolve('.cache/windows-release-20261027-1630/stage/game')}`,
  `--user-data-dir=${resolve('.cache/windows-release-20261027-1630/runtime-probe-data')}`,
  `--smoke-report=${resolve(out,'runtime-ready.json')}`],env,timeout:45000});
 const page=await application.firstWindow();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.locator('.game-menu').waitFor({timeout:45000});
 const health=await page.evaluate(async()=>{const r=await fetch('http://127.0.0.1:8787/health');return {status:r.status,...await r.json()};});
 assert.equal(health.status,200);assert.equal(health.configured,false);
 const prefs=await application.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return{sandbox:p.sandbox,nodeIntegration:p.nodeIntegration,contextIsolation:p.contextIsolation};});
 assert.deepEqual(prefs,{sandbox:true,nodeIntegration:false,contextIsolation:true});
 const settings=await page.evaluate(async()=>{const r=await fetch('http://127.0.0.1:8787/api/game/settings');const v=await r.json();return {status:r.status,hasKey:!!v.apiKey};});
 assert.deepEqual(settings,{status:200,hasKey:false});
 await page.goto('http://127.0.0.1:8812/?chapter=grain&playtest=open1');
 await page.locator('video').waitFor();assert.equal(new URL(page.url()).searchParams.has('playtest'),false);
 await page.locator('[data-cinema-action=toggle]').click();
 assert.deepEqual(errors,[]);
 await page.screenshot({path:resolve(out,'runtime-probe.png')});
 writeFileSync(resolve(out,'runtime-probe.json'),JSON.stringify({passed:true,health,prefs,settings,errors,ready:JSON.parse(readFileSync(resolve(out,'runtime-ready.json')))},null,2));
 console.log('PASS: independent desktop runtime, stable origins, clean backend environment, sandbox, production entry');
}finally{await application?.close();}
