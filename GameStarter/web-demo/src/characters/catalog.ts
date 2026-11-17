export type CharacterProfile = {
    id: string; name: string; role: string; history: string; game: string;
    sources?: { kind: '史书记载' | '演义描写'; title: string; url: string; note: string }[];
};
const fictional = '本作虚构人物，用来呈现军营中普通人的职责与处境，没有对应的个人史传。';
const supporting = (id: string, name: string, role: string, game: string): CharacterProfile => ({ id, name, role, history: fictional, game });
export const characters: CharacterProfile[] = [
    { id: 'masu', name: '马谡', role: '街亭主将', history: '本章取材于《三国演义》第九十五回的街亭故事，人物对白、分兵变化与结局由本作改编。', game: '想借街亭打一场漂亮的胜仗。他希望魏军攻山，再趁敌疲惫向下出击；劝他分兵，需要说清这批人怎样帮他把仗打好。', sources: [{ kind: '演义描写', title: '《三国演义》第九十五回', url: 'https://zh.wikisource.org/wiki/三國演義/第095回', note: '本章沿用马谡、王平在街亭对部署意见不同的故事背景。' }] },
    { id: 'wangping', name: '王平', role: '街亭山下守将', history: '本章取材于《三国演义》第九十五回的街亭故事，人物对白、接应安排与结局由本作改编。', game: '首先要守住道路，让魏军过不去。他负责山下的阵地和接应，也会把实际困难回报给马谡。', sources: [{ kind: '演义描写', title: '《三国演义》第九十五回', url: 'https://zh.wikisource.org/wiki/三國演義/第095回', note: '马谡、王平的分兵场景采用演义背景，不把不同史料中的兵数混作同一事实。' }] },
    supporting('jieting-clerk', '军吏', '街亭军中文书', '核对探报、记下命令，也会提醒我把亲眼所见与猜测分开。'),
    supporting('jieting-scout', '探马', '街亭探报军士', '来往山路探看魏军动向。他看见了什么、哪些地方没看清，都得当面问明白。'),
    supporting('jieting-water', '取水军士', '街亭取水队军士', '和我一起往山上挑水。水桶有多重、哪条路走不通，都是他每天要面对的事。'),
    supporting('jieting-mover', '搬营军士', '街亭搬营军士', '忙着把营帐和粮袋搬上山。山路能走多快、搬营要花多少工夫，他比我更有体会。'),
    supporting('jieting-messenger', '传令军士', '街亭往返传令', '来回山上山下，带来王平的回话，也把两边的军令交到领队手中。'),
    supporting('jieting-leader', '领队军士', '街亭调兵领队', '带兵下山、清点到营人数，并按军令安排各队去处。下山不只是赶路，还得把人带齐、重新列阵。'),
    { id: 'zhugeliang', name: '诸葛亮', role: '蜀汉丞相', history: "字孔明，蜀汉丞相。受托辅政，主持北伐，史书称其赏罚分明。《三国演义》又写他在五丈原禳星延寿，病中仍日理军机。", game: '北伐军的统帅。他的安危牵动整座军营；我能接触到的，往往是帐外的禁令、军报和等待通传的人。', sources: [{"kind": "史书记载", "title": "《三国志》卷三十五·诸葛亮传", "url": "https://zh.wikisource.org/wiki/三國志/卷35", "note": "受托辅政、北伐与赏罚分明，见本传及陈寿评。"}, {"kind": "演义描写", "title": "《三国演义》第一百零三回", "url": "https://zh.wikisource.org/wiki/三國演義/第103回", "note": "五丈原禳星、帐中设灯，嘱咐闲杂人等不得入内。"}] },
    { id: 'weiyan', name: '魏延', role: '蜀汉将军', history: "字文长。曾镇守汉中，随诸葛亮北伐。史书写他勇猛、善养士卒，也性情矜高。《三国演义》中，他为急报魏兵到来而闯入禳星之帐。", game: '带着紧急军情来到帐前的将军。他要的是能把军报送到的办法，而我必须在他的急切与守帐的禁令之间找到一条路。', sources: [{"kind": "史书记载", "title": "《三国志》卷四十·魏延传", "url": "https://zh.wikisource.org/wiki/三國志/卷40#魏延", "note": "镇守汉中、北伐战功，以及勇猛、善养士卒而性情矜高的记载。"}, {"kind": "演义描写", "title": "《三国演义》第一百零三回", "url": "https://zh.wikisource.org/wiki/三國演義/第103回", "note": "魏延飞步入帐报魏兵至，脚步急促，误扑灭主灯。"}] },
    { id: 'jiangwei', name: '姜维', role: '蜀汉将军', history: "字伯约，天水冀县人。由魏归蜀，受到诸葛亮器重。《三国演义》写孔明识其将才、欲传所学；五丈原禳星时，由他在帐外守护。", game: '军务传报链中的将军。见到他、向他说明来意，是两件不同的事；他是否接报，须以眼前的实际答复为准。', sources: [{"kind": "史书记载", "title": "《三国志》卷四十四·姜维传", "url": "https://zh.wikisource.org/wiki/三國志/卷44#姜維", "note": "归蜀经过，以及诸葛亮称许其忠勤、有胆义、深解兵意。"}, {"kind": "演义描写", "title": "《三国演义》第九十三回", "url": "https://zh.wikisource.org/wiki/三國演義/第093回", "note": "姜维归降孔明，孔明赏识其才，表示愿传平生所学。"}, {"kind": "演义描写", "title": "《三国演义》第一百零三回", "url": "https://zh.wikisource.org/wiki/三國演義/第103回", "note": "姜维提出祈禳之法，并奉命率甲士在帐外守护。"}] },
    supporting('guard', '守帐军士（甲）', '中军帐前守卒', '与我一同守帐的军士，熟悉帐前的禁令。身处传报链的一环，他也有自己的职责与顾虑。'),
    supporting('relay', '传报军士（乙）', '军中传报军士', '熟悉当值与通传安排的军士。与他交谈，可以了解军营里消息应当怎样往上送。'),
    supporting('scout', '斥候', '前线探报军士', '从营前带回军情的人。他说的是自己探得的动静，如何判断这些消息，还需要结合其他见闻。'),
    supporting('jiangwei_guard', '亲兵', '姜维帐前亲兵', '负责帐前通传与引路。能替我传话、带路，但不能替将军作出承诺。'),
    { id: 'gouan', name: '苟安', role: '运粮都尉', history: "人物原型出自《三国演义》：李严遣他押送军粮，因迟粮受罚。本作沿用这一演义背景，并改编他的处境与选择。", game: '山路上拉住我的运粮队长，如今在帐中养伤。他救过我，也有难以启齿的委屈与顾虑；眼前发生了什么，需要我亲自去问、去查。', sources: [{"kind": "演义描写", "title": "《三国演义》第一百回", "url": "https://zh.wikisource.org/wiki/三國演義/第100回", "note": "李严遣苟安送粮；苟安因迟粮十日受杖责。此处依据小说人物，不作正史记载。"}] },
    { id: 'liyan', name: '李严', role: '蜀汉重臣 · 粮运调度', history: "字正方，后改名李平。与诸葛亮同受托孤，参与北伐粮运；史书载其因粮运与奏报问题被废。《三国演义》也写到他遣苟安送粮。", game: '身处粮运调度上层的人。他与苟安的往来牵涉军粮和各自的处境；本作对动机、私下交谈与选择作了改编。', sources: [{"kind": "史书记载", "title": "《三国志》卷四十·李严传", "url": "https://zh.wikisource.org/wiki/三國志/卷40#李嚴", "note": "受托辅政、督运军粮，以及粮运失继、奏报前后矛盾而被废的经过。"}, {"kind": "演义描写", "title": "《三国演义》第一百回", "url": "https://zh.wikisource.org/wiki/三國演義/第100回", "note": "李严从永安遣都尉苟安送粮，是本作两人粮运关系的演义来源。"}] },
    supporting('grain-officer', '粮队管事', '粮队交接与事务管理', '管理粮队的交接与出行事务。查阅材料和离营，都需要经过实际许可。'),
    supporting('warehouse-clerk', '仓吏', '仓中收发登记', '守着仓中的收发记录，知道哪些材料可以查阅。账面上的应交数和真正发出的粮，要在他的记录中逐项核对。'),
    supporting('frontline-receiver', '前线接收人', '本队军粮接收', '核对送到本队的粮与签收记录，把领取前的缺额和领取后的损耗分开说明。'),
    supporting('local-levy-handler', '地方经手人', '地方粮食征收', '经手地方征粮事务，熟悉征收要求与实际收取之间的差别。'),
    supporting('transport-handler', '仓中经手人', '粮食交接经办', '亲历粮食与文书的交接。核对报告、签认与送达时间时，他能说明自己经手的部分。'),
    supporting('old-woman', '老妇人', '村中百姓', '生活在征粮所及的村落。她手边的粮，既是军需的一部分，也关乎一家人的日子。'),
    supporting('military-clerk', '军吏', '军中文书与收件', '负责核收材料、说明呈报与查办的程序。收下材料不等于答应免责，裁处仍须依据事实。'),
];
export const profileById = (id: string) => characters.find(person => person.id === id);
