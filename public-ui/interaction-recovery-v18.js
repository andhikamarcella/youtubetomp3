(() => {
  'use strict';

  if (window.__ytconvInteractionRecoveryV18) return;
  window.__ytconvInteractionRecoveryV18 = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const CLOSE_SELECTOR = [
    '.ytv17-close',
    '.btn-close',
    '[data-bs-dismiss="modal"]',
    '[data-dismiss="modal"]',
    '[aria-label^="Tutup" i]',
    '[aria-label^="Close" i]',
    '[title^="Tutup" i]',
    '[title^="Close" i]',
    '#forumWidgetClose'
  ].join(',');
  const LEGACY_BACKDROPS = [
    '.modal-backdrop',
    '.offcanvas-backdrop',
    '.ytv11-dialog-backdrop',
    '.ytv12-backdrop',
    '.ytv13-backdrop',
    '#ytv14ProfileBackdrop',
    '.ytv15-backdrop',
    '[data-ytconv-modal-backdrop]',
    '[data-modal-backdrop]'
  ].join(',');

  let unlockTimer = 0;
  let scanTimer = 0;

  const normalizeText = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const installStyles = () => {
    let style = $('#ytconv-interaction-recovery-v18');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-interaction-recovery-v18';
      document.head.appendChild(style);
    }
    style.textContent = `
      .ytv18-convert-status,
      .ytv18-convert-status * {
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        word-break: keep-all !important;
        overflow-wrap: normal !important;
        white-space: nowrap !important;
      }

      .ytv18-convert-status {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 6px !important;
        grid-column: 1 / -1 !important;
        justify-self: start !important;
        width: max-content !important;
        min-width: max-content !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 24px !important;
        margin: 2px 0 !important;
        padding: 0 !important;
        line-height: 1.25 !important;
        overflow: visible !important;
      }

      .ytv18-status-host {
        grid-column: 1 / -1 !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: visible !important;
      }

      body:not(.modal-open):not(.ytv18-real-modal-open) #mainContent,
      body:not(.modal-open):not(.ytv18-real-modal-open) #ytcleanSidebar,
      body:not(.modal-open):not(.ytv18-real-modal-open) .ytclean-sidebar,
      body:not(.modal-open):not(.ytv18-real-modal-open) .ytclean-mobilebar,
      body:not(.modal-open):not(.ytv18-real-modal-open) #ytcleanOpenDrawer,
      body:not(.modal-open):not(.ytv18-real-modal-open) .yc-composer {
        pointer-events: auto !important;
      }

      .modal[aria-hidden="true"],
      .modal[hidden],
      .modal:not(.show):not(.ytconv-modal-active) {
        pointer-events: none !important;
      }

      @media (max-width: 620px) {
        .ytv18-convert-status {
          max-width: calc(100vw - 58px) !important;
          font-size: 12px !important;
        }
      }
    `;
  };

  const isRendered = (node) => {
    if (!node || node.hidden || node.getAttribute?.('aria-hidden') === 'true') return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const activeModals = () => $$('.modal').filter((modal) => {
    if (!modal.classList.contains('show') && !modal.classList.contains('ytconv-modal-active')) return false;
    return isRendered(modal);
  });

  const markConverterStatus = (root = document) => {
    const composer = $('.yc-composer');
    const scope = composer || root;
    const candidates = $$('div,span,p,small,label,strong', scope)
      .filter((node) => /convert\s*aktif\s*normal\.?/i.test(normalizeText(node.textContent)));

    candidates.forEach((node) => {
      const childHasSameText = [...node.children].some((child) =>
        /convert\s*aktif\s*normal\.?/i.test(normalizeText(child.textContent))
      );
      if (childHasSameText) return;

      node.classList.add('ytv18-convert-status');
      node.removeAttribute('inert');
      node.style.removeProperty('width');
      node.style.removeProperty('max-width');
      node.style.removeProperty('word-break');
      node.style.removeProperty('overflow-wrap');
      node.style.removeProperty('white-space');

      if (!composer || !composer.contains(node)) return;
      let host = node;
      while (host.parentElement && host.parentElement !== composer) host = host.parentElement;
      if (host && host !== composer) host.classList.add('ytv18-status-host');
    });
  };

  const hardCloseModal = (modal) => {
    if (!modal?.classList?.contains('modal')) return;
    modal.classList.remove('show', 'ytconv-modal-active', 'ytconv-modal-closing', 'fade');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('aria-modal');
    modal.setAttribute('inert', '');
    modal.style.setProperty('display', 'none', 'important');
    modal.style.setProperty('pointer-events', 'none', 'important');
  };

  const protectedOverlay = (node) => {
    if (!node) return true;
    if (node.id === 'ytcleanDrawerBackdrop' && document.body.classList.contains('ytclean-drawer-open')) return true;
    if (node.id === 'ycrOptionsBackdrop' && document.body.classList.contains('ycr-options-open')) return true;
    if (node.matches?.('.ytclean-mobilebar,.ytclean-sidebar,#ytcleanSidebar,#mainContent,.yc-composer')) return true;
    return false;
  };

  const removeCoveringBlockers = () => {
    if (activeModals().length) return;

    $$(`${LEGACY_BACKDROPS}, #ycrOptionsBackdrop`).forEach((node) => {
      if (protectedOverlay(node)) return;
      node.remove();
    });

    [...document.body.children].forEach((node) => {
      if (!(node instanceof HTMLElement) || protectedOverlay(node)) return;
      if (node.matches('.modal')) {
        if (!activeModals().includes(node) && isRendered(node)) hardCloseModal(node);
        return;
      }

      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const zIndex = Number.parseInt(style.zIndex || '0', 10) || 0;
      const name = `${node.id || ''} ${node.className || ''}`;
      const coversViewport = style.position === 'fixed'
        && rect.width >= window.innerWidth * 0.88
        && rect.height >= window.innerHeight * 0.88;
      const looksLikeOverlay = /backdrop|overlay|scrim|modal-layer|dialog-layer/i.test(name) || zIndex >= 100000;
      if (coversViewport && looksLikeOverlay && style.pointerEvents !== 'none') node.remove();
    });
  };

  const restoreAppInteraction = () => {
    const open = activeModals();
    document.body.classList.toggle('ytv18-real-modal-open', open.length > 0);
    if (open.length) return;

    $$('.modal').forEach((modal) => {
      if (!modal.classList.contains('show') || modal.getAttribute('aria-hidden') === 'true' || !isRendered(modal)) {
        hardCloseModal(modal);
      }
    });

    removeCoveringBlockers();

    document.body.classList.remove(
      'modal-open',
      'has-open-modal',
      'ui-overlay-open',
      'ytconv-dialog-open',
      'ytv17-modal-open',
      'ytconv-modal-open',
      'offcanvas-open'
    );

    [document.documentElement, document.body].forEach((node) => {
      ['overflow', 'overflow-x', 'overflow-y', 'padding-right', 'position', 'top', 'width', 'touch-action', 'pointer-events']
        .forEach((property) => node.style.removeProperty(property));
    });

    $$('[inert]').forEach((node) => {
      if (!node.closest('.modal.show,.modal.ytconv-modal-active')) node.removeAttribute('inert');
    });

    [
      '#mainContent',
      '#ytcleanSidebar',
      '.ytclean-sidebar',
      '.ytclean-mobilebar',
      '#ytcleanOpenDrawer',
      '.yc-composer',
      '#app',
      'main'
    ].forEach((selector) => {
      $$(selector).forEach((node) => {
        node.removeAttribute('inert');
        if (node.getAttribute('aria-hidden') === 'true') node.removeAttribute('aria-hidden');
        node.style.removeProperty('pointer-events');
        node.style.removeProperty('filter');
      });
    });
  };

  const scheduleUnlock = (delays = [0, 80, 220, 520]) => {
    clearTimeout(unlockTimer);
    delays.forEach((delay) => {
      window.setTimeout(() => {
        restoreAppInteraction();
        markConverterStatus();
      }, delay);
    });
    unlockTimer = window.setTimeout(restoreAppInteraction, Math.max(...delays) + 120);
  };

  const closeContainerAfterClick = (button) => {
    const modal = button?.closest?.('.modal');
    if (!modal) return;
    window.setTimeout(() => {
      if (modal.getAttribute('aria-hidden') === 'true' || !modal.classList.contains('show') || !isRendered(modal)) {
        hardCloseModal(modal);
      }
      scheduleUnlock();
    }, 140);
  };

  const boot = () => {
    installStyles();
    markConverterStatus();
    restoreAppInteraction();

    document.addEventListener('click', (event) => {
      const button = event.target.closest?.(CLOSE_SELECTOR);
      if (!button) return;
      closeContainerAfterClick(button);
      scheduleUnlock();
    }, true);

    ['hide.bs.modal', 'hidden.bs.modal'].forEach((type) => {
      document.addEventListener(type, (event) => {
        if (type === 'hidden.bs.modal') hardCloseModal(event.target);
        scheduleUnlock();
      }, true);
    });

    document.addEventListener('pointerdown', () => {
      if (!activeModals().length) restoreAppInteraction();
    }, true);

    window.addEventListener('pageshow', scheduleUnlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleUnlock();
    });

    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) shouldScan = true;
        if (mutation.type === 'attributes') shouldScan = true;
      }
      if (!shouldScan) return;
      clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        markConverterStatus();
        if (!activeModals().length) restoreAppInteraction();
      }, 40);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'inert']
    });

    [150, 500, 1100, 2200, 4000].forEach((delay) => window.setTimeout(() => {
      markConverterStatus();
      restoreAppInteraction();
    }, delay));

    document.documentElement.dataset.ytconvInteractionRecovery = 'v18';
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot, { once: true })
    : boot();
})();
