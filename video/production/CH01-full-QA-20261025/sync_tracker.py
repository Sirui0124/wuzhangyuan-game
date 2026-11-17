from pathlib import Path
import subprocess,json,re
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
integ=json.loads((OUT/'integration.json').read_text(encoding='utf-8'));opening=next(r for r in integ['repairs'] if r['index']==1)
before=sheet();save(OUT/'audit/tracker-before-update.json',before)
headers=[c.get('value','') for c in before['cells'][0]];cols=before['col_indices'];writes=[]
note='2026-10-25｜第一关34条视频全时段检查，8条修复后接入。开场再删重复伸手停留，现42.50秒；仍直接已燃烛光起始，旧版30秒现代回忆与时光倒流原画原声原速保留。其余修复：甲在两分支的身份跳变、魏延倾听4.125秒定格、接令后误入帐、接报突兀黑夜插镜、死亡段提前露出重生、握矛手未松开。独立Prompt、实际采用及34条检查见本地video/production/CH01-full-QA-20261025/第一关全视频检查与修复.md。新增修复均待用户review，技术验证不代表用户通过。'
for i,cells in enumerate(before['cells'][1:],1):
 vals=[c.get('value','') for c in cells];sid=vals[0]
 if sid not in ['PR01-A','PR01-B','PR01-C','PR01-D/E/F']:continue
 def val(k):return vals[headers.index(k)]
 feedback=val('处理反馈');history=val('历史视频素材');old=val('最新版视频路径')
 if note not in feedback:feedback+='\n'+note
 if old and old!=opening['publishedFile'] and old not in history:history+='\n2026-10-25全片检查前版本：'+old
 changes={'处理反馈':feedback,'历史视频素材':history,'最新版视频路径':opening['publishedFile'],'当前状态':'待review'}
 if sid=='PR01-A':changes['内容说明']='开篇直接从已燃烛光开始，帐内灯阵与诸葛亮持普通直剑祈福交叉急报；删除点灯、引火、小童点灯动作。'
 if sid=='PR01-B':changes['内容说明']='开篇骑兵急报回营；魏延在传报棚接报后快步赴帐，删去掀帘前重复伸手停留，接下一段实际掀帘。'
 for k,v in changes.items():writes.append({'range':cols[headers.index(k)]+str(before['row_indices'][i]),'cells':[[{'value':v}]]})
assert sheet()==before,'Concurrent tracker change'
p=OUT/'audit/tracker-writes.json';save(p,writes);call(['sheets','+cells-set',*COMMON,'--writes','@'+p.relative_to(ROOT).as_posix()])
after=sheet();save(OUT/'audit/tracker-after-update.json',after)
for w in writes:
 m=re.fullmatch(r'([A-Z]+)(\d+)',w['range']);assert after['cells'][after['row_indices'].index(int(m[2]))][after['col_indices'].index(m[1])].get('value','')==w['cells'][0][0]['value']
print('Tracker current paths/notes guarded and read back:',len(writes))
