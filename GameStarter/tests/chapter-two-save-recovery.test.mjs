import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// These two pure adapters can be checked against edited source without mutating the shared build.
async function sourceModule(name) {
    const source=readFileSync(new URL(`../web-demo/src/chapters/chapter-two/${name}.ts`,import.meta.url),'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const {backupSave:backupGrainSave,recoveryKeys:grainRecoveryKeys,verifyBackup:verifyGrainBackup,protectSave}=await sourceModule('../../session/save-recovery');
const {grainHistory}=await sourceModule('history');
const key='grain-test';
function storage(entries=[],fail=()=>false) {
    const values=new Map(entries);
    return {values,get length(){return values.size;},key(i){return [...values.keys()][i]??null;},getItem(k){return values.get(k)??null;},setItem(k,v){if(fail(k))throw new Error('QuotaExceededError');values.set(k,v);}};
}
test('unreadable JSON is preserved byte for byte, repeated recovery reuses its verified backup',()=>{
    const raw='{ broken JSON\n',s=storage([[key,raw]]);
    const saved=backupGrainSave(s,key,raw);
    assert.equal(s.getItem(key),raw);assert.equal(s.getItem(saved),raw);
    assert.equal(backupGrainSave(s,key,raw),saved);assert.equal(grainRecoveryKeys(s,key).length,1);
    assert.equal(verifyGrainBackup(s,key,raw,saved),true);
});
test('a second incompatible record keeps the first backup, while backup failure never authorizes overwrite',()=>{
    const first='{"version":"one"}',second='{"version":"two"}',s=storage([[key,first]]);
    const a=backupGrainSave(s,key,first);s.setItem(key,second);const b=backupGrainSave(s,key,second);
    assert.notEqual(a,b);assert.equal(s.getItem(a),first);assert.equal(s.getItem(b),second);assert.equal(s.getItem(key),second);
    const broken=storage([[key,second]],k=>k.includes(':recovery:'));
    assert.throws(()=>backupGrainSave(broken,key,second),/Quota/);
    assert.equal(broken.getItem(key),second);assert.equal(verifyGrainBackup(broken,key,second,''),false);
});
test('unverified writes or a concurrent source change cannot release the protected automatic save',()=>{
    const raw='old-save',s=storage([[key,raw]]),saved=backupGrainSave(s,key,raw);
    s.setItem(key,'newer-save');assert.equal(verifyGrainBackup(s,key,raw,saved),false);
    const silent=storage([[key,raw]]);silent.setItem=()=>{};
    assert.throws(()=>backupGrainSave(silent,key,raw),/未能核实/);assert.equal(silent.getItem(key),raw);
});
test('protected autosave refuses quota failure and concurrent changes, then permits verified recovery',()=>{
    const raw='{broken',s=storage([[key,raw]]),guard=protectSave(s,key,raw);
    assert.throws(()=>guard.write('new'),/未安全备份/);assert.equal(s.getItem(key),raw);
    const backup=guard.backup();s.setItem(key,'other-window');
    assert.throws(()=>guard.write('new'),/其他窗口/);assert.equal(s.getItem(key),'other-window');
    s.setItem(key,raw);guard.write('new');guard.write('next');
    assert.equal(s.getItem(key),'next');assert.equal(s.getItem(backup),raw);
    const blocked=storage([[key,raw]],k=>k.includes(':recovery:')),protectedBlocked=protectSave(blocked,key,raw);
    assert.throws(()=>protectedBlocked.backup(),/Quota/);assert.throws(()=>protectedBlocked.write('new'));
    assert.equal(blocked.getItem(key),raw);
});

test('history inserts each accepted reply where it occurred and does not reveal an unread current line',()=>{
    const nodes=[{id:'before',kind:'line',speaker:'我',text:'先谈一谈'}, {id:'O1',kind:'open'}, {id:'after',kind:'line',speaker:'苟安',text:'查账完了'}, {id:'choice',kind:'choice',options:[{id:'selected',text:'如实报告'},{id:'unused',text:'离开'}]}, {id:'O2',kind:'open'}, {id:'unread',kind:'line',speaker:'我',text:'未读的下一句'}];
    const judgments={O1:{input:'我去查账',reply:'我等你回来'},O2:{input:'现在送报',reply:'一同去'}};
    const state={visited:['before','O1','after','choice'],node:'O2',chosen:['selected'],judgments};
    const session={story:{nodes},state};
    assert.deepEqual(grainHistory(session).map(r=>r.text),['先谈一谈','我去查账','我等你回来','查账完了','如实报告','现在送报','一同去']);
    state.visited.push('O2');state.node='unread';
    assert.equal(grainHistory(session).at(-1).text,'一同去');
    judgments.O1={input:'我先核实再回来',reply:'好，我等你'};
    assert.equal(grainHistory(session).filter(r=>r.text==='好，我等你').length,1);
    assert.ok(!grainHistory(session).some(r=>r.text==='我等你回来'));
});
