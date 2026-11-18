export type State = Record<string, string | boolean>;
export type Line = { speaker: string; text: string; visible?: boolean };
export type Edge = { id?: string; label?: string; legacy?: boolean; target: string; effects?: State; when?: State; say?: Line[]; response?: Line[] };
export type AiRoute = { target?: string; effects?: State; intent: string; fallback: string; variants?: (Partial<Omit<AiRoute, 'variants'>> & { when: State })[] };
export type AiScene = {
  allowRetry?: boolean; npc: string; historyWindowRounds: number; maxTurns: number; inputLabel: string; placeholder: string; scaffold: string;
  knownHint: { when: State; text: string }; routes: Record<string, AiRoute>;
};
export type AiReceipt = { nodeId: string; version: string; requestId: string; outcome: string; reply: string; replySource: string; contextHash: string; signature: string };
export type AuditEvent = { type: 'choose'; id: string } | { type: 'next' } | { type: 'guard'; text: string; classifierVersion?: 2 } | { type: 'ai'; result: AiReceipt } | { type: 'retryAi' } | { type: 'offline'; outcome: string; text: string };
export type Exchange = { id: string; player: string; npc: string };
export type StoryNode = {
  id: string; title: string; displayTitle?: string; kind: 'passage' | 'choice' | 'router' | 'ending' | 'terminal' | 'ai';
  ai?: { sceneId: string };
  autoChoice?: string;
  lines: Line[]; requires?: State; afterLines?: State; hintAward?: string;
  textRevisions?: {speaker: string; old: string; new: string}[];
  titleRevisions?: string[];
  film?: {id:string;src:string;title:string;subtitles?:string;beforeLine:number;afterNode?:string;afterLine?:number;leadIn?:{id:string;src:string;title:string;subtitles?:string}[]};
  next?: string; choices?: Edge[]; routes?: Edge[]; endingId?: string;
  freeInput?: { placeholder: string; submitLabel: string; intentRoutes: { intent: string; target: string }[] };
};
export type Story = {
  id: string; version: string; entry: string; initialState: State; nodes: StoryNode[];
  hints: { id: string; title: string; text: string; state: string }[]; aiScenes: Record<string, AiScene>;
};
export type Frame = { nodeId: string; title: string; kind: string; lines: Line[]; selected?: string };
type Snapshot = { state: State; nodeId: string; pending: Edge | null; frame: Frame; trail: Frame[]; audit: AuditEvent[]; exchange: Exchange[]; aiHeld: boolean };
const clone = <T>(x: T): T => structuredClone(x);
const matches = (state: State, condition: State = {}) => Object.entries(condition).every(([key, value]) => state[key] === value);

/** Pure graph runner; no game imports, network calls or implicit clue awards. */
export class Dialogue {
  readonly story: Story;
  readonly nodes: Map<string, StoryNode>;
  state: State;
  nodeId = '';
  pending: Edge | null = null;
  frame!: Frame;
  trail: Frame[] = [];
  history: Snapshot[] = [];
  audit: AuditEvent[] = [];
  exchange: Exchange[] = [];
  aiHeld = false;

