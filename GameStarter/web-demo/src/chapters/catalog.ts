/** Navigation metadata only. A preview is never a playable chapter or a save target. */
export const chapterOne = {
    id: 'wuzhang', title: '五丈原守灯', mapTitle: '五丈原', summary: '第六夜 · 守灯与传报',
    availability: 'playable', x: 8, y: 73, narrowX: 8, narrowY: 82,
    story: { script: '/story/chapter-one.script.json', flow: '/story/chapter-one.flow.json', manifest: '/story/session-manifest.json' },
} as const;

export const grainPreview = {
    id: 'grain', title: '北伐粮运危机', mapTitle: '祁山', summary: '下一次时光倒流',
    availability: 'preview', x: 37, y: 58, narrowX: 54, narrowY: 68,
} as const;

export const lockedMapChapters = [] as const;
export const pangtongChapter = {
    id: 'luofengpo', title: '庞统', mapTitle: '落凤坡', summary: '一封死讯，四条归路',
    availability: 'playable', x: 8, y: 12, narrowX: 55, narrowY: 8,
} as const;

export const jietingChapter = {
    id: 'jieting', title: '街亭', mapTitle: '街亭', summary: '一条退路，两人的胜仗',
    availability: 'playable', x: 68, y: 44, narrowX: 10, narrowY: 53,
} as const;

export const yilingChapter = {
    id: 'yiling', title: '夷陵', mapTitle: '夷陵', summary: '败局之后，把他们带回家',
    availability: 'playable', x: 71, y: 15, narrowX: 55, narrowY: 37,
} as const;

export const jingzhouChapter = {
    id: 'jingzhou', title: '荆州', mapTitle: '荆州', summary: '问清军报，辨明真假',
    availability: 'playable', x: 39, y: 26, narrowX: 9, narrowY: 22,
} as const;
export const chapterCatalog = [chapterOne, grainPreview, jietingChapter, yilingChapter, jingzhouChapter, pangtongChapter];
