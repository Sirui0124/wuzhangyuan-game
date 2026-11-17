import type { JietingSession } from './session';
import { JIETING_TOTAL } from './rules';
import { REINFORCEMENT_LIMIT, REINFORCEMENT_TARGET, grantForJudgment } from './persuasion';
import { esc } from '../../game/view-common';

const LURE_MINIMUM = 10000;
const number = (n: number) => n.toLocaleString('en-US');

/** A read-only view of decisions, orders and arrivals; never advances the chapter. */
export function deploymentProgress(s: JietingSession) {
    const rounds = Object.values(s.state.roundResults).filter(r => !!r).sort((a, b) => a.round - b.round);
    const latest = rounds.at(-1), pending = s.state.pendingJudgment;
    const dispatch = rounds.find(r => r.troops > 0 && !r.arrived);
    let proposed = 0, stage: 'idle' | 'followup' | 'proposed' | 'ordered' | 'arrived' | 'none' | 'goal' = 'idle';
    let status = '准备向马谡进言';
    if (pending?.phase === 'reinforcement' && !pending.special) {
        if (pending.status === 'followup') {
            stage = 'followup'; status = '马谡还有顾虑，本轮可以补充理由';
        } else {
            proposed = grantForJudgment(pending, rounds, s.below).troops;
            stage = proposed ? 'proposed' : 'none';
            status = proposed ? `理由获认可 · 拟增派 ${number(proposed)} 人，待下令` : '本轮未能争取到增兵';
        }
    } else if (dispatch) {
        proposed = dispatch.troops; stage = dispatch.ordered ? 'ordered' : 'proposed';
        status = dispatch.ordered ? `已下令增派 ${number(proposed)} 人 · 待到营` : `拟增派 ${number(proposed)} 人 · 待下令`;
    } else if (latest) {
        stage = latest.troops ? 'arrived' : 'none';
        status = latest.troops ? `第 ${latest.round} 轮增派的 ${number(latest.troops)} 人已到营` : `第 ${latest.round} 轮未获增兵`;
    }
    if (s.below >= REINFORCEMENT_TARGET) { stage = 'goal'; status = '山下 20,000 人已到营 · 分兵目标达成'; }
    return { total: JIETING_TOTAL, below: s.below, above: s.above, lureMinimum: LURE_MINIMUM,
        targetBelow: REINFORCEMENT_TARGET, remaining: s.below >= REINFORCEMENT_TARGET ? 0 : Math.max(0, REINFORCEMENT_LIMIT - rounds.length), proposed, stage, status };
}

export function deploymentAxisHTML(s: JietingSession, previousBelow = s.below) {
    if (s.current.act !== 2) return '';
    const p = deploymentProgress(s), share = p.below / p.total * 100;
    const pendingShare = Math.min(p.proposed, p.above) / p.total * 100;
    const changed = previousBelow !== p.below;
    const objective = '目标：尽可能多地让马谡把兵分到山下';
    const text = `山下王平 ${number(p.below)} 人，山上马谡 ${number(p.above)} 人。${p.status}。${objective}。山下达到一万人可商议诱敌，仍须将领配合和完整方案。`;
    const marks = [0, 5000, 10000, 15000, 20000, 25000].map(value => `<span class="deployment-tick${value === p.lureMinimum ? ' is-threshold' : ''}${value === p.targetBelow ? ' is-target' : ''}" data-mark="${value}" style="left:${value / p.total * 100}%"><span>${number(value)}</span></span>`).join('');
    return `<section class="jieting-deployment${changed ? ' is-troops-updated' : ''}" aria-label="兵力分配" data-deployment data-stage="${p.stage}" data-below="${p.below}" data-above="${p.above}" data-proposed="${p.proposed}" data-remaining="${p.remaining}" style="--below-share:${share}%;--previous-share:${previousBelow / p.total * 100}%;--pending-share:${pendingShare}%">
        <header><span class="deployment-total">兵力 ${number(p.total)}</span><span class="deployment-objective">${objective}</span><span class="deployment-rounds">剩余进言 <strong>${p.remaining}</strong> 轮</span></header>
        <div class="deployment-counts"><span>山下 · 王平 <strong>${number(p.below)}</strong></span><span>山上 · 马谡 <strong>${number(p.above)}</strong></span></div>
        <div class="deployment-scale"><div class="deployment-track" role="progressbar" aria-label="街亭兵力分配" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.below}" aria-valuetext="${esc(text)}"><span class="deployment-below"></span>${p.proposed ? '<span class="deployment-pending" aria-hidden="true"></span>' : ''}</div><div class="deployment-ticks" aria-label="每五千人的兵力刻度">${marks}</div></div>
        <div class="deployment-caption"><span class="deployment-feedback" role="status">${esc(p.status)}</span><span class="deployment-threshold" title="诱敌还须两将配合与可执行的方案；两万人是分兵目标，仍须完成第三幕">10,000 起可议诱敌 · 20,000 分兵目标</span></div>
    </section>`;
}
