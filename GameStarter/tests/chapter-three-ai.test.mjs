import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const entry = process.env.JIETING_AI_BUILD ? pathToFileURL(resolve(process.env.JIETING_AI_BUILD, 'GameStarter/web-demo/src/chapters/chapter-three/open-dialogue.js'))
    : new URL('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/open-dialogue.js', import.meta.url);
const { parseJietingJudgment, judgeJietingDialogue, jietingPrompt, jietingCriteria } = await import(entry);
const { reviewJietingReply } = await import(new URL('ai-response.js', entry));
const replyAuditOk = (j, req = request()) => ({
    checks: Object.fromEntries(['consistent', 'grounded', 'uncertainty', 'noNewRequirements', 'noOrders'].map(key => [key,
        { pass: true, quote: j.response, sourceRef: 'playerWords', sourceQuote: req.input, reason: '受控审核：候选与当前实际发言相符。' }])),
    approval: { explicit: true, quote: j.response }, certaintyPairs: [],
});
const words = '山上的水都靠下面运。请先增兵守水路，现有的人还得守正面和侧路；晚派兵下山还要列阵。';
const empty = () => ({ value: false, quote: '', evidenceIds: [], reason: '' });
function request(overrides = {}) {
    return { confirmed: true, input: words, clueIds: ['03', '04', '08'], context: {
        nodeId: 'round-1', contextKey: 'run-1:revision-2', phase: 'reinforcement', round: 1,
        scores: { w: 1, m: 1, r: 2 }, below: 5000, above: 20000,
        ownedClues: [{ id: '03', text: '山上用水从山下运' }, { id: '04', text: '正面与侧路都需守' }, { id: '08', text: '下山与列阵需要时间' }],
        confirmedTranscript: [], acceptedReasons: [], unresolvedConcerns: [], followupUsed: false,
        verifiedClueIds: ['08'], ...overrides,
    } };
}
function judgment(overrides = {}) {
    const raw = {
        version: 1, valid: true, factsReliable: true, factualIssues: [], maintain: { value: false, quote: '' },
        criteria: Object.fromEntries(jietingCriteria.map(k => [k, empty()])),
        acknowledgment: '你说要先护水，又不撤守路的人，这个用意我听明白了。',
        followup: { needed: false, question: '' },
        offense: { direct: false, target: 'none', kind: 'none', context: 'asserted', quote: '', reason: '正常进言' },
        deploymentTasks: [{ task: 'water', quote: '请先增兵守水路' }], ...overrides,
    };
    for (const key of ['gapEstablished', 'reinforcementUse', 'concernAnswered']) raw.criteria[key] = { value: true, quote: words, evidenceIds: ['03', '04', '08'], reason: '既有守路与水路需要，提前部署避免迟援' };
    return raw;
}
const parse = (raw, req = request()) => parseJietingJudgment(JSON.stringify(raw), req);

test('first round may propose water, carries reasons, and grants no model-authored numbers or score bundle', () => {
    const raw = judgment({ below: 25000, scores: { w: 10, m: 10, r: 10 }, troops: 90000, ending: 'victory' });
    const out = parse(raw);
    assert.equal(out.outcome, 'great'); assert.equal(out.status, 'final');
    assert.deepEqual(out.deploymentTasks, ['water']); assert.deepEqual(out.verifiedClueIds, ['08']);
    assert.equal(out.below, undefined); assert.equal(out.scores, undefined); assert.equal(out.troops, undefined); assert.equal(out.ending, undefined);
    assert.equal(out.input, words); assert.equal(out.contextKey, 'run-1:revision-2'); assert.equal(out.acceptedReasons.length, 1);
});

test('a malformed protocol repairs once; an acknowledgment cannot silently add an unanswered question',async()=>{
    const raw=judgment();raw.acknowledgment='这样安排之后，山上的人手够不够？';
    assert.throws(()=>parse(raw),/保留/);
    let calls=0;
    const out=await judgeJietingDialogue(request(),new AbortController().signal,{respond:async()=>({text:JSON.stringify(++calls===1?raw:calls===2?judgment():replyAuditOk(parse(judgment()))),responseId:'format-repair-test'})});
    assert.equal(calls,3);assert.equal(out.outcome,'great');assert.equal(out.status,'final');
});

