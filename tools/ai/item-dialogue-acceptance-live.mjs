/** Explicit model acceptance tests. Products and purchases exist only in isolated in-memory sessions. */
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dialogueFixtures } from './dialogue-fixtures.mjs';

const build = resolve(process.env.DIALOGUE_BUILD ?? 'outputs/ai-dialogue-repair-20261027/build');
const out = resolve(process.env.ITEM_DIALOGUE_REPORT ?? 'outputs/ai-dialogue-repair-20261027/items-live-1');
const product = (n, name, ability, boundary) => ({ id: `shop-${String(n).padStart(8, '0')}-1234-4234-8234-123456789012`, name, ability, boundary,
    price: 500, icon: '物', source: '', quote: '仅供隔离测试的模拟估价。', date: '2026-10-27', priceKind: 'estimate', searchState: 'empty',
    sources: [], why: '测试对白润色、人物反应与通关衔接。', request: '隔离测试商品，无现实购买' });
const products = {
    wine: product(1, '白酒一小瓶', '供成年人少量饮用的普通白酒。', '不治伤、不赋予权力；饮用需对方自愿，不能把持有视为对方已喝下。'),
    battery: product(2, '5号电池两节', '给兼容5号电池的设备供电。', '不含设备，电池本身不能录音、传声、照明或证明人物生死。'),
    notebook: product(3, '横线笔记本一本，不含笔', '配合书写工具可记录实际听到的文字。', '当前不含笔，必须另有书写工具才能书写；记录不等于授权。'),
    stationery: product(4, '纸笔记录套装，一本一支', '笔墨齐备，可以现场记录口述文字，供当事人复核。', '只能记录实际听到的内容，不等于他人签署或授权，不能保证不抄错。'),
    lamp: product(5, '充满电的小型手电筒', '按开关即可照亮眼前一小片地方。', '只作普通照明，光不能透过帐篷或证明帐内人物生死，不等于军令。'),
    whistle: product(6, '普通铜哨一个', '可由人吹响，在近处听见短长哨声。', '只能发出声响，需先约定含义、试验听见范围，不会自行传递完整军报。'),
    mirror: product(7, '小铜镜一面', '映照近处人或物，可供普通展示。', '不能窥见远处、帐内情况或预测未来，不证明人物生死。'),
};
const common = { selected: ['C06', 'C08', 'R01'], expected: 'accept', route: null, polish: 'generate' };
const cases = [
    { ...common, id: 'wine-offer', item: 'wine', words: '请将军随我到帐外交报。这瓶白酒也送给将军，不喝也无妨，别耽误军情。', ideal: '承接递酒，可以拒饮、催收或调侃，然后明确同意带路；不能编造已经饮酒或收下。' },
    { ...common, id: 'unrelated-carried-battery', item: 'battery', words: '请将军现在跟我去帐外交报。这两节电池我只是带着，军报不靠它。', ideal: '无关携带不提高主线门槛；可简短回应这小物件，再接受交报，不编造用途。' },
    { ...common, id: 'optional-notebook-without-pen', item: 'notebook', words: '请将军现在随我到帐外交报。我带了本子，若有笔还可记下口令再请伯约核对；眼下没笔，仍先当面口述，别耽误交报。', ideal: '可指出笔未备好、暂不用记录办法，同时接受独立成立的口述交报；不能批准无笔写字。' },
    { ...common, id: 'paper-pen-record', item: 'stationery', route: 'item-plan', words: '请将军现在随我到帐外当面交报，不进丞相帐。交报时我用这套纸笔记下伯约实际说出的口令，逐句念回，请他核对后再照回令办。', ideal: '接受有纸有笔的记录复核办法，先完成原交接，不宣称已经记录或取得新授权。' },
    { ...common, id: 'ordinary-light-display', item: 'lamp', words: '请将军随我到帐外交报。我把这小灯点亮给您看看，只是眼前照明的小物件，随后收好，不拿它传军令。', ideal: '普通点亮可以引出魏延反应，并继续交报；不解释成神迹、试通信号或已探明帐内。' },
    { ...common, id: 'noncatalog-whistle-plan', item: 'whistle', route: 'item-plan', words: '请将军现在随我到帐外向伯约交清军报、核对回令，不入丞相帐。之后可用这枚铜哨在近处召人，先约定短长声的意思并试过听得见，再作提醒；详细军报仍当面说。', ideal: '普通铜哨不在旧商品目录也能按声响和限制判断，接受可试验的辅助办法，保留原交报。' },
    { ...common, id: 'mirror-curiosity', item: 'mirror', words: '请将军现在随我去帐外交报。我也把这面小铜镜给您瞧一眼，路上解个闷，不影响送报。', ideal: '允许展示、好奇或不耐烦等人物反应；不要求镜子必须帮助传军报，不额外消耗。' },
    { ...common, id: 'only-offer-wine', item: 'wine', selected: [], words: '将军，这瓶白酒送给您。', expected: 'revise', ideal: '只递酒没有军报方案，魏延可以拒饮或问眼前正事，保持可修改；普通物品闲话不能新增斩首。' },
    { ...common, id: 'dependent-writing-without-pen', item: 'notebook', expected: 'revise', words: '请将军随我去帐外，但先等我用这本子把军报写完才交给伯约；不必另外找笔。', ideal: '忠实生成可编辑稿，不提前拦截或改成先口述。确认后由魏延指出缺笔，主线仍待修改。' },
    { ...common, id: 'drink-before-report', item: 'wine', expected: 'revise', words: '请将军随我去帐外交报，不过先把这瓶酒喝完，军报等喝完再送。', ideal: '保留玩家明确拖延的意思，魏延拒绝先喝后报，不能因其他主线条件齐全而通过。' },
    { ...common, id: 'item-proves-false-death', item: 'mirror', expected: 'revise', words: '请将军随我去帐外交报。这面镜子已经证明丞相死了，绝不会有错。', ideal: '润色保留玩家无据断言为可编辑稿，不报审核失败；确认后魏延质疑镜子证明死亡的说法，不通过。' },
    { ...common, id: 'battery-only-relay', item: 'battery', expected: 'revise', words: '请将军随我去帐外，不过先把这两节电池一人拿一节，用电池隔空说完全部军报，再去见伯约。', ideal: '润色保留电池传话和先后条件，不改成路上备用，不提前报审核失败；确认后由魏延指出缺设备并要求修改。' },
];
mkdirSync(out, { recursive: true });
const standard = { version: 'item-dialogue-acceptance-20261027-v2-no-polish-gate', fixedBeforeRequests: true, concurrency: 2,
    standard: '润色只形成可编辑稿，不以事实或语义审核拦截。玩家确认后由NPC判断剧情后果。物品可以有趣但不自动授予通关；独立成立主线不因普通物品而变难。',
    checks: ['润色不推进剧情、加分或消耗物品', '保留选中材料、条件、行动人和原意，错误办法也可生成和提交', '正文尽量简短，二次仍较长须保留完整可编辑稿', 'NPC回应贴合物品与本次发言', '确认并读回应后实际进入预期后续', '未采纳物品不消耗、不生成物品结局', '失败保留原稿和库存，可修改'],
    limitation: '自动断言覆盖结构、长度、判定与状态，理想回应按含义审核，不要求逐字照抄；不代表用户审美审核。',
    cases: cases.map(c => ({ ...c, product: products[c.item] })) };
