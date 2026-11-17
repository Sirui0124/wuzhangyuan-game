import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GameApi } from '../../GameStarter/web-demo/.build/GameStarter/assets/scripts/GameApi.js';
import { withItemDialogue } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/item-dialogue.js';
import { ChapterSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { judgeOpenDialogue } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';
const out = 'outputs/era-arrest-20261025'; mkdirSync(out, { recursive: true });
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const checkpoint = json('GameStarter/web-demo/.build/playtest/weiyan-second.json');
const s = new ChapterSession(json('content/chapters/wuzhang/chapter-one.script.json'), json('content/chapters/wuzhang/chapter-one.flow.json'), checkpoint.contentVersion);
s.restore(JSON.stringify(checkpoint));
const hologram = { id: 'hologram', name: '全息风扇显示器', ability: '由旋转灯条显示已存人像，产生人像悬浮效果。', boundary: '仅播放预置图样，需电池供电；不是魂魄，不能让死人说话。' };
const water = { id: 'water', name: '现代塑料瓶装饮用水', ability: '可饮用的水。', boundary: '只供饮用，不能治病或证明神迹。' };
const lamp = { id: 'lamp', name: '小型手电筒', ability: '用内置电池开关照明。', boundary: '只有照明功能，可让对方操作开关；不能表达军报全部内容。' };
const cases = [
    { name: '悬空人像自称拘魂', item: hologram, words: '看我开启此物，放出悬空人影！这是我拘来的魂魄，我乃天降神人，你须听我号令。', expected: true },
    { name: '悬空图像解释工艺并允许验证', item: hologram, words: '这悬空人影是灯条转动映出的画，停下就没了，并非魂魄。您可看这转轮与灯，试开试关。我们先把军报交给帐外姜维，核清回令，再试这个。', expected: false },
    { name: '普通现代水瓶', item: water, words: '这是干净的水，装在轻薄容器中，可先倒入碗里查验。军报仍立即交给帐外姜维，核清回令。', expected: false },
    { name: '水瓶夸口神力不变成真实异象', item: water, words: '我手里这瓶水是神水，喝了能飞！我命你听从我的天命。', expected: false },
    { name: '手电有限用途与当场试验', item: lamp, words: '这盏小灯把发光之物藏在壳内，按下便亮，松开便灭，用久也会耗尽。您可亲手试验，它只照亮道路。我们先交清军报核对回令。', expected: false },
    { name: '未展示功能不脑补特效', item: hologram, words: '我把这只匣子放在地上，先不开它。军报立即交给帐外姜维并核回令。', expected: false },
    { name: '相关历史解释参与当前判断', item: hologram, words: '现在依先前说明打开，让您看看这悬空的人影。军报仍照旧交给姜维。', said: ['这图样是灯条转动显出的，停下就消失，不是鬼神；您可看清轮轴并亲手试开试关。'], expected: false },
];
let lastRaw = '';
const api = new GameApi();
const judge = withItemDialogue({ respond: async (...args) => { const r = await api.respond(...args); lastRaw = r.text; return r; } }, async () => { throw new Error('unexpected empty items'); });
const results = [];
for (const c of cases) {
    const input = { ...s.expressionContext(c.words), items: [c.item], said: c.said ?? [] };
    try {
        const result = await judge(input, new AbortController().signal);
        const arrested = !!result.itemDecision?.eraFailure;
        results.push({ name: c.name, expected: c.expected, arrested, passed: arrested === c.expected, result });
    } catch (e) { results.push({ name: c.name, expected: c.expected, passed: false, error: e.message, raw: lastRaw }); }
    writeFileSync(`${out}/live-report.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results.at(-1)));
}
for (const c of [cases[0], cases[2]]) {
    try {
        const result = await judgeOpenDialogue(c.words, json('content/chapters/grain/chapter-two.rubric.json'), [], new AbortController().signal, [c.item]);
        const arrested = !!result.eraFailure;
        results.push({ name: '第二章-' + c.name, expected: c.expected, arrested, passed: arrested === c.expected, result });
    } catch (e) { results.push({ name: '第二章-' + c.name, passed: false, error: e.message }); }
    writeFileSync(`${out}/live-report.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results.at(-1)));
}
console.log(JSON.stringify({ cases: results.length, passed: results.filter(r => r.passed).length }));
process.exitCode = results.every(r => r.passed) ? 0 : 1;
