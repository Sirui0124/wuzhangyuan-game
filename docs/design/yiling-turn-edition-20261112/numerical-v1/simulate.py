"""夷陵数值候选v1：独立确定性演算，非游戏实现。"""
from dataclasses import dataclass
from copy import deepcopy
import json, math
from pathlib import Path

@dataclass
class Unit:
    n:int=500
    fatigue:float=0
    post:str='camp'
    breached:int=0

def route(p):return p.split(':')[0] if ':' in p else None
class Game:
    def __init__(self, pressure_delta=0):
        self.units=[Unit() for _ in range(5)]; self.turn=0; self.stock=5
        self.margin={'F':42.,'M':50.,'S':56.};self.lost=set();self.reserve='F'
        self.frelief=0.;self.fwithdraw=0.;self.flag=0.;self.clear=0.;self.merge=0.;self.found=0.;self.evacuated=0.
        self.saved=set();self.boosted=set();self.promises=[];self.ids=set();self.logs=[];self.delta=pressure_delta
    def complete(self,r):return {'F':self.fwithdraw>=2,'M':self.merge>=2,'S':self.evacuated>=2}[r]
    def power(self,u):
        a=1 if u.n>=400 else .8 if u.n>=300 else .6
        b=1 if u.fatigue<40 else .85 if u.fatigue<70 else .65
        return a*b
    def promise(self,key,i,due):
        if key in {x['id'] for x in self.promises}:return
        assert due>self.turn
        self.promises.append({'id':key,'unit':i,'due':due,'status':'pending'})
    def step(self,posts,rush=(),boost=None,key=None,extract_zhang=None):
        key=key or 'round-'+str(self.turn+1)
        if key in self.ids:return False
        assert self.turn<8 and len(posts)==5
        allowed={'camp','return','trapped','F:rear','F:exit','F:feint','M:flag','M:clear','M:assault','M:feint','S:gate','S:search','S:feint'}
        assert set(posts)<=allowed and len(set(rush))==len(rush)
        assert all(0<=i<5 and route(posts[i]) and self.units[i].fatigue<85 for i in rush)
        cost=sum(1+int(self.units[i].breached>0) for i in rush)+int(boost is not None)
        assert cost<=self.stock
        if boost:assert boost in self.margin and boost not in self.boosted and boost not in self.lost and any(route(p)==boost for p in posts)
        if extract_zhang is not None:assert posts[extract_zhang]=='return' and self.units[extract_zhang].post=='M:clear' and self.clear>=2
        for u,p in zip(self.units,posts):
            if u.post=='trapped':assert p=='trapped'
            if p=='camp':assert u.post=='camp'
            if p=='return':assert route(u.post)
            if route(p):
                assert route(p) not in self.lost
                assert u.post=='camp' or route(u.post)==route(p), '跨路必须归营'
        self.ids.add(key);self.turn+=1;self.stock-=cost
        if boost:self.margin[boost]=min(100,self.margin[boost]+12);self.boosted.add(boost)
        base={};work={}
        for i,(u,p) in enumerate(zip(self.units,posts)):
            if route(p):base[p]=base.get(p,0)+self.power(u);work[p]=work.get(p,0)+self.power(u)*(2 if i in rush else 1)
        get=lambda p:work.get(p,0)
        support={'F':10*base.get('F:rear',0)+6*base.get('F:exit',0),
                 'M':8*base.get('M:flag',0)+6*base.get('M:clear',0)+10*base.get('M:assault',0),
                 'S':10*base.get('S:gate',0)+2*base.get('S:search',0)}
        for r in support:support[r]+=4*base.get(r+':feint',0)
        gaps={}
        for r in self.margin:
            p={'F':12,'M':12,'S':10}[r]+3*((self.turn-1)//2)+4*int(self.reserve==r)+self.delta
            gaps[r]=max(0,p-support[r])
            if r not in self.lost and not self.complete(r):
                self.margin[r]=round(max(0,self.margin[r]-gaps[r]),4)
                if self.margin[r]<=0:self.lost.add(r)
        if 'F' not in self.lost:
            if self.frelief<1:self.frelief=min(1,self.frelief+get('F:rear'))
            else:self.fwithdraw=min(2,self.fwithdraw+get('F:rear')+get('F:exit'))
        if 'M' not in self.lost:
            oldflag,oldclear=self.flag,self.clear
            self.flag=min(2,self.flag+get('M:flag')+(.5 if get('M:clear') and not get('M:flag') else 0))
            self.clear=min(2,self.clear+get('M:clear'))
            if oldflag>=2 and oldclear>=2:self.merge=min(2,self.merge+get('M:clear')+(.5 if get('M:clear') else 0))
        if 'S' not in self.lost:
            oldfound=self.found
            self.found=min(2,self.found+get('S:search')+(.5 if get('S:gate') or get('S:search') else 0))
            self.evacuated=min(oldfound,self.evacuated+get('S:gate'))
        for i,(u,p) in enumerate(zip(self.units,posts)):
            oldroute=route(u.post)
            if p=='return':
                if i==extract_zhang:self.saved.add('张南');u.n=max(0,u.n-30)
                if self.complete(oldroute):self.saved.update({'F':['傅肜'],'M':['冯习','张南'],'S':['沙摩柯']}[oldroute])
                elif oldroute=='M' and self.flag>=2 and u.post=='M:flag':self.saved.add('冯习')
                elif oldroute=='S' and self.evacuated>=1:self.saved.add('沙摩柯')
                u.n=max(0,u.n-(20 if oldroute==self.reserve else 0));u.fatigue=min(100,u.fatigue+8);u.post='camp'
            elif p=='camp':u.fatigue=max(0,u.fatigue-35)
            elif p=='trapped':pass
            else:
                r=route(p)
                if r in self.lost:u.post='trapped';continue
                u.n=max(0,u.n-(5+math.ceil(gaps[r]/2)+(20 if i in rush else 0)))
                u.fatigue=min(100,u.fatigue+(40 if i in rush else 18));u.post=p
        for p in self.promises:
            if p['status']=='pending' and p['due']<=self.turn:
                u=self.units[p['unit']];p['status']='kept' if u.post=='camp' else 'broken'
                if p['status']=='broken':u.breached=min(1,u.breached+1)
        targets={r:base.get(r+':feint',0) for r in self.margin if base.get(r+':feint',0)}
        if targets:
            high=max(targets.values());winners=[r for r in targets if targets[r]==high]
            self.reserve=self.reserve if self.reserve in winners else winners[0]
        self.logs.append({'round':self.turn,'orders':posts,'rush':list(rush),'stock':self.stock,'margin':dict(self.margin),
                          'work':{'relief':self.frelief,'withdraw':self.fwithdraw,'flag':self.flag,'clear':self.clear,'merge':self.merge,'found':self.found,'evacuated':self.evacuated},
                          'saved':sorted(self.saved),'fatigue':[u.fatigue for u in self.units],'strength':[u.n for u in self.units]})
        return True
    def result(self):return {'rounds':self.turn,'saved':sorted(self.saved),'completeRoutes':[r for r in self.margin if self.complete(r)],'stock':self.stock,
                            'unavailable':sum(500-u.n for u in self.units),'trappedTeams':sum(u.post=='trapped' for u in self.units),'unreturnedTeams':sum(route(u.post) is not None for u in self.units),'margin':self.margin,'trace':self.logs}

def policy(g,mode):
    posts=['F:rear','M:flag','M:clear','S:gate','S:search']
    if mode=='rush_all' and g.turn==0:return posts,list(range(5))
    if mode=='ignore':return ['camp']*5,[]
    if mode=='assault':posts=['F:rear','M:assault','M:assault','S:gate','S:search']
    if mode=='all_fu':
        if g.turn<2:posts=['F:rear']*4+['F:exit']
        elif g.turn==2:posts=['return']*5
        else:posts=['M:flag','M:clear','S:gate','S:search','S:gate']
    if mode=='leave_reserve':posts=['F:rear','M:flag','M:clear','S:gate','camp']
    rush=[]
    if mode=='targeted':
        if g.turn==0:rush=[1,2,4]
        elif g.turn==1:rush=[0,2]
    if mode=='rescue_feng':
        if g.flag>=2 and g.units[1].post=='M:flag':posts[1]='return'
        elif g.units[1].post=='camp' and g.turn>=2:posts[1]='camp'
    for i,u in enumerate(g.units):
        if u.post=='trapped':posts[i]='trapped';continue
        r=route(u.post)
        if r and g.complete(r):posts[i]='return'
        elif u.post=='camp' and g.turn>0 and route(posts[i]) and g.complete(route(posts[i])):posts[i]='camp'
    rush=[i for i in rush if route(posts[i])]
    return posts,rush

def simulate(mode,delta=0,fu_margin=None):
    g=Game(delta)
    if fu_margin is not None:g.margin['F']=fu_margin
    while g.turn<8:
        posts,rush=policy(g,mode);g.step(posts,rush,boost='F' if mode=='stabilize' and g.turn==0 else None)
        if all(g.complete(r) or r in g.lost for r in g.margin) and all(u.post in ['camp','trapped'] for u in g.units):break
    return g.result()

if __name__=='__main__':
    cases={x:simulate(x) for x in ['balanced','targeted','rush_all','leave_reserve','all_fu','assault','ignore','rescue_feng']}
    sensitivity={str(d):{x:simulate(x,d) for x in ['balanced','targeted','leave_reserve']} for d in [-2,2]}
    for k,v in cases.items():print(k,{a:b for a,b in v.items() if a!='trace'})
    Path(__file__).with_name('simulation-results.json').write_text(json.dumps({'cases':cases,'sensitivity':sensitivity,'urgentOpening':{x:simulate(x,fu_margin=20) for x in ['balanced','targeted','rush_all','stabilize']}},ensure_ascii=False,indent=2),encoding='utf-8')
