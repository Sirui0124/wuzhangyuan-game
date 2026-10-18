"""运行设计样例；读取正式分支，调用现有本地游戏API，不修改游戏状态。"""
import json
import argparse
import re
import hashlib
import time
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PACK = json.loads((HERE / 'prompt_pack.json').read_text())
CHAPTER = json.loads((ROOT / 'content/chapters/wuzhang/chapter.json').read_text())
JUDGE = next(x for x in CHAPTER['judges'] if x['id'] == 'weiyan_wait')
EVIDENCE = {x['id']: x for x in CHAPTER['evidence']}
BASE = dict(playerAlive=True, result='none', weiyanStatus='approaching', route='none',
            approval=False, knowsJiangweiInside=True, inferredPlan=True,
            heldEvidence=['guard_statement', 'entry_notice', 'scout_statement'])
DIRECT = '军情不能耽搁，姜将军还在帐里。我还没准信，先到帐门请他接报，请将军稍候。'
AUTHORIZED = '这是姜将军今夜的准信。军情不能耽搁，我立即叫乙来接报，递给姜将军，再把回话如实带给您，请稍候。'
ISSUE = {'type': 'AUTHORITY_UNPROVEN', 'quote': '奉姜将军之命，你不得入帐。'}
CASES = [
    dict(id='first_accept', text=DIRECT, presented=['entry_notice', 'scout_statement'], expected='accepted_direct'),
    dict(id='second_accept', text=AUTHORIZED, presented=['approval_note', 'scout_statement'], approval=True, expected='accepted_authorized'),
    dict(id='missing_note', text=AUTHORIZED, presented=['scout_statement'], approval=True, expected='need_evidence_approval'),
    dict(id='missing_plan', text='军情确实紧急，但今夜帐中有要事，请将军稍等。', presented=['entry_notice', 'scout_statement'], expected='need_plan'),
    dict(id='false_order', text=ISSUE['quote'], presented=['entry_notice', 'scout_statement'], expected='authority_unproven'),
    dict(id='issue_persists', text='那就让我现在去请姜将军接报，您稍等。', pending=ISSUE, presented=['entry_notice', 'scout_statement'], expected='authority_unproven'),
    dict(id='issue_corrected', text='方才奉命二字是我说错了，我尚未得令。军情不能耽搁，我马上到帐门请帐内的姜将军接报，请您稍候。', pending=ISSUE, presented=['entry_notice', 'scout_statement'], expected='accepted_direct'),
    dict(id='delay_report', text='这敌军多半是试探，将军明早再报吧。', presented=['entry_notice', 'scout_statement'], expected='out_of_scope'),
    dict(id='stale_note', text='上一轮姜将军给过我凭条，现在也按那张准信叫乙递报，带回回话。', presented=['scout_statement'], stale=['approval_note'], expected='need_evidence_approval'),
    dict(id='note_scope', text='凭条在此，按姜将军的命令把魏延扣下，我来调兵。', presented=['approval_note', 'scout_statement'], approval=True, expected='out_of_scope'),
]

def call(payload):
    start = time.monotonic()
    req = urllib.request.Request('http://127.0.0.1:8787/api/game/respond',
        data=json.dumps({'text': json.dumps(payload, ensure_ascii=False)}, ensure_ascii=False).encode(),
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=35) as r:
        data = json.load(r)
    raw = data['text'].strip()
    if raw.startswith('```'):
        raw = raw.split('\n', 1)[1].rsplit('```', 1)[0].strip()
    return json.loads(raw), data.get('usage', {}), round(time.monotonic() - start, 2)

def matches(condition, flags, presented, held):
    if 'all' in condition:
        return all(matches(x, flags, presented, held) for x in condition['all'])
    if 'any' in condition:
        return any(matches(x, flags, presented, held) for x in condition['any'])
    if 'not' in condition:
        return not matches(condition['not'], flags, presented, held)
    if 'flag' in condition:
        return flags.get(condition['flag']) == condition['equals']
    if 'evidence' in condition:
        return condition['evidence'] in (presented if condition['mode'] == 'presented' else held)
    raise ValueError('Unsupported source condition')

def select(result, facts, presented):
    status, missing = result['status'], result['missingPoints']
    if status == 'accept':
        flags = {'loop.player_alive': facts['playerAlive'], 'loop.result': facts['result'],
                 'loop.weiyan_status': facts['weiyanStatus'], 'loop.route': facts['route'],
                 'loop.jiangwei_approval': facts['approval'], 'loop.knows_jiangwei_inside': facts['knowsJiangweiInside'],
                 'loop.inferred_plan': facts['inferredPlan']}
        for case in JUDGE['acceptanceCases']:
            if matches(case['when'], flags, presented, facts['heldEvidence']):
                route = next(x['value'] for x in case['outcome']['effects'] if x.get('flag') == 'loop.route')
                return 'accepted_' + route, ''.join(x['text'] for x in case['outcome']['reply'])
        # 正式集成应按具体缺项降级；测试绝不因AI的accept绕开正式分支。
        return 'clarify', PACK['anchors']['clarify']
    if 'AUTHORITY_UNPROVEN' in missing:
        key = 'authority_unproven'
    elif 'CLAIM_UNPROVEN' in missing:
        key = 'claim_unproven'
    elif status == 'need_evidence':
        key = 'need_evidence_approval' if any(x in missing for x in ['MISSING_APPROVAL', 'STALE_APPROVAL']) else 'need_evidence_notice' if 'MISSING_NOTICE' in missing else 'need_evidence_scout'
    elif status == 'need_plan':
        key = 'need_plan_reply' if facts['approval'] and 'MISSING_REPLY' in missing and not any(x in missing for x in ['MISSING_RECEIVER', 'MISSING_REQUEST']) else 'need_plan'
    else:
        key = status
    return key, PACK['anchors'][key]

