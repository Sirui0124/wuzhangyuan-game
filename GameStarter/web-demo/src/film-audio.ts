export type FilmAudioPreference = { volume: number; muted: boolean };
export const FILM_AUDIO_EVENT = 'wuzhang-film-audio';
export const FILM_AUDIO_KEY = 'wuzhang-film-audio-v1';
let memory: FilmAudioPreference = { volume: 100, muted: false };

export function readFilmAudio(): FilmAudioPreference {
    try {
        const value = JSON.parse(localStorage.getItem(FILM_AUDIO_KEY) ?? 'null');
        if (value && Number.isFinite(value.volume) && typeof value.muted === 'boolean') {
            memory = { volume: Math.round(Math.min(100, Math.max(0, value.volume))), muted: value.muted };
        }
    } catch { /* Keep the latest choice if storage is unavailable. */ }
    return { ...memory };
}

export function saveFilmAudio(change: Partial<FilmAudioPreference>) {
    const previous = readFilmAudio();
    memory = { volume: Number.isFinite(change.volume) ? Math.round(Math.max(0, Math.min(100, change.volume!))) : previous.volume,
        muted: typeof change.muted === 'boolean' ? change.muted : previous.muted };
    try { localStorage.setItem(FILM_AUDIO_KEY, JSON.stringify(memory)); } catch { /* Retain the in-memory choice. */ }
    window.dispatchEvent(new CustomEvent(FILM_AUDIO_EVENT, { detail: { ...memory } }));
    return { ...memory };
}
