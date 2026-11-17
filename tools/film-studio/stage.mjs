import fs from 'node:fs';
import path from 'node:path';

// Reuse the existing spatial model and renderer; keep the source assets unchanged.
export function makeStage(root) {
  const base = path.join(root, 'source-art/visuals/spatial/camp-v1');
  const model = JSON.parse(fs.readFileSync(path.join(base, 'camp-layout.json')));
  const extras = JSON.parse(fs.readFileSync(path.join(base, 'environment-cameras.json')));
  model.cameras.push(...extras);
  let js = fs.readFileSync(path.join(base, 'viewer-template.html'), 'utf8').split('<script>')[1].split('</script>')[0];
  js = js.replace('/*__MODEL__*/', JSON.stringify(model));
  js = js.replace('let selected=model.cameras[0]', 'let fov=55, actorEdits={}, hideActors=false;let selected=model.cameras[0]');
  js = js.replace('55*Math.PI/360', 'fov*Math.PI/360');
  js = js.replace('uniform mat4 vp;', 'uniform mat4 vp;uniform vec3 actorPivot;uniform vec3 actorShift;uniform float actorAngle;');
  js = js.replace('gl_Position=vp*vec4(position,1.0);', 'vec3 v=position-actorPivot;float c=cos(actorAngle),s=sin(actorAngle);vec3 p=vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z)+actorPivot+actorShift;gl_Position=vp*vec4(p,1.0);');
  js = js.replace('function visible(o){', `function visible(o){if(hideActors && /^(PLAYER|GUARD-A|JIANGWEI|RELAY-B|SCOUT|WEIYAN|ZHUGE|CHILD|SWORD)/.test(o.name))return false;`);
  js = js.replace("gl.bindBuffer(gl.ARRAY_BUFFER,b.b);const p=", `const actor=model.actors.find(a=>b.o.name.startsWith(a.id+'-')||(b.o.name==='SWORD-RITUAL'&&a.id==='ZHUGE-RITUAL'));const edit=actor&&actorEdits[actor.id];gl.uniform3fv(gl.getUniformLocation(program,'actorPivot'),actor?actor.p:[0,0,0]);gl.uniform3fv(gl.getUniformLocation(program,'actorShift'),edit?[edit.x-actor.p[0],0,edit.z-actor.p[2]]:[0,0,0]);gl.uniform1f(gl.getUniformLocation(program,'actorAngle'),edit?(edit.yaw-actor.yaw)*Math.PI/180:0);gl.bindBuffer(gl.ARRAY_BUFFER,b.b);const p=`);
  js += `
window.studio={
 cameras:model.cameras,actors:model.actors,
 get:()=>({camera:selected.id,eye:[...eye],target:[...target],mode,fov,actorEdits:JSON.parse(JSON.stringify(actorEdits)),hideActors,cutaway:$('#cutaway').checked,light:$('#light').value}),
 set(s){if(s.camera){const c=model.cameras.find(c=>c.id===s.camera);if(c)select(c)}if(s.eye)eye=s.eye.map(Number);if(s.target)target=s.target.map(Number);if(s.fov)fov=Number(s.fov);if(s.actorEdits)actorEdits=s.actorEdits;if(s.hideActors!==undefined)hideActors=s.hideActors;if(s.cutaway!==undefined)$('#cutaway').checked=s.cutaway;if(s.light)$('#light').value=s.light;render();return this.get()},
 image(){const before=$('#markers').checked;$('#markers').checked=false;render();const c=document.createElement('canvas');c.width=1920;c.height=1080;c.getContext('2d').drawImage(glCanvas,0,0,1920,1080);const data=c.toDataURL('image/png');$('#markers').checked=before;render();return data;}
};
window.addEventListener('keydown',e=>{if(!['w','s','a','d','q','e'].includes(e.key.toLowerCase()))return;e.preventDefault();const forward=norm(sub(target,eye)),right=norm(cross(forward,[0,1,0]));const dirs={w:forward,s:forward.map(v=>-v),d:right,a:right.map(v=>-v),q:[0,-1,0],e:[0,1,0]};const d=dirs[e.key.toLowerCase()];eye=eye.map((v,i)=>v+d[i]*.4);target=target.map((v,i)=>v+d[i]*.4);render()});
`;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#121719;color:#c9c7bd;font:12px 'Microsoft YaHei',sans-serif}.stage{position:relative;width:100%;aspect-ratio:16/9}canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}#labels{pointer-events:none}.hud,#renderStatus,#cameras{display:none}.controls{padding:8px;display:flex;flex-wrap:wrap;gap:12px}select,button{background:#202b2c;color:#ddd;border:1px solid #52605c;padding:5px}label{display:flex;gap:5px;align-items:center}</style><body><div id="cameras"></div><div class="stage"><canvas id="gl"></canvas><canvas id="labels"></canvas><div class="hud"><span id="cameraName"></span><span id="cameraNote"></span><span id="coords"></span></div></div><div class="controls"><label><input id="cutaway" type="checkbox">剖开主帐</label><label><input id="otherRoofs" type="checkbox" checked>其他帐顶</label><label><input id="markers" type="checkbox">空间标记</label><label>光线<select id="light"><option value="day">灰柔天光</option><option value="night">夜营示意</option></select></label><button id="reset">恢复预设机位</button></div><div id="renderStatus"></div><script>${js}</script></body></html>`;
}
