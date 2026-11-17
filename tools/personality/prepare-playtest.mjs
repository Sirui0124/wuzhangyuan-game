import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function preparePersonalityPlaytest(destination) {
    const read = path => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url)));
    const runtime = 'GameStarter/web-demo/src/';
    const load = path => import(pathToFileURL(resolve(destination, runtime + path)));
    const [{ createPersonalityStore }, { normalizePersonalityConfig }, { GrainSession }, { parseJudgment }] = await Promise.all([
        load('personality/store.js'), load('personality/config.js'), load('chapters/chapter-two/session.js'), load('chapters/chapter-two/open-dialogue.js'),
    ]);
    const config = normalizePersonalityConfig(...['characters-and-model', 'chapter-one-two-scoring', 'chapter-three-scoring']
        .map(name => read(`docs/design/personality/${name}.json`)));
    const witness = read('tools/personality/preview-witness.json');
    const fixtures = read('docs/design/personality/open-answer-fixtures.json').fixtures;
    const story = read('content/chapters/grain/chapter-two.films.json');
    const rubric = read('content/chapters/grain/chapter-two.films-rubric.json');
    const store = createPersonalityStore({ storage: null, now: () => '2026-10-27T00:00:00.000Z', newRunId: () => 'personality-preview' });
    store.configure(config);
    store.startChapter('wuzhang', { tutorial: true });
    store.archiveDeath({ chapterId: 'wuzhang', endingId: 'tutorial-sacrifice', title: '帐前传报', text: '首轮必经教学，不计人格。' });
    store.finishTutorial();
    function recordOpen(chapterId, nodeId, fixtureId) {
        const fixture = fixtures.find(f => f.id === fixtureId);
        const token = store.makeOpenToken({ chapterId, nodeId, input: fixture.text });
        if (!token || !store.recordOpen({ token, vector: fixture.values, quotes: fixture.quotes }).accepted) throw new Error('Invalid personality preview evidence');
        return fixture;
    }
    recordOpen('wuzhang', 'P2-01', witness.chapterOne.r2);
    if (witness.chapterOne.tent) store.recordChoice({ chapterId: 'wuzhang', optionId: witness.chapterOne.tent });
    store.completeChapter('wuzhang', 'safe');
    store.startChapter('grain');
    const session = new GrainSession(story, undefined, rubric, false);
    const nodes = new Map(story.nodes.flatMap(node => (node.options ?? []).map(option => [option.id, node.id])));
    const desired = new Map(witness.chapterTwo.choices.map(id => [nodes.get(id), id]));
    desired.set('UI-N5', 'N5-' + witness.chapterTwo.action);
    desired.set('UI-EARLY', witness.chapterTwo.action === 'early' ? 'early-stop' : 'early-continue');
    desired.set('UI-FALLBACK', witness.chapterTwo.fallback === 'C' ? 'fallback-release' : 'fallback-case');
    for (let guard = 0; guard < 200 && session.current.kind !== 'finish'; guard++) {
        const node = session.current;
        if (node.kind === 'open') {
            const fixture = recordOpen('grain', node.id, node.round === 'O1' ? witness.chapterTwo.o1 : witness.chapterTwo.o2);
            const scores = Object.fromEntries(['trust', 'rigor', 'responsibility'].map((key, i) => [key,
                { delta: fixture.storyScores[i], quote: fixture.storyScores[i] ? fixture.text : '', reason: '隔离展示使用设计样例。' }]));
            if (!session.submit(parseJudgment(JSON.stringify({ valid: true, scores }), fixture.text, session.currentRubric))) throw new Error('Invalid preview story answer');
        }
        const option = node.kind === 'choice' ? desired.get(node.id) ?? node.options.find(o => o.id.endsWith('-confirm'))?.id ?? node.options[0].id : undefined;
        if (!session.advance(option)) throw new Error('Unreachable preview node: ' + node.id);
        if (option) store.recordChoice({ chapterId: 'grain', nodeId: node.id, optionId: option });
    }
    if (session.current.ending !== witness.chapterTwo.ending) throw new Error('Preview ending changed');
    store.completeChapter('grain', session.current.ending);
    if (store.getView().character?.name !== witness.character) throw new Error('Preview personality changed');
    mkdirSync(resolve(destination, 'playtest'), { recursive: true });
    writeFileSync(resolve(destination, 'playtest/personality.json'), JSON.stringify({
        preview: true, source: '人工标注的设计回放，仅用于查看页面；不代表真实模型实测。',
        state: { ...session.state, personality: { checkpoint: store.createCheckpoint('grain'), sources: {} } },
        personalityState: store.getState(),
    }));
}
