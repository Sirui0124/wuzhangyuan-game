import type {Unit} from './dispatch-intent.js';

export type FuTask='rescue'|'scout'|'relieve'|'suppress'|'verify'|'signal'|'hold'|'rest'|'retreat';
export type FuOrder={unit:Unit;action:FuTask;target:'fu'|null;men?:number;via?:'normal'|'side'};
export type FuMessage={id:string|number;speaker:string;text:string;kind:string;round:number};
export type CrisisView={
  schemaVersion:1;scenarioId:string;frontId:'fu';revision:number;tacticalRoundId:string;phase:'planning'|'resolving'|'resolved';
  crisis:{value:number;delta:number;reasons:string[]};
  withdrawal:{probability:number;eligible:boolean;blockers:string[];status:'holding'|'eligible'|'withdrawn'};
  lastResolution?:{roundId:string;resolutionId:string;outcome:string;probability?:number;crisis?:number};
};
export type FuSession={
  scenarioId:string;revision:number;round:number;phase:'deceived_and_bereaved'|'truth_verified'|'withdrawal_accepted'|'safe'|'home';
  view:CrisisView;messages:FuMessage[];
  units:Record<Unit,{men:number;deployed:number;status:string;at:string;task:string|null}>;
  pendingOrders:FuOrder[];facts:Record<string,boolean>;suggestions:string[];nextSendAt:number;
  tasks?:Record<FuTask,{label:string;minMen:number;turns:number}>;
};
type Mutation={path:'chat'|'orders'|'round';body:{scenarioId:string;requestId:string;expectedRevision:number;[key:string]:unknown}};
type Envelope={ok:boolean;session?:FuSession;error?:string|{message?:string;code?:string}};
class FuRejected extends Error{}
const KEY='yiling-fu-runtime-v1';
function stored<T>(key:string):T|null{try{return JSON.parse(localStorage.getItem(key)||'null') as T|null;}catch{return null;}}
function put(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* The server remains authoritative if local storage is unavailable. */}}

export class FuClient {
  session:FuSession|null=null;
  busy=false;
  operation:'session'|'chat'|'orders'|'round'|null=null;
  error='';
  pending:Mutation|null=null;
  private loading:Promise<FuSession>|null=null;
  constructor(private changed:()=>void){}
  get activeId(){return stored<{scenarioId:string}>(KEY)?.scenarioId;}
  private accept(s:FuSession){
    if(!s?.scenarioId||!Number.isInteger(s.revision)||!s.view||!Array.isArray(s.messages)||!s.units||!['甲','乙','丙','丁'].every(u=>{const unit=s.units[u as Unit];return unit&&Number.isFinite(unit.men)&&typeof unit.status==='string'&&typeof unit.at==='string';})||!Array.isArray(s.pendingOrders)||!Array.isArray(s.suggestions)||!Number.isFinite(s.nextSendAt)||!Number.isInteger(s.view.crisis?.value)||s.view.crisis.value<0||s.view.crisis.value>99||!Number.isFinite(s.view.withdrawal?.probability)||s.view.withdrawal.probability<0||s.view.withdrawal.probability>1)throw Error('营救会话数据不完整，请重新读取。');
    if(this.session?.scenarioId===s.scenarioId&&this.session.revision>s.revision)return;
    this.session=s;
    const previous=stored<{scenarioId:string;history?:{id:string;at:number}[]}>(KEY);
    const history=previous?.history||[];
    if(!history.some(x=>x.id===s.scenarioId))history.push({id:s.scenarioId,at:Date.now()});
    put(KEY,{scenarioId:s.scenarioId,history});
  }
  private async post(path:string,body:unknown):Promise<FuSession>{
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),path==='chat'?95000:30000);
    try{
      const response=await fetch('/api/fu/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      let value:Envelope;
      try{value=await response.json() as Envelope;}catch{throw Error('未收到完整回执。请重新读取营救状态后重试。');}
      if(value.session)this.accept(value.session);
      if(!response.ok||!value.ok||!value.session){const error=value.error,message=typeof error==='string'?error:error?.message||'本次请求未完成，请保留原文后重试。';throw response.status<500?new FuRejected(message):Error(message);}
      return value.session;
    }catch(error){
      if(error instanceof DOMException&&error.name==='AbortError')throw Error('等候回执超时。请先读取最新状态，再重试同一次请求。');
      if(error instanceof TypeError)throw Error('暂时无法联络营救服务。原文和待发请求已保留。');
      throw error;
    }finally{window.clearTimeout(timeout);}
  }
  async load(fresh=false):Promise<FuSession>{
    if(this.loading)return this.loading;
    if(this.busy)throw Error('上一道请求仍在等回执，请稍候。');
    this.busy=true;this.operation='session';this.error='';this.changed();
    const id=fresh?undefined:this.session?.scenarioId||this.activeId;
    this.loading=this.post('session',id?{scenarioId:id}:{}).then(s=>{
      this.pending=stored<Mutation>('yiling-fu-pending-'+s.scenarioId);
      return s;
    }).catch(e=>{this.error=(e as Error).message;throw e;}).finally(()=>{this.busy=false;this.operation=null;this.loading=null;this.changed();});
    return this.loading;
  }
  private async execute(mutation:Mutation):Promise<FuSession>{
    if(this.busy)throw Error('上一道请求仍在等回执，请稍候。');
    this.pending=mutation;put('yiling-fu-pending-'+mutation.body.scenarioId,mutation);
    this.busy=true;this.operation=mutation.path;this.error='';this.changed();
    try{
      const session=await this.post(mutation.path,mutation.body);
      this.pending=null;put('yiling-fu-pending-'+mutation.body.scenarioId,null);
      return session;
    }catch(e){if(e instanceof FuRejected){this.pending=null;put('yiling-fu-pending-'+mutation.body.scenarioId,null);}this.error=(e as Error).message;throw e;}
    finally{this.busy=false;this.operation=null;this.changed();}
  }
  private async mutate(path:Mutation['path'],payload:Record<string,unknown>){
    const session=this.session||await this.load();
    if(this.pending)throw Error('上次请求还未核实，请先重试上次请求，避免重复传达。');
    return this.execute({path,body:{...payload,scenarioId:session.scenarioId,requestId:crypto.randomUUID(),expectedRevision:session.revision}});
  }
  chat(text:string){return this.mutate('chat',{text});}
  orders(orders:FuOrder[]){return this.mutate('orders',{orders});}
  round(){return this.mutate('round',{trigger:'endRound'});}
  retry(){if(!this.pending)throw Error('没有需要重试的请求。');return this.execute(this.pending);}
}
