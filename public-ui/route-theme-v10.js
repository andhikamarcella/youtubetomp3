(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const ROUTES = ['studio', 'rewards', 'faq', 'community', 'profile', 'about'];
  const routeSelector = ROUTES.map((route) => `body.ytclean-route-${route}`).join(',');

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
        --ytr-panel: var(--ytv8-panel, #2f2f2f);
        --ytr-panel-2: var(--ytv8-panel-2, #272727);
        --ytr-border: var(--ytv8-border, rgba(255,255,255,.1));
        --ytr-text: #ececec;
        --ytr-muted: var(--ytv8-muted, #a8a8a8);
        background: var(--ytr-bg) !important;
        color: var(--ytr-text) !important;
      }

      ${routeSelector} #mainContent {
        width: min(100%, 1040px) !important;
        max-width: 1040px !important;
        padding-bottom: 64px !important;
      }

      ${routeSelector} #mainContent > .section-header,
      ${routeSelector} .section-header.ytconv-hero-clean {
        display: grid !important;
        grid-template-columns: minmax(0,1fr) auto !important;
        align-items: center !important;
        gap: 18px !important;
        min-height: 72px !important;
        margin: 0 0 22px !important;
        padding: 10px 2px 18px !important;
        border: 0 !important;
        border-bottom: 1px solid var(--ytr-border) !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      ${routeSelector} #activeSectionTitle {
        margin: 0 !important;
        color: var(--ytr-text) !important;
        font-size: clamp(27px, 4vw, 38px) !important;
        line-height: 1.08 !important;
        letter-spacing: -.035em !important;
        text-transform: none !important;
      }

      ${routeSelector} #activeSectionSubtitle {
        display: block !important;
        max-width: 680px !important;
        margin: 7px 0 0 !important;
        color: var(--ytr-muted) !important;
        font-size: 14px !important;
        line-height: 1.55 !important;
      }

      ${routeSelector} #mainContent .card,
      ${routeSelector} #mainContent .accordion-item,
      ${routeSelector} #mainContent .list-group-item,
      ${routeSelector} #mainContent .modal-content,
      ${routeSelector} #mainContent [class*='panel'],
      ${routeSelector} #mainContent [class*='surface'] {
        border: 1px solid var(--ytr-border) !important;
        border-radius: 18px !important;
        background: var(--ytr-panel-2) !important;
        color: var(--ytr-text) !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .card-body {
        padding: clamp(18px, 3vw, 28px) !important;
      }

      ${routeSelector} #mainContent h1,
      ${routeSelector} #mainContent h2,
      ${routeSelector} #mainContent h3,
      ${routeSelector} #mainContent h4,
      ${routeSelector} #mainContent h5,
      ${routeSelector} #mainContent h6,
      ${routeSelector} #mainContent strong,
      ${routeSelector} #mainContent label {
        color: var(--ytr-text) !important;
      }

      ${routeSelector} #mainContent p,
      ${routeSelector} #mainContent small,
      ${routeSelector} #mainContent .text-muted,
      ${routeSelector} #mainContent .form-text {
        color: var(--ytr-muted) !important;
      }

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
      ${routeSelector} #mainContent .btn-secondary:hover {
        background: var(--ytr-panel) !important;
      }

      ${routeSelector} #mainContent .nav-tabs,
      ${routeSelector} #mainContent .nav-pills {
        gap: 6px !important;
        padding: 5px !important;
        border: 1px solid var(--ytr-border) !important;
        border-radius: 13px !important;
        background: var(--ytr-panel-2) !important;
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

      ${routeSelector} #mainContent .accordion-button {
        min-height: 58px;
        border-radius: 14px !important;
        background: transparent !important;
        color: var(--ytr-text) !important;
        box-shadow: none !important;
      }

      ${routeSelector} #mainContent .accordion-body {
        color: var(--ytr-muted) !important;
      }

      ${routeSelector} #mainContent img {
        max-width: 100%;
        height: auto;
        border-radius: 14px;
      }

      body.ytclean-route-community #mainContent,
      body.ytclean-route-profile #mainContent {
        width: min(100%, 920px) !important;
      }

      body.ytclean-route-faq #mainContent .accordion {
        display: grid;
        gap: 10px;
      }

      body.ytclean-route-about #mainContent .row,
      body.ytclean-route-rewards #mainContent .row,
      body.ytclean-route-studio #mainContent .row {
        --bs-gutter-x: 18px;
        --bs-gutter-y: 18px;
      }

      [data-bs-theme='light'] ${routeSelector} {
        --ytr-bg: #fff;
        --ytr-panel: #f4f4f4;
        --ytr-panel-2: #fff;
        --ytr-border: rgba(0,0,0,.11);
        --ytr-text: #202123;
        --ytr-muted: #676767;
      }

      [data-bs-theme='light'] ${routeSelector} #mainContent .form-control,
      [data-bs-theme='light'] ${routeSelector} #mainContent .form-select,
      [data-bs-theme='light'] ${routeSelector} #mainContent textarea,
      [data-bs-theme='light'] ${routeSelector} #mainContent input:not([type='checkbox']):not([type='radio']):not([type='range']) {
        background: #fff !important;
      }

      @media (max-width: 991.98px) {
        ${routeSelector} #mainContent {
          width: 100% !important;
          max-width: none !important;
          padding: calc(86px + env(safe-area-inset-top,0px)) 14px calc(34px + env(safe-area-inset-bottom,0px)) !important;
        }

        ${routeSelector} #mainContent > .section-header,
        ${routeSelector} .section-header.ytconv-hero-clean {
          display: block !important;
          min-height: 0 !important;
          margin-bottom: 16px !important;
          padding: 2px 2px 14px !important;
        }

        ${routeSelector} #activeSectionTitle {
          font-size: 29px !important;
        }

        ${routeSelector} #mainContent .card,
        ${routeSelector} #mainContent .accordion-item,
        ${routeSelector} #mainContent .list-group-item,
        ${routeSelector} #mainContent [class*='panel'] {
          border-radius: 15px !important;
        }

        ${routeSelector} #mainContent .card-body {
          padding: 17px !important;
        }

        ${routeSelector} #mainContent .row > [class*='col-'] {
          width: 100% !important;
          max-width: 100% !important;
        }

        ${routeSelector} #mainContent .btn-group,
        ${routeSelector} #mainContent .d-flex.flex-wrap {
          gap: 8px !important;
        }
      }
    `;
  }

  function eagerize(root = document) {
    $$('img, iframe', root).forEach((node) => {
      node.loading = 'eager';
      node.setAttribute('loading', 'eager');
      if ('fetchPriority' in node) node.fetchPriority = 'high';
      node.setAttribute('fetchpriority', 'high');
      if (node.tagName === 'IMG') node.decoding = 'sync';
    });

    $$('video, audio', root).forEach((node) => {
      node.preload = 'auto';
      node.setAttribute('preload', 'auto');
    });

    $$('link[rel="preload"], link[rel="modulepreload"]', root).forEach((link) => {
      link.setAttribute('fetchpriority', 'high');
    });
  }

  function markCurrentRoute() {
    const active = ROUTES.find((route) => document.body.classList.contains(`ytclean-route-${route}`));
    document.body.classList.toggle('ytconv-secondary-route', Boolean(active));
    if (active) document.body.dataset.ytconvSecondaryRoute = active;
    else delete document.body.dataset.ytconvSecondaryRoute;
  }

  function apply() {
    installStyles();
    markCurrentRoute();
    eagerize();
    document.documentElement.dataset.ytconvRouteTheme = 'v10';
  }

  const ready = () => {
    apply();
    window.addEventListener('pageshow', apply, { passive: true });
    window.setTimeout(apply, 500);
    window.setTimeout(apply, 1500);

    const observer = new MutationObserver((mutations) => {
      markCurrentRoute();
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) eagerize(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();
