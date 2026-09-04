// Audio Engine & MediaSession Controller for Bonfire Radio

import { state, DECADE_LABELS, pickNonRepeatingSong } from './state.js';
import { fetchDecadeSongs } from './api.js';

let dom = null;
let previousVolume = 1.0;
let currentVolume = 1.0;
let isMuted = false;

export function formatTime(seconds) {
    if (!isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function initAudioEngine(elements) {
    dom = elements;

    // Load persisted volume
    currentVolume = parseFloat(localStorage.getItem('bonfireRadioVolume') || '1.0');
    if (isNaN(currentVolume) || currentVolume < 0 || currentVolume > 1) currentVolume = 1.0;
    previousVolume = currentVolume > 0 ? currentVolume : 1.0;
    isMuted = (currentVolume === 0);

    setVolume(currentVolume, false);

    // Audio element event listeners
    dom.audioElement.addEventListener('timeupdate', () => {
        if (dom.audioElement.duration && !dom.isScrubbing) {
            const current = dom.audioElement.currentTime;
            const percent = (current / dom.audioElement.duration) * 100;
            dom.progressBar.style.width = `${percent}%`;
            dom.currentTimeEl.textContent = formatTime(current);
            updateMediaPosition();
        }
    });

    dom.audioElement.addEventListener('loadedmetadata', () => {
        dom.durationEl.textContent = formatTime(dom.audioElement.duration || 0);
        updateMediaPosition();
    });

    dom.audioElement.addEventListener('error', () => {
        state.isPlaying = false;
        dom.playIcon.classList.remove('hidden');
        dom.pauseIcon.classList.add('hidden');
        dom.albumArt.classList.add('paused-art');
        dom.songTitleEl.textContent = '⚠ Stream error';
        dom.artistNameEl.textContent = 'Skipping to next song…';
        setTimeout(() => dom.nextBtn.click(), 2000);
    });

    dom.audioElement.addEventListener('ended', () => {
        if (state.currentLibIndex !== null) {
            dom.nextBtn.click();
        } else if (state.currentPreviewList.length > 1) {
            const nextIndex = state.currentPreviewIndex + 1;
            if (nextIndex < state.currentPreviewList.length) {
                playPreviewSong(state.currentPreviewList[nextIndex], nextIndex);
            } else {
                playRandomDiceSong();
            }
        } else {
            playRandomDiceSong();
        }
    });

    // Start background preloader
    setTimeout(() => preloadNextDiceSong(), 800);
}

export function updateVolumeUI(vol) {
    if (!dom || !dom.volumeHighIcon || !dom.volumeLowIcon || !dom.volumeMuteIcon) return;
    if (vol === 0 || isMuted) {
        dom.volumeHighIcon.classList.add('hidden');
        dom.volumeLowIcon.classList.add('hidden');
        dom.volumeMuteIcon.classList.remove('hidden');
    } else if (vol <= 0.5) {
        dom.volumeHighIcon.classList.add('hidden');
        dom.volumeLowIcon.classList.remove('hidden');
        dom.volumeMuteIcon.classList.add('hidden');
    } else {
        dom.volumeHighIcon.classList.remove('hidden');
        dom.volumeLowIcon.classList.add('hidden');
        dom.volumeMuteIcon.classList.add('hidden');
    }
    if (dom.volumeSlider) dom.volumeSlider.value = vol;
}

export function setVolume(vol, persist = true) {
    currentVolume = Math.min(Math.max(vol, 0), 1);
    isMuted = (currentVolume === 0);
    if (dom && dom.audioElement) {
        dom.audioElement.volume = currentVolume;
    }
    updateVolumeUI(currentVolume);
    if (persist) {
        localStorage.setItem('bonfireRadioVolume', currentVolume);
    }
}

export function toggleMute() {
    if (currentVolume > 0) {
        previousVolume = currentVolume;
        setVolume(0);
    } else {
        setVolume(previousVolume || 1.0);
    }
}

export function updateMediaSession() {
    if (!('mediaSession' in navigator) || !state.currentSong) return;
    const artUrl = state.currentSong.artwork || (window.location.origin + '/models/main.webp');
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: state.currentSong.title || 'Bonfire Track',
            artist: state.currentSong.artist || 'Bonfire Radio',
            album: state.currentSong.album || `Hindi Classics (${DECADE_LABELS[state.currentSong.decade] || 'Vintage'})`,
            artwork: [
                { src: artUrl, sizes: '512x512', type: 'image/webp' },
                { src: artUrl, sizes: '256x256', type: 'image/webp' },
                { src: artUrl, sizes: '128x128', type: 'image/webp' },
                { src: artUrl, sizes: '96x96', type: 'image/webp' }
            ]
        });
    } catch (_) {}

    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

    const actionHandlers = [
        ['play', () => playSong()],
        ['pause', () => pauseSong()],
        ['previoustrack', () => dom.prevBtn.click()],
        ['nexttrack', () => dom.nextBtn.click()],
        ['seekto', (details) => {
            if (details.seekTime && dom.audioElement.duration) {
                dom.audioElement.currentTime = details.seekTime;
            }
        }]
    ];

    actionHandlers.forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (_) {}
    });
}

export function updateMediaPosition() {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (dom.audioElement.duration && isFinite(dom.audioElement.duration)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: dom.audioElement.duration,
                playbackRate: dom.audioElement.playbackRate || 1,
                position: Math.min(dom.audioElement.currentTime || 0, dom.audioElement.duration)
            });
        } catch (_) {}
    }
}

