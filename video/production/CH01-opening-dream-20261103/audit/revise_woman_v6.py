from pathlib import Path
import json, shutil, hashlib, re
out=Path(r'C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH01-opening-dream-20261103')
src=Path(r'C:/Users/zhousirui/.codex/generated_images/01a18b78-9a89-7ef3-ae12-ec7d4d7703b3/exec-41071b1b-ca9a-42d7-ade5-0a11d8aa3e6e.png')
oldname='11-回忆她在桌对面-v5-清瘦长脸清纯长发.png'
newname='11-回忆她在桌对面-v6-自然肩宽协调头身.png'
new=out/'references'/newname
shutil.copy2(src,new)
doc=out/'02-深夜工位与三段遗憾回忆-18秒.md'
before=doc.read_text(encoding='utf-8')
shutil.copy2(doc,out/'audit/02-before-woman-v6.md.txt')
def revise(t):
    return t.replace(oldname,newname).replace(oldname[:-4],newname[:-4]).replace('保留清纯白月光气质、自然皮肤纹理与个人辨识度；','保留用户认可的清瘦脸型、清纯白月光气质、自然皮肤纹理与个人辨识度，肩宽和上身使用本图协调自然的头肩比例，不再把肩膀缩窄；').replace('图片6锁她清瘦修长脸型与清纯长发的身份、','图片6锁她清瘦修长脸型与清纯长发的身份、自然肩宽和协调头肩比例、')
after=revise(before)
assert re.findall(r'唯一允许发声的原句：([^\n]+)',before)==re.findall(r'唯一允许发声的原句：([^\n]+)',after)
for p in re.findall(r'本地路径：`([^`]+)`',after): assert Path(p).is_file()
assert oldname not in after
doc.write_text(after,encoding='utf-8')
gp=out/'audit/prepare_documents.py'; gp.write_text(revise(gp.read_text(encoding='utf-8')),encoding='utf-8')
paths=out/'audit/generated-paths.json'; data=json.loads(paths.read_text(encoding='utf-8')); data['memory_woman']=str(src)
paths.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
rp=out/'audit/production-record.json'; record=json.loads(rp.read_text(encoding='utf-8'))
for item in record['references']:
    if item['key']=='woman':
        previous=item.copy()
        item.update(path=str(new),source=str(src),sha256=hashlib.sha256(new.read_bytes()).hexdigest(),version='v6',status='待review')
record.setdefault('reference_revisions',[]).append(dict(key='woman',version='v6',date='2026-11-04',user_request='认可v5外貌，肩膀稍加宽，改善头肩比例',approved_previous_aspects='v5清瘦清纯的脸与长发方向',previous=previous,current=str(new),user_approved=False))
rp.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
report=dict(ok=True,new_reference=str(new),upload_position=6,dialogue_unchanged=True,all_image_paths_exist=True,old_versions_preserved=True,video_generated=False,user_approved=False)
(out/'audit/woman-v6-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
