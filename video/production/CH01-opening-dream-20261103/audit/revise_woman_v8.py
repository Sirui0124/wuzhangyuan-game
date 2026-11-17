from pathlib import Path
import json, shutil, hashlib, re
out=Path(r'C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH01-opening-dream-20261103')
src=Path(r'C:/Users/zhousirui/.codex/generated_images/01a18b78-9a89-7ef3-ae12-ec7d4d7703b3/exec-db334505-ee7c-4f16-8f7c-0c54c3ed93f1.png')
oldname='11-回忆她在桌对面-v7-素白衬衫简洁配色.png'
newname='11-回忆她在桌对面-v8-自然窗光真实肤质.png'
new=out/'references'/newname
shutil.copy2(src,new)
doc=out/'02-深夜工位与三段遗憾回忆-18秒.md'
before=doc.read_text(encoding='utf-8')
shutil.copy2(doc,out/'audit/02-before-woman-v8.md.txt')
def revise(t):
    return t.replace(oldname,newname).replace(oldname[:-4],newname[:-4]).replace('素白长袖衬衫、桌对面构图和自然侧光保持一致。','素白长袖衬衫、桌对面构图保持一致；主光来自画面左侧真实窗户，右脸较暗，保留鼻侧与下颌自然阴影、细微肤色变化、毛孔与织物纹理，避免均匀正面美颜补光、蜡质皮肤或磨皮感。').replace('桌对面位置和自然窗光；','桌对面位置与画面左侧自然窗光、右脸轻微暗面和真实皮肤纹理；')
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
        item.update(path=str(new),source=str(src),sha256=hashlib.sha256(new.read_bytes()).hexdigest(),version='v8',status='待review')
record.setdefault('reference_revisions',[]).append(dict(key='woman',version='v8',date='2026-11-04',user_request='以v7人物和白衬衫为准，加强真实感，调整光线',approved_previous_aspects='v7人物造型与素白衬衫方向',previous=previous,current=str(new),user_approved=False))
rp.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
report=dict(ok=True,new_reference=str(new),upload_position=6,dialogue_unchanged=True,all_image_paths_exist=True,old_versions_preserved=True,video_generated=False,user_approved=False)
(out/'audit/woman-v8-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
