#!/usr/bin/env python3
"""只读剧情源，生成独立审稿 HTML 与覆盖清单；绝不写回人工编辑稿。"""
import argparse, ast, hashlib, json, re
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / 'scripts/story-review-template.html'
DEFAULT = ROOT / 'outputs/剧情审稿'
def sha(b): return hashlib.sha256(b).hexdigest()
def records(v, path=''):
    if isinstance(v, dict):
        if 'speakerId' in v and 'text' in v: yield {'path':path, **v}
        for k,x in v.items(): yield from records(x,f'{path}/{k}')
    elif isinstance(v,list):
        for i,x in enumerate(v): yield from records(x,f'{path}/{i}')
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--output-dir',type=Path,default=DEFAULT); ap.add_argument('--frontend-stable',action='store_true',help='仅在收到前台稳定确认后标记最终同步快照'); ap.add_argument('--frontend-source',default='GameStarter/web-demo/src/app.ts',help='已核对的前台源码路径，允许使用稳定基线备份'); ap.add_argument('--integration-baseline',default='',help='已冻结的整合验收汇总路径'); ap.add_argument('--sync-notice',default='',help='正文快照之外的整合状态提示'); args=ap.parse_args()
    chapters=[]; coverage=[]; sources=[]
    for f in sorted((ROOT/'content/chapters').rglob('chapter.json')):
        raw=f.read_bytes(); p=json.loads(raw); chapters.append(p)
        lines=list(records(p)); unique_lines={}
        for line in lines:
            previous=unique_lines.get(line['id'])
            assert previous is None or (previous['speakerId'],previous['text'])==(line['speakerId'],line['text']), f'Conflicting text for line ID {line["id"]} in {f}'
            unique_lines.setdefault(line['id'],line)
        nodes={n['id'] for n in p['dialogues']}; actions={a['id'] for a in p['actions']}; judges={j['id'] for j in p['judges']}
        missing=[]
        def validate(v,path=''):
            if isinstance(v,dict):
                if v.get('next') and v['next'] not in nodes: missing.append([path,v['next']])
                if v.get('actionId') and v['actionId'] not in actions: missing.append([path,v['actionId']])
                if v.get('judgeId') and v['judgeId'] not in judges: missing.append([path,v['judgeId']])
                for k,x in v.items():validate(x,f'{path}/{k}')
            elif isinstance(v,list):
                for i,x in enumerate(v):validate(x,f'{path}/{i}')
        validate(p)
        if p.get('restart'):
            for field in ['afterNodeId','restartNodeId','revivalNodeId']:
                if p['restart'][field] not in nodes: missing.append(['/restart/'+field,p['restart'][field]])
            flags={f['id'] for f in p['initialFlags']}
            for flag in p['restart']['preserveFlagIds']:
                assert flag in flags, f'Unknown preserved flag: {flag}'
        assert not missing,missing
        count={k:len(p[k]) for k in ['scenes','characters','evidence','dialogues','actions','judges','promises','events','initialFlags']}
        count.update(lines=len(unique_lines),lineOccurrences=len(lines),choices=sum(len(n['choices']) for n in p['dialogues']),freeInputNodes=sum(bool(n['freeInput']) for n in p['dialogues']),freeInputOutcomes=sum(len(n['freeInput']['outcomes']) for n in p['dialogues'] if n['freeInput']),acceptanceCases=sum(len(j['acceptanceCases']) for j in p['judges']))
        count['dialogueLineOccurrences']=len(list(records(p['dialogues'])))
        coverage.append({'chapterId':p['id'],'path':str(f.relative_to(ROOT)),'sha256':sha(raw),'counts':count,'nodeIds':sorted(nodes),'lineInventory':lines,'missingReferences':missing})
        sources.append({'path':str(f.relative_to(ROOT)),'sha256':sha(raw),'role':'运行剧情内容源'})
    assert chapters, 'No chapter source'
    wpath=ROOT/'GameStarter/assets/scripts/narrative/weiyan.ts'; wraw=wpath.read_bytes(); wtext=wraw.decode()
    match=re.search(r'const pack = (\{.*?\}) as const;',wtext,re.S)
    if match:
        pack=json.loads(match.group(1)); pack['mode']='legacy'
    else:
        common_match=re.search(r'const common = `(.*?)`;',wtext,re.S)
        prompt_match=re.search(r'export const WEIYAN_PROMPT = `(.*?)`;',wtext,re.S)
        tutorial_prompt_match=re.search(r'export const WEIYAN_TUTORIAL_PROMPT = `(.*?)`;',wtext,re.S)
        persona_match=re.search(r"persona: ('(?:\\.|[^'\\])*')",wtext)
        renderer_match=re.search(r"instructions: ('(?:\\.|[^'\\])*')",wtext)
        assert all([common_match,prompt_match,tutorial_prompt_match,persona_match,renderer_match]),'魏延 AI 定义格式改变，请更新提取器后重新生成。'
        anchors={}
        for chapter in chapters:
            for n in chapter['dialogues']:
                if n['id'] not in ['weiyan.negotiate','tutorial.weiyan.negotiate']: continue
                for o in n['freeInput']['outcomes'].values():
                    first=o['reply'][0]
                    assert first['id'] not in anchors or anchors[first['id']]==first['text']
                    anchors[first['id']]=first['text']
        def expanded_prompt(match):
            value=match.group(1).replace('${common}',common_match.group(1))
            assert '${' not in value,'分类指令含未解析的插值'
            return value
        pack={'mode':'current-utterance','anchorSource':'chapter-outcomes','anchors':anchors,'persona':{'人物':ast.literal_eval(persona_match.group(1))},'classifier_instructions':['复活后正常交涉：\n'+expanded_prompt(prompt_match),'第一轮教学：\n'+expanded_prompt(tutorial_prompt_match)],'renderer_instructions':[ast.literal_eval(renderer_match.group(1))],'reasonCodes':{'decisions':['WAIT_OUTSIDE','ENTER_TENT','EXECUTE'],'tutorialDecisions':['WAIT_OUTSIDE','ENTER_TENT','EXECUTE'],'missing':['MISSING_NOTICE','MISSING_SCOUT','MISSING_RECEIVER','OUT_OF_SCOPE']}}
    runtime=[]
    for rel in ['GameStarter/assets/scripts/narrative/weiyan.ts','GameStarter/assets/scripts/narrative/judge.ts','GameStarter/assets/scripts/narrative/engine.ts','GameStarter/assets/scripts/narrative/state.ts']:
        raw=(ROOT/rel).read_bytes(); sources.append({'path':rel,'sha256':sha(raw),'role':'运行 AI / 回溯行为定义（补充）'}); runtime.append({'path':rel,'text':raw.decode()})
    apprel=args.frontend_source; araw=(ROOT/apprel).read_bytes(); atext=araw.decode()
    # Read-only excerpts retain every conditional UI variant without pretending these are dialogue nodes.
    ui=[]
    for label,pat in [('交涉服务提示',r'\$\{technicalError \?.*?: \'\'\}'),('非对应证据回应',r'    if \(evidenceReply \|\| reviewLine\).*?;'),('结局界面与回溯按钮',r'function resultHTML\(\).*?\n\}'),('重试本关选项',r"    if \(panel === 'retry-ending'\) \{.*?(?=    \} else if)"),('结局返回首页动作',r"        else if \(action === 'return-home'\) \{.*?\n        \}"),('军情进度文字',r'const reportText = .*?;'),('重新开始确认',r"title = '重玩本关'; body = .*?;"),('清空后开始确认',r"title = '开始全新游戏'; body = .*?;")]:
        matches=list(re.finditer(pat,atext,re.S if 'function' in pat or label in ['重试本关选项','结局返回首页动作'] else 0))
        for i,m in enumerate(matches):ui.append({'label':label+(f' {i+1}' if len(matches)>1 else ''),'text':m.group(0)})
    if not any(x['label']=='结局界面与回溯按钮' for x in ui):
        start=atext.find('    return `<div class="scrim center-scrim"><section class="modal" role="dialog" aria-modal="true" aria-label="本轮结算"')
        if start>=0:ui.append({'label':'结局界面与回溯按钮','text':atext[start:atext.find('\n}',start)+2]})
    assert len(ui)>=4, 'UI excerpt extraction incomplete'
    ui_fixed=[]; seen=set()
    for item in ui:
        for text in re.findall(r"'([^'\n]*)'",item['text']) + re.findall(r'<p>([^<${}]+)</p>',item['text']):
            if re.search('[\u4e00-\u9fff]',text) and text not in seen:
                seen.add(text);ui_fixed.append({'id':'ui-'+sha(text.encode())[:16],'title':item['label'],'text':text,'kind':'角色回应' if text=='你给我看这个有何用？' else '界面条件文字'})
    for m in re.finditer(r'交涉服务暂不可用。[^<]*',atext):
        text=m.group(0)
        if text not in seen:
            seen.add(text);ui_fixed.append({'id':'ui-'+sha(text.encode())[:16],'title':'服务异常提示','text':text,'kind':'界面提示'})
    hm=re.search(r'const weiyanHints = \[(.*?)\];',atext,re.S)
    hints=[]
    if hm:
        for m in re.finditer(r"\{ title: '([^']*)', text: '([^']*)' \}",hm.group(1)):
            hints.append({'id':'hint-'+sha(m.group(1).encode())[:16],'title':m.group(1),'text':m.group(2),'kind':'可编辑的玩家输入示例（不会自动说出）'})
    sources.append({'path':apprel,'sha256':sha(araw),'role':'结局/服务/证据界面固定提示（补充）'})
    external_sources=[]
    for rel,role in [
        ('GameStarter/web-demo/src/campaign.ts','关卡进度与结局衔接定义'),
        ('GameStarter/web-demo/public/ending-video.json','实际结局媒体配置与原指定脚本来源元数据'),
        ('source-art/结局视频/视频脚本_v01/EN04-姜维感叹与主角回溯回应-video-model-prompt.md','用户指定 EN04 v01 脚本审稿锚点；不代表已核对成片对白'),
        ('GameStarter/web-demo/public/cinematics.json','实际开场、架走及成功结局播放序列配置'),
        ('GameStarter/web-demo/public/video/media-manifest.json','成片剪辑清单与来源记录；播放验收另列'),
    ]:
        raw=(ROOT/rel).read_bytes()
        record={'path':rel,'sha256':sha(raw),'role':role}
        sources.append(record); external_sources.append({**record,'text':raw.decode()})
    video=json.loads(external_sources[1]['text']); script=external_sources[2]['text']
    review_script=external_sources[2]['path']
    declared_review=video.get('originalRequestedScript') or video.get('reviewScript')
    assert declared_review is None or declared_review==review_script,'原指定审核脚本元数据改变，须核对用户决定'
    delivered_script=video.get('sourceScript')
    if delivered_script and delivered_script!=review_script:
        delivered_path=(ROOT/delivered_script).resolve()
        if delivered_path.is_relative_to(ROOT) and delivered_path.is_file():
            raw=delivered_path.read_bytes()
            record={'path':delivered_script,'sha256':sha(raw),'role':'当前成片配置的来源脚本索引；与原指定审核脚本分开'}
            sources.append(record); external_sources.append({**record,'text':raw.decode()})
    speech=re.search(r'姜维低声说：“([^”]+)”',script)
    reply=re.search(r'接话：“([^”]+)”',script)
    assert speech and reply,'EN04 台词格式改变，请更新提取器'
    sentences=re.findall(r'[^。]+。',speech.group(1))
    assert len(sentences)==2 and ''.join(sentences)==speech.group(1),'姜维两句对白提取不完整'
    external_lines=[{'id':f'ending-en04-v01-jiangwei-{i+1}','title':f'姜维 · 第 {i+1} 句','text':text,'kind':'EN04 v01 脚本审稿锚点；成片对白待核对'} for i,text in enumerate(sentences)]
    external_lines.append({'id':'ending-en04-v01-player-1','title':'主角 · 第一人称画外声','text':reply.group(1),'kind':'EN04 v01 脚本审稿锚点；成片对白待核对'})
    external_lines.append({'id':'ending-rewind-title','title':'视频后黑屏原文','text':video['rewindText'],'kind':'运行界面固定文字'})
    campaign_excerpt=re.search(r'function renderCampaign\(\) \{.*?(?=\nfunction )',atext,re.S)
    cinematics=json.loads(external_sources[3]['text'])
    media_manifest=json.loads(external_sources[4]['text'])
    clip_metadata={clip['url']:clip for clip in media_manifest.get('clips',[])}
    media=[]
    for phase in ['opening','execution','safe']:
        for clip in cinematics.get(phase,[]):
            url=clip.get('src',''); relative=url.lstrip('/')
            public=ROOT/'GameStarter/web-demo/public'
            path=(public/relative).resolve()
            exists=url.startswith('/video/') and path.is_relative_to(public.resolve()) and path.is_file()
            actual=sha(path.read_bytes()) if exists else None
            expected=clip_metadata.get(url,{}).get('sha256')
            verified=exists and expected is not None and actual==expected
            media.append({**clip,'phase':phase,'exists':exists,'sha256':actual,'manifestSha256':expected,
                          'manifestMatches':verified,'duration':clip_metadata.get(url,{}).get('duration'),
                          'status':'文件与剪辑清单核对通过；实际播放及对白待验收' if verified else '配置已纳入；文件或剪辑清单尚待核对'})
            if exists: sources.append({'path':str(path.relative_to(ROOT)),'sha256':actual,'role':'播放配置引用的实际成片；不代表播放及对白已验收'})
    baseline=None
    if args.integration_baseline:
        baseline_raw=(ROOT/args.integration_baseline).read_bytes(); baseline=json.loads(baseline_raw)
        assert baseline['contentVersion']==coverage[0]['sha256'],'章节已脱离指定稳定基线'
        assert baseline['weiyanSourceHash']==sha(wraw),'魏延判定已脱离指定稳定基线'
        proof_rel=str(Path(args.integration_baseline).parent/'app-baseline-proof.json'); proof_raw=(ROOT/proof_rel).read_bytes(); proof=json.loads(proof_raw)
        assert proof['sourceSha256']==sha(araw) and proof['h']==baseline['buildHashes']['GameStarter/web-demo/src/app.js'],'前台备份与基线转译核对证据不符'
        sources.append({'path':proof_rel,'sha256':sha(proof_raw),'role':'前台备份转译与稳定构建逐字哈希核对证据'})
        sources.append({'path':args.integration_baseline,'sha256':sha(baseline_raw),'role':'已冻结的 v06 整合验收汇总（执行程序报告）'})
        for name,report in baseline['reports'].items():
            rel=str(Path(args.integration_baseline).parent/name); raw=(ROOT/rel).read_bytes()
            assert sha(raw)==report['sha256'],f'验收报告校验不符：{name}'
            sources.append({'path':rel,'sha256':sha(raw),'role':'已冻结的执行程序验收报告'})
        catalog_rel='content/chapters/wuzhang/endings.json'; raw=(ROOT/catalog_rel).read_bytes()
        assert sha(raw)==baseline['buildHashes']['story/endings.json']
        sources.append({'path':catalog_rel,'sha256':sha(raw),'role':'当前结局分类与结局页固定文案'})
        catalog=json.loads(raw)
        external_sources.append({'path':catalog_rel,'sha256':sha(raw),'role':'结局目录：所有分类、标题、说明与反思原文','text':raw.decode()})
        for ending in catalog['endings']:
            for field in ['kind','title','description','hint']:
                ui_fixed.append({'id':f"ending-{ending['id']}-{field}",'title':ending['id']+' · '+field,'text':ending[field],'kind':'当前结局页固定文字'})
        for m in media:
            if m['manifestMatches']:m['status']='文件与剪辑清单核对通过；执行程序 v06 报告已验证播放，成片逐字对白未核对'
    external={'status':'v06 已验收的稳定基线；新大输入弹窗与 AI 润色另列待验收' if baseline else '前台稳定确认后的同步快照' if args.frontend_stable else '同步预备快照；UI 仍在整合，最终源核对待稳定确认','baseline':baseline,'video':video,'reviewScript':review_script,'deliveredScript':delivered_script,'cinematics':cinematics,'media':media,'lines':external_lines,'sources':external_sources,'renderExcerpt':campaign_excerpt.group(0) if campaign_excerpt else ''}
    edit=ROOT/'content/chapters/wuzhang/五丈原_完整剧本与逻辑_编辑稿.md'
    edited={'path':str(edit.relative_to(ROOT)),'sha256':sha(edit.read_bytes()),'note':'人工编辑稿保留原文件。它由早前 JSON 导出，运行时不读取；尚未同步的手改不会显示在运行稿快照内。审稿意见需明确基于本页运行稿还是人工编辑稿。'} if edit.exists() else None
    rule_file=ROOT/'docs/五丈原_教学复活与重新开始_设定v03.md'
    confirmed={'path':str(rule_file.relative_to(ROOT)),'text':rule_file.read_text(),'sha256':sha(rule_file.read_bytes())} if rule_file.exists() else None
    if confirmed: sources.append({'path':confirmed['path'],'sha256':confirmed['sha256'],'role':'用户已确认设定（与运行内容分开）'})
    sync_file=ROOT/'docs/剧情审稿_同步接收.md'
    sync={'path':str(sync_file.relative_to(ROOT)),'text':sync_file.read_text(),'sha256':sha(sync_file.read_bytes())} if sync_file.exists() else None
    if sync:sources.append({'path':sync['path'],'sha256':sync['sha256'],'role':'最新用户输入与 UI / 程序同步说明（不替代运行原文）'})
    bundle={'generatedAt':datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds'),'version':sha(json.dumps({'chapters':chapters,'sources':sources},ensure_ascii=False,sort_keys=True).encode())[:16],'chapters':chapters,'coverage':coverage,'sources':sources,'editedManuscript':edited,'aiPack':pack,'runtime':runtime,'uiExcerpts':ui,'uiFixed':ui_fixed,'playerHints':hints,'confirmedRules':confirmed,'sync':sync,'syncNotice':args.sync_notice,'external':external}
    out=args.output_dir; out.mkdir(parents=True,exist_ok=True)
    encoded=json.dumps(bundle,ensure_ascii=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
    template=TEMPLATE.read_text(); assert template.count('__STORY_DATA__')==1
    (out/'剧情审稿工作台.html').write_text(template.replace('__STORY_DATA__',encoded))
    manifest={k:bundle[k] for k in ['generatedAt','version','coverage','sources','editedManuscript']}; manifest['aiFixedAnchors']=len(pack['anchors']); manifest['aiGenerationDefinitionIncluded']=True; manifest['uiFixed']=ui_fixed; manifest['playerHints']=hints
    manifest['externalEnding']={k:external[k] for k in ['status','baseline','video','reviewScript','deliveredScript','cinematics','media','lines']}
    (out/'内容覆盖核查.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    print(json.dumps({'output':str(out/'剧情审稿工作台.html'),'version':bundle['version'],'chapters':[x['counts'] for x in coverage]},ensure_ascii=False))
if __name__=='__main__':main()
