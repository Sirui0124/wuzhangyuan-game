/** Same-origin game pages yield their music while any foreground film owns sound. */
export const FILM_FOCUS_EVENT = 'wzy-film-focus';
const PREFIX = 'wzy-film-focus:';
const LEASE_MS = 6000;
let initialized = false;
let localOwner = false;

export function filmOwnsSound() {
    if (document.querySelector('video')) return true;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(PREFIX) && Number(localStorage.getItem(key)) > Date.now()) return true;
        }
    } catch { /* Local film detection still works without storage. */ }
    return false;
}

export function initializeFilmFocus() {
    if (initialized) return;
    initialized = true;
    const key = PREFIX + Math.random().toString(36).slice(2);
    let inactive = false;
    const notify = () => window.dispatchEvent(new Event(FILM_FOCUS_EVENT));
    const sync = () => {
        const owner = !inactive && !document.hidden && !!document.querySelector('video');
        try {
            if (owner) localStorage.setItem(key, String(Date.now() + LEASE_MS));
            else if (localOwner) localStorage.removeItem(key);
        } catch { /* No cross-page coordination when storage is unavailable. */ }
        localOwner = owner;
        notify();
    };
    new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('play', sync, true);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('storage', e => { if (!e.key || e.key.startsWith(PREFIX)) notify(); });
    window.addEventListener('pagehide', () => { inactive = true; sync(); });
    window.addEventListener('pageshow', () => { inactive = false; sync(); });
    // Expiry recovers music if a film tab crashes; renewal also covers newly opened game pages.
    window.setInterval(sync, 1500);
    sync();
}
