(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function installStyles() {
    let style = $('#ytconv-responsive-polish-v8');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-responsive-polish-v8';
      document.head.appendChild(style);
    }

    style.textContent = `
      :root {
        --ytv8-bg: #212121;
        --ytv8-sidebar: #171717;
        --ytv8-panel: #2f2f2f;
        --ytv8-panel-2: #272727;
        --ytv8-border: rgba(255,255,255,.10);
        --ytv8-muted: #a8a8a8;
        --ytv8-safe-top: env(safe-area-inset-top, 0px);
        --ytv8-safe-bottom: env(safe-area-inset-bottom, 0px);
        --ytv8-keyboard: 0px;
      }

      html, body { max-width: 100%; overflow-x: clip; }
      body.ytconv-responsive-v8 { background: var(--ytv8-bg) !important; }
      body.ytconv-responsive-v8 .tw-glow-orb,
      body.ytconv-responsive-v8::before,
      body.ytconv-responsive-v8::after { display: none !important; }

      /* Desktop shell */
      @media (min-width: 992px) {
        body.ytconv-responsive-v8 #mainContent {
          width: min(100%, 980px) !important;
          max-width: 980px !important;
          padding: 20px 32px 178px !important;
        }

        body.ytconv-responsive-v8 .section-header.ytconv-hero-clean {
          min-height: 62px !important;
          margin: 0 0 18px !important;
          padding: 8px 2px 14px !important;
          border-bottom: 1px solid var(--ytv8-border) !important;
          background: var(--ytv8-bg) !important;
        }

        body.ytconv-responsive-v8 .yc-welcome {
          min-height: min(62vh, 530px) !important;
          padding: 44px 20px 32px !important;
        }

        body.ytconv-responsive-v8 .yc-composer {
          width: min(790px, calc(100vw - var(--ycr-side-width, 260px) - 64px)) !important;
          bottom: 18px !important;
          padding: 10px 12px 8px !important;
          border-radius: 24px !important;
        }

        body.ytconv-responsive-v8.ytclean-collapsed .yc-composer {
          width: min(790px, calc(100vw - var(--ycr-rail-width, 72px) - 64px)) !important;
        }

        body.ytconv-responsive-v8 #ycOptions[open] {
          width: min(820px, calc(100vw - var(--ycr-side-width, 260px) - 64px)) !important;
          max-height: min(72vh, 720px) !important;
          bottom: 118px !important;
        }
      }

      /* Keep converter surface focused; utility/footer content stays out of the chat canvas. */
      body.ytconv-responsive-v8.ytclean-route-converter footer,
      body.ytconv-responsive-v8.ytclean-route-converter .site-footer,
      body.ytconv-responsive-v8.ytclean-route-converter #footer,
      body.ytconv-responsive-v8.ytclean-route-converter .footer {
        display: none !important;
      }

      /* Mobile and tablet */
      @media (max-width: 991.98px) {
        :root { --ytclean-mobilebar-total-height: calc(76px + var(--ytv8-safe-top)) !important; }

        body.ytconv-responsive-v8 {
          min-height: 100dvh;
          padding: 0 !important;
        }

        body.ytconv-responsive-v8 #mainContent {
          width: 100% !important;
          max-width: none !important;
          min-height: 100dvh !important;
          margin: 0 !important;
          padding: calc(82px + var(--ytv8-safe-top)) 16px calc(148px + var(--ytv8-safe-bottom)) !important;
        }

        /* The mobile bar is the only page header. */
        body.ytconv-responsive-v8 #mainContent > .section-header,
        body.ytconv-responsive-v8 .section-header.ytconv-hero-clean {
          display: none !important;
        }

        body.ytconv-responsive-v8 .ytclean-mobilebar {
          position: fixed !important;
          top: calc(8px + var(--ytv8-safe-top)) !important;
          left: 12px !important;
          right: 12px !important;
          z-index: 2147482000 !important;
          width: auto !important;
          height: 58px !important;
          min-height: 58px !important;
          margin: 0 !important;
          padding: 7px 8px !important;
          border: 1px solid rgba(148,163,184,.34) !important;
          border-radius: 20px !important;
          background: #16171a !important;
          box-shadow: 0 8px 26px rgba(0,0,0,.24) !important;
        }

        body.ytconv-responsive-v8 .ytclean-mobilebar .ytclean-icon-btn,
        body.ytconv-responsive-v8 .ytclean-mobilebar button {
          width: 44px !important;
          min-width: 44px !important;
          height: 44px !important;
          min-height: 44px !important;
          padding: 0 !important;
          border-radius: 50% !important;
        }

        body.ytconv-responsive-v8 .ytclean-mobilebar strong,
        body.ytconv-responsive-v8 .ytclean-mobilebar .fw-bold {
          color: #f4f4f4 !important;
          font-size: 17px !important;
          line-height: 1 !important;
        }

        /* Drawer fits the visual viewport and is independently scrollable. */
        body.ytconv-responsive-v8 .ytclean-sidebar {
          position: fixed !important;
          inset: 0 auto 0 0 !important;
          z-index: 2147482600 !important;
          width: min(86vw, 340px) !important;
          max-width: 340px !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          padding: calc(88px + var(--ytv8-safe-top)) 14px calc(28px + var(--ytv8-safe-bottom)) !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch;
          background: var(--ytv8-sidebar) !important;
          border-right: 1px solid var(--ytv8-border) !important;
          box-shadow: 18px 0 54px rgba(0,0,0,.38) !important;
        }

        body.ytconv-responsive-v8 .ytclean-sidebar > .d-flex:first-child {
          min-height: 48px !important;
          margin-bottom: 10px !important;
        }

        body.ytconv-responsive-v8 .ytclean-sidebar .ytclean-link {
          min-height: 48px !important;
          margin: 2px 0 !important;
          padding: 11px 12px !important;
          border-radius: 11px !important;
          font-size: 15px !important;
        }

        body.ytconv-responsive-v8 #ytcleanDrawerBackdrop {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147482500 !important;
          background: rgba(0,0,0,.58) !important;
          backdrop-filter: blur(2px);
        }

        /* Welcome state: compact enough to fit one screen without feeling crowded. */
        body.ytconv-responsive-v8 .yc-welcome {
          min-height: auto !important;
          padding: clamp(38px, 8vh, 72px) 4px calc(154px + var(--ytv8-safe-bottom)) !important;
        }

        body.ytconv-responsive-v8 .yc-welcome img {
          width: 48px !important;
          height: 48px !important;
          margin-bottom: 16px !important;
        }

        body.ytconv-responsive-v8 .yc-welcome h2 {
          max-width: 620px;
          margin-inline: auto !important;
          font-size: clamp(28px, 8vw, 38px) !important;
          line-height: 1.08 !important;
        }

        body.ytconv-responsive-v8 .yc-welcome p {
          max-width: 600px !important;
          margin-top: 12px !important;
          font-size: 15px !important;
          line-height: 1.55 !important;
        }

        body.ytconv-responsive-v8 .yc-suggestions {
          grid-template-columns: 1fr !important;
          width: min(100%, 620px) !important;
          margin-top: 24px !important;
          gap: 10px !important;
        }

        body.ytconv-responsive-v8 .yc-suggestion {
          min-height: 58px !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-start !important;
          padding: 13px 16px !important;
          border-radius: 14px !important;
        }

        /* Conversation does not sit underneath the composer. */
        body.ytconv-responsive-v8 .yc-conversation {
          margin: 8px 0 24px !important;
          padding: 0 !important;
          gap: 22px !important;
        }

        body.ytconv-responsive-v8 .yc-user .yc-content {
          max-width: 90% !important;
        }

        /* Single clean composer above browser safe-area/keyboard. */
        body.ytconv-responsive-v8 .yc-composer {
          position: fixed !important;
          left: 12px !important;
          right: 12px !important;
          bottom: calc(10px + var(--ytv8-safe-bottom) + var(--ytv8-keyboard)) !important;
          z-index: 2147482200 !important;
          width: auto !important;
          max-width: none !important;
          min-height: 74px !important;
          margin: 0 !important;
          padding: 8px 9px 7px !important;
          border: 1px solid var(--ytv8-border) !important;
          border-radius: 20px !important;
          background: rgba(47,47,47,.98) !important;
          box-shadow: 0 14px 44px rgba(0,0,0,.36) !important;
          transform: none !important;
          backdrop-filter: blur(16px);
        }

        body.ytconv-responsive-v8 .yc-composer::before { display: none !important; }

        body.ytconv-responsive-v8 .yc-composer .input-group {
          grid-template-columns: 38px minmax(0,1fr) 36px 40px !important;
          gap: 3px !important;
        }

        body.ytconv-responsive-v8 .yc-composer #sampleBtn { display: none !important; }
        body.ytconv-responsive-v8 .yc-composer #pasteBtn { grid-column: 3 !important; }
        body.ytconv-responsive-v8 .ycr-send-v7 { grid-column: 4 !important; }

        body.ytconv-responsive-v8 .ycr-prompt-v7 {
          min-height: 42px !important;
          max-height: 112px !important;
          padding: 9px 4px 7px !important;
          font-size: 15px !important;
        }

        body.ytconv-responsive-v8 .yc-composer-footer {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 8px !important;
          min-height: 22px;
          padding: 2px 5px 0 !important;
          overflow: hidden;
        }

        body.ytconv-responsive-v8 .yc-composer-footer .ycr-disclaimer { display: none !important; }
        body.ytconv-responsive-v8 .yc-composer-footer .ycr-input-mode,
        body.ytconv-responsive-v8 .yc-composer-footer .ycr-preset,
        body.ytconv-responsive-v8 .yc-composer-footer .ycr-composer-option,
        body.ytconv-responsive-v8 .yc-composer-footer .ycr-security-badge {
          flex: 0 1 auto;
          min-width: 0;
          font-size: 10px !important;
          white-space: nowrap;
        }

        body.ytconv-responsive-v8 .yc-composer-footer .ycr-security-badge {
          margin-left: auto;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Security prompt and options are sheets above the composer, never under it. */
        body.ytconv-responsive-v8 #ycrSecurityDock {
          left: 12px !important;
          right: 12px !important;
          bottom: calc(98px + var(--ytv8-safe-bottom) + var(--ytv8-keyboard)) !important;
          width: auto !important;
          max-width: 420px !important;
          margin: 0 auto !important;
          transform: none !important;
          border-radius: 16px !important;
        }

        body.ytconv-responsive-v8 #ycOptions[open],
        body.ytconv-responsive-v8.ytclean-collapsed #ycOptions[open] {
          left: 10px !important;
          right: 10px !important;
          top: calc(76px + var(--ytv8-safe-top)) !important;
          bottom: calc(98px + var(--ytv8-safe-bottom)) !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          margin: 0 !important;
          border-radius: 18px !important;
          transform: none !important;
        }

        body.ytconv-responsive-v8 .ycr-sheet-header {
          min-height: 54px !important;
          padding: 10px 12px !important;
        }

        body.ytconv-responsive-v8 .yc-options-content {
          padding: 8px 12px calc(20px + var(--ytv8-safe-bottom)) !important;
        }

        /* Remove leftover utility blocks from converter route on small screens. */
        body.ytconv-responsive-v8.ytclean-route-converter #historyPanel,
        body.ytconv-responsive-v8.ytclean-route-converter #aiStudioCard,
        body.ytconv-responsive-v8.ytclean-route-converter #subtitleCard,
        body.ytconv-responsive-v8.ytclean-route-converter .footer-status,
        body.ytconv-responsive-v8.ytclean-route-converter .footer-links {
          display: none !important;
        }
      }

      @media (max-width: 420px) {
        body.ytconv-responsive-v8 #mainContent {
          padding-inline: 12px !important;
        }
        body.ytconv-responsive-v8 .ytclean-mobilebar {
          left: 8px !important;
          right: 8px !important;
        }
        body.ytconv-responsive-v8 .yc-composer {
          left: 8px !important;
          right: 8px !important;
          border-radius: 18px !important;
        }
        body.ytconv-responsive-v8 .yc-welcome h2 { font-size: 31px !important; }
        body.ytconv-responsive-v8 .yc-welcome p { font-size: 14px !important; }
      }

      [data-bs-theme='light'] body.ytconv-responsive-v8 {
        --ytv8-bg: #ffffff;
        --ytv8-sidebar: #f7f7f8;
        --ytv8-panel: #f4f4f4;
        --ytv8-panel-2: #ffffff;
        --ytv8-border: rgba(0,0,0,.11);
        --ytv8-muted: #676767;
        background: #fff !important;
      }

      [data-bs-theme='light'] body.ytconv-responsive-v8 .ytclean-mobilebar {
        background: rgba(255,255,255,.96) !important;
        border-color: rgba(0,0,0,.15) !important;
      }

      [data-bs-theme='light'] body.ytconv-responsive-v8 .ytclean-mobilebar strong,
      [data-bs-theme='light'] body.ytconv-responsive-v8 .ytclean-mobilebar .fw-bold {
        color: #202123 !important;
      }

      [data-bs-theme='light'] body.ytconv-responsive-v8 .ytclean-sidebar {
        background: #f7f7f8 !important;
        color: #202123 !important;
      }

      [data-bs-theme='light'] body.ytconv-responsive-v8 .yc-composer {
        background: rgba(255,255,255,.98) !important;
        box-shadow: 0 14px 40px rgba(0,0,0,.16) !important;
      }

      @media (prefers-reduced-motion: reduce) {
        body.ytconv-responsive-v8 *, body.ytconv-responsive-v8 *::before, body.ytconv-responsive-v8 *::after {
          scroll-behavior: auto !important;
          transition-duration: .01ms !important;
          animation-duration: .01ms !important;
        }
      }
    `;
  }

  function syncVisualViewport() {
    const viewport = window.visualViewport;
    let keyboard = 0;
    if (viewport && window.innerWidth <= 991.98) {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      keyboard = covered > 120 ? Math.max(0, covered) : 0;
    }
    document.documentElement.style.setProperty('--ytv8-keyboard', `${Math.round(keyboard)}px`);
  }

  function tidyMobileDrawer() {
    const drawer = $('#ytcleanSidebar');
    if (!drawer) return;

    $$('.ytclean-link', drawer).forEach((link) => {
      if (link.dataset.ytv8Close) return;
      link.dataset.ytv8Close = 'true';
      link.addEventListener('click', () => {
        if (window.innerWidth > 991.98) return;
        window.setTimeout(() => {
          $('#ytcleanCloseDrawer')?.click();
          document.body.classList.remove('ytclean-drawer-open', 'ytclean-drawer-visible');
        }, 60);
      });
    });
  }

  function apply() {
    document.body.classList.add('ytconv-responsive-v8');
    installStyles();
    syncVisualViewport();
    tidyMobileDrawer();
    document.documentElement.dataset.ytconvResponsivePolish = 'v8';
  }

  const ready = () => {
    apply();
    window.addEventListener('resize', syncVisualViewport, { passive: true });
    window.addEventListener('orientationchange', () => window.setTimeout(syncVisualViewport, 120), { passive: true });
    window.visualViewport?.addEventListener('resize', syncVisualViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', syncVisualViewport, { passive: true });
    window.addEventListener('pageshow', apply, { passive: true });
    window.setTimeout(apply, 600);
    window.setTimeout(apply, 1700);
    new MutationObserver(() => tidyMobileDrawer()).observe(document.body, { childList: true, subtree: true });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();