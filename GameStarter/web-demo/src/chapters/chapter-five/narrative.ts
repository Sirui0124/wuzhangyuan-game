export type StoryLine = { speaker: string; text: string };
export type Reply = 'stay' | 'people';
export const opening: StoryLine[] = [
    { speaker: '眼前所见', text: '荆州已经失守。帐外不时有人下马，带进来的消息却各不相同。关羽坐在灯下，一封军报看了许久。' },
    { speaker: '关羽', text: '一个说渡口还能走，一个说船已经没了。前后不到半个时辰，叫我信谁？' },
    { speaker: '我', text: '让报信的人进来吧。我问问他们，到底看见了什么。' },
    { speaker: '关羽', text: '有些人跟了我多年，未必存心害我。可如今走错一步，后面这些人就回不去了。' },
    { speaker: '我', text: '我会听清楚再下判断。将军，让第一人进帐吧。' },
];
export function outcome(judged: number) { return judged >= 5 ? 'return' : judged >= 3 ? 'costly' : 'lost'; }
export function ending(judged: number) {
    const kind = outcome(judged);
    return kind === 'lost'
        ? { title: '未归', text: '几条误信的军报耽误了撤离。关羽未能脱险，最终被俘身亡。你带着撤出的人回去，再没有等到他。' }
        : { title: kind === 'return' ? '归来以后' : '迟归', text: `${kind === 'costly' ? '撤离途中折损了一些人，关羽还是回来了。' : '关羽和余部回到了蜀中。'}刘备没有责罚他，可他始终放不下失去的荆州。此后身体日渐衰弱，终于郁郁而终。` };
}
export function replies(judged: number): { id: Reply; text: string }[] {
    return outcome(judged) === 'lost'
        ? [{ id: 'stay', text: '我留下，陪将军守这一程。' }, { id: 'people', text: '我先把他们带出去，再来接将军。' }]
        : [{ id: 'stay', text: '我随将军走，路上继续核对消息。' }, { id: 'people', text: '我去催后队，别让人落下。' }];
}
export function aftermath(judged: number, reply: Reply | ''): StoryLine[] {
    const kind = outcome(judged), lost = kind === 'lost';
    return [
        { speaker: '关羽', text: lost ? '前面已经走错了路，追兵就要到了。你带后队先走，我来断后。' : kind === 'costly' ? '前头的消息有误，几队人已经走散了。眼下先把还能找到的人带出去。' : '就照你核过的消息走。只是荆州……我守了这么多年。' },
        { speaker: '我', text: '我看着关羽，开口道：' },
        { speaker: '关羽', text: lost ? (reply === 'stay' ? '这里有我。后队没人带，你留下，他们怎么办？快走。' : '先送他们走。若回不来，就别再往这里闯了。') : (reply === 'stay' ? '好，跟紧些。若有新的消息，先报给我，别再让全军跟着传言走。' : '去吧。让能走的扶着伤员，我在前面等你们。') },
        { speaker: '眼前所见', text: lost ? '后队撤出去时，追兵已截断了归路。关羽没有赶来。几日后，传回了他被俘的消息。' : kind === 'costly' ? '队伍绕了远路，沿途又折了人。回到蜀中那天，关羽在营门前等到天黑，也没等齐出发时的人。' : '这一次，关羽带着余部脱了险。回到蜀中，刘备仍像从前那样唤他云长，先让他歇息。' },
        { speaker: lost ? '我' : '关羽', text: lost ? '撤出来的人都点过名了。再等等，兴许还有人能回来。' : '大哥不责我……可荆州是从我手里丢的。那些留在城里的人，我还没能带回来。' },
    ];
}
