import { Dialogue, type Story, type AiReceipt } from './branch-engine';

export type BranchSave = { graph: string; line: number; draft: string; selected: string[]; noticeOpened?: boolean };
export class BranchProgress {
    dialogue: Dialogue;
    line = 0;
    draft = '';
    selected: string[] = [];
    noticeOpened = false;
    constructor(readonly story: Story) { this.dialogue = new Dialogue(story); this.skipDirections(); }
    get currentLine() { return this.dialogue.frame.lines[this.line] ?? null; }
    get atLastLine() { return !this.dialogue.frame.lines.slice(this.line+1).some(l=>l.speaker!=='演出'); }
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
        this.dialogue.next(); this.resetInput();
    }
    choose(id: string) { if (!this.atLastLine) return; this.dialogue.choose(id); this.resetInput(); }
    ask(text: string) { if (!this.atLastLine) return; this.dialogue.ask(text); this.resetInput(); }
    apply(text: string, result: AiReceipt) { this.dialogue.applyAi(text,result); this.resetInput(); }
    offline(outcome: string, text: string) { this.dialogue.applyOffline(outcome,text); this.resetInput(); }
    retry() { this.dialogue.retryAi(); this.resetInput(); }
    private resetInput() { this.line=0; this.draft=''; this.selected=[]; this.skipDirections(); }
    private skipDirections() {
        // Stage directions stay in the source graph for visual production, never spoken narration.
        for(let hops=0;hops<50;hops++) {
            const lines=this.dialogue.frame.lines;
            while(this.line<lines.length && lines[this.line].speaker==='演出')this.line++;
            if(this.line<lines.length)return;
            if(this.dialogue.pending || this.dialogue.node.kind==='passage') { this.dialogue.next();this.line=0;continue; }
            // Older saves may stop on the direction after an NPC's final question.
            // Keep that question above the editor instead of rendering an empty heading.
            let lastSpoken=lines.length-1;
            while(lastSpoken>=0 && lines[lastSpoken].speaker==='演出')lastSpoken--;
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
            else if(e.type==='guard')rebuilt.ask(e.text);
            else if(e.type==='retryAi')rebuilt.retryAi();
            else if(e.type==='offline')rebuilt.applyOffline(e.outcome,e.text);
            else if(e.type==='ai')rebuilt.applyAi((e.result as AiReceipt & {text:string}).text,e.result);
            else throw Error('第一章存档含未知操作。');
        }
        if(JSON.stringify(rebuilt.snapshot())!==JSON.stringify(g.snapshot()))throw Error('第一章存档与实际经过不符。');
        this.dialogue=rebuilt;this.line=saved.line;this.noticeOpened=saved.noticeOpened===true;this.skipDirections();this.draft=saved.draft;this.selected=saved.selected.filter(id=>this.clues.some(c=>c.id===id));
    }
    get clues() {
        const g=this.dialogue, all=[...g.trail.flatMap(f=>f.lines),...g.frame.lines.slice(0,this.line)];
        const clues: {id:string;title:string;text:string}[]=[];
        if(all.some(l=>l.speaker==='告示'))clues.push({id:'branch-order',title:'帐前禁令',text:'丞相早已明令：今夜帐内有要事，不得擅入。'});
        if(g.state.metWei)clues.push({id:'branch-enemy',title:'营外的魏军',text:'魏军骑兵已经到了营外，还没有攻营。前营正等着回话。'});
        if(g.state.knowsJiang)clues.push({id:'branch-jiang',title:'伯约可以代为把关',text:'伯约可以代为听取军情，判断是否需要禀报丞相；可请亲兵通传，尚未取得本人应允。'});
        return clues;
    }
}
