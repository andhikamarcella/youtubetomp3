(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const PROFILE_MARKERS = ['XP SAAT INI', 'DAILY STREAK', 'RENTANG LEVEL'];
  const SKELETON_ROUTES = new Set(['faq', 'rewards']);
  let scheduled = false;
  let skeletonTimer = 0;

  function routeFromLocation() {
    const path = location.pathname.toLowerCase();
    if (/\/(profile|account)(\/|$)/.test(path)) return 'profile';
    if (/\/(rewards|saweria)(\/|$)/.test(path)) return 'rewards';
    if (/\/faq(\/|$)/.test(path)) return 'faq';
    return '';
  }

  function installStyles() {
    let style = $('#ytconv-critical-fix-v14');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-critical-fix-v14';
      document.head.appendChild(style);
    }
    if (style.dataset.ready) return;
    style.dataset.ready = 'true';
    style.textContent = `
      /* Backend status stays available to scripts, but is never rendered in the UI. */
      #statusWrap,
      .yc-assistant #statusWrap,
      [data-convert-health],
      .convert-health-status,
      .converter-health-status {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .ytv14-profile-panel {
        position: fixed !important;
        inset: 50% auto auto 50% !important;
        z-index: 2147483600 !important;
        width: min(760px, calc(100vw - 40px)) !important;
        max-width: 760px !important;
        max-height: min(82dvh, 760px) !important;
        margin: 0 !important;
        padding: 58px 20px 22px !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 18px !important;
        background: #202326 !important;
        background-image: none !important;
        box-shadow: 0 28px 100px rgba(0,0,0,.58) !important;
        overflow: auto !important;
        overflow-x: hidden !important;
        transform: translate(-50%, -50%) !important;
        box-sizing: border-box !important;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }

      .ytv14-profile-panel *,
      .ytv14-profile-panel *::before,
      .ytv14-profile-panel *::after { box-sizing: border-box !important; }

      .ytv14-profile-panel > *,
      .ytv14-profile-panel .modal-dialog,
      .ytv14-profile-panel .modal-content,
      .ytv14-profile-panel .offcanvas-body,
      .ytv14-profile-panel iframe,
      .ytv14-profile-panel img {
        max-width: 100% !important;
      }

      .ytv14-profile-panel .modal-dialog,
      .ytv14-profile-panel .modal-content,
      .ytv14-profile-panel .offcanvas-body {
        width: 100% !important;
        margin: 0 !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .ytv14-profile-close {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 30 !important;
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        min-height: 42px !important;
        display: grid !important;
        place-items: center !important;
        padding: 0 !important;
        border: 1px solid rgba(255,255,255,.14) !important;
        border-radius: 50% !important;
        background: #303236 !important;
        color: #f4f4f4 !important;
        font-size: 18px !important;
        line-height: 1 !important;
        box-shadow: none !important;
        cursor: pointer !important;
      }

      .ytv14-profile-close:hover { background: #3a3d42 !important; }
      .ytv14-duplicate-close { display: none !important; }

      #ytv14ProfileBackdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483500 !important;
        width: 100vw !important;
        height: 100dvh !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: rgba(0,0,0,.56) !important;
        backdrop-filter: blur(6px) saturate(.92) !important;
        -webkit-backdrop-filter: blur(6px) saturate(.92) !important;
      }

      #ytv14RouteSkeleton {
        position: fixed;
        inset: 0 0 0 var(--ycr-side-width, 260px);
        z-index: 2147483200;
        padding: 48px clamp(20px,5vw,64px);
        background: #212121;
        overflow: hidden;
      }
      body.ytclean-collapsed #ytv14RouteSkeleton { left: var(--ycr-rail-width,72px); }
      .ytv14-skeleton-shell { width: min(100%,920px); margin: 0 auto; }
      .ytv14-skeleton-line,
      .ytv14-skeleton-card { position: relative; overflow: hidden; background: #2b2b2b; }
      .ytv14-skeleton-line::after,
      .ytv14-skeleton-card::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);
        animation: ytv14Shimmer 1.1s infinite;
      }
      .ytv14-skeleton-line { height: 18px; margin-bottom: 12px; border-radius: 7px; }
      .ytv14-skeleton-line.title { width: 36%; height: 34px; margin-bottom: 28px; }
      .ytv14-skeleton-line.short { width: 60%; }
      .ytv14-skeleton-card { height: 112px; margin-top: 14px; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; }
      @keyframes ytv14Shimmer { to { transform: translateX(100%); } }

      [data-bs-theme='light'] .ytv14-profile-panel { background: #fff !important; color: #202123 !important; border-color: rgba(0,0,0,.12) !important; }
      [data-bs-theme='light'] .ytv14-profile-close { background: #f4f4f4 !important; color: #202123 !important; border-color: rgba(0,0,0,.12) !important; }
      [data-bs-theme='light'] #ytv14RouteSkeleton { background: #fff; }
      [data-bs-theme='light'] .ytv14-skeleton-line,
      [data-bs-theme='light'] .ytv14-skeleton-card { background: #ececec; }

      @media (max-width: 991.98px) {
        .ytv14-profile-panel {
          inset: calc(96px + env(safe-area-inset-top,0px)) 10px calc(12px + env(safe-area-inset-bottom,0px)) 10px !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          padding: 58px 14px 18px !important;
          border-radius: 18px !important;
          transform: none !important;
        }
        .ytv14-profile-panel iframe { width: 100% !important; }
        #ytv14RouteSkeleton { inset: calc(78px + env(safe-area-inset-top,0px)) 0 0 0; padding: 26px 14px; }
      }

      @media (max-width: 420px) {
        .ytv14-profile-panel { left: 8px !important; right: 8px !important; border-radius: 16px !important; }
        .ytv14-profile-close { top: 9px !important; right: 9px !important; }
      }
    `;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function hideRenderedConverterStatus(root = document.body) {
    $('#statusWrap')?.setAttribute('aria-hidden', 'true');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      const value = normalizeText(walker.currentNode.nodeValue);
      if (/convert(?:er)? aktif normal|conversion active normal/i.test(value)) matches.push(walker.currentNode.parentElement);
    }
    matches.forEach((element) => {
      if (!element) return;
      const target = element.closest('#statusWrap,[data-convert-status],.converter-status,.convert-status,.alert,.badge') || element;
      target.hidden = true;
      target.setAttribute('aria-hidden', 'true');
      target.style.setProperty('display', 'none', 'important');
    });
  }

  function eagerize(root = document) {
    $$('img,iframe', root).forEach((node) => {
      const deferred = node.getAttribute('data-src');
      if (deferred && !node.getAttribute('src')) node.setAttribute('src', deferred);
      node.setAttribute('loading', 'eager');
      node.setAttribute('fetchpriority', 'high');
      if ('fetchPriority' in node) node.fetchPriority = 'high';
      if (node.tagName === 'IMG') node.decoding = 'sync';
    });
    $$('video,audio', root).forEach((node) => {
      node.preload = 'auto';
      node.setAttribute('preload', 'auto');
    });
  }

  function findTextNode(pattern) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (pattern.test(normalizeText(walker.currentNode.nodeValue))) return walker.currentNode;
    }
    return null;
  }

  function findProfilePanel() {
    if (routeFromLocation() !== 'profile' && !document.body.classList.contains('ytclean-route-profile')) return null;
    const marker = findTextNode(/XP SAAT INI/i) || findTextNode(/DAILY STREAK/i);
    let node = marker?.parentElement || null;
    while (node && node !== document.body && node !== document.documentElement) {
      const text = normalizeText(node.textContent);
      const hasStats = PROFILE_MARKERS.every((item) => text.includes(item));
      const hasLogin = /Belum Login|Masuk Google|Login dengan Google/i.test(text);
      if (hasStats && hasLogin) {
        const rect = node.getBoundingClientRect();
        if (rect.width >= 260 && rect.height >= 260) return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function isCloseButton(button) {
    if (!button) return false;
    if (button.classList.contains('ytv14-profile-close')) return true;
    if (button.matches('.btn-close,[data-bs-dismiss="modal"],[data-bs-dismiss="offcanvas"],.ytv11-dialog-close,.ytv12-close,.ytv13-close')) return true;
    const label = normalizeText(`${button.getAttribute('aria-label') || ''} ${button.title || ''}`);
    return /^(tutup|close)(\s|$)/i.test(label);
  }

  function closeProfile(panel) {
    try {
      const modal = panel.matches('.modal') ? panel : panel.closest('.modal');
      const instance = modal && (window.bootstrap?.Modal?.getInstance(modal) || window.bootstrap?.Modal?.getOrCreateInstance(modal));
      if (instance) instance.hide();
    } catch {}
    panel.classList.remove('show','open','ytconv-modal-active');
    panel.hidden = true;
    panel.setAttribute('aria-hidden','true');
    $('#ytv14ProfileBackdrop')?.remove();
    document.body.classList.remove('modal-open','ytconv-dialog-open');
  }

  function normalizeProfilePanel() {
    const panel = findProfilePanel();
    if (!panel) return;

    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    panel.classList.add('ytv14-profile-panel');
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    panel.removeAttribute('aria-hidden');
    panel.hidden = false;

    const buttons = $$('button', panel).filter(isCloseButton);
    let close = buttons.find((button) => button.classList.contains('ytv14-profile-close')) || buttons[0];
    if (!close) {
      close = document.createElement('button');
      close.type = 'button';
      panel.appendChild(close);
    }
    close.classList.add('ytv14-profile-close');
    close.classList.remove('btn-close','ytv11-dialog-close','ytv12-close','ytv13-close');
    close.setAttribute('aria-label','Tutup profil');
    close.title = 'Tutup';
    close.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';

    buttons.forEach((button) => {
      if (button === close) return;
      button.hidden = true;
      button.classList.add('ytv14-duplicate-close');
      button.setAttribute('aria-hidden','true');
      button.tabIndex = -1;
    });

    if (!close.dataset.ytv14Bound) {
      close.dataset.ytv14Bound = 'true';
      close.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeProfile(panel);
      }, true);
    }

    let backdrop = $('#ytv14ProfileBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'ytv14ProfileBackdrop';
      backdrop.addEventListener('click', () => closeProfile(panel));
      document.body.insertBefore(backdrop, panel);
    }
    $$('.modal-backdrop,.ytconv-modal-backdrop,.ytv11-dialog-backdrop,.ytv12-backdrop,.ytv13-backdrop').forEach((node) => node.remove());
  }

  function inferRoute(control) {
    if (!control) return '';
    const value = normalizeText([
      control.getAttribute?.('href'), control.dataset?.routePath, control.dataset?.route, control.id, control.textContent,
    ].filter(Boolean).join(' ')).toLowerCase();
    if (/faq|bantuan/.test(value)) return 'faq';
    if (/saweria|reward/.test(value)) return 'rewards';
    return '';
  }

  function showSkeleton(route) {
    if (!SKELETON_ROUTES.has(route)) return;
    clearTimeout(skeletonTimer);
    $('#ytv13RouteSkeleton')?.remove();
    sessionStorage.setItem('ytconv-v14-skeleton', route);
    let skeleton = $('#ytv14RouteSkeleton');
    if (!skeleton) {
      skeleton = document.createElement('div');
      skeleton.id = 'ytv14RouteSkeleton';
      skeleton.setAttribute('role','status');
      skeleton.setAttribute('aria-live','polite');
      document.body.appendChild(skeleton);
    }
    skeleton.innerHTML = '<div class="ytv14-skeleton-shell"><div class="ytv14-skeleton-line title"></div><div class="ytv14-skeleton-line short"></div><div class="ytv14-skeleton-line"></div><div class="ytv14-skeleton-card"></div><div class="ytv14-skeleton-card"></div><div class="ytv14-skeleton-card"></div></div>';
    skeleton.style.opacity = '1';
    skeleton.style.transition = 'none';
    document.body.setAttribute('aria-busy','true');
    skeletonTimer = window.setTimeout(() => {
      eagerize();
      skeleton.style.transition = 'opacity .18s ease';
      skeleton.style.opacity = '0';
      window.setTimeout(() => skeleton.remove(), 200);
      sessionStorage.removeItem('ytconv-v14-skeleton');
      document.body.removeAttribute('aria-busy');
    }, 760);
  }

  function apply() {
    installStyles();
    eagerize();
    hideRenderedConverterStatus();
    normalizeProfilePanel();
    const route = routeFromLocation();
    const stored = sessionStorage.getItem('ytconv-v14-skeleton');
    if (SKELETON_ROUTES.has(route) && (stored === route || !document.documentElement.dataset.ytv14InitialSkeleton)) {
      document.documentElement.dataset.ytv14InitialSkeleton = 'true';
      showSkeleton(route);
    }
    document.documentElement.dataset.ytconvCriticalFix = 'v14';
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function ready() {
    apply();
    document.addEventListener('click', (event) => {
      const route = inferRoute(event.target.closest?.('a,button,[data-route-path],[data-route]'));
      if (route) showSkeleton(route);
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const panel = $('.ytv14-profile-panel:not([hidden])');
        if (panel) closeProfile(panel);
      }
    }, true);
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) eagerize(node);
      }));
      scheduleApply();
    }).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(scheduleApply).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pageshow', apply, { passive: true });
    window.setTimeout(apply, 350);
    window.setTimeout(apply, 1000);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();