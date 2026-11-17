import type { JietingSession } from './session';
import type { DialoguePolishInput } from '../../dialogue-polish';
export const jietingPolishDirections: Record<string,string> = {
    'JT-OPEN-R1':'版本 jieting-reinforcement-1-v2。首次向马谡争取增兵，先用所选实情说明哪里存在尚未解决的需要，再接上玩家本次已提出的新增兵力用途。玩家只请求分守正面与侧路时，保留这个用途，不额外增加接应或护水任务；提到下山列阵费时，是支持提前派兵的理由，不等于玩家另提了接应任务。玩家自己明确提出其他用途时照常保留，不限定题目顺序。建议是请将领批准，不能自称已调兵。让缺口与本次用途对应，别只写山下危险。',
    'JT-OPEN-R2':'版本 jieting-reinforcement-2-v2。再次争取增兵，先分清已经执行的旧安排与玩家本次提出的新用途。若原话要求旧队继续守路、新队提前护水，新增部队就只承担护水；正面侧路都需设防是不能抽走旧队的理由，不能因此给新队再添守路任务。此前对图、核准与送报都是已经完成的事，作为眼前判断的依据，不改成玩家接下来又要去做的差事。玩家本次若另有明确用途则忠实保留，不固定解法。结合当前未解决的需要说明为何现在增兵，不重复申请已到营的人，也不把尚未执行的建议写成已执行。',
    'JT-OPEN-R3':'版本 jieting-reinforcement-3-v1。第三次进言，在已有安排上说明还缺什么。敌人未攻山只支持对其动向的判断，不能保证以后不攻；既有路、水、接应安排能继续用时自然接续。所选材料足以解释新增用途时说具体，不因是第三轮就换一套无关理由。',
    'JT-OPEN-R4':'版本 jieting-reinforcement-4-v1。继续接着前面的调兵商议，只整理玩家这一次提出的新用途或针对旧顾虑的补充。守街亭的军令可以解释为什么应保住要道，但不能写成丞相已经下达新的撤兵令；不靠抬出丞相身份逼马谡。材料不足就保留疑问，不替玩家补全未说出的理由。',
    'JT-OPEN-R5':'版本 jieting-reinforcement-5-v1。马谡还在犹豫是否留兵等敌攻山，玩家还有最后一次进言。根据所选现有军情说明当前建议怎样保住战机，承认马谡的统将身份；不靠空泛奉承，不承诺魏军必会上钩，不重复申请已经派下山的队伍。玩家另有合理用途也须保留，不限于战机。',
    'JT-OPEN-WITHDRAW':'版本 jieting-withdrawal-v4。马谡仍在商议下山办法，眼前问谁挡敌、怎样免得山道拥堵；不能写成他已经决定撤军。把选中资料中当前的用水、敌情、已有兵力与旧岗位、通路和指挥关系，合并成请求分批撤下的理由。已到营的人与旧任务用于说明现有接应条件，不逐次背增兵账，不自动给旧队或新队加任务。对图和送报是已完成事实。王平当前回报通路仍通、坡脚可接队伍，可以据此请求安排，不能反写为路线尚未核实。下山行进列阵耗时只支持可能迟援，不能说再动必迟。接应、掩护、殿后及撤军范围按玩家原话保留，仍由马谡决定和发令。',
    'JT-OPEN-LURE':'版本 jieting-lure-v2。商议诱敌，先用选中军情说明当前为什么可作这个尝试，再接上玩家本次提出的装撤、接应、合击与收手安排。旗动被观察只支持可能引起敌军注意；取水遭箭与两报未见攻山如已选中，应简短说明眼前敌情，不能漏掉或改成敌人必来。当前已有兵力与守路、护水、接应岗位是可用背景，可以合并一句，不复述逐轮增兵账，也不把这些旧岗位全派给本次出击队。通路仍通和坡脚可接应是撤回的实际条件，应与退出办法接起来。玩家已说的不追远、何时合击、敌不来就收手都要保留；不能脑补旗帜、人手、器具效果或新调令，不为了短删掉退路。',
};