def validate(result, request_id, presented):
    assert result['requestId'] == request_id
    assert result['status'] in ['accept', 'need_evidence', 'need_plan', 'out_of_scope', 'clarify']
    assert result['interpretedIntentId'] in [None, 'propose_wait', 'propose_handoff', 'revise_plan']
    assert isinstance(result['explanation'], str)
    assert isinstance(result['authorityRetraction'], bool)
    assert isinstance(result['missingPoints'], list) and all(x in PACK['reasonCodes'] for x in result['missingPoints'])
    assert isinstance(result['supportedEvidenceIds'], list) and all(x in presented for x in result['supportedEvidenceIds'])
    if result['status'] == 'accept':
        assert result['interpretedIntentId'] and not result['missingPoints']

def run(case):
    facts = {**BASE, 'approval': case.get('approval', False)}
    if facts['approval']:
        facts['heldEvidence'] = [*BASE['heldEvidence'], 'approval_note']
    facts['staleEvidenceIds'] = case.get('stale', [])
    presented = case['presented']
    known = ['军情紧急，必须及时报给能处置的人。']
    if facts['approval'] and 'approval_note' in presented:
        known.append('已看过姜维本夜只准乙转递这份急报的凭条。')
    result, judge_usage, judge_seconds = call(dict(instructions=PACK['classifier_instructions'], reasonCodes=PACK['reasonCodes'],
        requestId=case['id'], persona=PACK['persona'], engineFacts=facts, knownToWeiyan=known,
        pendingIssue=case.get('pending'), presentedEvidence=[EVIDENCE[x] for x in presented], playerText=case['text']))
    validate(result, case['id'], presented)
    decision, anchor = select(result, facts, presented)
    pending = case.get('pending')
    if decision == 'authority_unproven':
        pending = pending or {'type': 'AUTHORITY_UNPROVEN', 'quote': case['text']}
    elif result['authorityRetraction'] or (facts['approval'] and 'approval_note' in presented):
        pending = None
    reply_error = None
    try:
        rendered, reply_usage, reply_seconds = call(dict(instructions=PACK['renderer_instructions'], persona=PACK['persona'],
            fixedDecision=decision, immutableAnchor=anchor, knownToWeiyan=known, pendingIssue=pending,
            presentedEvidence=[EVIDENCE[x] for x in presented], playerText=case['text']))
        lead = rendered['lead']
        assert isinstance(lead, str) and len(lead) <= 35
        if not decision.startswith('accepted_') and (lead.startswith(('好，', '好。', '可以，', '可以。', '准了')) or re.search(r'我.{0,6}(稍候|稍等|等你|等候)|稍等可以|我同意|我答应|便依', lead) or (decision == 'authority_unproven' and re.search(r'去请|便快去|即刻去|马上去|速去', lead))):
            reply_error = {'reason': 'non_accept_affirmation', 'discardedLead': lead}
            lead = ''
    except Exception as e:
        lead, reply_usage, reply_seconds = '', {}, None
        reply_error = {'errorType': type(e).__name__, 'httpStatus': getattr(e, 'code', None)}
    return dict(id=case['id'], playerText=case['text'], presentedEvidence=presented, priorIssue=case.get('pending'),
        classifier=result, fixedDecision=decision, expected=case['expected'], passed=decision == case['expected'],
        generatedLead=lead, immutableAnchor=anchor, displayedReply=lead + anchor, replyFallback=reply_error,
        promptHash=hashlib.sha256(json.dumps(PACK, ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
        timingSeconds={'classify': judge_seconds, 'render': reply_seconds}, usage={'classify': judge_usage, 'render': reply_usage})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cases', nargs='+', help='只复核指定样例ID')
    parser.add_argument('--output', default='validation.json', help='本目录内报告文件名')
    args = parser.parse_args()
    selected = [c for c in CASES if not args.cases or c['id'] in args.cases]
    if args.cases and len(selected) != len(set(args.cases)):
        parser.error('Unknown case ID')
    if Path(args.output).name != args.output:
        parser.error('Output must be a filename')
    def safe(case):
        try:
            result = run(case)
            print(json.dumps({'id': result['id'], 'passed': result['passed'], 'decision': result['fixedDecision']}, ensure_ascii=False), flush=True)
            return result
        except Exception as e:
            # 不打印HTTP body、认证信息或完整请求。
            print(json.dumps({'id': case['id'], 'errorType': type(e).__name__}), flush=True)
            return {'id': case['id'], 'passed': False, 'errorType': type(e).__name__, 'httpStatus': getattr(e, 'code', None)}
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(safe, selected))
    report = {'passedMeaning': '分类与固定分支符合样例预期；不包含自动对白语义审核', 'scope': '设计样例API验证，非正式游戏试玩', 'model': 'doubao-seed-evolving', 'thinking': 'disabled',
              'cases': results, 'passed': sum(x['passed'] for x in results), 'total': len(results), 'promptHash': hashlib.sha256(json.dumps(PACK, ensure_ascii=False, sort_keys=True).encode()).hexdigest()}
    (HERE / args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': report['passed'], 'total': report['total']}, ensure_ascii=False), flush=True)
