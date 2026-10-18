"""Integrate the approved v07 draft without changing first-round dialogue."""
import json
import builtins
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'content/chapters/wuzhang/chapter.json'
c = json.loads((ROOT / 'outputs/剧情审稿/正式同步v07/before/chapter.json').read_text())
v = json.loads((ROOT / 'outputs/剧情审稿/改稿v07/第二轮_剧情提案_v07.json').read_text())
main = {n['id'].split('.')[-1]: n for n in v['sections']['main']}
YES = {'all': []}
NO = {'not': YES}
def f(id, value=True): return {'flag': id, 'equals': value}
def all(*a): return {'all': list(a)}
def any(*a): return {'any': list(a)}
def setf(id, value=True): return {'type':'setFlag','flag':id,'value':value}
def grant(id): return {'type':'grantEvidence','evidenceId':id}
def held(id): return {'evidence':id,'mode':'held'}
def shown(id): return {'evidence':id,'mode':'presented'}
SECOND = f('progress.tutorial_completed')
FIRST = f('progress.tutorial_completed',False)
ACTIVE = all(f('loop.player_alive'), f('loop.result','none'))
PRE = all(SECOND, ACTIVE, f('loop.jiangwei_approval',False))
PERMIT = all(SECOND, f('loop.jiangwei_approval'))
speaker = {'旁白':'narrator','我':'player','我 · 内心':'player','禁入告示':'notice','守帐卒甲':'guard','传令卒乙':'relay','姜维的亲兵':'jiangwei_guard','姜维的亲兵 · 转述姜维':'jiangwei_guard','姜维':'jiangwei','魏延':'weiyan','斥候':'scout'}
def lines(section):
    return [{'id':l['id'], 'speakerId':speaker[l['speaker']], 'text':l['text'], 'effects':[]} for l in main[section]['lines']]
def node(id, scene, actor, title, ls, when=PRE, trigger='topic', next=None, effects=None, choices=None, topic=None):
    return {'id':id,'sceneId':scene,'characterId':actor,'topicId':topic or id,'title':title,'targetStatement':None,'trigger':trigger,'priority':20,'availableWhen':when,'repeat':'repeatable','lines':ls,'choices':choices or [],'freeInput':None,'onComplete':effects or [],'next':next}
def out(reply=None,effects=None,next=None): return {'reply':reply or [],'effects':effects or [],'next':next}
def line(id,actor,text,effects=None): return {'id':id,'speakerId':actor,'text':text,'effects':effects or []}
def choice(id,label,reply=None,next=None,effects=None):
    return {'id':id,'label':label,'intentId':'ask_rule','visibleWhen':YES,'enabledWhen':YES,'lockedText':'请先听完当前回话。','actionId':None,'outcome':out(reply,effects,next)}
nodes = {n['id']:n for n in c['dialogues']}
# Retain retired IDs for source references, but expose only the agreed main route.
keep = {'player.intro','notice.read','notice.read.reread','player.notice_plan','player.revival','player.investigation','scout.report','scout.notice','scout.followup','weiyan.purpose','weiyan.preset','weiyan.notice','weiyan.negotiate','weiyan.execution','ending.lamp_failure','ending.safe'}
for n in c['dialogues']:
    if not n['id'].startswith('tutorial.') and n['id'] not in keep: n['availableWhen']=NO
for a in c['actions']: a['availableWhen']=NO
for e in c['events']:
    if e['id']=='event.direct_execution': e['when']=NO
for id in ['loop.guard_window_heard','loop.jiangwei_line_heard','loop.scout_card_presented']:
    if not builtins.any(x['id']==id for x in c['initialFlags']): c['initialFlags'].append({'id':id,'scope':'loop','owner':'player','initial':False,'allowedValues':[False,True],'description':'第二轮 v07 本轮确认事实'})
if not builtins.any(x['id']=='loop.eaves_count' for x in c['initialFlags']): c['initialFlags'].append({'id':'loop.eaves_count','scope':'loop','owner':'player','initial':0,'allowedValues':list(range(8)),'description':'已主动选择并确认的偷听次数，阅读停留不计时'})
camp = c['scenes'][0]
camp['visibleWhen']=any(FIRST,PERMIT,all(SECOND,{'not':f('loop.result','none')}))
camp['enterWhen']=any(FIRST,PERMIT)
camp['lockedText']='先请姜维的亲兵带回许可，再到中军帐前。'
report = next(s for s in c['scenes'] if s['id']=='report_post')
report['visibleWhen']=any(all(FIRST,f('loop.seen_intro')),PERMIT)
report['enterWhen']=any(FIRST,PERMIT)
report['lockedText']='先拿到姜维的回话，再去营前核实军情。'
for s in c['scenes']:
    if s['id'] in ['relay_tent','waiting_area']: s['visibleWhen']=NO
