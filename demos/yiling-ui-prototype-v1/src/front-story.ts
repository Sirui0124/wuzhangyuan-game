import type { Session } from './campaign-client.js';
import { names, type Front } from './campaign-intent.js';
import { ENDING_STORIES } from './ending-report.js';

// Historical outcomes are for the reader. Only the live session supplies current military intelligence.
const HISTORY: Record<Front, string> = {
    sha: '沙摩柯率部随刘备东征。陆逊火攻蜀营后，吴军连破各营，沙摩柯在这一战中身亡。',
    camp: '冯习领军，张南为前部督，二人都随刘备东征。陆逊火攻得手后，冯习、张南均战死。',
    fu: '傅肜随刘备东征。夷陵兵败后，他留下断后，拒绝向吴军投降，最终战死。',
    ma: '马良是刘备的侍中。东征时，他奉命到武陵联络五溪各部，刘备兵败夷陵时也遇害。',
    cheng: '程畿随刘备东征。蜀军败退时，吴军追上他的船，他与追兵交战而死。',
    du: '杜路、刘宁是刘备部将。蜀营被攻破后，两部陷入困境，最终向吴军请降。',
    wang: '王甫曾任荆州议曹从事。他随刘备征吴，在秭归兵败后遇害。',
    huang: '黄权统率江北部队防备魏军。刘备在江南兵败，黄权的退路被吴军切断，后来率部降魏。',
};

const OPENING: Partial<Record<Front, string>> = {
    sha: '营火烧起时，沙摩柯与部众失散。回神后，他认出营口的小卒，随即骑马出营寻人。谷道里还有谁、在哪里会合，都要等前线核实。',
    ma: '马良带随员在外联络，撤军的消息还未送到。驿卒认得他们走过的路，营中还在等一行人的下落。',
    wang: '王甫一行在向秭归撤退时失去联络。亲随认得队伍的标记，沿路还有落后的伤员等待接应。',
};

type FrontFilm = { src: string; title: string; subtitles?: string };
const FRONT_FILMS: Partial<Record<Front, FrontFilm>> = {
    sha: {
        src: '/video/current/CH04-shamoke-v4-20261119.mp4',
        title: '沙摩柯 · 火夜寻人',
        subtitles: '/video/subtitles/CH04-shamoke-v4-20261119.vtt',
    },
};
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const dialog = $<HTMLDialogElement>('front-story');
const filmHost = $('story-film');
let active: { front: Front; film?: FrontFilm } | null = null;

function currentIntelligence(front: Front, session: Session) {
    const route = session.fronts[front];
    if (route.status === 'home') return '已归营。';
    if (route.status === 'safe') return '已脱险，正在归营。';
    if (route.assessment?.autonomousEligible) return '已具备自行撤离条件，尚未收到脱险回报。';
    if (front === 'sha' && session.routeInfo?.sha?.searchVerified) return '谷道会合处已核实，仍待撤出。';
    if (front === 'fu' && session.facts.liubeiAliveVerified) {
        return '刘备仍在的可信消息已送达傅肜。' +
            (session.facts.withdrawalAccepted ? '傅肜已答应撤离，仍待脱险回报。' : '傅肜仍在后阵。');
    }
    return route.lastCrisisEvent?.text || (session.ended ? '本次调度已结束，尚未收到脱险回报。' : '仍待接应。');
}

function stopFilm() {
    if (document.fullscreenElement === filmHost) void document.exitFullscreen().catch(() => {});
    const video = filmHost.querySelector('video');
    if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
    }
    filmHost.hidden = true;
    dialog.classList.remove('playing-film');
}

function showReading(focus = false) {
    stopFilm();
    $('story-reading').hidden = false;
    dialog.scrollTop = 0;
    if (focus) $('story-history-heading').focus();
}

export function playStoryFilm() {
    const film = active?.film;
    if (!film || !dialog.open) return;
    stopFilm();
    $('story-reading').hidden = true;
    dialog.classList.add('playing-film');
    filmHost.hidden = false;
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('aria-label', film.title);
    if (film.subtitles) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.srclang = 'zh';
        track.label = '中文';
        track.src = film.subtitles;
        track.default = true;
        video.append(track);
    }
    $('story-skip').before(video);
    const finish = () => {
        if (dialog.open && filmHost.contains(video)) showReading(true);
    };
    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    video.src = film.src;
    $('story-skip').focus();
    // The viewport player also covers the whole chapter when native fullscreen is unavailable.
    if (document.fullscreenEnabled && !document.fullscreenElement) {
        void filmHost.requestFullscreen().then(() => {
            if (filmHost.hidden && document.fullscreenElement === filmHost) return document.exitFullscreen();
        }).catch(() => {});
    }
    void video.play().catch(() => { /* The player stays available when autoplay is blocked. */ });
}

export function openFrontStory(front: Front, session: Session, firstVisit: boolean) {
    if (dialog.open || !session.fronts[front] || session.fronts[front].status === 'locked') return;
    const oldSha = front === 'sha' && !session.routeInfo?.sha && !session.routeVersion;
    const story = ENDING_STORIES[front];
    const film = oldSha ? undefined : FRONT_FILMS[front];
    active = { front, film };
    $('story-title').textContent = names[front];
    $('story-crisis').textContent = `危机度 ${session.fronts[front].urgency}`;
    const image = $<HTMLImageElement>('story-image');
    const caption = oldSha ? '山林向导送来的初报' : story.caption;
    image.src = oldSha ? '/art/intro/sha.png' : `/art/ending/${story.image}.png`;
    image.alt = caption;
    $('story-caption').textContent = caption;
    $('story-history').textContent = HISTORY[front];
    $('story-text').textContent = oldSha
        ? '沙摩柯的部众散在东沟和西沟。东沟还有人能走，西沟的伤兵需用担架。沙摩柯仍在等伤兵撤出。'
        : OPENING[front] ?? story.before;
    $('story-current').textContent = currentIntelligence(front, session);
    $('story-replay').hidden = !film;
    dialog.showModal();
    if (film && firstVisit) playStoryFilm();
    else showReading();
}

export function closeFrontStory() {
    if (!dialog.open) return;
    stopFilm();
    active = null;
    dialog.close();
}

export function storyContact() {
    return dialog.open && !$('story-reading').hidden ? active?.front : undefined;
}

$('story-skip').addEventListener('click', () => showReading(true));
$('story-replay').addEventListener('click', playStoryFilm);
$('close-story').addEventListener('click', closeFrontStory);
dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (!filmHost.hidden) showReading(true);
    else closeFrontStory();
});