type OwnedClue = ReturnType<JietingSession['getEvaluationContext']>['ownedClues'][number];
function polishEvidence(s: JietingSession, clue: OwnedClue): DialoguePolishInput['evidence'][number] {
    const detail = s.clues.find(item => item.id === clue.id)!;
    const sourceNodes = new Set(detail.sources.map(source => source.node));
    const cores: Record<string, string> = {
        'JT-C01': sourceNodes.has('JT-WANG-CAMP-ORDER')
            ? '丞相命营寨扎在山下要道，不能让魏军绕过去。' : '丞相命守住街亭，不能让魏军通过。',
        'JT-C02': '马谡打算借山势，等魏军攻山疲惫后再向下出击。',
        'JT-C03': '山营用水仍须从山下挑运。',
        'JT-C04': '正面道路与侧路都需设防，不能只守一处。',
        'JT-C05': sourceNodes.has('JT-100') ? '我已参与核对敌骑位置与探马归途，并将核准位置报给两位将军。'
            : sourceNodes.has('JT-092') ? '军吏与探马已核准游骑位置，传令军士已把补报送到两将处。'
            : '侧路外有敌骑探路，尚未冲阵，后续兵力不明。',
        'JT-C06': '王平带领下山部队，进退仍由马谡下令。',
        'JT-C07': '我军挪旗时敌骑曾停下观察，坡上营旗与人员走动能被对面看见。',
        'JT-C08': '部队下山需要行进，到山下还须重新列阵，都要花时间。',
        'JT-C09': '敌骑沿路放箭逼退取水队，水源未被占毁。',
        'JT-C11': '前后两次军报都未见魏军攻山。',
        'JT-C12': clue.current === false ? '此前回报下山通路仍通、坡脚有接应位置；这份回报现已过时。'
            : '目前下山通路仍通，坡脚有接应位置。',
    };
    if (clue.id === 'JT-C10') {
        const tasks = [...new Set(Object.values(s.state.roundResults).filter(record => record?.arrived && record.troops > 0).flatMap(record => record!.tasks))];
        const names = tasks.map(task => ({ road: '守路', water: '护水', reception: '接应' })[task]);
        cores[clue.id] = `山下现已到营${s.below}人${names.length ? `，${names.join('、')}已有实际安排` : ''}。`;
    }
    return { id: clue.id, text: cores[clue.id] ?? clue.text, current: clue.current,
        sources: [{ speaker: '已获得线索的完整记录', text: clue.text },
            ...detail.sources.map(source => ({ speaker: source.speaker, text: source.text }))] };
}

export function jietingPolishInput(s:JietingSession):DialoguePolishInput {
    const direction=jietingPolishDirections[s.current.id];if(!direction)throw new Error('当前对话尚未配置专属润色。');
    const c=s.getEvaluationContext();
    return {scene:s.current.id,node:s.current.id,listener:'马谡',question:c.unresolvedConcerns.join('；')||c.currentQuestion||s.current.text,words:s.state.draft,
        direction:direction+'压短时，把已有兵力、旧岗位或已核准的回报作为简短前提，直接说明本次还缺什么；不逐项回顾曾怎样查、怎样送报，不加“可作为判断依据”等解释。选中JT-C05时，核对敌骑与探马归途、报给两将这件已完成的事仍需简短带到，不能因它是前情而删掉。continuity中NPC已知的人数不是本次所选材料时不必重复报数。相同用途只请求一次，旧队与新队仍分清；下山耗时写成“告急再下山列阵恐怕迟援”这类风险，不能写“提前护水才来得及”来保证结果。',
        evidence:c.ownedClues.filter(x=>s.state.selected.includes(x.id)).map(x=>polishEvidence(s,x)),
        continuity:{below:c.below,above:c.above,acceptedReasons:c.acceptedReasons,unresolvedConcerns:c.unresolvedConcerns,
            roundResults:Object.values(s.state.roundResults).map(record=>({round:record!.round,troops:record!.troops,ordered:record!.ordered,
                arrived:record!.arrived,reported:record!.reported,tasks:[...record!.tasks]}))}};
}