noticeScene={'id':'notice_front','title':'告示前','visibleWhen':all(SECOND,f('loop.jiangwei_approval',False)),'enterWhen':PRE,'lockedText':'眼下先依已取得的许可传报。','mediaId':None}
jiangScene={'id':'jiangwei_tent_front','title':'姜维将军帐前','visibleWhen':all(SECOND,f('loop.guard_heard_urgent_rule'),f('loop.guard_window_heard'),f('loop.jiangwei_line_heard')),'enterWhen':all(SECOND,ACTIVE),'lockedText':'先与甲乙聊完，问清请示的时机与姜维的线索。','mediaId':None}
c['scenes']=[camp,noticeScene,jiangScene,report]+[s for s in c['scenes'] if s['id'] in ['relay_tent','waiting_area']]
actors={a['id']:a for a in c['characters']}
actors['player']['placements']=[{'sceneId':'camp_gate','when':FIRST},{'sceneId':'notice_front','when':SECOND}]
for id in ['notice','guard','relay']:
    actors[id]['placements']=[{'sceneId':'camp_gate','when':any(FIRST,PERMIT)},{'sceneId':'notice_front','when':all(SECOND,f('loop.jiangwei_approval',False))}]
actors['relay']['placements'] += [{'sceneId':'relay_tent','when':NO},{'sceneId':'waiting_area','when':NO}]
actors['curtain']['placements']=[{'sceneId':'camp_gate','when':NO}]
actors['relay']['motivation']='透露姜维的身份、位置及亲兵请示办法，不代为跑腿或发许可。'
actors['jiangwei']['motivation']='留在中军帐，隔帘接报，决定今夜军务并承担自己军令的责任。'
actors['curtain']['name']='帐后'
actors['curtain']['placements']=[{'sceneId':'notice_front','when':PRE},{'sceneId':'camp_gate','when':NO}]
actors['curtain']['idleText']='帐后传来低语，守帐的正事还没有办完。'
actors['weiyan']['visibleWhen']=any(all(FIRST,f('loop.seen_intro')),all(PERMIT,f('loop.scout_questioned')))
c['characters'].append({'id':'jiangwei_guard','name':'姜维的亲兵','motivation':'留守姜维自己的将军帐；合理军务请求由他到中军帐外请示，再如实带回许可。','placements':[{'sceneId':'jiangwei_tent_front','when':SECOND}],'visibleWhen':SECOND,'talkWhen':all(SECOND,ACTIVE),'unavailableText':'请先完成当前剧情。','idleText':'姜将军在中军帐内，亲兵留守自己的将军帐前。'})
for id in ['player.revival','player.investigation','notice.read','notice.read.reread']:
    nodes[id]['sceneId']='notice_front'
nodes['notice.read']['next']=None  # First-round tutorial.notice still follows the original thought.
nodes['player.revival']['onComplete']=[setf('loop.entry_notice_read'),grant('entry_notice')]
nodes['player.investigation']['onComplete']=[setf('loop.entry_notice_read'),grant('entry_notice')]
new=[]
new.append(node('guard.gossip','notice_front','guard',main['gossip']['title'],lines('gossip'),effects=[setf('loop.guard_heard_urgent_rule')],next='guard.window'))
new.append(node('guard.window','notice_front','guard',main['window']['title'],lines('window'),all(PRE,f('loop.guard_heard_urgent_rule')),trigger='event',effects=[setf('loop.guard_window_heard')]))
new.append(node('relay.jiangwei_line','notice_front','relay',main['decision_maker']['title'],lines('decision_maker'),all(PRE,f('loop.guard_heard_urgent_rule'),f('loop.guard_window_heard')),effects=[setf('loop.jiangwei_line_heard'),setf('loop.knows_jiangwei_inside')]))
new.append(node('relay.ask_guard_first','notice_front','relay','今夜谁能作主？',[line('v07.relay.first','relay','急报怎么处置、何时能去请示，先问问守帐的甲；他清楚今夜的规矩。')],all(PRE,f('loop.guard_window_heard',False))))
new.append(node('jiangwei_guard.arrival','jiangwei_tent_front','jiangwei_guard','说明急报的来意',lines('new_scene'),PRE,next='jiangwei_guard.request'))
choices=[]
for ch in main['request']['choices']:
    choices.append(choice(ch['id'],ch['text'],[line(ch['id']+'.reply','jiangwei_guard',ch['reply'])], 'jiangwei_guard.authorization' if ch['id'].endswith('.good') else 'jiangwei_guard.request'))
