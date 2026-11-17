import { readFile } from 'node:fs/promises';
import { Dialogue } from './dist/engine.js';
import { storyFile } from './server.mjs';
export const story=JSON.parse(await readFile(storyFile,'utf8'));
export function settle(g) { for(let i=0;i<60 && (g.pending||g.node.kind==='passage');i++)g.next(); }
export function toInput(known=true,branch='critical') {
  const g=new Dialogue(story);settle(g);
  if(known){g.ask('丞相不能见，还有谁能帮忙处理军情？');settle(g);}else{g.choose('enemy');settle(g);}
  g.choose('meet');settle(g);g.choose('concern');settle(g);g.choose(branch);settle(g);
  return g;
}
export function inputFor(g,text,id=crypto.randomUUID()) {return {version:story.version,nodeId:g.nodeId,audit:g.audit,requestId:id,text};}
export const assessment=(overrides={})=>({enemy:'missing',enemyQuote:'',plan:'none',planQuote:'',unsupportedClaim:false,claimQuote:'',...overrides});
export const understood=assessment({enemy:'understood',enemyQuote:'魏军还没攻营',plan:'invite_jiang',planQuote:'请伯约出来听报'});
