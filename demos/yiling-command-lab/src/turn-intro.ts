import type {Route} from './turn-story.js';
export const INTRO:Record<Route,{title:string;place:string;focus:string;beats:{speaker:string;text:string}[]}>={
 fu:{title:'队尾未归',place:'傅肜 · 东路初报',focus:'35%',beats:[
  {speaker:'',text:'报信兵在我面前站住，又回头望向隘口。远处的担架还在往前走，后阵却迟迟没有退下来的旗。'},
  {speaker:'传令兵',text:'傅将军让前头的人先走，自己还守着后阵。我来时，他只问了一句：隘口有没有人接队尾？'},
  {speaker:'我',text:'去接他的人，也得有路回来。把后阵和隘口的情形说清楚。'}]},
 feng:{title:'旗还在旧营',place:'冯习·张南 · 南岸初报',focus:'39%',beats:[
  {speaker:'',text:'军吏抱着一卷名册，手指一直压在绳结上。身后有人催车，车轮却停在原处。'},
  {speaker:'军吏',text:'冯将军的旗还在旧营，散兵都往旗底下挤。张将军的前部正在退，两边撞在营口，走不了。'},
  {speaker:'我',text:'先别催他们往前冲。军旗能挪到哪里，侧路又堵着什么？'}]},
 sha:{title:'山沟里还有人',place:'沙摩柯 · 山林初报',focus:'60%',beats:[
  {speaker:'',text:'向导拄着木杖，站在林边等我。说起沙摩柯，他伸手指向树后的两条岔路。'},
  {speaker:'向导',text:'两条沟里都还有我们的人。路我认得，可出口得有人接住。不然前头才出来，后头就又散了。'},
  {speaker:'我',text:'先把两边的路说清。找到他们以后，从哪里出来，谁守着接？'}]}
};
