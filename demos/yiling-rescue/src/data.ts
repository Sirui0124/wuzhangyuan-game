export type Fact = { id:string; text:string; question:string };
export type Action = { id:string; text:string; fact:string };
export type Route = {id:string;name:string;role:string;place:string;messenger:string;initial:number;growth:number;cost:number;deadline:number;intro:string;facts:Fact[];actions:Action[];failure:string;success:string;core?:boolean;thought?:string;conclusion?:string};
const make=(id:string,name:string,role:string,place:string,messenger:string,initial:number,growth:number,cost:number,deadline:number,intro:string,facts:string[],questions:string[],actions:string[],failure:string,success:string,extra:Partial<Route>={}):Route=>({id,name,role,place,messenger,initial,growth,cost,deadline,intro,facts:facts.map((text,i)=>({id:`${id}-${i}`,text,question:questions[i]})),actions:actions.map((text,i)=>({id:`${id}-a${i}`,text,fact:`${id}-${i}`})),failure,success,...extra});
export const ROUTES:Route[]=[
make('front','张南、冯习','前军突围','东面山口','前军传令兵',78,6,2400,3,'前军还在向旧御营靠拢，吴军已经绕到他们后面。',
['刘备已转向西撤，旧御营无人接应；张南、冯习尚未收到新军令。','西侧山口仍有一条出口，需要一队人先守住，才能让前军通过。','城内吴军可能追出；接应只负责护送撤离，不能转回攻城。'],
['他们为什么还向旧御营走？','哪里能撤？','后面的追兵怎么办？'],
['送达刘备西撤的军令，停止向旧御营靠拢。','派兵守住西侧山口，接前军通过。','接到前军后共同撤离，不回头攻城。'],'前军被两面夹击，张南、冯习战死。','张南、冯习带余部通过山口，随接应队西撤。'),
make('fu','傅肜','断后接替','退军后阵','断后军候',72,5,2000,4,'傅将军还守在后阵，前方的人没有撤完，他不会先走。',
['傅肜正在掩护退军，要先把前方撤离进度送到他手中。','山口有伤兵行动缓慢，需要接应队先护送他们通过。','下一道隘口可以交替掩护，接替到位后傅肜及其余部才一起撤。'],
['他在等谁？','伤兵能走吗？','怎样让断后的人也撤回来？'],
['核实前方撤离进度，送达撤军消息。','先护送伤兵通过山口。','在下一道隘口接替掩护，接回傅肜和断后余部。'],'断后部队耗尽，傅肜拒降战死。','接替部队守住隘口，傅肜带余部撤下，伤兵一同到营。'),
make('huang','黄权','江北孤军','江北营地','江北使者',70,4,3000,6,'江北军仍有组织，但南岸归路断了，黄将军等不到确实的回信。',
['黄权愿意归蜀，顾虑的是整支部队能否回来；不能只接将军本人。','分批渡运需要两岸核对回号，并在南岸明确接收和救护位置。','最后一批掩护部队也要有船；若通道变化，须及时通知对岸停止，不能用空口保证催全军渡江。'],
['黄将军为什么还没动？','两岸怎样接应？','最后一批人怎么撤？'],
['恢复两岸联络，说明接应面向将士全体。','落实回号、分批渡运和南岸接收救护。','留下最后一批的接应船，通道有变及时通知停止。'],'归路未能落实，黄权为部众另寻出路，率部降魏。','两岸接应已落实，黄权组织分批归蜀；后续军报确认余部撤回。',
{core:true,thought:'怎样让黄权相信，将士能按约定一起归蜀？',conclusion:'先落实两岸接收与回号，再明确最后一批的退路；遇到变化就如实通报，不能只承诺接将军本人。'}),
make('sha','沙摩柯','部众失散','南面林口','负伤的部众',76,6,1800,3,'沙摩柯正在林口找失散的人，他不肯丢下部众独自撤走。',
['沙摩柯担心蜀军只顾自己撤退，他要求部众一同脱险。','失散的人最后出现在林口东侧，可以派熟悉部众的人引路，约定西侧集合。','追兵正在压近，接应队要掩护脱离，不能让他单骑回头迎战。'],
['他为什么不跟着撤？','失散的人最后在哪里？','追兵靠近了怎么办？'],
['承诺并安排接应部众，不只救沙摩柯本人。','由熟悉部众的人引路寻找，在西侧集合。','派兵掩护脱离，避免单骑回头迎战。'],'部众未能会合，沙摩柯在突围中战死。','沙摩柯与找回的部众共同脱险，沿约定路线撤离。',
{core:true,thought:'怎样救出沙摩柯，又不让他丢下失散的部众？',conclusion:'派人寻找失散者并约定集合点，另留掩护；让部众一起脱险，沙摩柯才有理由接受合作。'}),
make('ma','马良','联络使者','武陵方向','驿卒',65,4,1600,5,'马侍中外出联络，回营的使者至今没能见到他。',
['马良与外出的联络人员尚未收到撤军消息，必须先派信使寻找。','一位熟悉往来路线的驿卒可以引路，不能凭空认定马良就在主战场。','找到后要护送联络人员一同撤回，沿途留下接应标记。'],
['马良最后在做什么？','谁认识去找他的路？','找到以后怎样接回来？'],
['派信使沿联络路线寻找并送达撤军消息。','让熟悉路线的驿卒带路。','护送联络人员一起撤回，沿途留下接应标记。'],'联络中断，马良在败退中遇害。','马良和联络人员收到军令，沿接应路线脱险。'),
make('cheng','程畿','江上追兵','上游船队','江边船工',70,5,1200,4,'程祭酒的船被追兵赶上，他还在招呼旁边的人一起走。',
['程畿乘船溯江撤退，追兵正在接近，岸上骑兵无法直接接人。','需要熟悉水路的船工带接应船前往，安排船队交替掩护。','伤员和同行者要一起转移，再让程畿登船，不让他单独弃众逃走。'],
['人在岸上还是船上？','怎样接近他的船？','他肯独自先走吗？'],
['调派渡运接应力量前往江上。','由船工引路，船队交替掩护。','先接伤员与同行者，再接程畿一同撤离。'],'船队遭追击，程畿战死江上。','程畿与同行者转入接应船，伤员先行到岸。'),
make('du','杜路、刘宁','穷迫请降','被围营地','散兵军吏',80,5,1800,4,'被围的人开始商议投降，他们已经失去主力消息。',
['杜路、刘宁所部因断粮和失联动摇，需要可信的刘备生还消息。','围营西边有一条窄道，须派人守住出口，引导队伍突围。','他们需要带伤员和部众一起走，不能只要求两名将领自行归队。'],
['他们为什么想投降？','还有什么出路？','要怎样才肯出来？'],
['送达刘备生还与接应的可靠消息。','守住西侧窄道出口，引导突围。','接应伤员和部众共同撤离。'],'营地未能解围，杜路、刘宁率余部降吴。','两将率部从窄道突围，伤员由接应队护送。'),
make('wang','王甫','沿途搜救','秭归方向','失散亲随',62,4,800,5,'秭归方向的退军中有人见过王甫，后来队伍又散了。',
['王甫混在向秭归撤离的队伍中，需要按亲随提供的标记辨认。','沿途伤员拖慢行进，可以安排护送，不能只搜索将领的车马。','接应后要沿已核实的退路撤走，不再向火场深入。'],
['怎样才能认出他的队伍？','路上还有什么人？','找到后往哪里走？'],
['按亲随提供的标记搜寻王甫。','安排护送同行伤员。','沿核实的退路撤走，不深入火场。'],'搜救未能及时抵达，王甫在败退中遇害。','王甫与沿途失散人员到达接应营。'),
make('sun','孙夫人','一封平安信','吴地消息','江边船工',82,3,200,6,'吴地已传陛下死于乱军，孙夫人听到的也可能只有这个消息。',
['孙夫人的危险来自刘备死讯的误传，增派战兵不能代替可靠消息。','送信需要刘备亲署的平安信和能说明身份的信物，营中军吏可代为请领。','商旅熟悉往来道路，须请可信的人送达并带回收信确认；出发不等于送到。'],
['孙夫人听到了什么？','怎样证明陛下确实还活着？','怎样确认信送到了？'],
['明确传递刘备生还的可靠消息。','请领刘备亲署平安信及信物。','托可信商旅送达，取得收信确认。'],'平安信未能及时送达，孙夫人误信死讯而投江（演义支线）。','平安信经可信渠道送达，孙夫人得知刘备生还（演义改写）。')
];
export const BY_ID=Object.fromEntries(ROUTES.map(r=>[r.id,r])) as Record<string,Route>;
export const CAMP=[
 {id:'liu',name:'刘备',role:'御营',routes:['front','ma'],topics:['前军的退路','外出的联络使者'],unlockHour:1,blurb:'张南、冯习还在前军，马良外出联络也未归营。你持我的军令，先问清他们的处境。'},
 {id:'clerk',name:'点名处军吏',role:'点名处',routes:['fu','sha','du','cheng'],topics:['后阵与伤兵','南面失散部众','被围的大营','江上的船队'],unlockHour:1,blurb:'各部的名册都在这里。后阵、南面林口、被围营地，还有江上的船队，都有人没回来。'},
 {id:'attendant',name:'失散亲随',role:'营门',routes:['huang','wang'],topics:['江北的来信','秭归方向的消息'],unlockHour:1,blurb:'我一路打听着退到这里，带回了江北和秭归方向的消息。'},
 {id:'boat',name:'船工',role:'江边',routes:['sun'],topics:['江东传来的消息'],unlockHour:4,blurb:'我刚靠岸，江东那边传的消息，竟与营里全然不同……'}
];
export const INITIAL_TROOPS=2500;
export const REINFORCEMENT=500;
export const TOTAL_TROOPS=5000;
export const ROUNDS=6;
// Designer-only bounds. Later rounds have less reliable execution and more pressure.
export const ROUND_PRESSURE=[
 {efficiency:[.85,1.08],growth:[0,2]},
 {efficiency:[.82,1.05],growth:[0,3]},
 {efficiency:[.78,1.02],growth:[1,4]},
 {efficiency:[.76,1.00],growth:[1,4]},
 {efficiency:[.73,.98],growth:[2,5]},
 {efficiency:[.70,.96],growth:[2,6]}
] as const;
export const CAMP_BRIEFINGS:Record<string,{routes:string[];prompt:string;choices:string[];later:string}[]>={
 liu:[{routes:['front','ma'],prompt:'前军还没撤下来，马良也没有回来。你先接哪一路？',choices:['先接张南、冯习。','先找马良。'],later:'另一路还在查，下轮你再来问我。'}],
 clerk:[
  {routes:['fu','sha'],prompt:'傅肜还在断后，沙摩柯的部众也走散了。先查哪一路？',choices:['先找傅肜，接下断后的将士。','先找沙摩柯和失散的部众。'],later:'另一路还在查，下轮再来问我。'},
  {routes:['du','cheng'],prompt:'杜路、刘宁的营地被围，程畿的船队也落在后头。你先接哪一路？',choices:['先接杜路、刘宁所部。','先派船接程畿。'],later:'另一路的下落，我再去查。下轮你再来。'}
 ],
 attendant:[{routes:['huang','wang'],prompt:'江北来了黄权的使者，往秭归撤的人里也有王甫的消息。先听哪一路？',choices:['先听黄权的消息。','先问王甫的下落。'],later:'另一路的消息，下轮你再来问我。'}],
 boat:[{routes:['sun'],prompt:'吴地传陛下死于乱军，孙夫人怕是也听到了。得赶紧送个信。',choices:['请帮忙给孙夫人报平安。'],later:''}]
};

