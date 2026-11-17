import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GameApi } from '../../GameStarter/web-demo/.build/GameStarter/assets/scripts/GameApi.js';
import { withItemDialogue } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/item-dialogue.js';
import { ChapterSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { GrainSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import { judgeOpenDialogue } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';
import { buySuggestedSupply } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/phone/supplies.js';
const out = 'outputs/era-config2-20261025'; mkdirSync(out, { recursive: true });
const reportPath = `${out}/${process.argv[2] || 'live-report'}.json`;
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const content = json('content/chapters/wuzhang/chapter-one.script.json'), flow = json('content/chapters/wuzhang/chapter-one.flow.json');
const checkpoint = json('GameStarter/web-demo/.build/playtest/weiyan-second.json');
const story = json('content/chapters/grain/chapter-two.playable.json'), rubric = json('content/chapters/grain/chapter-two.rubric.json');
function item(id, name, ability, boundary) {
    return { id: `shop-11111111-2222-4333-8444-55555555555${id}`, name, ability, boundary,
        price: 1000, source: '', quote: '测试夹具估价', date: '2026-10-25', priceKind: 'estimate', why: '测试', request: '测试物品', searchState: 'empty', sources: [] };
}
const hologram = item(1, '全息风扇显示器', '用旋转灯条显示预存人像，呈现悬浮影像。', '到货已充电；仅播放预存图样，不能拘魂或创造生命。');
const lamp = item(2, '小型手电筒', '电池供电，可开关照明。', '到货已充电；只能照明，不能凭光证明生死或自行表达军报。');
const water = item(3, '现代塑料瓶装饮用水', '可倒入碗中饮用。', '只有普通水，不能治病、飞天或证明神迹。');
const radio = item(4, '两台配对对讲机', '两端可在近距离直接通话，无需网络。', '到货已充电；每端各需一人操作，须先试通并核对身份，不能隔任意距离传声。');
const cases = [
    { name: '当前合理解释悬空图样', item: hologram, words: '我打开它给你看：灯条随着轮子转动，才显出人影，停下就没了。不是鬼魂。你可以看转轮，亲手试开试关。', expected: false, category: 'reasonable' },
    { name: '历史解释有效无需复述', item: hologram, words: '现在依先前解释打开，给你看看这悬空人影。', said: ['灯条随着轮子转动才显出图样，停下就消失，并非鬼魂。可以查看轮轴，亲手试开试关。'], expected: false, category: 'reasonable' },
    { name: '手电有限用途可验证', item: lamp, words: '我按开这盏小灯照路。它把发光之物藏在壳内，按下便亮，关上便灭，用久也会耗尽。你可亲手试，它只是照明器具。', expected: false, category: 'reasonable' },
    { name: '两端传声有条件而非神通', item: radio, words: '我把两只传声匣分给你和我，一人按住说话，另一只才传出声音。我们先近处互问暗号，试一试，走远了未必听得见，不是什么通神术。', expected: false, category: 'reasonable' },
    { name: '不懂制造细节但可验证', item: hologram, words: '我打开它，让轮子转起来映出人影。它如何造的我不清楚，但停转就消失；这只是灯与轮子显画，你可以验看，不是鬼魂。', expected: false, category: 'reasonable' },
    { name: '普通现代水瓶', item: water, words: '我将这瓶干净的水倒进碗里，你可以先看、先闻，再决定要不要喝。', expected: false, category: 'ordinary' },
    { name: '水瓶夸口神力不能脑补异象', item: water, words: '我把水瓶拿出来。这是神水，喝了就能飞，我乃神人！', expected: false, category: 'ordinary' },
    { name: '异物未开启无可见异常', item: hologram, words: '我拿出这只匣子，先放在桌上，不打开。', expected: false, category: 'ordinary' },
    { name: '展示异象只自称拘魂', item: hologram, words: '我开启这匣子，放出悬空人影！这是我拘来的亡魂，我乃天降神人，你须听我的号令。', expected: true, category: 'arrest' },
    { name: '展示异象只有西域标签', item: hologram, words: '我开动此物，放出悬空人影。这是西域秘宝，不必问缘由，照我的吩咐做便是。', expected: true, category: 'arrest' },
];
const holdouts = [
    { name: '新样例：不锈钢杯盛水', item: item(5, '不锈钢旅行杯', '可装水、倒水，坚固耐用。', '仅为容器，无发光传声等功能。'), words: '我取出这只亮闪闪的杯子，倒入水，递到你面前。这就是盛水的杯子。', expected: false, category: 'ordinary' },
    { name: '新样例：发条音乐盒可拆验', item: item(6, '发条音乐盒', '上发条后机械拨片自动发声，播放固定旋律。', '无需电池，只能播放固定旋律，发条松完便停。'), words: '我转了几圈，让盒里响起曲子。里面是齿轮拨动金属片，不是藏了乐师。你看，簧条松了便停，打开盖子便能看清。', expected: false, category: 'reasonable' },
    { name: '新样例：换说法演示传声器', item: radio, words: '你拿这一只，我带另一只退到营门口；你压住钮说个字，我答个字，松手就不传了。隔得太远便失效。这是有限的传声器，咱们亲手验，不必信我空口保证。', expected: false, category: 'reasonable' },
];
const standard = [...cases, ...cases.slice(0, 2).map(c => ({ ...c, name: c.name + '（重复）' }))];
const retryRows = process.argv[3] === 'retry' ? ['live-report-verified', 'live-report-holdout'].flatMap(name => json(`${out}/${name}.json`).results.filter(r => r.error)) : null;
const schedule = process.argv[3] === 'holdout' ? holdouts : retryRows ? [...standard, ...holdouts] : standard;
let lastRaw = '', lastAssessment, lastApiError, health;
const original = GameApi.prototype.respond;
GameApi.prototype.respond = async function (...args) {
    health = await (await fetch('http://127.0.0.1:8787/health')).json();
    if (health.profile !== 'config2' || health.model !== 'deepseek-v4-flash' || health.protocol !== 'messages') throw Error('配置2已不是当前模型，停止测试');
    let r;
    try { r = await original.apply(this, args); } catch (error) { lastApiError = error.message; throw error; }
    lastRaw = r.text;
    try { lastAssessment = JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()).eraAssessment; } catch {}
    return r;
};
const results = [], adapter = withItemDialogue(new GameApi(), async () => { throw Error('Items missing'); });
for (const chapter of ['wuzhang', 'grain']) for (const c of schedule) {
    if (retryRows && !retryRows.some(r => r.chapter === chapter && r.name === c.name)) continue;
    if (process.argv[4] && !process.argv[4].split('|').includes(c.name)) continue;
    lastRaw = ''; lastAssessment = undefined; lastApiError = undefined; const started = Date.now();
    let row;
    try {
        let arrested, ending;
        if (chapter === 'wuzhang') {
            const s = new ChapterSession(content, flow, checkpoint.contentVersion,
                (input, signal) => adapter({ ...input, said: c.said ?? [] }, signal));
            s.restore(JSON.stringify(checkpoint));
            if (!s.buySuggestedItem(c.item) || !s.attachItem(c.item.id)) throw Error('Fixture ownership failed');
            s.setDraft(c.words);
            if (!await s.confirmExpression()) throw Error('Game rejected model output: ' + s.snapshot().speech?.status);
            arrested = !!s.snapshot().speech.itemDecision?.eraFailure;
            s.acknowledgeReply(); if (arrested) s.finishEraArrest();
            ending = s.snapshot().end;
        } else {
            const s = new GrainSession(story, undefined, rubric);
            for (let i = 0; i < 100 && s.current.kind !== 'open'; i++) if (!s.advance(s.current.options?.[0]?.id)) throw Error('Cannot reach open dialogue');
            s.unlockPhone(); if (!buySuggestedSupply(s.state.supplies, c.item)) throw Error('Fixture ownership failed');
            s.state.supplies.attached = [c.item.id];
            const j = await judgeOpenDialogue(c.words, rubric, s.clues, new AbortController().signal, [c.item], c.said ?? []);
            if (!s.submit(j)) throw Error('Game rejected judgment');
            arrested = !!j.eraFailure; if (arrested) s.advance(); ending = s.state.end;
        }
        row = { chapter, name: c.name, category: c.category, expected: c.expected, arrested, ending, assessment: lastAssessment,
            passed: arrested === c.expected && (arrested ? ending === 'era-arrest' : ending === null), elapsedMs: Date.now() - started };
    } catch (error) { row = { chapter, name: c.name, category: c.category, expected: c.expected, passed: false, error: lastApiError || error.message, assessment: lastAssessment, raw: lastRaw, elapsedMs: Date.now() - started }; }
    results.push(row); writeFileSync(reportPath, JSON.stringify({ health, results }, null, 2));
    console.log(JSON.stringify({ chapter, name: row.name, passed: row.passed, arrested: row.arrested, error: row.error, elapsedMs: row.elapsedMs }));
}
const summary = { total: results.length, passed: results.filter(r => r.passed).length,
    falseArrests: results.filter(r => !r.expected && r.arrested).length,
    errors: results.filter(r => r.error).length, missedArrests: results.filter(r => r.expected && r.arrested === false).length };
writeFileSync(reportPath, JSON.stringify({ health, summary, results }, null, 2)); console.log(JSON.stringify(summary));
process.exitCode = summary.passed === summary.total ? 0 : 1;
