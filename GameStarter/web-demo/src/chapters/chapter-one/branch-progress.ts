import { Dialogue, type Story, type AiReceipt } from './branch-engine';

export type BranchSave = { graph: string; line: number; draft: string; selected: string[]; noticeOpened?: boolean };
export class BranchProgress {
    dialogue: Dialogue;
    line = 0;
    draft = '';
    selected: string[] = [];
    noticeOpened = false;
    constructor(readonly story: Story) { this.dialogue = new Dialogue(story); this.skipDirections(); }
    get currentLine() {
        const g=this.dialogue, line=g.frame.lines[this.line] ?? null;
        if(!line || g.pending)return line;
        const repeated=g.trail.some(f=>f.nodeId===g.nodeId && f.kind==='choice');
        if(repeated && g.nodeId==='C01-GUARD-1')return {...line,text:'还有什么要问的？'};
        if(repeated && g.nodeId==='C01-GUARD-NEXT' && line.speaker==='小甲')return {...line,text:'魏将军在前头，你问完就去接一接。'};
        return line;
    }
    get atLastLine() { return !this.dialogue.frame.lines.slice(this.line+1).some(l=>l.speaker!=='演出'||l.visible); }
    get noticePending() { return this.currentLine?.speaker==='告示' && !this.noticeOpened; }
    openNotice() { if(this.noticePending)this.noticeOpened=true; }
    get completed() {
        const g=this.dialogue;
        return !!g.state.reportHandled && !!g.state.orderDelivered
            && (['E-COOP','E-FORMAL'].includes(g.node.endingId ?? '') || g.node.id==='C01-EPILOGUE' || g.node.kind==='terminal');
    }
    next() {
        if (this.noticePending) return;
        if (!this.atLastLine) { this.line++; this.skipDirections(); return; }
        if(!this.dialogue.pending && this.dialogue.node.autoChoice)this.dialogue.choose(this.dialogue.node.autoChoice);
        else this.dialogue.next();
        this.resetInput();
    }
    choose(id: string) {
        if (!this.atLastLine) return;
        if(id==='reread' && this.dialogue.node.kind==='ending' && this.dialogue.choices.some(c=>c.id===id&&c.target===this.story.entry)) {
            this.dialogue.restart();this.noticeOpened=false;
        } else this.dialogue.choose(id);
        this.resetInput();
    }
    ask(text: string) { if (!this.atLastLine) return; this.dialogue.ask(text); this.resetInput(); }
    apply(text: string, result: AiReceipt) { this.dialogue.applyAi(text,result); this.resetInput(); }
    offline(outcome: string, text: string) { this.dialogue.applyOffline(outcome,text); this.resetInput(); }
    retry() { this.dialogue.retryAi(); this.resetInput(); }
    private resetInput() { this.line=0; this.draft=''; this.selected=[]; this.skipDirections(); }
    private skipDirections() {
        // Stage directions stay in the source graph for visual production, never spoken narration.
        for(let hops=0;hops<50;hops++) {
            const lines=this.dialogue.frame.lines;
            while(this.line<lines.length && lines[this.line].speaker==='演出'&&!lines[this.line].visible)this.line++;
            if(this.line<lines.length)return;
            if(this.dialogue.pending || this.dialogue.node.kind==='passage') { this.dialogue.next();this.line=0;continue; }
            // Older saves may stop on the direction after an NPC's final question.
            // Keep that question above the editor instead of rendering an empty heading.
            let lastSpoken=lines.length-1;
            while(lastSpoken>=0 && lines[lastSpoken].speaker==='演出'&&!lines[lastSpoken].visible)lastSpoken--;
            if(lastSpoken>=0)this.line=lastSpoken;
            return;
        }
        throw Error('演出衔接出现循环。');
    }
    snapshot(): BranchSave { return {graph:this.dialogue.serialize(),line:this.line,draft:this.draft,selected:[...this.selected],noticeOpened:this.noticeOpened}; }
    restore(saved: BranchSave) {
        const g=new Dialogue(this.story);
        if (!saved || !g.load(saved.graph) || !Number.isInteger(saved.line) || saved.line<0 || saved.line>g.frame.lines.length || typeof saved.draft!=='string' || saved.draft.length>800 || !Array.isArray(saved.selected)) throw Error('第一章存档不完整，原记录已保留。');
        // Rebuild facts from actions instead of accepting client-supplied flags.
        const rebuilt=new Dialogue(this.story);
        for(const e of g.audit) {
            if(e.type==='next')rebuilt.next();
            else if(e.type==='choose')rebuilt.choose(e.id);
            else if(e.type==='guard')rebuilt.ask(e.text,e.classifierVersion??1);
            else if(e.type==='retryAi')rebuilt.retryAi();
            else if(e.type==='offline')rebuilt.applyOffline(e.outcome,e.text);
            else if(e.type==='ai')rebuilt.applyAi((e.result as AiReceipt & {text:string}).text,e.result);
            else throw Error('第一章存档含未知操作。');
        }
        // Only declared wording revisions may differ; actions, facts and AI receipts stay exact.
        for(const frame of [g.frame,...g.trail]) {
            const node=g.nodes.get(frame.nodeId);
            const revisions=node?.textRevisions??[];
            if(node?.titleRevisions?.includes(frame.title))frame.title=node.displayTitle??node.title;
            for(const line of frame.lines) {
                for(const revision of revisions)if(revision.speaker===line.speaker&&revision.old===line.text)line.text=revision.new;
                const source=node?.lines.find(l=>l.speaker===line.speaker&&l.text===line.text);
                if(source?.visible)line.visible=true;
                else if(source?.speaker==='演出')delete line.visible;
            }
        }
        if(JSON.stringify(rebuilt.snapshot())!==JSON.stringify(g.snapshot()))throw Error('第一章存档与实际经过不符。');
        this.dialogue=rebuilt;this.line=saved.line;this.noticeOpened=saved.noticeOpened===true;this.skipDirections();this.draft=saved.draft;this.selected=saved.selected.filter(id=>this.clues.some(c=>c.id===id));
    }
    get clues() {
        const g=this.dialogue, readFrames=[...g.trail,{...g.frame,lines:g.frame.lines.slice(0,this.line)}];
        const all=readFrames.flatMap(f=>f.lines);
        const heardLine=(nodeId:string,index:number)=>{
            const source=g.nodes.get(nodeId)?.lines[index];
            return !!source && readFrames.some(f=>f.nodeId===nodeId && f.lines.some(l=>l.speaker===source.speaker&&l.text===source.text));
        };
        const clues: {id:string;title:string;text:string}[]=[];
        if(all.some(l=>l.speaker==='告示'))clues.push({id:'branch-order',title:'帐前禁令',text:'丞相早已明令：今夜帐内有要事，不得擅入。'});
        if(heardLine('C01-WEI-OPEN',1))clues.push({id:'branch-enemy',title:'营外的魏军',text:'魏军骑兵已经到了营外，还没有攻营。前营正等着回话。'});
        else if(heardLine('C01-GUARD-ENEMY',2))clues.push({id:'branch-enemy',title:'营外的魏军',text:'小甲说：魏军骑兵在营外来回走，尚未攻营，也没有退去。来意还不清楚。'});
        const remembersJiang=heardLine('C01-HINT-JIANG',0);
        const remembersPromise=heardLine('C01-JIANG-CONFIRM',5);
        if(g.state.knowsJiang||remembersJiang)clues.push(g.state.jiangAgreed
            ? {id:'branch-jiang',title:'伯约已答应接报',text:'伯约亲口答应：有军报便送给他；来人要当面说，也可以带去见他。该禀报丞相的，由他进去禀报。'}
            : remembersPromise && g.state.deathSeen
            ? {id:'branch-jiang',title:'记得伯约的承诺',text:'上一次，伯约答应先看军报，也肯见来报的人；需要禀报丞相的，由他进去。如今重回这一夜，还得再去问过他。'}
            : {id:'branch-jiang',title:'伯约可以代为把关',text:'伯约可以代为听取军情，判断是否需要禀报丞相；可请亲兵通传，尚未取得本人应允。'});
        return clues;
    }
}
