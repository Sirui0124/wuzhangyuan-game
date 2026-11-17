import { campaignEvidence, validateCampaign, type CampaignSnapshot } from '../../campaign/results';
import { indexStoryGraph } from '../../session/story-graph';
export type PangtongEnding = { id:string; title:string; kind:'investigation'|'complete'; description:string };
export type PangtongNode = { id:string; kind:'line'|'choice'|'ending'; act:number; scene:string; portrait:string; speaker:string; text:string;
    next?:string; options?:{id:string;text:string;next:string}[]; checkpoint?:boolean; retry?:string; ending?:string; question?:number };
export type PangtongStory = {schemaVersion:1;chapterId:'luofengpo';contentVersion:string;title:string;start:string;nodes:PangtongNode[];endings:PangtongEnding[]};
export type PangtongAction = {node:string;option?:string};
export type PangtongSave = {schemaVersion:1;chapterId:'luofengpo';contentVersion:string;history:CampaignSnapshot;actions:PangtongAction[];node:string};
export type PangtongTranscript = {speaker:string;text:string;node:string};
const copy = <T>(v:T):T => structuredClone(v);
export class PangtongSession {
    private node:string;
    private actions:PangtongAction[]=[];
    private nodes:Map<string,PangtongNode>;
    private past:CampaignSnapshot;
    private lines:PangtongTranscript[]=[];
    constructor(readonly story:PangtongStory, history:CampaignSnapshot, saved?:unknown) {
        validateCampaign(history); this.past=copy(history); this.node=story.start;
        this.nodes=indexStoryGraph(story.nodes,story.start,'第七章');
        if (story.schemaVersion!==1||story.chapterId!=='luofengpo'||!story.contentVersion) throw new Error('第七章正文不完整。');
        for(const n of story.nodes) {
            if(!['line','choice','ending'].includes(n.kind)||typeof n.text!=='string'||!n.scene) throw new Error('第七章节点格式错误。');
            if(n.kind==='line'&&!n.next) throw new Error('对白缺少衔接。');
            if(n.kind==='choice'&&(!n.options?.length||new Set(n.options.map(o=>o.id)).size!==n.options.length)) throw new Error('选项不完整。');
            if(n.kind==='ending'&&!story.endings.some(e=>e.id===n.ending)) throw new Error('结局不存在。');
        }
        if(saved!==undefined) {
            const s=saved as PangtongSave;
            if(!s||s.schemaVersion!==1||s.chapterId!=='luofengpo'||s.contentVersion!==story.contentVersion||!Array.isArray(s.actions)||s.actions.length>1500) throw new Error('第七章存档版本不匹配。');
            validateCampaign(s.history); this.past=copy(s.history);
            for(const a of s.actions) if(!a||a.node!==this.node||!this.advance(a.option)) throw new Error('存档中的分支记录无效。');
            if(this.node!==s.node) throw new Error('存档进度与选择不一致。');
        }
    }
    get history() { return copy(this.past); }
    get current() {
        const n=copy(this.nodes.get(this.node)!), e=campaignEvidence(this.past);
        const replacements:Record<string,string>={lossText:e.lossText,savedText:e.savedText,
            lossReflection:e.lossStrong?'我确实见过那些死亡。但把所有人的选择都算在庞统一人头上，仍不是我能证明的事。':'我能确认的伤亡有限。他眼下的打算可以追问，后来所有人的命却不能一并算给他。',
            savedReflection:e.savedStrong?'不止一处经历证明，有人确实被带回来了。我可以讲出他们的去处，却不能替天下许诺。':'我手中的经历还不完整。但安置处那几个等着出营的人，就在眼前，不需要拿遥远的胜负证明他们值得活。'};
        n.text=n.text.replace(/\{(\w+)\}/g,(_,key:string)=>{if(!(key in replacements)) throw new Error('未解析的剧情字段');return replacements[key];});return n;
    }
    get ending() {return this.story.endings.find(e=>e.id===this.current.ending);}
    get transcript() {return copy(this.lines);}
    advance(option?:string):boolean {
        const n=this.current;if(n.kind==='ending'||this.actions.length>=1500)return false;
        const picked=n.kind==='choice'?n.options?.find(o=>o.id===option):undefined;
        if(n.kind==='choice'?!picked:option!==undefined)return false;
        const next=picked?.next??n.next;if(!next)return false;
        this.lines.push({speaker:n.speaker,text:n.text,node:n.id});
        if(picked)this.lines.push({speaker:'我',text:picked.text,node:n.id});
        this.actions.push({node:n.id,...(picked?{option:picked.id}:{})});this.node=next;return true;
    }
    retry():PangtongSession {
        const target=this.current.retry??(this.ending?.kind==='complete'?'PT-S0':undefined);
        if(!target)throw new Error('此处不能重试。');
        const index=this.actions.map(a=>a.node).lastIndexOf(target);
        if(index<0)throw new Error('本轮没有对应的重试起点。');
        const s=new PangtongSession(this.story,this.past);
        for(const a of this.actions.slice(0,index))if(!s.advance(a.option))throw new Error('无法恢复重试起点。');
        return s;
    }
    snapshot():PangtongSave {return {schemaVersion:1,chapterId:'luofengpo',contentVersion:this.story.contentVersion,history:this.history,actions:copy(this.actions),node:this.node};}
}
