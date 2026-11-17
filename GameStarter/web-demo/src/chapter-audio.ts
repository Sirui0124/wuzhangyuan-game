import type { GameAudio, Music } from './audio';

type ChapterAudioNode = { kind: string; act?: number; scene?: string };
/** Existing music only; films keep their own dialogue and environmental soundtrack. */
export function chapterMusic(chapter: 'grain' | 'jieting', node: ChapterAudioNode, later = false): Music {
    if (node.kind === 'open' || (chapter === 'jieting' && node.scene === 'jieting_masu_tent')) return 'weiyan';
    return later || (node.act ?? 1) >= 2 || ['finish', 'ending', 'letter'].includes(node.kind) ? 'round2' : 'round1';
}
export function updateChapterAudio(audio: GameAudio, chapter: 'grain' | 'jieting', node: ChapterAudioNode,
    options: { later?: boolean; silent?: boolean } = {}) {
    if (node.kind === 'video' || options.silent) { audio.setMusicPaused(true); return; }
    audio.setMusic(chapterMusic(chapter, node, options.later));
    audio.setMusicPaused(false);
}
