(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ROUTES = ['studio', 'rewards', 'faq', 'community', 'profile', 'about'];
  const SKELETON_ROUTES = new Set(['rewards', 'faq']);
  const LABELS = {
    studio: 'Studio',
    rewards: 'Saweria / Rewards',
    faq: 'FAQ / Bantuan',
    community: 'Komunitas',
    profile: 'Profil',
    about: 'About',
  };
  const routeSelector = ROUTES.map((route) => `body.ytclean-route-${route}`).join(',');

  let activeRoute = '';
  let skeletonStartedAt = 0;
  let skeletonTimer = 0;
  let scheduled = false;

  function routeFromLocation() {
    const path = location.pathname.toLowerCase();
    if (/\/(rewards|saweria)(\/|$)/.test(path)) return 'rewards';
    if (/\/(profile|account)(\/|$)/.test(path)) return 'profile';
    return ROUTES.find((route) => path === `/${route}` || path.startsWith(`/${route}/`)) || '';
  }

  function getRoute() {
    return ROUTES.find((route) => document.body.classList.contains(`ytclean-route-${route}`)) || routeFromLocation();
  }

  function installStyles() {
    let style = $('#ytconv-secondary-route-ui-v12');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-secondary-route-ui-v12';
      document.head.appendChild(style);
    }

    style.textContent = `
      ${routeSelector} {
        --ys12-bg: #212121;
        --ys12-panel: #2f2f2f;
        --ys12-panel-soft: #272727;
        --ys12-hover: #383838;
        --ys12-border: rgba(255,255,255,.10);
        --ys12-text: #ececec;
        --ys12-muted: #a8a8a8;
        background: var(--ys12-bg) !important;
        color: var(--ys12-text) !important;
      }

      ${routeSelector} .yc-composer,
      ${routeSelector} #ycrSecurityDock,
      ${routeSelector} #ycOptions,
      ${routeSelector} #ycConversation,
      ${routeSelector} #ycWelcome,
      ${routeSelector} #advanced-mode,
      ${routeSelector} .ytconv-header-actions,
      ${routeSelector} #ytconvHeaderMusic,
      ${routeSelector} #headerModeToggle,
      ${routeSelector} [data-convert-status],
      ${routeSelector} .converter-status,
      ${routeSelector} .convert-status {
        display: none !important;
      }

      ${routeSelector} #mainContent {
        width: min(100%, 1040px) !important;
        max-width: 1040px !important;
        min-height: calc(100dvh - 72px);
        padding-bottom: 32px !important;
      }

      ${routeSelector} #mainContent > .section-header,
      ${routeSelector} .section-header.ytconv-hero-clean {
        display: block !important;
        min-height: auto !important;
        margin: 0 0 22px !important;
        padding: 12px 2px 18px !important;
        border: 0 !important;
        border-bottom: 1px solid var(--ys12-border) !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      ${routeSelector} #activeSectionTitle {
        margin: 0 !important;
        color: var(--ys12-text) !important;
        font-size: clamp(28px, 4vw, 38px) !important;
        line-height: 1.08 !important;
        letter-spacing: -.035em !important;
        text-transform: none !important;
      }

      ${routeSelector} #activeSectionSubtitle {
        display: block !important;
        max-width: 680px !important;
        margin: 8px 0 0 !important;
        color: var(--ys12-muted) !important;
        font-size: 14px !important;
        line-height: 1.55 !important;
      }

      ${routeSelector} #mainContent .card,
      ${routeSelector} #mainContent .accordion-item,
      ${routeSelector} #mainContent .list-group-item,
      ${routeSelector} #mainContent [class*='panel'],
      ${routeSelector} #mainContent [class*='surface'] {
        border: 1px solid var(--ys12-border) !important;
        border-radius: 16px !important;
        background: var(--ys12-panel-soft) !important;
        background-image: none !important;
        color: var(--ys12-text) !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .card-body { padding: clamp(18px, 3vw, 28px) !important; }
      ${routeSelector} #mainContent h1,
      ${routeSelector} #mainContent h2,
      ${routeSelector} #mainContent h3,
      ${routeSelector} #mainContent h4,
      ${routeSelector} #mainContent h5,
      ${routeSelector} #mainContent h6,
      ${routeSelector} #mainContent strong,
      ${routeSelector} #mainContent label { color: var(--ys12-text) !important; }
      ${routeSelector} #mainContent p,
      ${routeSelector} #mainContent small,
      ${routeSelector} #mainContent .text-muted,
      ${routeSelector} #mainContent .form-text { color: var(--ys12-muted) !important; }

      ${routeSelector} #mainContent .form-control,
      ${routeSelector} #mainContent .form-select,
      ${routeSelector} #mainContent textarea,
      ${routeSelector} #mainContent input:not([type='checkbox']):not([type='radio']):not([type='range']) {
        min-height: 46px !important;
        border: 1px solid var(--ys12-border) !important;
        border-radius: 12px !important;
        background: var(--ys12-panel) !important;
        color: var(--ys12-text) !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .btn {
        min-height: 42px;
        border-radius: 11px !important;
        font-weight: 600 !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .accordion { display: grid; gap: 10px; }
      ${routeSelector} #mainContent .accordion-button {
        min-height: 58px;
        border-radius: 14px !important;
        background: transparent !important;
        color: var(--ys12-text) !important;
        box-shadow: none !important;
      }
      ${routeSelector} #mainContent .accordion-body { color: var(--ys12-muted) !important; }

      .ytv12-dialog {
        position: fixed !important;
        inset: 50% auto auto 50% !important;
        z-index: 2147483560 !important;
        width: min(760px, calc(100vw - 32px)) !important;
        max-width: 760px !important;
        max-height: min(82dvh, 760px) !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 1px solid var(--ys12-border, rgba(255,255,255,.10)) !important;
        border-radius: 18px !important;
        background: var(--ys12-panel-soft, #272727) !important;
        background-image: none !important;
        box-shadow: 0 24px 90px rgba(0,0,0,.48) !important;
        overflow: auto !important;
        transform: translate(-50%, -50%) !important;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }

      .ytv12-dialog > .modal-dialog,
      .ytv12-dialog > .offcanvas-body,
      .ytv12-dialog .modal-content {
        width: 100% !important;
        max-width: none !important;
        min-height: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: inherit !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .ytv12-dialog *,
      #forumWidgetPanel *,
      #forumWidgetMessages,
      #forumWidgetMessages::before,
      #forumWidgetMessages::after {
        background-image: none !important;
      }

      .ytv12-dialog iframe,
      .ytv12-dialog img {
        max-width: 100% !important;
      }

      #forumWidget.open #forumWidgetToggle { display: none !important; }
      #forumWidgetPanel {
        position: fixed !important;
        inset: 50% auto auto 50% !important;
        z-index: 2147483560 !important;
        width: min(760px, calc(100vw - 32px)) !important;
        max-width: 760px !important;
        max-height: min(82dvh, 740px) !important;
        margin: 0 !important;
        border: 1px solid var(--ys12-border, rgba(255,255,255,.10)) !important;
        border-radius: 18px !important;
        background: var(--ys12-panel-soft, #272727) !important;
        background-image: none !important;
        box-shadow: 0 24px 90px rgba(0,0,0,.48) !important;
        overflow: hidden !important;
        transform: translate(-50%, -50%) !important;
      }
      #forumWidgetMessages { background: var(--ys12-bg, #212121) !important; }

      .ytv12-close {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 50 !important;
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        min-height: 42px !important;
        display: grid !important;
        place-items: center !important;
        padding: 0 !important;
        border: 1px solid var(--ys12-border, rgba(255,255,255,.10)) !important;
        border-radius: 50% !important;
        background: var(--ys12-panel, #2f2f2f) !important;
        color: var(--ys12-text, #ececec) !important;
        font-size: 18px !important;
        line-height: 1 !important;
        box-shadow: none !important;
        cursor: pointer !important;
      }
      .ytv12-close:hover { background: var(--ys12-hover, #383838) !important; }
      .ytv12-duplicate-close { display: none !important; }

      .modal-backdrop.show,
      .ytconv-modal-backdrop,
      .ytv12-backdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483400 !important;
        width: 100vw !important;
        height: 100dvh !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: rgba(0,0,0,.54) !important;
        backdrop-filter: blur(6px) saturate(.92) !important;
        -webkit-backdrop-filter: blur(6px) saturate(.92) !important;
        opacity: 1 !important;
      }

      #ytv12RouteSkeleton {
        position: fixed;
        inset: 0 0 0 var(--ycr-side-width, 260px);
        z-index: 2147481900;
        padding: 48px clamp(20px, 5vw, 64px);
        background: var(--ys12-bg, #212121);
        overflow: hidden;
      }
      body.ytclean-collapsed #ytv12RouteSkeleton { left: var(--ycr-rail-width, 72px); }
      .ytv12-skeleton-shell { width: min(100%, 920px); margin: 0 auto; }
      .ytv12-skeleton-line,
      .ytv12-skeleton-card {
        position: relative;
        overflow: hidden;
        background: var(--ys12-panel-soft, #2a2a2a);
      }
      .ytv12-skeleton-line::after,
      .ytv12-skeleton-card::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent);
        animation: ytv12Shimmer 1.15s infinite;
      }
      .ytv12-skeleton-line { height: 18px; margin-bottom: 12px; border-radius: 7px; }
      .ytv12-skeleton-line.title { width: 34%; height: 34px; margin-bottom: 28px; }
      .ytv12-skeleton-line.short { width: 58%; }
      .ytv12-skeleton-card { height: 112px; margin-top: 14px; border: 1px solid var(--ys12-border, rgba(255,255,255,.1)); border-radius: 16px; }
      @keyframes ytv12Shimmer { to { transform: translateX(100%); } }

      #ytv12RouteFooter {
        width: 100%;
        margin-top: 28px;
        padding: 22px 2px 8px;
        border-top: 1px solid var(--ys12-border);
        color: var(--ys12-muted);
      }
      #ytv12RouteFooter .ytv12-footer-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      #ytv12RouteFooter nav { display: flex; gap: 14px; flex-wrap: wrap; }
      #ytv12RouteFooter a { color: inherit; text-decoration: none; }
      #ytv12RouteFooter a:hover { color: var(--ys12-text); }

      [data-bs-theme='light'] ${routeSelector} {
        --ys12-bg: #fff;
        --ys12-panel: #f4f4f4;
        --ys12-panel-soft: #fff;
        --ys12-hover: #ececec;
        --ys12-border: rgba(0,0,0,.11);
        --ys12-text: #202123;
        --ys12-muted: #676767;
      }
      [data-bs-theme='light'] .ytv12-dialog,
      [data-bs-theme='light'] #forumWidgetPanel { background: #fff !important; color: #202123 !important; }
      [data-bs-theme='light'] #ytv12RouteSkeleton { background: #fff; }
      [data-bs-theme='light'] .ytv12-skeleton-line,
      [data-bs-theme='light'] .ytv12-skeleton-card { background: #ececec; }

      @media (max-width: 991.98px) {
        ${routeSelector} #mainContent {
          width: 100% !important;
          max-width: none !important;
          padding: calc(86px + env(safe-area-inset-top, 0px)) 14px calc(38px + env(safe-area-inset-bottom, 0px)) !important;
        }

        .ytv12-dialog,
        #forumWidgetPanel {
          inset: calc(78px + env(safe-area-inset-top, 0px)) 10px calc(12px + env(safe-area-inset-bottom, 0px)) 10px !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 18px !important;
          transform: none !important;
        }

        .ytv12-dialog {
          padding-top: 54px !important;
        }

        .ytv12-dialog > .modal-dialog,
        .ytv12-dialog .modal-content {
          height: auto !important;
          max-height: none !important;
        }

        .ytv12-dialog iframe { width: 100% !important; }

        #ytv12RouteSkeleton {
          inset: calc(76px + env(safe-area-inset-top, 0px)) 0 0 0;
          padding: 26px 14px;
        }

        #ytv12RouteFooter .ytv12-footer-inner { align-items: flex-start; flex-direction: column; }
      }

      @media (max-width: 420px) {
        .ytv12-dialog,
        #forumWidgetPanel {
          left: 8px !important;
          right: 8px !important;
          border-radius: 16px !important;
        }
        .ytv12-close { top: 9px !important; right: 9px !important; }
      }
    `;
  }

  function eagerize(root = document) {
    $$('img, iframe', root).forEach((node) => {
      const deferred = node.getAttribute('data-src');
      if (deferred && !node.getAttribute('src')) node.setAttribute('src', deferred);
      node.setAttribute('loading', 'eager');
      node.setAttribute('fetchpriority', 'high');
      if ('fetchPriority' in node) node.fetchPriority = 'high';
      if (node.tagName === 'IMG') node.decoding = 'sync';
    });
    $$('video, audio', root).forEach((node) => {
      node.setAttribute('preload', 'auto');
      node.preload = 'auto';
    });
  }

  function inferRoute(control) {
    if (!control) return '';
    const value = [
      control.getAttribute?.('href'),
      control.dataset?.routePath,
      control.dataset?.route,
      control.id,
      control.textContent,
    ].filter(Boolean).join(' ').toLowerCase();
    if (/saweria|reward/.test(value)) return 'rewards';
    if (/faq|bantuan/.test(value)) return 'faq';
    if (/komunitas|community/.test(value)) return 'community';
    if (/profil|profile|account/.test(value)) return 'profile';
    if (/studio/.test(value)) return 'studio';
    if (/about/.test(value)) return 'about';
    return '';
  }

  function showSkeleton(route) {
    if (!SKELETON_ROUTES.has(route)) return;
    clearTimeout(skeletonTimer);
    skeletonStartedAt = performance.now();
    sessionStorage.setItem('ytconv-route-skeleton', route);

    let skeleton = $('#ytv12RouteSkeleton');
    if (!skeleton) {
      skeleton = document.createElement('div');
      skeleton.id = 'ytv12RouteSkeleton';
      skeleton.setAttribute('role', 'status');
      skeleton.setAttribute('aria-live', 'polite');
      document.body.appendChild(skeleton);
    }
    skeleton.innerHTML = `
      <div class="ytv12-skeleton-shell">
        <div class="ytv12-skeleton-line title"></div>
        <div class="ytv12-skeleton-line short"></div>
        <div class="ytv12-skeleton-line"></div>
        <div class="ytv12-skeleton-card"></div>
        <div class="ytv12-skeleton-card"></div>
        <div class="ytv12-skeleton-card"></div>
      </div>`;
    skeleton.hidden = false;
    document.body.setAttribute('aria-busy', 'true');
  }

  function hideSkeleton() {
    const skeleton = $('#ytv12RouteSkeleton');
    if (!skeleton) return;
    const elapsed = performance.now() - skeletonStartedAt;
    const delay = Math.max(0, 650 - elapsed);
    clearTimeout(skeletonTimer);
    skeletonTimer = window.setTimeout(() => {
      eagerize();
      skeleton.style.transition = 'opacity .18s ease';
      skeleton.style.opacity = '0';
      window.setTimeout(() => skeleton.remove(), 200);
      document.body.removeAttribute('aria-busy');
      sessionStorage.removeItem('ytconv-route-skeleton');
    }, delay);
  }

  function hideVisibleConverterStatus(root = document) {
    const pattern = /convert(?:er)?\s+aktif\s+normal|conversion\s+active\s+normal/i;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (pattern.test(node.nodeValue || '')) matches.push(node.parentElement);
    }
    matches.forEach((element) => {
      if (!element) return;
      let target = element;
      while (target.parentElement && target.parentElement !== document.body && target.textContent.trim().length < 140 && target.children.length <= 4) {
        const parent = target.parentElement;
        if (parent.matches('#mainContent, main, section, article, .card, .modal-content')) break;
        target = parent;
      }
      target.hidden = true;
      target.setAttribute('aria-hidden', 'true');
      target.dataset.ytv12BackendOnly = 'true';
    });
  }

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (dialog.id === 'forumWidgetPanel' || dialog.closest?.('#forumWidget')) {
      window.toggleForumWidget?.(false);
      return;
    }
    try {
      const modalRoot = dialog.matches('.modal') ? dialog : dialog.closest('.modal');
      const instance = modalRoot && (window.bootstrap?.Modal?.getInstance(modalRoot) || window.bootstrap?.Modal?.getOrCreateInstance(modalRoot));
      if (instance) {
        instance.hide();
        return;
      }
    } catch {}
    dialog.classList.remove('show', 'open', 'ytconv-modal-active');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.hidden = true;
    dedupeBackdrops();
    document.body.classList.remove('modal-open', 'ytconv-dialog-open');
  }

  function explicitCloseButtons(dialog) {
    return $$('button', dialog).filter((button) => {
      if (button.classList.contains('ytv12-close')) return true;
      if (button.matches('.btn-close, [data-bs-dismiss="modal"], [data-bs-dismiss="offcanvas"], .ytv11-dialog-close')) return true;
      const label = `${button.getAttribute('aria-label') || ''} ${button.title || ''}`;
      return /^(tutup|close)(\s|$)/i.test(label.trim());
    });
  }

  function normalizeClose(dialog, kind) {
    if (!dialog) return;
    const candidates = explicitCloseButtons(dialog);
    let canonical = candidates.find((button) => button.classList.contains('ytv12-close')) || candidates[0];
    if (!canonical) {
      canonical = document.createElement('button');
      canonical.type = 'button';
      dialog.appendChild(canonical);
    }

    canonical.className = 'ytv12-close';
    canonical.removeAttribute('data-bs-dismiss');
    canonical.setAttribute('aria-label', kind === 'community' ? 'Tutup komunitas' : 'Tutup profil');
    canonical.title = 'Tutup';
    canonical.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';

    candidates.forEach((button) => {
      if (button === canonical) return;
      button.classList.add('ytv12-duplicate-close');
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });

    if (!canonical.dataset.ytv12Bound) {
      canonical.dataset.ytv12Bound = 'true';
      canonical.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDialog(dialog);
      }, true);
    }
  }

  function profileCandidate(element) {
    if (!element) return false;
    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    return /XP SAAT INI|Belum Login|Daily Streak|Rentang Level|Masuk Google untuk simpan progress/i.test(text);
  }

  function portalDialogs() {
    const forumPanel = $('#forumWidgetPanel');
    if (forumPanel) {
      forumPanel.classList.add('ytv12-dialog', 'ytv12-community-dialog');
      normalizeClose(forumPanel, 'community');
    }

    const candidates = $$('.modal, [role="dialog"], .offcanvas, .ytconv-modal-polished');
    candidates.forEach((candidate) => {
      if (candidate === forumPanel || candidate.closest?.('#forumWidget')) return;
      if (!profileCandidate(candidate)) return;

      const dialog = candidate.matches('.modal, .offcanvas, [role="dialog"]') ? candidate : candidate.closest('.modal, .offcanvas, [role="dialog"]');
      if (!dialog) return;
      if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
      dialog.classList.add('ytv12-dialog', 'ytv12-profile-dialog');
      normalizeClose(dialog, 'profile');
    });

    dedupeBackdrops();
  }

  function dedupeBackdrops() {
    const backdrops = $$('.modal-backdrop, .ytconv-modal-backdrop, .ytv11-dialog-backdrop, .ytv12-backdrop').filter(isVisible);
    if (backdrops.length <= 1) return;
    backdrops.slice(0, -1).forEach((node) => node.remove());
  }

  function ensureFooter(route) {
    const existing = $('#ytv12RouteFooter');
    if (!route) {
      existing?.remove();
      return;
    }
    const main = $('#mainContent');
    if (!main) return;
    let footer = existing;
    if (!footer) {
      footer = document.createElement('footer');
      footer.id = 'ytv12RouteFooter';
      main.appendChild(footer);
    }
    footer.innerHTML = `
      <div class="ytv12-footer-inner">
        <span>© 2026 YTConv · ${LABELS[route] || 'Media tools'}</span>
        <nav aria-label="Tautan footer">
          <a href="/hub">YTConv Hub</a>
          <a href="/tools">Tools</a>
          <a href="/docs">Docs</a>
          <a href="/status">Status</a>
          <a href="/help">Help Center</a>
        </nav>
      </div>`;
  }

  function applyRoute() {
    const route = getRoute();
    const secondary = Boolean(route);
    document.body.classList.toggle('ytconv-secondary-route', secondary);
    document.body.classList.toggle('ytconv-runtime-secondary', secondary);
    if (secondary) document.body.dataset.ytconvSecondaryRoute = route;
    else delete document.body.dataset.ytconvSecondaryRoute;

    if (secondary) {
      $$('.yc-composer, #ycrSecurityDock, #ycOptions, #ycConversation, #ycWelcome').forEach((node) => {
        node.hidden = true;
        node.setAttribute('aria-hidden', 'true');
      });
      hideVisibleConverterStatus();
    } else {
      $('.yc-composer')?.removeAttribute('aria-hidden');
      if ($('.yc-composer')) $('.yc-composer').hidden = false;
    }

    ensureFooter(route);
    eagerize();
    portalDialogs();

    const storedSkeleton = sessionStorage.getItem('ytconv-route-skeleton');
    if (SKELETON_ROUTES.has(route) && (route !== activeRoute || storedSkeleton === route)) {
      showSkeleton(route);
      const complete = () => {
        eagerize();
        hideSkeleton();
      };
      if (document.readyState === 'complete') window.setTimeout(complete, 100);
      else window.addEventListener('load', complete, { once: true });
      window.setTimeout(complete, 1100);
    }

    activeRoute = route;
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyRoute();
    });
  }

  function installHooks() {
    if (document.documentElement.dataset.ytv12Hooks) return;
    document.documentElement.dataset.ytv12Hooks = 'true';

    document.addEventListener('click', (event) => {
      const control = event.target.closest?.('a, button, [data-route-path], [data-route]');
      const route = inferRoute(control);
      if (SKELETON_ROUTES.has(route)) showSkeleton(route);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const forumPanel = $('#forumWidgetPanel');
      if ($('#forumWidget')?.classList.contains('open')) closeDialog(forumPanel);
      const profile = $('.ytv12-profile-dialog.show, .ytv12-profile-dialog:not([hidden])');
      if (profile) closeDialog(profile);
    }, true);
  }

  function ready() {
    installStyles();
    installHooks();
    applyRoute();
    window.addEventListener('pageshow', applyRoute, { passive: true });
    window.addEventListener('popstate', () => window.setTimeout(applyRoute, 0), { passive: true });
    window.addEventListener('hashchange', () => window.setTimeout(applyRoute, 0), { passive: true });

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) eagerize(node);
        });
      });
      scheduleApply();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden'],
    });

    window.setTimeout(applyRoute, 500);
    window.setTimeout(applyRoute, 1500);
    document.documentElement.dataset.ytconvSecondaryRouteUi = 'v12';
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();