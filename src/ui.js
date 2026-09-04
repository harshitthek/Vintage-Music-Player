// UI, Animations, & Interaction Physics for Bonfire Radio

import { state, DECADE_LABELS, saveLikedIds, saveLikedPreviews } from './state.js';
import { fetchDecadeSongs, fetchFullSongs } from './api.js';
import { formatTime, playPreviewSong, playFromLibrary } from './audioEngine.js';

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function initFireflies(container) {
    if (!container) return;
    container.innerHTML = '';
    const EMBER_COUNT = 18;
    for (let i = 0; i < EMBER_COUNT; i++) {
        const firefly = document.createElement('div');
        firefly.className = 'firefly';
        const startLeft = 20 + Math.random() * 60;
        const driftX = (Math.random() - 0.5) * 70;
        const duration = 4.5 + Math.random() * 5.0;
        const delay = Math.random() * 7.0;
        const size = 1.5 + Math.random() * 2.5;

        firefly.style.left = `${startLeft}%`;
        firefly.style.bottom = `${12 + Math.random() * 10}%`;
        firefly.style.width = `${size}px`;
        firefly.style.height = `${size}px`;
        firefly.style.setProperty('--drift-x', `${driftX}px`);
        firefly.style.animationDuration = `${duration}s`;
        firefly.style.animationDelay = `${delay}s`;

        container.appendChild(firefly);
    }
}

export function triggerHeartBurst(likeBtn) {
    if (!likeBtn) return;
    const directions = [
        { dx: 0, dy: -24 },
        { dx: 18, dy: -14 },
        { dx: -18, dy: -14 },
        { dx: 12, dy: 14 },
        { dx: -12, dy: 14 }
    ];
    directions.forEach(dir => {
        const burst = document.createElement('span');
        burst.className = 'heart-burst text-pink-400 font-bold text-xs pointer-events-none';
        burst.textContent = '♥';
        burst.style.setProperty('--dx', `${dir.dx}px`);
        burst.style.setProperty('--dy', `${dir.dy}px`);
        likeBtn.appendChild(burst);
        setTimeout(() => burst.remove(), 600);
    });
}

export function updateHotspotPosition(hiddenDietCoke) {
    if (!hiddenDietCoke) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const W0 = 1536;
    const H0 = 1024;
    const S = Math.max(W / W0, H / H0);
    const X_offset = (W - (W0 * S)) / 2;
    const Y_offset = (H - (H0 * S)) / 2;
    
    // Coordinates of Diet Coke can in 1536x1024 artwork
    const X0 = 76;
    const Y0 = 572;
    const canW = Math.max(32, Math.round(26 * S));
    const canH = Math.max(46, Math.round(42 * S));
    
    const left = Math.round(X_offset + (X0 * S) - 4);
    const top = Math.round(Y_offset + (Y0 * S) - 2);
    
    hiddenDietCoke.style.left = `${left}px`;
    hiddenDietCoke.style.top = `${top}px`;
    hiddenDietCoke.style.width = `${canW + 8}px`;
    hiddenDietCoke.style.height = `${canH + 8}px`;
}

