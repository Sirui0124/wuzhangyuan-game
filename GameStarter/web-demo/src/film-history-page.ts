import { watchedFilms, type WatchedFilm } from './film-history';
import { mountCinematicSubtitles } from './cinematic-subtitles';
import { readFilmAudio } from './film-audio';

const archive = document.querySelector<HTMLElement>('.archive')!;
const list = document.querySelector<HTMLUListElement>('.films')!;
const empty = document.querySelector<HTMLElement>('#empty')!;
const screen = document.querySelector<HTMLElement>('.screen')!;
const title = document.querySelector<HTMLElement>('#film-title')!;
const status = document.querySelector<HTMLElement>('#film-status')!;
const video = screen.querySelector('video')!;
let current: WatchedFilm | undefined;
let disposeSubtitles = () => {};

function show(film: WatchedFilm, autoplay = false) {
    if (current?.src !== film.src) {
        current = film;
        video.pause();
        disposeSubtitles();
        title.textContent = film.title;
        status.hidden = true;
        video.poster = film.thumbnail ?? '';
        video.src = film.src;
        const audio = readFilmAudio();
        video.volume = audio.volume / 100;
        video.muted = audio.muted || audio.volume === 0;
        const subtitles = mountCinematicSubtitles(video, film.subtitles);
        subtitles.show();
        disposeSubtitles = subtitles.dispose;
    }
    for (const card of Array.from(list.querySelectorAll('button'))) {
        if (card.dataset.film === film.src) card.setAttribute('aria-current', 'true');
        else card.removeAttribute('aria-current');
    }
    if (autoplay) {
        void video.play().catch(() => { /* Native controls allow manual playback. */ });
        if (window.matchMedia('(max-width: 52rem)').matches) screen.scrollIntoView({ block: 'start' });
    }
}

function populate() {
    const films = watchedFilms();
    list.replaceChildren(...films.map(film => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'film-card';
        button.dataset.film = film.src;
        button.setAttribute('aria-controls', 'film-title');
        const cover = document.createElement('span');
        cover.className = 'film-cover';
        cover.setAttribute('aria-hidden', 'true');
        if (film.thumbnail) {
            const image = new Image();
            image.alt = '';
            image.loading = 'lazy';
            image.src = film.thumbnail;
            cover.append(image);
        }
        const name = document.createElement('span');
        name.className = 'film-name';
        name.textContent = film.title;
        button.append(cover, name);
        button.addEventListener('click', () => show(film, true));
        item.append(button);
        return item;
    }));
    archive.hidden = !films.length;
    empty.hidden = !!films.length;
    const requested = new URLSearchParams(location.search).get('clip');
    const selected = films.find(film => film.src === current?.src) ?? films.find(film => film.id === requested) ?? films[0];
    if (selected) show(selected);
    else if (current) {
        current = undefined;
        disposeSubtitles();
        video.removeAttribute('src');
        video.load();
    }
}

video.addEventListener('error', () => {
    status.textContent = '这段影像暂时无法播放。';
    status.hidden = false;
});
window.addEventListener('pageshow', event => { if (event.persisted) populate(); });
populate();
