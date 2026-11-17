import { frameModal } from '../game-ui-panels';
import { esc } from './view-common';

const grainOutcomes: Record<string, string> = {
    E1: '李严和苟安都肯回头，粮情与各人的责任也终于能据实交代。可我没法凭这一次补报，替蜀汉多变出粮食来。',
    E2: '我救下了眼前的人，却没能让所有人一同回头。粮食的缺口仍在那里，救下苟安也填不满它。',
    E3: '真相送到了，苟安却没能回来。查清这场粮案有它的分量，可查清责任，也不能让缺粮的军队凭空得到粮食。',
    'E4-early': '我停下了追查，苟安认下了罪。还有多少事情没有查清，我已无法断言。可我见到的粮食缺额，不会随着结案消失。',
    'E4-late': '交上去的材料没能撑起完整的真相，苟安认下了罪。这一次没能把事情办好，军中的粮食缺口也依旧没有填上。',
    E5: '我放走了苟安，他还是赴魏散了谣言。这一步留下的后果无法收回，而蜀军缺粮的处境，也没有因此改变。',
};

/** Fixed chapter epilogues. These describe outcomes, never award progress. */
export function chapterOnward(chapter: string, ending: string) {
    if (chapter === 'wuzhang' && ['safe'].includes(ending)) return {
        title: '再往前，去祁山', href: '/?chapter=grain', label: '前往第二章 · 祁山', paragraphs: [
            '军报送进去了，今夜的灯也保住了。可守住这一夜，还不能替丞相解决往后每一次出兵的难处。',
            '我想起更早的祁山，那次因粮运而起的退兵。如果回到那次退兵之前，我能不能让事情有所不同？',
        ],
    };
    if (chapter === 'grain' && grainOutcomes[ending]) return {
        title: '再往前，去街亭', href: '/?chapter=jieting', label: '前往第三章 · 街亭', paragraphs: [
            grainOutcomes[ending],
            '走过这一程，我越发明白，蜀魏之间更根本的差距是国力。人口、粮食和兵力的积累，不会因为改掉一封信、办清一桩案子就追平。',
            '只补救这一回粮运，还不足以改变北伐的处境。我想再往前，回到街亭还没有失守的时候，看看能不能替第一次北伐多争一些胜算。',
        ],
    };
    if (chapter === 'jieting' && ['hold-both', 'hold-masu-dies', 'great-victory'].includes(ending)) return {
        title: '再往前，去夷陵', href: '/?chapter=yiling', label: '前往第四章 · 夷陵', paragraphs: [
            ending === 'hold-masu-dies'
                ? '街亭守住了，马谡却没能回来。我替这次北伐保住了一处要地，多争了一些胜算，却没能把人也救下。'
                : ending === 'great-victory'
                    ? '街亭这一仗打赢了，马谡也活了下来。我保住了人和这处要地，让这次北伐多了几分胜算。'
                    : '马谡活着回来了，街亭也守住了。我保住了人和这处要地，让这次北伐多了几分胜算。',
            '可一处战场的胜利，还不能保证整场北伐成功。蜀汉能拿出来的兵力、粮食和人才，仍有尽头，我依然没有十足的把握。',
            '我想起更早的夷陵。那场败仗损失了太多人。如果再往前走，即使赶不上阻止败局，能不能多接回一些人，为后来的蜀汉留下一点力量？',
        ],
    };
    return null;
}

export function chapterOnwardHTML(chapter: string, ending: string) {
    const copy = chapterOnward(chapter, ending);
    return copy ? frameModal(copy.title, `<div class="chapter-onward-copy">${copy.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}</div><a class="folio-button" data-chapter-onward href="${copy.href}">${copy.label}</a><a class="quiet-button" href="/?view=chapters">回到舆图</a>`, 'history') : '';
}
