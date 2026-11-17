import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derive, freshReview, commitRow, validAuthorization, edgeKey } from '../web-demo/.build/GameStarter/web-demo/src/thought-canvas-model.js';
const content = JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.script.json', import.meta.url)));
const clues = ['C02','C03','C05','C06','C07'];
const basic = [['C02','C03']];
const context={completed:['D08','D09','D11','D12','D13']};
test('comparison requires both selected military facts, never unconnected library facts',()=>{
 assert.equal(derive(clues,[]).R01,undefined);
 assert.equal(derive(clues,[['C02','C05']]).R01,undefined);
 assert.deepEqual(derive(clues,basic).R01.evidence,['C02','C03']);
});
test('route requires both the ban and duty clue, with the prior answer and actual path',()=>{
 const edges=[...basic,['R01','C06'],['C06','C07']];
 assert.equal(derive(clues,edges).R02,undefined);
 assert.equal(derive(clues,edges,undefined,{completed:['D08','D09']}).R02,undefined);
 const result=derive(clues,edges,undefined,context);assert.ok(result.R02);assert.equal(result.C08,undefined);
 assert.equal(derive(clues,basic,undefined,context).R02,undefined);
});
test('deleting comparison invalidates dependent conclusions even with stale cyclic links',()=>{
 const edges=[...basic,['R01','C06'],['C06','C07'],['R02','R01']];assert.ok(derive(clues,edges,undefined,context).R02);
 const broken=derive(clues,edges.filter(e=>edgeKey(e)!=='C02|C03'),undefined,context);
 assert.equal(broken.R01,undefined);assert.equal(broken.R02,undefined);
});
test('shouting remains limited optional support and cannot prove knowledge of illness',()=>{
 const result=derive(clues,[...basic,['R01','C05']]);
 assert.match(result.R01.supplements.join(''),/不能证明/);assert.ok(result.R01.evidence.includes('C05'));
});
test('C08 needs every real commitment line, not a copied or isolated last sentence', () => {
    const save = freshReview(content.version);
    commitRow(save, 'J11'); assert.equal(save.flags.JIANG_AUTH_GRANTED, undefined);
    for (const id of ['J09','J09A','J10','J10A','J10B']) commitRow(save, id);
    assert.equal(save.flags.JIANG_AUTH_GRANTED, undefined);
    const valid = freshReview(content.version);
    for (const id of ['J09','J09A','J10','J10A','J10B','J11','J13','J14']) commitRow(valid, id);
    assert.ok(validAuthorization(valid));
    assert.equal(valid.flags.FORMAL_REPORT_RECEIVED, undefined); assert.equal(valid.flags.REPORT_CLOSED, undefined);
});
test('formal report and order delivery are distinct, idempotent events', () => {
    const save = freshReview(content.version);
    for (const id of ['E03','E04','E04C']) commitRow(save,id);
    assert.equal(save.flags.FORMAL_REPORT_RECEIVED,true); assert.equal(save.flags.REPORT_CLOSED,undefined);
    for (const id of ['E05','E08','E08B','E09','E10']) commitRow(save,id);
    assert.equal(save.flags.REPORT_CLOSED,true);
    const count=save.completed.length; commitRow(save,'E10'); assert.equal(save.completed.length,count);
    derive(clues,[]); assert.equal(save.flags.REPORT_CLOSED,true);
});
test('all exported IDs and referenced row IDs resolve; no template tokens in ordinary dialogue', () => {
    const ids=new Set(content.rows.map(row=>row.id)); assert.equal(ids.size,content.rows.length);
    for(const row of content.rows) {
        for(const match of row.transition.matchAll(/→\s*([A-Z][A-Z0-9_-]*)/g)) {
            assert.ok(ids.has(match[1]) || content.rules.some(rule=>rule.id===match[1]) || match[1]==='CHAPTER_END',`${row.id} -> ${match[1]}`);
        }
        if(!['P1-N1','P1-R1','P1-N2','P1-R2','P2-SAY'].includes(row.id)) assert.doesNotMatch(row.text,/\{\{/);
    }
});

 test('a configured redundant slot adds one place without counting inherited answers', async () => {
 const { evidenceCapacity } = await import('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/thought-capacity.js');
 const rule = {base:2,redundancy:1,inherited:['R01']};
 assert.deepEqual(evidenceCapacity(['R01','C06','C07'],rule),{count:2,limit:3,full:false,exceeded:false});
 assert.equal(evidenceCapacity(['R01','C06','C07','C10'],rule).full,true);
 assert.equal(evidenceCapacity(['R01','C06','C07','C10','C09'],rule).exceeded,true);
 assert.equal(evidenceCapacity(['R01','C06','C06'],rule).count,1);
});
