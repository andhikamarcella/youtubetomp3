(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const SECONDARY_ROUTES = ['studio', 'rewards', 'faq', 'community', 'profile', 'about'];
  const SKELETON_ROUTES = new Set(['rewards', 'faq']);
  let applyQueued = false;
  let skeletonTimer = 0;

  function routeFromLocation() {
    const path = location.pathname.toLowerCase();
    if (/\/(profile|account)(\/|$)/.test(path)) return 'profile';
    if (/\/(rewards|saweria)(\/|$)/.test(path)) return 'rewards';
    if (/\/faq(\/|$)/.test(path)) return 'faq';
    if (/\/community(\/|$)/.test(path)) return 'community';
    if (/\/studio(\/|$)/.test(path)) return 'studio';
    if (/\/about(\/|$)/.test(path)) return 'about';
    return SECONDARY_ROUTES.find((route) => document.body.classList.contains(`ytclean-route-${route}`)) || '';
  }

  function installStyles() {
    let style = $('#ytconv-secondary-route-ui-v15');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-secondary-route-ui-v15';
      document.head.appendChild(style);
    }
    if (style.dataset.ready === 'true') return;
    style.dataset.ready = 'true';
    style.textContent = `
      /* Never render backend health/status text inside the composer. */
      #statusWrap,
      .yc-assistant #statusWrap,
      [data-convert-health],
      .convert-health-status,
      .converter-health-status {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
      }

      body.ytconv-secondary-route .yc-composer,
      body.ytconv-secondary-route #ycrSecurityDock,
      body.ytconv-secondary-route #ycOptions,
      body.ytconv-secondary-route #ycConversation,
      body.ytconv-secondary-route #ycWelcome,
      body.ytconv-secondary-route #advanced-mode,
      body.ytconv-secondary-route .ytconv-header-actions,
      body.ytconv-secondary-route #ytconvHeaderMusic,
      body.ytconv-secondary-route #headerModeToggle {
        display: none !important;
      }

      body.ytconv-secondary-route #mainContent {
        width: min(100%, 1040px) !important;
        max-width: 1040px !important;
        padding-bottom: 36px !important;
      }

      /* Profile modal: target the real Bootstrap modal directly. */
      #profileModal {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483600 !important;
        width: 100vw !important;
        height: 100dvh !important;
        padding: 0 !important;
        overflow: auto !important;
        background: transparent !important;
        box-sizing: border-box !important;
      }

      #profileModal.show {
        display: grid !important;
        place-items: center !important;
      }

      #profileModal .modal-dialog {
        position: relative !important;
        inset: auto !important;
        width: min(760px, calc(100vw - 40px)) !important;
        max-width: 760px !important;
        max-height: min(82dvh, 760px) !important;
        margin: auto !important;
        padding: 0 !important;
        transform: none !important;
        pointer-events: auto !important;
      }

      #profileModal .modal-content {
        width: 100% !important;
        max-width: 100% !important;
        max-height: min(82dvh, 760px) !important;
        margin: 0 !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        border-radius: 18px !important;
        background: #202326 !important;
        background-image: none !important;
        box-shadow: 0 28px 100px rgba(0,0,0,.58) !important;
        overflow: auto !important;
        overflow-x: hidden !important;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }

      #profileModal .modal-content,
      #profileModal .modal-content *,
      #profileModal .modal-content *::before,
      #profileModal .modal-content *::after {
        box-sizing: border-box !important;
      }

      #profileModal .modal-content img,
      #profileModal .modal-content iframe,
      #profileModal .modal-content video,
      #profileModal .modal-content canvas {
        max-width: 100% !important;
      }

      #profileModal .ytv15-close {
        position: sticky !important;
        top: 12px !important;
        float: right !important;
        z-index: 100 !important;
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        min-height: 42px !important;
        display: grid !important;
        place-items: center !important;
        margin: 12px 12px -54px auto !important;
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

      #profileModal .ytv15-duplicate-close { display: none !important; }

      .modal-backdrop.ytv15-profile-backdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483500 !important;
        width: 100vw !important;
        height: 100dvh !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: rgba(0,0,0,.58) !important;
        backdrop-filter: blur(6px) saturate(.92) !important;
        -webkit-backdrop-filter: blur(6px) saturate(.92) !important;
        opacity: 1 !important;
      }

      #ytv15RouteSkeleton {
        position: fixed;
        inset: 0 0 0 var(--ycr-side-width,260px);
        z-index: 2147483200;
        padding: 48px clamp(20px,5vw,64px);
        background: #212121;
        overflow: hidden;
      }
      body.ytclean-collapsed #ytv15RouteSkeleton { left: var(--ycr-rail-width,72px); }
      .ytv15-skeleton-shell { width: min(100%,920px); margin: 0 auto; }
      .ytv15-skeleton-line,
      .ytv15-skeleton-card { position: relative; overflow: hidden; background: #2b2b2b; }
      .ytv15-skeleton-line::after,
      .ytv15-skeleton-card::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);
        animation: ytv15Shimmer 1.1s infinite;
      }
      .ytv15-skeleton-line { height: 18px; margin-bottom: 12px; border-radius: 7px; }
      .ytv15-skeleton-line.title { width: 36%; height: 34px; margin-bottom: 28px; }
      .ytv15-skeleton-line.short { width: 60%; }
      .ytv15-skeleton-card { height: 112px; margin-top: 14px; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; }
      @keyframes ytv15Shimmer { to { transform: translateX(100%); } }

      [data-bs-theme='light'] #profileModal .modal-content {
        background: #fff !important;
        color: #202123 !important;
        border-color: rgba(0,0,0,.12) !important;
      }
      [data-bs-theme='light'] #profileModal .ytv15-close {
        background: #f4f4f4 !important;
        color: #202123 !important;
        border-color: rgba(0,0,0,.12) !important;
      }
      [data-bs-theme='light'] #ytv15RouteSkeleton { background: #fff; }
      [data-bs-theme='light'] .ytv15-skeleton-line,
      [data-bs-theme='light'] .ytv15-skeleton-card { background: #ececec; }

      @media (max-width: 991.98px) {
        #profileModal.show {
          display: block !important;
          padding: calc(92px + env(safe-area-inset-top,0px)) 8px calc(12px + env(safe-area-inset-bottom,0px)) !important;
        }
        #profileModal .modal-dialog {
          width: 100% !important;
          max-width: none !important;
          max-height: calc(100dvh - 104px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)) !important;
          margin: 0 auto !important;
        }
        #profileModal .modal-content {
          max-height: calc(100dvh - 104px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)) !important;
          border-radius: 16px !important;
        }
        #ytv15RouteSkeleton {
          inset: calc(78px + env(safe-area-inset-top,0px)) 0 0 0;
          padding: 26px 14px;
        }
      }
    `;
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

  function hideStatusWrap() {
    const status = $('#statusWrap');
    if (status) {
      status.hidden = true;
      status.setAttribute('aria-hidden', 'true');
      status.style.setProperty('display', 'none', 'important');
    }
    const pattern = /convert(?:er)?\s+aktif\s+normal|conversion\s+active\s+normal/i;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const targets = [];
    while (walker.nextNode()) {
      if (pattern.test(String(walker.currentNode.nodeValue || '').replace(/\s+/g, ' ').trim())) {
        targets.push(walker.currentNode.parentElement);
      }
    }
    targets.forEach((node) => {
      const target = node?.closest('#statusWrap,[data-convert-status],.converter-status,.convert-status,.alert,.badge') || node;
      if (!target) return;
      target.hidden = true;
      target.setAttribute('aria-hidden', 'true');
      target.style.setProperty('display', 'none', 'important');
    });
  }

  function closeProfile() {
    const modal = $('#profileModal');
    if (!modal) return;
    try {
      const instance = window.bootstrap?.Modal?.getInstance(modal) || window.bootstrap?.Modal?.getOrCreateInstance(modal);
      instance?.hide();
    } catch {
      modal.classList.remove('show');
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function normalizeProfileModal() {
    const modal = $('#profileModal');
    if (!modal) return;

    /* Undo classes and inline positioning introduced by obsolete v11-v14 patches. */
    $$('.ytv11-profile-dialog,.ytv12-dialog,.ytv13-dialog,.ytv13-profile-dialog,.ytv14-profile-panel', modal).forEach((node) => {
      node.classList.remove('ytv11-profile-dialog','ytv12-dialog','ytv13-dialog','ytv13-profile-dialog','ytv14-profile-panel');
      node.style.removeProperty('position');
      node.style.removeProperty('inset');
      node.style.removeProperty('left');
      node.style.removeProperty('right');
      node.style.removeProperty('top');
      node.style.removeProperty('bottom');
      node.style.removeProperty('transform');
      node.style.removeProperty('width');
      node.style.removeProperty('height');
      node.style.removeProperty('max-width');
      node.style.removeProperty('max-height');
      node.style.removeProperty('margin');
    });

    /* Recover a profile fragment that an older patch may have moved outside #profileModal. */
    const orphan = document.querySelector('body > .ytv14-profile-panel, body > .ytv13-profile-dialog, body > .ytv12-dialog');
    if (orphan && !modal.contains(orphan)) {
      orphan.classList.remove('ytv14-profile-panel','ytv13-profile-dialog','ytv13-dialog','ytv12-dialog');
      if (orphan.matches('.modal-dialog')) {
        modal.appendChild(orphan);
      } else if (orphan.matches('.modal-content')) {
        let dialog = $('.modal-dialog', modal);
        if (!dialog) {
          dialog = document.createElement('div');
          dialog.className = 'modal-dialog';
          modal.appendChild(dialog);
        }
        dialog.replaceChildren(orphan);
      } else {
        const content = $('.modal-content', modal) || $('.modal-dialog', modal) || modal;
        content.appendChild(orphan);
      }
    }

    const content = $('.modal-content', modal) || $('.modal-dialog', modal) || modal;
    const closeCandidates = $$('button', modal).filter((button) => {
      if (button.classList.contains('ytv15-close')) return true;
      if (button.matches('.btn-close,[data-bs-dismiss="modal"],.ytv11-dialog-close,.ytv12-close,.ytv13-close,.ytv14-profile-close')) return true;
      const label = `${button.getAttribute('aria-label') || ''} ${button.title || ''}`.trim();
      return /^(tutup|close)(\s|$)/i.test(label);
    });

    let close = closeCandidates.find((button) => button.classList.contains('ytv15-close')) || closeCandidates[0];
    if (!close) {
      close = document.createElement('button');
      close.type = 'button';
      content.prepend(close);
    }
    close.className = 'ytv15-close';
    close.removeAttribute('data-bs-dismiss');
    close.setAttribute('aria-label', 'Tutup profil');
    close.title = 'Tutup';
    close.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';

    closeCandidates.forEach((button) => {
      if (button === close) return;
      button.classList.add('ytv15-duplicate-close');
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });

    if (!close.dataset.ytv15Bound) {
      close.dataset.ytv15Bound = 'true';
      close.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeProfile();
      }, true);
    }
  }

  function normalizeBackdrop() {
    const modal = $('#profileModal');
    if (!modal?.classList.contains('show')) return;
    const backdrops = $$('.modal-backdrop');
    backdrops.forEach((backdrop, index) => {
      if (index < backdrops.length - 1) backdrop.remove();
    });
    const last = $$('.modal-backdrop').at(-1);
    if (last) last.classList.add('ytv15-profile-backdrop');
  }

  function inferRoute(control) {
    if (!control) return '';
    const value = [control.getAttribute?.('href'), control.dataset?.routePath, control.dataset?.route, control.id, control.textContent]
      .filter(Boolean).join(' ').toLowerCase();
    if (/faq|bantuan/.test(value)) return 'faq';
    if (/saweria|reward/.test(value)) return 'rewards';
    return '';
  }

  function showSkeleton(route) {
    if (!SKELETON_ROUTES.has(route)) return;
    clearTimeout(skeletonTimer);
    $$('#ytv13RouteSkeleton,#ytv14RouteSkeleton').forEach((node) => node.remove());
    sessionStorage.setItem('ytconv-v15-skeleton', route);
    let skeleton = $('#ytv15RouteSkeleton');
    if (!skeleton) {
      skeleton = document.createElement('div');
      skeleton.id = 'ytv15RouteSkeleton';
      skeleton.setAttribute('role', 'status');
      skeleton.setAttribute('aria-live', 'polite');
      document.body.appendChild(skeleton);
    }
    skeleton.innerHTML = '<div class="ytv15-skeleton-shell"><div class="ytv15-skeleton-line title"></div><div class="ytv15-skeleton-line short"></div><div class="ytv15-skeleton-line"></div><div class="ytv15-skeleton-card"></div><div class="ytv15-skeleton-card"></div><div class="ytv15-skeleton-card"></div></div>';
    skeleton.style.opacity = '1';
    skeleton.style.transition = 'none';
    document.body.setAttribute('aria-busy', 'true');
    skeletonTimer = window.setTimeout(() => {
      eagerize();
      skeleton.style.transition = 'opacity .18s ease';
      skeleton.style.opacity = '0';
      window.setTimeout(() => skeleton.remove(), 200);
      sessionStorage.removeItem('ytconv-v15-skeleton');
      document.body.removeAttribute('aria-busy');
    }, 760);
  }

  function applyRoute() {
    const route = routeFromLocation();
    const secondary = Boolean(route);
    document.body.classList.toggle('ytconv-secondary-route', secondary);
    if (secondary) document.body.dataset.ytconvSecondaryRoute = route;
    else delete document.body.dataset.ytconvSecondaryRoute;

    ['.yc-composer','#ycrSecurityDock','#ycOptions','#ycConversation','#ycWelcome'].forEach((selector) => {
      const node = $(selector);
      if (!node) return;
      node.hidden = secondary;
      if (secondary) node.setAttribute('aria-hidden', 'true');
      else node.removeAttribute('aria-hidden');
    });

    hideStatusWrap();
    normalizeProfileModal();
    normalizeBackdrop();
    eagerize();

    const stored = sessionStorage.getItem('ytconv-v15-skeleton');
    if (SKELETON_ROUTES.has(route) && stored === route) showSkeleton(route);
    document.documentElement.dataset.ytconvSecondaryRouteUi = 'v15';
  }

  function scheduleApply() {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(() => {
      applyQueued = false;
      applyRoute();
    });
  }

  function ready() {
    installStyles();
    applyRoute();

    const profileModal = $('#profileModal');
    profileModal?.addEventListener('show.bs.modal', () => {
      normalizeProfileModal();
      requestAnimationFrame(normalizeBackdrop);
    });
    profileModal?.addEventListener('shown.bs.modal', () => {
      normalizeProfileModal();
      normalizeBackdrop();
    });

    document.addEventListener('click', (event) => {
      const route = inferRoute(event.target.closest?.('a,button,[data-route-path],[data-route]'));
      if (route) showSkeleton(route);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && $('#profileModal.show')) closeProfile();
    }, true);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) eagerize(node);
        }
      }
      scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    new MutationObserver(scheduleApply).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pageshow', applyRoute, { passive: true });
    window.setTimeout(applyRoute, 350);
    window.setTimeout(applyRoute, 1000);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();