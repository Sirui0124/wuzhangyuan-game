#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a separate editorial revision from the saved base and explicit user review."""
from pathlib import Path
import copy, hashlib, json, re
from datetime import datetime
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/剧情审稿/改稿v04'
BASE=OUT/'底稿.chapter.json'
REVIEW=OUT/'用户意见原件.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads(BASE.read_text()); draft=copy.deepcopy(base); review=json.loads(REVIEW.read_text())

def walk(v):
    if isinstance(v,dict):
        yield v
        for x in v.values():yield from walk(x)
    elif isinstance(v,list):
        for x in v:yield from walk(x)

def line_map(p):return {v['id']:v for v in walk(p) if 'speakerId' in v and 'text' in v}

def node(id):return next(x for x in draft['dialogues'] if x['id']==id)

def line(id,text):line_map(draft)[id]['text']=text

def say(id,speaker,text,effects=None):return {'id':id,'speakerId':speaker,'text':text,'effects':effects or []}

def flag(id,value):return {'flag':id,'equals':value}

def setflag(id,value):return {'type':'setFlag','flag':id,'value':value}

def allof(*conditions):return {'all':list(conditions)}

# The warning is moved to the scripted first-round confrontation; it does not open a guard topic.
warning=copy.deepcopy(line_map(draft)['guard.risk.warning'])
warning['text']=review['entries']['wuzhang/line/guard.risk.warning']['rewrite']
warning['effects']=[]
tutorial=node('tutorial.weiyan'); tutorial['title']='出示告示，用军令硬拦魏延'
c=tutorial['choices'][0]; c['label']='出示禁入告示，横枪拦住魏延。'
c['outcome']['reply'][0]['text']='军令在此。今夜帐内有要事，任何人不得入。将军有急报，也请在帐外等候。'
tutorial_end=node('tutorial.execution')
tutorial_end['title']='持械硬拦，遭军法处斩'
death=copy.deepcopy(tutorial_end['lines'][-1]); death['text']='两名军卒夺下你的枪，将你拖离帐门。你回头时，帘子尚未掀开，主灯仍亮着。刀影落下，眼前一片黑暗。'
tutorial_end['lines']=[
 say('tutorial.execution.success','narrator','你将告示举到魏延面前，横枪挡住帐门。他停下脚步，帘子没有掀开，主灯仍亮着。'),
 warning,
 say('tutorial.execution.insist','player','告示就在这里，我只按军令办事。今夜谁也不能进去。'),
 say('tutorial.execution.clear_way','weiyan','军情紧急，让开！'),
 say('tutorial.execution.refusal','narrator','你把枪握得更紧，仍挡在帐门前。魏延身后的军卒上前，将枪锋按下。'),
 say('tutorial.execution.sentence','executor','身为守卒，竟持械阻拦报急将领，命你让道仍不退下。押下，处斩！'),
 death]

# Exact authored rewrites, with the retired return ID mapped explicitly to the current revival line.
mapping={'player.return.text':'player.revival.thought'}
applications=[]
for key,e in review['entries'].items():
    oldid=key.split('/line/',1)[1]; target=mapping.get(oldid,oldid)
    if e.get('rewrite'):
        line(target,e['rewrite'])
        applications.append({'reviewKey':key,'targetLineId':target,'text':e['rewrite'],'handling':'原句照录；移动到第一轮硬拦后' if oldid=='guard.risk.warning' else '旧复活句ID映射至现复活独白' if oldid in mapping else '原句照录'})
    else:
        applications.append({'reviewKey':key,'targetLineId':None,'handling':'依据本条点评撤掉甲代递军报后被斩的旧支线；空白改写不视为删句指令','note':e.get('note','')})
# Consistent scene staging: soldiers were present at the gate; the player only now chooses to speak with them.
line('player.revival.scene','你又站在告示前。守帐卒仍守着帐门，另一名士卒在旁整理文书。两人看见你回来，谁也没有多问。')

