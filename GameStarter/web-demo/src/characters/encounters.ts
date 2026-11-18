/** Authored entrances, never text/name matching. Mentioning a name grants nothing. */
export type CharacterEntrance = { chapter: 'wuzhang' | 'grain' | 'jieting'; node: string; people: string[]; when: 'enter' | 'complete'; note: string };
export const characterEntrances: CharacterEntrance[] = [
    {chapter:'wuzhang',node:'branch-person:小甲',people:['guard'],when:'complete',note:'新版中实际读到小甲发言。'},
    {chapter:'wuzhang',node:'branch-person:魏延',people:['weiyan'],when:'complete',note:'新版中实际读到魏延发言。'},
    {chapter:'wuzhang',node:'branch-person:姜维',people:['jiangwei'],when:'complete',note:'新版中实际见到姜维并听他发言；提名不授予。'},
    ...['C01-JIANG-CONFIRM','C01-JIANG','C01-JIANG-RELAY','C01-JIANG-JOINT'].map(node=>({
        chapter:'wuzhang' as const,node:`branch-encounter:${node}`,people:['jiangwei_guard'],when:'complete' as const,note:'亲兵实际通传，姜维已在帐外开口。',
    })),
    { chapter: 'jieting', node: 'JT-004', people: ['jieting-water'], when: 'enter', note: '与我一起挑水的军士实际开口。' },
    { chapter: 'jieting', node: 'JT-008', people: ['wangping'], when: 'enter', note: '帐前实际见王平陈述守亭任务。' },
    { chapter: 'jieting', node: 'JT-009', people: ['masu'], when: 'enter', note: '马谡当面说明自己的打法；心声中的提名不计。' },
    { chapter: 'jieting', node: 'JT-021', people: ['jieting-clerk'], when: 'enter', note: '选择当面问探马时，由军吏传唤。' },
    { chapter: 'jieting', node: 'JT-068', people: ['jieting-clerk'], when: 'enter', note: '营后问军情，其他分支在此首次遇见。' },
    { chapter: 'jieting', node: 'JT-024', people: ['jieting-scout'], when: 'enter', note: '当面听到探马的第一份军报。' },
    { chapter: 'jieting', node: 'JT-069', people: ['jieting-scout'], when: 'enter', note: '未提前听报的分支在营后实际遇见探马。' },
    { chapter: 'jieting', node: 'JT-061', people: ['jieting-mover'], when: 'enter', note: '实际帮搬营军士扶起帐杆。' },
    { chapter: 'jieting', node: 'JT-125', people: ['jieting-messenger'], when: 'enter', note: '山下传令军士实际回答守路军情。' },
    { chapter: 'jieting', node: 'JT-127', people: ['jieting-leader'], when: 'enter', note: '实际见领队军士说明行军列阵所需工夫。' },
    { chapter: 'wuzhang', node: 'cinematic:opening', people: ['zhugeliang'], when: 'complete', note: '开场影像结束后收录；不在片头提前标名。' },
    { chapter: 'wuzhang', node: 'A-19', people: ['scout'], when: 'enter', note: '斥候来报／C1T02-03。' },
    { chapter: 'wuzhang', node: 'A-28', people: ['weiyan'], when: 'enter', note: '魏延急报／C1T05-05。' },
    { chapter: 'wuzhang', node: 'A-42', people: ['guard'], when: 'enter', note: '向甲转呈／C1T06-06 或 C1FIX06B。' },
    { chapter: 'wuzhang', node: 'D01', people: ['guard'], when: 'enter', note: '回溯后向甲问话／C1FIX09；旧档补录。' },
    { chapter: 'wuzhang', node: 'D07', people: ['relay'], when: 'enter', note: '向乙问当值／C1FIX10Q；甲乙可自由排序。' },
    { chapter: 'wuzhang', node: 'D17', people: ['scout'], when: 'enter', note: '再次核实敌情；旧档补录。' },
    { chapter: 'wuzhang', node: 'J03', people: ['jiangwei_guard'], when: 'enter', note: '向亲兵请求通传／C1FIX14Q。' },
    { chapter: 'wuzhang', node: 'J08', people: ['jiangwei'], when: 'enter', note: '到将军面前请求接报／C1T14-request。' },
    { chapter: 'wuzhang', node: 'W02', people: ['weiyan'], when: 'enter', note: '第二次迎魏延；旧档补录。' },
    { chapter: 'grain', node: 'V02', people: ['gouan'], when: 'complete', note: '伤帐认人影像完成才确认姓名；V01仅见救命队长。' },
    { chapter: 'grain', node: 'V05', people: ['grain-officer'], when: 'complete', note: '夜间取账中遇粮队管事。' },
    { chapter: 'grain', node: 'V13', people: ['warehouse-clerk'], when: 'complete', note: '管事陪同核凭据，获仓吏许可。' },
    { chapter: 'grain', node: 'V17', people: ['frontline-receiver'], when: 'enter', note: '接收人当面核对交付。' },
    { chapter: 'grain', node: 'V20', people: ['local-levy-handler', 'transport-handler'], when: 'complete', note: '多人交替镜头，片后统一收录，避免提前展示未入镜者。' },
    { chapter: 'grain', node: 'V23', people: ['old-woman'], when: 'complete', note: '获准访村，亲见老妇人后收录。' },
    { chapter: 'grain', node: 'V24', people: ['liyan'], when: 'complete', note: '夜访回忆实际呈现李严；此前信件提名不解锁。' },
    { chapter: 'grain', node: 'V26', people: ['military-clerk'], when: 'complete', note: '返营交差、军吏实际核收材料。' },
    { chapter: 'grain', node: 'CH2-LY01-012', people: ['gouan'], when: 'enter', note: '文字试玩版认人节点。' },
    { chapter: 'grain', node: 'CH2-LY02-013', people: ['grain-officer'], when: 'enter', note: '文字试玩版管事允许查阅。' },
];
export type CharacterProgress = { chapter: 'wuzhang' | 'grain' | 'jieting'; entered: string[]; completed: string[]; active?: string; visible: boolean };
export function encounteredCharacters(progress: CharacterProgress): string[] {
    const entered = new Set(progress.entered), completed = new Set(progress.completed);
    return [...new Set(characterEntrances.filter(e => e.chapter === progress.chapter && (e.when === 'complete' ? completed.has(e.node) : entered.has(e.node) || completed.has(e.node))).flatMap(e => e.people))];
}
