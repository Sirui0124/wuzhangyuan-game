import {liveAI} from '../ai.mjs';
import {BY_ID} from '../.build/data.js';
const r=BY_ID.sha;
const data={speaker:r.name,question:'我会派熟悉你部众的人到林口东侧找人，在西侧集合，另派接应队掩护大家一起脱离，不让你单骑回头迎战。请带部众配合撤离。',round:1,history:[],known:r.facts,offered:[],traderRumor:false,persuasionEnabled:true,specificConcerns:r.facts.slice(1).map(f=>f.text),successChecklist:['安排寻找失散部众并约定集合位置。','安排接应队掩护共同撤离，避免单骑回头迎战。'],situation:{risk:76,spent:0,status:'active',outcome:''}};
console.log(JSON.stringify(await liveAI('talk',data,AbortSignal.timeout(60000)),null,2));
