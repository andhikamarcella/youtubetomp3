(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const MOBILE = 991.98;
  const SECONDARY_PATHS = [
    ['studio', /^\/studio(?:\/|$)/],
    ['rewards', /^\/(?:rewards|saweria)(?:\/|$)/],
    ['faq', /^\/(?:faq|support)(?:\/|$)/],
    ['community', /^\/community(?:\/|$)/],
    ['profile', /^\/(?:profile|account)(?:\/|$)/],
    ['about', /^\/about(?:\/|$)/],
  ];
  const ROUTE_LOADING_KEYS = new Set(['rewards', 'faq']);
  let routeLoadingTimer = 0;
  let hardStopTimer = 0;

  const routeName = () => {
    const path = location.pathname.toLowerCase();
    const matched = SECONDARY_PATHS.find(([, pattern]) => pattern.test(path));
    if (matched) return matched[0];
    return SECONDARY_PATHS.map(([name]) => name)
      .find((name) => document.body.classList.contains(`ytclean-route-${name}`)) || '';
  };

  const installStyles = () => {
    let style = $('#ytconv-ui-stability-v17');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-ui-stability-v17';
      document.head.appendChild(style);
    }
    style.textContent = `
      /* Obsolete route/modal patches must not control the current layout. */
      #ytconv-secondary-route-ui-v11,
      #ytconv-secondary-route-ui-v12,
      #ytconv-secondary-route-ui-v13,
      #ytconv-critical-fix-v14,
      #ytconv-secondary-route-ui-v15 { display:none!important; }

      #statusWrap,
      [data-convert-health],
      .convert-health-status,
      .converter-health-status { display:none!important; visibility:hidden!important; width:0!important; height:0!important; margin:0!important; padding:0!important; overflow:hidden!important; pointer-events:none!important; }

      body.ytv17-secondary .yc-composer,
      body.ytv17-secondary #ycrSecurityDock,
      body.ytv17-secondary #ycOptions,
      body.ytv17-secondary #ycConversation,
      body.ytv17-secondary #ycWelcome,
      body.ytv17-secondary #advanced-mode,
      body.ytv17-secondary .ytconv-header-actions { display:none!important; }

      body.ytv17-secondary #mainContent { width:min(100%,1040px)!important; max-width:1040px!important; padding-bottom:28px!important; }

      .modal:not(.show) { pointer-events:none!important; }
      .modal.show { position:fixed!important; inset:0!important; z-index:2147483600!important; display:flex!important; align-items:center!important; justify-content:center!important; width:100vw!important; height:100dvh!important; padding:calc(88px + env(safe-area-inset-top,0px)) 16px calc(18px + env(safe-area-inset-bottom,0px))!important; overflow:auto!important; background:transparent!important; }
      .modal.show .modal-dialog { position:relative!important; inset:auto!important; width:min(760px,calc(100vw - 32px))!important; max-width:760px!important; max-height:calc(100dvh - 124px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important; margin:auto!important; transform:none!important; pointer-events:auto!important; }
      .modal.show .modal-content { position:relative!important; width:100%!important; max-width:100%!important; max-height:inherit!important; margin:0!important; overflow:auto!important; overflow-x:hidden!important; border:1px solid rgba(255,255,255,.12)!important; border-radius:20px!important; background:#242424!important; background-image:none!important; box-shadow:0 28px 100px rgba(0,0,0,.58)!important; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
      .modal.show .modal-content, .modal.show .modal-content * { box-sizing:border-box!important; }
      .modal.show .modal-content img, .modal.show .modal-content iframe, .modal.show .modal-content video, .modal.show .modal-content canvas { max-width:100%!important; }

      .ytv17-close { position:sticky!important; top:12px!important; z-index:1000!important; float:right!important; width:42px!important; min-width:42px!important; height:42px!important; min-height:42px!important; display:grid!important; place-items:center!important; margin:12px 12px -54px auto!important; padding:0!important; border:1px solid rgba(255,255,255,.16)!important; border-radius:50%!important; background:#343434!important; color:#f5f5f5!important; font-size:18px!important; line-height:1!important; box-shadow:0 5px 18px rgba(0,0,0,.18)!important; cursor:pointer!important; pointer-events:auto!important; }
      .ytv17-close:hover { background:#414141!important; }
      .ytv17-duplicate-close { display:none!important; pointer-events:none!important; }

      .modal-backdrop { z-index:2147483500!important; background:rgba(0,0,0,.56)!important; opacity:1!important; backdrop-filter:blur(5px) saturate(.94)!important; -webkit-backdrop-filter:blur(5px) saturate(.94)!important; }
      body:not(.modal-open) .modal-backdrop { display:none!important; pointer-events:none!important; }

      body:not(.modal-open) .ytclean-sidebar,
      body:not(.modal-open) .ytclean-mobilebar,
      body:not(.modal-open) #ytcleanOpenDrawer { pointer-events:auto!important; }

      #ytconvUnifiedFooter { position:relative; z-index:1; width:min(100%,1040px); margin:28px auto max(28px,env(safe-area-inset-bottom,0px)); padding:22px clamp(16px,3vw,28px); border-top:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.62); }
      #ytconvUnifiedFooter .ytv17-footer-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; }
      #ytconvUnifiedFooter .ytv17-footer-links { display:flex; align-items:center; flex-wrap:wrap; gap:8px 16px; }
      #ytconvUnifiedFooter a { color:inherit; text-decoration:none; font-size:14px; }
      #ytconvUnifiedFooter a:hover { color:#fff; text-decoration:underline; text-underline-offset:3px; }
      #ytconvUnifiedFooter small { font-size:12px; }
      body:not(.ytv17-secondary) #mainContent { padding-bottom:max(190px,calc(150px + env(safe-area-inset-bottom,0px)))!important; }

      #ytv17RouteLoading { position:fixed; inset:0 0 0 var(--ycr-side-width,260px); z-index:2147483200; padding:48px clamp(20px,5vw,64px); background:#212121; pointer-events:none; }
      body.ytclean-collapsed #ytv17RouteLoading { left:var(--ycr-rail-width,72px); }
      .ytv17-loading-shell { width:min(100%,920px); margin:0 auto; }
      .ytv17-loading-line,.ytv17-loading-card { position:relative; overflow:hidden; background:#2c2c2c; }
      .ytv17-loading-line::after,.ytv17-loading-card::after { content:''; position:absolute; inset:0; transform:translateX(-100%); background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent); animation:ytv17Shimmer 1s linear infinite; }
      .ytv17-loading-line { height:18px; margin-bottom:12px; border-radius:7px; }
      .ytv17-loading-line.title { width:38%; height:34px; margin-bottom:28px; }
      .ytv17-loading-line.short { width:62%; }
      .ytv17-loading-card { height:112px; margin-top:14px; border:1px solid rgba(255,255,255,.1); border-radius:16px; }
      @keyframes ytv17Shimmer { to { transform:translateX(100%); } }

      [data-bs-theme='light'] .modal.show .modal-content { background:#fff!important; color:#202123!important; border-color:rgba(0,0,0,.12)!important; }
      [data-bs-theme='light'] .ytv17-close { background:#f2f2f2!important; color:#202123!important; border-color:rgba(0,0,0,.12)!important; }
      [data-bs-theme='light'] #ytconvUnifiedFooter { color:rgba(0,0,0,.62); border-color:rgba(0,0,0,.1); }
      [data-bs-theme='light'] #ytconvUnifiedFooter a:hover { color:#111; }
      [data-bs-theme='light'] #ytv17RouteLoading { background:#fff; }
      [data-bs-theme='light'] .ytv17-loading-line,[data-bs-theme='light'] .ytv17-loading-card { background:#ececec; }

      @media(max-width:${MOBILE}px) {
        .modal.show { align-items:flex-end!important; padding:calc(82px + env(safe-area-inset-top,0px)) 8px calc(8px + env(safe-area-inset-bottom,0px))!important; }
        .modal.show .modal-dialog { width:100%!important; max-width:none!important; max-height:calc(100dvh - 96px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important; margin:0 auto!important; }
        .modal.show .modal-content { max-height:inherit!important; border-radius:20px 20px 14px 14px!important; }
        #ytconvUnifiedFooter { margin-top:20px; padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px)); }
        #ytconvUnifiedFooter .ytv17-footer-row { align-items:flex-start; flex-direction:column; }
        #ytconvUnifiedFooter .ytv17-footer-links { display:grid; grid-template-columns:1fr 1fr; width:100%; gap:12px; }
        #ytv17RouteLoading { inset:calc(76px + env(safe-area-inset-top,0px)) 0 0 0; padding:26px 14px; }
      }
    `;
  };

  const eagerMedia = (root = document) => {
    $$('img,iframe', root).forEach((node) => {
      const deferred = node.getAttribute('data-src');
      if (deferred && !node.getAttribute('src')) node.setAttribute('src', deferred);
      node.setAttribute('loading', 'eager');
      node.setAttribute('fetchpriority', 'high');
      if ('fetchPriority' in node) node.fetchPriority = 'high';
    });
    $$('video,audio', root).forEach((node) => node.setAttribute('preload', 'auto'));
  };

  const closeDrawer = ({ collapseDesktop = false } = {}) => {
    document.body.classList.remove('ytclean-drawer-open');
    $('#ytcleanOpenDrawer')?.setAttribute('aria-expanded', 'false');
    const backdrop = $('#ytcleanDrawerBackdrop');
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.style.removeProperty('display');
    }
    if (collapseDesktop && window.innerWidth > MOBILE) {
      document.body.classList.add('ytclean-collapsed');
      try { localStorage.setItem('ytconv.sidebar.collapsed', '1'); } catch {}
    }
  };

  const visibleModals = () => $$('.modal.show').filter((modal) => !modal.hidden && modal.getAttribute('aria-hidden') !== 'true');

  const cleanupAfterModal = () => {
    if (visibleModals().length) return;
    $$('.modal-backdrop,.ytv11-dialog-backdrop,.ytv12-backdrop,.ytv13-backdrop,#ytv14ProfileBackdrop').forEach((node) => node.remove());
    document.body.classList.remove('modal-open','has-open-modal','ui-overlay-open','ytconv-dialog-open','ytv17-modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    ['#ytcleanSidebar','.ytclean-mobilebar','#ytcleanOpenDrawer'].forEach((selector) => {
      const node = $(selector);
      node?.style.removeProperty('pointer-events');
      node?.removeAttribute('inert');
    });
  };

  const isCloseCandidate = (button) => {
    if (!button) return false;
    if (button.classList.contains('ytv17-close')) return true;
    if (button.matches('.btn-close,[data-bs-dismiss="modal"],.ytv11-dialog-close,.ytv12-close,.ytv13-close,.ytv14-profile-close,.ytv15-close')) return true;
    const label = `${button.getAttribute('aria-label') || ''} ${button.title || ''}`.trim();
    return /^(tutup|close)(\s|$)/i.test(label);
  };

  const hideModal = (modal) => {
    try {
      const instance = window.bootstrap?.Modal?.getInstance(modal) || window.bootstrap?.Modal?.getOrCreateInstance(modal);
      if (instance) instance.hide();
      else throw new Error('no bootstrap instance');
    } catch {
      modal.classList.remove('show');
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      modal.style.removeProperty('display');
      window.setTimeout(cleanupAfterModal, 0);
    }
  };

  const normalizeModal = (modal) => {
    if (!modal?.classList?.contains('modal')) return;
    const dialog = $('.modal-dialog', modal) || modal;
    const content = $('.modal-content', modal) || dialog;

    [modal, dialog, content].forEach((node) => {
      ['ytv11-profile-dialog','ytv12-dialog','ytv13-dialog','ytv13-profile-dialog','ytv14-profile-panel'].forEach((name) => node.classList.remove(name));
      ['position','inset','left','right','top','bottom','transform','width','height','max-width','max-height','margin'].forEach((property) => node.style.removeProperty(property));
    });

    const candidates = $$('button', modal).filter(isCloseCandidate);
    candidates.forEach((button) => button.remove());

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ytv17-close';
    close.setAttribute('aria-label', 'Tutup');
    close.title = 'Tutup';
    close.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
    content.prepend(close);
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      hideModal(modal);
    }, true);

    eagerMedia(content);
  };

  const normalizeAllModals = () => $$('.modal').forEach(normalizeModal);

  const ensureFooter = () => {
    let footer = $('#ytconvUnifiedFooter');
    if (!footer) {
      footer = document.createElement('footer');
      footer.id = 'ytconvUnifiedFooter';
      footer.innerHTML = `
        <div class="ytv17-footer-row">
          <div>
            <strong>YTConv</strong><br>
            <small>Konversi media yang sederhana, aman, dan mudah digunakan.</small>
          </div>
          <nav class="ytv17-footer-links" aria-label="Tautan footer">
            <a href="https://ytconvhub.vercel.app/" target="_blank" rel="noopener noreferrer">YTConv Hub</a>
            <a href="/tools">Tools</a>
            <a href="https://ytconvdocs.vercel.app/" target="_blank" rel="noopener noreferrer">Docs</a>
            <a href="/status">Status</a>
            <a href="/support">Help Center</a>
          </nav>
          <small>© 2026 YTConv</small>
        </div>`;
    }
    const main = $('#mainContent');
    if (main && footer.parentElement !== main) main.appendChild(footer);
    footer.hidden = false;
  };

  const removeLegacyRouteLayers = () => {
    ['#ytv13RouteSkeleton','#ytv14RouteSkeleton','#ytv15RouteSkeleton'].forEach((selector) => $(selector)?.remove());
    ['ytconv-v13-skeleton','ytconv-v14-skeleton','ytconv-v15-skeleton'].forEach((key) => {
      try { sessionStorage.removeItem(key); } catch {}
    });
    ['#ytconv-secondary-route-ui-v11','#ytconv-secondary-route-ui-v12','#ytconv-secondary-route-ui-v13','#ytconv-critical-fix-v14','#ytconv-secondary-route-ui-v15'].forEach((selector) => $(selector)?.remove());
  };

  const stopRouteLoading = () => {
    clearTimeout(routeLoadingTimer);
    clearTimeout(hardStopTimer);
    const loading = $('#ytv17RouteLoading');
    if (!loading) return;
    loading.style.transition = 'opacity .16s ease';
    loading.style.opacity = '0';
    window.setTimeout(() => loading.remove(), 180);
    document.body.removeAttribute('aria-busy');
    try { sessionStorage.removeItem('ytconv-v17-route-loading'); } catch {}
  };

  const showRouteLoading = (route) => {
    if (!ROUTE_LOADING_KEYS.has(route)) return;
    stopRouteLoading();
    const loading = document.createElement('div');
    loading.id = 'ytv17RouteLoading';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.innerHTML = '<div class="ytv17-loading-shell"><div class="ytv17-loading-line title"></div><div class="ytv17-loading-line short"></div><div class="ytv17-loading-line"></div><div class="ytv17-loading-card"></div><div class="ytv17-loading-card"></div></div>';
    document.body.appendChild(loading);
    document.body.setAttribute('aria-busy', 'true');
    try { sessionStorage.setItem('ytconv-v17-route-loading', route); } catch {}
    routeLoadingTimer = window.setTimeout(stopRouteLoading, 520);
    hardStopTimer = window.setTimeout(stopRouteLoading, 1200);
  };

  const inferRoute = (control) => {
    const value = [control?.getAttribute?.('href'), control?.dataset?.routePath, control?.dataset?.sectionTarget, control?.textContent]
      .filter(Boolean).join(' ').toLowerCase();
    if (/saweria|reward/.test(value)) return 'rewards';
    if (/faq|bantuan|support/.test(value)) return 'faq';
    return '';
  };

  const applyRouteState = () => {
    const route = routeName();
    document.body.classList.toggle('ytv17-secondary', Boolean(route));
    if (route) document.body.dataset.ytv17Route = route;
    else delete document.body.dataset.ytv17Route;
    ensureFooter();
    eagerMedia();

    const stored = (() => { try { return sessionStorage.getItem('ytconv-v17-route-loading'); } catch { return ''; } })();
    if (ROUTE_LOADING_KEYS.has(route) && stored === route && !$('#ytv17RouteLoading')) showRouteLoading(route);
  };

  const ready = () => {
    installStyles();
    removeLegacyRouteLayers();
    normalizeAllModals();
    applyRouteState();
    cleanupAfterModal();

    document.addEventListener('show.bs.modal', (event) => {
      const modal = event.target?.closest?.('.modal') || event.target;
      normalizeModal(modal);
      document.body.classList.add('ytv17-modal-open');
      closeDrawer();
    }, true);

    document.addEventListener('shown.bs.modal', (event) => {
      const modal = event.target?.closest?.('.modal') || event.target;
      normalizeModal(modal);
      const backdrops = $$('.modal-backdrop');
      backdrops.slice(0, -1).forEach((node) => node.remove());
    }, true);

    document.addEventListener('hidden.bs.modal', () => window.setTimeout(cleanupAfterModal, 0), true);

    document.addEventListener('click', (event) => {
      const control = event.target.closest?.('#ytcleanSidebar a,#ytcleanSidebar button,[data-route-path],[data-section-target]');
      if (!control) return;
      const route = inferRoute(control);
      closeDrawer({ collapseDesktop: Boolean(route) });
      if (route) showRouteLoading(route);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const modal = visibleModals().at(-1);
      if (modal) hideModal(modal);
    }, true);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.('.modal')) normalizeModal(node);
          $$('.modal', node).forEach(normalizeModal);
          eagerMedia(node);
        }
      }
    });
    observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('pageshow', () => {
      removeLegacyRouteLayers();
      normalizeAllModals();
      applyRouteState();
      cleanupAfterModal();
    }, { passive:true });

    window.setTimeout(() => {
      normalizeAllModals();
      applyRouteState();
      cleanupAfterModal();
      stopRouteLoading();
    }, 1300);

    document.documentElement.dataset.ytconvUiStability = 'v17';
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once:true })
    : ready();
})();
