"""2000-man pool proposal: logistics benchmark, NOT the live chapter engine.
Python stdlib; seeded; losses use bounded normal approximation to binomial.
Run from any directory: python simulate.py
"""
import json, math, random, statistics, hashlib
from pathlib import Path
from dataclasses import dataclass
ROOT=Path(__file__).resolve().parent
@dataclass
class Team:
    id:int
    men:int
    front:int
    role:str
    arrival:int
    home:int=999

class Pool:
    def __init__(self,total=2000,limit=5):
        self.total=total;self.reserve=total;self.limit=limit;self.teams=[];self.dead=0;self.wounded=0;self.seq=0;self.max_active=0
    def dispatch(self,n,front,role,r):
        if n<=0 or n%100 or n>self.reserve or len(self.teams)>=self.limit: return False
        self.seq+=1;self.reserve-=n;self.teams.append(Team(self.seq,n,front,role,r+1));self.max_active=max(self.max_active,len(self.teams));self.check();return True
    def check(self):
        assert self.reserve+sum(t.men for t in self.teams)+self.dead+self.wounded==self.total
        assert self.reserve>=0 and len(self.teams)<=self.limit and all(t.men>=0 for t in self.teams)
    def returns(self,r):
        for t in self.teams[:]:
            if t.home<=r:self.reserve+=t.men;self.teams.remove(t)
        self.check()
    def loss(self,t,n):
        n=min(t.men,n);dead=n*3//10;t.men-=n;self.dead+=dead;self.wounded+=n-dead;self.check()

def invariant_checks():
    p=Pool();assert not p.dispatch(150,0,'escort',0);assert not p.dispatch(2100,0,'escort',0)
    for i in range(5):assert p.dispatch(100,i%3,'escort',0)
    assert not p.dispatch(100,0,'escort',0)
    p.loss(p.teams[0],37);p.teams[0].home=1;p.returns(1);assert p.reserve==1563
    assert p.dispatch(100,0,'cover',1);p.check()
    p=Pool();assert p.dispatch(2000,0,'escort',0);assert not p.dispatch(100,0,'cover',0)
    return ['reject non-100 increment','reject overspend','reject sixth team','37 casualties conserved','return exact 63 survivors','return frees slot','cannot reuse committed reserve']

# Duration in normalized escort-work rounds; two-stage ordering is abstracted.
WORK=[2.0,2.6,3.0]
PRESETS={'宽松':dict(mult=.7,budget=16),'标准':dict(mult=1,budget=13),'困难':dict(mult=1.35,budget=11)}
STRATEGIES={
 '双路轮换400+300':dict(escort=400,cover=300,order=[0,2,1],parallel=2),
 '双路轮换500+300':dict(escort=500,cover=300,order=[0,2,1],parallel=2),
 '100人铺满':dict(escort=100,cover=100,order=[0,2,1],parallel=3),
 '双路600+200':dict(escort=600,cover=200,order=[0,2,1],parallel=2),
 '三路300+200':dict(escort=300,cover=200,order=[0,2,1],parallel=3),
 '单路重兵800+600':dict(escort=800,cover=600,order=[0,2,1],parallel=1),
 '只派护送不掩护':dict(escort=400,cover=0,order=[0,2,1],parallel=3),
 '均衡但迟两轮':dict(escort=400,cover=300,order=[0,2,1],parallel=2,delay=2),
 '均衡先旧营':dict(escort=400,cover=300,order=[1,0,2],parallel=2),
}

def run(seed,policy,difficulty,total=2000,limit=5,injury=True,model='v1'):
    rng=random.Random(seed);p=Pool(total,limit);done=[False]*3;work=[0.]*3;finish=[None]*3;scouted=False;scout_sent=False
    cfg=PRESETS[difficulty];delay=policy.get('delay',0);orders=0
    requirements=[w*rng.uniform(.85,1.15) for w in WORK] if model=='v2' else WORK
    for r in range(1,cfg['budget']+1):
        p.returns(r)
        if r>delay and not scout_sent:scout_sent=p.dispatch(100,-1,'scout',r);orders+=int(scout_sent)
        # Atomic pair: never reserve an escort that cannot have its intended cover.
        active={t.front for t in p.teams if t.front>=0 and t.home==999}
        if r>delay:
            for f in policy['order']:
                if done[f] or f in active or len(active)>=policy['parallel']:continue
                e,c=policy['escort'],policy['cover']
                if policy.get('adaptive'):e,c=[(400,200),(400,300),(300,400)][f]
                slots=1+int(c>0)
                if p.reserve>=e+c and len(p.teams)+slots<=p.limit:
                    assert p.dispatch(e,f,'escort',r);orders+=1
                    if c:assert p.dispatch(c,f,'cover',r);orders+=1
                    active.add(f)
        for t in p.teams:
            if t.role=='scout' and r>=t.arrival and t.home==999:
                scouted=True;t.home=r+1
        for f in range(3):
            if done[f]:continue
            here=[t for t in p.teams if t.front==f and t.arrival<=r and t.home==999]
            escort=sum(t.men for t in here if t.role=='escort');cover=sum(t.men for t in here if t.role=='cover')
            # Numeric effectiveness, NOT story assent. Fu story is assumed ready at r=3+delay.
            ready=f!=2 or (scouted and r>=3+delay)
            required=[200,300,400][f] if model=='v2' else 200
            reference=[400,400,300][f] if model=='v2' else 400
            eff=min(1.25 if model=='v2' else 1.5,escort/reference)*(.35+.65*min(1.,cover/required))
            if ready:work[f]+=eff
            for t in here:
                if not injury:continue
                rate=(.012 if t.role=='escort' else .023)+.002*max(0,r-3)
                rate*=cfg['mult']*(1.3 if not scouted else 1)* (1.6 if cover<100 else 1)
                if model=='v2':rate*=1.4-.7*min(1.,cover/(required*1.5))
                rate=min(.3,rate)
                loss=max(0,min(t.men,round(rng.gauss(t.men*rate,math.sqrt(t.men*rate*(1-rate))))))
                p.loss(t,loss)
            if work[f]>=requirements[f]:
                done[f]=True;finish[f]=r
                for t in here:t.home=r+1
        if all(done):
            p.returns(r+1)
            return dict(all=True,rescued=3,rounds=r+1,loss=p.dead+p.wounded,dead=p.dead,slots=p.max_active,orders=orders)
        p.check()
    return dict(all=False,rescued=sum(done),rounds=None,loss=p.dead+p.wounded,dead=p.dead,slots=p.max_active,orders=orders)

