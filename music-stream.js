// YouTube Music Streaming Application
class YouTubeMusicStreamer {
    constructor() {
        this.currentTrack = null;
        this.isPlaying = false;
        this.currentPlaylist = [];
        this.currentIndex = 0;
        this.volume = 0.7;
        this.isMuted = false;
        this.youtubeAPI = new YouTubeMusicAPI();
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.loadSampleData();
        this.initializeAudioPlayer();
        this.loadYouTubeData();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(item.dataset.page);
            });
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Audio player events
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        audioPlayer.addEventListener('ended', () => this.nextTrack());
        audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
    }

    initializeAudioPlayer() {
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.volume = this.volume;
    }

    async loadYouTubeData() {
        try {
            // Load popular music from YouTube API
            const popularMusic = await this.youtubeAPI.getPopularMusic();
            if (popularMusic.length > 0) {
                this.sampleTracks = popularMusic.map(track => ({
                    ...track,
                    url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${Math.floor(Math.random() * 10) + 1}.mp3`
                }));
            }
        } catch (error) {
            console.log('Using sample data due to API limitations');
        }
        
        this.renderHomePage();
    }

    loadSampleData() {
        // Fallback sample music data if API is not available
        if (!this.sampleTracks || this.sampleTracks.length === 0) {
            this.sampleTracks = [
                {
                    id: 'dQw4w9WgXcQ',
                    title: 'Never Gonna Give You Up',
                    artist: 'Rick Astley',
                    thumbnail: 'https://picsum.photos/seed/rickroll/300/300',
                    duration: '3:33',
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                },
                {
                    id: 'jNQXAC9IVRw',
                    title: 'Me at the zoo',
                    artist: 'jawed',
                    thumbnail: 'https://picsum.photos/seed/zoo/300/300',
                    duration: '0:18',
                    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
                },
                {
                    id: '9bZkp7q19f0',
                    title: 'Gangnam Style',
                    artist: 'PSY',
                    thumbnail: 'https://picsum.photos/seed/gangnam/300/300',
                    duration: '4:13',
                    url: 'https://www.youtube.com/watch?v=9bZkp7q19f0'
                },
                {
                    id: 'kJQP7kiw5Fk',
                    title: 'Despacito',
                    artist: 'Luis Fonsi ft. Daddy Yankee',
                    thumbnail: 'https://picsum.photos/seed/despacito/300/300',
                    duration: '4:41',
                    url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk'
                },
                {
                    id: 'RgKAFK5djSk',
                    title: 'Shape of You',
                    artist: 'Ed Sheeran',
                    thumbnail: 'https://picsum.photos/seed/shapeofyou/300/300',
                    duration: '3:54',
                    url: 'https://www.youtube.com/watch?v=RgKAFK5djSk'
                },
                {
                    id: 'kTJczUoc26U',
                    title: 'Perfect',
                    artist: 'Ed Sheeran',
                    thumbnail: 'https://picsum.photos/seed/perfect/300/300',
                    duration: '4:23',
                    url: 'https://www.youtube.com/watch?v=kTJczUoc26U'
                }
            ];
        }
    }

    renderHomePage() {
        this.renderGrid('recommendedGrid', this.sampleTracks.slice(0, 3));
        this.renderGrid('trendingGrid', this.sampleTracks.slice(2, 5));
        this.renderPlaylists();
    }

    renderGrid(gridId, tracks) {
        const grid = document.getElementById(gridId);
        grid.innerHTML = tracks.map(track => `
            <div class="music-card" onclick="musicStreamer.playTrack('${track.id}')">
                <img src="${track.thumbnail}" alt="${track.title}" class="music-thumbnail">
                <h6 class="mb-1">${track.title}</h6>
                <p class="text-secondary mb-0">${track.artist}</p>
                <small class="text-secondary">${track.duration}</small>
            </div>
        `).join('');
    }

    renderPlaylists() {
        const playlists = [
            { name: 'Chill Vibes', count: 25, thumbnail: 'https://picsum.photos/seed/chill/300/300' },
            { name: 'Workout Energy', count: 30, thumbnail: 'https://picsum.photos/seed/workout/300/300' },
            { name: 'Study Focus', count: 40, thumbnail: 'https://picsum.photos/seed/study/300/300' },
            { name: 'Party Hits', count: 35, thumbnail: 'https://picsum.photos/seed/party/300/300' }
        ];

        const grid = document.getElementById('playlistGrid');
        grid.innerHTML = playlists.map(playlist => `
            <div class="music-card" onclick="musicStreamer.openPlaylist('${playlist.name}')">
                <img src="${playlist.thumbnail}" alt="${playlist.name}" class="music-thumbnail">
                <h6 class="mb-1">${playlist.name}</h6>
                <p class="text-secondary mb-0">${playlist.count} lagu</p>
            </div>
        `).join('');
    }

    playTrack(trackId) {
        const track = this.sampleTracks.find(t => t.id === trackId);
        if (!track) return;

        this.currentTrack = track;
        this.currentPlaylist = this.sampleTracks;
        this.currentIndex = this.currentPlaylist.findIndex(t => t.id === trackId);

        // Use YouTube embed instead of audio
        this.playYouTubeVideo(trackId);
        
        this.updatePlayerUI();
        this.isPlaying = true;
        this.updatePlayPauseButton();
    }

    playYouTubeVideo(videoId) {
        const youtubeContainer = document.getElementById('youtubeContainer');
        const youtubePlayer = document.getElementById('youtubePlayer');
        
        // Show YouTube player
        youtubeContainer.style.display = 'block';
        
        // Set YouTube embed URL with autoplay and enable JS API
        youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&showinfo=0&controls=1&modestbranding=1&enablejsapi=1&origin=${window.location.origin}`;
    }

    updatePlayerUI() {
        if (!this.currentTrack) return;

        document.getElementById('currentTrackTitle').textContent = this.currentTrack.title;
        document.getElementById('currentTrackArtist').textContent = this.currentTrack.artist;
    }

    togglePlayPause() {
        const youtubePlayer = document.getElementById('youtubePlayer');
        
        if (this.isPlaying) {
            // Pause YouTube video
            youtubePlayer.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        } else {
            // Play YouTube video
            if (!this.currentTrack && this.sampleTracks.length > 0) {
                this.playTrack(this.sampleTracks[0].id);
                return;
            }
            youtubePlayer.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        }
        
        this.isPlaying = !this.isPlaying;
        this.updatePlayPauseButton();
    }

    updatePlayPauseButton() {
        const btn = document.getElementById('playPauseBtn');
        btn.innerHTML = this.isPlaying ? 
            '<i class="bi bi-pause-fill"></i>' : 
            '<i class="bi bi-play-fill"></i>';
    }

    nextTrack() {
        if (this.currentPlaylist.length === 0) return;
        
        this.currentIndex = (this.currentIndex + 1) % this.currentPlaylist.length;
        const nextTrack = this.currentPlaylist[this.currentIndex];
        this.playTrack(nextTrack.id);
    }

    previousTrack() {
        if (this.currentPlaylist.length === 0) return;
        
        this.currentIndex = this.currentIndex === 0 ? 
            this.currentPlaylist.length - 1 : this.currentIndex - 1;
        const prevTrack = this.currentPlaylist[this.currentIndex];
        this.playTrack(prevTrack.id);
    }

    updateProgress() {
        const audioPlayer = document.getElementById('audioPlayer');
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        
        document.getElementById('progressFilled').style.width = `${progress}%`;
        document.getElementById('currentTime').textContent = this.formatTime(audioPlayer.currentTime);
    }

    updateDuration() {
        const audioPlayer = document.getElementById('audioPlayer');
        document.getElementById('totalTime').textContent = this.formatTime(audioPlayer.duration);
    }

    seekTrack(event) {
        const audioPlayer = document.getElementById('audioPlayer');
        const progressBar = document.getElementById('progressBar');
        const clickX = event.offsetX;
        const width = progressBar.offsetWidth;
        const percentage = clickX / width;
        
        audioPlayer.currentTime = percentage * audioPlayer.duration;
    }

    changeVolume(value) {
        this.volume = value / 100;
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.volume = this.volume;
        this.updateVolumeIcon();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.muted = this.isMuted;
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const icon = document.getElementById('volumeIcon');
        if (this.isMuted || this.volume === 0) {
            icon.className = 'bi bi-volume-mute';
        } else if (this.volume < 0.5) {
            icon.className = 'bi bi-volume-down';
        } else {
            icon.className = 'bi bi-volume-up';
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.renderHomePage();
            return;
        }

        const filtered = this.sampleTracks.filter(track => 
            track.title.toLowerCase().includes(query.toLowerCase()) ||
            track.artist.toLowerCase().includes(query.toLowerCase())
        );

        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <h2 class="section-title">Hasil Pencarian: "${query}"</h2>
            <div class="grid-container">
                ${filtered.map(track => `
                    <div class="music-card" onclick="musicStreamer.playTrack('${track.id}')">
                        <img src="${track.thumbnail}" alt="${track.title}" class="music-thumbnail">
                        <h6 class="mb-1">${track.title}</h6>
                        <p class="text-secondary mb-0">${track.artist}</p>
                        <small class="text-secondary">${track.duration}</small>
                    </div>
                `).join('')}
            </div>
        `;
    }

    navigateTo(page) {
        // Update active navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // Update content based on page
        const contentArea = document.getElementById('contentArea');
        
        switch(page) {
            case 'home':
                this.renderHomePage();
                break;
            case 'explore':
                contentArea.innerHTML = `
                    <h2 class="section-title">Jelajahi Musik</h2>
                    <div class="grid-container">
                        ${this.sampleTracks.map(track => `
                            <div class="music-card" onclick="musicStreamer.playTrack('${track.id}')">
                                <img src="${track.thumbnail}" alt="${track.title}" class="music-thumbnail">
                                <h6 class="mb-1">${track.title}</h6>
                                <p class="text-secondary mb-0">${track.artist}</p>
                                <small class="text-secondary">${track.duration}</small>
                            </div>
                        `).join('')}
                    </div>
                `;
                break;
            case 'library':
                contentArea.innerHTML = `
                    <h2 class="section-title">Perpustakaan Musik</h2>
                    <div class="text-center py-5">
                        <i class="bi bi-music-note-list" style="font-size: 64px; color: var(--yt-text-secondary);"></i>
                        <p class="text-secondary mt-3">Musik yang Anda simpan akan muncul di sini</p>
                    </div>
                `;
                break;
            case 'favorites':
                contentArea.innerHTML = `
                    <h2 class="section-title">Lagu Favorit</h2>
                    <div class="text-center py-5">
                        <i class="bi bi-heart" style="font-size: 64px; color: var(--yt-text-secondary);"></i>
                        <p class="text-secondary mt-3">Belum ada lagu favorit</p>
                    </div>
                `;
                break;
            case 'history':
                contentArea.innerHTML = `
                    <h2 class="section-title">Riwayat Pemutaran</h2>
                    <div class="text-center py-5">
                        <i class="bi bi-clock-history" style="font-size: 64px; color: var(--yt-text-secondary);"></i>
                        <p class="text-secondary mt-3">Belum ada riwayat pemutaran</p>
                    </div>
                `;
                break;
            case 'playlists':
                this.renderPlaylists();
                break;
        }
    }

    openPlaylist(playlistName) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <h2 class="section-title">${playlistName}</h2>
            <div class="mb-3">
                <button class="btn btn-danger btn-sm" onclick="musicStreamer.playAll()">
                    <i class="bi bi-play-fill"></i> Putar Semua
                </button>
            </div>
            <div>
                ${this.sampleTracks.map((track, index) => `
                    <div class="playlist-item" onclick="musicStreamer.playTrackFromPlaylist('${track.id}', ${index})">
                        <img src="${track.thumbnail}" alt="${track.title}" class="playlist-thumbnail">
                        <div class="playlist-info">
                            <div class="playlist-title">${track.title}</div>
                            <div class="playlist-artist">${track.artist}</div>
                        </div>
                        <div class="playlist-duration">${track.duration}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    playTrackFromPlaylist(trackId, index) {
        this.currentPlaylist = [...this.sampleTracks];
        this.currentIndex = index;
        this.playTrack(trackId);
    }

    playAll() {
        if (this.sampleTracks.length > 0) {
            this.playTrackFromPlaylist(this.sampleTracks[0].id, 0);
        }
    }
}

// Global functions
function closeAnnouncement() {
    const banner = document.getElementById('announcementBanner');
    banner.style.display = 'none';
}

function closeYouTubePlayer() {
    const youtubeContainer = document.getElementById('youtubeContainer');
    const youtubePlayer = document.getElementById('youtubePlayer');
    
    youtubeContainer.style.display = 'none';
    youtubePlayer.src = '';
    
    if (musicStreamer) {
        musicStreamer.isPlaying = false;
        musicStreamer.updatePlayPauseButton();
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
}

function toggleTheme() {
    const html = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    
    if (html.getAttribute('data-bs-theme') === 'dark') {
        html.setAttribute('data-bs-theme', 'light');
        themeIcon.className = 'bi bi-sun';
    } else {
        html.setAttribute('data-bs-theme', 'dark');
        themeIcon.className = 'bi bi-moon';
    }
}

function showSettings() {
    alert('Pengaturan akan segera hadir!');
}

function togglePlayPause() {
    musicStreamer.togglePlayPause();
}

function nextTrack() {
    musicStreamer.nextTrack();
}

function previousTrack() {
    musicStreamer.previousTrack();
}

function seekTrack(event) {
    musicStreamer.seekTrack(event);
}

function changeVolume(value) {
    musicStreamer.changeVolume(value);
}

function toggleMute() {
    musicStreamer.toggleMute();
}

// Initialize the app
const musicStreamer = new YouTubeMusicStreamer();