new.append(node('jiangwei_guard.request','jiangwei_tent_front','jiangwei_guard','请选择请示理由',lines('request'),PRE,trigger='event',choices=choices))
new.append(node('jiangwei_guard.authorization','jiangwei_tent_front','jiangwei_guard','姜维的回话',lines('authorization'),PRE,trigger='event',effects=[setf('loop.jiangwei_approval'),grant('jiangwei_authorization')]))
new.append(node('jiangwei_guard.recall','jiangwei_tent_front','jiangwei_guard','再确认姜将军的回话',[line('v07.permit.recall','jiangwei_guard',main['authorization']['lines'][2]['text'])],all(PERMIT,ACTIVE)))
new.append(node('guard.permit_reminder','camp_gate','guard','先去营前核实军情',[line('v07.guard.reminder','guard','许可问准了。你先到营前问明急报，魏将军还在那里；我继续守着帐门。')],all(PERMIT,ACTIVE,f('loop.scout_questioned',False))))
c['evidence'].append({'id':'jiangwei_authorization','title':'姜维：什么事情都先经过我','source':'姜维的亲兵从中军帐外请示后，当面复述姜维本人的回话。','proves':['今夜军务由姜维接报处置，姜维有决策权','姜维承担自己作出的军务决定；急报须在帐外立即报明'],'cannotProve':['可以入帐见丞相','玩家能替姜维下令','姜维替任意违令承担罪责','复活后旧轮许可继续有效'],'historicalBasis':'fiction'})
nodes['scout.report']['lines'].insert(0,line('v07.scout.arrival','narrator',main['scout']['lines'][0]['text']))
# scout.followup is shared by first round: keep its text/effects unchanged.
nodes['weiyan.purpose']['lines']=lines('arrival')[:2]
base=all(SECOND,ACTIVE,f('loop.weiyan_status','approaching'),f('loop.weiyan_notice_presented'),f('loop.jiangwei_approval'))
authLines=lines('dismissal')[1:]
authLines[-1]['effects']=[setf('loop.npc_weiyan_saw_approval')]
scoutLines=[line('v07.arrival.scout_response','weiyan',main['arrival']['lines'][-1]['text'],[setf('loop.scout_card_presented')])]
new.append(node('weiyan.present_authorization','report_post','weiyan','出示姜维的回话',authLines,all(base,shown('jiangwei_authorization'),{'not':shown('scout_statement')}),trigger='present_evidence'))
new.append(node('weiyan.present_scout','report_post','weiyan','出示斥候证词',scoutLines,all(base,shown('scout_statement'),{'not':shown('jiangwei_authorization')}),trigger='present_evidence'))
n=nodes['weiyan.negotiate']
n['availableWhen']=base
n['lines']=[dict(l,id=l['id']+'.negotiate',when=f('loop.npc_weiyan_saw_approval',False)) for l in authLines]+[dict(l,id=l['id']+'.negotiate',when=f('loop.scout_card_presented',False)) for l in scoutLines]
n['targetStatement']='军情不能迟误，丞相谁也不得入帐；姜维已获权接报处置，须立即隔帘请他接报定夺。'
n['freeInput']['placeholder']='军情不能耽误，丞相的禁令也不能冲撞。你已取得姜维的许可，现在如何接报、由谁作决定并承担责任？'
n['freeInput']['guidingQuestions']=['如何现在就把急报送到，避免贻误战机？','丞相禁止谁也不得入帐，径入会有什么风险？','姜维已有接报与决策权，如何请他隔帘接报、立即定夺并承担自己的决定？']
n['freeInput']['intentOptions']=[{'id':'propose_wait','label':'说明立即接报、守令与决策责任'}]
accepted=out([line('weiyan.second.accept','weiyan',main['negotiation']['lines'][-1]['text'])],[setf('loop.weiyan_status','waiting'),setf('loop.route','authorized')],'v07.handoff')
n['freeInput']['outcomes']['accept']=accepted
j=next(j for j in c['judges'] if j['id']=='weiyan_wait')
j['requiredPoints']=n['freeInput']['guidingQuestions']
j['acceptanceCases']=[{'when':all(base,shown('entry_notice'),shown('scout_statement'),shown('jiangwei_authorization')),'outcome':accepted}]
new.append(node('v07.handoff','camp_gate','narrator','军情报到，姜维下令',lines('handoff'),all(PERMIT,ACTIVE,f('loop.weiyan_status','waiting')),trigger='event',effects=[setf('loop.report_status','relayed'),setf('loop.weiyan_status','departed')]))
nodes['ending.safe']['lines']=[l for l in nodes['ending.safe']['lines'] if l['id'] not in ['ending.safe.handoff','ending.safe.illness_recalled']]
# Independent eavesdrop choice chain. Each numbered segment increments only on confirmation.
eaves=v['sections']['eaves']
for i,draft in enumerate(eaves,1):
    ls=[line(l['id'],'narrator',l['text']) for l in draft['lines']]
    ls[-1]['effects']=[setf('loop.eaves_count',i)]
    if i==7:
        ls[-1]['effects'] += [setf('loop.lamp_lit',False),setf('loop.weiyan_status','departed')]
        ch=[]
    else:
        ch=[choice('v07.listen.%s.continue'%i,'继续偷听',next='v07.listen.%s'%(i+1)),choice('v07.listen.%s.leave'%i,'离开帐后，回去办正事')]
    new.append(node('v07.listen.%s'%i,'notice_front','curtain','听帐内的动静',ls,all(PRE,{'any':[f('loop.eaves_count',i-1),f('loop.eaves_count',i)]}),trigger='topic' if i<7 else 'event',choices=ch,topic='listen'))
    new[-1]['priority']=i
c['dialogues'] += new
path.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