# Rebuild the Jiang Boyue reporting sequence around the user's shorter, actual reply.
contact=node('relay.contact')
contact['title']='向乙说明急报，请通报姜伯约'
contact['targetStatement']='要请姜将军如何处置？军报从何处来，你先说清。'
contact['freeInput']['placeholder']='出示今夜告示与军情，请乙立即通报姜将军，并请他到帐外见魏将军。'
contact['freeInput']['guidingQuestions']=['眼前禁令与军情分别说明了什么？','请乙向谁通报？希望如何兼顾帐内禁令与急报？','哪些是事实，哪些还需要姜将军决定？']
contact['freeInput']['starterText']='帐前有禁令，魏将军又有急报要禀。请你即刻通报姜将军，能否请他到帐外见魏将军？'
line('relay.contact.feedback.accept','你是想请姜将军到帐外听报？把告示和眼前军情给我看，我才好照实通报。')
line('relay.contact.feedback.need_evidence','你说帐前有禁令，又说敌兵已近，凭据呢？拿来给我看，我照实往里通报。')
line('relay.contact.feedback.need_plan','军情不能压着。你是请姜将军出帐见魏将军，还是另有办法？要通报什么，先说清。')
line('relay.contact.feedback.clarify','你是请我通报，还是说姜将军已经答应了？未曾听到回话，可别先替他作主。')
rj=next(x for x in draft['judges'] if x['id']=='relay_contact')
rj['requiredPoints']=['理解禁入与真实急报同时存在，不把告示当作扣报或持械拦人的授权。','请求乙立即向帐内姜维禀明军情，并询问可否由姜维出帐接报。','事实据本轮证据，处置由姜维决定；允许自然的等价表达。']
rj['acceptanceCases'][0]['outcome']['reply'][0]['text']='成。我把军情和帐前禁令一并禀明，请姜将军定夺。你把要通报的话定下来，我这就去。'
req=node('relay.send_request'); req['title']='托乙立即通报姜伯约'
line('relay.send_request.open','魏将军有急报，帐内又有禁令。我替你把这两件事一并禀明，请姜将军定夺。要通报什么，你先说准。')
req['choices'][0]['label']='请通报姜将军：魏将军携急报而来，能否请他出帐接报？'
req['choices'][1]['label']='请禀明禁令与敌情，请姜将军安排在帐外接报。'
line('relay.send_request.delay.reply','等到明早？敌兵也肯等么？这话不成。我只能照实通报，请姜将军及时处置。')
req['choices'][2]['label']='让魏将军止步，军情明早再报。'
preset=node('relay.preset');preset['choices'][0]['label']='帐前有禁令，急报又等不得。请立即通报，代问姜将军可否出帐接报。'
approval=node('jiangwei.approval');approval['title']='姜伯约回话：请文长稍候'
line('jiangwei.approval.relay','禀姜将军，斥候报魏兵正向营前逼近，营门尚未失守。魏将军携急报而来，欲入帐面禀；帐前禁令仍在。可否请将军出帐接报？')
# order and scope remain exactly as supplied by the user.
line('relay.approval_read.text','姜将军的原话是：“军情不可迟误。请文长稍候，我随后出帐与他议事。”你去告知魏将军，我在这里候着，等他应下便入帐复命。')
node('relay.approval_read')['title']='记准姜伯约的回话'
ev=next(x for x in draft['evidence'] if x['id']=='approval_note')
ev.update(title='姜伯约的回话',source='乙在帐外通报后，带回姜维本轮的原话：“军情不可迟误。请文长稍候，我随后出帐与他议事。”这是本轮回话记录，不新增凭条道具。',proves=['姜维已听到本轮军情通报','姜维请魏延稍候，并承诺随后出帐议事'],cannotProve=['玩家获准持械拦人或扣报','调兵或替姜维发布战术命令','旧轮回话在本轮仍然有效'])
neg=node('weiyan.negotiate');neg['title']='带姜伯约回话，请魏延在帐外稍候'
neg['targetStatement']='军情不能迟误。伯约怎么说？'
fi=neg['freeInput'];fi.update(placeholder='出示本轮姜伯约的回话，请魏延在帐外稍候，由姜维亲自出帐议事。',starterText='将军，军情不敢耽误。姜将军已得通报，回话请将军稍候，他随后出帐与将军议事。',guidingQuestions=['带回来的是姜将军的哪句原话？','魏将军担心军情迟误，怎样回答？','谁会出帐见他？不要把尚未发生的见面说成已经完成。'])
fi['intentOptions']=[{'id':'propose_wait','label':'转达姜伯约回话，请魏延稍候'},{'id':'propose_handoff','label':'请魏延在帐外与姜维议事'},{'id':'revise_plan','label':'补明回话来源与接报安排'}]
line('weiyan.negotiate.feedback.accept','你若带回了伯约的回话，便说清他如何接报。军情不能停在这里。')
line('weiyan.negotiate.feedback.need_evidence','伯约已答应出帐？把他这次的回话给我看，莫只拿告示拦我。')
line('weiyan.negotiate.feedback.need_plan','你只叫我稍候，谁来听报？伯约会不会出帐，说清楚。')
line('weiyan.negotiate.feedback.clarify','你是准备去请伯约，还是已得了他的回话？未曾得回话，莫冒称奉命。')
wj=next(x for x in draft['judges'] if x['id']=='weiyan_wait')
wj['requiredPoints']=['承认急报真实且不能迟误，不以禁令为由强行阻拦。','当面出示本轮姜伯约的回话，准确说明姜维请魏延稍候，并将亲自出帐议事。','暂候不等于军情已交付：玩家之后须向乙报明魏延已应下，使姜维实际出帐。','未获回话时说明尚未获准，并指向通报流程；不进入代递军报后处斩路线。']
case=wj['acceptanceCases'][0]
case['when']=allof(flag('progress.tutorial_completed',True),flag('loop.player_alive',True),flag('loop.result','none'),flag('loop.weiyan_status','approaching'),flag('loop.route','none'),flag('loop.jiangwei_approval',True),{'evidence':'approval_note','mode':'presented'})
case['outcome']['reply'][0]['text']='既是伯约的回话，我便在帐外候着。军情急迫，快请他来。'
wj['acceptanceCases']=[case]
waiting=node('weiyan.waiting'); waiting['title']='魏延已应下，在帐外候见'
waiting['lines']=[say('weiyan.waiting.relay','weiyan','伯约何时出来？我在此候着，莫误军情。')]

