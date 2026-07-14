(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ROUTES = new Set(['faq', 'rewards']);
  const PENDING_KEY = 'ytconv-v16-route-skeleton';
  const LEGACY_KEYS = [
    'ytconv-route-skeleton',
    'ytconv-v14-skeleton',
    'ytconv-v15-skeleton',
  ];
  let hideTimer = 0;
  let hardTimer = 0;

  function routeFromLocation() {
    const path = location.pathname.toLowerCase();
    if (/\/(support|faq)(\/|$)/.test(path)) return 'faq';
    if (/\/(rewards|saweria)(\/|$)/.test(path)) return 'rewards';
    if (document.body.classList.contains('ytclean-route-faq')) return 'faq';
    if (document.body.classList.contains('ytclean-route-rewards')) return 'rewards';
    return '';
  }

  function inferRoute(control) {
    if (!control) return '';
    const value = [
      control.getAttribute?.('href'),
      control.dataset?.routePath,
      control.dataset?.route,
      control.dataset?.sectionTarget,
      control.id,
      control.textContent,
    ].filter(Boolean).join(' ').toLowerCase();
    if (/faq|bantuan|support/.test(value)) return 'faq';
    if (/saweria|reward/.test(value)) return 'rewards';
    return '';
  }

  function cleanupLegacySkeletons() {
    LEGACY_KEYS.forEach((key) => sessionStorage.removeItem(key));
    $$('#ytv13RouteSkeleton,#ytv14RouteSkeleton,#ytv15RouteSkeleton').forEach((node) => node.remove());
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

  function removeSkeleton() {
    clearTimeout(hideTimer);
    clearTimeout(hardTimer);
    const skeleton = $('#ytv16RouteSkeleton');
    if (!skeleton) {
      document.body.removeAttribute('aria-busy');
      return;
    }
    skeleton.classList.add('is-leaving');
    window.setTimeout(() => skeleton.remove(), 180);
    document.body.removeAttribute('aria-busy');
    eagerize();
  }

  function showSkeleton(route, persistForNavigation = true) {
    if (!ROUTES.has(route)) return;
    cleanupLegacySkeletons();
    if (persistForNavigation) sessionStorage.setItem(PENDING_KEY, route);

    let skeleton = $('#ytv16RouteSkeleton');
    if (!skeleton) {
      skeleton = document.createElement('div');
      skeleton.id = 'ytv16RouteSkeleton';
      skeleton.setAttribute('role', 'status');
      skeleton.setAttribute('aria-live', 'polite');
      skeleton.setAttribute('aria-label', 'Memuat halaman');
      skeleton.innerHTML = '<div class="ytv16-shell"><div class="ytv16-line title"></div><div class="ytv16-line short"></div><div class="ytv16-line"></div><div class="ytv16-card"></div><div class="ytv16-card"></div><div class="ytv16-card"></div></div>';
      document.body.appendChild(skeleton);
    }

    document.body.setAttribute('aria-busy', 'true');
    clearTimeout(hideTimer);
    clearTimeout(hardTimer);
    hideTimer = window.setTimeout(removeSkeleton, 620);
    hardTimer = window.setTimeout(removeSkeleton, 1400);
  }

  function installStyles() {
    let style = $('#ytconv-skeleton-route-guard-v16');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-skeleton-route-guard-v16';
      document.head.appendChild(style);
    }
    style.textContent = `
      #ytv13RouteSkeleton,#ytv14RouteSkeleton,#ytv15RouteSkeleton{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #ytv16RouteSkeleton{position:fixed;inset:0 0 0 var(--ycr-side-width,260px);z-index:2147483200;padding:48px clamp(20px,5vw,64px);background:#212121;opacity:1;transition:opacity .18s ease;overflow:hidden;pointer-events:none}
      body.ytclean-collapsed #ytv16RouteSkeleton{left:var(--ycr-rail-width,72px)}
      #ytv16RouteSkeleton.is-leaving{opacity:0}
      .ytv16-shell{width:min(100%,920px);margin:0 auto}.ytv16-line,.ytv16-card{position:relative;overflow:hidden;background:#2b2b2b}
      .ytv16-line::after,.ytv16-card::after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);animation:ytv16Shimmer 1.05s infinite}
      .ytv16-line{height:18px;margin-bottom:12px;border-radius:7px}.ytv16-line.title{width:36%;height:34px;margin-bottom:28px}.ytv16-line.short{width:60%}.ytv16-card{height:112px;margin-top:14px;border:1px solid rgba(255,255,255,.1);border-radius:16px}
      @keyframes ytv16Shimmer{to{transform:translateX(100%)}}
      [data-bs-theme='light'] #ytv16RouteSkeleton{background:#fff}[data-bs-theme='light'] .ytv16-line,[data-bs-theme='light'] .ytv16-card{background:#ececec}
      @media(max-width:991.98px){#ytv16RouteSkeleton{inset:calc(78px + env(safe-area-inset-top,0px)) 0 0 0;padding:26px 14px}}
      @media(prefers-reduced-motion:reduce){.ytv16-line::after,.ytv16-card::after{animation:none}}
    `;
  }

  function ready() {
    installStyles();
    cleanupLegacySkeletons();
    eagerize();

    const route = routeFromLocation();
    const pending = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    if (route && pending === route) showSkeleton(route, false);

    document.addEventListener('click', (event) => {
      const control = event.target.closest?.('a,button,[data-route-path],[data-route],[data-section-target]');
      const targetRoute = inferRoute(control);
      if (!targetRoute) return;
      cleanupLegacySkeletons();
      showSkeleton(targetRoute, true);
    }, true);

    window.addEventListener('pageshow', () => {
      cleanupLegacySkeletons();
      window.setTimeout(removeSkeleton, 1400);
    }, { passive: true });

    let checks = 0;
    const watchdog = window.setInterval(() => {
      cleanupLegacySkeletons();
      checks += 1;
      if (checks >= 16) window.clearInterval(watchdog);
    }, 100);

    document.documentElement.dataset.ytconvSkeletonGuard = 'v16';
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();