def aggregate(policy,difficulty,n=2000,**kwargs):
    rows=[run(20261117+i,policy,difficulty,**kwargs) for i in range(n)];ok=[x['rounds'] for x in rows if x['all']]
    losses=sorted(x['loss'] for x in rows);rate=sum(x['all'] for x in rows)/n
    z=1.96;den=1+z*z/n;mid=(rate+z*z/(2*n))/den;half=z*math.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/den
    return dict(n=n,all_rate=round(rate,4),wilson95=[round(max(0,mid-half),4),round(min(1,mid+half),4)],mean_rescued=round(statistics.mean(x['rescued'] for x in rows),3),median_home_round=statistics.median(ok) if ok else None,mean_loss=round(statistics.mean(losses),1),p90_loss=losses[int(.9*(n-1))],mean_dead=round(statistics.mean(x['dead'] for x in rows),1),max_slots=max(x['slots'] for x in rows),mean_orders=round(statistics.mean(x['orders'] for x in rows),1))

def probability_audit():
    d=json.loads((ROOT.parent/'furong-rescue.design.json').read_text(encoding='utf-8'))
    # Isolate actual escape formula from the illustrative campaign logistics.
    rows=[]
    for c in [99,80,60,40,20,10,9]:
        p=1 if c<10 else .99*((99-c)/89)**2
        # Fixed C repeats only; pressure changes in the real engine are not modeled here.
        rows.append(dict(crisis=c,p=round(p,4),within3_fixed=round(1-(1-p)**3,4),expected_fixed_rounds=round(1/p,2) if p else None))
    return dict(source_version=d['version'],source_sha256=hashlib.sha256((ROOT.parent/'furong-rescue.design.json').read_bytes()).hexdigest(),fixed_crisis_rows=rows)

def main():
    checks=invariant_checks();matrix={level:{name:aggregate(policy,level) for name,policy in STRATEGIES.items()} for level in PRESETS}
    baseline=STRATEGIES['双路轮换400+300'];sensitivity={}
    for total in [1200,1400,1600,1800,2000,2200]:sensitivity[f'兵力{total}']=aggregate(baseline,'标准',total=total)
    for cap in [4,5,6]:sensitivity[f'队伍上限{cap}']=aggregate(STRATEGIES['三路300+200'],'标准',limit=cap)
    sensitivity['无战损']=aggregate(baseline,'标准',injury=False)
    sweep=[]
    for e in range(200,801,100):
        for c in [100,200,300,400]:
            for parallel in [1,2,3]:
                policy=dict(escort=e,cover=c,order=[0,2,1],parallel=parallel)
                sweep.append(dict(escort=e,cover=c,parallel=parallel,**aggregate(policy,'标准',n=300)))
    frontier=[a for a in sweep if a['all_rate']>=.95 and not any(b['all_rate']>=.95 and b['mean_loss']<=a['mean_loss'] and b['median_home_round']<=a['median_home_round'] and (b['mean_loss']<a['mean_loss'] or b['median_home_round']<a['median_home_round']) for b in sweep)]
    v2policies={**STRATEGIES,'按路编队':dict(escort=400,cover=300,adaptive=True,order=[0,2,1],parallel=2)}
    v2={level:{name:aggregate(policy,level,model='v2') for name,policy in v2policies.items()} for level in PRESETS}
    result=dict(v2_matrix=v2,v2_changes={'cover_required':[200,300,400],'escort_reference':[400,400,300],'escort_cap':1.25,'work_range':[.85,1.15],'loss_factor':'1.4-.7*min(1,cover/(required*1.5))'},sweep=sweep,frontier=frontier,version='proposal-logistics-v1',seed_start=20261117,checks=checks,presets=PRESETS,strategies=STRATEGIES,work=WORK,matrix=matrix,sensitivity=sensitivity,probability_audit=probability_audit(),limitations=['not live game engine','Fu consent assumed at round 3 plus delay','two other fronts are abstract transport workloads','no route geometry or player errors','normal approximation for casualties','all_rate measures logistics cleared before budget; not full chapter win rate','returned by budget+1 counts; no per-front death deadline'])
    (ROOT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(v2_standard=v2['标准'],v2_hard=v2['困难']),ensure_ascii=False,indent=2))
if __name__=='__main__':main()
