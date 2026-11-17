import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const build=process.env.GAME_TEST_BUILD??resolve(root,'GameStarter/web-demo/.build');
const f=await dialogueFixtures(build);
const {roleLabelMigration}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/chapter-one/content-version-compatibility.js')));

test('the role-label compatibility pair differs by exactly the four verified display strings',()=>{
  const script=readFileSync(resolve(build,'story/chapter-one.script.json'));
  const flow=readFileSync(resolve(build,'story/chapter-one.flow.json'),'utf8');
  assert.equal(createHash('sha256').update(script).update(flow).digest('hex'),roleLabelMigration.to);
  const old=flow.replace('"把急报交给守帐军士"','"把急报交给甲"')
    .replaceAll('"向守帐军士问清禁令"','"向甲问清禁令"')
    .replace('"向传报军士打听当值"','"向乙打听当值"');
  assert.equal(createHash('sha256').update(script).update(old).digest('hex'),roleLabelMigration.from);
});

test('the preceding wording version restores both rounds without losing earned facts or input',async()=>{
  for(const source of [f.first(),await f.authorized()]) {
    source.setDraft('保留已经输入的话。');
    const old=source.snapshot(); old.contentVersion=roleLabelMigration.from; delete old.displayedRows;
    const target=new f.ChapterSession(f.content,f.flow,roleLabelMigration.to);
    target.restore(JSON.stringify(old)); const after=target.snapshot();
    assert.equal(after.contentVersion,roleLabelMigration.to); assert.equal(after.phase,old.phase); assert.equal(after.scene,old.scene);
    for(const key of ['completed','collected','selected','edges','draft','history']) assert.deepEqual(after.story[key],old.story[key]);
    assert.deepEqual(after.supplies,old.supplies);
    if(old.thinking) assert.deepEqual(after.thinking,old.thinking);
    else { assert.deepEqual(after.thinking?.placed??[],[]); assert.deepEqual(after.thinking?.history??[],[]); }
    if(old.round===2) assert.equal(after.story.flags.JIANG_AUTH_GRANTED,true);
  }
});

test('role-label compatibility rejects unknown/reverse versions and missing authorization events',async()=>{
  const saved=(await f.authorized()).snapshot();
  for(const [from,to] of [['unknown-version',roleLabelMigration.to],[roleLabelMigration.to,roleLabelMigration.from],[roleLabelMigration.from,'unverified-version']]) {
    const target=new f.ChapterSession(f.content,f.flow,to),before=target.snapshot();
    assert.throws(()=>target.restore(JSON.stringify({...saved,contentVersion:from})),/版本不兼容/);
    assert.deepEqual(target.snapshot(),before);
  }
  const missing={...saved,contentVersion:roleLabelMigration.from}; delete missing.displayedRows;
  missing.story.completed=missing.story.completed.filter(id=>id!=='J10A');
  const target=new f.ChapterSession(f.content,f.flow,roleLabelMigration.to),before=target.snapshot();
  assert.throws(()=>target.restore(JSON.stringify(missing)),/来源/);
  assert.deepEqual(target.snapshot(),before);
});
