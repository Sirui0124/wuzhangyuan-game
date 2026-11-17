import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}]/gu,'');
function seconds(s){return s.split(':').reduce((a,n)=>a*60+Number(n),0);}
export function parseVtt(text){return text.split(/\r?\n\s*\r?\n/).flatMap(block=>{const lines=block.split(/\r?\n/),i=lines.findIndex(l=>l.includes(' --> '));if(i<0)return[];const m=lines[i].match(/([\d:.]+) --> ([\d:.]+)/);return m?[{start:seconds(m[1]),end:seconds(m[2]),text:lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'')}]:[];});}
export function buildChapter(root,clips){
  const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  const script=read('content/chapters/wuzhang/chapter-one.script.json');
  const flow=read('content/chapters/wuzhang/chapter-one.flow.json');
  const online=read('tools/film-studio/data/chapter-source.json');
  const inventory=read('video/production/CH01-continuity-20261028/audit/inventory.json');
  const plans=read('video/production/CH01-continuity-20261028/audit/generation-plan.json');
  const onlineById=new Map(online.rows.map(r=>[r.id,r]));
  const sectionByRow=new Map(flow.sections.flatMap(s=>s.rows.map(id=>[id,s])));
  const lines={};
  function kind(row){if(['A-40B','W07'].includes(row.id)||/AI回应|玩家输入/.test(row.speaker)||/\{\{/.test(row.text))return'dynamic';if(row.speaker==='演出')return'action';if(/选项/.test(row.speaker))return'choice';if(/心声/.test(row.speaker))return'inner';if(row.speaker==='旁白')return'narration';if(row.speaker==='告示')return'onscreen';if(/界面|问题|结果|结算|行动按钮|视频/.test(row.speaker))return'ui';return'dialogue';}
  for(const runtime of script.rows){const source=onlineById.get(runtime.id);const row=source||runtime;const type=kind(row);lines[row.id]={...row,kind:type,runtimeText:runtime.text,runtimeSpeaker:runtime.speaker,source:source?'飞书逐句执行':'程序保留的历史条目',archived:!source,section:sectionByRow.get(row.id)?.title||'',receiver:['inner','narration','ui','onscreen','action'].includes(type)?'无':row.speaker.startsWith('我')?'当前交谈对象':'我',direction:type==='action'?'仅执行画面动作，不朗读此句':type==='inner'?'我的画外心声；画面中NPC闭口':type==='dynamic'?'运行时按玩家发言生成；此处是回应意图或示例，不固定录制':type==='onscreen'?'画面中呈现的告示；没有对应声音时不新增旁白':type==='ui'||type==='choice'?'界面内容；不自动念出':'由原说话人发声，其他人物只作听者反应'};}
  for(const l of Object.values(lines)){if(l.speaker==='我'||l.id==='P2-SAY'){const section=sectionByRow.get(l.id)?.id;l.receiver=({'first-weiyan':'魏延','weiyan-approach':'魏延','guard-investigation':'甲','first-handoff':'甲','relay-investigation':'乙','scout-investigation':'斥候','scout-option-a':'斥候','scout-option-b':'斥候','order-delivery':'姜维、魏延'})[section]||l.receiver;}if(['J03'].includes(l.id))l.receiver='亲兵';if(['J08','J08A','J10B'].includes(l.id))l.receiver='姜维';if(['W04','W05','E03','P2-SAY'].includes(l.id))l.receiver='魏延';if(['E05','E08','E08B'].includes(l.id))l.receiver='魏延、我';if(l.id==='E10')l.receiver='姜维、我';}
  const openingIds=new Set(clips.slice(0,2).map(c=>c.id));
  const cinematicRows={opening:['A-07'],sacrifice:['A-50'],safe:['B-09','B-12']};
  const videos=clips.map(c=>{
    const subtitleFile=c.subtitles?path.join(root,'GameStarter/web-demo/public',c.subtitles.replace(/^\//,'')):null;
    const cues=subtitleFile&&fs.existsSync(subtitleFile)?parseVtt(fs.readFileSync(subtitleFile,'utf8')):[];
    const inv=inventory.find(i=>i.id===c.id);
    const request=plans.find(p=>p.indices.some(index=>inventory.find(i=>i.index===index)?.id===c.id));
    let rowIds=[...(c.rows||[])];
    if(!rowIds.length){rowIds=cues.map((cue,i)=>{const id=`vtt:${c.id}:${i+1}`;const speaker=c.id===clips[0].id&&i>=2?'我（心声）':c.id===clips[1].id?'甲':c.id==='EN03-EN04'?(i<2?'旁白':'待核对说话人'):'待核对说话人';lines[id]={id,speaker,text:cue.text,runtimeText:cue.text,kind:/心声/.test(speaker)?'inner':speaker==='旁白'?'narration':'dialogue',receiver:/心声|旁白/.test(speaker)?'无':'待核对',direction:'文字来自现用字幕；说话人与实际声音仍需听审',source:'现用VTT字幕',sourceRow:null,clip:c.id,start:cue.start,end:cue.end};return id;});}
    if(c.id==='C1FIX06B'){const base=lines['A-42'];const id='A-42@no-gate';lines[id]={...base,id,text:c.firstLineText,runtimeText:c.firstLineText,source:'A-42未询问营门的条件版本',humanCondition:'仅首轮选择“不行，今晚谁都不能进”时使用；不得补“营门未破”。'};rowIds=rowIds.map(id=>id==='A-42'?'A-42@no-gate':id);}
    const isOpening=openingIds.has(c.id);
    const coveredRows=c.rows|| (isOpening?['A-07']:c.id==='EN02B-A'?['A-50']:c.id==='ending-en01-20261016'?['B-09']:['B-12']);
    const baseline={id:c.id,title:c.title,clip:c.id,kind:'video',lineIds:rowIds,coveredRows,scene:sectionByRow.get(coveredRows[0])?.scene|| (isOpening?'开篇': '中军帐内外'),duration:inv?.duration||null,cues,request:request?.code||(c.id===clips[0].id?'R00':null),production:request?{reason:request.problem,proposal:request.fix,cut:request.edit}:c.id===clips[0].id?{reason:'现片现代段仍有代码、同学、行情等多句经历；R00已准备改为三个当下心声。',proposal:'保留开头古代段，只替换现代后半段；先核对灭灯、手机揭示与醒来段的衔接。',cut:'R00为20秒准备稿，未生成、未替换。古代前段不因现代段改稿而整段废弃。'}:{reason:'尚无本轮明确重拍项。',proposal:'先保留现片审阅；台词有修改时再决定重配音或重拍。',cut:'保留原节点与互动停点。'}};
    if(c.id==='C1T01-02')baseline.production.proposal='本段为查看告示，VTT无对白。编辑告示文字不等于新增旁白；需核对画面告示是否可读。';
    const spoken=rowIds.map(id=>lines[id]).filter(l=>['dialogue','inner','narration'].includes(l.kind));
    const subtitleText=clean(cues.map(c=>c.text).join(''));
    baseline.textMismatches=spoken.filter(l=>clean(l.runtimeText)&&!subtitleText.includes(clean(l.runtimeText))).map(l=>l.id);
    return baseline;
  });
  const units={};for(const v of videos)units[`video:${v.id}`]={...v,id:`video:${v.id}`};
  const openingRevision=fs.readFileSync(path.join(root,'video/production/CH01-continuity-20261028/R00-开场后半段简短心声.md'),'utf8');
  const revisedOpeningLines=[...openingRevision.matchAll(/唯一允许发声的原句：“([^”]+)”/g)].map((m,i)=>{const id=`prepared:R00:${i+1}`;lines[id]={id,speaker:'我（心声）',text:m[1],runtimeText:'此句属于R00准备稿，尚未替换现片',kind:'inner',receiver:'无',direction:'画外心声；手机屏内与画面中的NPC均不代说',source:'R00本地现代段改稿'};return id;});
  const prepared=[{code:'R00',name:'开场现代段 · 三句简短心声',duration:20,lineIds:revisedOpeningLines,problem:'现片仍保留旧现代段；这里单独编辑R00改稿，不混作现片转录。',fix:'保留古代前段；现代段只拍同一深夜工位的放下、停手和拿起手机。',edit:'20秒准备稿尚无新成片。前接灭灯，后接SC03醒来。'},...plans.map(p=>({...p,lineIds:p.shots.flatMap((s,i)=>{const id=`prepared:${p.code}:action:${i+1}`;lines[id]={id,speaker:'演出',text:s.action,runtimeText:s.action,kind:'action',receiver:'无',direction:`${s.start}—${s.end}秒；${s.camera}`,source:`${p.code}分镜${i+1}`};return[id,...s.rows];})}))];
  for(const p of prepared){const id=`prepared:${p.code}`;units[id]={id,title:`${p.code}准备台本 · ${p.name}`,kind:'prepared',lineIds:[...new Set(p.lineIds)],coveredRows:p.lineIds.filter(x=>!x.startsWith('prepared:')),request:p.code,description:'本地准备稿台本，可以编辑；尚未生成新片，不作为现片声音转录。',duration:p.duration,production:{reason:p.problem,proposal:p.fix,cut:p.edit}};}
  units[`video:${clips[0].id}`].proposalLineIds=revisedOpeningLines;
  videos[0].proposalLineIds=revisedOpeningLines;
  function textUnit(rowId,section){const l=lines[rowId];const id=`text:${rowId}`;units[id]={id,title:l.text?.slice(0,25)||rowId,kind:l.kind==='dynamic'?'dynamic':'text',lineIds:[rowId],coveredRows:[rowId],section,scene:sectionByRow.get(rowId)?.scene||'',production:{reason:l.kind==='dynamic'?'AI模式下由运行时回应替换，无AI模式可用默认文案。':'当前由文字或界面承担。',proposal:l.kind==='dynamic'?'保留实时回应；不将默认句误列为缺少固定视频。':'保留文字节点；需要增加演出时再单独讨论。'}};return id;}
  function gate(id,title,lineIds,description,choices){units[id]={id,title,kind:'gate',lineIds,coveredRows:lineIds,description,choices};return id;}
  gate('gate:choice','首轮选择：向斥候怎么问？',['A-23','A-23B'],'这里只播放所选回答；两条分支汇合后再去迎魏延。',[{label:'营门失守了？',branch:'A'},{label:'不行，今晚谁都不能进',branch:'B'}]);
  gate('gate:ai-first','第一次向魏延解释',['R1-LANG','R1-REPAIR','A-40'],'游戏在此等待玩家确认发言，再由NPC判断。本工作台只预览剧情，不调用AI、不替玩家作答。');
  gate('gate:investigate','回溯调查：甲、乙任选先后',[],'两人的交谈都结束后才去问斥候；更换顺序不会重复播放另一条互斥剧情。',[{label:'先问甲，再问乙',investigation:'guard-first'},{label:'先问乙，再问甲',investigation:'relay-first'}]);
  gate('gate:thoughts','思绪画布：先推理，再行动',['P1-Q1','P1-Q2'],'本轮依据充分后才能提出接报安排；工作台展示问题，不自动生成推理答案。');
  gate('gate:ai-second','第二次向魏延说明接报安排',['P2-01','P2-SAY','P2-F1'],'姜维已答应且亲兵同行后，才进入这轮表达。下面按成功路线审片，不表示实际AI判断已通过。');
  const sections=Object.fromEntries(flow.sections.map(s=>[s.id,s]));
  function sectionUnits(id,branch){const section=sections[id],out=[],seen=new Set();for(const rowId of section.rows){let candidates=videos.filter(v=>v.coveredRows.includes(rowId));if(candidates.some(c=>c.clip==='C1FIX06B'))candidates=candidates.filter(c=>branch==='B'?c.clip==='C1FIX06B':c.clip!=='C1FIX06B');const v=candidates[0];if(v){if(!seen.has(v.id)){const unit=units[`video:${v.id}`];unit.section=section.title;unit.round=section.round;out.push(unit.id);seen.add(v.id);}}else if(lines[rowId])out.push(textUnit(rowId,section.title));}return out;}
  function timeline(branch,investigation){const out=[];const add=id=>out.push(...sectionUnits(id,branch));out.push(...clips.slice(0,2).map(c=>`video:${c.id}`));add('awakening');add('notice');add('first-scout');out.push('gate:choice');add(branch==='B'?'scout-option-b':'scout-option-a');out.push(textUnit('R1-GO','首轮 · 去迎魏延'));add('first-weiyan');out.push('gate:ai-first');add('first-accepted');add('first-handoff');add('first-night');out.push('video:EN02B-A');add('first-judgment');add('rewind');out.push('gate:investigate');for(const id of investigation==='relay-first'?['relay-investigation','guard-investigation']:['guard-investigation','relay-investigation'])add(id);add('scout-investigation');out.push('gate:thoughts');add('jiang-commitment');add('weiyan-approach');out.push('gate:ai-second');add('weiyan-cooperation');add('formal-report');add('order-delivery');add('after-report');out.push('video:ending-en01-20261016','video:EN03-EN04');return out;}
  const routes=[];for(const branch of['A','B'])for(const investigation of['guard-first','relay-first'])routes.push({id:`${branch}:${investigation}`,branch,investigation,title:`首轮${branch==='A'?'问营门':'坚持禁令'} · ${investigation==='guard-first'?'先甲后乙':'先乙后甲'}`,unitIds:timeline(branch,investigation)});
  const dynamicRows=['R1-FAIL-EXECUTION','A-40','A-40B','P2-SAY','R2-FAIL-EXECUTION','P2-F1','W07'];
  const interactions=Object.values(lines).filter(l=>!l.archived&&!videos.some(v=>v.lineIds.includes(l.id))&&!Object.values(units).some(u=>u.lineIds?.includes(l.id)));
  for(const l of interactions)textUnit(l.id,'交互文案与反馈');
  const tentSource=fs.readFileSync(path.join(root,'GameStarter/web-demo/src/chapters/chapter-one/tent-visit.ts'),'utf8');
  const itemSource=fs.readFileSync(path.join(root,'GameStarter/web-demo/src/inventory/world-items.ts'),'utf8');
  const unescape=s=>s.replace(/\\([nrt'\\])/g,(_,c)=>({n:'\n',r:'\r',t:'\t',"'":"'",'\\':'\\'}[c]));
  const optional=[];
  for(const key of ['cough','side','footsteps','caught']){const raw=tentSource.match(new RegExp(`${key}: '((?:\\\\.|[^'\\\\])*)'`));if(!raw)throw Error(`Missing tent text ${key}`);optional.push({id:`optional:tent:${key}`,text:unescape(raw[1]),speaker:'旁支界面文字',title:`帐外偷听 · ${{cough:'帐内咳嗽',side:'绕到侧面',footsteps:'脚步声',caught:'被巡营军士发现'}[key]}`,condition:'查看告示后可在中军帐前倾听；继续绕行会进入被发现的旁支，不能当作主线必经剧情。'});}
  for(const [id,title] of [['jiang-headscarf','姜维赠予头巾'],['worn-wine-cup','拾取破旧酒杯']]){const block=itemSource.slice(itemSource.indexOf(`id: '${id}'`)).split('},')[0];const raw=block.match(/receipt: '((?:\\.|[^'\\])*)'/);if(!raw)throw Error(`Missing item receipt ${id}`);optional.push({id:`optional:${id}`,title,text:unescape(raw[1]),speaker:'物品获取界面',condition:id==='jiang-headscarf'?'物品功能开启且读完姜维接报承诺段后获得；不作为通关前提。':'回溯后可在营地野草亮光处拾取；可选行为，不作为通关前提。'});}
  for(const o of optional){lines[o.id]={id:o.id,speaker:o.speaker,text:o.text,runtimeText:o.text,kind:'ui',receiver:'无',direction:'当前为可选文字界面；本条混有叙述或引语，不直接整段录音。',humanCondition:o.condition,source:o.id.includes('tent:')?'程序tent-visit.ts':'程序world-items.ts'};units[o.id]={id:o.id,title:o.title,kind:'text',lineIds:[o.id],coveredRows:[],section:'可选旁支与物品',description:o.condition,production:{reason:'现用程序的可选文字内容，不在飞书逐句执行表中。',proposal:'保留可选文字呈现，不新增强制视频或通关条件。'}};}
  const differences=online.rows.flatMap(r=>{const current=script.rows.find(x=>x.id===r.id);return['speaker','text','humanCondition','transition'].filter(k=>r[k]!==current[k]).map(k=>({id:r.id,field:k,online:r[k],runtime:current[k]}));});
  const findings=[
    {id:'F01',title:'开篇现代段需要与R00改稿重新对齐',detail:'现片仍是原版经历段。R00的三句简短心声只属于准备稿，应先审核台词与画面衔接，再替换现代后半段。',unitId:`video:${clips[0].id}`,level:'需要改稿'},
    {id:'F02',title:'首轮两个回答与两种转呈必须成对预览',detail:'询问营门走A-23/A-24，并可说“营门未破”；坚持禁令走A-23B/A-24B，转呈使用C1FIX06B，省略该句。两组视频不能混播。',unitId:'gate:choice',level:'分支约束'},
    {id:'F03',title:'甲、乙的调查顺序自由，敌情调查须在两者之后',detail:'素材目录顺序不是剧情顺序。工作台提供两种调查顺序，均在问完甲乙后进入斥候段。',unitId:'gate:investigate',level:'顺序已整理'},
    {id:'F04',title:'两轮魏延交涉保留互动停点，接受句不是固定缺片',detail:'程序session.ts会用实际NPC回复替换A-40B和W07。它们虽然看似固定对白，也不能直接列成必须补拍的缺片。玩家自由发言和AI反馈保留文字/实时呈现。',unitId:'gate:ai-first',level:'不固定录制'},
    {id:'F05',title:'画面动作、告示、结算和AI说明分开编辑',detail:'J08E低咳、J14同行、W03转头、W08/W09带路、E04/E04C接报均按动作处理；告示无对应人声时不加旁白。角色名、导演说明、【AI润色】不进入录音台词。',unitId:'video:C1T18-report-20261024',level:'台本边界'},
    {id:'F06',title:'在线稿与程序有4条AI回应文本差异、5条历史反馈',detail:'在线逐句执行第271版与本地逐条比较，差异集中在AI回应意图与示例。程序仍保留5条在线已无的P2历史反馈，本轮单独列出，不加入主线连播，也不擅自删除程序。',unitId:'gate:ai-second',level:'来源差异'},
    {id:'F07',title:'已有13条重拍准备稿，对应15段现用片',detail:'R00改现代段，R01—R12处理空间和人物连续性；其中R07、R09各跨两个现用节点。准备稿不等于已通过或已生成，拆段与原确认点仍须保留。',unitId:'video:C1T14-request-20261024',level:'待审核'},
    {id:'F08',title:'本轮文字review不能代替逐片听审',detail:'核对了在线策划、本地流程、视频绑定、字幕与已有连续性记录。字幕可辅助对字，人物声线、口型和精确剪接仍需在审片台实际观看确认。',unitId:'video:EN03-EN04',level:'审阅范围'}
  ];
  const draftSource={script:hash(script),flow:hash(flow),online:hash(online.rows),lines:hash(lines),prepared:hash({plans,openingRevision}),optional:hash({tentSource,itemSource}),clips:clips.map(c=>[c.id,c.version])};
  return{version:2,baseHash:hash(draftSource),source:{url:online.url,revision:online.revision,fetchedAt:online.fetchedAt,onlineRows:online.rows.length,runtimeRows:script.rows.length,archivedRows:online.missingRuntimeRows,differences},lines,units,routes,videos,findings,dynamicRows,stats:{videos:videos.length,productionRequests:new Set(videos.map(v=>v.request).filter(Boolean)).size,affectedVideos:videos.filter(v=>v.request).length,activeRows:online.rows.length,optionalTexts:optional.length,subtitleOnlyRows:Object.keys(lines).filter(k=>k.startsWith('vtt:')).length},scope:'第一章主流程与两个互斥首轮选择；主线预览按两轮交涉成功继续，失败/重试保留为动态交互文案。帐外偷听与两处物品获取在全部台本中另列。手机的实时问答、采购和动态物品分支不虚构成固定章表对白。'};
}
