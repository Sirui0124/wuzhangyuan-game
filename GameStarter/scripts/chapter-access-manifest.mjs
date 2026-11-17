import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
/** Derive migration evidence from actual authored nodes, rather than a second plot graph. */
export function writeChapterAccess(workspace, destination) {
 const read = path => JSON.parse(readFileSync(resolve(workspace,path),'utf8'));
 const grain = read('content/chapters/grain/chapter-two.films.json');
 const oldGrain = read('content/chapters/grain/chapter-two.playable.json');
 const jieting = read('content/chapters/jieting/chapter-three.story.json');
 // Retain completed legacy-save access without shipping the retired story.
 const yilingCompletedNodes = ['YL-END-COMPLETE', 'YL-END-STOP'];
 const pangtong = read('content/chapters/luofengpo/chapter-seven.story.json');
 const sources = [
  {id:'wuzhang',title:'第一章·五丈原',saveKey:'wuzhang-chapter-session-v1',format:'first',collectionKey:'wuzhang-chapter-endings-v2',successEndings:['safe','radio-relay','light-signal','item-plan'],nodes:[],successNodes:[]},
  {id:'grain',title:'第二章·祁山',saveKey:'grain-chapter-two-films-v1',format:'graph',completedKey:'grain-chapter-two-completed-v1',successEndings:[],nodes:[...new Set([...grain.nodes,...oldGrain.nodes].map(n=>n.id))],successNodes:grain.nodes.filter(n=>n.kind==='finish').map(n=>n.id)},
  {id:'jieting',title:'第三章·街亭',saveKey:'jieting-chapter-three-v1',format:'graph',completedKey:'jieting-chapter-three-completed-v1',collectionKey:'jieting-chapter-three-v1:endings',successEndings:jieting.endings.filter(e=>e.success).map(e=>e.id),nodes:jieting.nodes.map(n=>n.id),successNodes:jieting.nodes.filter(n=>n.kind==='ending'&&jieting.endings.some(e=>e.id===n.ending&&e.success)).map(n=>n.id)},
  {id:'yiling',title:'第四章·夷陵',saveKey:'yiling-chapter-four-v1',format:'yiling',completedKey:'yiling-chapter-four-completed-v1',successEndings:[],nodes:['YL-ARRIVE',...yilingCompletedNodes],successNodes:yilingCompletedNodes},
  {id:'jingzhou',title:'第五章·荆州',saveKey:'jingzhou-chapter-five-v1',format:'jingzhou',successEndings:[],nodes:[],successNodes:[]},
  {id:'luofengpo',title:'第七章·庞统',saveKey:'luofengpo-chapter-seven-v1',format:'yiling',successEndings:pangtong.endings.filter(e=>e.kind==='complete').map(e=>e.id),nodes:pangtong.nodes.map(n=>n.id),successNodes:pangtong.nodes.filter(n=>n.kind==='ending'&&pangtong.endings.some(e=>e.id===n.ending&&e.kind==='complete')).map(n=>n.id)},
 ];
 writeFileSync(resolve(destination,'story/chapter-access.json'),JSON.stringify(sources));
}
