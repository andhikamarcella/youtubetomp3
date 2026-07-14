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
  let skeletonTimer = 0;
  let childObserver = null;
  let bodyObserver = null;

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
    let style = $('#ytconv-secondary-route-ui-v11');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-secondary-route-ui-v11';
      document.head.appendChild(style);
    }

    style.textContent = `
      ${routeSelector} {
        --ys-bg: #212121;
        --ys-panel: #2f2f2f;
        --ys-panel-soft: #272727;
        --ys-hover: #383838;
        --ys-border: rgba(255,255,255,.1);
        --ys-text: #ececec;
        --ys-muted: #a8a8a8;
        background: var(--ys-bg) !important;
        color: var(--ys-text) !important;
      }

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
        border-bottom: 1px solid var(--ys-border) !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      ${routeSelector} #activeSectionTitle {
        margin: 0 !important;
        color: var(--ys-text) !important;
        font-size: clamp(28px, 4vw, 38px) !important;
        line-height: 1.08 !important;
        letter-spacing: -.035em !important;
        text-transform: none !important;
      }

      ${routeSelector} #activeSectionSubtitle {
        display: block !important;
        max-width: 680px !important;
        margin: 8px 0 0 !important;
        color: var(--ys-muted) !important;
        font-size: 14px !important;
        line-height: 1.55 !important;
      }

      ${routeSelector} #mainContent .card,
      ${routeSelector} #mainContent .accordion-item,
      ${routeSelector} #mainContent .list-group-item,
      ${routeSelector} #mainContent [class*='panel'],
      ${routeSelector} #mainContent [class*='surface'] {
        border: 1px solid var(--ys-border) !important;
        border-radius: 16px !important;
        background: var(--ys-panel-soft) !important;
        background-image: none !important;
        color: var(--ys-text) !important;
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
      ${routeSelector} #mainContent label { color: var(--ys-text) !important; }
      ${routeSelector} #mainContent p,
      ${routeSelector} #mainContent small,
      ${routeSelector} #mainContent .text-muted,
      ${routeSelector} #mainContent .form-text { color: var(--ys-muted) !important; }

      ${routeSelector} #mainContent .form-control,
      ${routeSelector} #mainContent .form-select,
      ${routeSelector} #mainContent textarea,
      ${routeSelector} #mainContent input:not([type='checkbox']):not([type='radio']):not([type='range']) {
        min-height: 46px !important;
        border: 1px solid var(--ys-border) !important;
        border-radius: 12px !important;
        background: var(--ys-panel) !important;
        color: var(--ys-text) !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .form-control:focus,
      ${routeSelector} #mainContent .form-select:focus,
      ${routeSelector} #mainContent textarea:focus,
      ${routeSelector} #mainContent input:focus {
        border-color: rgba(255,255,255,.25) !important;
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
        border-color: var(--ys-border) !important;
        background: transparent !important;
        color: var(--ys-text) !important;
      }

      ${routeSelector} #mainContent .btn-outline-primary:hover,
      ${routeSelector} #mainContent .btn-outline-secondary:hover,
      ${routeSelector} #mainContent .btn-secondary:hover { background: var(--ys-hover) !important; }

      ${routeSelector} #mainContent .accordion { display:grid; gap:10px; }
      ${routeSelector} #mainContent .accordion-button {
        min-height: 58px;
        border-radius: 14px !important;
        background: transparent !important;
        color: var(--ys-text) !important;
        box-shadow: none !important;
      }
      ${routeSelector} #mainContent .accordion-body { color: var(--ys-muted) !important; }

      #forumWidget.open #forumWidgetToggle { display:none !important; }
      #forumWidgetPanel {
        position: fixed !important;
        inset: 50% auto auto 50% !important;
        z-index: 2147483560 !important;
        width: min(760px, calc(100vw - 28px)) !important;
        max-width: 760px !important;
        max-height: min(82dvh, 740px) !important;
        margin: 0 !important;
        border: 1px solid var(--ys-border, rgba(255,255,255,.1)) !important;
        border-radius: 18px !important;
        background: var(--ys-panel-soft, #272727) !important;
        background-image: none !important;
        box-shadow: 0 24px 90px rgba(0,0,0,.48) !important;
        overflow: hidden !important;
        transform: translate(-50%, -50%) !important;
      }

      #forumWidgetPanel *,
      #forumWidgetMessages,
      #forumWidgetMessages::before,
      #forumWidgetMessages::after {
        background-image: none !important;
      }

      #forumWidgetMessages { background: var(--ys-bg, #212121) !important; }

      .ytv11-profile-dialog {
        position: fixed !important;
        inset: 50% auto auto 50% !important;
        z-index: 2147483560 !important;
        width: min(760px, calc(100vw - 28px)) !important;
        max-height: min(82dvh, 760px) !important;
        margin: 0 !important;
        border: 1px solid var(--ys-border, rgba(255,255,255,.1)) !important;
        border-radius: 18px !important;
        background: var(--ys-panel-soft, #272727) !important;
        background-image: none !important;
        box-shadow: 0 24px 90px rgba(0,0,0,.48) !important;
        overflow: auto !important;
        transform: translate(-50%, -50%) !important;
      }

      .ytv11-profile-dialog * { background-image:none !important; }

      #forumWidgetClose,
      .ytv11-dialog-close {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 20 !important;
        width: 40px !important;
        height: 40px !important;
        display: grid !important;
        place-items: center !important;
        padding: 0 !important;
        border: 1px solid var(--ys-border, rgba(255,255,255,.1)) !important;
        border-radius: 50% !important;
        background: var(--ys-panel, #2f2f2f) !important;
        color: var(--ys-text, #ececec) !important;
        box-shadow: none !important;
        cursor: pointer !important;
      }

      #forumWidgetClose:hover,
      .ytv11-dialog-close:hover { background: var(--ys-hover, #383838) !important; }

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

      #ytv11RouteFooter {
        display: block !important;
        width: 100%;
        margin-top: 28px;
        padding: 22px 2px 8px;
        border-top: 1px solid var(--ys-border);
        color: var(--ys-muted);
      }

      #ytv11RouteFooter .ytv11-footer-inner {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        flex-wrap:wrap;
      }

      #ytv11RouteFooter nav { display:flex; gap:6px 16px; flex-wrap:wrap; }
      #ytv11RouteFooter a { color:var(--ys-muted); text-decoration:none; font-size:13px; }
      #ytv11RouteFooter a:hover { color:var(--ys-text); }
      #ytv11RouteFooter small { color:var(--ys-muted) !important; }

      #ytv11RouteSkeleton {
        position: fixed;
        inset: 0;
        z-index: 2147483300;
        display: grid;
        place-items: start center;
        padding: 110px 18px 32px;
        background: var(--ys-bg, #212121);
        pointer-events: none;
      }

      #ytv11RouteSkeleton .ytv11-skeleton-shell { width:min(100%,960px); display:grid; gap:14px; }
      .ytv11-skeleton-line,
      .ytv11-skeleton-card {
        position:relative;
        overflow:hidden;
        border:1px solid var(--ys-border,rgba(255,255,255,.1));
        background:var(--ys-panel-soft,#272727);
      }
      .ytv11-skeleton-line { width:42%; height:34px; border-radius:10px; }
      .ytv11-skeleton-card { height:118px; border-radius:16px; }
      .ytv11-skeleton-line::after,
      .ytv11-skeleton-card::after {
        content:'';
        position:absolute;
        inset:0;
        transform:translateX(-100%);
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);
        animation:ytv11Shimmer 1.1s ease-in-out infinite;
      }
      @keyframes ytv11Shimmer { to { transform:translateX(100%); } }

      [data-bs-theme='light'] ${routeSelector} {
        --ys-bg:#fff;
        --ys-panel:#f4f4f4;
        --ys-panel-soft:#fff;
        --ys-hover:#ececec;
        --ys-border:rgba(0,0,0,.11);
        --ys-text:#202123;
        --ys-muted:#676767;
      }

      [data-bs-theme='light'] #forumWidgetPanel,
      [data-bs-theme='light'] .ytv11-profile-dialog { background:#fff !important; color:#202123 !important; }
      [data-bs-theme='light'] #forumWidgetMessages { background:#f7f7f8 !important; }
      [data-bs-theme='light'] #forumWidgetClose,
      [data-bs-theme='light'] .ytv11-dialog-close { background:#f4f4f4 !important; color:#202123 !important; }
      [data-bs-theme='light'] #ytv11RouteSkeleton { --ys-bg:#fff; --ys-panel-soft:#f4f4f4; --ys-border:rgba(0,0,0,.1); }

      @media(max-width:991.98px) {
        ${routeSelector} #mainContent {
          width:100% !important;
          max-width:none !important;
          padding:calc(86px + env(safe-area-inset-top,0px)) 14px calc(24px + env(safe-area-inset-bottom,0px)) !important;
        }

        ${routeSelector} #mainContent > .section-header,
        ${routeSelector} .section-header.ytconv-hero-clean {
          min-height:0 !important;
          margin-bottom:16px !important;
          padding:2px 2px 14px !important;
        }

        ${routeSelector} #activeSectionTitle { font-size:29px !important; }
        ${routeSelector} #mainContent .card,
        ${routeSelector} #mainContent .accordion-item,
        ${routeSelector} #mainContent .list-group-item,
        ${routeSelector} #mainContent [class*='panel'] { border-radius:15px !important; }
        ${routeSelector} #mainContent .card-body { padding:17px !important; }
        ${routeSelector} #mainContent .row > [class*='col-'] { width:100% !important; max-width:100% !important; }

        #forumWidgetPanel,
        .ytv11-profile-dialog {
          width:calc(100vw - 20px) !important;
          max-height:calc(100dvh - 96px - env(safe-area-inset-bottom,0px)) !important;
          border-radius:17px !important;
        }

        #ytv11RouteFooter .ytv11-footer-inner { align-items:flex-start; flex-direction:column; }
        #ytv11RouteSkeleton { padding-top:calc(88px + env(safe-area-inset-top,0px)); }
      }

      @media(prefers-reduced-motion:reduce) {
        .ytv11-skeleton-line::after,
        .ytv11-skeleton-card::after { animation:none !important; }
      }
    `;
  }

  function eagerize(root = document) {
    $$('img, iframe', root).forEach((node) => {
      node.setAttribute('loading', 'eager');
      node.setAttribute('fetchpriority', 'high');
      if ('loading' in node) node.loading = 'eager';
      if ('fetchPriority' in node) node.fetchPriority = 'high';
      if (node.tagName === 'IMG') node.decoding = 'async';
    });

    $$('video, audio', root).forEach((node) => {
      node.preload = 'auto';
      node.setAttribute('preload', 'auto');
    });
  }

  function ensureFooter(route) {
    const oldFooter = $('#ytv11RouteFooter');
    if (!route) {
      oldFooter?.remove();
      return;
    }

    const main = $('#mainContent');
    if (!main) return;
    let footer = oldFooter;

    if (!footer) {
      footer = document.createElement('footer');
      footer.id = 'ytv11RouteFooter';
      footer.innerHTML = `
        <div class="ytv11-footer-inner">
          <small></small>
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
    if (footer.dataset.route !== route) {
      footer.dataset.route = route;
      $('small', footer).textContent = `© 2026 YTConv · ${LABELS[route] || 'Layanan'}`;
    }
  }

  function showSkeleton(route) {
    if (!SKELETON_ROUTES.has(route)) return;
    clearTimeout(skeletonTimer);
    $('#ytv11RouteSkeleton')?.remove();

    const skeleton = document.createElement('div');
    skeleton.id = 'ytv11RouteSkeleton';
    skeleton.setAttribute('role', 'status');
    skeleton.setAttribute('aria-label', `Memuat ${LABELS[route]}`);
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
    skeletonTimer = setTimeout(hideSkeleton, 720);
  }

  function hideSkeleton() {
    clearTimeout(skeletonTimer);
    const skeleton = $('#ytv11RouteSkeleton');
    document.body.removeAttribute('aria-busy');
    if (!skeleton) return;
    skeleton.style.opacity = '0';
    skeleton.style.transition = 'opacity .16s ease';
    setTimeout(() => skeleton.remove(), 180);
  }

  function routeFromControl(control) {
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

  function removeDialogBackdrop() {
    $$('.modal-backdrop, .ytconv-modal-backdrop, .ytv11-dialog-backdrop').forEach((node) => node.remove());
    document.body.classList.remove('modal-open', 'ytconv-dialog-open');
  }

  function closeDialog(dialog) {
    if (!dialog) return;

    if (dialog.id === 'forumWidgetPanel' || dialog.closest?.('#forumWidget')) {
      window.toggleForumWidget?.(false);
      return;
    }

    try {
      const instance = window.bootstrap?.Modal?.getInstance(dialog);
      if (instance) {
        instance.hide();
        return;
      }
    } catch {}

    const originalDismiss = $('[data-bs-dismiss="modal"], .btn-close', dialog);
    if (originalDismiss && !originalDismiss.classList.contains('ytv11-dialog-close')) {
      originalDismiss.click();
      return;
    }

    dialog.classList.remove('show', 'open', 'ytconv-modal-active');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.hidden = true;
    removeDialogBackdrop();
  }

  function ensureCloseButton(dialog, type) {
    if (!dialog) return;
    if (type === 'profile') dialog.classList.add('ytv11-profile-dialog');

    let button = type === 'community' ? $('#forumWidgetClose', dialog) : $('.ytv11-dialog-close', dialog);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ytv11-dialog-close';
      button.title = 'Tutup';
      dialog.appendChild(button);
    }

    button.classList.add('ytv11-dialog-close');
    button.setAttribute('aria-label', type === 'community' ? 'Tutup komunitas' : 'Tutup profil');
    if (!button.querySelector('.bi-x-lg')) {
      button.replaceChildren();
      const icon = document.createElement('i');
      icon.className = 'bi bi-x-lg';
      icon.setAttribute('aria-hidden', 'true');
      button.appendChild(icon);
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

  function polishDialogs(root = document) {
    const forumPanel = $('#forumWidgetPanel');
    if (forumPanel) ensureCloseButton(forumPanel, 'community');

    $$('.modal, [role="dialog"], .offcanvas, .ytconv-modal-polished', root).forEach((dialog) => {
      if (dialog === forumPanel || dialog.closest?.('#forumWidget')) return;
      const text = (dialog.textContent || '').replace(/\s+/g, ' ').trim();
      if (/XP SAAT INI|Belum Login|Daily Streak|Rentang Level|Masuk Google untuk simpan progress/i.test(text)) {
        ensureCloseButton(dialog, 'profile');
      }
    });
  }

  function syncRoute() {
    const route = getRoute();
    const secondary = Boolean(route);
    document.body.classList.toggle('ytconv-secondary-route', secondary);

    if (secondary) document.body.dataset.ytconvSecondaryRoute = route;
    else delete document.body.dataset.ytconvSecondaryRoute;

    $$('.yc-composer, #ycrSecurityDock, #ycOptions').forEach((node) => {
      if (secondary) {
        node.hidden = true;
        node.setAttribute('aria-hidden', 'true');
      } else if (node.classList.contains('yc-composer')) {
        node.hidden = false;
        node.removeAttribute('aria-hidden');
      }
    });

    ensureFooter(route);

    if (route && route !== activeRoute && SKELETON_ROUTES.has(route)) {
      showSkeleton(route);
      setTimeout(() => {
        eagerize();
        hideSkeleton();
      }, 460);
    }

    activeRoute = route;
  }

  function apply() {
    installStyles();
    syncRoute();
    eagerize();
    polishDialogs();
    document.documentElement.dataset.ytconvSecondaryRouteUi = 'v11';
  }

  function installEvents() {
    if (document.documentElement.dataset.ytv11Events) return;
    document.documentElement.dataset.ytv11Events = 'true';

    document.addEventListener('click', (event) => {
      const control = event.target.closest?.('a, button, [data-route-path], [data-route]');
      const route = routeFromControl(control);
      if (SKELETON_ROUTES.has(route)) showSkeleton(route);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if ($('#forumWidget')?.classList.contains('open')) closeDialog($('#forumWidgetPanel'));
      const profile = $('.ytv11-profile-dialog.show, .ytv11-profile-dialog:not([hidden])');
      if (profile) closeDialog(profile);
    }, true);
  }

  function installObservers() {
    bodyObserver?.disconnect();
    childObserver?.disconnect();

    bodyObserver = new MutationObserver(() => syncRoute());
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    childObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          eagerize(node);
          polishDialogs(node);
        });
      }
    });
    childObserver.observe(document.body, { childList: true, subtree: true });
  }

  const ready = () => {
    apply();
    installEvents();
    installObservers();
    window.addEventListener('pageshow', apply, { passive: true });
    window.addEventListener('popstate', () => setTimeout(apply, 0), { passive: true });
    window.addEventListener('hashchange', () => setTimeout(apply, 0), { passive: true });
    setTimeout(apply, 500);
    setTimeout(apply, 1500);
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();