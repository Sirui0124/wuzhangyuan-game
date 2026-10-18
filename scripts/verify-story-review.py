#!/usr/bin/env python3
"""核对生成 HTML 与当前源文件，独立于浏览器互动验收。"""
import hashlib, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/剧情审稿'
html=(OUT/'剧情审稿工作台.html').read_text()
match=re.search(r'<script id="story-data" type="application/json">(.*?)</script>',html,re.S)
assert match,'未找到内嵌内容'
d=json.loads(match.group(1))
assert '__STORY_DATA__' not in html,'模板未替换'
for source in d['sources']:
    assert hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest()==source['sha256'],f"源已变更，请重生成：{source['path']}"
for c in d['coverage']:
    chapter=json.loads((ROOT/c['path']).read_text())
    assert chapter==next(p for p in d['chapters'] if p['id']==c['chapterId']),'运行稿未完整内嵌'
    lines=[]
    def walk(v):
        if isinstance(v,list):
            for x in v:walk(x)
        elif isinstance(v,dict):
            if 'speakerId' in v and 'text' in v:lines.append(v)
            for x in v.values():walk(x)
    walk(chapter)
    assert len({x['id'] for x in lines})==c['counts']['lines']
    assert {x['id']:x['text'] for x in lines}=={x['id']:x['text'] for x in c['lineInventory']},'台词清单不同'
    for line in lines:
        assert all((other['speakerId'],other['text'])==(line['speakerId'],line['text']) for other in lines if other['id']==line['id']),'同 ID 原文冲突'
    assert not c['missingReferences']
edit=d['editedManuscript']
if edit:assert hashlib.sha256((ROOT/edit['path']).read_bytes()).hexdigest()==edit['sha256'],'人工编辑稿发生变动'
expected={}
for chapter in d['chapters']:
    for n in chapter['dialogues']:
        if n['id'] in ['weiyan.negotiate','tutorial.weiyan.negotiate']:
            for o in n['freeInput']['outcomes'].values():expected[o['reply'][0]['id']]=o['reply'][0]['text']
assert d['aiPack']['anchors']==expected,'魏延固定结论与实际结果不同'
assert d['aiPack']['reasonCodes']['decisions']==['WAIT_OUTSIDE','ENTER_TENT','EXECUTE']
assert all('${common}' not in prompt for prompt in d['aiPack']['classifier_instructions'])
assert any(x['label']=='结局界面与回溯按钮' and '重试本关' in x['text'] and '返回首页' in x['text'] for x in d['uiExcerpts'])
assert all(x in html for x in ['sirui-story-review-v1','story-review-json-base64','data-line-id','data-choice-id'])
result={'version':d['version'],'sourceAndEmbeddedContent':'passed','lineInventory':'passed','manuscriptHash':'unchanged','chapterCounts':[c['counts'] for c in d['coverage']],'note':'本检查不代表浏览器保存与导入导出或游戏实际试玩通过。浏览器验收另列。'}
(OUT/'源内容验证.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
