import type { ExpressionJudge, ExpressionGenerator, ExpressionJudgeInput } from './chapter-session';
import { ExpressionSafetyError, type NpcTurn } from './npc-dialogue';
import { decideWeiyan, weiyanReplyIntent } from './weiyan-judgment';

/** Authored first-chapter fallback. Conservative keyword recognition, never model output. */
export function offlineWeiyanTurn(input: ExpressionJudgeInput): NpcTurn {
    const current = input.current.trim();
    // Questions and reported/quoted words are not assertions or direct insults.
    const turns = /刚才说错|收回刚才|先前说得不妥，我重新说明/.test(current) ? [current] : [...input.said, current];
    const clauses = turns.flatMap(t => t.replace(/[“「][^”」]*[”」]/g, '').match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) ?? [])
        .map(t => t.trim()).filter(t => t && !/[？?]|吗|是否|是不是|难道|可否|能否|听说|假如|如果/.test(t));
    const words = clauses.join('。'), ids = new Set(input.evidence.map(e => e.id));
    const has = (pattern: RegExp) => pattern.test(words);
    const campKnown = ids.has('T02') || input.evidence.some(e => e.id === 'C03' && e.originals.some(r => r.id === 'D24'));
    const first = input.stage === 'first';
    const ban = has(/不能入帐|不许进入|不准入帐|不得入帐|不(?:能|可|许|要|必)?(?:闯|进|入)(?:丞相)?帐|禁止.{0,4}入帐|帐前有禁令|禁令不能违|不能违令|遵守禁令/);
    const follows = has(/(?:敌军|他们).{0,12}(?:随|跟).{0,8}(?:我军|调动|换向|变向)|随我军.{0,8}(?:调动|换向|变向)/);
    const comparison = ids.has('C02') && ids.has('C03') && has(/往日|往夜|前几夜|此前|以往|以前/) && has(/今夜|今晚/)
        && (has(/闻号.{0,3}退/) && has(/不退|未退/) || follows);
    const checks: Record<string, string> = first ? {
        situation: ids.has('C05') && has(/敌军|魏军|营外|营门/)
            && (campKnown && has(/尚未攻营|没有攻营|营门未破|营门尚未失守/) || has(/叫嚷|探问|喊话/))
            && has(/不必强闯|不必闯帐|不需.{0,3}闯帐|还不到.{0,8}闯帐|先.{0,8}(?:转呈|通传)/) ? words : '',
        ban: ids.has('C06') && ban ? words : '',
        relay: has(/我.{0,8}(?:马上|即刻|这就|立即|现在).{0,8}(?:转呈|传报|通传|送报)|我(?:来|去|替您|来替您|替将军|来替将军).{0,4}(?:转达|转呈|传报|通传|送报)|让我.{0,4}(?:转达|转呈|传报|通传|送报)/)
            && !has(/我不.{0,8}(?:转呈|传报|通传|送报)|不(?:要|必|用).{0,4}(?:转呈|传报|通传|送报)/) ? words : '',
    } : {
        authorization: ids.has('C08') && has(/(?:姜维|伯约).{0,6}(?:已|亲口).{0,5}(?:答应|应允|同意).{0,10}(?:接报|接军报)/) ? words : '',
        comparison: comparison ? words : '',
        following: ids.has('C03') && follows ? words : '',
        inference: ids.has('C02') && ids.has('C03') && has(/(?:可能|恐怕|或许|像是|也许).{0,6}试探/) ? words : '',
        handoff: ids.has('C08') && ban && has(/帐外/) && has(/(?:姜维|伯约)/) && has(/现在|立即|即刻|这就|马上/)
            && has(/当面.{0,5}(?:交报|接报|军报)|当面交给/) ? words : '',
    };
    // Any explicit contrary instruction wins over positive keyword hits; unknown language asks for clarification.
    let unsupported = '';
    if (!campKnown && has(/营门未破|尚未攻营|营门尚未失守/)) unsupported = '尚未取得营门情况';
    if (!ids.has('C08') && has(/(?:姜维|伯约).{0,8}(?:已|亲口).{0,5}(?:答应|应允|同意)/)) unsupported = '尚未取得姜维承诺';
    if (has(/(?:姜维|伯约).{0,8}(?:没有|尚未|未曾|并未|不曾).{0,4}(?:答应|应允|同意)|(?:并非|不是|没有|不在).{0,8}试探|(?:没有|并未|不曾).{0,8}(?:跟随|换向)|明天.{0,6}(?:再报|转呈)|暂不.{0,4}(?:交报|转呈)|别.{0,3}(?:交报|转呈)|保证.{0,6}(?:退兵|丞相无事)|敌军已退|军报已.{0,2}(?:送达|交付)/)) unsupported = '尚有矛盾或无据断言';
    if (has(/(?:一定|就是|必定).{0,4}试探|(?:直接|强行|偏要).{0,4}(?:闯|进|入)帐|不(?:能|愿|会).{0,5}(?:转呈|交报)|(?:不|并未|没有|不是).{0,5}(?:可能|恐怕).{0,3}试探/)) unsupported = '安排或判断仍需说明';
    if (has(/(?:并非|不是).{0,3}(?:不许|不能|不准).{0,4}(?:入帐|进入)|(?:现在可以|允许|准许).{0,3}(?:入帐|进帐)|(?:别|不要|不必).{0,3}当面交报/)) unsupported = '仍有相反安排';
    const direct = current.replace(/[“「][^”」]*[”」]/g, '');
    const offense = /^(?:魏延[，,！!]?|你)(?:就是|是个|这个)?(?:蠢货|废物|狗贼|混蛋)(?:[！!。，,]|$)/.test(direct);
    const offTopic = /^(?:讲讲红烧肉|我想吃红烧肉|今天天气真好|给我唱首歌)[。！!]*$/.test(direct);
    const decision = decideWeiyan(input.stage, { checks, unsupported, fatal: { type: offense ? 'offense' : offTopic ? 'off_topic' : 'none', quote: offense || offTopic ? current : '' } });
    return { schemaVersion: 1, npcId: 'weiyan', stage: input.stage,
        classification: { code: decision.code, disposition: decision.result === 'clarify' ? 'revise' : decision.result,
            reason: decision.result === 'accept' ? '本地规则识别到本轮所需内容。' : '本地规则：' + decision.reason, evidenceIds: [] },
        reply: { speaker: '魏延', text: weiyanReplyIntent(input.stage, decision) } };
}

