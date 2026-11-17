import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { polishFixtures } from './dialogue-polish-fixtures.mjs';
import { dialogueFixtures } from './dialogue-fixtures.mjs';

// Explicit live acceptance suite. No purchases, settings writes, or player saves.
if (!process.argv.includes('--live')) throw Error('Explicit --live required');
const build = process.env.DIALOGUE_BUILD ?? 'outputs/ai-dialogue-repair-20261027/build';
const out = resolve(process.env.DIALOGUE_REPORT ?? 'outputs/ai-dialogue-repair-20261027/live-' + new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(out, { recursive: true });
const imp = name => import(pathToFileURL(resolve(build, 'GameStarter/web-demo/src/' + name + '.js')));
const { polishDialogue, dialoguePolishLengthLimit } = await imp('dialogue-polish');
const { expressionAgents } = await imp('expression-agent');
const { expressionLengthBudget } = await imp('expression-scene-prompts');
const { judgeJietingDialogue } = await imp('chapters/chapter-three/open-dialogue');
const { judgeOpenDialogue } = await imp('chapters/chapter-two/open-dialogue');
const { GameApi } = await import(pathToFileURL(resolve(build, 'GameStarter/assets/scripts/GameApi.js')));
const tracing = new AsyncLocalStorage(), realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
    const result = tracing.getStore();
    if (!result || !String(url).endsWith('/api/game/respond')) return realFetch(url, options);
    const request = JSON.parse(options.body), call = { prompt: request.text, temperature: request.temperature };
    result.calls.push(call);
    const response = await realFetch(url, options);
    const body = await response.clone().json();
    call.status = response.status; call.response = body.text ?? body.error;
    return response;
};

