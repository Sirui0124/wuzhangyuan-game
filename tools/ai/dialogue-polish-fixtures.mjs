import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function polishFixtures(build='outputs/dialogue-polish-20261027/build'){
 const imp=p=>import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/'+p+'.js')));
 const read=p=>JSON.parse(readFileSync(resolve(build,'story/'+p)));
 const {GrainSession}=await imp('chapters/chapter-two/session'),{fixedJudgment}=await imp('chapters/chapter-two/film-dialogue');
 const {grainPolishInput}=await imp('chapters/chapter-two/polish');
 const {createJietingPlaytest}=await imp('chapters/chapter-three/session'),{jietingPolishInput}=await imp('chapters/chapter-three/polish');
 const results=[];
 for(const round of ['O1','O2']){
  const s=new GrainSession(read('chapter-two.films.json'),undefined,read('chapter-two.films-rubric.json'),false);
  for(let i=0;i<200&&!(s.current.kind==='open'&&s.current.round===round);i++){if(s.current.kind==='open')s.submit(fixedJudgment(s.current.round,0,s.currentRubric).judgment);if(!s.advance(s.current.options?.[0]?.id))throw Error('grain fixture stuck '+s.current.id);}
  const wanted=round==='O1'?['LY-X04','LY-X06']:['LY-M06','LY-M07','LY-M08','LY-C11','LY-C12','LY-C14'];
  s.state.selected=s.clues.filter(c=>wanted.includes(c.id)).map(c=>c.id);
  s.state.draft=round==='O1'?'你先留下。我去核对记录，查清后如实报，也把结果带回来告诉你。':'我想帮你。先停下还没做的计划，把粮情和各人的责任如实写清，原件都附上。我陪你送报、确认收到，但不能保你免罪。';
  results.push({id:'gouan-'+round,chapter:'grain',session:s,input:grainPolishInput(s)});
 }
 const story=read('chapter-three.story.json');
 for(const id of ['JT-OPEN-R1','JT-OPEN-R2','JT-OPEN-R3','JT-OPEN-R4','JT-OPEN-R5','JT-OPEN-WITHDRAW','JT-OPEN-LURE']){
  const kind=id.includes('WITHDRAW')?'withdrawal':id.includes('LURE')?'lure':'reinforcement';
  const s=createJietingPlaytest(story,kind,{aiEnabled:false,phoneAllowed:false});
  if(id==='JT-OPEN-R2'||id==='JT-OPEN-R3'){
   const target=id==='JT-OPEN-R2'?'JT-R2-FIXED':'JT-R3-FIXED';
   for(let i=0;i<200&&s.current.id!==target;i++){let o=s.options?.find(o=>['JT-O132','JT-O167'].includes(o.id))??s.options?.[0];if(!s.advance(o?.id))throw Error('jieting fixture stuck '+s.current.id);}
  }
  if(id==='JT-OPEN-R4'||id==='JT-OPEN-R5'){
   const target=id==='JT-OPEN-R4'?'JT-R4-FIXED':'JT-R5-FIXED';
   const picks={'JT-R1-FIXED':'JT-O133','JT-R2-FIXED':'JT-O168','JT-R3-FIXED':'JT-O199','JT-R4-FIXED':'r4-none'};
   for(let i=0;i<250&&s.current.id!==target;i++)if(!s.advance(s.current.kind==='choice'?picks[s.current.id]:undefined))throw Error('extra jieting fixture stuck '+s.current.id);
  }
  s.setMode({aiEnabled:true,phoneAllowed:false});s.state.node=id;
  const ids=id==='JT-OPEN-R1'?['JT-C02','JT-C04','JT-C08']:id==='JT-OPEN-R2'?['JT-C03','JT-C04','JT-C05','JT-C08']:id==='JT-OPEN-R3'?['JT-C06','JT-C08','JT-C09']:id.includes('WITHDRAW')?['JT-C03','JT-C05','JT-C06','JT-C08','JT-C10','JT-C12']:['JT-C07','JT-C09','JT-C10','JT-C11','JT-C12'];
  s.state.selected=s.clues.filter(c=>c.current!==false&&ids.includes(c.id)).map(c=>c.id);
  s.state.draft=id==='JT-OPEN-R1'?'请增兵分守正面与侧路，别等告急才下山。':id==='JT-OPEN-R2'?'前一趟守路的人继续守路，请再拨一部提前护住水路，别等出事后才下山。':id==='JT-OPEN-R3'?'请再拨一部提前下山接应，让前面守路护水的人有退路，也能相互照应。':id.includes('WITHDRAW')?'请将军带兵趁路还能走时下山，分批下去，让王平安排接应和掩护，山上留人殿后，别全挤在山道上。':'请以山下营中现有旗帜和人手装作准备撤营，诱敌离开原处；王平带兵接应。派出的人不追远，敌人近前才合击；若敌人不来，便收旗退回营内，不冒险硬攻。';
  if(id==='JT-OPEN-R4'||id==='JT-OPEN-R5'){
   const wanted=id==='JT-OPEN-R4'?['JT-C01','JT-C04','JT-C06']:['JT-C02','JT-C06','JT-C11','JT-C12'];
   s.state.selected=s.clues.filter(c=>c.current!==false&&wanted.includes(c.id)).map(c=>c.id);
   s.state.draft=id==='JT-OPEN-R4'?'丞相要守住要道，请把下面两处的人手补齐，王将军带队，进退仍听您的令。':'敌军两次都没来攻山，请先派一队在坡脚候命，由王将军带着接应，何时出击仍听您的令。';
  }
  results.push({id,chapter:'jieting',session:s,input:jietingPolishInput(s)});
 }
 return results;
}