export type CampOption={id:string;text:string;reply:string;delay:boolean};
export type CampDialogue={prompt:string;options:CampOption[];arrival:string};
export const CAMP_DIALOGUES:Record<string,CampDialogue>={
  "front": {
    "prompt": "张南、冯习还在前军，怕是还不知道我已西撤。你先从哪里查起？",
    "options": [
      {
        "id": "trace",
        "text": "找最后见过他们的传令兵。",
        "reply": "传令兵就在营外。张南、冯习还在往旧御营走，得赶紧把西撤的军令送去。",
        "delay": false
      },
      {
        "id": "roll",
        "text": "先查名册，看前军还缺多少人。",
        "reply": "名册散在各营，我让军吏去查。查齐要些时候，下次军报送来时才能有准信。",
        "delay": true
      }
    ],
    "arrival": "查到了。张南、冯习还在往旧御营走，尚未收到西撤军令。"
  },
  "ma": {
    "prompt": "马良外出联络，至今未归。几封送给他的军书，也还没送到。",
    "options": [
      {
        "id": "camp",
        "text": "先查他是不是已经回营。",
        "reply": "我让人挨营查问，下次军报送来时再报消息。外面的情况还得另找人打听。",
        "delay": true
      },
      {
        "id": "courier",
        "text": "请送军书的驿卒带路去找。",
        "reply": "驿卒认得路。马良和联络的人还没收到撤军消息，先让他带信使去找。",
        "delay": false
      }
    ],
    "arrival": "各营都查过了，马良没有回来。驿卒说，他和联络的人还没收到撤军消息。"
  },
  "fu": {
    "prompt": "伤兵回来了，后阵的旗号却还没见着。不知哪些人仍守在那里。",
    "options": [
      {
        "id": "missing",
        "text": "先按名册清点未归的人。",
        "reply": "我先清点人数，再查谁还在断后。下次军报送来时才能报准。",
        "delay": true
      },
      {
        "id": "rear",
        "text": "问伤兵，是谁在替他们断后？",
        "reply": "是傅肜。他在等前面的人撤完，得先告诉他大家撤到哪儿了。",
        "delay": false
      }
    ],
    "arrival": "问清了，傅肜仍在断后。他得先知道前面撤得怎样，才能安排接替。"
  },
  "sha": {
    "prompt": "南面回来的人听不懂营里的号令，一直望着林口，像是在等谁。",
    "options": [
      {
        "id": "guide",
        "text": "找懂他们话的人来问。",
        "reply": "是沙摩柯的部众。他怕我们丢下族人，不肯独自撤走，得一起接应。",
        "delay": false
      },
      {
        "id": "roster",
        "text": "先把这些人登记入册。",
        "reply": "我先登记，只是名姓对不上，还得找熟悉他们的人。下次军报送来时再报消息。",
        "delay": true
      }
    ],
    "arrival": "问清了，沙摩柯还在找失散的部众。他要大家一起走，不肯独自脱身。"
  },
  "du": {
    "prompt": "东边有一营断了联络。逃回来的人说，营里已经有人在商议投降。",
    "options": [
      {
        "id": "identity",
        "text": "是哪一营？他们遇到了什么难处？",
        "reply": "是杜路、刘宁所部。断粮又失联，他们以为陛下也出事了，得先送去可信的消息。",
        "delay": false
      },
      {
        "id": "loyalty",
        "text": "先查是谁带头说要投降。",
        "reply": "众人各说各话，我再逐个问清。营里的实情，下次军报送来时才能报来。",
        "delay": true
      }
    ],
    "arrival": "查明了，是杜路、刘宁所部。他们断粮失联，急需陛下生还的确切消息。"
  },
  "cheng": {
    "prompt": "江上还有船没跟上，追兵逼得很紧。不知他们上岸了没有。",
    "options": [
      {
        "id": "shore",
        "text": "先沿岸查找，看有没有人上岸。",
        "reply": "我让岸哨去查，还得等各处回信。下次军报送来时再报准信。",
        "delay": true
      },
      {
        "id": "water",
        "text": "找最后见过船队的人问问。",
        "reply": "程畿还在船上，正往上游撤，追兵已逼近。得派船去接，岸上骑兵够不着。",
        "delay": false
      }
    ],
    "arrival": "岸哨回报，程畿还在船上往上游撤，追兵紧跟着。得从水路接应。"
  },
  "huang": {
    "prompt": "江北使者带着旧军书等在营外。他说将士都还在，却迟迟没动身。",
    "options": [
      {
        "id": "motive",
        "text": "是不愿回来，还是渡不过江？",
        "reply": "来使是黄将军派来的。他惦记江北的将士，想带着大家一道回蜀。",
        "delay": false
      },
      {
        "id": "seal",
        "text": "先查验军书，确认来历。",
        "reply": "得找经手的人查验。我替使者留话，下次军报送来时再送详细消息。",
        "delay": true
      }
    ],
    "arrival": "军书核实了。黄权愿意归蜀，但得为全体将士安排退路。"
  },
  "wang": {
    "prompt": "往秭归撤的队伍走散了。我认得他们随行的标记，可以带人去找。",
    "options": [
      {
        "id": "vehicle",
        "text": "先查官员的车马。",
        "reply": "人和车马已经分开。我再去问问随行的人，下次军报送来时一并回你。",
        "delay": true
      },
      {
        "id": "mark",
        "text": "你认得什么标记？按这个去找。",
        "reply": "是王甫随行队伍的标记。他混在往秭归撤的人里，可以照这个辨认。",
        "delay": false
      }
    ],
    "arrival": "查到了，王甫在往秭归撤的队伍里。照亲随给的标记，就能辨认。"
  },
  "sun": {
    "prompt": "吴地竟在传陛下死于乱军。我明明看见御营还在，这可怎么是好？",
    "options": [
      {
        "id": "source",
        "text": "先查这传言是从谁那里来的。",
        "reply": "传话转了好几手，我得挨个打听。下次军报送来时才能有消息。",
        "delay": true
      },
      {
        "id": "recipient",
        "text": "孙夫人会不会听到？得赶紧报平安。",
        "reply": "孙夫人也可能听到了死讯。得赶紧送封平安信，让她知道陛下还活着。",
        "delay": false
      }
    ],
    "arrival": "打听过了，孙夫人也可能信了死讯。得赶紧把陛下生还的消息送到。"
  }
};
export function campReply(id:string,choice:string,lastRound=false):string {
 const option=CAMP_DIALOGUES[id].options.find(o=>o.id===choice)!;
 return lastRound&&option.delay?option.reply.replaceAll('下次军报送来时','天亮后')+'恐怕赶不上今夜的接应了。':option.reply;
}
