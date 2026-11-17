import json
from pathlib import Path

# 独立策划演算，不接入游戏：岗位、危机、前后阶段和部队占用。
def run(name, schedule):
    hp={'fu':4,'huang':5,'sha':4}; batches={k:0 for k in hp}; found=0; secured=False; dock=False
    reserve='fu'; positions=['camp']*5; strength=[500]*5; lost=set(); rows=[]
    def route(post): return post.split(':')[0] if ':' in post else None
    for turn in range(1,9):
        orders=schedule(turn,dict(batches),list(positions))
        assert len(orders)==5
        for i,p in enumerate(orders):
            if positions[i]=='trapped': assert p=='trapped'
            if route(p) and route(positions[i]) and route(p)!=route(positions[i]):
                raise AssertionError('跨路必须先归营')
        counts={p:orders.count(p) for p in set(orders)}
        guard={'fu':counts.get('fu:gate',0),'huang':counts.get('huang:south',0)+counts.get('huang:north',0),'sha':counts.get('sha:gate',0)}
        for r in hp:
            if r in lost or batches[r]==2: continue
            pressure=1+int(reserve==r)+int(turn>=5)
            if r=='fu' and guard[r]==0 and counts.get('fu:carry',0): pressure+=1
            hp[r]=max(0,hp[r]-max(0,pressure-guard[r]))
            if hp[r]==0: lost.add(r)
        if 'fu' not in lost and batches['fu']<2:
            batches['fu']=min(2,batches['fu']+counts.get('fu:carry',0)+(1 if secured and guard['fu'] else 0))
            if guard['fu']: secured=True
        if 'huang' not in lost and batches['huang']<2 and guard['huang']:
            if dock: batches['huang']=min(2,batches['huang']+(2 if counts.get('huang:south',0) and counts.get('huang:north',0) else 1))
            dock=True # 测试方案均包含已确认的派船军令
        if 'sha' not in lost and batches['sha']<2:
            if guard['sha']: batches['sha']=found
            if guard['sha'] or counts.get('sha:search',0): found=min(2,found+1+int(counts.get('sha:search',0)>0))
        for i,p in enumerate(orders):
            r=route(p)
            if p=='return':
                if route(positions[i])==reserve: strength[i]-=30
                positions[i]='camp'
            elif r:
                if r in lost: positions[i]='trapped'
                else:
                    strength[i]-=10+(20 if hp[r]==1 else 0)+(10 if p.endswith(':feint') else 0)
                    positions[i]=p
            else: positions[i]=p
        candidates={r:counts.get(r+':feint',0) for r in hp if counts.get(r+':feint',0)}
        if candidates:
            m=max(candidates.values()); winners=[r for r in hp if candidates.get(r)==m]
            reserve=reserve if reserve in winners else winners[0]
        rows.append({'turn':turn,'orders':orders,'health':dict(hp),'batches':dict(batches),'nextReserve':reserve,'positions':list(positions)})
        if all(batches[r]==2 or r in lost for r in hp) and all(p in ['camp','trapped'] for p in positions): break
    return {'name':name,'rounds':len(rows),'completeRoutes':[r for r in hp if batches[r]==2],'leadersSaved':[r for r in hp if batches[r]==2 or r=='sha' and batches[r]>=1],'lost':sorted(lost),'returnedTeams':positions.count('camp'),'trappedTeams':positions.count('trapped'),'recordedAttrition':sum(500-n for n in strength),'rows':rows}

def balanced(t,b,p):
    start=['fu:gate','fu:carry','huang:south','sha:gate','sha:search']
    if t<=2:return start
    if t==3:return ['return','return','huang:south','return','return']
    return ['camp','camp','return' if p[2]!='camp' else 'camp','camp','camp']
def feint(t,b,p):
    if t<=2:return ['fu:gate','huang:south','huang:north','sha:gate','sha:feint']
    if t==3:return ['fu:gate','return','return','sha:gate','sha:feint']
    return ['return' if x not in ['camp','trapped'] else x for x in p]
def rush(t,b,p):
    if t==1:return ['fu:gate']+['fu:carry']*4
    if t==2:return ['return']*5
    if t in [3,4]:return ['huang:south','huang:north','sha:gate','sha:search','sha:gate']
    return ['return' if x not in ['camp','trapped'] else x for x in p]
results=[run('均衡分兵',balanced),run('林口牵制配合东路换防',feint),run('先集中救傅肜再分兵',rush),run('没有部署',lambda t,b,p:['camp']*5),run('只搜两沟无人接出口',lambda t,b,p:['sha:search','sha:search','camp','camp','camp'] if p[0]!='trapped' else ['trapped','trapped','camp','camp','camp'])]
assert all(len(x['completeRoutes'])==3 and x['returnedTeams']==5 for x in results[:3])
assert results[3]['completeRoutes']==[]
assert results[4]['leadersSaved']==[]
# 同一船岸条件，双岸比同岸快；前两回合不受后期收兵策略影响。
a=run('黄权双岸',lambda t,b,p:['huang:south','huang:north','camp','camp','camp'])
c=run('黄权同岸堆兵',lambda t,b,p:['huang:south','huang:south','camp','camp','camp'])
assert a['rows'][1]['batches']['huang']==2 and c['rows'][1]['batches']['huang']==1
results += [a,c]
Path(__file__).with_name('规则走查结果.json').write_text(json.dumps({'status':'passed','scope':'独立策划规则演算；未测试UI或AI','cases':results},ensure_ascii=False,indent=2),encoding='utf-8')
for x in results:print(x['name'],x['rounds'],x['completeRoutes'],x['recordedAttrition'])
