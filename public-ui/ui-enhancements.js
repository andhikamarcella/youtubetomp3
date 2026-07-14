(() => {
  'use strict';

  const MUSIC_URL = 'https://music.youtube.com/';
  const LOGO_PRIMARY = '/logo.svg';
  const LOGO_FALLBACK = '/icons/icon.svg';
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
    let style = document.getElementById('ytconv-ui-enhancements-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-ui-enhancements-style';
      document.head.appendChild(style);
    }

    style.textContent = `
      :root {
        --ytconv-music: #ff0033;
        --ytconv-music-hover: #d9002b;
        --ytconv-music-soft: rgba(255, 0, 51, .09);
        --ytconv-chat-bg: #212121;
        --ytconv-chat-sidebar: #171717;
        --ytconv-chat-surface: #2f2f2f;
        --ytconv-chat-surface-hover: #383838;
        --ytconv-chat-border: rgba(255, 255, 255, .10);
      }

      body.tw-enhanced.ytclean-ui {
        background: var(--ytconv-chat-bg) !important;
      }

      body.tw-enhanced.ytclean-ui #offcanvasNav,
      body.tw-enhanced.ytclean-ui [data-bs-target="#offcanvasNav"] {
        display: none !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-sidebar {
        width: 260px !important;
        padding: 12px !important;
        background: var(--ytconv-chat-sidebar) !important;
        border-right: 1px solid var(--ytconv-chat-border) !important;
        scrollbar-width: none;
      }

      body.tw-enhanced.ytclean-ui .ytclean-sidebar::-webkit-scrollbar {
        display: none;
      }

      body.tw-enhanced.ytclean-ui.ytclean-main-offset {
        margin-left: 260px !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-brand {
        min-height: 48px !important;
        padding: 4px 8px 12px !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-brand-mark {
        overflow: hidden;
        padding: 0 !important;
        background: transparent !important;
        border-color: transparent !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-brand-mark img {
        display: block;
        width: 34px;
        height: 34px;
        object-fit: contain;
        border-radius: 9px;
      }

      body.tw-enhanced.ytclean-ui .ytclean-brand-text {
        font-size: 16px !important;
        letter-spacing: -.01em;
      }

      body.tw-enhanced.ytclean-ui .ytclean-nav {
        gap: 2px !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-sidebar-section {
        margin-top: 10px !important;
        padding-top: 10px !important;
        border-color: var(--ytconv-chat-border) !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-link {
        min-height: 40px !important;
        padding: 8px 10px !important;
        border: 1px solid transparent !important;
        border-radius: 8px !important;
        background: transparent !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        transition: background-color .14s ease, border-color .14s ease, color .14s ease !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-link:hover {
        transform: none !important;
        background: rgba(255, 255, 255, .07) !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-link.is-active {
        background: rgba(255, 255, 255, .10) !important;
        border-color: transparent !important;
        box-shadow: none !important;
      }

      body.tw-enhanced.ytclean-ui .ytclean-link i {
        color: rgba(255, 255, 255, .72) !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-music-link i {
        color: var(--ytconv-music) !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-music-link:hover {
        background: var(--ytconv-music-soft) !important;
      }

      body.tw-enhanced.ytclean-ui #mainContent {
        width: min(100%, 940px) !important;
        max-width: 940px !important;
        padding: 30px 24px 42px !important;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-clean {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center !important;
        gap: 18px !important;
        margin: 0 0 22px !important;
        padding: 6px 2px 18px !important;
        border: 0 !important;
        border-bottom: 1px solid var(--ytconv-chat-border) !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-clean > :first-child {
        min-width: 0;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-clean > .ytconv-header-actions {
        display: flex !important;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-clean #activeSectionTitle {
        margin: 0 0 7px !important;
        font-size: clamp(28px, 3.4vw, 38px) !important;
        line-height: 1.08 !important;
        letter-spacing: -.035em !important;
        text-transform: none !important;
      }

      body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-clean #activeSectionSubtitle {
        max-width: 620px;
        margin: 0 !important;
        font-size: 15px !important;
        line-height: 1.55 !important;
        color: rgba(255, 255, 255, .62) !important;
      }

      .ytconv-header-actions {
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
      }

      body.tw-enhanced.ytclean-ui .ytconv-header-action {
        min-height: 40px !important;
        width: auto !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        padding: 8px 13px !important;
        border: 1px solid var(--ytconv-chat-border) !important;
        border-radius: 10px !important;
        background: var(--ytconv-chat-surface) !important;
        color: #f4f4f4 !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        white-space: nowrap;
        box-shadow: none !important;
        outline: none !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-header-action:hover {
        transform: none !important;
        background: var(--ytconv-chat-surface-hover) !important;
        border-color: rgba(255, 255, 255, .16) !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-header-action--music {
        background: var(--ytconv-music) !important;
        border-color: var(--ytconv-music) !important;
        color: #fff !important;
      }

      body.tw-enhanced.ytclean-ui .ytconv-header-action--music:hover {
        background: var(--ytconv-music-hover) !important;
        border-color: var(--ytconv-music-hover) !important;
      }

      body.tw-enhanced.ytclean-ui #headerModeToggle {
        outline: none !important;
        box-shadow: none !important;
      }

      body.tw-enhanced.ytclean-ui .card,
      body.tw-enhanced.ytclean-ui #advanced-mode .card {
        border: 1px solid var(--ytconv-chat-border) !important;
        border-radius: 16px !important;
        background: var(--ytconv-chat-surface) !important;
        box-shadow: none !important;
      }

      body.tw-enhanced.ytclean-ui #advanced-mode .card-body {
        padding: 22px !important;
      }

      body.tw-enhanced.ytclean-ui .form-control,
      body.tw-enhanced.ytclean-ui .form-select,
      body.tw-enhanced.ytclean-ui textarea {
        border-color: var(--ytconv-chat-border) !important;
        border-radius: 12px !important;
        background: #242424 !important;
      }

      body.tw-enhanced.ytclean-ui #url {
        min-height: 54px !important;
      }

      body.tw-enhanced.ytclean-ui #url:focus {
        border-color: rgba(255, 255, 255, .30) !important;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, .07) !important;
      }

      body.tw-enhanced.ytclean-ui .btn:not(.btn-primary),
      body.tw-enhanced.ytclean-ui .app-nav-btn {
        border-color: var(--ytconv-chat-border) !important;
        background: var(--ytconv-chat-surface) !important;
        color: #f4f4f4 !important;
      }

      body.tw-enhanced.ytclean-ui .btn:not(.btn-primary):hover,
      body.tw-enhanced.ytclean-ui .app-nav-btn:hover {
        background: var(--ytconv-chat-surface-hover) !important;
      }

      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui {
        --ytconv-chat-bg: #f7f7f8;
        --ytconv-chat-sidebar: #f0f0f0;
        --ytconv-chat-surface: #ffffff;
        --ytconv-chat-surface-hover: #ececec;
        --ytconv-chat-border: rgba(0, 0, 0, .10);
        background: var(--ytconv-chat-bg) !important;
      }

      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-clean #activeSectionSubtitle {
        color: rgba(0, 0, 0, .58) !important;
      }

      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .ytclean-link i {
        color: rgba(0, 0, 0, .68) !important;
      }

      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .ytclean-link:hover,
      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .ytclean-link.is-active {
        background: rgba(0, 0, 0, .06) !important;
      }

      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .form-control,
      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .form-select,
      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui textarea {
        background: #fff !important;
      }

      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .ytconv-header-action,
      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .btn:not(.btn-primary),
      [data-bs-theme="light"] body.tw-enhanced.ytclean-ui .app-nav-btn {
        color: #202123 !important;
      }

      @media (max-width: ${MOBILE_MAX_WIDTH}px) {
        body.tw-enhanced.ytclean-ui.ytclean-main-offset {
          margin-left: 0 !important;
        }

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

        body.tw-enhanced.ytclean-ui .ytclean-sidebar {
          width: min(86vw, 310px) !important;
        }

        body.tw-enhanced.ytclean-ui #mainContent {
          width: 100% !important;
          padding: calc(var(--ytclean-mobilebar-total-height) + 18px) 16px 28px !important;
        }

        body.tw-enhanced.ytclean-ui .section-header.ytconv-hero-clean {
          grid-template-columns: 1fr;
          padding: 2px 0 16px !important;
        }

        .ytconv-header-actions {
          justify-content: flex-start;
        }
      }

      @media (max-width: 560px) {
        .ytconv-header-actions {
          display: grid !important;
          grid-template-columns: 1fr 1fr;
          width: 100%;
        }

        body.tw-enhanced.ytclean-ui .ytconv-header-action {
          width: 100% !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        body.tw-enhanced.ytclean-ui .ytclean-link,
        body.tw-enhanced.ytclean-ui .ytconv-header-action {
          transition: none !important;
        }
      }
    `;
  };

  const applyLogo = (src) => {
    const iconLinks = [
      ...document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'),
    ];

    if (!iconLinks.length) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/svg+xml';
      document.head.appendChild(icon);
      iconLinks.push(icon);
    }

    iconLinks.forEach((link) => {
      link.href = src;
      if (link.rel !== 'apple-touch-icon') link.type = 'image/svg+xml';
    });

    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((meta) => {
      meta.content = new URL(src, window.location.origin).toString();
    });

    const brandMark = document.querySelector('.ytclean-brand-mark');
    if (brandMark) {
      brandMark.innerHTML = '';
      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.width = 34;
      image.height = 34;
      image.addEventListener('error', () => {
        if (!image.src.endsWith(LOGO_FALLBACK)) image.src = LOGO_FALLBACK;
      }, { once: true });
      brandMark.appendChild(image);
    }
  };

  const ensureBrandAssets = () => {
    if (document.documentElement.dataset.ytconvBrandAssetReady === 'true') return;
    document.documentElement.dataset.ytconvBrandAssetReady = 'true';

    const probe = new Image();
    probe.addEventListener('load', () => applyLogo(LOGO_PRIMARY), { once: true });
    probe.addEventListener('error', () => applyLogo(LOGO_FALLBACK), { once: true });
    probe.src = LOGO_PRIMARY;
  };

  const closeLegacyFeatureMenu = () => {
    document.querySelectorAll('[data-bs-target="#offcanvasNav"]').forEach((button) => button.remove());

    const legacyMenu = document.getElementById('offcanvasNav');
    if (legacyMenu) {
      try {
        window.bootstrap?.Offcanvas?.getInstance(legacyMenu)?.hide();
      } catch {}
      legacyMenu.classList.remove('show', 'showing');
      legacyMenu.setAttribute('aria-hidden', 'true');
      legacyMenu.style.visibility = 'hidden';
    }

    document.querySelectorAll('.offcanvas-backdrop').forEach((backdrop) => backdrop.remove());
    if (!document.querySelector('.offcanvas.show, .offcanvas.showing')) {
      document.body.classList.remove('offcanvas-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }

    if (window.location.hash === '#offcanvasNav') {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  const removeOldEnhancements = () => {
    document.getElementById('ytconvHeroActions')?.remove();
    document.getElementById('ytconvUrlHint')?.remove();
    document.querySelectorAll('.ytconv-service-chips').forEach((element) => element.remove());
    document.getElementById('ytMusicBtn')?.remove();

    const header = document.querySelector('#mainContent .section-header');
    header?.classList.remove('ytconv-hero-upgraded');
  };

  const ensureSidebarMusicButton = () => {
    const nav = document.querySelector('#ytcleanSidebar .ytclean-nav');
    if (!nav) return;

    let link = document.getElementById('ytcleanSidebarMusic');
    if (!link) {
      link = document.createElement('a');
      link.id = 'ytcleanSidebarMusic';
      nav.insertBefore(link, nav.children[1] || null);
    }

    link.className = 'ytclean-link ytconv-music-link';
    link.href = MUSIC_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Buka YouTube Music');
    link.innerHTML = '<i class="bi bi-youtube" aria-hidden="true"></i><span class="ytclean-label">YouTube Music</span>';

    if (link.dataset.ytconvBound !== 'true') {
      link.dataset.ytconvBound = 'true';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        document.body.classList.remove('ytclean-drawer-open');
        document.getElementById('ytcleanOpenDrawer')?.setAttribute('aria-expanded', 'false');
        openYouTubeMusic();
      });
    }
  };

  const ensureMobileMusicButton = () => {
    const mobilebar = document.querySelector('.ytclean-mobilebar');
    const themeButton = document.getElementById('ytcleanMobileTheme');
    if (!mobilebar || !themeButton) return;

    mobilebar.classList.add('ytconv-mobilebar-upgraded');
    let button = document.getElementById('ytcleanMobileMusic');

    if (!button) {
      button = document.createElement('button');
      button.id = 'ytcleanMobileMusic';
      button.type = 'button';
      mobilebar.insertBefore(button, themeButton);
    }

    button.className = 'ytclean-icon-btn';
    button.setAttribute('aria-label', 'Buka YouTube Music');
    button.title = 'YouTube Music';
    button.innerHTML = '<i class="bi bi-youtube" aria-hidden="true"></i>';

    if (button.dataset.ytconvBound !== 'true') {
      button.dataset.ytconvBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openYouTubeMusic();
      });
    }
  };

  const normalizeActionButton = (button, { icon, label, extraClass = '' }) => {
    if (!button) return null;
    button.className = `ytconv-header-action ${extraClass}`.trim();
    button.type = 'button';
    button.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    return button;
  };

  const ensureCleanHeader = () => {
    const header = document.querySelector('#mainContent .section-header');
    const titleBlock = header?.firstElementChild;
    if (!header || !titleBlock) return;

    header.classList.remove('ytconv-hero-upgraded');
    header.classList.add('ytconv-hero-clean');

    const title = document.getElementById('activeSectionTitle');
    const subtitle = document.getElementById('activeSectionSubtitle');
    if (title && /converter/i.test(title.textContent || '')) title.textContent = 'Converter';
    if (subtitle && /convert|konversi/i.test(subtitle.textContent || '')) {
      subtitle.textContent = 'Konversi media dengan cepat, stabil, dan mudah.';
    }

    let actions = document.getElementById('ytconvHeaderActions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'ytconvHeaderActions';
      actions.className = 'ytconv-header-actions';
    }

    let musicButton = document.getElementById('ytconvHeaderMusic');
    if (!musicButton) {
      musicButton = document.createElement('button');
      musicButton.id = 'ytconvHeaderMusic';
    }

    normalizeActionButton(musicButton, {
      icon: 'bi-youtube',
      label: 'YT Music',
      extraClass: 'ytconv-header-action--music',
    });

    if (musicButton.dataset.ytconvBound !== 'true') {
      musicButton.dataset.ytconvBound = 'true';
      musicButton.addEventListener('click', openYouTubeMusic);
    }

    const modeButton = document.getElementById('headerModeToggle');
    normalizeActionButton(modeButton, { icon: 'bi-sliders', label: 'Mode' });
    modeButton?.setAttribute('aria-label', 'Ganti mode converter');

    actions.replaceChildren(musicButton);
    if (modeButton) actions.appendChild(modeButton);
    header.appendChild(actions);
  };

  const polishInput = () => {
    const input = document.getElementById('url');
    if (!input) return;

    input.placeholder = 'Tempel tautan YouTube, YT Music, Spotify, atau SoundCloud';
    const label = document.querySelector('label[for="url"]');
    if (label) label.textContent = 'Tautan media';
  };

  const upgradeExternalLinks = () => {
    document.querySelectorAll('#ytcleanSidebar a[href^="http"]').forEach((link) => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  };

  const applyEnhancements = () => {
    injectStyles();
    closeLegacyFeatureMenu();
    removeOldEnhancements();
    ensureBrandAssets();
    ensureSidebarMusicButton();
    ensureMobileMusicButton();
    ensureCleanHeader();
    polishInput();
    upgradeExternalLinks();
    document.documentElement.dataset.ytconvUiEnhancements = 'chat-clean-v3';
  };

  onReady(() => {
    applyEnhancements();
    window.addEventListener('pageshow', applyEnhancements, { passive: true });
    window.setTimeout(applyEnhancements, 350);
    window.setTimeout(applyEnhancements, 1200);
  });
})();