export function showShortcutToast() {
    if (window.innerWidth < 768) return;
    if (localStorage.getItem('sawBonfireShortcuts')) return;
    localStorage.setItem('sawBonfireShortcuts', '1');
    
    const toast = document.createElement('div');
    toast.className = 'shortcut-toast mac-glass px-3.5 py-1.5 rounded-full text-[11px] text-white/80 flex items-center gap-2 shadow-2xl border border-white/20 select-none';
    toast.innerHTML = `<span class="text-amber-300">⌨</span> <span><b>Enter</b> Random</span> · <span><b>Space</b> Play/Pause</span> · <span><b>← →</b> Prev/Next</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5200);
}

export function updateDecadeChipStyles(decadeFilterBar) {
    if (!decadeFilterBar) return;
    decadeFilterBar.querySelectorAll('.decade-chip').forEach(btn => {
        const dec = btn.dataset.decade;
        if (dec === state.activeDecadeFilter) {
            btn.classList.add('active-chip', 'decade-chip-glow');
            btn.classList.remove('text-white/70');
            btn.classList.add('text-white/90');
        } else {
            btn.classList.remove('active-chip', 'decade-chip-glow');
            btn.classList.add('text-white/70');
            btn.classList.remove('text-white/90');
        }
    });
}

export function updateLikeIcon(dom) {
    if (!dom || !dom.likeIcon || !dom.likeBtn) return;
    if (!state.currentSong) {
        dom.likeIcon.setAttribute('fill', 'none');
        dom.likeBtn.classList.remove('text-pink-400');
        dom.likeBtn.classList.add('text-stone-300');
        return;
    }
    if (state.currentSong.liked) {
        dom.likeIcon.setAttribute('fill', 'currentColor');
        dom.likeBtn.classList.add('text-pink-400');
        dom.likeBtn.classList.remove('text-stone-300');
    } else {
        dom.likeIcon.setAttribute('fill', 'none');
        dom.likeBtn.classList.remove('text-pink-400');
        dom.likeBtn.classList.add('text-stone-300');
    }
}

export function renderPlaylistPanel(dom) {
    if (!dom || dom.playlistPanel.classList.contains('hidden')) return;
    const mode = dom.playlistPanel.dataset.mode || 'browse';
    dom.playlistList.innerHTML = '';

    if (mode === 'likes') {
        dom.playlistPanelTitle.textContent = 'My Likes ♥';
        const likedLocal = state.library.filter(s => s.liked);
        const combined = [
            ...likedLocal.map(s => ({ kind: 'local', song: s })),
            ...state.likedPreviews.map(s => ({ kind: 'preview', song: s }))
        ];
        if (combined.length === 0) {
            dom.playlistEmptyMsg.classList.remove('hidden');
            dom.playlistEmptyMsg.textContent = "No liked songs yet. Tap the heart while a song plays.";
            return;
        }
        dom.playlistEmptyMsg.classList.add('hidden');
        combined.forEach(entry => {
            const song = entry.song;
            const isCurrent = state.currentSong && state.currentSong.id === song.id;
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-all ' + (isCurrent ? 'bg-amber-500/20 border border-amber-500/30' : '');
            const badge = entry.kind === 'preview' ? ' · Full Song' : '';
            li.innerHTML = `
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold text-white truncate">${escapeHtml(song.title)}</p>
                    <p class="text-[10px] text-white/70 truncate">${escapeHtml(song.artist)} · ${DECADE_LABELS[song.decade]}${badge}</p>
                </div>
                <span class="like-dot text-pink-400 text-xs flex-shrink-0">♥</span>
            `;
            if (entry.kind === 'preview') {
                li.addEventListener('click', () => playPreviewSong(song));
            } else {
                const libIdx = state.library.indexOf(song);
                if (!song.file) {
                    li.classList.add('opacity-50');
                    li.title = 'Re-add this file this session to play it';
                }
                li.addEventListener('click', () => { if (song.file) playFromLibrary(libIdx); });
            }
            dom.playlistList.appendChild(li);
        });
        return;
    }

    // Browse curated decade tracks when library is empty
    if (state.library.length === 0) {
        const decadeTitle = (DECADE_LABELS[state.activeDecadeFilter] || 'Vintage') + ' Hits';
        dom.playlistPanelTitle.textContent = decadeTitle;
        fetchDecadeSongs(state.activeDecadeFilter).then(songs => {
            if (dom.playlistPanel.classList.contains('hidden') || dom.playlistPanel.dataset.mode === 'likes') return;
            dom.playlistList.innerHTML = '';
            if (!songs || !songs.length) {
                dom.playlistEmptyMsg.classList.remove('hidden');
                dom.playlistEmptyMsg.textContent = "No songs found for this decade.";
                return;
            }
            dom.playlistEmptyMsg.classList.add('hidden');
            state.currentPreviewList = songs;
            songs.forEach((song, idx) => {
                const isCurrent = state.currentSong && state.currentSong.id === song.id;
                const li = document.createElement('li');
                li.className = `flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-all ${isCurrent ? 'bg-amber-500/20 border border-amber-500/30' : ''}`;
                li.innerHTML = `
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-white truncate">${escapeHtml(song.title)}</p>
                        <p class="text-[10px] text-white/70 truncate">${escapeHtml(song.artist)} · ${DECADE_LABELS[song.decade || state.activeDecadeFilter] || 'Vintage'}</p>
                    </div>
                    <svg class="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M9.5 5.5v13l10-6.5z"/></svg>
                `;
                li.addEventListener('click', () => {
                    dom.playlistList.querySelectorAll('li').forEach(el => el.classList.remove('bg-amber-500/20', 'border', 'border-amber-500/30'));
                    li.classList.add('bg-amber-500/20', 'border', 'border-amber-500/30');
                    playPreviewSong(song, idx);
                });
                dom.playlistList.appendChild(li);
            });
        });
        return;
    }

    // Local library browse mode
    const indices = state.library.map((_, i) => i).filter(i => {
        if (state.activeDecadeFilter === 'all') return true;
        return state.library[i].decade === state.activeDecadeFilter;
    });

    if (indices.length === 0) {
        dom.playlistEmptyMsg.classList.remove('hidden');
        dom.playlistEmptyMsg.textContent = "No songs in this decade yet. Use Add Songs.";
        return;
    }
    dom.playlistEmptyMsg.classList.add('hidden');
    indices.forEach(i => {
        const song = state.library[i];
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-all ' + (i === state.currentLibIndex ? 'bg-amber-500/20 border border-amber-500/30' : '');
        li.innerHTML = `
            <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold text-white truncate">${escapeHtml(song.title)}</p>
                <p class="text-[10px] text-white/70 truncate">${escapeHtml(song.artist)} · ${DECADE_LABELS[song.decade]}</p>
            </div>
            <span class="like-dot text-pink-400 text-xs flex-shrink-0">${song.liked ? '♥' : ''}</span>
        `;
        li.addEventListener('click', () => {
            if (!song.file) return;
            playFromLibrary(i);
        });
        if (!song.file) {
            li.classList.add('opacity-50');
            li.title = 'Re-add this file this session to play it';
        }
        dom.playlistList.appendChild(li);
    });
}

export function initScrubber(dom) {
    function updateScrubber(clientX, commitToAudio) {
        if (!dom.audioElement.duration) return;
        const rect = dom.progressBarContainer.getBoundingClientRect();
        const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
        dom.progressBar.style.width = `${ratio * 100}%`;
        dom.currentTimeEl.textContent = formatTime(ratio * dom.audioElement.duration);
        if (commitToAudio) {
            dom.audioElement.currentTime = ratio * dom.audioElement.duration;
        }
    }

    dom.progressBarContainer.addEventListener('pointerdown', (e) => {
        if (!dom.audioElement.duration) return;
        dom.isScrubbing = true;
        dom.progressBar.classList.add('no-transition');
        dom.progressBarContainer.classList.add('scrubbing');
        dom.progressBarContainer.setPointerCapture(e.pointerId);
        updateScrubber(e.clientX, true);
    });

    dom.progressBarContainer.addEventListener('pointermove', (e) => {
        if (!dom.isScrubbing) return;
        updateScrubber(e.clientX, false);
    });

    const stopScrubbing = (e) => {
        if (!dom.isScrubbing) return;
        dom.isScrubbing = false;
        dom.progressBar.classList.remove('no-transition');
        dom.progressBarContainer.classList.remove('scrubbing');
        updateScrubber(e.clientX, true);
        try { dom.progressBarContainer.releasePointerCapture(e.pointerId); } catch (_) {}
    };

    dom.progressBarContainer.addEventListener('pointerup', stopScrubbing);
    dom.progressBarContainer.addEventListener('pointercancel', stopScrubbing);
}
