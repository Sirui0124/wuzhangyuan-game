import type { Clip } from './cinematics';

const prefix = 'wuzhang-watched-film-v1:';
const mediaPath = (value: unknown, extension: string): value is string => typeof value === 'string'
    && value.startsWith('/video/') && value.endsWith(extension) && !/[\\?#]/.test(value)
    && !value.split('/').includes('..');

export type WatchedFilm = Clip & { watchedAt: number; thumbnail?: string };

export function watchedFilms(): WatchedFilm[] {
    const films: WatchedFilm[] = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key?.startsWith(prefix)) continue;
            try {
                const film = JSON.parse(localStorage.getItem(key) ?? 'null');
                if (!film || typeof film.id !== 'string' || typeof film.title !== 'string' || !Number.isFinite(film.watchedAt)
                    || !mediaPath(film.src, '.mp4') || key !== prefix + film.src) continue;
                films.push({ id: film.id, title: film.title, src: film.src, watchedAt: film.watchedAt,
                    subtitles: mediaPath(film.subtitles, '.vtt') ? film.subtitles : undefined,
                    thumbnail: typeof film.thumbnail === 'string' && film.thumbnail.startsWith('data:image/jpeg;base64,') ? film.thumbnail : undefined });
            } catch { /* Ignore an unreadable entry. */ }
        }
    } catch { /* Storage may be unavailable. */ }
    return films.sort((a, b) => b.watchedAt - a.watchedAt);
}

function thumbnail(video: HTMLVideoElement) {
    if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = Math.max(1, Math.round(canvas.width * video.videoHeight / video.videoWidth));
    try {
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = canvas.toDataURL('image/jpeg', .68);
        if (image.length <= 24000) return image;
    } catch { /* The film remains available without a thumbnail. */ }
}

/** Keep the archive independent of scene completion, skips and saved games. */
export function trackWatchedFilm(video: HTMLVideoElement, clip?: Clip) {
    if (!clip || !mediaPath(clip.src, '.mp4')) return () => {};
    const key = prefix + clip.src;
    let recorded = false;
    const record = () => {
        if (recorded || !video.played.length) return;
        recorded = true;
        try {
            if (localStorage.getItem(key)) return;
            const { id, src, title, subtitles } = clip;
            const film: WatchedFilm = { id, src, title, subtitles, watchedAt: Date.now() };
            const image = thumbnail(video);
            try { localStorage.setItem(key, JSON.stringify({ ...film, thumbnail: image })); }
            catch { localStorage.setItem(key, JSON.stringify(film)); }
        } catch { /* Playback can continue when storage is unavailable. */ }
    };
    video.addEventListener('timeupdate', record);
    video.addEventListener('ended', record);
    return () => {
        record();
        video.removeEventListener('timeupdate', record);
        video.removeEventListener('ended', record);
    };
}
