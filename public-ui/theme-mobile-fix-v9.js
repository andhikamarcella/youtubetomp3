(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);

  function installStyles() {
    let style = $('#ytconv-theme-mobile-fix-v9');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-theme-mobile-fix-v9';
      document.head.appendChild(style);
    }

    style.textContent = `
      /* Remove decorative shapes that can turn modal backdrops into giant ovals. */
      body.ytconv-visual-v9::before,
      body.ytconv-visual-v9::after,
      body.ytconv-visual-v9 .tw-glow-orb {
        display: none !important;
      }

      /* Every scrim must be a full viewport rectangle. */
      body.ytconv-visual-v9 #ytcleanDrawerBackdrop,
      body.ytconv-visual-v9 #ycrOptionsBackdrop {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        clip-path: none !important;
        transform: none !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        background: rgba(10, 10, 12, .46) !important;
        -webkit-backdrop-filter: blur(10px) saturate(.9) !important;
        backdrop-filter: blur(10px) saturate(.9) !important;
        box-shadow: none !important;
      }

      body.ytconv-visual-v9 #ytcleanDrawerBackdrop {
        z-index: 2147482500 !important;
      }

      body.ytconv-visual-v9 #ycrOptionsBackdrop {
        z-index: 2147483000 !important;
      }

      @media (max-width: 991.98px) {
        /* Compact floating mobile header. */
        body.ytconv-visual-v9 .ytclean-mobilebar {
          top: calc(8px + env(safe-area-inset-top, 0px)) !important;
          left: 10px !important;
          right: 10px !important;
          height: 58px !important;
          min-height: 58px !important;
          padding: 7px 8px !important;
          border-radius: 20px !important;
        }

        /* Drawer scrolls below the mobile header while its own brand row stays visible. */
        body.ytconv-visual-v9 .ytclean-sidebar {
          height: 100dvh !important;
          max-height: 100dvh !important;
          padding: calc(76px + env(safe-area-inset-top, 0px)) 14px calc(22px + env(safe-area-inset-bottom, 0px)) !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          scrollbar-gutter: stable;
        }

        body.ytconv-visual-v9 .ytclean-sidebar > .d-flex:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 8 !important;
          min-height: 58px !important;
          margin: 0 -4px 10px !important;
          padding: 5px 4px 8px !important;
          background: var(--ytv8-sidebar, #171717) !important;
          border-bottom: 1px solid var(--ytv8-border, rgba(255,255,255,.1)) !important;
        }

        body.ytconv-visual-v9 #ytcleanCloseDrawer {
          flex: 0 0 42px !important;
          width: 42px !important;
          min-width: 42px !important;
          height: 42px !important;
          min-height: 42px !important;
          margin-left: auto !important;
          border-radius: 50% !important;
        }

        /* Options become a polished sheet, not an oversized floating card. */
        body.ytconv-visual-v9 #ycOptions[open],
        body.ytconv-visual-v9.ytclean-collapsed #ycOptions[open] {
          left: 10px !important;
          right: 10px !important;
          top: calc(78px + env(safe-area-inset-top, 0px)) !important;
          bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          margin: 0 !important;
          overflow: auto !important;
          border-radius: 24px !important;
          transform: none !important;
          box-shadow: 0 24px 80px rgba(0,0,0,.32) !important;
        }

        body.ytconv-visual-v9 .ycr-sheet-header {
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
          min-height: 58px !important;
          padding: 12px 14px !important;
          -webkit-backdrop-filter: blur(16px) !important;
          backdrop-filter: blur(16px) !important;
        }

        body.ytconv-visual-v9 .ycr-sheet-close {
          width: 40px !important;
          height: 40px !important;
          border-radius: 50% !important;
        }
      }

      /* Complete light-theme palette. */
      [data-bs-theme='light'] body.ytconv-visual-v9 {
        --ytv8-bg: #ffffff;
        --ytv8-sidebar: #ffffff;
        --ytv8-panel: #f7f7f8;
        --ytv8-panel-2: #ffffff;
        --ytv8-border: rgba(15, 23, 42, .12);
        --ytv8-muted: #667085;
        --ycr-bg: #ffffff;
        --ycr-sidebar: #ffffff;
        --ycr-panel: #f4f4f5;
        --ycr-panel-hover: #ececee;
        --ycr-panel-deep: #ffffff;
        --ycr-text: #171717;
        --ycr-muted: #667085;
        --ycr-border: rgba(15, 23, 42, .12);
        background: #ffffff !important;
        color: #171717 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 #mainContent,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-welcome,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-conversation {
        background: #ffffff !important;
        color: #171717 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-mobilebar {
        background: rgba(255,255,255,.97) !important;
        border-color: rgba(15,23,42,.14) !important;
        box-shadow: 0 8px 28px rgba(15,23,42,.10) !important;
        -webkit-backdrop-filter: blur(18px) saturate(1.15) !important;
        backdrop-filter: blur(18px) saturate(1.15) !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-mobilebar strong,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-mobilebar .fw-bold,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-mobilebar .ytclean-brand-text {
        color: #171717 !important;
        -webkit-text-fill-color: #171717 !important;
        opacity: 1 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-mobilebar button:not(.ytclean-mobile-music),
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-mobilebar .ytclean-icon-btn:not(.ytclean-mobile-music) {
        background: #ffffff !important;
        color: #171717 !important;
        border: 1px solid rgba(15,23,42,.12) !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar > .d-flex:first-child {
        background: #ffffff !important;
        color: #171717 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar .ytclean-brand,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar .ytclean-brand-text,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar .ytclean-label,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar .ytclean-link,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar .ytclean-sidebar-section-title {
        color: #202124 !important;
        -webkit-text-fill-color: #202124 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar .ytclean-link:hover,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ytclean-sidebar .ytclean-link.is-active {
        background: #f1f1f2 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-welcome h2,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-suggestion,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-content,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-sheet-title,
      [data-bs-theme='light'] body.ytconv-visual-v9 #ycOptions,
      [data-bs-theme='light'] body.ytconv-visual-v9 #ycOptions label {
        color: #171717 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-welcome p,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-message-meta,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-input-mode,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-preset {
        color: #667085 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-suggestion,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-composer,
      [data-bs-theme='light'] body.ytconv-visual-v9 #ycOptions[open],
      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-sheet-header,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-options-content .card,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-options-content .form-control,
      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-options-content .form-select {
        background: #ffffff !important;
        border-color: rgba(15,23,42,.12) !important;
        color: #171717 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .yc-composer {
        box-shadow: 0 14px 44px rgba(15,23,42,.14) !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-prompt-v7,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-prompt-input {
        color: #171717 !important;
        caret-color: #171717 !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-prompt-v7::placeholder,
      [data-bs-theme='light'] body.ytconv-visual-v9 .ycr-prompt-input::placeholder {
        color: #9ca3af !important;
      }

      [data-bs-theme='light'] body.ytconv-visual-v9 #ytcleanDrawerBackdrop,
      [data-bs-theme='light'] body.ytconv-visual-v9 #ycrOptionsBackdrop {
        background: rgba(15,23,42,.22) !important;
        -webkit-backdrop-filter: blur(12px) saturate(.92) !important;
        backdrop-filter: blur(12px) saturate(.92) !important;
      }
    `;
  }

  function resetDrawerPosition() {
    const drawer = $('#ytcleanSidebar');
    if (!drawer || window.innerWidth > 991.98) return;
    drawer.scrollTop = 0;
    window.requestAnimationFrame(() => { drawer.scrollTop = 0; });
  }

  function bindDrawerReset() {
    const openButton = $('#ytcleanOpenDrawer') || $('.ytclean-mobilebar button');
    if (openButton && !openButton.dataset.ytv9Reset) {
      openButton.dataset.ytv9Reset = 'true';
      openButton.addEventListener('click', () => window.setTimeout(resetDrawerPosition, 0));
    }

    const drawer = $('#ytcleanSidebar');
    if (drawer && !drawer.dataset.ytv9Observed) {
      drawer.dataset.ytv9Observed = 'true';
      new MutationObserver(() => {
        if (document.body.classList.contains('ytclean-drawer-open') || document.body.classList.contains('ytclean-drawer-visible')) {
          resetDrawerPosition();
        }
      }).observe(drawer, { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
    }
  }

  function apply() {
    document.body.classList.add('ytconv-visual-v9');
    installStyles();
    bindDrawerReset();
    document.documentElement.dataset.ytconvVisualFix = 'v9';
  }

  const ready = () => {
    apply();
    window.addEventListener('pageshow', apply, { passive: true });
    window.setTimeout(apply, 500);
    window.setTimeout(apply, 1500);
    new MutationObserver(bindDrawerReset).observe(document.body, { childList: true, subtree: true });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();