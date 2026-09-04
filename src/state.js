// State Management for Bonfire Radio (Vintage Music Player)

export const DECADE_LABELS = {
    'all': 'All Decades',
    '50s': "50's",
    '60s': "60's",
    '70s': "70's",
    '80s': "80's",
    '90s': "90's",
    '20s': "2020's"
};

export function loadLikedIds() {
    try {
        const raw = localStorage.getItem('bonfireRadioLikedIds');
        return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) {
        return new Set();
    }
}

export function saveLikedIds(set) {
    try {
        localStorage.setItem('bonfireRadioLikedIds', JSON.stringify([...set]));
    } catch (_) {}
}

export function loadLikedPreviews() {
    try {
        const raw = localStorage.getItem('bonfireRadioLikedPreviews');
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

export function saveLikedPreviews(arr) {
    try {
        localStorage.setItem('bonfireRadioLikedPreviews', JSON.stringify(arr));
    } catch (_) {}
}

export const state = {
    activeDecadeFilter: 'all',
    library: [],
    currentLibIndex: null,
    currentSong: null,
    isPlaying: false,
    currentPreviewList: [],
    currentPreviewIndex: -1,
    currentBlobUrl: null,
    diceHistory: [],
    diceHistoryPos: -1,
    preloadedDiceSong: null,
    isPreloading: false,
    recentlyPlayedSongKeys: [],
    likedPreviews: loadLikedPreviews(),
    likedIds: loadLikedIds()
};

export function cleanSongKey(song) {
    if (!song) return '';
    const t = (song.title || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^\w]/g, '').slice(0, 10);
    const a = (song.artist || '').toLowerCase().replace(/[^\w]/g, '').slice(0, 8);
    return `${t}-${a}`;
}

export function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

export function pickNonRepeatingSong(songs) {
    if (!songs || !songs.length) return null;
    if (songs.length === 1) return songs[0];

    // Filter out junk/remixes/slowed versions if standard tracks exist
    const cleanTracks = songs.filter(s => {
        const titleLower = (s.title || '').toLowerCase();
        return !titleLower.includes('slowed') && !titleLower.includes('reverb') && !titleLower.includes('lofi flip');
    });
    const validPool = cleanTracks.length > 0 ? cleanTracks : songs;

    // Filter out songs played in recent dice rolls
    const unplayed = validPool.filter(s => {
        const key = cleanSongKey(s);
        return !state.recentlyPlayedSongKeys.includes(key);
    });

    const poolToPick = unplayed.length > 0 
        ? unplayed 
        : validPool.filter(s => state.currentSong && cleanSongKey(s) !== cleanSongKey(state.currentSong));
    
    const chosen = pickRandom(poolToPick.length > 0 ? poolToPick : validPool);

    if (chosen) {
        const key = cleanSongKey(chosen);
        state.recentlyPlayedSongKeys.push(key);
        if (state.recentlyPlayedSongKeys.length > 20) {
            state.recentlyPlayedSongKeys.shift();
        }
    }
    return chosen;
}
