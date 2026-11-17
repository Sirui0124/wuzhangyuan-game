import os,json,sys
ROOT=os.path.dirname(os.path.abspath(__file__))
data=json.load(open(os.path.join(ROOT,'camera-layout.json'),encoding='utf-8'))
preview='--preview' in sys.argv
for key,cam in data['cameras'].items():cam['image']=key+('-preview' if preview else '')+'.png'
overview=data['cameras']['overview']
legacy={'imageSize':[1920,1080],'points':{k:{'x':p['x'],'y':p['y'],'label':p['label']} for k,p in overview['points'].items() if k!='junction'},
        'routes':{k:[{'x':p['x'],'y':p['y']} for p in overview['routes'][k]] for k in ['fu','sha','huang','cheng']}}
json.dump(legacy,open(os.path.join(ROOT,'legacy-map-layout.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
template=r'''<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>夷陵大本营 · 地图空间审阅</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f3ef;color:#282d29;font:16px/1.6 system-ui,"Microsoft YaHei",sans-serif}button,a{font:inherit}button{cursor:pointer;border:1px solid #cecec6;border-radius:5px;background:#fff;color:#333e35;padding:9px 17px}button:hover{background:#eceee6}button:focus-visible,a:focus-visible{outline:3px solid #2e7669;outline-offset:4px}button[aria-pressed=true]{background:#344e41;color:#fff;border-color:#344e41}.page{max-width:1550px;margin:0 auto;padding:24px 28px 34px}header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}.eyebrow{font-size:13px;color:#6a726b;letter-spacing:1px}h1{font-size:27px;font-weight:600;margin:3px 0}header p{margin:0;color:#626961;font-size:15px}.badge{white-space:nowrap;font-size:13px;color:#755b38;border:1px solid #d7c8ab;padding:5px 12px;border-radius:20px;background:#faf7ef}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}.views,.tools,.route-choices{display:flex;gap:8px;flex-wrap:wrap}.tools button{padding:8px 13px;font-size:14px}.frame{position:relative;aspect-ratio:16/9;background:#1f2827;border-radius:7px;overflow:hidden}.frame:fullscreen{border-radius:0;aspect-ratio:auto;width:100vw;height:100vh;background:#111}.frame:fullscreen .canvas{width:min(100vw,177.777vh);height:min(56.25vw,100vh);position:absolute;inset:0;margin:auto}.canvas{position:relative;width:100%;height:100%;overflow:hidden}.scene{width:100%;height:100%;object-fit:contain;display:block;transition:opacity .25s}.scene.loading{opacity:.25}.frame.loading .lines,.frame.loading .labels{visibility:hidden}.lines,.labels{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.lines{overflow:visible}.labels button{pointer-events:auto}.pin{position:absolute;transform:translate(-50%,-100%);padding:4px 10px 5px;border-radius:3px;border:1px solid #bcbcad;background:#f8f6edeb;color:#26382b;font-size:16px;line-height:1.35;white-space:nowrap;box-shadow:0 2px 8px #0003}.pin:after{content:"";position:absolute;left:50%;bottom:-9px;width:1px;height:8px;background:#ede5d3}.pin.active{background:#344e41;color:white;border-color:#c5d9c6}.pin.minor{font-size:13px;background:#f6f4e9de}.frame-title{position:absolute;left:18px;top:14px;color:white;text-shadow:0 1px 5px #000;background:#17251bd9;padding:4px 10px;border-radius:4px;font-size:14px;pointer-events:none}.compass{position:absolute;right:18px;top:14px;color:#fff;text-shadow:0 1px 5px #000;font-size:13px;background:#17251bd9;border-radius:4px;padding:4px 10px}.error{position:absolute;inset:40%;color:#fff;text-align:center}.meta{display:grid;grid-template-columns:1.35fr 1fr;gap:24px;padding:20px 0;border-bottom:1px solid #dbddd5}.meta h2{margin:0 0 5px;font-size:19px}.meta p{margin:0;font-size:16px;color:#4e594f}.route-choices{align-items:center;margin:15px 0 10px}.route-choices span{font-size:14px;color:#687168}.route-choices button{padding:5px 13px;font-size:14px}.route-info{color:#4c5a4f;min-height:26px;font-size:15px}.note{margin-top:18px;color:#757b73;font-size:13px}details{margin-top:14px;font-size:14px;color:#5b655d}summary{cursor:pointer;width:max-content}details p{max-width:1000px;margin:10px 0}a{color:#315f51}.status{position:absolute;right:18px;bottom:14px;color:white;background:#17251bd9;border-radius:4px;padding:4px 10px;font-size:12px}.hidden{display:none!important}@media(max-width:720px){.page{padding:16px 12px}header{align-items:flex-start}h1{font-size:23px}header p{font-size:13px}.badge{font-size:11px;padding:3px 8px}.views button{font-size:14px;padding:7px 11px}.toolbar{gap:10px}.meta{display:block;padding:15px 0}.meta>div+div{margin-top:12px}.meta p{font-size:14px}.pin{font-size:11px;padding:2px 5px}.pin.minor{font-size:10px}.frame-title,.compass{top:7px;font-size:11px;padding:2px 5px}.frame-title{left:7px}.compass{right:7px}.status{display:none}.route-choices{gap:5px}.route-choices button{font-size:12px;padding:4px 8px}}
@media(prefers-reduced-motion:reduce){.scene{transition:none}}
</style></head><body><main class="page">
<header><div><div class="eyebrow">第四章 · 夷陵</div><h1>大本营与四路去向</h1><p>刘备御营附近的集结营，从营地向外看。</p></div><span class="badge">美术版本 · 待审阅</span></header>
<div class="toolbar"><nav class="views" aria-label="切换观察位置"></nav><div class="tools"><button id="labels-toggle" aria-pressed="true">隐藏标注</button><button id="fullscreen">全屏查看</button></div></div>
<section class="frame" id="frame" aria-label="Blender 地图画面"><div class="canvas"><img class="scene" id="scene" alt=""><svg class="lines" viewBox="0 0 1920 1080" aria-hidden="true"></svg><div class="labels"></div><span class="frame-title"></span><span class="compass"></span><span class="status">同一 Blender 场景 · 机位切换</span><div class="error hidden" role="alert">画面尚未载入</div></div></section>
<section class="meta" aria-live="polite"><div><h2 id="view-title"></h2><p id="view-desc"></p></div><div><h2>从这里出发</h2><p id="view-action"></p></div></section>
<div class="route-choices" aria-label="查看路线"><span>在总览中看路线</span><button data-route="all">全部</button><button data-route="fu">傅肜</button><button data-route="huang">黄权</button><button data-route="cheng">程畿</button><button data-route="sha">沙摩柯</button></div>
<div class="route-info" aria-live="polite"></div>
<details><summary>布局依据与版本说明</summary><p>本版按用户确认，将大本营设为刘备御营附近的集结营。<a href="https://zh.wikisource.org/wiki/三國志/卷43" target="_blank" rel="noreferrer">《黄权传》</a>支持刘备在江南、黄权在江北；营门距江、两营之间的距离、山口和四路位置由游戏设计。人物标记表示军情方向。场景未采用历史测绘，也不据此计算行军时间。</p><p>本页用于观察机位、道路和渡口，不连接剧情服务。来源、重建方式和接入接口见 <a href="README.md">本地制作说明</a>。地形、营地和道具由 Blender 建模；表面材质与天空光照采用 <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">Poly Haven CC0 资产</a>，详见 material-provenance.json。</p></details>
<p class="note">可用键盘左右键切换机位。切换视角不会发出军令。</p>
</main><script>
const DATA=__DATA__;
const DESCRIPTIONS={
 camp:{title:'大本营',desc:'从发令帐前看向集结营，军帐、营门和出营道路处在同一空间。',action:'先转向江面、东侧陆路或山口，再用调度总览查看四路去向。',direction:'营中 · 北偏东',pins:[]},
 river:{title:'营门望江',desc:'北门外的道路沿坡下到南岸渡口。江面将两岸分开，对岸接应仍需要渡船。',action:'黄权、程畿两路都先去渡口，登船后再分开。',direction:'望向江面 · 北偏东',pins:['dock','north']},
 east:{title:'东侧陆路',desc:'从东门出营，陆路顺着江南谷地延伸；到营外岔口再选择去向。',action:'沿谷地继续走是傅肜方向，从岔口转入山路是沙摩柯方向。',direction:'望向谷地 · 东',pins:[]},
 south:{title:'山路岔口',desc:'站在营外岔口，沿小路看向林缘。道路贴着坡面，继续深入两侧山坡之间。',action:'沙摩柯方向从出营主路转入山路。人物位置以军情标记为准。',direction:'岔口望向山路 · 东南',pins:[]},
 imperial:{title:'高处望御营',desc:'从大本营后侧的木瞭望台回望，邻近高地上的帐群为刘备御营。两营之间有短路连接。',action:'两处营地分开，取得授权后回到集结营组织接应。',direction:'瞭望台 · 西南',pins:['imperial']},
 overview:{title:'调度总览',desc:'把两营、南北渡口和四路军情放回同一张地图。地标与路线来自当前 Blender 相机投影。',action:'点击下方人物名，可单独检查这一条路线；路线表示去向。',direction:'上方为北岸 · 右侧为东向',pins:['camp','imperial','dock','north','fu','huang','cheng','sha']}
};
const ROUTES={all:'四路共用大本营。两条水路共用营地至南岸渡口这一段。',fu:'傅肜：大本营出东门，沿江南谷地陆路前往。',huang:'黄权：大本营 → 南岸渡口 → 渡江 → 北岸泊点 → 北岸道路。',cheng:'程畿：大本营 → 南岸渡口 → 登船沿江寻找后船。',sha:'沙摩柯：大本营出东门，经过营外岔口后转入山路。'};
let current='camp',selected='all',showLabels=true,loadSeq=0;
const keys=['camp','river','east','south','imperial','overview'];const qs=s=>document.querySelector(s);
for(const key of keys){const b=document.createElement('button');b.textContent=DATA.cameras[key].title;b.dataset.view=key;b.onclick=()=>setView(key);qs('.views').append(b)}
function draw(){
 const cam=DATA.cameras[current],d=DESCRIPTIONS[current];qs('.lines').replaceChildren();qs('.labels').replaceChildren();
 qs('.lines').classList.toggle('hidden',!showLabels);qs('.labels').classList.toggle('hidden',!showLabels);
 if(current==='overview'){
  for(const key of (selected==='all'?['fu','sha','huang','cheng']:[selected])){
   const pts=cam.routes[key].map(p=>`${p.x*1920},${p.y*1080}`).join(' ');
   for(const [color,width,dash]of [['#213329a6',7,''],[selected==='all'?'#f3edce':'#ffebaf',3.5,'11 7']]){
    const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',pts);line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width',width);line.setAttribute('stroke-linejoin','round');if(dash)line.setAttribute('stroke-dasharray',dash);qs('.lines').append(line);
   }
  }
 }
 for(const key of d.pins){const p=cam.points[key];if(!p||!p.inFrame)continue;
  const b=document.createElement('button');b.className='pin'+(['fu','sha','huang','cheng'].includes(key)?'':' minor')+(selected===key?' active':'');b.style.left=(p.x*100)+'%';b.style.top=(p.y*100)+'%';b.textContent=p.label;
  b.onclick=()=>{if(ROUTES[key])setRoute(key);else if(key==='imperial'||key==='camp')setView(key);else if(key==='dock'||key==='north')setView('river')};qs('.labels').append(b);
 }
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===current)));
 document.querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',String(current==='overview'&&b.dataset.route===selected)));
 qs('#view-title').textContent=d.title;qs('#view-desc').textContent=d.desc;qs('#view-action').textContent=d.action;qs('.frame-title').textContent=d.title;qs('.compass').textContent=d.direction;qs('.route-info').textContent=current==='overview'?ROUTES[selected]:'选择一个人物名，可在总览中查看完整去路。';
}
async function setView(key){
 current=key;draw();const seq=++loadSeq;const img=qs('#scene');img.classList.add('loading');qs('#frame').classList.add('loading');qs('.error').classList.add('hidden');
 const next=new Image();next.src=DATA.cameras[key].image;
 try{await next.decode();if(seq!==loadSeq)return;img.src=next.src;img.alt=DESCRIPTIONS[key].desc;img.classList.remove('loading');qs('#frame').classList.remove('loading');document.title=DATA.cameras[key].title+' · 夷陵地图审阅';}
 catch(e){if(seq!==loadSeq)return;qs('.error').classList.remove('hidden');img.classList.remove('loading');qs('#frame').classList.remove('loading');}
}
function setRoute(key){selected=key;setView('overview')}
document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>setRoute(b.dataset.route));
qs('#labels-toggle').onclick=()=>{showLabels=!showLabels;qs('#labels-toggle').textContent=showLabels?'隐藏标注':'显示标注';qs('#labels-toggle').setAttribute('aria-pressed',String(showLabels));draw()};
qs('#fullscreen').onclick=async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await qs('#frame').requestFullscreen()};
document.addEventListener('fullscreenchange',()=>qs('#fullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏查看');
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();setView(keys[(keys.indexOf(current)+(e.key==='ArrowRight'?1:keys.length-1))%keys.length])});
setView('camp');
</script></body></html>'''
html=template.replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('</','<\\/'))
open(os.path.join(ROOT,'review.html'),'w',encoding='utf-8').write(html)
print('Created review.html and legacy-map-layout.json')