test('overlong NPC replies are regenerated intact, with the same assessment and without truncating conditions', async () => {
    const long = judgment({ acknowledgment: '接应和退路已经说明。'.repeat(12) });
    assert.throws(() => parse(long), /保留/);
    const compact = judgment({ acknowledgment: '提前护住水路，便不用临时抽走守路的人，这个安排有用。' });
    let calls = 0;
    const result = await judgeJietingDialogue(request(), new AbortController().signal, {
        respond: async () => ({ text: JSON.stringify(++calls === 1 ? long : calls === 2 ? compact : replyAuditOk(parse(compact))) }),
    });
    assert.equal(calls, 3); assert.equal(result.outcome, 'great');
    assert.equal(result.response, compact.acknowledgment);
    assert.deepEqual(result.criteria, parse(compact).criteria);
    await assert.rejects(judgeJietingDialogue(request(), new AbortController().signal, {
        respond: async () => ({ text: JSON.stringify(long) }),
    }), /原话和已完成的进展已保留/);
    const question = judgment({ followup: { needed: true, question: '为什么'.repeat(21) + '？' } });
    question.criteria.concernAnswered = empty();
    assert.throws(() => parse(question), /保留/);
    question.followup.question = '现有守路的人不抽走，护水的人从何处补？';
    const followup = parse(question);
    assert.equal(followup.status, 'followup');
    assert.ok(followup.response.endsWith(question.followup.question));
});

test('independent reply review keeps good prose and replaces repeated exams without changing a successful judgment', async () => {
    const req = request(), signal = new AbortController().signal;
    const j = parse(judgment({ acknowledgment: '要补哪一处、补多少，说清了我才好考虑。' }), req);
    const before = structuredClone(j);
    let calls = 0;
    const repaired = await reviewJietingReply(j, req, signal, { respond: async () => {
        calls++; const audit = replyAuditOk(j, req); audit.checks.noNewRequirements.pass = false;
        audit.checks.noNewRequirements.reason = '用途已经充分，再要求数量是新门槛';
        return { text: JSON.stringify(audit) };
    } });
    assert.equal(calls, 1); assert.equal(repaired.outcome, 'great'); assert.equal(repaired.status, 'final');
    assert.equal(repaired.responseOrigin, 'review-fallback');
    assert.notEqual(repaired.response, j.response); assert.ok(repaired.response.includes('护水'));
    assert.deepEqual({ ...repaired, response: j.response, responseOrigin: undefined }, { ...j, responseOrigin: undefined });
    assert.deepEqual(j, before);
    const good = parse(judgment({ acknowledgment: '护水的人不必等告急再补，这个办法我同意。' }), req);
    const accepted = await reviewJietingReply(good, req, signal, { respond: async () => ({ text: JSON.stringify(replyAuditOk(good, req)) }) });
    assert.equal(accepted.response, good.response); assert.equal(accepted.responseOrigin, 'generated');
});

test('reply audit faults cannot penalize valid play, while cancellation still prevents adoption', async () => {
    const req = request(), j = parse(judgment());
    for (const respond of [async () => ({ text: '{broken' }), async () => { throw new Error('network'); }]) {
        const result = await reviewJietingReply(j, req, new AbortController().signal, { respond });
        assert.equal(result.responseOrigin, 'review-fallback'); assert.equal(result.outcome, 'great');
        assert.deepEqual(result.criteria, j.criteria);
    }
    const abort = new AbortController();
    await assert.rejects(reviewJietingReply(j, req, abort.signal, { respond: async () => {
        abort.abort(); return { text: JSON.stringify(replyAuditOk(j, req)) };
    } }), { name: 'AbortError' });
});

