import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
const out='outputs/portrait-staging-20261027';mkdirSync(out,{recursive:true});
const server=createStaticServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({channel:'chrome',headless:true});const errors=[],checks=[];
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));
 const html=readFileSync('GameStarter/web-demo/public/index.html','utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').replace('</head>','<link rel="stylesheet" href="/chapter-three.css"><link rel="stylesheet" href="/grain-films.css"></head>');
 await p.route('**/portrait-review',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto(base+'/portrait-review');
 await p.evaluate(async()=>{
  const prefix='/GameStarter/web-demo/src/';
  const [j,v,g,gv,media,story,grain]=await Promise.all([import(prefix+'chapters/chapter-three/session.js'),import(prefix+'chapters/chapter-three/view.js'),import(prefix+'chapters/chapter-two/session.js'),import(prefix+'game/grain-view.js'),fetch('/media/manifest.json').then(r=>r.json()),fetch('/story/chapter-three.story.json').then(r=>r.json()),fetch('/story/chapter-two.films.json').then(r=>r.json())]);
  window.review={media,story,grain,j,v,g,gv};
 });
 async function render(person,chapter=3){
  await p.evaluate(({person,chapter})=>{
   const {media,story,grain,j,v,g,gv}=window.review;
   if(chapter===3){const s=new j.JietingSession(story,undefined,{aiEnabled:false,phoneAllowed:false});const n=story.nodes.find(n=>n.speaker===person&&n.kind==='line'&&(person==='马谡'?n.scene==='jieting_masu_tent':person==='王平'?n.scene==='jieting_wangping_camp':true));if(!n)throw Error(person);s.state.node=n.id;document.querySelector('#game-root').innerHTML=v.jietingView(s,media,{busy:false,error:'',online:false,phone:false,changedScene:false});}
   else {const s=new g.GrainSession(grain);const n=grain.nodes.find(n=>n.speaker==='苟安'&&n.kind==='line'&&n.image);s.state.node=n.id;document.querySelector('#game-root').innerHTML=gv.grainView(s,media,{notes:false,items:false,editing:false,busy:false,error:'',phoneEnabled:false});}
  },{person,chapter});
  if(chapter===3)await p.locator('.portrait-stage img').evaluate(i=>i.decode());await p.evaluate(()=>document.fonts.ready);
 }
 async function measure(label){const x=await p.locator('.portrait-stage').evaluate(e=>{const r=e.getBoundingClientRect();return(r.x+r.width/2)/innerWidth;});assert.ok(Math.abs(x-.65)<.001,label+': '+x);checks.push(label);}
 for(const person of ['探马','军吏','取水军士','搬营军士','传令军士','带队军士','马谡','王平']){
  await render(person);await measure(person);await p.screenshot({path:`${out}/third-${person}.png`});
 }
 await render('苟安',2);assert.equal(await p.locator('.portrait-stage').count(),0);assert.ok(await p.locator('.scene-image').evaluate(e=>e.style.backgroundImage.includes('CH2-V25.jpg')));checks.push('chapter-two film still preserved');await p.screenshot({path:`${out}/second-gouan.png`});
 // First chapter uses its real view and normal initial session, rendering a static NPC dialogue state.
 await p.evaluate(async()=>{
  const pre='/GameStarter/web-demo/src/';const [{ChapterSession},{createSceneViews},content,flow,version]=await Promise.all([import(pre+'chapter-session.js'),import(pre+'chapters/chapter-one/views/scene.js'),fetch('/story/chapter-one.script.json').then(r=>r.json()),fetch('/story/chapter-one.flow.json').then(r=>r.json()),fetch('/story/session-manifest.json').then(r=>r.json())]);
  const s=new ChapterSession(content,flow,version.contentVersion);s.finishCinematic();const view=createSceneViews(s,flow,window.review.media,{notice:'',storageWarning:''},()=>false);const state={...s.snapshot(),phase:'spoken'};document.querySelector('#game-root').innerHTML=view.sceneHTML(state);
 });
 await p.locator('.portrait-stage img').evaluate(i=>i.decode());await measure('chapter one');await p.screenshot({path:`${out}/first-weiyan.png`});
 for(const size of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
  await p.setViewportSize(size);await render('探马');await measure('scout '+size.width);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${out}/scout-${size.width}.png`});
 }
 await p.setViewportSize({width:1440,height:900});
 await p.evaluate(()=>{const {j,v,story,media}=window.review;const s=new j.JietingSession(story);s.state.node=story.nodes.find(n=>n.scene==='jieting_camp'&&n.speaker==='马谡'&&n.kind==='line').id;document.querySelector('#game-root').innerHTML=v.jietingView(s,media,{busy:false,error:'',online:false,phone:false,changedScene:false});});
 assert.equal(await p.locator('.jieting-pair img').count(),2);assert.equal(await p.locator('.portrait-stage').count(),0);checks.push('authored pair preserved');await p.screenshot({path:`${out}/pair.png`});
 await render('探马');await p.locator('.portrait-stage').evaluate(e=>e.dataset.composition='center');assert.ok(await p.locator('.portrait-stage').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs((r.x+r.width/2)/innerWidth-.5)<.001;}));checks.push('explicit center override');
 assert.deepEqual(errors,[]);writeFileSync(`${out}/verification.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log('PASS: all three chapter views, eight chapter-three NPCs, desktop/narrow/landscape anchoring, pair preservation and center override.');
}finally{await b.close();server.closeAllConnections();await new Promise(r=>server.close(r));}


