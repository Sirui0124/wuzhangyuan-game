import { migrateJiangDutySave, jiangDutyMigration } from './jiang-duty-migration';
import { migrateSixClueSave, sixClueMigration } from './clue-save-migration';
import type { ChapterFlow, FlowSection } from '../../../../../content/schema/chapter-session';
import { parseNpcTurn, persuasionCodes, validCode } from '../../npc-dialogue';
import { restoreThoughtWorkspace } from './thought-workspace';
import { clueSources, commitRow, derive, freshReview, inferenceRules, validAuthorization, type ChapterReview, type StoryRow } from './thought-canvas-model';
import { CHAPTER_ID, clone, freshComposition, phases, speechHistoryRound, WEIYAN_JUDGMENT_VERSION, type GameSessionState } from './session-state';
import { isCompatibleContentVersion, migrationRuleVersion } from './content-version-compatibility';
import { restoreSupplyState } from './supply-restore';
import { restorePhone } from './phone-state';
import { tentStages } from './tent-visit';
type RestoreContext = {
    grantPhoneReward?: boolean;
    content: ChapterReview;
    flow: ChapterFlow;
    contentVersion: string;
    rows: Map<string, StoryRow>;
    sections: Map<string, FlowSection>;
};
/** Validate a candidate before replacing live state or cancelling any current work. */
export function restoreSessionState(raw: string, context: RestoreContext): GameSessionState {
    const verdicts = persuasionCodes;
    const candidate = JSON.parse(raw) as GameSessionState;
    // Saves before chapter identities were introduced belong only to this chapter.
    if (candidate && candidate.chapterId === undefined)
        candidate.chapterId = CHAPTER_ID;
    const validIds = new Set([...context.content.clues.map(c => c.id), ...inferenceRules.map(r => r.id)]);
    const array = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string');
    if (!candidate || candidate.schemaVersion !== 1 || candidate.chapterId !== CHAPTER_ID || !isCompatibleContentVersion(candidate.contentVersion, context.contentVersion) || !phases.includes(candidate.phase) || !context.flow.scenes.some(s => s.id === candidate.scene) || ![1, 2].includes(candidate.round))
        throw new Error('存档版本不兼容，原记录请保留');
    const rulesVersion = migrationRuleVersion(context.contentVersion);
    migrateSixClueSave(candidate, rulesVersion === jiangDutyMigration.to ? sixClueMigration.to : rulesVersion);
    migrateJiangDutySave(candidate, rulesVersion);
    // Migrated saves still go through every normal source and event validation below.
    candidate.contentVersion = context.contentVersion;
    candidate.tent ??= 'unheard';
    if (!tentStages.includes(candidate.tent)) throw new Error('帐外经历不完整');
    candidate.composition ??= freshComposition();
    // Keep already saved wording editable, but retire the removed reference-sentence mechanism.
    const oldProvenance: unknown = candidate.composition.provenance;
    if (oldProvenance === 'reference') candidate.composition.provenance = 'manual';
    if (typeof candidate.composition.error === 'string' && candidate.composition.error.includes('参考句'))
        candidate.composition.error = '暂未生成，依据与原话已保留。可重试，或直接修改准备说的话。';
    if (candidate.speech) delete (candidate.speech as { suggested?: unknown }).suggested;
    if (typeof candidate.composition.focus !== 'string' || candidate.composition.focus.length > 600 || !['idle', 'waiting', 'ready', 'failed', 'cancelled'].includes(candidate.composition.status) || !['ai', 'manual', 'local'].includes(candidate.composition.provenance) || !Array.isArray(candidate.composition.evidenceIds))
        throw new Error('表达草稿不完整');
    if (candidate.composition.status === 'waiting')
        candidate.composition.status = 'cancelled';
    const previousDraft = candidate.composition.previousDraft;
    if (previousDraft !== undefined && (!previousDraft || typeof previousDraft.text !== 'string'
        || !['ai', 'manual', 'local'].includes(previousDraft.provenance) || !array(previousDraft.evidenceIds)
        || previousDraft.evidenceIds.some(id => !validIds.has(id))))
        throw new Error('润色前的草稿记录不完整');
    const story = candidate.story;
    if (!story || story.version !== context.content.version || typeof story.run !== 'string' || !array(story.completed) || story.completed.some(id => !context.rows.has(id)) || !array(story.collected) || story.collected.some(id => !clueSources[id])
        || !array(story.selected) || story.selected.some(id => !validIds.has(id)) || !array(story.seen) || story.seen.some(id => !inferenceRules.some(r => r.id === id))
        || !Array.isArray(story.edges) || story.edges.some(edge => !Array.isArray(edge) || edge.length !== 2 || edge.some(id => !validIds.has(id))) || !story.positions || typeof story.positions !== 'object'
        || Object.entries(story.positions).some(([id, p]) => !validIds.has(id) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) || typeof story.draft !== 'string' || !Array.isArray(story.history)
        || story.history.some(h => !h || typeof h.text !== 'string' || typeof h.feedback !== 'string' || typeof h.accepted !== 'boolean' || (h.round !== undefined && ![1, 2].includes(h.round)) || (h.evidence !== undefined && (!array(h.evidence) || h.evidence.some(id => !validIds.has(id)))))
        || !array(candidate.finishedSections) || candidate.finishedSections.some(id => !context.sections.has(id)) || !array(candidate.finishedCinematics) || candidate.finishedCinematics.some(id => !context.flow.cinematics.some(c => c.id === id)) || !array(candidate.panelOpened)
        || !Number.isInteger(candidate.lineIndex) || candidate.lineIndex < 0 || (candidate.section !== null && !context.sections.has(candidate.section)) || (candidate.notesReturn !== null && !phases.includes(candidate.notesReturn))
        || !['review', 'P1', 'P2'].includes(candidate.notesPurpose) || typeof candidate.lastFeedback !== 'string' || ![null, 'tutorial-sacrifice', 'weiyan-execution', 'tent-execution', 'era-arrest', 'safe', 'radio-relay', 'light-signal', 'item-plan'].includes(candidate.end))
        throw new Error('存档内容不完整，原记录请保留');
    candidate.displayedRows ??= {};
    if (!candidate.displayedRows || typeof candidate.displayedRows !== 'object' || Array.isArray(candidate.displayedRows)
        || Object.entries(candidate.displayedRows).some(([id, text]) => !story.completed.includes(id) || typeof text !== 'string'))
        throw new Error('已读对白记录不完整，原记录请保留');
    if ((candidate.phase === 'dialogue' || candidate.notesReturn === 'dialogue') && (!candidate.section || candidate.lineIndex >= context.sections.get(candidate.section)!.rows.length))
        throw new Error('对白位置不兼容');
    if (candidate.phase === 'cinematic' && !context.flow.cinematics.some(c => c.id === candidate.cinematic))
        throw new Error('影片位置不兼容');
    if (candidate.phase === 'thought-prompt') {
        const entrance = candidate.section ? context.sections.get(candidate.section) : undefined;
        if (!entrance || entrance.next.kind !== 'phase' || entrance.next.id !== 'thoughts'
            || candidate.round !== entrance.round || candidate.scene !== entrance.scene
            || !candidate.finishedSections.includes(entrance.id) || entrance.rows.some(id => !story.completed.includes(id)))
            throw new Error('思绪入口缺少实际调查');
    }
    if (candidate.speech && (typeof candidate.speech.text !== 'string' || !array(candidate.speech.selected) || candidate.speech.selected.some(id => !validIds.has(id)) || !['waiting', 'ready', 'cancelled', 'failed'].includes(candidate.speech.status) || (candidate.speech.result !== undefined && !verdicts.includes(candidate.speech.result))
        || (candidate.speech.judgmentVersion !== undefined && typeof candidate.speech.judgmentVersion !== 'string')))
        throw new Error('表达记录不兼容');
    const stage = candidate.round === 1 ? 'first' : 'authorized';
    if (candidate.speech?.result && !validCode(candidate.speech.result, stage))
        throw new Error('表达轮次不兼容');
    if (candidate.speech?.npcTurn) {
        const turn = parseNpcTurn(candidate.speech.npcTurn, stage, story.collected);
        if (candidate.speech.status !== 'ready' || candidate.speech.result !== turn.classification.code)
            throw new Error('NPC判断与发言记录不一致');
    }
    for (const item of story.history)
        if (item.npcTurn) {
            const itemStage = speechHistoryRound(item, candidate.round) === 1 ? 'first' : 'authorized';
            const turn = parseNpcTurn(item.npcTurn, itemStage, story.collected);
            if (item.accepted !== (turn.classification.code === 'ok') || item.feedback !== turn.reply.text)
                throw new Error('NPC判断与交涉历史不一致');
        }
    if (candidate.phase === 'choice' && candidate.round !== 1)
        throw new Error('分支阶段不兼容');
    if (candidate.phase === 'spoken' && !candidate.speech)
        throw new Error('缺少实际表达');
    const executionEnding = candidate.phase === 'death' && candidate.end === 'weiyan-execution';
    const eraEnding = candidate.phase === 'death' && candidate.end === 'era-arrest';
    if (candidate.end === 'era-arrest' && (!eraEnding || !candidate.speech?.itemDecision?.eraFailure)) throw new Error('时代失败缺少物品判断');
    if ((candidate.end === 'weiyan-execution' && !executionEnding)
        || (candidate.phase === 'death' && !['tutorial-sacrifice', 'weiyan-execution', 'tent-execution', 'era-arrest'].includes(candidate.end ?? ''))
        || (candidate.end === 'tutorial-sacrifice' && candidate.phase !== 'death')
        || (candidate.end === 'safe' && !['ending', 'map'].includes(candidate.phase)))
        throw new Error('结局阶段不兼容');
    if ((candidate.phase === 'tent' || candidate.notesReturn === 'tent') &&
        (!['cough', 'side', 'footsteps', 'caught'].includes(candidate.tent) || candidate.scene !== 'camp_gate' || !candidate.finishedSections.includes('notice')))
        throw new Error('帐外经历缺少告示前置');
    if (candidate.end === 'tent-execution' && (candidate.phase !== 'death' || candidate.tent !== 'dead' || !candidate.finishedSections.includes('notice')))
        throw new Error('帐外结局不完整');
    if (candidate.phase === 'reply' || candidate.notesReturn === 'reply' || executionEnding || eraEnding) {
        const speech = candidate.speech, previous = story.history.at(-1);
        const result = speech?.result, row = result ? context.rows.get(result === 'R1-RETRY' ? 'A-40' : result) : undefined;
        const execution = result === 'execute';
        const replyText = speech?.npcTurn?.reply.text ?? row?.text;
        if (!speech || speech.status !== 'ready' || !result || result === 'ok' || (!execution && !row) || (execution && !speech.npcTurn)
            || (!execution && (candidate.round === 1) !== (result === 'R1-RETRY')) || (executionEnding && !execution)
            || !previous || previous.accepted || previous.text !== speech.text || previous.feedback !== replyText || candidate.lastFeedback !== replyText
            || speechHistoryRound(previous, candidate.round) !== candidate.round
            || JSON.stringify(previous.npcTurn) !== JSON.stringify(speech.npcTurn))
            throw new Error('缺少已发生的回应');
    }
    if (candidate.speech?.result === 'execute') {
        const entrance = context.sections.get(candidate.round === 1 ? 'first-weiyan' : 'weiyan-approach')!;
        if (!candidate.speech.npcTurn || !candidate.finishedSections.includes(entrance.id) || entrance.rows.some(id => !story.completed.includes(id))
            || story.history.some(h => speechHistoryRound(h, candidate.round) === candidate.round && h.accepted))
            throw new Error('斩首结局缺少本轮交涉');
    }
    // Rebuild factual flags exclusively from the saved real event sequence.
    const rebuilt = freshReview(context.content.version);
    for (const id of story.completed)
        commitRow(rebuilt, id);
    if (story.collected.some(id => !rebuilt.collected.includes(id)))
        throw new Error('线索缺少实际来源');
    story.flags = {
        ...rebuilt.flags
    };
    if (story.completed.includes('A-60'))
        story.flags.FIRST_FAILURE_EXPERIENCED = true;
    if (story.history.some(h => speechHistoryRound(h, candidate.round) === 2 && h.accepted) && validAuthorization({
        ...story, flags: story.flags
    }))
        story.flags.PERSUADED = true;
    const graph = derive(story.collected, story.edges, inferenceRules, story);
    // Older saves gain the workspace without changing their factual sources or existing graph.
    candidate.thinking = candidate.thinking != null || ['thoughts', 'expression'].includes(candidate.phase)
        ? restoreThoughtWorkspace(candidate.thinking, story.collected, graph, story.edges, story) : null;
    if (graph.R01)
        story.flags.Q1_DONE = true;
    if (graph.R02)
        story.flags.Q2_DONE = true;
    if (candidate.panelOpened.includes('P1'))
        story.flags.P1_OPENED = true;
    if (candidate.panelOpened.includes('P2'))
        story.flags.P2_OPENED = true;
    if (candidate.round === 2 && (['expression', 'spoken', 'reply'].includes(candidate.phase) || ['expression', 'spoken', 'reply'].includes(candidate.notesReturn ?? '') || executionEnding || eraEnding) && !validAuthorization(story))
        throw new Error('交涉缺少本人授权');
    if (candidate.end === 'tutorial-sacrifice' && (candidate.round !== 1 || !story.flags.FIRST_FAILURE_EXPERIENCED))
        throw new Error('首次回溯缺少真实问责经历');
    if (['ending', 'map'].includes(candidate.phase) && !story.flags.REPORT_CLOSED)
        throw new Error('结局缺少接报与回令');
    if (candidate.speech?.status === 'waiting')
        candidate.speech.status = 'cancelled';
    // Rejudge unread results from older rules, including old AI accepts and the former reference bypass.
    // Replies already read and real story progress remain historical facts.
    if ((candidate.phase === 'spoken' || candidate.notesReturn === 'spoken') && candidate.speech?.status === 'ready'
        && (candidate.speech.judgmentVersion !== WEIYAN_JUDGMENT_VERSION || !candidate.speech.npcTurn)) {
        candidate.speech.status = 'cancelled';
        delete candidate.speech.result;
        delete candidate.speech.npcTurn;
        delete candidate.speech.judgmentVersion;
        delete candidate.speech.itemDecision;
    }
    restoreSupplyState(candidate, context.grantPhoneReward);
    candidate.phone = restorePhone(candidate.phone);
    const restored = clone(candidate);
    restored.story.requestSeq = Number.isSafeInteger(story.requestSeq) ? story.requestSeq + 1 : 0;
    return restored;
}
