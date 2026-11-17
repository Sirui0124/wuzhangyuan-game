import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {polishFixtures} from '../../tools/ai/dialogue-polish-fixtures.mjs';
const build=process.env.POLISH_BUILD??'GameStarter/web-demo/.build';
const {grainPolishEvidence}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/chapter-two/polish.js')));

test('grain selected meanings distinguish player and listener and preserve sources separately',async()=>{
 const cases=await polishFixtures(build),first=cases.find(c=>c.id==='gouan-O1'),second=cases.find(c=>c.id==='gouan-O2');
 assert.match(first.input.question,/你要我留下/);
 assert.match(first.input.direction,/其中“我”指苟安/);
 assert.doesNotMatch(second.input.direction,/你说的五月/);
 const confession=second.input.evidence.find(c=>c.id==='LY-C12');
 assert.match(confession.text,/逼退军/);assert.match(confession.text,/李严担部分责任/);
 assert.match(confession.text,/顶罪/);assert.match(confession.text,/救我是真心，后来.*骗我送材料/);
 assert.ok(confession.sources.some(s=>s.text==='骗你，是后来的事。'));
 const plan=second.input.evidence.find(c=>c.id==='LY-C14');
 assert.match(plan.text,/尚未实行/);assert.match(plan.text,/可能泄露粮道/);assert.match(plan.text,/追击/);
});

test('partial verification never invents later testimony and changed sources are not replaced by old meanings',()=>{
 const base={id:'LY-M08',title:'核验',detail:'尚待完整来源',sources:[{node:'N1',speaker:'记录',text:'报告送达、苟安签认：均在本批交接记录所列当日。'}]};
 const partial=grainPolishEvidence(base);
 assert.doesNotMatch(partial.text,/受杖前|未补足/);
 const extended=grainPolishEvidence({...base,sources:[...base.sources,{node:'N2',speaker:'经手人',text:'当日后来也未补足。'}]});
 assert.match(extended.text,/当日后来也未补足/);
 const changed=grainPolishEvidence({...base,id:'LY-C14',sources:[{node:'N3',speaker:'苟安',text:'还没说明具体计划。'}]});
 assert.doesNotMatch(changed.text,/赴魏散谣/);
});
