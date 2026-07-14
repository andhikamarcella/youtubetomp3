(() => {
  'use strict';

  const MUSIC_URL = 'https://music.youtube.com/';
  const MOBILE_MAX_WIDTH = 991.98;

  const onReady = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  };

  const openYouTubeMusic = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

    if (isAndroid) {
      window.location.href = 'intent://music.youtube.com/#Intent;scheme=https;package=com.google.android.apps.youtube.music;S.browser_fallback_url=https://music.youtube.com/;end';
      return;
    }

    if (isIOS) {
      window.location.href = MUSIC_URL;
      return;
    }

    window.open(MUSIC_URL, '_blank', 'noopener,noreferrer');
  };

  const injectStyles = () => {
    if (document.getElementById('ytconv-ui-enhancements-style')) return;

    const style = document.createElement('style');
    style.id = 'ytconv-ui-enhancements-style';
    style.textContent = `
      :root {
        --ytconv-music: #ff0033;
        --ytconv-music-dark: #c70029;
        --ytconv-music-soft: rgba(255, 0, 51, .10);
        --ytconv-blue-soft: rgba(37, 99, 235, .10);
      }

      body.tw-enhanced.ytclean-ui .ytclean-sidebar {
        border-right-color: rgba(148, 163, 184, .28) !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-brand-mark {
        background: linear-gradient(135deg, #2563eb, #0ea5e9) !important;
        border-color: transparent !important;
        color: #fff !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-link {
        transition: background-color .16s ease, border-color .16s ease, color .16s ease, transform .16s ease !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-link:hover {
        transform: translateX(2px) !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-link.is-active {
        border-color: rgba(96, 165, 250, .35) !important;
        box-shadow: inset 3px 0 0 #3b82f6 !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-music-link {
        background: var(--ytconv-music-soft) !important;
        border-color: rgba(255, 0, 51, .25) !important;
        color: var(--text) !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-music-link i {
        color: var(--ytconv-music) !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-music-link:hover {
        background: rgba(255, 0, 51, .16) !important;
        border-color: rgba(255, 0, 51, .42) !important;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-upgraded {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 18px;
        padding: 22px !important;
        margin-bottom: 20px !important;
        border: 1px solid rgba(96, 165, 250, .24) !important;
        border-radius: 18px !important;
        background: linear-gradient(135deg, var(--ytconv-blue-soft), var(--ytconv-music-soft)) !important;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-upgraded > :not(:first-child) {
        display: flex !important;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-upgraded #activeSectionTitle {
        margin-bottom: 6px !important;
      }

      .ytconv-hero-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 10px;
      }

      .ytconv-hero-btn {
        min-height: 44px;
        border-radius: 12px !important;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 14px;
        border: 1px solid var(--border);
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }

      .ytconv-hero-btn--music {
        color: #fff !important;
        background: var(--ytconv-music) !important;
        border-color: var(--ytconv-music) !important;
      }

      .ytconv-hero-btn--music:hover {
        background: var(--ytconv-music-dark) !important;
        border-color: var(--ytconv-music-dark) !important;
      }

      .ytconv-hero-btn--paste {
        color: var(--text) !important;
        background: var(--surface) !important;
      }

      .ytconv-service-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 12px;
      }

      .ytconv-service-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 28px;
        padding: 5px 9px;
        border: 1px solid rgba(148, 163, 184, .28);
        border-radius: 999px;
        background: rgba(15, 23, 42, .05);
        color: var(--text-secondary);
        font-size: 12px;
        font-weight: 600;
      }

      [data-bs-theme="dark"] .ytconv-service-chip {
        background: rgba(255, 255, 255, .04);
      }

      .ytconv-url-hint {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-top: 9px;
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.45;
      }

      .ytconv-url-hint i {
        color: #3b82f6;
        margin-top: 1px;
      }

      body.tw-enhanced.ytclean-ui #url:focus {
        border-color: #60a5fa !important;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, .16) !important;
      }

      body.tw-enhanced.ytclean-ui #advanced-mode .card {
        border-color: rgba(148, 163, 184, .28) !important;
      }

      @media (max-width: ${MOBILE_MAX_WIDTH}px) {
        html body.tw-enhanced > .ytclean-mobilebar.ytconv-mobilebar-upgraded {
          display: grid !important;
          grid-template-columns: 46px minmax(0, 1fr) 46px 46px;
          align-items: center !important;
          gap: 6px;
        }

        html body.tw-enhanced > .ytclean-mobilebar.ytconv-mobilebar-upgraded strong {
          position: static !important;
          grid-column: 2;
          left: auto !important;
          right: auto !important;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        html body.tw-enhanced > .ytclean-mobilebar.ytconv-mobilebar-upgraded #ytcleanOpenDrawer { grid-column: 1; }
        html body.tw-enhanced > .ytclean-mobilebar.ytconv-mobilebar-upgraded #ytcleanMobileMusic { grid-column: 3; }
        html body.tw-enhanced > .ytclean-mobilebar.ytconv-mobilebar-upgraded #ytcleanMobileTheme { grid-column: 4; }

        #ytcleanMobileMusic {
          color: #fff !important;
          background: var(--ytconv-music) !important;
          border-color: var(--ytconv-music) !important;
        }

        body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-upgraded {
          grid-template-columns: 1fr;
          padding: 18px !important;
        }

        .ytconv-hero-actions {
          justify-content: stretch;
        }

        .ytconv-hero-btn {
          flex: 1 1 145px;
        }
      }

      @media (max-width: 380px) {
        html body.tw-enhanced > .ytclean-mobilebar.ytconv-mobilebar-upgraded {
          grid-template-columns: 42px minmax(0, 1fr) 42px 42px;
          gap: 4px;
          padding-inline: 8px !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        body.tw-enhanced.ytclean-ui .ytclean-link,
        .ytconv-hero-btn {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureSidebarMusicButton = () => {
    if (document.getElementById('ytcleanSidebarMusic')) return;

    const nav = document.querySelector('#ytcleanSidebar .ytclean-nav');
    if (!nav) return;

    const link = document.createElement('a');
    link.id = 'ytcleanSidebarMusic';
    link.className = 'ytclean-link ytconv-music-link';
    link.href = MUSIC_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Buka YouTube Music');
    link.innerHTML = '<i class="bi bi-youtube"></i><span class="ytclean-label">YouTube Music</span>';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      document.body.classList.remove('ytclean-drawer-open');
      document.getElementById('ytcleanOpenDrawer')?.setAttribute('aria-expanded', 'false');
      openYouTubeMusic();
    });

    nav.insertBefore(link, nav.children[1] || null);
  };

  const ensureMobileMusicButton = () => {
    const mobilebar = document.querySelector('.ytclean-mobilebar');
    const themeButton = document.getElementById('ytcleanMobileTheme');
    if (!mobilebar || !themeButton) return;

    mobilebar.classList.add('ytconv-mobilebar-upgraded');
    if (document.getElementById('ytcleanMobileMusic')) return;

    const button = document.createElement('button');
    button.id = 'ytcleanMobileMusic';
    button.className = 'ytclean-icon-btn';
    button.type = 'button';
    button.setAttribute('aria-label', 'Buka YouTube Music');
    button.title = 'YouTube Music';
    button.innerHTML = '<i class="bi bi-youtube" aria-hidden="true"></i>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openYouTubeMusic();
    });

    mobilebar.insertBefore(button, themeButton);
  };

  const ensureHeroActions = () => {
    if (document.getElementById('ytconvHeroActions')) return;

    const header = document.querySelector('#mainContent .section-header');
    const titleBlock = header?.firstElementChild;
    if (!header || !titleBlock) return;

    header.classList.add('ytconv-hero-upgraded');

    const chips = document.createElement('div');
    chips.className = 'ytconv-service-chips';
    chips.setAttribute('aria-label', 'Layanan yang didukung');
    chips.innerHTML = `
      <span class="ytconv-service-chip"><i class="bi bi-youtube"></i>YouTube</span>
      <span class="ytconv-service-chip"><i class="bi bi-music-note-beamed"></i>YT Music</span>
      <span class="ytconv-service-chip"><i class="bi bi-spotify"></i>Spotify</span>
      <span class="ytconv-service-chip"><i class="bi bi-cloud"></i>SoundCloud</span>
    `;
    titleBlock.appendChild(chips);

    const actions = document.createElement('div');
    actions.id = 'ytconvHeroActions';
    actions.className = 'ytconv-hero-actions';

    const musicButton = document.createElement('button');
    musicButton.id = 'ytconvHeroMusic';
    musicButton.className = 'ytconv-hero-btn ytconv-hero-btn--music';
    musicButton.type = 'button';
    musicButton.innerHTML = '<i class="bi bi-youtube" aria-hidden="true"></i><span>Buka YT Music</span>';
    musicButton.addEventListener('click', openYouTubeMusic);

    const pasteButton = document.createElement('button');
    pasteButton.id = 'ytconvHeroPaste';
    pasteButton.className = 'ytconv-hero-btn ytconv-hero-btn--paste';
    pasteButton.type = 'button';
    pasteButton.innerHTML = '<i class="bi bi-clipboard2" aria-hidden="true"></i><span>Tempel tautan</span>';
    pasteButton.addEventListener('click', () => {
      const urlInput = document.getElementById('url');
      document.getElementById('pasteBtn')?.click();
      window.requestAnimationFrame(() => urlInput?.focus({ preventScroll: false }));
    });

    actions.append(musicButton, pasteButton);
    header.appendChild(actions);
  };

  const ensureUrlHint = () => {
    if (document.getElementById('ytconvUrlHint')) return;

    const input = document.getElementById('url');
    const inputGroup = input?.closest('.input-group');
    if (!inputGroup) return;

    const hint = document.createElement('div');
    hint.id = 'ytconvUrlHint';
    hint.className = 'ytconv-url-hint';
    hint.innerHTML = '<i class="bi bi-info-circle" aria-hidden="true"></i><span>Tautan YouTube Music juga bisa langsung ditempel di kolom ini.</span>';
    inputGroup.insertAdjacentElement('afterend', hint);
  };

  const upgradeExternalLinks = () => {
    document.querySelectorAll('#ytcleanSidebar a[href^="http"]').forEach((link) => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  };

  const applyEnhancements = () => {
    injectStyles();
    ensureSidebarMusicButton();
    ensureMobileMusicButton();
    ensureHeroActions();
    ensureUrlHint();
    upgradeExternalLinks();
    document.documentElement.dataset.ytconvUiEnhancements = 'ready';
  };

  onReady(() => {
    applyEnhancements();
    window.addEventListener('pageshow', applyEnhancements, { passive: true });
    window.setTimeout(applyEnhancements, 400);
  });
})();
