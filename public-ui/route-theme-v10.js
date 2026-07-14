(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const ROUTES = ['studio', 'rewards', 'faq', 'community', 'profile', 'about'];
  const ROUTE_LABELS = {
    studio: 'Studio',
    rewards: 'Saweria / Rewards',
    faq: 'FAQ / Bantuan',
    community: 'Komunitas',
    profile: 'Profil',
    about: 'About',
  };
  const SKELETON_ROUTES = new Set(['rewards', 'faq']);
  const routeSelector = ROUTES.map((route) => `body.ytclean-route-${route}`).join(',');

  let lastRoute = '';
  let skeletonTimer = 0;
  let observerScheduled = false;

  function routeFromPath() {
    const path = location.pathname.toLowerCase();
    if (/\/(rewards|saweria)(\/|$)/.test(path)) return 'rewards';
    if (/\/(profile|account)(\/|$)/.test(path)) return 'profile';
    return ROUTES.find((route) => path === `/${route}` || path.startsWith(`/${route}/`)) || '';
  }

  function currentRoute() {
    return ROUTES.find((route) => document.body.classList.contains(`ytclean-route-${route}`)) || routeFromPath();
  }

  function installStyles() {
    let style = $('#ytconv-route-theme-v10');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-route-theme-v10';
      document.head.appendChild(style);
    }

    style.textContent = `
      ${routeSelector} {
        --ytr-bg: var(--ytv8-bg, #212121);
        --ytr-panel: #2f2f2f;
        --ytr-panel-soft: #272727;
        --ytr-hover: #383838;
        --ytr-border: rgba(255,255,255,.10);
        --ytr-text: #ececec;
        --ytr-muted: #a8a8a8;
        background: var(--ytr-bg) !important;
        color: var(--ytr-text) !important;
      }

      /* Converter belongs to the converter route only. */
      ${routeSelector} .yc-composer,
      ${routeSelector} #ycrSecurityDock,
      ${routeSelector} #ycOptions,
      ${routeSelector} #ycConversation,
      ${routeSelector} #ycWelcome,
      ${routeSelector} #advanced-mode,
      ${routeSelector} .ytconv-header-actions,
      ${routeSelector} #ytconvHeaderMusic,
      ${routeSelector} #headerModeToggle {
        display: none !important;
      }

      ${routeSelector} #mainContent {
        width: min(100%, 1040px) !important;
        max-width: 1040px !important;
        min-height: calc(100dvh - 72px);
        padding-bottom: 28px !important;
      }

      ${routeSelector} #mainContent > .section-header,
      ${routeSelector} .section-header.ytconv-hero-clean {
        display: block !important;
        min-height: auto !important;
        margin: 0 0 22px !important;
        padding: 12px 2px 18px !important;
        border: 0 !important;
        border-bottom: 1px solid var(--ytr-border) !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      ${routeSelector} #activeSectionTitle {
        margin: 0 !important;
        color: var(--ytr-text) !important;
        font-size: clamp(28px, 4vw, 38px) !important;
        line-height: 1.08 !important;
        letter-spacing: -.035em !important;
        text-transform: none !important;
      }

      ${routeSelector} #activeSectionSubtitle {
        display: block !important;
        max-width: 680px !important;
        margin: 8px 0 0 !important;
        color: var(--ytr-muted) !important;
        font-size: 14px !important;
        line-height: 1.55 !important;
      }

      ${routeSelector} #mainContent .card,
      ${routeSelector} #mainContent .accordion-item,
      ${routeSelector} #mainContent .list-group-item,
      ${routeSelector} #mainContent [class*='panel'],
      ${routeSelector} #mainContent [class*='surface'] {
        border: 1px solid var(--ytr-border) !important;
        border-radius: 16px !important;
        background: var(--ytr-panel-soft) !important;
        background-image: none !important;
        color: var(--ytr-text) !important;
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
      ${routeSelector} #mainContent label { color: var(--ytr-text) !important; }

      ${routeSelector} #mainContent p,
      ${routeSelector} #mainContent small,
      ${routeSelector} #mainContent .text-muted,
      ${routeSelector} #mainContent .form-text { color: var(--ytr-muted) !important; }

      ${routeSelector} #mainContent .form-control,
      ${routeSelector} #mainContent .form-select,
      ${routeSelector} #mainContent textarea,
      ${routeSelector} #mainContent input:not([type='checkbox']):not([type='radio']):not([type='range']) {
        min-height: 46px !important;
        border: 1px solid var(--ytr-border) !important;
        border-radius: 12px !important;
        background: var(--ytr-panel) !important;
        color: var(--ytr-text) !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .form-control:focus,
      ${routeSelector} #mainContent .form-select:focus,
      ${routeSelector} #mainContent textarea:focus,
      ${routeSelector} #mainContent input:focus {
        border-color: rgba(255,255,255,.24) !important;
        box-shadow: 0 0 0 3px rgba(255,255,255,.05) !important;
      }

      ${routeSelector} #mainContent .btn {
        min-height: 42px;
        border-radius: 11px !important;
        font-weight: 600 !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .btn-primary,
      ${routeSelector} #mainContent .btn-danger {
        border-color: #ff0033 !important;
        background: #ff0033 !important;
        color: #fff !important;
      }

      ${routeSelector} #mainContent .btn-outline-primary,
      ${routeSelector} #mainContent .btn-outline-secondary,
      ${routeSelector} #mainContent .btn-secondary {
        border-color: var(--ytr-border) !important;
        background: transparent !important;
        color: var(--ytr-text) !important;
      }

      ${routeSelector} #mainContent .btn-outline-primary:hover,
      ${routeSelector} #mainContent .btn-outline-secondary:hover,
      ${routeSelector} #mainContent .btn-secondary:hover { background: var(--ytr-hover) !important; }

      ${routeSelector} #mainContent .nav-tabs,
      ${routeSelector} #mainContent .nav-pills {
        gap: 6px !important;
        padding: 5px !important;
        border: 1px solid var(--ytr-border) !important;
        border-radius: 13px !important;
        background: var(--ytr-panel-soft) !important;
      }

      ${routeSelector} #mainContent .nav-link {
        border: 0 !important;
        border-radius: 9px !important;
        color: var(--ytr-muted) !important;
      }

      ${routeSelector} #mainContent .nav-link.active {
        background: var(--ytr-panel) !important;
        color: var(--ytr-text) !important;
      }

      ${routeSelector} #mainContent .accordion { display:grid; gap:10px; }
      ${routeSelector} #mainContent .accordion-button {
        min-height: 58px;
        border-radius: 14px !important;
        background: transparent !important;
        color: var(--ytr-text) !important;
        box-shadow: none !important;
      }
      ${routeSelector} #mainContent .accordion-body { color: var(--ytr-muted) !important; }
      ${routeSelector} #mainContent img { max-width:100%; height:auto; border-radius:14px; }

      /* Community widget: simple product UI, no decorative AI patterns. */
      #forumWidget.open #forumWidgetToggle { display: none !important; }
      #forumWidgetPanel {
        position: relative !important;
        width: min(760px, calc(100vw - 32px)) !important;
        max-width: 760px !important;
        max-height: min(78dvh, 720px) !important;
        border: 1px solid var(--ytr-border, rgba(255,255,255,.1)) !important;
        border-radius: 18px !important;
        background: var(--ytr-panel-soft, #272727) !important;
        background-image: none !important;
        box-shadow: 0 24px 80px rgba(0,0,0,.42) !important;
        overflow: hidden !important;
      }

      #forumWidgetPanel::before,
      #forumWidgetPanel::after,
      #forumWidgetMessages::before,
      #forumWidgetMessages::after { display:none !important; background-image:none !important; }

      #forumWidgetPanel .forum-widget-header,
      #forumWidgetPanel > header,
      #forumWidgetPanel > .d-flex:first-child {
        min-height: 64px !important;
        padding: 12px 16px !important;
        border-bottom: 1px solid var(--ytr-border, rgba(255,255,255,.1)) !important;
        background: var(--ytr-panel-soft, #272727) !important;
      }

      #forumWidgetMessages {
        background: var(--ytr-bg, #212121) !important;
        background-image: none !important;
      }

      #forumWidgetClose,
      .ytv11-dialog-close {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 15 !important;
        width: 40px !important;
        height: 40px !important;
        display: grid !important;
        place-items: center !important;
        padding: 0 !important;
        border: 1px solid var(--ytr-border, rgba(255,255,255,.1)) !important;
        border-radius: 50% !important;
        background: var(--ytr-panel, #2f2f2f) !important;
        color: var(--ytr-text, #ececec) !important;
        box-shadow: none !important;
        cursor: pointer !important;
      }

      #forumWidgetClose:hover,
      .ytv11-dialog-close:hover { background: var(--ytr-hover, #383838) !important; }

      /* Profile and community dialogs share one restrained surface. */
      .ytv11-profile-dialog,
      .ytv11-community-dialog {
        position: fixed !important;
        inset: 50% auto auto 50% !important;
        z-index: 2147483560 !important;
        width: min(760px, calc(100vw - 28px)) !important;
        max-height: min(82dvh, 760px) !important;
        margin: 0 !important;
        border: 1px solid var(--ytr-border, rgba(255,255,255,.1)) !important;
        border-radius: 18px !important;
        background: var(--ytr-panel-soft, #272727) !important;
        background-image: none !important;
        box-shadow: 0 24px 90px rgba(0,0,0,.48) !important;
        overflow: auto !important;
        transform: translate(-50%, -50%) !important;
      }

      .ytv11-profile-dialog *,
      .ytv11-community-dialog * { background-image: none !important; }

      .modal-backdrop.show,
      .ytconv-modal-backdrop,
      .ytv11-dialog-backdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483400 !important;
        width: 100vw !important;
        height: 100dvh !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: rgba(0,0,0,.52) !important;
        backdrop-filter: blur(6px) saturate(.92) !important;
        -webkit-backdrop-filter: blur(6px) saturate(.92) !important;
        opacity: 1 !important;
      }

      /* Route footer is intentionally visible outside the converter. */
      #ytv11RouteFooter {
        display: block;
        width: 100%;
        margin-top: 28px;
        padding: 22px 2px 8px;
        border-top: 1px solid var(--ytr-border);
        color: var(--ytr-muted);
      }

      #ytv11RouteFooter .ytv11-footer-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      #ytv11RouteFooter nav { display:flex; gap:6px 16px; flex-wrap:wrap; }
      #ytv11RouteFooter a { color:var(--ytr-muted); text-decoration:none; font-size:13px; }
      #ytv11RouteFooter a:hover { color:var(--ytr-text); }
      #ytv11RouteFooter small { color:var(--ytr-muted) !important; }

      /* Lightweight route skeleton for FAQ and Rewards only. */
      #ytv11RouteSkeleton {
        position: fixed;
        inset: 0;
        z-index: 2147483300;
        display: grid;
        place-items: start center;
        padding: 110px 18px 32px;
        background: var(--ytr-bg, #212121);
        pointer-events: none;
      }

      #ytv11RouteSkeleton .ytv11-skeleton-shell { width:min(100%, 960px); display:grid; gap:14px; }
      .ytv11-skeleton-line,
      .ytv11-skeleton-card {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--ytr-border, rgba(255,255,255,.1));
        background: var(--ytr-panel-soft, #272727);
      }
      .ytv11-skeleton-line { width:42%; height:34px; border-radius:10px; }
      .ytv11-skeleton-card { height:118px; border-radius:16px; }
      .ytv11-skeleton-line::after,
      .ytv11-skeleton-card::after {
        content:'';
        position:absolute;
        inset:0;
        transform:translateX(-100%);
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent);
        animation:ytv11Shimmer 1.1s ease-in-out infinite;
      }
      @keyframes ytv11Shimmer { to { transform:translateX(100%); } }

      [data-bs-theme='light'] ${routeSelector} {
        --ytr-bg: #fff;
        --ytr-panel: #f4f4f4;
        --ytr-panel-soft: #fff;
        --ytr-hover: #ececec;
        --ytr-border: rgba(0,0,0,.11);
        --ytr-text: #202123;
        --ytr-muted: #676767;
      }

      [data-bs-theme='light'] #forumWidgetPanel,
      [data-bs-theme='light'] .ytv11-profile-dialog,
      [data-bs-theme='light'] .ytv11-community-dialog { background:#fff !important; color:#202123 !important; }
      [data-bs-theme='light'] #forumWidgetMessages { background:#f7f7f8 !important; }
      [data-bs-theme='light'] #forumWidgetClose,
      [data-bs-theme='light'] .ytv11-dialog-close { background:#f4f4f4 !important; color:#202123 !important; }
      [data-bs-theme='light'] #ytv11RouteSkeleton { --ytr-bg:#fff; --ytr-panel-soft:#f4f4f4; --ytr-border:rgba(0,0,0,.1); }

      @media (max-width: 991.98px) {
        ${routeSelector} #mainContent {
          width: 100% !important;
          max-width: none !important;
          padding: calc(86px + env(safe-area-inset-top,0px)) 14px calc(24px + env(safe-area-inset-bottom,0px)) !important;
        }

        ${routeSelector} #mainContent > .section-header,
        ${routeSelector} .section-header.ytconv-hero-clean {
          min-height: 0 !important;
          margin-bottom: 16px !important;
          padding: 2px 2px 14px !important;
        }

        ${routeSelector} #activeSectionTitle { font-size:29px !important; }
        ${routeSelector} #mainContent .card,
        ${routeSelector} #mainContent .accordion-item,
        ${routeSelector} #mainContent .list-group-item,
        ${routeSelector} #mainContent [class*='panel'] { border-radius:15px !important; }
        ${routeSelector} #mainContent .card-body { padding:17px !important; }
        ${routeSelector} #mainContent .row > [class*='col-'] { width:100% !important; max-width:100% !important; }

        #forumWidgetPanel,
        .ytv11-profile-dialog,
        .ytv11-community-dialog {
          width: calc(100vw - 20px) !important;
          max-height: calc(100dvh - 96px - env(safe-area-inset-bottom,0px)) !important;
          border-radius: 17px !important;
        }

        #ytv11RouteFooter .ytv11-footer-inner { align-items:flex-start; flex-direction:column; }
        #ytv11RouteSkeleton { padding-top:calc(88px + env(safe-area-inset-top,0px)); }
      }

      @media (prefers-reduced-motion: reduce) {
        .ytv11-skeleton-line::after,
        .ytv11-skeleton-card::after { animation:none !important; }
      }
    `;
  }

  function eagerize(root = document) {
    $$('img, iframe', root).forEach((node) => {
      node.loading = 'eager';
      node.setAttribute('loading', 'eager');
      if ('fetchPriority' in node) node.fetchPriority = 'high';
      node.setAttribute('fetchpriority', 'high');
      if (node.tagName === 'IMG') {
        node.decoding = 'sync';
        node.setAttribute('decoding', 'sync');
      }
    });

    $$('video, audio', root).forEach((node) => {
      node.preload = 'auto';
      node.setAttribute('preload', 'auto');
    });
  }

  function ensureFooter(route) {
    let footer = $('#ytv11RouteFooter');
    if (!route) {
      footer?.remove();
      return;
    }

    const main = $('#mainContent');
    if (!main) return;

    if (!footer) {
      footer = document.createElement('footer');
      footer.id = 'ytv11RouteFooter';
      footer.innerHTML = `
        <div class="ytv11-footer-inner">
          <small>© 2026 YTConv · ${ROUTE_LABELS[route] || 'Layanan'}</small>
          <nav aria-label="Tautan footer">
            <a href="/hub">YTConv Hub</a>
            <a href="/tools">Tools</a>
            <a href="/docs">Docs</a>
            <a href="/status">Status</a>
            <a href="/help">Help Center</a>
          </nav>
        </div>
      `;
    }

    const target = main.querySelector(':scope > .container, :scope > .container-fluid') || main;
    if (footer.parentElement !== target) target.appendChild(footer);
    $('small', footer).textContent = `© 2026 YTConv · ${ROUTE_LABELS[route] || 'Layanan'}`;
  }

  function showSkeleton(route) {
    if (!SKELETON_ROUTES.has(route)) return;
    clearTimeout(skeletonTimer);
    $('#ytv11RouteSkeleton')?.remove();

    const skeleton = document.createElement('div');
    skeleton.id = 'ytv11RouteSkeleton';
    skeleton.setAttribute('role', 'status');
    skeleton.setAttribute('aria-label', `Memuat ${ROUTE_LABELS[route]}`);
    skeleton.innerHTML = `
      <div class="ytv11-skeleton-shell">
        <div class="ytv11-skeleton-line"></div>
        <div class="ytv11-skeleton-card"></div>
        <div class="ytv11-skeleton-card"></div>
        <div class="ytv11-skeleton-card"></div>
      </div>
    `;
    document.body.appendChild(skeleton);
    document.body.setAttribute('aria-busy', 'true');

    skeletonTimer = window.setTimeout(() => hideSkeleton(), 720);
  }

  function hideSkeleton() {
    clearTimeout(skeletonTimer);
    const skeleton = $('#ytv11RouteSkeleton');
    if (!skeleton) {
      document.body.removeAttribute('aria-busy');
      return;
    }
    skeleton.style.opacity = '0';
    skeleton.style.transition = 'opacity .16s ease';
    window.setTimeout(() => skeleton.remove(), 180);
    document.body.removeAttribute('aria-busy');
  }

  function inferRouteFromControl(control) {
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

  function closeDialog(dialog) {
    if (!dialog) return;

    if (dialog.id === 'forumWidgetPanel' || dialog.closest?.('#forumWidget')) {
      window.toggleForumWidget?.(false);
      return;
    }

    const existingDismiss = $('[data-bs-dismiss="modal"], .btn-close', dialog);
    if (existingDismiss && !existingDismiss.classList.contains('ytv11-dialog-close')) {
      existingDismiss.click();
      return;
    }

    try {
      const instance = window.bootstrap?.Modal?.getInstance(dialog) || window.bootstrap?.Modal?.getOrCreateInstance(dialog);
      if (instance) {
        instance.hide();
        return;
      }
    } catch {}

    dialog.classList.remove('show', 'open', 'ytconv-modal-active');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.hidden = true;
    $$('.modal-backdrop, .ytconv-modal-backdrop, .ytv11-dialog-backdrop').forEach((node) => node.remove());
    document.body.classList.remove('modal-open', 'ytconv-dialog-open');
  }

  function ensureCloseButton(dialog, kind) {
    if (!dialog) return;
    dialog.classList.add(kind === 'community' ? 'ytv11-community-dialog' : 'ytv11-profile-dialog');

    let button = kind === 'community' ? $('#forumWidgetClose', dialog) : $('.ytv11-dialog-close', dialog);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ytv11-dialog-close';
      button.setAttribute('aria-label', kind === 'community' ? 'Tutup komunitas' : 'Tutup profil');
      button.title = 'Tutup';
      button.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
      dialog.appendChild(button);
    } else {
      button.classList.add('ytv11-dialog-close');
      button.setAttribute('aria-label', kind === 'community' ? 'Tutup komunitas' : 'Tutup profil');
      button.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
    }

    if (!button.dataset.ytv11Bound) {
      button.dataset.ytv11Bound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeDialog(dialog);
      });
    }
  }

  function polishDialogs() {
    const forumPanel = $('#forumWidgetPanel');
    if (forumPanel) ensureCloseButton(forumPanel, 'community');

    const candidates = $$('.modal, [role="dialog"], .offcanvas, .ytconv-modal-polished');
    candidates.forEach((dialog) => {
      if (dialog === forumPanel || dialog.closest?.('#forumWidget')) return;
      const text = (dialog.textContent || '').replace(/\s+/g, ' ').trim();
      if (/XP SAAT INI|Belum Login|Daily Streak|Rentang Level|Masuk Google untuk simpan progress/i.test(text)) {
        ensureCloseButton(dialog, 'profile');
      }
    });
  }

  function markCurrentRoute() {
    const route = currentRoute();
    const secondary = Boolean(route);
    document.body.classList.toggle('ytconv-secondary-route', secondary);

    if (secondary) document.body.dataset.ytconvSecondaryRoute = route;
    else delete document.body.dataset.ytconvSecondaryRoute;

    const converterNodes = $$('.yc-composer, #ycrSecurityDock, #ycOptions');
    converterNodes.forEach((node) => {
      if (secondary) {
        node.hidden = true;
        node.setAttribute('aria-hidden', 'true');
      } else if (node.classList.contains('yc-composer')) {
        node.hidden = false;
        node.removeAttribute('aria-hidden');
      }
    });

    ensureFooter(route);

    if (route && route !== lastRoute && SKELETON_ROUTES.has(route)) {
      showSkeleton(route);
      window.setTimeout(() => {
        eagerize();
        hideSkeleton();
      }, 460);
    }

    lastRoute = route;
    return route;
  }

  function apply() {
    installStyles();
    markCurrentRoute();
    eagerize();
    polishDialogs();
    document.documentElement.dataset.ytconvRouteTheme = 'v11';
  }

  function installNavigationHooks() {
    if (document.documentElement.dataset.ytv11NavigationHooks) return;
    document.documentElement.dataset.ytv11NavigationHooks = 'true';

    document.addEventListener('click', (event) => {
      const control = event.target.closest?.('a, button, [data-route-path], [data-route]');
      const route = inferRouteFromControl(control);
      if (SKELETON_ROUTES.has(route)) showSkeleton(route);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const forumPanel = $('#forumWidgetPanel');
      if ($('#forumWidget')?.classList.contains('open')) closeDialog(forumPanel);

      const profile = $('.ytv11-profile-dialog.show, .ytv11-profile-dialog:not([hidden])');
      if (profile) closeDialog(profile);
    }, true);
  }

  const ready = () => {
    apply();
    installNavigationHooks();
    window.addEventListener('pageshow', apply, { passive: true });
    window.addEventListener('popstate', () => setTimeout(apply, 0), { passive: true });
    window.addEventListener('hashchange', () => setTimeout(apply, 0), { passive: true });
    window.setTimeout(apply, 500);
    window.setTimeout(apply, 1500);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) eagerize(node);
        });
      }

      if (observerScheduled) return;
      observerScheduled = true;
      requestAnimationFrame(() => {
        observerScheduled = false;
        markCurrentRoute();
        polishDialogs();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden'],
    });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();