import type { Ending } from '../endings';

export const achievementChapters = { wuzhang: '五丈原', grain: '祁山', jieting: '街亭', luofengpo: '庞统' } as const;
export type AchievementChapter = keyof typeof achievementChapters;
const milestone = (chapter: AchievementChapter, id: string, title: string, description: string, hint: string, emblem: string): Ending => ({
    id: `${chapter}-${id}`, number: '', chapter, category: 'milestone', phase: `${achievementChapters[chapter]} · 经历`, result: '', title, description, hint, kind: '行旅留痕', emblem,
});
export const milestoneAchievements: Ending[] = [
    milestone('wuzhang', 'second-night', '再赴夕阳', '再一次站在营前，夕阳仍旧。上一回没能走完的路，这回可以重新走过。', '经历第一次回溯，重返第六夜。', 'rewind'),
    milestone('wuzhang', 'inquiry', '把话问全', '敌军的动静、帐前的禁令、能够接报的人，你都亲耳问过。这次回话，有了更完整的依据。', '收集袭扰变化、敌军探问、帐前禁令与姜维代行军务的五条见闻。', 'report'),
    milestone('grain', 'dates', '五月与六月', '一句五月的自述，一笔六月的记录。把两处日期放在一起，事情便有了需要再问的地方。', '听完苟安饮酒自述，并读到六月初二的领粮记录。', 'calendar'),
    milestone('grain', 'ledgers', '六册相照', '签收、交付、损耗、入仓、实收、应征，六份记录都翻过了。缺口落在哪一程，得让账目自己说话。', '逐一查看粮队交接处的六份账目。', 'ledger'),
    milestone('grain', 'letter', '落笔为凭', '口头说过的话，落成了正式补报。正文与附件一并送出，往后便有据可查。', '确认并送出共同补报的正文与附件。', 'letter'),
    milestone('jieting', 'visits', '三处问明', '王平的担忧、马谡的打算、营后的见闻，你都走了一趟。山上山下的事，开始接在一起。', '完成王平、马谡与营后三处走访。', 'map'),
    milestone('jieting', 'water', '护水有兵', '护水的兵已经走到山下。取水的人身边，有了一队专门护送的兵。', '让负责护水的增援实际到营。', 'water'),
    milestone('jieting', 'ten-thousand', '万人在营', '领队报上来的数字，终于到了一万。纸上的调令变成了营中的人手，接应有了可以倚仗的队伍。', '山下实际到营人数达到一万人。', 'banner'),
    milestone('jieting', 'verified-withdrawal', '当面复命', '传令军士当面回报：山道仍通，坡脚有人接应。这次劝下山，有人能把刚走过的路说清。', '请传令军士当面核实下山通路与接应。', 'report'),
];

export const grainEndingCopy = [
    ['E1', '一起回头', '双方补报正式收件，裁处也已落定。一起走过这一程的人，终于能够一起回头。', '共同补报'],
    ['E2', '救下眼前的人', '你留住了眼前的人。这一程的结果，记在了归来的路上。', '暂保其身'],
    ['E3', '真相到了，人没回来', '案卷送到了，查办也有了结果。再回营时，苟安的铺位却空了。', '晚交案'],
    ['E4-early', '认下来的罪', '你选择提早停下追查。这份案卷最终留下的，是认下来的罪。', '早停查'],
    ['E4-late', '认下来的罪', '追查走到了后面，补报却缺少足够支撑。事情最终落在了认下来的罪上。', '晚交案 · 支撑不足'],
    ['E5', '还是走上了险路', '你放苟安离开。先前谈过的险路，终于成了后来发生的事。', '放行'],
] as const;
export const jietingEndingIds = ['hold-both', 'hold-masu-dies', 'great-victory', 'retreat', 'execution', 'mountain-trapped', 'rear-sacrifice'] as const;
export const pangtongEndingIds = ['retreat','sacrifice','feign','future'] as const;
export const extraAchievementIds = new Set([...milestoneAchievements.map(e => e.id), ...grainEndingCopy.map(e => `grain-${e[0]}`), ...jietingEndingIds.map(id => `jieting-${id}`), ...pangtongEndingIds.map(id => `luofengpo-${id}`)]);

export function pangtongAchievementCatalog(story: {endings:{id:string;kind:string;title:string;description:string}[]}): Ending[] {
    return story.endings.filter(e=>e.kind==='complete' && pangtongEndingIds.some(id=>id===e.id)).map((e,i)=>({
        id:`luofengpo-${e.id}`,number:`终${i+1}`,chapter:'luofengpo',category:'ending',phase:'第七章 · 庞统',result:e.id,
        title:e.title,description:e.description,kind:'终章结局',hint:'亲历这一条归路后收录。',emblem:e.id==='future'?'lamp':e.id==='feign'?'letter':e.id==='retreat'?'mountain':'banner',
    }));
}

/** Existing ending titles and descriptions remain owned by each chapter's story. */
export function extraAchievementCatalog(jieting: { endings: { id: string; title: string; description: string; success: boolean }[] }): Ending[] {
    const endings: Ending[] = [
        ...grainEndingCopy.map(([id, title, description, kind]) => ({ id: `grain-${id}`, number: '', chapter: 'grain', category: 'ending' as const, phase: `祁山 · ${kind}`, result: id, title, description, kind, hint: '亲历这个结局后收录。', emblem: ['E1','E2'].includes(id) ? 'road' : id === 'E3' ? 'letter' : 'ledger' })),
        ...jieting.endings.filter(e => jietingEndingIds.some(id => id === e.id)).map(e => ({ ...e, id: `jieting-${e.id}`, number: '', chapter: 'jieting', category: 'ending' as const, phase: '街亭 · 结局', result: e.id, kind: e.success ? '守城留名' : '此程留痕', hint: '亲历这个结局后收录。', emblem: e.id === 'great-victory' ? 'banner' : e.success ? 'gate' : 'mountain' })),
    ];
    return [...milestoneAchievements, ...endings].map((e, i) => ({ ...e, number: `录${String(i + 1).padStart(2, '0')}` }));
}
