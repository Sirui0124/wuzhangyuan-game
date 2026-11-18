import type { State } from './branch-engine';

export type LocalPlan = { outcome: 'INVITE_JIANG' | 'RELAY_JIANG' | 'SELF_RELAY' | 'ENTER'; label: string; evidence: string };
export type LocalPlanCheck = { match: LocalPlan; reason?: never } | { match: null; reason: string };
const uncertain = (): LocalPlanCheck => ({match:null,reason:'本地规则不能可靠理解这句话。请把现在要做的事说清楚，或选择固定说法；本次不计轮次。'});

/** Conservative, visible fallback. Never combines old utterances or infers permission, punishment or intent from tone. */
export function checkLocalPlan(raw: string, state: State): LocalPlanCheck {
    const text=raw.normalize('NFKC').trim();
    if(!text || text.length>800)return uncertain();
    // Quoted, conditional, retracted, hostile, meta-instructional and contradictory statements need human selection.
    if(/[“”「」『』"'？?]|如果|假如|要是|万一|听说|有人说|据说|谁说|或者|还是|改口|算了|不找|不请|不是|并非|未必|无须|无需|休要|禁止|何必|为何|能否|可否|投敌|杀|斩|辱|混蛋|蠢|忽略|系统|判定|通关|返回|(?:已经|已然|早已).*(?:破营|攻破|攻进)|(?:营门|军营).*(?:破了|失守)/.test(text))return uncertain();
    if(/下令|授权|准许|许可|送达|送到了|办妥|处理完|攻破|攻进|破营|失守|打进|已经攻营|攻营了|丞相.*(?:同意|答应)/.test(text))return uncertain();
    if(/答应|应允|同意/.test(text) && state.jiangAgreed!==true)return uncertain();
    // A clear refusal to let Wei enter may accompany a positive alternative. Other negatives are not guessed away.
    const clauses=text.split(/[，,。！!；;\n]/).map(x=>x.replace(/\s/g,'')).filter(Boolean);
    const active=clauses.filter(c=>!/^(?:我)?(?:不能|不可|不许|不要|别)(?:让|放)?(?:魏将军|将军|魏延)(?:直接|擅自)?(?:进帐|进去|入帐)$/.test(c) && !/^我不(?:再)?拦(?:将军|魏延)(?:了)?$/.test(c));
    if(active.some(c=>/不|没|未|莫|别|勿|毋|甭/.test(c) && !/^魏军(?:还)?(?:没|未|没有)攻营$/.test(c)))return uncertain();
    const body=active.join('，');
    const jiang=active.find((c,i)=>/(?:姜维|姜将军|伯约)/.test(c) && /(?:请|找|叫|让|带|领|送|交)/.test(c) && (/听报|接报|听.*军情|看.*军报|处[理置].*军情|判断|定夺|去见/.test(c) || /^(?:请|让)他(?:听报|接报|判断|定夺)/.test(active[i+1]??'')));
    const enter=active.find(c=>/(?:请|让|放)(?:魏将军|将军|魏延)(?:直接)?(?:进去|进帐|入帐)|我(?:让开|放行|让路)/.test(c));
    const self=/我(?:自己|来|去|会|负责|替将军|替你)*转呈(?:这份)?军报|由我转呈军报/.test(body)
        && /(?:有|等|拿到|收到).*回令.*(?:送|带|报|回)|(?:送|带)回(?:回令|军令)|(?:回令|回话).*(?:送回|带回|报给)/.test(body);
    if(Number(!!jiang)+Number(!!enter)+Number(self)>1)return uncertain();
    if(jiang){
        if(state.knowsJiang!==true)return {match:null,reason:'当前线索还不能确认这个接报安排。可改用固定说法继续；本次不计轮次。'};
        const relay=/送|交/.test(jiang) && !/听报|去见/.test(jiang);
        return {match:{outcome:relay?'RELAY_JIANG':'INVITE_JIANG',label:'请伯约听取或处理军情',evidence:jiang}};
    }
    if(enter)return {match:{outcome:'ENTER',label:'让魏延入帐',evidence:enter}};
    if(self)return {match:{outcome:'SELF_RELAY',label:'由我转呈军报并传回回话',evidence:body}};
    return uncertain();
}