  constructor(story: Story) {
    this.story = story;
    this.nodes = new Map(story.nodes.map(n => [n.id, n]));
    if (this.nodes.size !== story.nodes.length) throw Error('剧情节点编号重复。');
    this.state = clone(story.initialState);
    this.enter(story.entry);
  }
  get node() { return this.nodes.get(this.nodeId)!; }
  get hints() { return this.story.hints.filter(h => this.state[h.state] === true); }
  get choices() { return this.pending ? [] : (this.node.choices ?? []).filter(e=>!e.legacy&&matches(this.state,e.when)); }
  aiRoute(outcome: string) {
    const base=this.aiScene?.routes[outcome];
    return base ? {...base,...base.variants?.find(v=>matches(this.state,v.when))} : undefined;
  }
  get aiScene() { return this.node.ai ? this.story.aiScenes[this.node.ai.sceneId] : null; }
  get aiHint() { const h = this.aiScene?.knownHint; return h && matches(this.state, h.when) ? h.text : ''; }
  snapshot(): Snapshot { return clone({ state: this.state, nodeId: this.nodeId, pending: this.pending, frame: this.frame, trail: this.trail, audit: this.audit, exchange: this.exchange, aiHeld: this.aiHeld }); }
  private save() { /* Mainline uses explicit chapter saves; no per-click rewind stack. */ }
  private restore(s: Snapshot) { Object.assign(this, clone(s)); }
  back() { const s = this.history.pop(); if (s) this.restore(s); }
  restart() {
    this.save(); this.state = clone(this.story.initialState); this.pending = null; this.trail = []; this.audit = []; this.enter(this.story.entry);
  }
  private enter(id: string) {
    for (let hops = 0; hops < 30; hops++) {
      const n = this.nodes.get(id);
      if (!n) throw Error(`剧情缺少节点：${id}`);
      if (!matches(this.state, n.requires)) throw Error(`前置条件不满足：${id}`);
      if (n.kind === 'router') {
        const exits = n.routes!.filter(e => matches(this.state, e.when));
        if (exits.length !== 1) throw Error(`分支条件不唯一：${id}`);
        Object.assign(this.state, exits[0].effects); id = exits[0].target; continue;
      }
      this.nodeId = id; this.pending = null; this.exchange = []; this.aiHeld = false;
      this.frame = { nodeId: id, title: n.displayTitle ?? n.title, kind: n.kind, lines: clone(n.lines) };
      // Mainline reads a node line by line; commit its facts only on leaving it.
      return;
    }
    throw Error('条件节点出现循环。');
  }
  private finish(edge: Edge) {
    Object.assign(this.state, edge.effects);
    this.enter(edge.target);
  }
  private take(edge: Edge, lines: Line[], selected: string) {
    Object.assign(this.state, this.node.afterLines);
    this.save();
    this.trail.push({ ...clone(this.frame), selected });
    if (lines.length) {
      this.pending = clone(edge);
      this.frame = { nodeId: this.nodeId, title: this.node.displayTitle ?? this.node.title, kind: 'reply', lines: clone(lines) };
    } else this.finish(edge);
  }
  choose(id: string) {
    const e = this.pending ? undefined : this.node.choices?.find(c => c.id === id && matches(this.state,c.when));
    if (!e) throw Error('当前没有这个选项。');
    this.take(e, [...(e.say ?? []), ...(e.response ?? [])], e.label!);
    this.audit.push({ type: 'choose', id });
  }
  ask(text: string, classifierVersion: 1 | 2 = 2) {
    if (classifierVersion !== 1 && classifierVersion !== 2) throw Error('问话规则版本无效。');
    if (this.pending || !this.node.freeInput) throw Error('此处不能自由提问。');
    const input = text.trim();
    if (!input || input.length > 400) throw Error('请写下 1 至 400 字的问题。');
    const intent = classifierVersion === 1 ? classifyLegacy(input) : classify(input);
    const edge = this.node.freeInput.intentRoutes.find(e => e.intent === intent);
    if (!edge) throw Error('没有对应的问话出口。');
    this.take(edge, [{ speaker: '我', text: input }], input);
    this.audit.push({ type: 'guard', text: input, ...(classifierVersion === 2 ? {classifierVersion} : {}) });
    return intent;
  }
  applyAi(text: string, result: AiReceipt) {
    if (!this.aiScene || this.pending || this.aiHeld || result.nodeId !== this.nodeId || result.version !== this.story.version) throw Error('对话已变化，请重新提交。');
    const route = this.aiRoute(result.outcome);
    if (!route || !text.trim() || !result.reply || this.exchange.length >= this.aiScene.maxTurns) throw Error('AI 回应不完整，请重试。');
    if (['INVITE_JIANG','RELAY_JIANG'].includes(result.outcome) && !this.state.knowsJiang) throw Error('接报安排不符合本轮已知情况。');
    this.save(); this.trail.push(clone(this.frame));
    this.audit.push({ type:'ai', result: clone({ ...result, text }) as AiReceipt });
    this.exchange.push({ id: result.requestId, player: text, npc: result.reply });
    this.frame = { nodeId: this.nodeId, title: this.node.displayTitle ?? this.node.title, kind: route.target ? 'reply' : 'ai', lines: [{ speaker:'我', text }, { speaker:'魏延', text:result.reply }] };
    this.pending = route.target ? { target: route.target, effects: route.effects } : null;
    this.aiHeld = result.outcome === 'HOLD';
  }
  applyOffline(outcome: string, text: string) {
    const route = this.aiRoute(outcome);
    if (!route || !['INVITE_JIANG','RELAY_JIANG','SELF_RELAY','ENTER'].includes(outcome)) throw Error('无效的固定回答。');
    this.applyAi(text, {nodeId:this.nodeId,version:this.story.version,requestId:'offline-fixed',outcome,reply:route.fallback,replySource:'offline',contextHash:'',signature:''});
    this.audit.pop(); this.audit.push({type:'offline',outcome,text});
  }
  retryAi() {
    if (!this.aiScene || this.pending || this.aiScene.allowRetry===false) throw Error('请在下一次发言中直接补充或改口。');
    this.save(); this.audit.push({ type:'retryAi' }); this.exchange = []; this.aiHeld = false;
    this.frame = { nodeId:this.nodeId, title:this.node.displayTitle ?? this.node.title, kind:'ai', lines:clone(this.node.lines) };
  }
  next() {
    const edge = this.pending ?? (this.node.next ? { target: this.node.next } : null);
    if (!edge) return;
    Object.assign(this.state, this.node.afterLines);
    this.save(); this.trail.push(clone(this.frame)); this.audit.push({ type:'next' }); this.finish(edge);
  }
  serialize() { return JSON.stringify({ version: this.story.version, current: this.snapshot(), history: this.history }); }
  load(raw: string) {
    const data = JSON.parse(raw);
    if (data.version !== this.story.version || !Array.isArray(data.history) || data.history.length > 160) return false;
    const valid = (s: Snapshot) => s && this.nodes.has(s.nodeId) && s.frame?.nodeId === s.nodeId && Array.isArray(s.trail)
      && s.frame.lines.every(l => typeof l.text === 'string' && typeof l.speaker === 'string')
      && Object.keys(this.story.initialState).every(k => typeof s.state[k] === typeof this.story.initialState[k])
      && Array.isArray(s.audit) && s.audit.length <= 1500 && Array.isArray(s.exchange)
      && (!s.pending || this.nodes.has(s.pending.target));
    if (!valid(data.current) || !data.history.every(valid)) return false;
    this.restore(data.current); this.history = clone(data.history); return true;
  }
}

