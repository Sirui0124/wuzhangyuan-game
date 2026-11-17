import { parseJudgment, type Rubric } from './open-dialogue';
import { fixedDialogueResponse } from './dialogue-response';
/** Fixed, visible alternatives when the player chooses not to use AI. */
export const fixedSpeeches = {
    O1: [
        { text:'你五月喝酒，六月才领粮，不能只拿喝酒解释。你先留下，我去核记录，查明白再如实报。', delta:[2,2,2], clip:'CH2-V11A' },
        { text:'你救过我，我不想看你去送死。先留下，让我帮你。', delta:[1,0,0], clip:'CH2-V11N' },
        { text:'这封信就证明李严父子串通好了，让你背锅。我去告他们。', delta:[1,-2,1], clip:'CH2-V11R' },
        { text:'只要你不走，账上真有你的错，我也当没看见。', delta:[1,0,-2], clip:'CH2-V11D' },
        { text:'你不听我的，我就叫军吏抓你。', delta:[-2,0,-1], clip:'CH2-V11T' },
    ],
    O2: [
        { text:'你救过我，也骗过我。我想留下你。现在还没赴魏，先停下计划，如实写清粮情和各人的责任。我陪你送报，确认收讫，但不能保证免罪。', delta:[2,2,2], clip:'CH2-V31A' },
        { text:'我还想听听你的想法。', delta:[1,0,0], clip:'CH2-V31N' },
        { text:'只要补报就一定能免罪，我保证魏人也不会利用你。', delta:[0,-2,0], clip:'CH2-V31R' },
        { text:'你救过我，我护着你。只报缺粮，两封信和你们商议的事都不交。', delta:[1,0,-2], clip:'CH2-V31D' },
        { text:'你敢不听，我现在就叫军吏抓你。你没有资格再选。', delta:[-2,0,-1], clip:'CH2-V31T' },
    ],
};
export function fixedJudgment(round: 'O1'|'O2', index: number, rubric: Rubric) {
    const selected=fixedSpeeches[round][index];
    if (!selected) throw new Error('发言不存在');
    const scores=Object.fromEntries(['trust','rigor','responsibility'].map((key,i)=>[key,{delta:selected.delta[i],quote:selected.text,reason:'已显示的固定发言，按本轮预设评分。'}]));
    return { judgment:parseJudgment(JSON.stringify({valid:true,scores,response:fixedDialogueResponse(round,index,selected.text)}),selected.text,rubric), clip:selected.clip };
}