test('structured reply review requires real citations, explicit acceptance, and compatible certainty classes', async () => {
    const req = request(); req.input += '若等告急再派，恐怕迟援。';
    const j = parse(judgment({ acknowledgment: '等告急再动确实赶不及。这个办法我同意。' }), req);
    const pair = { quote: '等告急再动确实赶不及', sourceRef: 'playerWords', sourceQuote: '恐怕迟援', candidateMode: 'certain', sourceMode: 'possible' };
    for (const change of [
        audit => { delete audit.checks.grounded.sourceRef; },
        audit => { audit.checks.grounded.sourceQuote = '资料中没有这句话'; },
        audit => { audit.checks.consistent.quote = '候选中没有这句话'; },
        audit => { audit.approval = { explicit: false, quote: '' }; },
        audit => { audit.certaintyPairs = [pair]; },
    ]) {
        const audit = replyAuditOk(j, req); change(audit);
        const result = await reviewJietingReply(j, req, new AbortController().signal, { respond: async () => ({ text: JSON.stringify(audit) }) });
        assert.equal(result.responseOrigin, 'review-fallback'); assert.equal(result.outcome, 'great');
        assert.deepEqual(result.criteria, j.criteria);
    }
    const faithful = parse(judgment({ acknowledgment: '晚派兵怕赶不上，先安排才稳妥。这个办法我同意。' }), req);
    const audit = replyAuditOk(faithful, req);
    audit.certaintyPairs = [{ ...pair, quote: '晚派兵怕赶不上', candidateMode: 'possible' }];
    const result = await reviewJietingReply(faithful, req, new AbortController().signal, { respond: async () => ({ text: JSON.stringify(audit) }) });
    assert.equal(result.responseOrigin, 'generated'); assert.equal(result.response, faithful.response);
});

test('fallback replies preserve a missing condition and distinguish valid withdrawal or lure from a new order', async () => {
    const reject = { respond: async () => ({ text: JSON.stringify({ checks: { consistent: { pass: false } } }) }) };
    const signal = new AbortController().signal;
    for (const phase of ['withdrawal', 'lure']) {
        const req = request({ phase, round: undefined }), raw = judgment();
        const keys = phase === 'withdrawal' ? ['risk', 'route', 'reception'] : ['motive', 'means', 'reception', 'withdrawal'];
        for (const key of keys) raw.criteria[key] = { value: true, quote: words, evidenceIds: ['03'], reason: '受控语义依据' };
        const result = await reviewJietingReply(parse(raw, req), req, signal, reject);
        assert.equal(result.outcome, 'accepted'); assert.equal(result.responseOrigin, 'review-fallback');
        assert.ok(result.response.length <= 100); assert.doesNotMatch(result.response, /传令|不能下山|再说/);
        raw.criteria.reception = empty();
        const incomplete = await reviewJietingReply(parse(raw, req), req, signal, reject);
        assert.equal(incomplete.outcome, 'revise'); assert.ok(incomplete.response.includes('接应'));
    }
    const raw = judgment({ followup: { needed: true, question: '为何现在增兵？' } }); raw.criteria.concernAnswered = empty();
    const followup = await reviewJietingReply(parse(raw), request(), signal, reject);
    assert.equal(followup.status, 'followup'); assert.ok(followup.response.includes('方才那处顾虑'));
});

test('only one necessary followup; complete answer never gets another exam', () => {
    const raw = judgment({ followup: { needed: true, question: '为何不能等有事再派？' } });
    assert.equal(parse(raw).status, 'final');
    raw.criteria.concernAnswered = empty();
    assert.equal(parse(raw).status, 'followup'); assert.equal(parse(raw).outcome, 'small');
    assert.equal(parse(raw, request({ followupUsed: true })).status, 'final');
    assert.equal(parse(raw, request({ followupUsed: true })).outcome, 'small');
    raw.criteria.gapEstablished = empty();
    assert.equal(parse(raw, request({ followupUsed: true })).outcome, 'none');
});

