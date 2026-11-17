import type { Ending } from '../../endings';
import type { ItemRoute } from './supplies';
export const supplyEndings: Ending[] = [
    { id: 'item-plan', number: '物品·三', phase: '第一章', result: 'item-plan', title: '另有办法', kind: '物品交涉',
        description: '军报照常完成交接。我的物品与用法说服了魏延，一个不同的办法得以留下。', hint: '让实际持有的东西，支持一个说得清、做得到的办法。' },
    { id: 'radio-relay', number: '物品·一', phase: '第一章', result: 'radio-relay', title: '匣中有军令', kind: '物品交涉',
        description: '军报交接后，两端试通。魏延第一次听见小匣中传来姜维的声音。', hint: '让远处的两个人可以核对同一道军令。' },
    { id: 'light-signal', number: '物品·二', phase: '第一章', result: 'light-signal', title: '此灯不借天命', kind: '物品交涉',
        description: '军报交接后，众人在帐外约好灯号并试过视线。一束电光成为传令的辅助。', hint: '光可以传递约定好的信号，却不能替人判断军情。' },
];
export const supplyEpilogues: Record<ItemRoute, { speaker: string; text: string }[]> = {
    'item-plan': [
        { speaker: '我', text: '军报与回令已交清。我把准备的物品收好，再按约定核实使用条件。' },
        { speaker: '姜维', text: '物有所用，也得把能做和不能做的分清。不要把尚未做的事当成军情。' },
        { speaker: '魏延', text: '你这人，办法倒不少。东西带好，照说定的去试。' },
    ],
    'radio-relay': [
        { speaker: '我', text: '军报已经交清。伯约，这一只留在你这里，另一只交给将军。先试一遍，再往远处走。' },
        { speaker: '姜维', text: '听得到。往后每次传话，先核对身份，重要军令仍须复核。' },
        { speaker: '魏延', text: '人还在帐前，声音倒先追上来了……你这匣子，比我的马还快。' },
    ],
    'light-signal': [
        { speaker: '我', text: '军报与回令已经交清。咱们在帐外约好灯号，先站到两头试过，详细军情仍由人传。' },
        { speaker: '姜维', text: '看得见。信号只作提醒，未经约定的光，一概不当军令。' },
        { speaker: '魏延', text: '这灯不用油，也不用火？……罢了。灯归你管，兵归我管。' },
    ],
};
