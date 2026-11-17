import type { ChapterOneSession as ChapterSession } from './session';
import type { CharacterProgress } from '../../characters/encounters';
import { characterId } from '../../character-art';
/** Project existing save facts; no parallel save, migration, or unlock side effects. */
export function chapterOneCharacters(game: ChapterSession, visible: boolean): CharacterProgress {
    const state = game.snapshot();
    const completed = [...state.story.seen, ...state.finishedCinematics.map(id => `cinematic:${id}`)];
    for (const section of game.flow.sections) if (state.finishedSections.includes(section.id)) completed.push(...section.rows);
    const section = game.currentSection();
    if (section) completed.push(...section.rows.slice(0, state.lineIndex));
    const row = state.phase === 'reply' ? game.currentReply() : game.row();
    const active = state.phase === 'spoken' || state.phase === 'expression' ? 'weiyan' : row ? characterId(row.speaker) : undefined;
    return { chapter: 'wuzhang', entered: row ? [row.id] : [], completed, active, visible };
}