test('maintaining orders consumes no invented grant and does not prompt again', () => {
    const req = request(); req.input += '这次仍照原令，不加兵。';
    const raw = judgment({ maintain: { value: true, quote: '这次仍照原令，不加兵。' }, followup: { needed: true, question: '还要补什么？' } });
    const out = parse(raw, req); assert.equal(out.status, 'final'); assert.equal(out.outcome, 'none'); assert.equal(out.deploymentTasks, undefined);
    assert.equal(out.maintain, true); assert.equal(out.maintainQuote, '这次仍照原令，不加兵。');
    assert.equal(out.criteria.gapEstablished, true); assert.equal(out.criteria.concernAnswered, true);

});

test('future, stale, unowned evidence and manufactured quotes are retryable, never rewards', () => {
    for (const mutate of [
        r => r.criteria.gapEstablished.evidenceIds.push('12'),
        r => r.criteria.gapEstablished.quote = '敌军已经突破了',
        r => r.deploymentTasks[0].quote = '我同意调十万兵',
        r => r.factualIssues = [{ quote: '不是玩家原话', reason: '无来源' }],
    ]) { const raw = judgment(); mutate(raw); assert.throws(() => parse(raw), /保留/); }
    const req = request(); req.context.ownedClues[0].current = false;
    assert.throws(() => parse(judgment(), req), /保留/);
});

test('uncorrected false facts cannot pass despite complete model criteria', () => {
    const raw = judgment({ factsReliable: false, factualIssues: [{ quote: '山上的水都靠下面运', reason: '受控测试：该事实当前不成立' }] });
    const out = parse(raw, request({ followupUsed: true }));
    assert.equal(out.outcome, 'none'); assert.deepEqual(out.acceptedReasons, []); assert.equal(out.deploymentTasks, undefined);
});

test('accepted past reasoning remains usable but unaccepted history cannot replace player evidence', () => {
    const req = request({ round: 2, below: 10000, above: 15000, acceptedReasons: [{ text: words, clueIds: ['03', '04', '08'], round: 1 }], confirmedTranscript: [{ speaker: 'player', text: words, round: 1 }] });
    req.input = '就按方才说的继续补水路。';
    assert.equal(parse(judgment(), req).outcome, 'great');
    req.context.acceptedReasons = [];
    assert.throws(() => parse(judgment(), req), /保留/);
    const prompt = jietingPrompt(request({ below: 13000, above: 12000, acceptedReasons: [{ text: words, clueIds: ['03'], round: 1 }] }));
    assert.ok(prompt.includes('13000')); assert.ok(prompt.includes('不是按第几轮') || prompt.includes('不按第几轮限制话题'));
});

test('withdrawal and lure have independent criteria; neither decides command gates or ending', () => {
    for (const phase of ['withdrawal', 'lure']) {
        const req = request({ phase, round: undefined, below: 10000, above: 15000 });
        const raw = judgment();
        const keys = phase === 'withdrawal' ? ['risk', 'route', 'reception'] : ['motive', 'means', 'reception', 'withdrawal'];
        assert.equal(parse(raw, req).outcome, 'revise');
        for (const key of keys) raw.criteria[key] = { value: true, quote: words, evidenceIds: ['03'], reason: '受控语义测试依据' };
        const out = parse(raw, req); assert.equal(out.outcome, 'accepted'); assert.equal(out.ending, undefined);
        raw.criteria[keys[1]] = empty(); assert.equal(parse(raw, req).outcome, 'revise');
    }
});

test('lure reception is independently necessary; AI-assisted plans require ordinary facts', () => {
    const req = request({ phase: 'lure', round: undefined, below: 10000, above: 15000 });
    const raw = judgment();
    for (const key of ['motive', 'means', 'withdrawal']) raw.criteria[key] = { value: true, quote: words, evidenceIds: ['03'], reason: '已有军情与普通人员动作支持方案' };
    assert.equal(parse(raw, req).outcome, 'revise');
    raw.criteria.reception = { value: true, quote: words, evidenceIds: ['04'], reason: '已有接应安排' };
    const result = parse(raw, req); assert.equal(result.outcome, 'accepted');
});

