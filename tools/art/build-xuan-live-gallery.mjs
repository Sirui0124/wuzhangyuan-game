import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only the review index is generated. The capture list remains owned by the real-game check.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const directory = resolve(root, 'source-art/visuals/review/20261022/xuan-live');
const shots = resolve(root, 'docs/art/review-20261022/xuan-live');
const checks = JSON.parse(readFileSync(resolve(shots, 'checks.json'), 'utf8'));
assert.equal(checks.passed, true, 'A passing real-game capture record is required.');
assert.ok(Array.isArray(checks.captures) && checks.captures.length, 'Missing capture list.');
assert.equal(new Set(checks.captures).size, checks.captures.length, 'Duplicate captures.');
const prefix = relative(directory, shots).replaceAll('\\', '/');
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const groups = [
  { id: 'reasoning', title: '一 · 推理', note: '见闻形成认识，再继续推理。曲线逐条连接本次实际使用的依据；多组依据可以形成独立认识，沿用的认识也保留来处。' },
  { id: 'authorization', title: '二 · 授权行动', note: '推理形成行动目标，随后回到场景执行。形成“去取得授权”的认识，不等于已经获得授权；只有实际发生姜维对白后，才记录应允事实。下图显示行动目标与窄屏布局。' },
  { id: 'expression', title: '三 · 语言组织', note: '已发生的事实作为表达依据，组织、润色与确认说出分开。这里的生成、失败和重试均使用模拟响应；没有调用真实 AI 服务。' },
  { id: 'panels', title: '四 · 设置、存档与历史对白', note: '玄青半透云纹已接入三个正式弹窗。控件沿用实际设置和存档流程，存档显示真实场景封面，历史对白来自当前进度。' },
];
const descriptions = {
  'thought-initial.png': ['reasoning', '推理起点', '从真实收录的见闻中选择依据，保留空白与阅读顺序。'],
  'multi-branch.png': ['reasoning', '独立的两条认识', '同次思考形成两组认识，各自只连接自己的依据。'],
  'thought-original-source.png': ['reasoning', '查看原话来处', '展开已发生的对白，核对依据内容。'],
  'thought-I01.png': ['reasoning', '第一层认识', '由本次选用的见闻形成认识，并保留来源曲线。'],
  'thought-insufficient-evidence.png': ['reasoning', '依据尚不足', '未成立的推理提供反馈，不制造认识或来源曲线。'],
  'thought-R01.png': ['reasoning', '继续推理', '已有认识与新的见闻共同支撑下一层判断。'],
  'thought-related-sources.png': ['reasoning', '追看相关依据', '突出当前认识的相关来处，便于沿线查看。'],
  'thought-R02-action.png': ['authorization', '形成行动目标', '思路指向下一步行动；实际授权仍需通过场景对白取得。'],
  'thought-tablet.png': ['authorization', '窄屏中的行动目标', '同一真实推理进度的窄屏布局，操作与来源保留。'],
  'expression-reference.png': ['expression', '依据与参考表达', '已取得的事实进入语言组织，建议表达可查看和修改。'],
  'expression-polished.png': ['expression', '润色后的表达', '模拟生成完成后仍需玩家检查、修改并确认。'],
  'expression-retry.png': ['expression', '失败与重试', '模拟失败时保留依据和草稿，允许重新尝试。'],
  'expression-900.png': ['expression', '900px 语言组织', '较窄视口中的依据、正文与确认操作。'],
  'expression-768.png': ['expression', '768px 语言组织', '更窄视口下保留同一功能与内容层级。'],
  'expression-explicit-speech.png': ['expression', '确认说出', '玩家明确确认后，才进入实际发言和后续对白。'],
  'settings.png': ['panels', '设置', '实际音量、减少动态效果和自由表达服务入口。'],
  'saves.png': ['panels', '存档', '自动存档与两个手动位置，保留覆盖确认与读取规则。'],
  'history.png': ['panels', '历史对白', '真实进度中的人物与对白，按原内容呈现。'],
};
for (const name of checks.captures) {
  assert.equal(basename(name), name, `Capture must be a filename: ${name}`);
  assert.ok(descriptions[name], `Add a caption for the new capture: ${name}`);
  assert.ok(existsSync(resolve(shots, name)), `Missing screenshot: ${name}`);
}
const captures = groups.flatMap(group => checks.captures.filter(name => descriptions[name][0] === group.id).map(name => ({ name, group: group.id, title: descriptions[name][1], note: descriptions[name][2], src: `${prefix}/${name}` })));
const sections = groups.map(group => `<section id="${group.id}" class="shot-section"><header><h2>${group.title}</h2><p>${group.note}</p></header><div class="shot-grid">${captures.map((shot, index) => ({ shot, index })).filter(({ shot }) => shot.group === group.id).map(({ shot, index }) => `<figure><button type="button" class="shot" data-index="${index}" aria-label="放大：${esc(shot.title)}"><img src="${esc(shot.src)}" alt="${esc(shot.title)} · 正式游戏实机截图" decoding="async"><span aria-hidden="true">放大 ↗</span></button><figcaption><h3>${esc(shot.title)}</h3><p>${esc(shot.note)}</p></figcaption></figure>`).join('')}</div></section>`).join('');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>玄青 · 正式实机图册</title><style>
:root{color-scheme:dark;--ink:#e7dfca;--muted:#b0b59e;--edge:#a18f593e;--jade:#b0c3a5}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#102329;color:var(--ink);font:16px/1.75 'Microsoft YaHei','PingFang SC',sans-serif}main{max-width:1640px;margin:auto;padding:40px 44px 60px}h1,h2,h3{font-family:KaiTi,STKaiti,serif;font-weight:400}h1{font-size:36px;letter-spacing:4px;line-height:1.4;margin:10px 0 16px}h2{font-size:28px;line-height:1.5;margin:0 0 9px}h3{font-size:22px;line-height:1.5;margin:0 0 5px}.eyebrow{font-size:14px;color:#b6a67f;letter-spacing:2px}.intro>p{max-width:1000px;margin:0;color:var(--muted)}a{color:var(--jade);text-underline-offset:5px}button{font:inherit;cursor:pointer}button:focus-visible,a:focus-visible{outline:2px solid #c6b27e;outline-offset:5px}.links{display:flex;gap:12px 24px;flex-wrap:wrap;margin:20px 0 0;font-size:14px}.links a{text-decoration:none}.adopted{color:#c7d4b5;font-size:14px;border:1px solid #adc29761;padding:3px 10px;display:inline-block;margin-right:10px}.scope{padding:14px 18px;margin:24px 0;color:var(--muted);border-left:1px solid #b5a57380;background:linear-gradient(90deg,#9ca27b12,transparent);font-size:14px}.section-nav{display:flex;gap:14px 26px;flex-wrap:wrap;border-block:1px solid var(--edge);padding:15px 0;margin:24px 0 35px}.section-nav a{font-size:16px;text-decoration:none}.shot-section{scroll-margin-top:24px;margin-bottom:48px}.shot-section>header{max-width:1100px;margin-bottom:22px}.shot-section>header p{margin:0;color:var(--muted);font-size:16px}.shot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}.shot-grid figure{margin:0;min-width:0}.shot{display:block;position:relative;width:100%;padding:0;border:1px solid var(--edge);background:#091c21;line-height:0;aspect-ratio:8/5}.shot img{display:block;width:100%;height:100%;object-fit:contain}.shot span{position:absolute;right:12px;bottom:12px;line-height:1.6;font-size:14px;color:#e7dfca;background:#142822e8;padding:5px 10px;opacity:0;transition:opacity .15s}.shot:hover span,.shot:focus-visible span{opacity:1}figcaption{padding:13px 2px 0}figcaption p{font-size:14px;color:var(--muted);margin:0}footer{font-size:14px;color:var(--muted);border-top:1px solid var(--edge);padding-top:20px}footer p{margin:0 0 12px}dialog{background:#102329;color:var(--ink);border:1px solid #a18f5966;padding:16px;max-width:96vw;max-height:96vh;box-shadow:0 20px 70px #0008}dialog::backdrop{background:#030c10eb}dialog header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px}dialog header button,dialog footer button{color:var(--jade);background:transparent;border:0;min-height:44px;padding:6px 12px}dialog img{display:block;max-width:91vw;max-height:76vh;object-fit:contain}dialog footer{display:flex;justify-content:space-between;align-items:center;gap:14px;border:0;padding-top:10px}dialog footer p{margin:0;max-width:800px}dialog footer button{white-space:nowrap}#viewer-position{color:var(--muted);font-size:14px;margin-left:12px}@media(max-width:900px){main{padding:28px 24px 40px}.shot-grid{gap:22px}h1{font-size:30px}.section-nav{gap:12px 20px}}@media(max-width:650px){main{padding:24px 16px 35px}.shot-grid{grid-template-columns:1fr;gap:24px}h1,h2{font-size:28px}.shot span{opacity:1}.scope{padding:12px}.section-nav{display:grid;grid-template-columns:1fr 1fr;font-size:14px}dialog{padding:10px}dialog footer{flex-wrap:wrap}dialog footer p{order:3;width:100%;font-size:14px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
</style></head><body><main><header class="intro"><span class="eyebrow">逆转五丈原 / 正式实机 / 2026.10.22</span><h1>玄青夜绢，已进入游戏</h1><p><span class="adopted">用户已选用 · 已接入</span>思绪、语言组织与系统弹窗使用当前正式代码。以下 ${captures.length} 张截图来自独立测试进度中的真实操作；没有用设计预览替换正式界面。</p><div class="links"><a href="http://127.0.0.1:8812/" target="_blank" rel="noopener">进入正式试玩 ↗</a><a href="../modal-suite/index.html">深浅方案比较存档 ↗</a><a href="../index.html#ui">完整美术图册 ↗</a><a href="${prefix}/checks.json">实机检查记录 ↗</a></div></header>
<p class="scope">思路来源曲线说明“依据如何支持认识”，实际授权来自场景中的人物对白。界面中的推理结果不会自行生成权限。图片与放大可离线查看；试玩需要本机游戏服务。</p>
<nav class="section-nav" aria-label="截图分组">${groups.map(group => `<a href="#${group.id}">${group.title}</a>`).join('')}</nav>${sections}
<footer><p>已完成 37 项核心测试，以及全流程、设置、思绪和独立实机检查。AI 部分仅使用模拟响应核验生成、取消、失败与确认流程，未发起真实 AI 调用。</p><p>技术验证不代替用户对实机美术细节的后续审阅。旧深浅比较图保留为方案记录，月白仍是备选；Cocos 未在本轮验收。</p></footer></main>
<dialog id="viewer" aria-labelledby="viewer-title"><header><div><span id="viewer-title"></span><span id="viewer-position"></span></div><button type="button" id="close-viewer">关闭 ×</button></header><img id="viewer-image" alt=""><footer><button type="button" id="previous-image" aria-label="上一张截图">← 上一张</button><p id="viewer-note"></p><button type="button" id="next-image" aria-label="下一张截图">下一张 →</button></footer></dialog>
<script>const shots=${JSON.stringify(captures)};const viewer=document.querySelector('#viewer');let active=0;function show(index){active=(index+shots.length)%shots.length;const shot=shots[active];document.querySelector('#viewer-title').textContent=shot.title;document.querySelector('#viewer-position').textContent=(active+1)+' / '+shots.length;const image=document.querySelector('#viewer-image');image.src=shot.src;image.alt=shot.title+' · 正式游戏实机截图';document.querySelector('#viewer-note').textContent=shot.note;}document.querySelectorAll('[data-index]').forEach(button=>button.addEventListener('click',()=>{show(Number(button.dataset.index));viewer.showModal();}));document.querySelector('#close-viewer').addEventListener('click',()=>viewer.close());document.querySelector('#previous-image').addEventListener('click',()=>show(active-1));document.querySelector('#next-image').addEventListener('click',()=>show(active+1));viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(active+(event.key==='ArrowRight'?1:-1));}});viewer.addEventListener('click',event=>{const r=viewer.getBoundingClientRect();if(event.target===viewer&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))viewer.close();});</script></body></html>`;
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'index.html'), html, 'utf8');
console.log(JSON.stringify({ output: relative(root, resolve(directory, 'index.html')).replaceAll('\\', '/'), captures: captures.length, groups: groups.map(group => ({ id: group.id, count: captures.filter(shot => shot.group === group.id).length })), checksPassed: checks.passed }, null, 2));