# Retire contradictory old routes and the duplicate four-stage handoff after Jiang has already replied.
retired=['guard.risk','guard.deliver','ending.execution','relay.invite','weiyan.handoff','relay.receive_reply','weiyan.relay_reply','relay.reply_record']
draft['dialogues']=[x for x in draft['dialogues'] if x['id'] not in retired]
draft['actions']=[x for x in draft['actions'] if x['id'] not in ['direct.accept_risk','direct.deliver_report','relay.invite','report.handoff','report.receive_reply','report.relay_reply']]
draft['events']=[x for x in draft['events'] if x['id']!='event.direct_execution']
draft['promises']=[x for x in draft['promises'] if x['id']!='direct_report']
p=draft['promises'][0];p.update(id='authorized_meeting',description='将魏延已应下候见的消息报给乙，促成姜维实际出帐；重谈不重置等待。',requiredActionIds=['relay.confirm_wait'],completedWhen=flag('loop.jiangwei_met_weiyan',True))
for v in walk(draft):
    if 'effects' in v:
        v['effects']=[e for e in v['effects'] if e.get('promiseId')!='direct_report']
        for e in v['effects']:
            if e.get('promiseId')=='authorized_handoff':e['promiseId']='authorized_meeting'

alive=allof(flag('progress.tutorial_completed',True),flag('loop.player_alive',True),flag('loop.result','none'),flag('loop.route','authorized'),flag('loop.weiyan_status','waiting'),flag('loop.jiangwei_met_weiyan',False))
confirm=copy.deepcopy(node('relay.send_request'))
confirm.update(id='relay.confirm_wait',title='向乙报明：魏将军已在帐外候见',topicId='confirm_wait',availableWhen=alive,lines=[say('relay.confirm_wait.open','relay','魏将军怎么说？')],choices=[{'id':'relay.confirm_wait.now','label':'魏将军已经答应在帐外候见，请向姜将军复命。','intentId':'propose_wait','visibleWhen':allof(),'enabledWhen':allof(),'lockedText':'先把姜伯约的回话带给魏延，得到他候见的答复。','actionId':'relay.confirm_wait','outcome':{'reply':[say('relay.confirm_wait.reply','relay','好，我这就进去复命。你在帐外守候，莫动帐帘。')],'effects':[],'next':'jiangwei.outside'}}])
meet=copy.deepcopy(node('jiangwei.approval'))
meet.update(id='jiangwei.outside',title='姜伯约出帐，与魏延议事',sceneId='waiting_area',topicId='meet_weiyan',availableWhen=alive,lines=[
 say('jiangwei.outside.arrival','narrator','乙在帐外报明魏延已候着。片刻后，姜维从侧帐出口走来，径直到魏延面前；你所守的正门帐帘始终没有掀开。'),
 say('jiangwei.outside.ask','jiangwei','文长，营前情形如何？'),
 say('jiangwei.outside.report','weiyan','敌兵正向营前逼近，营门尚守，来意未明。须早作应对。'),
 say('jiangwei.outside.answer','jiangwei','我与你去营前察看。帐内仍照原令守候，军情有变，立刻来报。'),
 say('jiangwei.outside.complete','narrator','两人转身往营前去。急报已经当面禀明，魏延没有闯入正门。',effects=[setflag('loop.jiangwei_met_weiyan',True),{'type':'fulfillPromise','promiseId':'authorized_meeting'}])],onComplete=[],next=None)
