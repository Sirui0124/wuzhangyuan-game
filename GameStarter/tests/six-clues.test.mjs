import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { currentClueSources, freshReview, commitRow } from '../web-demo/.build/GameStarter/web-demo/src/thought-canvas-model.js';
import { sixClueMigration } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/clue-save-migration.js';
import { roleLabelMigration } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/content-version-compatibility.js';
import { compactWeiyanFacts } from '../web-demo/.build/GameStarter/web-demo/src/weiyan-facts.js';
const f = await dialogueFixtures(fileURLToPath(new URL('../web-demo/.build/', import.meta.url)));
const branchStory = JSON.parse(readFileSync(new URL('../web-demo/.build/story/chapter-one.branch.json', import.meta.url)));

test('runtime has seven fact IDs with separate duty and consent, including first-round branches', () => {
    assert.deepEqual(f.content.clues.map(c => [c.id, c.summary]), [
        ['C02', '此前袭扰，闻号即退'], ['C03', '今夜闻号不退，交替试探两翼'],
        ['C05', '魏军探问丞相与发令者'], ['C06', '帐前禁令'],
        ['C07', '姜维可以代为处理军务'], ['C08', '姜维已答应帐外接报'], ['T02', '营门尚未失守'],
    ]);
    for (const branch of ['a', 'b']) {
        const s = f.first(undefined, undefined, branch);
        assert.deepEqual(new Set(s.collected), new Set(branch === 'a' ? ['C06', 'T02', 'C05'] : ['C06', 'C05']));
        assert.deepEqual(new Set(s.snapshot().story.selected), new Set(s.collected));
        for (const id of ['C01', 'C04', 'C07', 'C09', 'C10', 'T01', 'T03']) assert.equal(s.selectEvidence(id), false);
    }
});

test('merged cards disclose only complete source groups and the current ban version', () => {
    assert.deepEqual(currentClueSources('C06', ['A-17']), ['A-17']);
    assert.deepEqual(currentClueSources('C06', ['A-17', 'D02', 'D05']), ['D02']);
    assert.deepEqual(currentClueSources('C06', ['A-17', 'D02', 'D05', 'D06']), ['D02', 'D05', 'D06']);
    assert.deepEqual(currentClueSources('C03', ['D18', 'D19']), []);
    const base = ['D18', 'D19', 'D20'];
    assert.deepEqual(currentClueSources('C03', [...base, 'D22']), base);
    assert.deepEqual(currentClueSources('C03', [...base, 'D22', 'D23', 'D24']), [...base, 'D22', 'D23', 'D24']);
    const evidence = completed => [{ id: 'C03', summary: '今夜军情', boundary: '', originals: currentClueSources('C03', completed).map(id => ({ id, speaker: '斥候', text: '' })) }];
    assert.equal(compactWeiyanFacts(evidence(base)).status.campSituation.state, '未知');
    assert.equal(compactWeiyanFacts(evidence([...base, 'D24'])).status.campSituation.state, '已知');
});

test('a last commitment sentence and a remembered source cannot grant unperformed events', () => {
    const save = freshReview(f.content.version);
    commitRow(save, 'D26'); assert.ok(!save.collected.includes('C05'));
    commitRow(save, 'J11'); assert.ok(!save.collected.includes('C08'));
    assert.equal(save.flags.JIANG_AUTH_GRANTED, undefined);
});

function legacySnapshot(s) {
    const saved = s.snapshot(); saved.contentVersion = sixClueMigration.from;
    delete saved.displayedRows; // The historical schema had no displayed-text snapshot.
    const first = saved.round === 1;
    const aliases = { C06: first ? 'T01' : 'C06', C05: first ? 'T03' : 'C05' };
    const map = ids => ids.map(id => aliases[id] ?? id);
    saved.story.collected = map(saved.story.collected);
    if (!first) saved.story.collected.push('C01', 'C04', 'C07', 'C09', 'C10');
    saved.story.selected = map(saved.story.selected);
    saved.composition.evidenceIds = map(saved.composition.evidenceIds);
    if (saved.speech) saved.speech.selected = map(saved.speech.selected);
    if (!first) saved.story.edges = [['C02', 'C03'], ['C03', 'C04'], ['R01', 'C06'], ['C06', 'C07']];
    return saved;
}
test('the immediately preceding first and authorized saves retain wording, money and real progress', async () => {
    for (const source of [f.first(), await f.authorized()]) {
        source.setDraft('这一句是已经保存的措辞。');
        const old = legacySnapshot(source), restored = new f.ChapterSession(f.content, f.flow, roleLabelMigration.to);
        restored.restore(JSON.stringify(old));
        assert.equal(restored.snapshot().story.draft, old.story.draft);
        assert.deepEqual(restored.snapshot().supplies, old.supplies);
        assert.deepEqual(restored.snapshot().story.completed, old.story.completed);
        assert.ok(restored.collected.every(id => f.content.clues.some(c => c.id === id)));
        if (old.round === 2) { assert.ok(restored.graph().R02); assert.ok(restored.snapshot().story.flags.JIANG_AUTH_GRANTED); }
        else assert.deepEqual(new Set(restored.collected), new Set(['C06', 'T02', 'C05']));
    }
});
test('legacy aliases never bypass the actual C08 source checks', async () => {
    const old = legacySnapshot(await f.authorized());
    const current = new f.ChapterSession(f.content, f.flow, f.version, undefined, undefined, 'offline', branchStory);
    current.restore(JSON.stringify(old));
    assert.equal(current.snapshot().phase, 'cinematic');
    assert.equal(current.branch.dialogue.state.jiangAgreed, false);
    old.story.completed = old.story.completed.filter(id => id !== 'J10A');
    const restored = new f.ChapterSession(f.content, f.flow, roleLabelMigration.to);
    assert.throws(() => restored.restore(JSON.stringify(old)), /来源/);
    assert.throws(() => current.restore(JSON.stringify(old)), /来源/);
});
