import type { ChapterFlow, ChapterPhase, FlowTarget } from '../../../../../content/schema/chapter-session';
import { collectionAt, type ChapterReview } from './thought-canvas-model';
import { CHAPTER_ID, phases } from './session-state';
/** Reject invalid chapter references before a player can enter the affected scene. */
export function validateChapterFlow(content: ChapterReview, flow: ChapterFlow): void {
    if (flow.schemaVersion !== 1 || flow.id !== CHAPTER_ID)
        throw new Error('章节流程与运行器不匹配');
    if (content.version !== flow.scriptVersion)
        throw new Error('剧情和流程版本不匹配');
    const unique = (ids: string[], kind: string) => {
        if (new Set(ids).size !== ids.length)
            throw new Error(`${kind} ID 重复`);
        return new Set(ids);
    };
    const rows = unique(content.rows.map(row => row.id), '剧情行');
    const sections = unique(flow.sections.map(section => section.id), '流程段落');
    const scenes = unique(flow.scenes.map(scene => scene.id), '场景');
    const cinematics = unique(flow.cinematics.map(cinematic => cinematic.id), '影片');
    unique(flow.actions.map(action => action.id), '行动');
    const validateTarget = (target: FlowTarget) => {
        const valid = target.kind === 'section' ? sections.has(target.id)
            : target.kind === 'cinematic' ? cinematics.has(target.id)
                : target.kind === 'phase' && phases.includes(target.id as ChapterPhase);
        if (!valid)
            throw new Error(`流程出口不存在：${target.id}`);
    };
    validateTarget(flow.entry);
    for (const scene of flow.scenes) {
        if (scene.routes.some(id => !scenes.has(id)))
            throw new Error(`场景路线不存在：${scene.id}`);
    }
    for (const section of flow.sections) {
        if (!scenes.has(section.scene))
            throw new Error(`段落场景不存在：${section.id}`);
        if (!section.rows.length || section.rows.some(id => !rows.has(id)))
            throw new Error(`剧情段落缺行：${section.id}`);
        if (Object.entries(section.rowScenes ?? {}).some(([row, scene]) => !section.rows.includes(row) || !scenes.has(scene))) {
            throw new Error(`段落场景引用不存在：${section.id}`);
        }
        validateTarget(section.next);
    }
    for (const action of flow.actions) {
        if (!scenes.has(action.scene))
            throw new Error(`行动场景不存在：${action.id}`);
        if (!sections.has(action.section) || action.requires.some(id => !sections.has(id))) {
            throw new Error(`场景行动引用不存在：${action.id}`);
        }
    }
    for (const cinematic of flow.cinematics) {
        if (cinematic.coveredRows.some(id => !rows.has(id) || !!collectionAt[id])) {
            throw new Error('影片不能替代关键线索收录事件');
        }
        validateTarget(cinematic.next);
    }
}
