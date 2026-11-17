import type { ChapterOneSession as ChapterSession } from './session';
import type { CharacterProgress } from '../../characters/encounters';
import { characterId } from '../../character-art';
/** Project existing save facts; no parallel save, migration, or unlock side effects. */
export function chapterOneCharacters(game: ChapterSession, visible: boolean): CharacterProgress {
    const state = game.snapshot();
    if(game.branch) {
        const b=game.branch;
        const lines=[...b.dialogue.trail.flatMap(f=>f.lines),...b.dialogue.frame.lines.slice(0,b.line+1)];
        const completed=[...new Set(lines.map(l=>`branch-person:${l.speaker}`))];
        const speaker=b.currentLine?.speaker??'';
        return {chapter:'wuzhang',entered:[],completed,active:speaker==='小甲'?'guard':characterId(speaker),visible};
    }
    const completed = [...state.story.seen, ...state.finishedCinematics.map(id => `cinematic:${id}`)];
    for (const section of game.flow.sections) if (state.finishedSections.includes(section.id)) completed.push(...section.rows);
    const section = game.currentSection();
    if (section) completed.push(...section.rows.slice(0, state.lineIndex));
    const row = state.phase === 'reply' ? game.currentReply() : game.row();
    const active = state.phase === 'spoken' || state.phase === 'expression' ? 'weiyan' : row ? characterId(row.speaker) : undefined;
    return { chapter: 'wuzhang', entered: row ? [row.id] : [], completed, active, visible };
}
