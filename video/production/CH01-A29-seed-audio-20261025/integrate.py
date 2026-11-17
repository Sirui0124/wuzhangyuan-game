from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
edit=read(OUT/'edit.json');dest=Path(edit['result']);assert hashlib.sha256(dest.read_bytes()).hexdigest()==edit['sha256']
moviesPath=ROOT/'GameStarter/web-demo/public/cinematics.json';mediaPath=ROOT/'GameStarter/web-demo/public/video/media-manifest.json'
moviesRaw=moviesPath.read_bytes();mediaRaw=mediaPath.read_bytes();movies=read(moviesPath);media=read(mediaPath)
film=next(f for f in movies['chapterDialogue'] if f['id']=='C1T05-05');old='/video/current/C1T05-05-QA-20261025.mp4';new='/video/current/'+dest.name
assert film['src']==old,'Current film changed; compare before editing'
entry=next(c for c in media['clips'] if c['url']==old)
write(OUT/'previous-runtime-binding.json',{'film':film.copy(),'media':entry.copy(),'userFeedback':'主角这句话的配音有点问题，请改用豆包语音API生成，用之前的作参考音色。'})
film['src']=new;film['subtitles']='/video/subtitles/C1T05-05-A29-seed-audio-20261025.vtt'
entry.update(file='current/'+dest.name,url=new,source='../../video/current/'+dest.name,bytes=edit['bytes'],sha256=edit['sha256'],duration=edit['duration'],fullDecodePassed=True,status='A-29豆包Seed Audio 1.0原片玩家参考音色重录；画面原样保留；待用户试听')
media['version']+=1
assert moviesPath.read_bytes()==moviesRaw and mediaPath.read_bytes()==mediaRaw,'Concurrent runtime edit detected'
write(moviesPath,movies);write(mediaPath,media)
write(OUT/'integration.json',{'old':old,'new':new,'subtitle':film['subtitles'],'sha256':edit['sha256'],'oldFileRetained':Path(edit['source']).exists(),'reviewStatus':'待用户试听'})
print('A-29 revised audio bound to current game; previous film retained.')
