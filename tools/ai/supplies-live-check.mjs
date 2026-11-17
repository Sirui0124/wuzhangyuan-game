/** Explicit opt-in live API validation; never reads or logs settings/credentials. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { ChapterSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { withItemDialogue } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/item-dialogue.js';
import { GameApi } from '../../GameStarter/web-demo/.build/GameStarter/assets/scripts/GameApi.js';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const content = read('content/chapters/wuzhang/chapter-one.script.json');
const flow = read('content/chapters/wuzhang/chapter-one.flow.json');
const fixture = read('GameStarter/web-demo/.build/playtest/weiyan-second.json');
const judge = withItemDialogue(new GameApi(), async () => { throw new Error('This check only covers attached items'); });
const cases = [
    ['radio-pair', 'radio-relay', '姜维已在帐外等候，我们立即当面交报并核回令。随后将两台对讲机分给你和姜维，先试通再传讯，每次核对身份和军令。不入丞相帐。'],
    ['flashlight', 'light-signal', '伯约已在帐外等候，我们现在就去当面交报并核回令，不入丞相帐。之后双方约定手电筒灯号，在帐外试过视线才使用；灯号只作提醒，详细军情仍由人传。'],
    ['radio-pair', null, '这件对讲机就是诸葛亮已经死了的证据，你现在应该撤军。'],
    ['batteries', null, '姜维已在帐外等候，先当面交报并核回令，不入帐。然后把这两节电池分给你和姜维，就能隔空说话。'],
    ['radio-pair', null, '别管军报了，我有这两只盒子，声音可以传到任何地方。'],
    [{ id: 'shop-12345678-1234-4234-8234-123456789012', name: 'A5横线笔记本2本（不含笔）', ability: '可手写记录口令、时间，便于核对。', boundary: '只有本子，需自备书写工具，当前未包含笔。' }, null,
        '不入丞相帐，立即向姜维交清军报并核回令。我用这套纸笔当面记下姜维口令，念回去请他核对。'],
];
const results = [];
for (const [item, expected, words] of cases) {
    const session = new ChapterSession(content, flow, fixture.contentVersion); session.restore(JSON.stringify(fixture));
    if (typeof item === 'string') { const old = session.snapshot(); old.supplies = { version: 1, rewards: ['R01', 'R02'], purchases: [item], attached: [], agreement: null }; session.restore(JSON.stringify(old)); session.attachItem(item); }
    const start = Date.now();
    try {
        const input = session.expressionContext(words);
        if (typeof item === 'object') input.items = [item];
        const turn = await judge(input, new AbortController().signal);
        const route = turn.itemDecision?.route ?? null;
        results.push({ item, expected, route, passed: route === expected, reply: turn.npcTurn.reply.text, ms: Date.now() - start });
    } catch (error) { results.push({ item, expected, passed: false, error: error.message, ms: Date.now() - start }); }
    console.log(JSON.stringify(results.at(-1)));
}
mkdirSync('outputs/supplies-20261024', { recursive: true });
writeFileSync('outputs/supplies-20261024/live-model-report.json', JSON.stringify({ results, passed: results.every(r => r.passed) }, null, 2));
if (results.some(r => !r.passed)) process.exitCode = 1;
