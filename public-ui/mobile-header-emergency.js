(() => {
  const MOBILE_MAX_WIDTH = 991.98;
  const MAX_Z_INDEX = '2147483647';
  const VERSION = 'v6';
  const TAP_MOVE_TOLERANCE_PX = 18;
  const SYNTHETIC_CLICK_WINDOW_MS = 900;

  if (window.__ytconvMobileHeaderEmergencyV6) return;
  window.__ytconvMobileHeaderEmergencyV6 = true;

  // Emergency script is loaded before the Tailwind bridge. Setting this flag
  // prevents the older pointerdown/touchstart fallback from installing and
  // toggling the same control before the user's finger is released.
  window.__ytconvMobileHeaderFallbackInstalledV4 = true;

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
          transform: none !important;
          transition: background-color .12s ease, border-color .12s ease, color .12s ease !important;
          -webkit-tap-highlight-color: transparent;
        }

        body > .ytclean-mobilebar button:active,
        body > .ytclean-mobilebar a:active {
          transform: none !important;
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
      button?.style.setProperty('transform', 'none', 'important');
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

  let gesture = null;
  let lastCompletedAction = '';
  let lastCompletedAt = 0;

  const beginPress = (event) => {
    if (!isMobile()) return;
    mountHeader();

    const action = actionForEvent(event);
    if (!action) {
      gesture = null;
      return;
    }

    const { x, y } = eventPoint(event);
    gesture = {
      pointerId: event.pointerId ?? 'touch',
      action,
      startX: x,
      startY: y,
    };
  };

  const finishPress = (event) => {
    if (!isMobile() || !gesture) return;
    if (event.pointerId != null && gesture.pointerId !== event.pointerId) return;

    const currentGesture = gesture;
    gesture = null;

    const endingAction = actionForEvent(event);
    const { x, y } = eventPoint(event);
    const distance = Math.hypot(x - currentGesture.startX, y - currentGesture.startY);
    const isTap = endingAction?.id === currentGesture.action.id && distance <= TAP_MOVE_TOLERANCE_PX;
    if (!isTap) return;

    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    lastCompletedAction = currentGesture.action.id;
    lastCompletedAt = Date.now();
    currentGesture.action.run();
  };

  const cancelPress = () => {
    gesture = null;
  };

  const captureClick = (event) => {
    if (!isMobile()) return;
    const action = actionForEvent(event);
    if (!action) return;

    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    const isSyntheticDuplicate =
      action.id === lastCompletedAction &&
      Date.now() - lastCompletedAt < SYNTHETIC_CLICK_WINDOW_MS;

    if (isSyntheticDuplicate) return;

    lastCompletedAction = action.id;
    lastCompletedAt = Date.now();
    action.run();
  };

  if ('PointerEvent' in window) {
    window.addEventListener('pointerdown', beginPress, true);
    window.addEventListener('pointerup', finishPress, true);
    window.addEventListener('pointercancel', cancelPress, true);
  } else {
    window.addEventListener('touchstart', beginPress, { capture: true, passive: true });
    window.addEventListener('touchend', finishPress, { capture: true, passive: false });
    window.addEventListener('touchcancel', cancelPress, true);
  }
  window.addEventListener('click', captureClick, true);

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