draft['dialogues'] += [confirm,meet]
draft['actions'].append({'id':'relay.confirm_wait','title':'实际将魏延候见的答复告知乙，由乙入帐复命','availableWhen':alive,'timeCost':'none','effects':[],'next':None})
safe=next(x for x in draft['events'] if x['id']=='event.safe')
safe['when']=allof(flag('progress.tutorial_completed',True),flag('loop.result','none'),flag('loop.route','authorized'),flag('loop.jiangwei_approval',True),flag('loop.npc_weiyan_saw_approval',True),flag('loop.jiangwei_met_weiyan',True),flag('loop.lamp_lit',True),flag('loop.player_alive',True))
line('ending.safe.handoff','乙经过你身旁，轻轻点头。魏延与姜维的脚步声渐渐远去，你这才松开攥紧的手。帘后那盏灯，还亮着。')
line('ending.safe.result','本次结局：姜维出帐接报，魏延没有闯帐，主灯守住。你没有再用军令硬拦，平安活过了这一夜。')
failure=node('ending.lamp_failure')
failure['lines']=[x for x in failure['lines'] if x['id'] not in ['ending.lamp_failure.no_reply','ending.lamp_failure.not_relayed']]
fl=next(x for x in failure['lines'] if x['id']=='ending.lamp_failure.no_report')
fl['text']='你说会请姜维出帐，却一直没有把魏延候见的答复带回去。魏延不再等候，径直掀帘入帐。灯焰猛地一晃，灭了。'
fl['when']=flag('loop.route','authorized')
# Remove obsolete state meanings, retaining only genuine current definitions.
removed_flags={'loop.risk_warned','loop.risk_accepted','loop.unauthorized_reroute','loop.report_status'}
draft['initialFlags']=[f for f in draft['initialFlags'] if f['id'] not in removed_flags]
for f in draft['initialFlags']:
    if f['id']=='loop.route':f.update(allowedValues=['none','authorized'],description='本轮姜伯约回话的转达与候见方案')
    elif f['id']=='loop.result':f['allowedValues']=['none','lamp_failure','safe','tutorial_execution']
    elif f['id']=='loop.jiangwei_approval':f['description']='本轮听到姜维请魏延稍候、随后出帐的回话'
    elif f['id']=='loop.npc_weiyan_saw_approval':f['description']='魏延本次交涉实际得知本轮姜伯约回话'
draft['initialFlags'].append({'id':'loop.jiangwei_met_weiyan','scope':'loop','owner':'jiangwei','initial':False,'allowedValues':[False,True],'description':'姜维实际出帐，与魏延当面议事'})
for character in draft['characters']:
    if character['id']=='guard':character['motivation']='守门并保障急报及时通报；第一轮警告玩家不可持械硬拦，第二轮解释守门与请示的规矩。'
    elif character['id']=='relay':character['motivation']='将禁令与急报如实禀明姜维，带回本轮答复，再报明魏延已候见，促成姜维出帐。'
    elif character['id']=='jiangwei':character['motivation']='听取急报与帐前禁令的通报，请魏延稍候，随后亲自出帐议事。'
    elif character['id']=='executor':character['motivation']='仅用于第一轮持械硬拦后的架空处斩演出，不代表史书记载的军法或诸葛亮命令。'

# Validate structural references, exact user text, and preservation outside the authorised rewrite area.
ids={k:{x['id'] for x in draft[k]} for k in ['dialogues','actions','judges','promises','evidence','initialFlags','scenes','characters']}
refs={'next':'dialogues','actionId':'actions','judgeId':'judges','promiseId':'promises','evidenceId':'evidence','evidence':'evidence','flag':'initialFlags','sceneId':'scenes','speakerId':'characters'}
errors=[]
for v in walk(draft):
    for field,coll in refs.items():
        if isinstance(v.get(field),str) and v[field] and v[field] not in ids[coll]:errors.append([field,v[field]])
    for action in v.get('requiredActionIds',[]):
        if action not in ids['actions']:errors.append(['requiredActionIds',action])
for p in applications:
    if p['targetLineId']:assert line_map(draft)[p['targetLineId']]['text']==p['text']
