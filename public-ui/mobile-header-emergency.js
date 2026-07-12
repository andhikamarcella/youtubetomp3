(() => {
  const MOBILE_MAX_WIDTH = 991.98;
  const MAX_Z_INDEX = '2147483647';
  const VERSION = 'v5';
  const DEBOUNCE_MS = 650;

  if (window.__ytconvMobileHeaderEmergencyV5) return;
  window.__ytconvMobileHeaderEmergencyV5 = true;

  const isMobile = () => window.innerWidth <= MOBILE_MAX_WIDTH;

  const injectEmergencyStyle = () => {
    if (document.getElementById('ytconv-mobile-header-emergency-style')) return;
    const style = document.createElement('style');
    style.id = 'ytconv-mobile-header-emergency-style';
    style.textContent = `
      @media (max-width: ${MOBILE_MAX_WIDTH}px) {
        body > .ytclean-mobilebar,
        body.ui-overlay-open > .ytclean-mobilebar,
        body.modal-open > .ytclean-mobilebar,
        body.has-open-modal > .ytclean-mobilebar,
        body.ytclean-booting > .ytclean-mobilebar {
          display: flex !important;
          position: fixed !important;
          top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
          left: 10px !important;
          right: 10px !important;
          width: auto !important;
          min-height: 58px !important;
          z-index: ${MAX_Z_INDEX} !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          transform: none !important;
          filter: none !important;
          contain: none !important;
          isolation: isolate !important;
        }

        body > .ytclean-mobilebar::before,
        body > .ytclean-mobilebar::after,
        body > .ytclean-mobilebar strong {
          pointer-events: none !important;
        }

        body > .ytclean-mobilebar button,
        body > .ytclean-mobilebar a,
        body > .ytclean-mobilebar #ytcleanOpenDrawer,
        body > .ytclean-mobilebar #ytcleanMobileTheme {
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

        body > .modal-backdrop:not(.show),
        body > .offcanvas-backdrop:not(.show) {
          display: none !important;
          pointer-events: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const cleanupOrphanBackdrops = () => {
    const body = document.body;
    if (!body) return;

    const visibleModal = document.querySelector('.modal.show, .modal[aria-modal="true"]');
    const visibleOffcanvas = document.querySelector('.offcanvas.show, .offcanvas.showing');

    if (!visibleModal) {
      document.querySelectorAll('.modal-backdrop').forEach((element) => element.remove());
      body.classList.remove('modal-open', 'has-open-modal');
    }

    if (!visibleOffcanvas) {
      document.querySelectorAll('.offcanvas-backdrop').forEach((element) => element.remove());
    }
  };

  const mountHeader = () => {
    const body = document.body;
    const mobilebar = document.querySelector('.ytclean-mobilebar');
    if (!body || !mobilebar) return null;

    injectEmergencyStyle();
    cleanupOrphanBackdrops();

    if (mobilebar.parentElement !== body || mobilebar !== body.lastElementChild) {
      body.appendChild(mobilebar);
    }

    mobilebar.dataset.mobileHeaderEmergency = VERSION;
    mobilebar.removeAttribute('aria-hidden');
    mobilebar.style.setProperty('z-index', MAX_Z_INDEX, 'important');
    mobilebar.style.setProperty('pointer-events', 'auto', 'important');

    for (const id of ['ytcleanOpenDrawer', 'ytcleanMobileTheme']) {
      const button = document.getElementById(id);
      button?.style.setProperty('pointer-events', 'auto', 'important');
      button?.style.setProperty('touch-action', 'manipulation', 'important');
    }

    return mobilebar;
  };

  const syncDrawerState = () => {
    const open = document.body?.classList.contains('ytclean-drawer-open') || false;
    document.getElementById('ytcleanOpenDrawer')?.setAttribute('aria-expanded', String(open));
  };

  const toggleDrawer = () => {
    cleanupOrphanBackdrops();
    document.body?.classList.toggle('ytclean-drawer-open');
    syncDrawerState();
  };

  const toggleTheme = () => {
    cleanupOrphanBackdrops();
    const root = document.documentElement;
    const current = root.getAttribute('data-bs-theme') || localStorage.getItem('ytmp3.theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';

    root.setAttribute('data-bs-theme', next);
    root.style.colorScheme = next;
    localStorage.setItem('ytmp3.theme', next);
    localStorage.setItem('themeMode', next);
    localStorage.setItem('ytconv.theme.mode', next);
    document.dispatchEvent(new CustomEvent('ytconv:themechange', { detail: { theme: next } }));
  };

  const pointInside = (element, x, y) => {
    if (!element || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const eventPoint = (event) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    return {
      x: Number(touch?.clientX ?? event.clientX),
      y: Number(touch?.clientY ?? event.clientY),
    };
  };

  const actionForEvent = (event) => {
    const direct = event.target?.closest?.('#ytcleanOpenDrawer, #ytcleanMobileTheme');
    if (direct?.id === 'ytcleanOpenDrawer') return { id: 'drawer', run: toggleDrawer };
    if (direct?.id === 'ytcleanMobileTheme') return { id: 'theme', run: toggleTheme };

    const { x, y } = eventPoint(event);
    if (pointInside(document.getElementById('ytcleanOpenDrawer'), x, y)) {
      return { id: 'drawer', run: toggleDrawer };
    }
    if (pointInside(document.getElementById('ytcleanMobileTheme'), x, y)) {
      return { id: 'theme', run: toggleTheme };
    }
    return null;
  };

  let lastAction = '';
  let lastActionAt = 0;

  const captureMobilePress = (event) => {
    if (!isMobile()) return;
    mountHeader();
    const action = actionForEvent(event);
    if (!action) return;

    const now = Date.now();
    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    if (lastAction === action.id && now - lastActionAt < DEBOUNCE_MS) return;
    lastAction = action.id;
    lastActionAt = now;
    action.run();
  };

  window.addEventListener('pointerdown', captureMobilePress, true);
  window.addEventListener('touchstart', captureMobilePress, { capture: true, passive: false });
  window.addEventListener('click', captureMobilePress, true);

  const boot = () => {
    mountHeader();
    syncDrawerState();

    let timer = 0;
    const scheduleMount = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(mountHeader, 80);
    };

    const observer = new MutationObserver(scheduleMount);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'aria-modal'],
    });

    window.addEventListener('pageshow', scheduleMount);
    window.addEventListener('resize', scheduleMount, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();