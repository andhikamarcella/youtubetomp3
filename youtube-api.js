// YouTube API Integration for Music Streaming
class YouTubeMusicAPI {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY || '';
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    }

    // Search for music videos
    async searchMusic(query, maxResults = 20) {
        if (!this.apiKey) {
            console.warn('YouTube API key not configured, using sample data');
            return this.getSampleSearchResults(query);
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&videoCategoryId=10&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.formatSearchResults(data.items);
        } catch (error) {
            console.error('YouTube API search failed:', error);
            return this.getSampleSearchResults(query);
        }
    }

    // Get video details including audio streaming info
    async getVideoDetails(videoId) {
        if (!this.apiKey) {
            return this.getSampleVideoDetails(videoId);
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/videos?part=contentDetails,snippet&id=${videoId}&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.formatVideoDetails(data.items[0]);
        } catch (error) {
            console.error('Failed to get video details:', error);
            return this.getSampleVideoDetails(videoId);
        }
    }

    // Get popular music videos
    async getPopularMusic(regionCode = 'ID', maxResults = 20) {
        if (!this.apiKey) {
            return this.getSamplePopularMusic();
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=10&regionCode=${regionCode}&maxResults=${maxResults}&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.formatSearchResults(data.items);
        } catch (error) {
            console.error('Failed to get popular music:', error);
            return this.getSamplePopularMusic();
        }
    }

    // Get music playlists
    async getMusicPlaylists(maxResults = 10) {
        if (!this.apiKey) {
            return this.getSamplePlaylists();
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/search?part=snippet&type=playlist&q=music%20playlist&maxResults=${maxResults}&key=${this.apiKey}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.formatPlaylistResults(data.items);
        } catch (error) {
            console.error('Failed to get playlists:', error);
            return this.getSamplePlaylists();
        }
    }

    // Format search results
    formatSearchResults(items) {
        return items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            artist: this.extractArtistFromTitle(item.snippet.title),
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            description: item.snippet.description
        }));
    }

    // Format video details
    formatVideoDetails(item) {
        const duration = this.parseDuration(item.contentDetails.duration);
        
        return {
            id: item.id,
            title: item.snippet.title,
            artist: this.extractArtistFromTitle(item.snippet.title),
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            description: item.snippet.description,
            duration: this.formatDuration(duration),
            durationSeconds: duration
        };
    }

    // Format playlist results
    formatPlaylistResults(items) {
        return items.map(item => ({
            id: item.id.playlistId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt
        }));
    }

    // Extract artist name from title (simple heuristic)
    extractArtistFromTitle(title) {
        // Common patterns: "Artist - Song", "Song (Artist)", "Artist: Song"
        const patterns = [
            /^(.+?)\s*[-–—]\s*(.+)$/, // Artist - Song
            /^(.+?)\s*[:]\s*(.+)$/,   // Artist: Song
            /^(.+?)\s*\[(.+?)\]$/,    // Song [Artist]
            /^(.+?)\s*\((.+?)\)$/     // Song (Artist)
        ];

        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match) {
                // Return the shorter part as it's likely the artist name
                return match[1].length < match[2].length ? match[1].trim() : match[2].trim();
            }
        }

        // If no pattern matches, try to extract from common music video formats
        if (title.toLowerCase().includes('official') || title.toLowerCase().includes('music video')) {
            const parts = title.split(/\s+(?:official|music|video)/i)[0].trim();
            return parts.split(/\s*[-–—:]\s*/)[0].trim();
        }

        return 'Unknown Artist';
    }

    // Parse ISO 8601 duration
    parseDuration(duration) {
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;

        return hours * 3600 + minutes * 60 + seconds;
    }

    // Format duration in MM:SS or H:MM:SS
    formatDuration(seconds) {
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Sample data methods (fallback when API is not available)
    getSampleSearchResults(query) {
        const sampleTracks = [
            {
                id: 'dQw4w9WgXcQ',
                title: `${query} - Official Music Video`,
                artist: 'Sample Artist',
                thumbnail: 'https://picsum.photos/seed/search1/300/300',
                channelTitle: 'Sample Channel',
                publishedAt: '2023-01-01T00:00:00Z',
                description: 'Sample music video'
            },
            {
                id: 'jNQXAC9IVRw',
                title: `${query} - Live Performance`,
                artist: 'Live Artist',
                thumbnail: 'https://picsum.photos/seed/search2/300/300',
                channelTitle: 'Live Channel',
                publishedAt: '2023-02-01T00:00:00Z',
                description: 'Live performance video'
            }
        ];

        return sampleTracks.filter(track => 
            track.title.toLowerCase().includes(query.toLowerCase()) ||
            track.artist.toLowerCase().includes(query.toLowerCase())
        );
    }

    getSampleVideoDetails(videoId) {
        return {
            id: videoId,
            title: 'Sample Song Title',
            artist: 'Sample Artist',
            thumbnail: 'https://picsum.photos/seed/details/300/300',
            channelTitle: 'Sample Channel',
            publishedAt: '2023-01-01T00:00:00Z',
            description: 'Sample video description',
            duration: '3:45',
            durationSeconds: 225
        };
    }

    getSamplePopularMusic() {
        return [
            {
                id: 'popular1',
                title: 'Popular Song 1',
                artist: 'Famous Artist',
                thumbnail: 'https://picsum.photos/seed/pop1/300/300',
                channelTitle: 'Music Channel',
                publishedAt: '2023-12-01T00:00:00Z',
                description: 'Most popular song this month'
            },
            {
                id: 'popular2',
                title: 'Popular Song 2',
                artist: 'Rising Star',
                thumbnail: 'https://picsum.photos/seed/pop2/300/300',
                channelTitle: 'Trending Channel',
                publishedAt: '2023-12-02T00:00:00Z',
                description: 'Trending worldwide'
            },
            {
                id: 'popular3',
                title: 'Popular Song 3',
                artist: 'Super Star',
                thumbnail: 'https://picsum.photos/seed/pop3/300/300',
                channelTitle: 'Official Channel',
                publishedAt: '2023-12-03T00:00:00Z',
                description: 'Chart topper'
            }
        ];
    }

    getSamplePlaylists() {
        return [
            {
                id: 'playlist1',
                title: 'Chill Vibes Playlist',
                description: 'Relaxing music for your mood',
                thumbnail: 'https://picsum.photos/seed/playlist1/300/300',
                channelTitle: 'Music Curator',
                publishedAt: '2023-11-01T00:00:00Z'
            },
            {
                id: 'playlist2',
                title: 'Workout Energy',
                description: 'High energy music for workouts',
                thumbnail: 'https://picsum.photos/seed/playlist2/300/300',
                channelTitle: 'Fitness Music',
                publishedAt: '2023-11-15T00:00:00Z'
            },
            {
                id: 'playlist3',
                title: 'Study Focus',
                description: 'Concentration music for studying',
                thumbnail: 'https://picsum.photos/seed/playlist3/300/300',
                channelTitle: 'Study Beats',
                publishedAt: '2023-10-20T00:00:00Z'
            }
        ];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = YouTubeMusicAPI;
} else {
    window.YouTubeMusicAPI = YouTubeMusicAPI;
}
