from pathlib import Path
p=Path(__file__).with_name('build_outro.py')
s=p.read_text('utf-8')
exec(compile(s.split('x,y=np.meshgrid')[0]+s[s.index('boost='):],str(p),'exec'))