writeFileSync(resolve(out, 'expected.json'), JSON.stringify(standard, null, 2));
if (process.argv.includes('--prepare')) { console.log(JSON.stringify({ prepared: out, cases: cases.length, requests: 0 })); process.exit(0); }
if (!process.argv.includes('--live')) throw Error('Explicit --live required; --prepare writes the fixed standards without model requests.');

const imp = name => import(pathToFileURL(resolve(build, 'GameStarter/web-demo/src/' + name + '.js')));
const { expressionAgents } = await imp('expression-agent');
const { expressionLengthBudget } = await imp('expression-scene-prompts');
const { GameApi } = await import(pathToFileURL(resolve(build, 'GameStarter/assets/scripts/GameApi.js')));
const f = await dialogueFixtures(build), api = new GameApi(), tracing = new AsyncLocalStorage(), realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
    const active = tracing.getStore();
    if (!active || !String(url).endsWith('/api/game/respond')) return realFetch(url, options);
    const request = JSON.parse(options.body), call = { prompt: request.text, temperature: request.temperature, startedAt: new Date().toISOString() };
    active.calls.push(call);
    try {
        const response = await realFetch(url, options), body = await response.clone().json();
        call.status = response.status; call.response = body.text ?? body.error; call.usage = body.usage;
        return response;
    } catch (error) { call.error = error.message; throw error; }
};
const agent = expressionAgents(api), results = [];
const wanted = process.env.ITEM_DIALOGUE_CASE?.split(','), queue = cases.filter(c => !wanted || wanted.includes(c.id));
function progression(s) { const v = s.snapshot(); return { phase: v.phase, section: v.section, end: v.end, historyLength: v.story.history.length,
    reportClosed: v.story.flags.REPORT_CLOSED ?? false, agreement: v.supplies.agreement, consumed: v.supplies.consumed, attached: v.supplies.attached, purchases: v.supplies.purchases }; }
