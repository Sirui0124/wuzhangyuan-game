import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const objects=[];
const materials={ground:'#514e43',road:'#8b8065',cloth:'#b5aa8b',roof:'#8b826d',wood:'#514338',iron:'#333e3c',mat:'#b09d72',paper:'#ddd0a5',gold:'#edbc62',blue:'#648fa0',red:'#9e5c4e',jade:'#75a899',skin:'#d2b28c',black:'#353d42'};
function mesh(name,vertices,faces,material='wood',layer='base'){const o={name,vertices,faces,material,layer};objects.push(o);return o;}
function box(n,x,y,z,w,h,d,m='wood',l='base'){
 return mesh(n,[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>[x+v[0]*w/2,y+v[1]*h/2,z+v[2]*d/2]),[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]],m,l);
}
function cylinder(n,x,y,z,r,h,m='wood',l='base',segments=12){
 const v=[];for(let j=0;j<2;j++)for(let i=0;i<segments;i++){const a=i/segments*2*Math.PI;v.push([x+r*Math.cos(a),y+j*h,z+r*Math.sin(a)]);}
 const f=[];for(let i=0;i<segments;i++)f.push([i,(i+1)%segments,(i+1)%segments+segments,i+segments]);
 f.push(Array.from({length:segments},(_,i)=>segments-1-i),Array.from({length:segments},(_,i)=>i+segments));return mesh(n,v,f,m,l);
}
function tent(id,x,z,w,d,h=3.2,ridge=5.5,main=false){
 const l=main?'main-shell':'base',rl=main?'main-roof':'roofs';
 box(id+'-west-wall',x-w/2,h/2,z,.12,h,d,'cloth',l);box(id+'-east-wall',x+w/2,h/2,z,.12,h,d,'cloth',l);box(id+'-north-wall',x,h/2,z-d/2,w,h,.12,'cloth',l);
 const door=main?2.8:1.8;for(const s of [-1,1])box(id+'-front-'+s,x+s*(w+door)/4,h/2,z+d/2,(w-door)/2,h,.12,'cloth',l);
 box(id+'-curtain',x,h/2,z+d/2+.02,door,h,.04,'black',main?'curtain':'base');
 mesh(id+'-roof',[[x-w/2-.3,h,z-d/2-.3],[x+w/2+.3,h,z-d/2-.3],[x+w/2+.3,h,z+d/2+.3],[x-w/2-.3,h,z+d/2+.3],[x,ridge,z-d/2+.8],[x,ridge,z+d/2-.8]],[[0,1,4],[1,2,5,4],[2,3,5],[3,0,4,5]],'roof',rl);
 for(const sx of [-1,1])for(const sz of [-1,1])cylinder(id+'-post-'+sx+'-'+sz,x+sx*(w/2-.25),0,z+sz*(d/2-.2),.14,h+.15,'wood',l);
 if(main){for(const s of [-1,1])cylinder('main-doorpost-'+s,s*1.55,0,.05,.15,3.55,'wood','base');box('main-doorlintel',0,3.5,.05,3.5,.22,.24,'wood');}
}
function person(id,x,z,yaw,material='jade',layer='actors',height=1.74){
 const scale=height/1.74;
 const torso=cylinder(id+'-torso',x,.65*scale,z,.24*scale,.68*scale,material,layer,8);cylinder(id+'-head',x,height-.36*scale,z,.17*scale,.30*scale,'skin',layer,8);
 const a=yaw*Math.PI/180,dx=Math.sin(a),dz=Math.cos(a);box(id+'-nose',x+dx*.19*scale,height-.2*scale,z+dz*.19*scale,.10*scale,.08*scale,.10*scale,'skin',layer);
 for(const s of [-1,1])box(id+'-leg-'+s,x+s*.13*scale,.33*scale,z,.15*scale,.66*scale,.17*scale,material,layer);
 return torso;
}
function lamp(id,x,z,r=.16,height=.35,layer='interior',base=0){
 cylinder(id+'-stand',x,base,z,r*.36,height,'iron',layer,8);cylinder(id+'-bowl',x,base+height,z,r,.10,'iron',layer);cylinder(id+'-light',x,base+height+.10,z,r*.28,.13,'gold',layer,8);
}
function desk(id,x,z,w,d){box(id+'-top',x,.78,z,w,.13,d,'wood','interior');for(const sx of [-1,1])for(const sz of [-1,1])box(id+'-leg-'+sx+'-'+sz,x+sx*(w/2-.15),.37,z+sz*(d/2-.15),.16,.74,.16,'wood','interior');box(id+'-map',x,.855,z,w*.72,.02,d*.7,'paper','interior');}
function fence(x,z,w,d){for(let u=-w/2;u<=w/2;u+=1.8)cylinder('fence-post',x+u,0,z,.10,1.35,'wood');for(const y of [.5,1.1])box('fence-rail',x,y,z,w,.10,d,'wood');}
box('ground',0,-.15,16,68,.25,76,'ground');box('main-road',0,.005,25,6,.02,46,'road');box('forecourt',0,.018,7,22,.02,14,'road');box('east-link',11,.02,15,22,.03,3,'road');box('west-link',-6,.02,30,12,.03,3,'road');
tent('MAIN',0,-7,14,14,3.5,5.8,true);tent('JIANGWEI',18,10,9,10,3.1,4.7);tent('REPORT',-13,28,6,7,2.7,4.2);
// 2026-10-22 follow-up: the report station is a six-metre open work shelter, not another command tent.
for(let i=objects.length-1;i>=0;i--)if(objects[i].name.startsWith('REPORT-front-')||['REPORT-curtain','REPORT-east-wall'].includes(objects[i].name))objects.splice(i,1);
box('REPORT-front-beam',-13,2.65,31.5,6.2,.18,.18);box('REPORT-desk-top',-13,.78,30.2,2.6,.14,1.0);for(const x of [-14.1,-11.9])for(const z of [29.85,30.55])box('REPORT-desk-leg',x,.36,z,.15,.72,.15);
lamp('REPORT-single-lantern',-10.25,31.3,.13,1.8,'base');
box('JIANGWEI-desk-top',21.1,.78,15.6,2.0,.14,.9);for(const x of [20.3,21.9])for(const z of [15.3,15.9])box('JIANGWEI-desk-leg',x,.36,z,.14,.72,.14);lamp('JIANGWEI-single-lantern',20.8,15.2,.13,1.8,'base');
for(const x of [-20,20])for(const z of [25,37])if(!(x===-20&&z===25))tent('SUPPORT-'+x+'-'+z,x,z,6,7,2.4,3.8);
for(const x of [-21,21])fence(x,48,18,.1);for(const x of [-30,30])for(let z=-10;z<=46;z+=1.8)cylinder('perimeter',x,0,z,.1,1.4);
for(const x of [-3.6,3.6])cylinder('OUTER-GATE-post',x,0,48,.3,6);box('OUTER-GATE-beam',0,5.7,48,8,.3,.35);
for(const x of [-9,9]){fence(x,17,10,.1);for(const z of [5,15,28,40]){cylinder('flag-pole',x,0,z,.11,5.7);box('flag',x+.65,4.7,z,1.1,1.9,.04,'black');lamp('road-fire',x,z,.25,1.5,'base');}}
for(const x of [-2.6,2.6])lamp('door-fire',x,.6,.28,1.5,'base');
box('NOTICE-board',4.3,1.5,1.1,1.1,1.1,.10,'wood');box('NOTICE-paper',4.3,1.5,1.16,.85,.88,.025,'paper');
box('ritual-mat',0,.04,-7,10,.045,10.5,'mat','interior');desk('MAP-DESK',-3.8,-4.8,2.8,1.3);box('SEAT',-3.8,.30,-3.45,.7,.6,.65,'wood','interior');
lamp('MAIN-LIFE-LAMP',0,-6.8,.38,.18);
const large=[[-2,-8.7],[0,-9.2],[2,-8.7],[-2.5,-6.8],[2.5,-6.8],[-2,-4.9],[2,-4.9]];
large.forEach(([x,z],i)=>lamp('LARGE-'+(i+1),x,z,.24,.48));
const clusters=[[-3.8,-2],[-4.1,-6.7],[-3.8,-9.1],[0,-10.7],[3.8,-9.1],[4.1,-6.7],[3.8,-3.2]];
clusters.forEach(([x,z],i)=>{for(let j=0;j<7;j++){const a=j*2*Math.PI/7;lamp('SMALL-'+(i*7+j+1),x+Math.cos(a)*.48,z+Math.sin(a)*.48,.09,.10);}});
lamp('DESK-AUX-LAMP',-2.8,-4.8,.13,.1,'interior',.855);
person('ZHUGE-RITUAL',-1.15,-6.3,100,'black','ritual');box('SWORD-RITUAL',-.75,.52,-6.3,.045,1.0,.04,'iron','ritual');
person('CHILD-A',0,-5.8,180,'cloth','ritual',1.15);person('CHILD-B',4.9,-4,270,'cloth','ritual',1.3);
person('ZHUGE-COUNCIL',-3.8,-3.45,180,'black','council',1.34);
person('GUARD-A',-1.9,1.25,61,'iron');person('PLAYER',1.6,3.2,241,'blue');person('JIANGWEI',17.9,16.3,0,'jade');person('RELAY-B',19.9,15.8,327,'cloth');person('SCOUT',-8.5,30.7,90,'cloth');person('WEIYAN',-6.1,30.7,270,'red');
person('WEIYAN-JUDGMENT',1.6,5.6,180,'red','judgment');for(const x of [-.1,3.3])person('SOLDIER-JUDGMENT-'+x,x,6.5,180,'iron','judgment');
person('JIANGWEI-ENDING',0,10.5,0,'jade','ending');
box('horse-stop-marker',-4.5,.03,37,3,.05,2,'jade');
const actors=[{id:'PLAYER',name:'玩家值守点',p:[1.6,0,3.2],yaw:241},{id:'GUARD-A',name:'守卫甲',p:[-1.9,0,1.25],yaw:61},{id:'JIANGWEI',name:'姜维·帐前候见',p:[17.9,0,16.3],yaw:0},{id:'RELAY-B',name:'乙·文书案旁',p:[19.9,0,15.8],yaw:327},{id:'SCOUT',name:'斥候·传报',p:[-8.5,0,30.7],yaw:90},{id:'WEIYAN',name:'魏延·交涉',p:[-6.1,0,30.7],yaw:270},{id:'ZHUGE-RITUAL',name:'诸葛亮·借寿',p:[-1.15,0,-6.3],yaw:100},{id:'ZHUGE-COUNCIL',name:'诸葛亮·案前',p:[-3.8,0,-3.45],yaw:180}];
const cameras=[
 {id:'overview',name:'01 总体鸟瞰',eye:[43,39,64],target:[0,0,13],mode:'explore',note:'总平面建立；不是游戏默认镜头'},
 {id:'SC03',name:'02 醒来 → 主帐',eye:[3,1.62,13],target:[0,1.8,-2],mode:'explore',note:'主帐门始终在北，右缘矛不作建筑锚点'},
 {id:'guard',name:'03 第一视角·甲',eye:[1.6,1.62,3.2],target:[-1.9,1.5,1.25],mode:'explore',note:'第一视角无肩背；站位不堵中间门口'},
 {id:'report',name:'04 第一视角·魏延',eye:[-8.5,1.62,32.8],target:[-6.1,1.5,30.7],mode:'explore',note:'斥候与魏延横轴；镜头留在轴线南侧'},
 {id:'jiang',name:'05 第一视角·姜维帐前',eye:[17.8,1.62,19],target:[17.9,1.5,16.3],mode:'explore',note:'新姜维帐前空间，不能沿用向帐外看的旧 relay_tent'},
 {id:'interior',name:'06 主帐剖开·灯阵',eye:[12,15,10],target:[0,0,-6.7],mode:'ritual',note:'7 大灯 + 49 小灯 + 1 本命灯；旁路保留'},
 {id:'ritual',name:'07 借寿·关系镜头',eye:[2.8,1.5,-2.5],target:[-.8,1.1,-6.5],mode:'ritual',note:'灯—诸葛亮轴东南侧；低灯不升到桌面'},
 {id:'council',name:'08 议事·案与门',eye:[-5.9,1.55,-6.3],target:[-3.8,1.25,-3.6],mode:'council',note:'南门在人物后侧；保留同一案位与低位主灯'},
 {id:'judgment',name:'09 清晨问责',eye:[1.6,1.62,3.2],target:[1.6,1.5,5.6],mode:'judgment',note:'由值守点转身向南；魏延后方是营道，不把主帐放到他背后'},
 {id:'ending',name:'10 姜维章末',eye:[0,1.62,13],target:[0,1.5,10.5],mode:'ending',note:'相机仍朝北；姜维身后保留主帐'}
];
const routes=[{id:'R1',name:'传报→主帐（步行）',color:'#b05443',points:[[-8,30],[-2,30],[-2,18],[0,14],[0,4],[0,1]]},{id:'R2',name:'主帐→姜维帐前（通传）',color:'#398577',points:[[1.6,3.2],[4,6],[6,15],[18,15],[18,17]]},{id:'R3',name:'外营→下马→传报',color:'#a28243',points:[[0,51],[0,39],[-4.5,37],[-8,34],[-8,30]]}];
const model={version:'camp-v1-20261022',status:'待review',units:'meters',coordinateSystem:'right-handed; X east, Y up, Z south; north = -Z; origin = main tent threshold',materials,objects,actors,cameras,routes,largeLamps:large,smallLampClusters:clusters,disclaimer:'空间一致性样机；尺寸/方位为设计约束，非视频摄影测量或历史复原。'};
fs.writeFileSync(path.join(ROOT,'camp-layout.json'),JSON.stringify(model,null,2));
fs.writeFileSync(path.join(ROOT,'camp-materials.mtl'),Object.entries(materials).map(([n,c])=>{const rgb=c.match(/\w\w/g).map(h=>(parseInt(h,16)/255).toFixed(5));return `newmtl ${n}\nKa ${rgb.join(' ')}\nKd ${rgb.join(' ')}\nKs 0 0 0\nd 1\n`;}).join('\n'));
function exportOBJ(file,filter){let offset=1;const out=['# CAMP V1 | meters | +Y up | +Z south | -Z north','mtllib camp-materials.mtl'];for(const o of objects.filter(filter)){out.push('o '+o.name.replace(/[^a-zA-Z0-9_-]/g,'_'),'usemtl '+o.material);out.push(...o.vertices.map(v=>'v '+v.map(n=>n.toFixed(4)).join(' ')));for(const face of o.faces)for(let i=1;i<face.length-1;i++)out.push('f '+[face[0],face[i],face[i+1]].map(n=>n+offset).join(' '));offset+=o.vertices.length;}fs.writeFileSync(path.join(ROOT,file),out.join('\n')+'\n');}
exportOBJ('camp-exterior.obj',o=>['base','roofs','main-shell','main-roof','curtain','actors'].includes(o.layer));
exportOBJ('main-tent-ritual.obj',o=>['interior','ritual','main-shell','main-roof','curtain'].includes(o.layer)||o.name.startsWith('main-door'));
exportOBJ('main-tent-council.obj',o=>['interior','council','main-shell','main-roof'].includes(o.layer)||o.name.startsWith('main-door'));
const esc=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
function svgStart(title,w,h){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6" fill="context-stroke"/></marker></defs><rect width="100%" height="100%" fill="#eee8d8"/><style>text{font-family:Microsoft YaHei,Arial,sans-serif;fill:#253b3c}.small{font-size:13px}.label{font-size:16px;font-weight:600}.title{font-size:26px;font-weight:700}</style><text x="32" y="42" class="title">${title}</text>`;}
function plan(outFile,interior=false){const w=1200,h=interior?900:1140,scale=interior?40:11,ox=interior?395:410,oz=interior?690:260;const sx=x=>ox+x*scale,sy=z=>oz+z*scale;let a=svgStart(interior?'02 / 中军主帐 · 固定平面与人物关系':'01 / 军营总平面 · 先定空间，再定人物',w,h);a+=`<text x="32" y="70" class="small">2026.10.22 · 待review · 米制设计坐标，非实测复原 · 北=-Z / 东=+X</text>`;
const rect=(x,z,b,d,fill,stroke='#6b7466')=>`<rect x="${sx(x-b/2)}" y="${sy(z-d/2)}" width="${b*scale}" height="${d*scale}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
const text=(x,z,t,cls='small')=>`<text x="${sx(x)}" y="${sy(z)}" class="${cls}">${esc(t)}</text>`;
const line=(p,q,color='#6b7466',dash='')=>`<line x1="${sx(p[0])}" y1="${sy(p[1])}" x2="${sx(q[0])}" y2="${sy(q[1])}" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}" marker-end="url(#arrow)"/>`;
if(!interior){
 for(let x=-30;x<=30;x+=5)a+=`<line x1="${sx(x)}" y1="${sy(-16)}" x2="${sx(x)}" y2="${sy(54)}" stroke="#ddd7c8"/>`;for(let z=-15;z<=50;z+=5)a+=`<line x1="${sx(-31)}" y1="${sy(z)}" x2="${sx(31)}" y2="${sy(z)}" stroke="#ddd7c8"/>`;
 a+=rect(0,16,60,64,'none');a+=rect(0,25,6,46,'#d2c4a1');a+=rect(0,7,22,14,'#dfd3b4');a+=rect(11,15,22,3,'#d2c4a1');a+=rect(-6,30,12,3,'#d2c4a1');
 a+=rect(0,-7,14,14,'#9eaa9b')+text(-6,-8,'中军主帐 14×14m','label')+text(-6,-5.5,'帐门朝南，门宽2.8m');
 a+=rect(18,10,9,10,'#aebcaf')+text(14,9,'姜维帐','label')+text(14,11,'9×10m');a+=rect(-13,28,6,7,'#c5b79a')+text(-15.5,27,'传报棚','label');
 for(const x of [-20,20])for(const z of [25,37])if(!(x===-20&&z===25))a+=rect(x,z,6,7,'#d6cfbb');
 a+=text(-5,51,'全营南外门','label')+text(-10,54,'外门 ≠ camp_gate（中军帐前）');a+=line([-28,-12],[-28,-17],'#314b4c')+text(-29,-18,'N','label');
 for(const r of routes)a+=`<polyline points="${r.points.map(p=>`${sx(p[0])},${sy(p[1])}`).join(' ')}" fill="none" stroke="${r.color}" stroke-width="3" marker-end="url(#arrow)"/>`;
 for(const c of cameras.filter(c=>['SC03','guard','report','jiang','judgment','ending'].includes(c.id))){a+=`<circle cx="${sx(c.eye[0])}" cy="${sy(c.eye[2])}" r="4" fill="#4b8199"/>`;a+=line([c.eye[0],c.eye[2]],[c.target[0],c.target[2]],'#4b8199','3 3');}
 for(const p of actors.filter(p=>p.p[2]>=0)){a+=`<circle cx="${sx(p.p[0])}" cy="${sy(p.p[2])}" r="5" fill="${p.id==='PLAYER'?'#4d8ba7':'#a65d47'}"/>`;const off=p.id==='GUARD-A'?[-6,-1.4]:p.id==='PLAYER'?[1.5,2]:p.id==='SCOUT'?[-3.6,2]:p.id==='WEIYAN'?[.7,-1]:p.id==='RELAY-B'?[.7,-1.8]:p.id==='JIANGWEI'?[.7,1.9]:[.7,-.6];a+=text(p.p[0]+off[0],p.p[2]+off[1],p.id);}
 a+=text(-29,58,'比例尺')+`<line x1="${sx(-22)}" y1="${sy(58)}" x2="${sx(-12)}" y2="${sy(58)}" stroke="#314b4c" stroke-width="3"/>`+text(-22,60,'0')+text(-12,60,'10m');
 let y=145;for(const t of ['坐标与结构锁定','主帐门槛 (0,0,0)','主帐北缘 z=-14；前场 z=0—14','中轴道宽6m，外门 z=48','姜维帐门 (18,0,15)','传报处 (-13,0,28)','下马点 (-4.5,0,37)','','动线约束','R1 传报→主帐；魏延步行','R2 通传与回令走东侧联络道','R3 骑马止于外圈，禁止进灯阵','','镜头约束','蓝点/虚线是机位与朝向','SC03、章末镜头朝北看主帐','清晨问责从值守处转向南','平面北仅为制作坐标，不指真实地理','','状态边界','图中人物点是该场景站位模板','不可解释为所有人物同时在场','候见/接报时姜维可移动至帐前','主帐内部只用于剧情已给片段']){a+=`<text x="810" y="${y}" class="${t.endsWith('约束')||t.endsWith('锁定')||t==='状态边界'?'label':'small'}">${t}</text>`;y+=30;}
}else{
 a+=rect(0,-7,14,14,'#c5c3af');a+=rect(0,-7,10,10.5,'#d9c7a0');a+=`<line x1="${sx(-1.4)}" y1="${sy(0)}" x2="${sx(1.4)}" y2="${sy(0)}" stroke="#eee8d8" stroke-width="7"/>`;a+=text(-1.7,1,'南门 2.8m','label');
 a+=rect(-3.8,-4.8,2.8,1.3,'#9b805e')+text(-5.1,-4.75,'固定文书案');a+=rect(-3.8,-3.45,.7,.65,'#7a6753');
 for(const [x,z] of large)a+=`<circle cx="${sx(x)}" cy="${sy(z)}" r="10" fill="#ae803b" stroke="#745b32"/>`;
 clusters.forEach(([x,z])=>{for(let j=0;j<7;j++){const ang=j*2*Math.PI/7;a+=`<circle cx="${sx(x+Math.cos(ang)*.48)}" cy="${sy(z+Math.sin(ang)*.48)}" r="3.8" fill="#d19c46"/>`;}});
 a+=`<circle cx="${sx(0)}" cy="${sy(-6.8)}" r="15.2" fill="#edbb5d" stroke="#835e30" stroke-width="2"/>`+text(.5,-6.7,'本命灯');
 for(const p of actors.filter(p=>p.p[2]<0)){const [x,,z]=p.p,ang=p.yaw*Math.PI/180;a+=`<circle cx="${sx(x)}" cy="${sy(z)}" r="11" fill="${p.id.includes('RITUAL')?'#466365':'#8b5150'}"/>`;a+=line([x,z],[x+Math.sin(ang)*1.0,z+Math.cos(ang)*1.0],'#314b4c');}
 a+=text(-2.2,-7.65,'诸葛亮·借寿')+text(-6.5,-2.6,'诸葛亮·案前（异时）');
 a+=`<polyline points="${[[0,1],[0,-.75],[-5.9,-.75],[-5.9,-11.9],[5.9,-11.9],[5.9,-.75]].map(p=>`${sx(p[0])},${sy(p[1])}`).join(' ')}" fill="none" stroke="#3b8277" stroke-width="4" stroke-dasharray="9 5" marker-end="url(#arrow)"/>`;
 for(const c of cameras.filter(c=>['ritual','council'].includes(c.id))){a+=`<circle cx="${sx(c.eye[0])}" cy="${sy(c.eye[2])}" r="7" fill="#43849c"/>`;a+=line([c.eye[0],c.eye[2]],[c.target[0],c.target[2]],'#43849c','4 4');a+=text(c.eye[0]-.3,c.eye[2]-.35,c.id==='ritual'?'C07':'C08');}
 a+=line([-6,-12],[-6,-13.4],'#314b4c')+text(-6.2,-13.6,'N','label');let y=145;for(const t of ['固定物件','主灯 (0,0.18,-6.8)，半径0.38m','七大灯 + 四十九小灯 + 主灯','数量来自当前本地 Prompt 约束','精确排布为本次设计，非影片点数','案中心 (-3.8,0.78,-4.8)','桌上辅助灯与本命灯分离','','通行与站位','绿色虚线：两侧与后侧绕行通道','侧道中心 x=±5.9，不穿灯盏','诸葛亮借寿点 (-1.15,0,-6.3)','小童A (0,0,-5.8)，俯身点灯','小童B (4.9,0,-4.0)，收火引','案前座位 (-3.8,0,-3.45)','借寿/案前是不同剧情时刻','','光与机位','南门低冷天光；灯为局部暖光','C07 在人物—主灯轴东南侧','C08 使南门落在人物后侧','门闭合/开启是剧情状态，不搬门','屋顶、帐墙为剖视，可切换显示','','所有尺寸与角度：待review','不宣称现有片逐镜吻合本模型']){a+=`<text x="760" y="${y}" class="${['固定物件','通行与站位','光与机位'].includes(t)?'label':'small'}">${t}</text>`;y+=28;}
}a+='</svg>';fs.writeFileSync(path.join(ROOT,outFile),a);return a;}
const site=plan('camp-plan.svg');const interior=plan('main-tent-plan.svg',true);
const template=fs.readFileSync(path.join(ROOT,'viewer-template.html'),'utf8');
fs.writeFileSync(path.join(ROOT,'index.html'),template.replace('/*__MODEL__*/',JSON.stringify(model)).replace('<!--__SITE_MAP__-->',site).replace('<!--__INTERIOR_MAP__-->',interior));
console.log(JSON.stringify({objects:objects.length,vertices:objects.reduce((n,o)=>n+o.vertices.length,0),lamps:{main:1,large:large.length,small:clusters.length*7},output:ROOT},null,2));

