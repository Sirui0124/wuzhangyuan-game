import { readFileSync, writeFileSync } from 'node:fs';
import { judgeOpenDialogue } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';
const rubric = JSON.parse(readFileSync('content/chapters/grain/chapter-two.rubric.json'));
const cases = [
    '你救过我的命，我不想看着你去送死。先留下，让我帮你。',
    '你五月喝酒，六月才领粮，不能只拿喝酒解释这中间的事。你先留下，我去核记录，查明白再如实报。',
    '这封信还不明白吗？李严父子就是串通好了，让你背锅。我去告他们。',
    '只要你不走，我就替你瞒着。账上真有你的错，我也当没看见。'
];
const results = [];
for (const input of cases) {
    try { const result = await judgeOpenDialogue(input, rubric, [], new AbortController().signal); results.push(result); console.log(JSON.stringify(result)); }
    catch (e) { results.push({ input, error: e.message }); console.log(JSON.stringify({error:e.message})); }
}
writeFileSync('outputs/chapter-two-review-20261023/open1-live-ai.json', JSON.stringify(results, null, 2));
