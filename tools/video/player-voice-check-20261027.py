"""Independent word checks; recognizer output never becomes the dialogue authority."""
from pathlib import Path
from importlib.machinery import SourceFileLoader
import time,json,sys,difflib
from faster_whisper import WhisperModel
from pypinyin import lazy_pinyin
a=SourceFileLoader('voice_audit',str(Path(__file__).with_name('player-voice-audit-20261027.py'))).load_module()
plan=a.read(a.OUT/'plan.json');watch='--watch' in sys.argv;deadline=time.monotonic()+3600
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=4)
while True:
    checked=[];pending=[];failed=[]
    for j in plan['jobs']:
        statefile=a.OUT/'generated'/(j['id']+'-state.json')
        if not statefile.exists():pending.append(j['id']);continue
        state=a.read(statefile)
        if state['status']!='succeeded':
            (pending if state['status']=='dispatching' else failed).append(j['id']);continue
        dest=a.OUT/'checks'/(j['id']+'.json')
        if dest.exists() and a.read(dest).get('sha256')==state['sha256']:checked.append(a.read(dest));continue
        assert a.sha(state['file'])==state['sha256']
        samples=a.pcm(state['file'],rate=16000)
        segs,info=model.transcribe(samples,language='zh',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False)
        segments=[dict(start=s.start,end=s.end,text=s.text,noSpeechProbability=s.no_speech_prob,words=[dict(start=w.start,end=w.end,text=w.word) for w in s.words or []]) for s in segs]
        text=''.join(s['text'] for s in segments);expected=a.norm(j['text']);actual=a.norm(text)
        ratio=difflib.SequenceMatcher(None,expected,actual).ratio()
        phonetic=difflib.SequenceMatcher(None,''.join(lazy_pinyin(expected)),''.join(lazy_pinyin(actual))).ratio()
        provider=''.join(s['text'] for s in state.get('subtitle',{}).get('sentences',[]))
        row=dict(id=j['id'],expected=j['text'],sha256=state['sha256'],file=state['file'],recognized=text,similarity=ratio,phoneticSimilarity=phonetic,providerTextMatches=a.norm(provider)==expected,segments=segments,method='Independent faster-whisper-small on generated WAV, no prompt; homophones compared with pypinyin; exact provider subtitles separately compared',needsTextReview=phonetic<.9,humanListeningReview=False,userApproved=False)
        a.save(dest,row);checked.append(row);print(j['id'],round(ratio,3),text,flush=True)
    a.save(a.OUT/'checks.json',dict(checked=len(checked),total=len(plan['jobs']),pending=pending,failed=failed,review=[x for x in checked if x['needsTextReview'] or not x['providerTextMatches']],results=checked,humanListeningReview=False))
    if not watch or not pending or failed or time.monotonic()>deadline:break
    time.sleep(5)
