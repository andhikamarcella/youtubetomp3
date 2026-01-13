// Announcement System for YouTube Music Streaming
class AnnouncementSystem {
    constructor() {
        this.announcements = [];
        this.userPreferences = this.loadUserPreferences();
        this.apiEndpoint = '/api/announcements';
        this.initializeSystem();
    }

    initializeSystem() {
        this.loadAnnouncements();
        this.setupRealtimeUpdates();
        this.checkForNewAnnouncements();
    }

    // Load user preferences from localStorage
    loadUserPreferences() {
        const stored = localStorage.getItem('announcementPreferences');
        return stored ? JSON.parse(stored) : {
            showUpdates: true,
            showPromotions: false,
            showMaintenance: true,
            soundEnabled: false,
            autoHideDelay: 5000,
            dismissedAnnouncements: []
        };
    }

    // Save user preferences
    saveUserPreferences() {
        localStorage.setItem('announcementPreferences', JSON.stringify(this.userPreferences));
    }

    // Load announcements from server or fallback to sample data
    async loadAnnouncements() {
        try {
            // Try to load from server API
            const response = await fetch(this.apiEndpoint);
            if (response.ok) {
                this.announcements = await response.json();
            } else {
                throw new Error('API not available');
            }
        } catch (error) {
            console.log('Loading sample announcements...');
            this.announcements = this.getSampleAnnouncements();
        }
        
        this.filterAndShowAnnouncements();
    }

    // Get sample announcements for demo
    getSampleAnnouncements() {
        return [
            {
                id: 'welcome-2024',
                type: 'info',
                priority: 'high',
                title: '🎉 Selamat Datang di YouTube Music Streaming!',
                message: 'Nikmati pengalaman streaming musik YouTube dengan kualitas terbaik. Fitur playlist pribadi dan favorit sudah tersedia!',
                icon: '🎵',
                persistent: false,
                autoHide: 8000,
                actions: [
                    { label: 'Mulai Mendengarkan', action: 'startListening', style: 'primary' },
                    { label: 'Pelajari Lebih Lanjut', action: 'learnMore', style: 'secondary' }
                ],
                createdAt: new Date().toISOString(),
                expiresAt: null,
                targetAudience: 'all'
            },
            {
                id: 'update-audio-hd',
                type: 'update',
                priority: 'medium',
                title: '🚀 Update Terbaru: Kualitas Audio HD',
                message: 'Sekarang Anda bisa menikmati musik dengan kualitas audio HD (320kbps) untuk pengalaman mendengarkan yang lebih baik.',
                icon: '🎧',
                persistent: false,
                autoHide: 6000,
                actions: [
                    { label: 'Aktifkan HD', action: 'enableHD', style: 'primary' },
                    { label: 'Nanti Saja', action: 'dismiss', style: 'secondary' }
                ],
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                expiresAt: new Date(Date.now() + 604800000).toISOString(),
                targetAudience: 'premium'
            },
            {
                id: 'maintenance-scheduled',
                type: 'maintenance',
                priority: 'high',
                title: '🔧 Pemeliharaan Terjadwal',
                message: 'Sistem akan melakukan pemeliharaan pada hari Minggu pukul 02:00 - 04:00 WIB. Layanan mungkin tidak tersedia sementara.',
                icon: '⚠️',
                persistent: true,
                autoHide: null,
                actions: [
                    { label: 'Mengerti', action: 'dismiss', style: 'primary' }
                ],
                createdAt: new Date(Date.now() - 172800000).toISOString(),
                expiresAt: new Date(Date.now() + 259200000).toISOString(),
                targetAudience: 'all'
            },
            {
                id: 'new-playlist-feature',
                type: 'feature',
                priority: 'low',
                title: '✨ Fitur Baru: Kolaborasi Playlist',
                message: 'Sekarang Anda bisa berkolaborasi membuat playlist dengan teman-teman. Undang mereka dan buat playlist bersama!',
                icon: '👥',
                persistent: false,
                autoHide: 7000,
                actions: [
                    { label: 'Coba Sekarang', action: 'tryFeature', style: 'primary' },
                    { label: 'Lihat Tutorial', action: 'viewTutorial', style: 'secondary' }
                ],
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                expiresAt: new Date(Date.now() + 1209600000).toISOString(),
                targetAudience: 'all'
            }
        ];
    }

    // Filter announcements based on user preferences and dismissed items
    filterAndShowAnnouncements() {
        const validAnnouncements = this.announcements.filter(announcement => {
            // Check if expired
            if (announcement.expiresAt && new Date(announcement.expiresAt) < new Date()) {
                return false;
            }

            // Check if dismissed
            if (this.userPreferences.dismissedAnnouncements.includes(announcement.id)) {
                return false;
            }

            // Check user preferences for type
            if (!this.userPreferences.showUpdates && announcement.type === 'update') return false;
            if (!this.userPreferences.showPromotions && announcement.type === 'promotion') return false;
            if (!this.userPreferences.showMaintenance && announcement.type === 'maintenance') return false;

            return true;
        });

        // Sort by priority
        validAnnouncements.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        // Show the highest priority announcement
        if (validAnnouncements.length > 0) {
            this.showAnnouncement(validAnnouncements[0]);
        }
    }