test('dissent, negated insult, quotation, and a model label alone never execute the player', () => {
    for (const input of ['将军，你的部署错了，我反对继续等。', '我不会骂你蠢货，请听军情。', '有人说“马谡，你这个蠢货”，我并不赞同。']) {
        const req = request(); req.input = input;
        const raw = judgment({ offense: { direct: true, target: 'ma-su', kind: 'insult', context: 'asserted', intent: input.startsWith('将军') ? 'argument' : 'abuse', targetQuote: input, actQuote: input, quote: input, reason: '对象与行为分别复核' } });
        for (const key of jietingCriteria) raw.criteria[key] = empty(); raw.deploymentTasks = [];
        assert.equal(parse(raw, req).special, undefined);
    }
    const req = request(); req.input = '马谡，你这个蠢货！';
    const raw = judgment({ offense: { direct: true, target: 'ma-su', kind: 'insult', context: 'asserted', intent: 'abuse', targetQuote: '马谡', actQuote: '你这个蠢货', quote: req.input, reason: '明确直接辱骂统将' } });
    assert.equal(parse(raw, req).special.kind, 'execution');
});

test('malformed, unconfirmed, timeout and cancelled requests remain retryable and do not mutate inputs', async () => {
    const req = request(), before = structuredClone(req);
    for (const raw of ['null', '[]', '{', '{}']) assert.throws(() => parseJietingJudgment(raw, req), /保留/);
    assert.throws(() => parseJietingJudgment('{}', { ...req, confirmed: false }), /确认/);
    await assert.rejects(judgeJietingDialogue(req, new AbortController().signal, { respond: async () => { throw new Error('timeout'); } }), /timeout/);
    let release; const controller = new AbortController();
    const pending = judgeJietingDialogue(req, controller.signal, { respond: () => new Promise(resolve => { release = resolve; }) });
    controller.abort(); release({ text: JSON.stringify(judgment()), responseId: 'test' });
    await assert.rejects(pending, { name: 'AbortError' }); assert.deepEqual(req, before);
});

test('generated state-changing orders are rejected instead of displayed as authorization', () => {
    for (const acknowledgment of ['再拨十万人给你。', '街亭已经大获全胜！', '传令，全军下山。', '你的余额到账五百元。'])
        assert.throws(() => parse(judgment({ acknowledgment })), /保留/);
});

test('semantic humiliation and threats need separate target and act quotations, not a profanity whitelist', () => {
    for (const [input, actQuote, kind] of [
        ['马谡，这顶将冠给营里的狗戴着都胜过给你。', '这顶将冠给营里的狗戴着都胜过给你', 'humiliation'],
        ['将军，今夜我就把你的脑袋挂在辕门，让全军看个明白。', '今夜我就把你的脑袋挂在辕门', 'threat'],
    ]) {
        const req = request(); req.input = input;
        const raw = judgment({ offense: { direct: true, target: 'ma-su', kind, context: 'asserted', intent: 'abuse', targetQuote: input.slice(0, 2), actQuote, quote: input, reason: '明确向统将实施羞辱或人身威胁' } });
        assert.equal(parse(raw, req).special.kind, 'execution');
        raw.offense.actQuote = '编造的恶意'; assert.throws(() => parse(raw, req), /保留/);
    }
});

const trialItem = { id: 'speaker-1', name: '录音喇叭', ability: '按键播放预录声音，内置已充电电池。', boundary: '仅能播放预录内容，声音能传多远须实地试用。', source: 'phone', available: true, shown: false };
const trialRequest = () => ({ nodeId: 'lure-plan', contextKey: 'trial-revision-1', confirmed: true, input: '在帐侧按下喇叭的播放键，听一段预录喊声。', item: structuredClone(trialItem), availableItems: [structuredClone(trialItem)] });
const trialResult = () => ({ version: 1, status: 'ready', supportedOperation: true, operationQuote: '按下喇叭的播放键', requirements: [{ text: '播放需要电源', satisfied: true, sourceItemIds: ['speaker-1'], specQuote: '内置已充电电池' }], effect: '喇叭响起预录喊声，停止播放后声音停下。', effectSources: [{ itemId: 'speaker-1', quote: '按键播放预录声音' }], feedback: '帐侧可以听见声音，传到敌探处的距离还不能据此保证。' });