/** Bounded local prototype, deliberately not presented as a language model. */
function classifyLegacy(raw: string): string {
  const text = raw.normalize('NFKC').replace(/\s/g, '');
  // Only an actual question/request about an alternative handler earns the clue.
  const question = /谁|哪[个位些路]|何人|能否|可否|能不能|能不|能.*吗|可以.*[吗么]|可不可以|有没有|有无|是否|行不行|成不成|可不|请.*[来出]|找.*[来出]|(?:找|请|叫|让).*(?:人|姜|伯约)/.test(text);
  const handling = /[做作]主|拍板|决[定断策]|定夺|处[理置]|接[报手]|收.*军报|听报|传报|军[情务报]|急报|回令|担[责当]|负[责担]|顶事|管[事这]|帮[忙我]|代劳|接替/.test(text);
  const otherPerson = /谁|何人|别人|其他|另外|哪[个位些路]|个人|一人|人来|人能|人可以|有人|有无.*人|有没有.*人|姜[维将]|伯约|(?:找|请|叫|让).*人|能.*的人/.test(text);
  const rejected = /(?:不必|不用|别|不要|无需)(?:再)?(?:去)?(?:找|请|问)|谁也不|谁都不/.test(text);
  // A name alone, asserted authority, or self-assumed responsibility cannot unlock a clue.
  const selfOnly = /(?:我来|由我|我可以|我能|我会|我已|我负责|我担)/.test(text)
    && !/(?:谁|何人|别人|其他|另外|姜维|伯约|哪个|有没有)/.test(text);
  if (question && handling && otherPerson && !rejected && !selfOnly) return 'ask_decision_maker';
  if (/禁令|不许|不让|不准|不能.*[进入]|为何.*[进入]|为什[么麼].*[进入]|守帐|告示/.test(text)) return 'ask_restriction';
  if (/敌[人军骑情]|魏[军骑人]|营[外前]|斥候|动静|打[进起]|号角/.test(text)) return 'ask_enemy';
  return 'other';
}

/** Local question matching, not general semantic AI. Quotes and withdrawn clauses cannot award a clue. */
export function classify(raw: string): string {
  const text = raw.normalize('NFKC').replace(/\s/g, '').replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"|'[^']*'/g, '');
  const clauses = text.split(/[，,。.!！?？;；\n]|但是|不过/).filter(Boolean);
  let active: string[] = [];
  for (const clause of clauses) {
    const polarity = clause.replace(/能不能/g, '能否').replace(/是不是/g, '是否');
    const rejected = /(?:不是|并非|没(?:有)?)(?:在)?(?:问|想问|要问)|(?:不必|不用|不要|无需|不能|别|不)(?:再)?(?:去)?(?:找|请|问|叫|让)|谁(?:也|都)不|(?:接报|听报|处理军情).*(?:不合适|不行|不必|不用)|(?:不考虑|不打算|不想).*(?:找|请|接报|听报)|算了/.test(polarity);
    if (rejected) { active = []; continue; }
    active.push(clause);
  }
  return classifyLegacy(active.join('，'));
}