export const acceptance = {
    version: 'dialogue-acceptance-20261027-v3-player-confirmation',
    modules: {weiyan: ['首次代为转达','授权后帐外交报'], gouan: ['O1劝留查粮','O2补救与责任'], masu: ['R1增兵','R2增兵','R3增兵','R4增兵','R5增兵','撤军','诱敌']},
    input: '当前说话人与听话人、当前问题、已选且实际取得的线索核心含义、玩家原话、真实可用物品与实际说过的本轮历史。原始对白只供核验；重复含义可合并，不能背出未选或未取得的事实。',
    brevity: '简单请求通常50至100字；多线索与物品通常100至160字，随不同条件适当放宽。去掉重复背景、职责和请求，保留核心事实、先后及条件。长度是开发质量目标，不作为玩家提交门槛。NPC只回应当前决定或缺口，复杂马谡回应正文最多100字、追问最多60字。',
    polish: '以已选事实与玩家方向组织短稿，保留因果、条件、行动人和推测程度；不新增授权、承诺或已完成效果。错误、无关和冒犯原意也交付可编辑草稿，不再执行运行时语义审核或要求玩家过审；确认后的NPC负责判断。超长最多压缩一次，不截断。',
    continuity: '只沿用本次交涉已确认说出的内容；最新撤回优先，不把未核实历史当新证据。',
    npc: '回应当前话语与物品，接受就明确接受，缺少条件只问真缺口；不能判已接受后继续拒绝或增设考试。',
    items: '不改变独立成立主线的门槛；普通展示、递送可引出角色反应；新方案按规格、条件和实际用途判断，不按品名白名单。',
    progress: '润色不推进；确认后的有效结果能由会话状态接受，并在读完回应后进入相应后续。',
    negative: '仅有物品或事实但无必要行动，不替玩家自动作出选择；缺件、无据断言、错误依赖仍可生成和提交，由NPC判相应后果。物品只是附带时不牵连独立成立的军报交接；若玩家明确先喝酒或必须靠无效物品传报，则保留该冲突。无关冒犯按原剧情走处斩，而不是润色不过审。',
    limitations: '自动断言检查结构、字数与状态；全文另由执行者检查自然程度、事实和回应一致性，不等于用户审核。',
};
writeFileSync(resolve(out, 'standard.json'), JSON.stringify(acceptance, null, 2));
const f = await dialogueFixtures(build), api = new GameApi(), agent = expressionAgents(api);
const selectOnly = (s, ids) => {
    for (const id of [...s.snapshot().story.selected]) s.selectEvidence(id);
    for (const id of ids) assert.ok(s.selectEvidence(id), 'available selected evidence: ' + id);
};
const cases = (await polishFixtures(build)).map(c => ({ ...c, expected: 'accept' }));
cases.push(
    { id: 'weiyan-first', chapter: 'wuzhang', stage: 'first', selected: ['C06', 'C05'], words: '我来帮你转达', expected: 'accept' },
    { id: 'weiyan-authorized', chapter: 'wuzhang', stage: 'authorized', selected: ['C06', 'C08', 'R01'], words: '请将军跟我去帐外交报。', expected: 'accept' },
    { id: 'weiyan-first-no-action', chapter: 'wuzhang', stage: 'first', selected: ['C06', 'C05'], words: '', expected: 'revise' },
    { id: 'weiyan-off-topic', chapter: 'wuzhang', stage: 'first', selected: [], words: '我才不管军报，咱们去喝酒赌钱，丞相死活与我无关。', expected: 'execute' },
    { id: 'weiyan-followup', chapter: 'wuzhang', stage: 'authorized', selected: ['C08'], words: '请将军跟我去帐外交报。', expected: 'accept', previous: '与往夜闻号便退不同，今夜敌军不退；我军一调动，他们便跟着换向，恐怕是在试探。' },
);
let wanted = process.env.DIALOGUE_CASE?.split(',');
const queue = cases.filter(c => !wanted || wanted.includes(c.id)), results = [];
async function run(c) {
    const result = { id: c.id, expected: c.expected, startedAt: new Date().toISOString(), calls: [] };
    await tracing.run(result, async () => {
        try {
            const signal = AbortSignal.timeout(240000);
            if (c.chapter === 'wuzhang') {
                const s = c.stage === 'first' ? f.first(agent.judge, agent.generate) : await f.authorized(agent.judge, agent.generate);
                if (c.previous) {
                    s.setDraft(c.previous); assert.ok(await s.confirmExpression());
                    result.previous = structuredClone(s.snapshot().speech);
                    assert.notEqual(s.snapshot().speech.result, 'ok');
                    assert.ok(s.acknowledgeReply()); assert.ok(s.reviseExpression()); s.setDraft('');
                }
                selectOnly(s, c.selected); s.setFocus(c.words);
                assert.ok(await s.generateExpression(), s.snapshot().composition.error);
                result.text = s.snapshot().story.draft;
                const writer = result.calls.findLast(call => call.prompt.includes('你是历史游戏的台词编辑'));
                const data = JSON.parse(writer.prompt.slice(writer.prompt.lastIndexOf('资料：') + 3));
                const brief = data.brief ?? data;
                result.maximum = expressionLengthBudget(brief).maximum;
                result.withinSuggestedMaximum = [...result.text].length <= result.maximum;
                assert.ok(await s.confirmExpression(), 'NPC result must be adopted by session');
                result.judgment = structuredClone(s.snapshot().speech);
                assert.equal(result.judgment.result === 'ok', c.expected === 'accept');
                if(c.expected==='execute')assert.equal(result.judgment.result,'execute','unrelated defiance must reach the original execution result');
                result.response = result.judgment.npcTurn.reply.text;
                assert.ok(s.acknowledgeReply(), 'read NPC reply');
                if(c.expected==='execute'){
                    assert.ok(s.finishExecution(),'execution scene must finish');
                    assert.equal(s.snapshot().end,'weiyan-execution');
                }
                result.next = { phase: s.snapshot().phase, section: s.snapshot().section, end:s.snapshot().end };
            } else {
                result.input = c.input;
                result.text = await polishDialogue(c.input, signal, api);
                result.maximum = dialoguePolishLengthLimit(c.input);
                result.withinSuggestedMaximum = [...result.text].length <= result.maximum;
                c.session.state.draft = result.text;
                if (c.chapter === 'grain') {
                    result.judgment = await judgeOpenDialogue(result.text, c.session.currentRubric, c.session.clues, signal, [], [], { responseContext: c.session.dialogueResponseContext });
                    assert.ok(Object.values(result.judgment.scores).every(score => score.delta >= 1), 'all three positive intentions remain');
                    result.response = result.judgment.response;
                } else {
                    result.judgment = await judgeJietingDialogue({ context: c.session.getEvaluationContext(), input: result.text, clueIds: c.session.state.selected, confirmed: true }, signal, api);
                    assert.ok(['great', 'accepted'].includes(result.judgment.outcome) && result.judgment.status === 'final' && !result.judgment.special, 'complete proposal should progress');
                    result.response = result.judgment.response;
                }
                assert.ok(c.session.submit(result.judgment), 'validated judgment must be accepted by session');
                assert.ok(c.session.advance(), 'reading response must reach the next node');
                result.next = c.session.current.id;
            }
            result.passed = true;
        } catch (error) { result.passed = false; result.error = error.message; }
    });
    result.durationMs = Date.now() - Date.parse(result.startedAt);
    results.push(result);
    writeFileSync(resolve(out, c.id + '.json'), JSON.stringify(result, null, 2));
    writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ id: c.id, passed: result.passed, text: result.text, response: result.response, next: result.next, error: result.error }));
}
await Promise.all([0, 1].map(async () => { while (queue.length) await run(queue.shift()); }));
console.log(JSON.stringify({ out, total: results.length, passed: results.filter(r => r.passed).length }));
if (results.some(r => !r.passed)) process.exitCode = 1;