function complete(s) {
    f.read(s);
    for (let i = 0; i < 18 && s.snapshot().phase !== 'ending'; i++) {
        const state = s.snapshot();
        if (state.phase === 'cinematic') { assert.ok(s.finishCinematic()); f.read(s); continue; }
        const action = f.flow.actions.find(a => a.round === 2 && !state.finishedSections.includes(a.section) && a.requires.every(id => state.finishedSections.includes(id)));
        assert.ok(action, 'next authored handoff action exists'); f.act(s, action.id);
    }
    assert.equal(s.snapshot().phase, 'ending');
}
async function run(c) {
    const r = { id: c.id, expected: c.expected, expectedRoute: c.route, ideal: c.ideal, startedAt: new Date().toISOString(), calls: [] };
    await tracing.run(r, async () => {
        try {
            const s = await f.authorized(agent.judge, agent.generate), item = products[c.item];
            for (const id of [...s.snapshot().story.selected]) s.selectEvidence(id);
            for (const id of c.selected) assert.ok(s.selectEvidence(id));
            // This mutates only this test session; no network purchase endpoint or real player save is involved.
            assert.ok(s.buySuggestedItem(item)); assert.ok(s.attachItem(item.id)); s.setFocus(c.words);
            r.before = progression(s);
            const generated = await s.generateExpression();
            r.polish = { generated, error: s.snapshot().composition.error, diagnostic: s.snapshot().composition.diagnostic, text: s.snapshot().story.draft };
            assert.deepEqual(progression(s), r.before, 'polishing cannot progress or consume items');
            assert.ok(generated, 'polishing must return an editable draft: ' + r.polish.error);
            if (generated) {
                r.text = s.snapshot().story.draft;
                const call = r.calls.findLast(x => x.prompt.includes('你是历史游戏的台词编辑'));
                const payload = JSON.parse(call.prompt.slice(call.prompt.lastIndexOf('资料：') + 3));
                r.maximum = expressionLengthBudget(payload.brief ?? payload).maximum;
                r.withinSuggestedMaximum = [...r.text].length <= r.maximum;
            }
            assert.ok(await s.confirmExpression(), 'real NPC judgment is adopted by the session');
            r.judgment = structuredClone(s.snapshot().speech);
            r.response = r.judgment.npcTurn.reply.text;
            assert.equal(r.judgment.result === 'ok', c.expected === 'accept', 'expected acceptance or revision');
            assert.equal(r.judgment.itemDecision?.route ?? null, c.route, 'expected optional item route');
            assert.ok(s.acknowledgeReply(), 'read the actual NPC reply'); r.afterReading = progression(s);
            if (c.expected === 'accept') {
                assert.equal(s.snapshot().section, 'weiyan-cooperation');
                if (!c.route) { assert.equal(s.snapshot().supplies.agreement, null); assert.deepEqual(s.snapshot().supplies.consumed, []); }
                else { assert.equal(s.snapshot().supplies.agreement.route, c.route); assert.deepEqual(s.snapshot().supplies.consumed, [item.id]); }
                complete(s); r.finished = progression(s);
                assert.equal(s.snapshot().end, c.route ?? 'safe'); assert.equal(s.snapshot().story.flags.REPORT_CLOSED, true);
            } else {
                assert.equal(s.snapshot().phase, 'reply'); assert.equal(s.snapshot().supplies.agreement, null); assert.deepEqual(s.snapshot().supplies.consumed, []);
                assert.ok(s.reviseExpression()); assert.equal(s.snapshot().story.draft, r.text); r.revised = progression(s);
            }
            const restored = await f.authorized(agent.judge, agent.generate); restored.restore(s.serialize());
            assert.deepEqual(progression(restored), progression(s)); r.restored = true; r.passed = true;
        } catch (error) { r.passed = false; r.error = error.message; }
    });
    r.durationMs = Date.now() - Date.parse(r.startedAt); results.push(r);
    writeFileSync(resolve(out, c.id + '.json'), JSON.stringify(r, null, 2));
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ id: c.id, passed: r.passed, text: r.text, response: r.response, outcome: r.judgment?.result, route: r.judgment?.itemDecision?.route, next: r.afterReading, error: r.error }));
}
await Promise.all([0, 1].map(async () => { while (queue.length) await run(queue.shift()); }));
console.log(JSON.stringify({ out, total: results.length, passed: results.filter(r => r.passed).length }));
if (results.some(r => !r.passed)) process.exitCode = 1;
