import type { GrainSession } from './session';
import type { DialoguePolishInput } from '../../dialogue-polish';

export const grainPolishDirections = {
    O1: `版本 gouan-stay-v1。第一次劝苟安暂留，眼前的问题是“你要我留下，总得让我看见一条别的路”。若选中五月饮酒口述与六月领粮记录，明确区分饮酒时间和这批领粮时间：不能单凭五月饮酒解释六月后的迟粮，需要核查；不能写成已经查明无罪。若玩家愿意查证，把查什么、为什么请他暂留接在一起；只有关心不能冒充调查方案。李丰第一封信仅支持曾有前议与担心牵连，不证明父子合谋。关心他与追查责任可以并存，不为了顺耳删掉“核实后如实报告”，也不替玩家保证免责。已选事实支持调查建议时，写成具体请求，尚未授权只能请求、不能说奉命查案。`,
    O2: `版本 gouan-responsibility-v3-concise。已调查后再次面对苟安，把所选事实直接接到玩家本次提出的帮助与补救上，不先逐份汇报记录、信件与供述。合并表达不等于任选材料：已选信件与供述不能被“各人责任”或赴魏计划替代，材料多时允许略长，先保留独立事实再删重复。已发生的隐瞒、串联与尚未实施的赴魏散谣保持区别；后者的触发条件和可能风险仍要保留，不能只剩“尚未实行”。若玩家选择补救，保留原有的停下计划、如实说明各人责任、附原件、送报与确认收到等安排；没有提出的个人陪同、担责、赠物承诺不能代加。以玩家已有的具体行动收尾，不再追加同意询问；原话本就有疑问则保留。补报与不能保免罪已经说明责任，不另加“这不等于没责任”的解释，也不写成已经署名、送达或被赦免。`,
};
/** The clue's decision-relevant meaning is spoken; its source dialogue remains available for verification. */
export function grainPolishEvidence(c: GrainSession['clues'][number]): DialoguePolishInput['evidence'][number] {
    const sources=(c.sources??[]).map(({speaker,text})=>({speaker,text}));
    const original=sources.map(x=>x.text).join('\n');
    const meaning: Record<string, { anchor: string; text: string }> = {
        'LY-X04': {anchor:'五月',text:'苟安自述五月在永安饮酒；这是他的口述。'},
        'LY-X06': {anchor:'六月初二',text:'本队领粮单记载：苟安于六月初二在永安领粮。'},
        'LY-M06': {anchor:'本批实收少于应征',text:'本批实收未足应征，差额仍欠交；应征数不是已收到的粮。'},
        'LY-M07': {anchor:'均在本批交接记录所列当日',text:'缺额报告在本批交接当日送达，苟安当天签认。'},
        'LY-M08': {anchor:'均在本批交接记录所列当日',text:'当前取得的核验记录确认：本批交接、缺额报告送达和苟安签认在同一天。'},
        'LY-C11': {anchor:'劝父亲与苟安停止',text:'李丰担心父亲安危，第二封信劝李严和苟安停下原计划。'},
        'LY-C12': {anchor:'骗你，是后来的事',text:'苟安承认崖边救我是真心，后来却与李严谋划借查粮逼退军：李严担部分责任，苟安扮顶罪者，骗我送材料。'},
        'LY-C14': {anchor:'眼下还没有赴魏',text:'若退军后仍催征，苟安与李严打算赴魏散谣逼朝廷召军，尚未实行；此举可能泄露粮道、招来追击，谣言难收，苟安无把握控制。'},
    };
    // A later source extension must be reviewed, never silently reduced to the earlier partial record.
    const selected=(c.id==='LY-M07'||c.id==='LY-M08')&&sources.length!==1?undefined:meaning[c.id];
    return {id:c.id,text:selected&&original.includes(selected.anchor)?selected.text:[c.title,...sources.map(x=>x.speaker+'：'+x.text)].join('\n'),boundary:c.detail,sources};
}
export function grainPolishInput(s: GrainSession): DialoguePolishInput {
    if(s.current.kind!=='open'||!s.current.round)throw new Error('当前不是交谈入口。');
    const round=s.current.round;
    return {scene:'gouan-'+round,node:s.current.id,listener:'苟安',question:round==='O1'?'你要我留下，总得让我看见一条别的路。':'该说的，我已经说了。你现在准备拿我怎么办？',words:s.state.draft,
        direction:grainPolishDirections[round] + '这段话由我对苟安说。question是苟安刚刚说的话，其中“我”指苟安，不能照抄成我的立场。用眼前材料的自然称呼交代来源，不朗读“属于口述”“文书所载”等资料标签，也不以“我提一个方案”开场；重复事实可以合成一句。'
            + (round==='O2'?'本幕合并同义内容，不压掉不同事实：粮账用实收不足应征、差额仍欠的一句话表达，要求交纳的数不等于已经收到，不逐字解释术语。交接、缺额报告送达、签认的同日关系只说一次。选中第二封信时，保留李丰担心父亲、劝李严与苟安停手；选中供述时，连着说清真心救命在前，后来与李严借查粮逼退军，由李严担部分责任、苟安扮顶罪者并骗我送材料。这两项各有独立含义，不能因为说了粮账、赴魏或补救就整项省去；未选则不补。选中赴魏计划时，保留退军后仍催征这一触发条件、尚未实施，以及泄露粮道、招来追击、谣言难收且他无把握控制的风险；这些可合在一句，不能用“仍有责任”代替。陪同送报、附原件、确认收到、不保免罪按原话合成具体补救，不再重复“我想帮你”或另问一遍是否同意。':''),
        evidence:s.clues.filter(c=>s.state.selected.includes(c.id)).map(grainPolishEvidence),
        continuity:{previousWords:Object.values(s.state.judgments).map(j=>j.input),currentReply:s.state.judgments[s.current.id]?.reply??''}};
}