    // Show announcement banner
    showAnnouncement(announcement) {
        const banner = document.getElementById('announcementBanner');
        const textElement = document.getElementById('announcementText');
        
        if (!banner || !textElement) return;

        // Set announcement content
        textElement.innerHTML = `
            <span class="announcement-icon">${announcement.icon}</span>
            <strong>${announcement.title}</strong>
            ${announcement.message}
            ${this.renderActions(announcement.actions)}
        `;

        // Store announcement ID for dismissal
        banner.dataset.announcementId = announcement.id;
        banner.dataset.announcementType = announcement.type;

        // Show banner with animation
        banner.style.display = 'block';
        banner.style.animation = 'slideDown 0.3s ease-out';

        // Auto-hide if specified
        if (announcement.autoHide && !announcement.persistent) {
            setTimeout(() => {
                this.hideAnnouncement();
            }, announcement.autoHide);
        }

        // Play sound if enabled
        if (this.userPreferences.soundEnabled) {
            this.playNotificationSound();
        }
    }

    // Render action buttons
    renderActions(actions) {
        if (!actions || actions.length === 0) return '';

        return actions.map(action => `
            <button class="btn btn-sm btn-${action.style} ms-2" 
                    onclick="announcementSystem.handleAction('${action.action}', '${action.label}')">
                ${action.label}
            </button>
        `).join('');
    }

    // Handle announcement actions
    handleAction(action, label) {
        const banner = document.getElementById('announcementBanner');
        const announcementId = banner.dataset.announcementId;

        switch (action) {
            case 'startListening':
                this.hideAnnouncement();
                // Navigate to home or start playing
                if (window.musicStreamer) {
                    window.musicStreamer.playTrack(window.musicStreamer.sampleTracks[0].id);
                }
                break;

            case 'learnMore':
                this.hideAnnouncement();
                // Show tutorial or help page
                alert('Tutorial akan segera hadir!');
                break;

            case 'enableHD':
                this.enableHDQuality();
                this.dismissAnnouncement(announcementId);
                break;

            case 'tryFeature':
                this.hideAnnouncement();
                // Navigate to playlist collaboration feature
                alert('Fitur kolaborasi playlist akan segera hadir!');
                break;

            case 'viewTutorial':
                this.hideAnnouncement();
                alert('Tutorial akan segera hadir!');
                break;

            case 'dismiss':
                this.dismissAnnouncement(announcementId);
                break;

            default:
                console.log('Unknown action:', action);
        }
    }

    // Hide announcement banner
    hideAnnouncement() {
        const banner = document.getElementById('announcementBanner');
        if (banner) {
            banner.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => {
                banner.style.display = 'none';
            }, 300);
        }
    }

    // Dismiss announcement
    dismissAnnouncement(announcementId) {
        if (!this.userPreferences.dismissedAnnouncements.includes(announcementId)) {
            this.userPreferences.dismissedAnnouncements.push(announcementId);
            this.saveUserPreferences();
        }
        this.hideAnnouncement();
        
        // Show next announcement if available
        setTimeout(() => {
            this.filterAndShowAnnouncements();
        }, 500);
    }

    // Enable HD quality
    enableHDQuality() {
        // Save HD preference
        localStorage.setItem('audioQuality', 'high');
        
        // Show confirmation
        this.showQuickNotification('✅ Kualitas audio HD telah diaktifkan!', 'success');
    }

    // Show quick notification (toast)
    showQuickNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
        toast.style.zIndex = '9999';
        toast.style.minWidth = '300px';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Play notification sound
    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Ignore autoplay errors
            });
        } catch (error) {
            // Ignore audio errors
        }
    }

    // Setup real-time updates (WebSocket or polling)
    setupRealtimeUpdates() {
        // In a real implementation, this would use WebSocket or Server-Sent Events
        // For demo, we'll check for updates every 30 seconds
        setInterval(() => {
            this.checkForNewAnnouncements();
        }, 30000);
    }

    // Check for new announcements
    async checkForNewAnnouncements() {
        try {
            const response = await fetch(`${this.apiEndpoint}/check`, {
                headers: {
                    'If-Modified-Since': localStorage.getItem('lastAnnouncementCheck') || ''
                }
            });

            if (response.status === 200) {
                // New announcements available
                await this.loadAnnouncements();
                localStorage.setItem('lastAnnouncementCheck', new Date().toUTCString());
            }
        } catch (error) {
            // Ignore errors, use cached data
        }
    }

    // Public method to add new announcement (for admin use)
    addAnnouncement(announcement) {
        announcement.id = announcement.id || `announcement-${Date.now()}`;
        announcement.createdAt = announcement.createdAt || new Date().toISOString();
        
        this.announcements.unshift(announcement);
        this.filterAndShowAnnouncements();
    }

    // Public method to remove announcement
    removeAnnouncement(announcementId) {
        this.announcements = this.announcements.filter(a => a.id !== announcementId);
    }

    // Get announcement statistics
    getStats() {
        return {
            total: this.announcements.length,
            active: this.announcements.filter(a => 
                !this.userPreferences.dismissedAnnouncements.includes(a.id) &&
                (!a.expiresAt || new Date(a.expiresAt) > new Date())
            ).length,
            dismissed: this.userPreferences.dismissedAnnouncements.length
        };
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    @keyframes slideUp {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(-100%);
            opacity: 0;
        }
    }

    .announcement-icon {
        margin-right: 8px;
        font-size: 1.2em;
    }

    .announcement-banner .btn {
        margin-left: 8px;
    }
`;
document.head.appendChild(style);

// Initialize the announcement system
const announcementSystem = new AnnouncementSystem();

// Make it globally available
window.announcementSystem = announcementSystem;
