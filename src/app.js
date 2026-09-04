// Application Bootstrapper for Bonfire Radio (Vintage Music Player)

import { state, DECADE_LABELS, saveLikedIds, saveLikedPreviews } from './state.js';
import { fetchFullSongs } from './api.js';
import { 
    initAudioEngine, 
    togglePlayPause, 
    playRandomDiceSong, 
    playFromLibrary, 
    playPreviewSong, 
    setVolume, 
    toggleMute,
    preloadNextDiceSong
} from './audioEngine.js';
import { 
    initFireflies, 
    triggerHeartBurst, 
    updateHotspotPosition, 
    showShortcutToast, 
    updateDecadeChipStyles, 
    updateLikeIcon, 
    renderPlaylistPanel, 
    initScrubber,
    escapeHtml
} from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cache DOM Elements with resilient dual-id lookups
    const dom = {
        audioElement: document.getElementById('audioElement'),
        uploadTrigger: document.getElementById('uploadTrigger'),
        albumArt: document.getElementById('albumArt'),
        songTitleEl: document.getElementById('songTitle'),
        artistNameEl: document.getElementById('artistName'),
        currentTimeEl: document.getElementById('currentTime'),
        progressBarContainer: document.getElementById('progressBarContainer'),
        progressBar: document.getElementById('progressBar'),
        durationEl: document.getElementById('duration'),
        prevBtn: document.getElementById('prevBtn'),
        playPauseBtn: document.getElementById('playPauseBtn'),
        playIcon: document.getElementById('playIcon'),
        pauseIcon: document.getElementById('pauseIcon'),
        nextBtn: document.getElementById('nextBtn'),
        likeBtn: document.getElementById('likeBtn'),
        likeIcon: document.getElementById('likeIcon'),
        volumeBtn: document.getElementById('volumeBtn'),
        volumeHighIcon: document.getElementById('volumeHighIcon'),
        volumeLowIcon: document.getElementById('volumeLowIcon'),
        volumeMuteIcon: document.getElementById('volumeMuteIcon'),
        volumeSlider: document.getElementById('volumeSlider'),
        playerPlaylistBtn: document.getElementById('playerPlaylistBtn'),
        diceIcon: document.getElementById('diceIcon'),
        discoverBtn: document.getElementById('discoverBtn'),
        myLikesBtn: document.getElementById('myLikesBtn'),
        addSongBtn: document.getElementById('addSongBtn') || document.getElementById('searchSongBtn'),
        fileInput: document.getElementById('audioFileInput') || document.getElementById('fileInput'),
        decadeFilterBar: document.getElementById('decadeFilterBar'),
        playlistPanel: document.getElementById('playlistPanel'),
        playlistPanelTitle: document.getElementById('playlistPanelTitle'),
        playlistList: document.getElementById('playlistList'),
        playlistEmptyMsg: document.getElementById('playlistEmptyMsg'),
        closePlaylistBtn: document.getElementById('closePlaylistPanel') || document.getElementById('closePlaylistBtn'),
        searchModal: document.getElementById('discoverPanel') || document.getElementById('searchModal'),
        searchCloseBtn: document.getElementById('closeDiscoverPanel') || document.getElementById('searchCloseBtn'),
        searchInput: document.getElementById('discoverInput') || document.getElementById('searchInput'),
        searchStatus: document.getElementById('discoverStatus') || document.getElementById('searchStatus'),
        searchResults: document.getElementById('discoverResults') || document.getElementById('searchResults'),
        tagModal: document.getElementById('tagModalOverlay') || document.getElementById('tagModal'),
        tagTitle: document.getElementById('tagTitle'),
        tagDecadeSelect: document.getElementById('tagDecadeSelect'),
        tagConfirmBtn: document.getElementById('tagConfirmBtn'),
        tagCancelBtn: document.getElementById('tagCancelBtn') || document.getElementById('tagSkipBtn'),
        hiddenDietCoke: document.getElementById('hiddenDietCoke'),
        dietCokeNotification: document.getElementById('dietCokeNotification'),
        fireflyContainer: document.getElementById('fireflyContainer') || document.getElementById('firefly-container'),
        isScrubbing: false
    };

    dom.updateLikeIcon = () => updateLikeIcon(dom);

    // 2. Initialize Audio Engine & Micro-Physics
    initAudioEngine(dom);
    initScrubber(dom);
    initFireflies(dom.fireflyContainer);
    updateHotspotPosition(dom.hiddenDietCoke);
    window.addEventListener('resize', () => updateHotspotPosition(dom.hiddenDietCoke));
    setTimeout(showShortcutToast, 1500);

    // 3. Playback Controls
    if (dom.playPauseBtn) dom.playPauseBtn.addEventListener('click', togglePlayPause);
    if (dom.playerPlaylistBtn) dom.playerPlaylistBtn.addEventListener('click', playRandomDiceSong);

    if (dom.prevBtn) dom.prevBtn.addEventListener('click', () => {
        if (state.currentLibIndex !== null) {
            const filtered = state.library.map((_, i) => i).filter(i => {
                if (state.activeDecadeFilter === 'all') return true;
                return state.library[i].decade === state.activeDecadeFilter;
            });
            const curPos = filtered.indexOf(state.currentLibIndex);
            const prevPos = (curPos - 1 + filtered.length) % filtered.length;
            playFromLibrary(filtered[prevPos]);
        } else if (state.diceHistory.length > 0 && state.diceHistoryPos > 0) {
            state.diceHistoryPos--;
            const song = state.diceHistory[state.diceHistoryPos];
            state.currentPreviewList = [song];
            playPreviewSong(song, 0);
        } else if (state.currentPreviewList.length > 1 && state.currentPreviewIndex > 0) {
            const prevIdx = state.currentPreviewIndex - 1;
            playPreviewSong(state.currentPreviewList[prevIdx], prevIdx);
        } else {
            playRandomDiceSong();
        }
    });

    if (dom.nextBtn) dom.nextBtn.addEventListener('click', () => {
        if (state.currentLibIndex !== null) {
            const filtered = state.library.map((_, i) => i).filter(i => {
                if (state.activeDecadeFilter === 'all') return true;
                return state.library[i].decade === state.activeDecadeFilter;
            });
            const curPos = filtered.indexOf(state.currentLibIndex);
            const nextPos = (curPos + 1) % filtered.length;
            playFromLibrary(filtered[nextPos]);
        } else if (state.diceHistory.length > 0 && state.diceHistoryPos < state.diceHistory.length - 1) {
            state.diceHistoryPos++;
            const song = state.diceHistory[state.diceHistoryPos];
            state.currentPreviewList = [song];
            playPreviewSong(song, 0);
        } else if (state.currentPreviewList.length > 1 && state.currentPreviewIndex < state.currentPreviewList.length - 1) {
            const nextIdx = state.currentPreviewIndex + 1;
            playPreviewSong(state.currentPreviewList[nextIdx], nextIdx);
        } else {
            playRandomDiceSong();
        }
    });

    // 4. Volume & Mute Listeners
    if (dom.volumeSlider) {
        dom.volumeSlider.addEventListener('input', (e) => {
            setVolume(parseFloat(e.target.value));
        });
    }
    if (dom.volumeBtn) {
        dom.volumeBtn.addEventListener('click', toggleMute);
    }

    // 5. Like Button & Animation
    if (dom.likeBtn) {
        dom.likeBtn.addEventListener('click', () => {
            if (!state.currentSong) return;
            if (state.currentSong.previewUrl) {
                const idx = state.likedPreviews.findIndex(s => s.id === state.currentSong.id);
                if (idx >= 0) {
                    state.likedPreviews.splice(idx, 1);
                    state.currentSong.liked = false;
                } else {
                    state.likedPreviews.push({ ...state.currentSong });
                    state.currentSong.liked = true;
                    triggerHeartBurst(dom.likeBtn);
                }
                saveLikedPreviews(state.likedPreviews);
            } else {
                state.currentSong.liked = !state.currentSong.liked;
                if (state.currentSong.liked) {
                    state.likedIds.add(state.currentSong.id);
                    triggerHeartBurst(dom.likeBtn);
                } else {
                    state.likedIds.delete(state.currentSong.id);
                }
                saveLikedIds(state.likedIds);
            }
            updateLikeIcon(dom);
            renderPlaylistPanel(dom);
        });
    }

    // 6. Decade Filter Chips
    if (dom.decadeFilterBar) {
        dom.decadeFilterBar.querySelectorAll('.decade-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.decade;
                if (state.activeDecadeFilter === chosen) return;
                state.activeDecadeFilter = chosen;
                updateDecadeChipStyles(dom.decadeFilterBar);
                preloadNextDiceSong(chosen);
                if (dom.playlistPanel && dom.playlistPanel.dataset.mode === 'browse') {
                    renderPlaylistPanel(dom);
                }
            });
        });
    }

    // 7. Navigation Buttons & Modals
    if (dom.discoverBtn) {
        dom.discoverBtn.addEventListener('click', () => {
            if (dom.searchModal) {
                dom.searchModal.classList.remove('hidden');
                if (dom.searchInput) {
                    dom.searchInput.value = '';
                    dom.searchInput.focus();
                }
                if (dom.searchResults) dom.searchResults.innerHTML = '';
                if (dom.searchStatus) dom.searchStatus.textContent = 'Type a classic Hindi song or artist…';
            }
        });
    }

    if (dom.myLikesBtn) {
        dom.myLikesBtn.addEventListener('click', () => {
            if (dom.playlistPanel) {
                dom.playlistPanel.dataset.mode = 'likes';
                dom.playlistPanel.classList.remove('hidden');
                renderPlaylistPanel(dom);
            }
        });
    }

    if (dom.closePlaylistBtn) {
        dom.closePlaylistBtn.addEventListener('click', () => {
            if (dom.playlistPanel) dom.playlistPanel.classList.add('hidden');
        });
    }

    // 8. Search & Play Modal
    let searchDebounce = null;
    if (dom.searchCloseBtn) {
        dom.searchCloseBtn.addEventListener('click', () => {
            if (dom.searchModal) dom.searchModal.classList.add('hidden');
        });
    }

    if (dom.searchInput) {
        dom.searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            const q = dom.searchInput.value.trim();
            if (!q) {
                if (dom.searchResults) dom.searchResults.innerHTML = '';
                if (dom.searchStatus) dom.searchStatus.textContent = 'Type a classic Hindi song or artist…';
                return;
            }
            if (dom.searchStatus) dom.searchStatus.textContent = 'Searching JioSaavn…';
            searchDebounce = setTimeout(async () => {
                const results = await fetchFullSongs(q);
                if (dom.searchModal && dom.searchModal.classList.contains('hidden')) return;
                if (dom.searchResults) dom.searchResults.innerHTML = '';
                if (!results.length) {
                    if (dom.searchStatus) dom.searchStatus.textContent = 'No matching songs found. Try different words.';
                    return;
                }
                if (dom.searchStatus) dom.searchStatus.textContent = `${results.length} songs found:`;
                results.forEach(song => {
                    const li = document.createElement('li');
                    li.className = 'flex items-center gap-3 p-2.5 rounded-xl hover:bg-amber-500/10 cursor-pointer transition-all border border-transparent hover:border-amber-500/30';
                    li.innerHTML = `
                        <img src="${song.artwork || 'models/main.webp'}" class="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-stone-800" />
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-semibold text-stone-100 truncate">${escapeHtml(song.title)}</p>
                            <p class="text-[10px] text-stone-400 truncate">${escapeHtml(song.artist)} · ${DECADE_LABELS[song.decade] || song.decade}</p>
                        </div>
                        <span class="text-[10px] text-amber-300/90 bg-amber-900/40 px-2 py-0.5 rounded-full flex-shrink-0 border border-amber-500/30 font-medium">Play ▶</span>
                    `;
                    li.addEventListener('click', () => {
                        if (dom.searchModal) dom.searchModal.classList.add('hidden');
                        state.currentPreviewList = results;
                        playPreviewSong(song, results.indexOf(song));
                    });
                    if (dom.searchResults) dom.searchResults.appendChild(li);
                });
            }, 320);
        });
    }

    // 9. File Upload & Tag Modal
    let pendingFilesList = [];

    if (dom.addSongBtn) {
        dom.addSongBtn.addEventListener('click', () => {
            if (dom.fileInput) dom.fileInput.click();
        });
    }
    if (dom.uploadTrigger) {
        dom.uploadTrigger.addEventListener('click', () => {
            if (dom.fileInput) dom.fileInput.click();
        });
    }

    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i));
            if (!files.length) return;
            pendingFilesList = files;
            if (dom.tagModal) dom.tagModal.classList.remove('hidden');
        });
    }

    if (dom.tagConfirmBtn) {
        dom.tagConfirmBtn.addEventListener('click', () => {
            const decade = dom.tagDecadeSelect ? dom.tagDecadeSelect.value : '20s';
            pendingFilesList.forEach(file => {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                let artist = "Local Audio";
                let title = nameWithoutExt.trim();
                const parts = nameWithoutExt.split(/ - | – /);
                if (parts.length > 1) {
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' - ').trim();
                }
                const newSong = {
                    id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                    title: title,
                    artist: artist,
                    decade: decade,
                    file: file,
                    liked: false
                };
                state.library.unshift(newSong);
            });
            if (dom.tagModal) dom.tagModal.classList.add('hidden');
            pendingFilesList = [];
            if (dom.fileInput) dom.fileInput.value = '';
            renderPlaylistPanel(dom);
            if (state.library.length > 0) playFromLibrary(0);
        });
    }

    if (dom.tagCancelBtn) {
        dom.tagCancelBtn.addEventListener('click', () => {
            if (dom.tagModal) dom.tagModal.classList.add('hidden');
            pendingFilesList = [];
            if (dom.fileInput) dom.fileInput.value = '';
        });
    }

    // 10. Diet Coke Easter Egg
    if (dom.hiddenDietCoke) {
        dom.hiddenDietCoke.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dom.dietCokeNotification) {
                dom.dietCokeNotification.classList.remove('hidden');
                setTimeout(() => dom.dietCokeNotification.classList.add('hidden'), 3500);
            }
        });
    }

    // 11. Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        } else if (e.code === 'Enter') {
            e.preventDefault();
            playRandomDiceSong();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            if (dom.prevBtn) dom.prevBtn.click();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            if (dom.nextBtn) dom.nextBtn.click();
        }
    });
});