export function loadSong(song, src) {
    state.currentSong = song;
    dom.likeBtn.disabled = false;
    dom.likeBtn.classList.remove('opacity-40');
    dom.updateLikeIcon();

    dom.songTitleEl.classList.remove('song-slide-in');
    dom.artistNameEl.classList.remove('song-slide-in');
    dom.uploadTrigger.classList.remove('vinyl-pulse');
    void dom.songTitleEl.offsetWidth; // Force reflow
    dom.songTitleEl.classList.add('song-slide-in');
    dom.artistNameEl.classList.add('song-slide-in');
    dom.uploadTrigger.classList.add('vinyl-pulse');

    dom.songTitleEl.textContent = song.title;
    const badge = (song.isFullSong !== false) ? ' · Full Song' : ' · 30s preview';
    dom.artistNameEl.textContent = song.artist + ' · ' + (DECADE_LABELS[song.decade] || song.decade) + badge;
    dom.audioElement.src = src;
    if (song.artwork) {
        dom.albumArt.src = song.artwork;
    }
    dom.albumArt.classList.add('paused-art');
    updateMediaSession();
}

export function playSong() {
    dom.audioElement.play().then(() => {
        state.isPlaying = true;
        dom.playIcon.classList.add('hidden');
        dom.pauseIcon.classList.remove('hidden');
        dom.albumArt.classList.remove('paused-art');
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    }).catch(err => {
        state.isPlaying = false;
        dom.playIcon.classList.remove('hidden');
        dom.pauseIcon.classList.add('hidden');
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        if (state.currentSong) {
            dom.artistNameEl.textContent = 'Tap ▶ to play · ' + (state.currentSong.artist || '');
        }
    });
}

export function pauseSong() {
    dom.audioElement.pause();
    state.isPlaying = false;
    dom.playIcon.classList.remove('hidden');
    dom.pauseIcon.classList.add('hidden');
    dom.albumArt.classList.add('paused-art');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
}

export function togglePlayPause() {
    if (state.isPlaying) pauseSong(); else playSong();
}

export function playPreviewSong(song, index = -1) {
    state.currentLibIndex = null;
    state.currentPreviewIndex = index;
    if (state.currentBlobUrl) {
        URL.revokeObjectURL(state.currentBlobUrl);
        state.currentBlobUrl = null;
    }
    loadSong(song, song.previewUrl);
    playSong();
}

export function playFromLibrary(libIndex) {
    const song = state.library[libIndex];
    if (!song || !song.file) return;
    if (state.currentBlobUrl) {
        URL.revokeObjectURL(state.currentBlobUrl);
        state.currentBlobUrl = null;
    }
    state.currentLibIndex = libIndex;
    state.currentSong = song;
    state.currentBlobUrl = URL.createObjectURL(song.file);
    loadSong(song, state.currentBlobUrl);
    playSong();
}

export async function preloadNextDiceSong(decade) {
    if (state.isPreloading) return;
    state.isPreloading = true;
    try {
        const targetDecade = decade || state.activeDecadeFilter;
        const songs = await fetchDecadeSongs(targetDecade);
        if (songs && songs.length > 0) {
            const song = pickNonRepeatingSong(songs);
            if (song) {
                if (targetDecade !== 'all') song.decade = targetDecade;
                state.preloadedDiceSong = song;
            }
        }
    } catch (_) {}
    finally { state.isPreloading = false; }
}

export async function playRandomDiceSong() {
    if (dom.diceIcon) dom.diceIcon.classList.add('dice-rolling');
    dom.playerPlaylistBtn.disabled = true;
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;

    const decadeLabel = DECADE_LABELS[state.activeDecadeFilter] || 'All Decades';

    // 1. Instant Playback from Preloaded Cache (0ms latency)
    if (state.preloadedDiceSong && (state.activeDecadeFilter === 'all' || state.preloadedDiceSong.decade === state.activeDecadeFilter)) {
        const song = state.preloadedDiceSong;
        state.preloadedDiceSong = null;
        state.diceHistory = state.diceHistory.slice(0, state.diceHistoryPos + 1);
        state.diceHistory.push(song);
        state.diceHistoryPos = state.diceHistory.length - 1;
        state.currentPreviewList = [song];
        playPreviewSong(song, 0);

        setTimeout(() => {
            if (dom.diceIcon) dom.diceIcon.classList.remove('dice-rolling');
            dom.playerPlaylistBtn.disabled = false;
            dom.prevBtn.disabled = false;
            dom.nextBtn.disabled = false;
            preloadNextDiceSong();
        }, 400);
        return;
    }

    // 2. Direct fast fetch of dynamic decade stream
    dom.songTitleEl.textContent = '🎲 Rolling the dice…';
    dom.artistNameEl.textContent = `Finding a classic from ${decadeLabel}`;

    try {
        let songs = await fetchDecadeSongs(state.activeDecadeFilter);
        if (!songs || !songs.length) throw new Error('Could not tune in — tap Dice again');

        const song = pickNonRepeatingSong(songs);
        if (!song) throw new Error('Could not pick a song');
        if (state.activeDecadeFilter !== 'all') song.decade = state.activeDecadeFilter;

        state.diceHistory = state.diceHistory.slice(0, state.diceHistoryPos + 1);
        state.diceHistory.push(song);
        state.diceHistoryPos = state.diceHistory.length - 1;

        state.currentPreviewList = [song];
        playPreviewSong(song, 0);

        preloadNextDiceSong();

    } catch (err) {
        dom.songTitleEl.textContent = '🎲 ' + (err.message || 'Could not pick a song');
        dom.artistNameEl.textContent = 'Tap the dice again or switch decade';
    } finally {
        if (dom.diceIcon) dom.diceIcon.classList.remove('dice-rolling');
        dom.playerPlaylistBtn.disabled = false;
        dom.prevBtn.disabled = false;
        dom.nextBtn.disabled = false;
    }
}