assert not errors,errors
new_lines=line_map(draft);old_lines=line_map(base)
changes=[{'id':id,'before':old_lines[id]['text'],'after':x['text']} for id,x in new_lines.items() if id in old_lines and x['text']!=old_lines[id]['text']]
added=[id for id in new_lines if id not in old_lines];removed=[id for id in old_lines if id not in new_lines]
allowed_nodes={'tutorial.weiyan','tutorial.execution','player.revival','guard.duty','guard.ask_urgent','guard.ask_inside','relay.contact','relay.preset','relay.send_request','jiangwei.approval','relay.approval_read','weiyan.negotiate','weiyan.waiting','ending.safe','ending.lamp_failure'}
allowed_judges={'relay_contact','weiyan_wait'}
for n in base['dialogues']:
    if n['id'] not in retired and n['id'] not in allowed_nodes:assert node(n['id'])==n,n['id']
assert all('姜' not in x['text'] for n in draft['dialogues'] if n['id'].startswith('tutorial.') or n['id']=='player.intro' for x in n['lines'])
assert not any(v.get('value')=='direct' or v.get('equals')=='direct' for v in walk(draft))
assert 'guard.risk' not in ids['dialogues'] and 'guard.deliver' not in ids['dialogues'] and 'ending.execution' not in ids['dialogues']
now=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds')
(OUT/'chapter.v04.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n')
manifest={'status':'独立剧情改稿，未接入正式游戏','generatedAt':now,'baseSha256':sha(BASE),'reviewSha256':sha(REVIEW),'draftSha256':sha(OUT/'chapter.v04.json'),'applications':applications,'retiredNodeIds':retired,'changedLines':changes,'addedLineIds':added,'retiredLineIds':removed,'unchangedLineCount':sum(id in new_lines and x['text']==new_lines[id]['text'] for id,x in old_lines.items()),'checks':{'exactUserRewrites':7,'referenceErrors':errors,'unchangedUnrequestedNodes':True,'noJiangweiRouteInFirstRound':True,'oldDirectExecutionRetired':True,'formalRuntimeUntouched':True},'manualManuscriptSha256':sha(ROOT/'content/chapters/wuzhang/五丈原_完整剧本与逻辑_编辑稿.md')}
(OUT/'改稿核对.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

# A full reading document, with the revised two-round sequence first and every remaining node afterwards.
first=['player.intro','tutorial.notice','tutorial.scout','tutorial.weiyan','tutorial.execution','player.revival']
second=['notice.read','guard.duty','guard.ask_urgent','guard.ask_inside','guard.ask_relay','relay.introduction','scout.report','scout.followup','scout.scope','guard.connect_evidence','relay.duty','relay.contact','relay.preset','relay.send_request','jiangwei.approval','relay.approval_read','weiyan.negotiate','weiyan.preset','weiyan.waiting','relay.confirm_wait','jiangwei.outside','ending.safe','chapter.entrances']
char={x['id']:x['name'] for x in draft['characters']}
def render_node(n):
    text=[f"### {n['title']}\n",f"节点：`{n['id']}`\n"]
    for x in n['lines']:text.append(f"**{char.get(x['speakerId'],x['speakerId'])}：** {x['text']}\n")
    for c in n['choices']:
        text.append(f"- 选择：{c['label']}\n")
        for x in c['outcome']['reply']:text.append(f"  **{char.get(x['speakerId'],x['speakerId'])}：** {x['text']}\n")
    if n['freeInput']:
        fi=n['freeInput'];text += [f"自由交涉提示：{fi['placeholder']}\n",f"可编辑起句：{fi['starterText']}\n"]
        for status,o in fi['outcomes'].items():
            text.append(f"返回类型 `{status}`：\n")
            for x in o['reply']:text.append(f"**{char.get(x['speakerId'],x['speakerId'])}：** {x['text']}\n")
        judge=next(x for x in draft['judges'] if x['id']==fi['judgeId'])
        for c in judge['acceptanceCases']:
            text.append('认可后：\n')
            for x in c['outcome']['reply']:text.append(f"**{char.get(x['speakerId'],x['speakerId'])}：** {x['text']}\n")
    return '\n'.join(text)
intro='''# 五丈原剧情改稿 v04：两轮主线\n\n依据用户 2026-10-11 导出的 8 条意见与本次两轮设定。此文件是独立改稿，尚未接入正式游戏。原稿、用户意见及手工编辑稿均保留。\n\n第一轮：看告示、问斥候 → 出示告示，用军令硬拦魏延 → 持械阻碍急报而被处斩 → 自动复活。此轮不提前透露姜维路线；甲只在硬拦后的固定演出中警告，不开放与甲乙的自由调查。\n\n第二轮：复活后决定多了解军营 → 与甲乙交谈，取得禁令、规矩与军情 → 乙通报姜伯约 → 姜维回话请文长稍候 → 玩家带回话劝魏延候见 → 告知乙，姜维从侧帐出到帐外议事 → 保灯生还。\n\n告示原句仍是“闲人不得擅入”。第一轮玩家把它当成“任何人不得入”去硬拦，这是玩家的误用；第二轮甲会解释魏延携急报而来，不能与闲人混为一谈。处斩为游戏补写，不新增史实主张。\n\n复活保留玩家对死亡的体验；证据和人物知情不沿用。第二轮重新确认当夜信息。后续重新开始继续跳过教学、回正常调查，保持既有规则。\n\n用户 7 条非空改写全部照录。旧 `player.return.text` 对应现 `player.revival.thought`；`guard.risk.warning` 原句移入第一轮硬拦后的固定演出。空白改写没有被当作删除指令；甲代递军报后被斩的桥段依据该条点评及本次明确设定撤掉。\n\n## 第一轮：证据硬拦与处斩\n'''
md=[intro]+[render_node(node(id)) for id in first]+['\n## 第二轮：通报姜伯约与帐外接报\n']+[render_node(node(id)) for id in second]
seen=set(first+second)
md += ['\n## 保留的调查、重读、支线与失败节点\n']+[render_node(n) for n in draft['dialogues'] if n['id'] not in seen]
(OUT/'五丈原_两轮剧情改稿_v04.md').write_text('\n'.join(md))
change_doc='''# v04 落实变更单\n\n此变更单是用户已指定两轮结构的具体改稿交付，不表示程序已实现或试玩通过。底稿保存在同目录 `底稿.chapter.json`；正式源由执行程序另行整合。\n\n## 主线变化\n\n|位置|新行为|\n|---|---|\n|第一轮|只看告示与问斥候，再以证据和军令硬拦；不提前出现姜维替代路线。|\n|第一轮处斩|玩家已持械挡住魏延；甲警告后，魏延命让道，玩家仍不退下；军法执行者处置。不是传报成功后的追责。|\n|复活|使用用户原句，才决定与其他士卒交谈。甲乙无跨轮记忆。|\n|第二轮通报|乙禀明禁令及急报，请姜维出帐；姜维回话全文照录用户原句。|\n|第二轮交涉|向魏延出示本轮姜维回话，说明由姜维亲自出帐；魏延稍候。禁令不能独自使其让步。|\n|行动兑现|把魏延已应下候见告知乙，乙复命后姜维实际从侧帐出口出到帐外，与魏延当面议事。玩家守住的正门帘子没有掀开。|\n|删去旧桥段|甲擅自转报后处斩，以及姜维已回话后再重复接报、递报、取回话、转达的四段手续。|\n|保留|未指定的前部对白、各重读句、斥候范围、病势支线保留；灯灭结局仅将旧四段传报的失败句改为候见未兑现，其余原文保留。|\n\n## 程序与AI待同步\n\n- 固定内容以 `chapter.v04.json` 为叙事映射，需与执行端正在改动的开场/斥候链做逐项整合，不能直接覆盖最新正式源。\n- 教学强制两条证据已经取得；选择须实际出示告示并演出横枪。甲的警告是固定后果演出，不开放第一轮甲乙调查与侧帐路径。\n- 删除 `direct` 分流、甲转报动作、对应承诺与处斩事件。处斩仅在教学后果中发生。\n- `approval_note` 沿用稳定ID，但展示为“姜伯约的回话”，记录本轮口头答复；不赋予玩家扣报、拦人、调兵的权力，不新增凭条道具。\n- 乙的语义判定支持“禀明急报并请姜维出帐”。魏延支持“出示本轮回话，姜维亲自出帐，军情不迟误”；不要求乙接报、递入、取回话四步骤。\n- 未获姜维回话先找魏延：可追问、澄清，并返回请乙通报；不得被送入旧处斩线。当前动态AI代码未按此版改动，本页只列本版叙事要求。\n- 实际见面后才完成主线；不能把玩家一句“已经办好”当作见面已发生。等待耗时与病势支线沿用，放行或失约仍灯灭。\n- 既有重开规则保持；成功后的新结局视频/地图衔接由执行与UI改动另行整合，本版不覆盖它们。\n\n## 必验路径\n\n1. 全新开始只出现教学所需人物与证据，无姜维提示；硬拦后处斩，自动复活一次。\n2. 复活后播放用户原句，才开放甲乙交谈；没有第一轮军情、回话或NPC记忆残留。\n3. 第二轮禀报 → 用户原句回话 → 魏延候见 → 乙复命 → 姜维实际出帐接报 → 保灯生还。\n4. 第二轮无回话时不冒称奉命，不能进入旧处斩路线；放行与拖延仍有灯灭后果。\n5. 本轮有效回话只证明姜维亲自来接报，不证明玩家有额外军权。\n6. 原手工编辑稿、用户导出意见与浏览器已有备注保留。\n\n本次已核对：7 条原句逐字一致；8 条意见全部有处理记录；未指定节点逐对象保持；独立改稿引用无缺失。正式程序编译、真实AI与游戏试玩不在本次验证结果中。\n'''
(OUT/'v04_落实变更单.md').write_text(change_doc)

# Reuse the review UI with a conspicuous draft label and revised routes, preserving the old workbench and storage.
template=(ROOT/'scripts/story-review-template.html').read_text()
template=template.replace('<title>剧情审稿工作台 · 五丈原</title>','<title>剧情改稿 v04 · 五丈原两轮主线</title>')
routes={'tutorial':{'name':'第一轮 · 军令硬拦 → 处斩 → 复活','hint':'默认教学第一轮。姜维路线不出现；甲的警告仅在硬拦后的固定演出中出现。','ids':first},'authorized':{'name':'第二轮 · 通报姜伯约 → 帐外议事 → 生还','hint':'复活后才调查其他士卒，取得本輪回话并促成姜维实际出帐。','ids':['player.revival']+second},'investigation':{'name':'保留调查与证据话题','hint':'未指定的前部对白与其他证据保持原文。','ids':[]},'illness':{'name':'保留病势支线与耗时后果','hint':'非主线调查仍会消耗等待。','ids':['curtain.listen','player.delay_0','player.delay_1','weiyan.delay_warning','ending.lamp_failure']},'failure':{'name':'第二轮 · 放行、放弃与延误','hint':'旧越职转报处斩路线已撤掉，放行或失约仍有灯灭后果。','ids':['weiyan.leave_initial','weiyan.abandon','player.delay_0','player.delay_1','weiyan.delay_warning','ending.lamp_failure','player.investigation']},'repeat':{'name':'保留本轮重读话题','hint':'原来没有填写改写的重读句保留。','ids':[]},'all':{'name':'完整v04改稿 · 全部节点','hint':'本版全部保留和改写内容；改稿未接入正式游戏。','ids':[]}}
template=re.sub(r'const routes=\{.*?\n\};','const routes='+json.dumps(routes,ensure_ascii=False)+';',template,flags=re.S)
template=template.replace("shared:'主线 · 两条路线共用交涉',direct:'主线 · 越职递报',authorized:'主线 · 获准传报'","shared:'第二轮 · 魏延交涉',authorized:'第二轮 · 通报姜伯约与候见'")
template=template.replace("n.id.startsWith('relay.')||['jiangwei.approval'","n.id.startsWith('relay.')||['jiangwei.outside','jiangwei.approval'")
template=template.replace('两条主线共享部分交涉节点，所选回应决定路线。','第一轮为固定教学，第二轮才有通报姜伯约的路径。')
template=template.replace('运行章节','改稿章节').replace('运行稿','v04 改稿').replace('获准传报','姜伯约帐外接报')
template=template.replace('<main>', '<main><div class="danger-note">同步提示：UI设计已更新告示后心声与斥候取证流程，成功结局也已改为视频与回溯地图。本版这些前后段为历史快照，仅供核对两轮与用户原句，不能覆盖最新正式源。最新输入见原审稿工作台的「最新输入与已确认设定」。</div>')
template=template.replace('<h1>剧情审稿工作台</h1>','<h1>剧情改稿 v04 · 两轮主线</h1>')
template=template.replace('<main><div class="tabs"','<main><div class="intro"><strong>按你的 8 条意见改写：第一轮硬拦被斩，复活后才找士卒、通报姜伯约。</strong><p>本页是独立改稿，尚未接入游戏。原审稿台与手工稿保留。7 条非空改写逐字照录；意见处理与原稿对照见“本次改稿依据”。</p></div><div class="tabs"')
template=template.replace('>最新输入与已确认设定<','>本次改稿依据<').replace('>AI 回应定义<','>本版 NPC 交涉要求<')
ai_function='''function renderAI(){return `<section class="panel"><h2>本版 NPC 交涉要求</h2><p>本页只列改稿要求，当前游戏的 AI 代码尚未同步。</p>${chapter.judges.map(j=>`<h3>${esc(j.id==='relay_contact'?'乙：通报姜伯约':'魏延：本轮回话与帐外候见')}</h3><p>${j.requiredPoints.map(esc).join('；')}</p><p>不能主张：${j.forbiddenClaims.map(esc).join('；')}</p>${j.acceptanceCases.map(c=>outcome(c.outcome)).join('')}`).join('')}</section>`;}'''
template=re.sub(r'function renderAI\(\).*?(?=\nfunction validKeys)',lambda m:ai_function,template,flags=re.S)
coverage_function='''function renderCoverage(){const c=DATA.coverage[0];return `<section class="panel"><h2>独立改稿版本与核查</h2><p>改稿版本：${esc(DATA.version)} · ${esc(DATA.generatedAt)}</p><p>${c.counts.dialogues} 个节点，${c.counts.lines} 条固定对白，${c.counts.choices} 个选项。引用缺失 ${c.missingReferences.length}。</p><p>7 条非空用户原句全部照录；未指定节点保持原样。正式剧情、程序与手工编辑稿没有被本生成器写入。</p><h3>对照来源</h3>${DATA.sources.map(x=>`<p>${esc(x.role)}：${esc(x.path)}<br><code>${esc(x.sha256)}</code></p>`).join('')}<p>完整逐句前后对照、删除节点、意见落点见同目录《改稿核对.json》，落实与验收要求见《v04_落实变更单.md》。</p></section>`;}'''
template=re.sub(r'function renderCoverage\(\).*?(?=\nfunction )',lambda m:coverage_function,template,count=1,flags=re.S)
confirmed_function='''function renderConfirmed(){return `<section class="panel"><h2>本次改稿依据与原句落点</h2><p>${esc(DATA.revision.logic)}</p>${DATA.revision.applications.map(a=>`<div class="branch"><p><code>${esc(a.reviewKey)}</code></p><p>${esc(a.handling)}</p>${a.text?`<p class="note-value">${esc(a.text)}</p><p>对应句：<code>${esc(a.targetLineId)}</code></p>`:`<p>${esc(a.note)}</p>`}</div>`).join('')}<h3>撤掉的旧桥段</h3><p>${DATA.revision.retiredNodeIds.map(esc).join('、')}</p></section>`;}'''
if 'function renderConfirmed()' in template:template=re.sub(r'function renderConfirmed\(\).*?(?=\nfunction )',lambda m:confirmed_function,template,count=1,flags=re.S)
counts={k:len(draft[k]) for k in ['scenes','characters','evidence','dialogues','actions','judges','promises','events','initialFlags']}
counts.update(lines=len(new_lines),choices=sum(len(n['choices']) for n in draft['dialogues']),freeInputNodes=sum(bool(n['freeInput']) for n in draft['dialogues']),freeInputOutcomes=sum(len(n['freeInput']['outcomes']) for n in draft['dialogues'] if n['freeInput']),acceptanceCases=sum(len(j['acceptanceCases']) for j in draft['judges']))
version=manifest['draftSha256'][:16]
bundle={'generatedAt':now,'version':version,'chapters':[draft],'coverage':[{'chapterId':draft['id'],'counts':counts,'missingReferences':[]}],'sources':[{'path':'底稿.chapter.json','sha256':sha(BASE),'role':'保留底稿'},{'path':'用户意见原件.json','sha256':sha(REVIEW),'role':'用户意见原件'},{'path':'chapter.v04.json','sha256':sha(OUT/'chapter.v04.json'),'role':'独立两轮改稿'}],'editedManuscript':{'path':'content/chapters/wuzhang/五丈原_完整剧本与逻辑_编辑稿.md','sha256':manifest['manualManuscriptSha256'],'note':'原手工编辑稿保留未覆盖。'},'aiPack':{'anchors':{}},'runtime':[],'uiExcerpts':[],'uiFixed':[],'playerHints':[],'confirmedRules':None,'revision':{'logic':'第一轮以证据和军令硬拦魏延，被处斩后复活；第二轮才与其他士卒交谈，通报姜伯约，借其本人出帐接报保灯生还。','applications':applications,'retiredNodeIds':retired}}
encoded=json.dumps(bundle,ensure_ascii=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
assert template.count('__STORY_DATA__')==1
(OUT/'剧情改稿工作台_v04.html').write_text(template.replace('__STORY_DATA__',encoded))
print(json.dumps({'output':str(OUT/'剧情改稿工作台_v04.html'),'version':version,'counts':counts,'changedLines':len(changes),'unchangedLines':manifest['unchangedLineCount'],'addedLines':len(added),'retiredLines':len(removed),'userRewrites':7,'missingReferences':errors},ensure_ascii=False))
