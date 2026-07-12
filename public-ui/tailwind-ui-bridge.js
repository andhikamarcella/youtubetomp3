(() => {
  const MOBILE_MAX_WIDTH = 991.98;
  const MOBILEBAR_Z = 2147483647;
  const ACTION_DEBOUNCE_MS = 650;

  const injectPolish = () => {
    if (document.getElementById('tw-premium-button-polish')) return;

    const style = document.createElement('style');
    style.id = 'tw-premium-button-polish';
    style.textContent = `
      .tw-enhanced button,
      .tw-enhanced a.btn,
      .tw-enhanced .btn,
      .tw-enhanced [role="button"],
      .tw-enhanced a[class*="bg-"] {
        position: relative;
        overflow: hidden;
        border-radius: 999px;
        font-weight: 800;
        letter-spacing: .01em;
        transform: none !important;
        transition: background-color .16s ease, border-color .16s ease, color .16s ease;
        box-shadow: none !important;
        text-shadow: none !important;
        filter: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      .tw-enhanced button::before,
      .tw-enhanced a.btn::before,
      .tw-enhanced .btn::before,
      .tw-enhanced [role="button"]::before,
      .tw-enhanced a[class*="bg-"]::before {
        content: none !important;
        display: none !important;
      }

      .tw-enhanced button:hover,
      .tw-enhanced a.btn:hover,
      .tw-enhanced .btn:hover,
      .tw-enhanced [role="button"]:hover,
      .tw-enhanced a[class*="bg-"]:hover {
        transform: translateY(-1px) !important;
        filter: none !important;
        box-shadow: none !important;
      }

      .tw-enhanced button:active,
      .tw-enhanced a.btn:active,
      .tw-enhanced .btn:active,
      .tw-enhanced [role="button"]:active,
      .tw-enhanced a[class*="bg-"]:active {
        transform: translateY(1px) !important;
      }

      .tw-enhanced :where(.btn, .app-nav-btn, .modern-nav-item, .footer-pill, .assistant-toggle, button, a.btn, [class*="bg-gradient"]) {
        background-image: none !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        filter: none !important;
      }

      .tw-enhanced :where(.btn-primary, .assistant-toggle) {
        background-color: #2563eb !important;
        border-color: #2563eb !important;
        color: #fff !important;
      }

      .tw-enhanced :where(.btn-outline-primary, .app-nav-btn, .modern-nav-item, .footer-pill) {
        background-color: #1f2937 !important;
        border-color: rgba(148, 163, 184, .45) !important;
        color: #e5e7eb !important;
      }

      .tw-enhanced button:focus-visible,
      .tw-enhanced a.btn:focus-visible,
      .tw-enhanced .btn:focus-visible,
      .tw-enhanced [role="button"]:focus-visible,
      .tw-enhanced a[class*="bg-"]:focus-visible {
        outline: 2px solid rgba(125, 211, 252, .9);
        outline-offset: 2px;
      }

      .tw-enhanced button:disabled,
      .tw-enhanced .btn:disabled,
      .tw-enhanced [aria-disabled="true"] {
        cursor: not-allowed;
        opacity: .62;
        transform: none !important;
      }

      .tw-enhanced input,
      .tw-enhanced select,
      .tw-enhanced textarea,
      .tw-enhanced .form-control,
      .tw-enhanced .form-select {
        transition: border-color .18s ease, background-color .18s ease;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      .tw-enhanced .premium-panel,
      .tw-enhanced .premium-card,
      .tw-enhanced .ytconv-premium-surface,
      .tw-enhanced header,
      .tw-enhanced main > section,
      .tw-enhanced aside,
      .tw-enhanced .card,
      .tw-enhanced .modal-content,
      .tw-enhanced .dropdown-menu,
      .tw-enhanced .offcanvas,
      .tw-enhanced .list-group-item,
      .tw-enhanced .toast {
        border-color: rgba(148, 163, 184, .22);
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        filter: none !important;
      }

      .tw-enhanced {
        font-family: Helvetica, Arial, sans-serif;
        background-image: none !important;
      }

      .tw-glow-orb {
        display: none !important;
        pointer-events: none !important;
      }

      .tw-enhanced h1,
      .tw-enhanced h2,
      .tw-enhanced h3,
      .tw-enhanced h4,
      .tw-enhanced h5,
      .tw-enhanced h6 {
        letter-spacing: -.015em;
        text-wrap: balance;
      }

      .tw-enhanced table {
        border-collapse: collapse;
        border-spacing: 0;
      }

      .tw-enhanced tbody tr,
      .tw-enhanced tbody tr:hover {
        transform: none !important;
        box-shadow: none !important;
        transition: background-color .18s ease;
      }

      .tw-enhanced .badge,
      .tw-enhanced [class*="rounded-full"],
      .tw-enhanced .chip,
      .tw-enhanced .status-pill,
      .tw-enhanced ::file-selector-button {
        box-shadow: none !important;
        text-shadow: none !important;
      }

      .tw-enhanced * {
        scrollbar-width: thin;
        scrollbar-color: rgba(96, 165, 250, .7) rgba(15, 23, 42, .72);
      }

      .tw-enhanced ::-webkit-scrollbar-thumb {
        background: #3b82f6;
        border-radius: 999px;
      }

      body > .modal-backdrop:not(.show),
      body > .offcanvas-backdrop:not(.show) {
        display: none !important;
        pointer-events: none !important;
      }

      @media (max-width: ${MOBILE_MAX_WIDTH}px) {
        body.tw-enhanced > .ytclean-mobilebar,
        body.tw-enhanced.ui-overlay-open > .ytclean-mobilebar,
        body.tw-enhanced.ytclean-booting > .ytclean-mobilebar,
        body.tw-enhanced.modal-open > .ytclean-mobilebar,
        body.tw-enhanced.has-open-modal > .ytclean-mobilebar {
          display: flex !important;
          position: fixed !important;
          top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
          left: 10px !important;
          right: 10px !important;
          width: auto !important;
          min-height: 58px !important;
          z-index: ${MOBILEBAR_Z} !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          isolation: isolate !important;
          transform: none !important;
          filter: none !important;
          contain: none !important;
        }

        body.tw-enhanced > .ytclean-mobilebar::before,
        body.tw-enhanced > .ytclean-mobilebar::after,
        body.tw-enhanced > .ytclean-mobilebar strong {
          pointer-events: none !important;
        }

        body.tw-enhanced > .ytclean-mobilebar button,
        body.tw-enhanced > .ytclean-mobilebar a,
        body.tw-enhanced > .ytclean-mobilebar #ytcleanOpenDrawer,
        body.tw-enhanced > .ytclean-mobilebar #ytcleanMobileTheme {
          position: relative !important;
          z-index: 2 !important;
          width: 46px !important;
          height: 46px !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          -webkit-tap-highlight-color: transparent;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const ensureGlowOrb = (body) => {
    let orb = document.getElementById('tw-glow-orb');
    if (!orb) {
      orb = document.createElement('div');
      orb.id = 'tw-glow-orb';
      orb.className = 'tw-glow-orb';
      orb.setAttribute('aria-hidden', 'true');
      body.prepend(orb);
    }
    return orb;
  };

  const portalMobileHeader = (body) => {
    const mobilebar = document.querySelector('.ytclean-mobilebar');
    if (!mobilebar) return null;

    if (mobilebar.parentElement !== body || mobilebar !== body.lastElementChild) {
      body.appendChild(mobilebar);
    }
    mobilebar.dataset.mobileHeaderPortal = 'body';
    mobilebar.dataset.mobileHeaderFix = 'v4';
    mobilebar.removeAttribute('aria-hidden');
    mobilebar.style.setProperty('z-index', String(MOBILEBAR_Z), 'important');
    mobilebar.style.setProperty('pointer-events', 'auto', 'important');
    return mobilebar;
  };

  const cleanupOrphanBackdrops = () => {
    const body = document.body;
    if (!body) return;

    const visibleModal = document.querySelector('.modal.show, .modal[aria-modal="true"]');
    const visibleOffcanvas = document.querySelector('.offcanvas.show, .offcanvas.showing');

    if (!visibleModal) {
      document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
      body.classList.remove('modal-open', 'has-open-modal');
    }

    if (!visibleOffcanvas) {
      document.querySelectorAll('.offcanvas-backdrop').forEach((backdrop) => backdrop.remove());
    }

    portalMobileHeader(body);
  };

  const syncDrawerState = () => {
    const isOpen = document.body.classList.contains('ytclean-drawer-open');
    document.getElementById('ytcleanOpenDrawer')?.setAttribute('aria-expanded', String(isOpen));
  };

  const toggleDrawer = () => {
    cleanupOrphanBackdrops();
    document.body.classList.toggle('ytclean-drawer-open');
    syncDrawerState();
  };

  const toggleTheme = () => {
    cleanupOrphanBackdrops();
    const root = document.documentElement;
    const current = root.getAttribute('data-bs-theme') || localStorage.getItem('ytmp3.theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';

    localStorage.setItem('ytmp3.theme', next);
    localStorage.setItem('themeMode', next);
    localStorage.setItem('ytconv.theme.mode', next);
    root.setAttribute('data-bs-theme', next);
    root.style.colorScheme = next;

    document.dispatchEvent(new CustomEvent('ytconv:themechange', { detail: { theme: next } }));
  };

  const pointInside = (element, x, y) => {
    if (!element || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const coordinatesFromEvent = (event) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    return {
      x: Number(touch?.clientX ?? event.clientX),
      y: Number(touch?.clientY ?? event.clientY),
    };
  };

  const installMobileControlFallback = () => {
    if (window.__ytconvMobileHeaderFallbackInstalledV4) return;
    window.__ytconvMobileHeaderFallbackInstalledV4 = true;

    let lastAction = '';
    let lastActionAt = 0;

    const resolveAction = (event) => {
      const directTarget = event.target?.closest?.('#ytcleanOpenDrawer, #ytcleanMobileTheme');
      if (directTarget) {
        return directTarget.id === 'ytcleanOpenDrawer'
          ? { id: 'drawer', action: toggleDrawer }
          : { id: 'theme', action: toggleTheme };
      }

      const { x, y } = coordinatesFromEvent(event);
      const drawerButton = document.getElementById('ytcleanOpenDrawer');
      const themeButton = document.getElementById('ytcleanMobileTheme');

      if (pointInside(drawerButton, x, y)) return { id: 'drawer', action: toggleDrawer };
      if (pointInside(themeButton, x, y)) return { id: 'theme', action: toggleTheme };
      return null;
    };

    const handlePress = (event) => {
      if (window.innerWidth > MOBILE_MAX_WIDTH) return;
      const resolved = resolveAction(event);
      if (!resolved) return;

      const now = Date.now();
      if (lastAction === resolved.id && now - lastActionAt < ACTION_DEBOUNCE_MS) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return;
      }

      lastAction = resolved.id;
      lastActionAt = now;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      resolved.action();
    };

    window.addEventListener('pointerdown', handlePress, true);
    window.addEventListener('touchstart', handlePress, { capture: true, passive: false });
    window.addEventListener('click', handlePress, true);
  };

  const installBackdropGuard = () => {
    if (window.__ytconvBackdropGuardInstalled) return;
    window.__ytconvBackdropGuardInstalled = true;

    let cleanupTimer = 0;
    const scheduleCleanup = () => {
      window.clearTimeout(cleanupTimer);
      cleanupTimer = window.setTimeout(cleanupOrphanBackdrops, 80);
    };

    const observer = new MutationObserver(scheduleCleanup);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'aria-modal'],
    });

    window.addEventListener('pageshow', scheduleCleanup);
    window.addEventListener('resize', scheduleCleanup, { passive: true });
    scheduleCleanup();
  };

  const markReady = () => {
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;

    root.dataset.tailwindUi = 'ready';
    body.classList.add('tw-enhanced');
    injectPolish();
    ensureGlowOrb(body);
    cleanupOrphanBackdrops();
    portalMobileHeader(body);
    installMobileControlFallback();
    installBackdropGuard();
    syncDrawerState();

    const interactiveSelector = 'button, a.btn, .btn, a[class*="bg-"], [role="button"], input, select, textarea';
    document.querySelectorAll(interactiveSelector).forEach((element) => {
      element.dataset.tailwindConnected = 'true';
    });

    document.addEventListener('pointerdown', (event) => {
      const target = event.target.closest?.('button, a, .btn, [role="button"]');
      if (!target) return;
      target.classList.add('tw-pressed');
    }, { passive: true });

    ['pointerup', 'pointercancel', 'mouseleave', 'blur'].forEach((name) => {
      document.addEventListener(name, (event) => {
        const target = event.target.closest?.('button, a, .btn, [role="button"]');
        target?.classList.remove('tw-pressed');
      }, true);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, { once: true });
  } else {
    markReady();
  }
})();