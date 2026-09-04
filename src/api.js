// API Layer for Bonfire Radio (JioSaavn Edge API + iTunes Fallback)

import { state, pickRandom } from './state.js';

export const FALLBACK_SEEDS = {
    "50s": ["awaara hoon mukesh", "mera joota hai japani", "pyar hua iqrar hua", "aaja re pardesi lata", "chaudhvin ka chand rafi", "yeh raat bheegi bheegi"],
    "60s": ["lag ja gale lata", "roop tera mastana kishore", "mere sapno ki rani kishore", "ehsaan tera hoga rafi", "ye shaam mastani", "baharon phool barsao"],
    "70s": ["pal pal dil ke paas kishore", "kabhi kabhie mere dil mein mukesh", "chura liya hai tumne", "dum maro dum asha", "kya hua tera wada rafi", "o mere dil ke chain"],
    "80s": ["dil cheez kya hai asha", "yaad aa raha hai bappi", "hawa hawai kavita", "gazab ka hai din udit", "papa kehte hain udit", "tum itna jo muskura rahe ho"],
    "90s": ["tujhe dekha to kumar sanu", "pehla nasha udit", "chaiyya chaiyya sukhwinder", "kuch kuch hota hai udit", "chura ke dil mera", "dil to pagal hai"],
    "20s": ["kesariya arijit singh", "raataan lambiyan jubin", "tum hi ho arijit", "shayad arijit singh", "channa mereya", "heeriye jasleen arijit"]
};

export function guessDecade(dateStr) {
    if (!dateStr) return '20s';
    const yr = parseInt(dateStr.slice(0, 4), 10);
    if (yr >= 1950 && yr < 1960) return '50s';
    if (yr >= 1960 && yr < 1970) return '60s';
    if (yr >= 1970 && yr < 1980) return '70s';
    if (yr >= 1980 && yr < 1990) return '80s';
    if (yr >= 1990 && yr < 2000) return '90s';
    if (yr >= 2020) return '20s';
    return '20s';
}

export async function fetchDecadeSongs(decade) {
    const d = decade || state.activeDecadeFilter || 'all';
    try {
        const res = await fetch(`/api/search?decade=${encodeURIComponent(d)}&limit=12`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.results && data.results.length > 0) {
                return data.results.map(s => ({
                    id: s.id,
                    title: s.title,
                    artist: s.artist,
                    album: s.album,
                    decade: s.decade || d,
                    artwork: s.artwork,
                    previewUrl: s.streamUrl,
                    duration: s.duration,
                    isFullSong: true,
                    liked: state.likedPreviews.some(lp => lp.id === s.id)
                }));
            }
        }
    } catch (_) {}

    const fallbackList = (d === 'all') ? Object.values(FALLBACK_SEEDS).flat() : (FALLBACK_SEEDS[d] || []);
    const seed = pickRandom(fallbackList);
    return fetchFullSongs(seed);
}

export async function fetchFullSongs(query) {
    const q = (query || '').trim();
    if (!q) return [];

    // 1. Primary: Vercel Serverless Function (/api/search?q=...)
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.results && data.results.length > 0) {
                return data.results.map(s => ({
                    id: s.id,
                    title: s.title,
                    artist: s.artist,
                    album: s.album,
                    decade: s.decade || '20s',
                    artwork: s.artwork,
                    previewUrl: s.streamUrl,
                    duration: s.duration,
                    isFullSong: true,
                    liked: state.likedPreviews.some(lp => lp.id === s.id)
                }));
            }
        }
    } catch (_) {}

    // 2. High-speed Fallback: iTunes Audio
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q + ' hindi')}&media=music&country=IN&limit=6`;
        const res = await fetch(url);
        const data = await res.json();
        const tracks = (data.results || []).filter(t => t.previewUrl);
        if (tracks.length > 0) {
            return tracks.map(t => ({
                id: 'itunes-' + t.trackId,
                title: t.trackName,
                artist: t.artistName,
                decade: guessDecade(t.releaseDate),
                artwork: t.artworkUrl100,
                previewUrl: t.previewUrl,
                duration: 30,
                isFullSong: false,
                liked: state.likedPreviews.some(s => s.id === 'itunes-' + t.trackId)
            }));
        }
    } catch (_) {}

    return [];
}
