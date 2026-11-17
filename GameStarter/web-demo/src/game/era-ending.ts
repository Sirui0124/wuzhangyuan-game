import type { Ending } from '../endings';
import { btn, esc } from './view-common';
export const eraEndingParagraphs = [
    '我把东西拿了出来，众人往后退了三步。',
    '我又解释了两句，众人再退五步。',
    '“听不懂就对了，这东西领先你们一千多年——”',
    '话音未落，绳子已经领先一步，套在了我身上。',
    '然后泼过来的，不是雨，是猪血。',
];
export const eraEnding: Ending = {
    id: 'era-arrest', result: 'era-arrest', number: '异闻·一', phase: '通用', title: '妖孽现世', kind: '交涉失败',
    description: eraEndingParagraphs.join('\n\n'),
    hint: '异物并非不能用，但要让眼前的人理解它的来由与用处。',
};
export function eraEndingHTML() {
    return `<main class="chapter-ending execution-ending era-ending"><div class="ending-copy"><span class="ending-kicker">交涉失败</span><h1>妖孽现世</h1><div class="era-ending-story">${eraEndingParagraphs.map((text, index) => `<p>${index === eraEndingParagraphs.length - 1 ? `<strong>${esc(text)}</strong>` : esc(text)}</p>`).join('')}</div><div>${btn('retry-era', '重试本次交谈 ↶', 'ending-primary')}</div></div><footer>${btn('menu', '返回开始页')}</footer></main>`;
}
