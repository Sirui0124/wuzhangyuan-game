from pathlib import Path
import json,subprocess,re
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
CLI='C:/Users/zhousirui/AppData/Local/npm-cache/_npx/cca705bd6109e4e4/node_modules/@larksuite/cli/bin/lark-cli.exe'
COMMON=['--spreadsheet-token','P639srOPdhDTifttjZfcP7kVnXg','--sheet-id','8e7b02']
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def call(args):
 r=subprocess.run([CLI,*args,'--as','user'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
 if r.returncode:raise RuntimeError((r.stderr or r.stdout)[:1000])
 d=json.loads(r.stdout);assert d.get('ok'),d;return d['data']
def sheet():
 d=call(['sheets','+cells-get',*COMMON,'--range','A1:K5','--include','value']);assert not d['has_more'];return d['ranges'][0]
before=sheet();save(OUT/'audit/tracker-before.json',before)
headers=[c.get('value','') for c in before['cells'][0]];cols=before['col_indices'];writes=[]
integ=json.loads((OUT/'integration.json').read_text(encoding='utf-8'))
note='2026-10-25｜用户纠正后修订：开篇直接从已燃烛光开始，点灯动作全部截掉；异形兵器近景弃用，以新生成的纯面部反应替换（task_UAEcBrMyDjkxpTmx2kzLTBL5VSrke0vG，4秒源片采用1.4秒）；时光倒流／回忆／许愿完整恢复旧PR01-DEF-20261024-77fc2fdd.mp4的30秒画面及原声，不变速、不重配音。当前完整开场44.42秒、1344×756，接原SC03。旧36.93秒版停止采用；当前成片待用户review。生成Prompt与记录见video/production/CH01-opening-fix-20261025。'
for i,cells in enumerate(before['cells'][1:],1):
 vals=[c.get('value','') for c in cells]
 if vals[0] not in ['PR01-A','PR01-B','PR01-C','PR01-D/E/F']:continue
 def val(k):return vals[headers.index(k)]
 feedback=val('处理反馈');history=val('历史视频素材');old=val('最新版视频路径')
 if note not in feedback:feedback+='\n'+note
 if old and old!=integ['openingFile'] and old not in history:history+='\n2026-10-25用户纠正前版本（停止采用）：'+old
 changes={'处理反馈':feedback,'历史视频素材':history,'最新版视频路径':integ['openingFile'],'当前状态':'待review','prompt状态':'待更新'}
 for k,v in changes.items():writes.append({'range':cols[headers.index(k)]+str(before['row_indices'][i]),'cells':[[{'value':v}]]})
fresh=sheet();assert fresh==before,'Concurrent edit; do not overwrite'
p=OUT/'audit/tracker-writes.json';save(p,writes)
call(['sheets','+cells-set',*COMMON,'--writes','@'+p.relative_to(ROOT).as_posix()])
after=sheet();save(OUT/'audit/tracker-after.json',after)
for w in writes:
 m=re.fullmatch(r'([A-Z]+)(\d+)',w['range']);actual=after['cells'][after['row_indices'].index(int(m[2]))][after['col_indices'].index(m[1])].get('value','')
 assert actual==w['cells'][0][0]['value'],w['range']
print('Tracker guarded and read-back verified:',len(writes))