export function offlineExpressionAgents(): { judge: ExpressionJudge; generate: ExpressionGenerator } {
    return {
        judge: async (input, signal) => { signal.throwIfAborted(); if (input.items?.length) throw new Error('无 AI 模式不提交手机物品'); return offlineWeiyanTurn(input); },
        generate: async ({ brief, verificationSources }, signal) => {
            signal.throwIfAborted();
            if (brief.attachedItems?.length) throw new ExpressionSafetyError('无 AI 模式不使用手机物品。');
            if (brief.playerIntent.draft?.trim() && brief.playerIntent.focus?.trim()
                && brief.playerIntent.draft.trim() !== brief.playerIntent.focus.trim())
                throw new ExpressionSafetyError('无 AI 模式无法合并补充说明，请直接修改准备说的话；两处输入已保留。');
            // Preserve a supplied intention literally; local templates must not invent a player's promise.
            if (brief.playerIntent.words.trim()) return { text: brief.playerIntent.words.trim(), evidenceIds: [], provenance: 'local' as const };
            const selected = new Set(brief.selectedEvidence.filter(e => verificationSources.some(s => s.evidenceId === e.id && s.originals.length)).map(e => e.id));
            const lines: string[] = [], used: string[] = [];
            const add = (required: string[], text: string) => { if (required.every(id => selected.has(id))) { lines.push(text); used.push(...required); } };
            if (brief.conversation.stage === 'first') {
                add(['C05'], '将军，敌军在阵前叫嚷探问，眼下还不必强闯，可以先通传。');
                add(['C06'], '帐内现在确实不许进入。');
                if (lines.length) lines.push('我这就替您转呈，绝不耽误军情。');
            } else {
                add(['C08'], '姜维已亲口答应在帐外接报。');
                add(selected.has('R01') ? ['R01'] : ['C02', 'C03'], '往日闻号即退，今夜不退，还随我军调动换向，可能在试探。');
                add([selected.has('C06') ? 'C06' : 'R02', 'C08'], '请将军现在随我到帐外，向姜维当面交报，不进丞相帐。');
            }
            if (!lines.length) throw new ExpressionSafetyError('请先选用相关线索，或直接写下准备说的话。');
            return { text: lines.join(''), evidenceIds: [...new Set(used)], provenance: 'local' as const };
        },
    };
}
