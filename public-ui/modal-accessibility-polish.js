(() => {
  const VERSION = 'v1';
  const MODAL_Z = 2147483550;
  const BACKDROP_Z = 2147483000;
  const DIALOG_SELECTOR = '.modal';
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(',');

  if (window.__ytconvModalAccessibilityPolishV1) return;
  window.__ytconvModalAccessibilityPolishV1 = true;

  let activeModal = null;
  let previouslyFocused = null;
  let inertedElements = [];
  let syncTimer = 0;

  const isVisible = (element) => {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 1 && rect.height > 1;
  };

  const injectStyles = () => {
    if (document.getElementById('ytconv-modal-accessibility-polish-style')) return;

    const style = document.createElement('style');
    style.id = 'ytconv-modal-accessibility-polish-style';
    style.textContent = `
      :root {
        --ytconv-dialog-surface: var(--surface, #ffffff);
        --ytconv-dialog-surface-soft: var(--surface-secondary, #f8fafc);
        --ytconv-dialog-text: var(--text, #111827);
        --ytconv-dialog-muted: var(--text-secondary, #64748b);
        --ytconv-dialog-border: var(--border, rgba(100, 116, 139, .25));
        --ytconv-dialog-accent: #2563eb;
        --ytconv-dialog-scrim: rgba(15, 23, 42, .22);
        --ytconv-dialog-shadow: 0 24px 70px rgba(15, 23, 42, .22);
      }

      [data-bs-theme="dark"] {
        --ytconv-dialog-surface: var(--surface, #18181b);
        --ytconv-dialog-surface-soft: var(--surface-secondary, #202024);
        --ytconv-dialog-text: var(--text, #f4f4f5);
        --ytconv-dialog-muted: var(--text-secondary, #a1a1aa);
        --ytconv-dialog-border: var(--border, rgba(148, 163, 184, .24));
        --ytconv-dialog-scrim: rgba(2, 6, 23, .34);
        --ytconv-dialog-shadow: 0 26px 90px rgba(0, 0, 0, .42);
      }

      body > .modal-backdrop.ytconv-modal-backdrop,
      body > .modal-backdrop.show {
        position: fixed !important;
        inset: 0 !important;
        z-index: ${BACKDROP_Z} !important;
        margin: 0 !important;
        background: var(--ytconv-dialog-scrim) !important;
        background-color: var(--ytconv-dialog-scrim) !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        backdrop-filter: blur(2px) !important;
        -webkit-backdrop-filter: blur(2px) !important;
        transition: opacity .16s ease !important;
      }

      body > .modal.ytconv-modal-polished {
        position: fixed !important;
        inset: 0 !important;
        z-index: ${MODAL_Z} !important;
        display: none;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: max(12px, env(safe-area-inset-top)) clamp(12px, 2.5vw, 28px) max(12px, env(safe-area-inset-bottom)) !important;
        background: transparent !important;
        color: var(--ytconv-dialog-text) !important;
        pointer-events: none !important;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }

      body > .modal.ytconv-modal-polished.show,
      body > .modal.ytconv-modal-polished[aria-modal="true"] {
        display: block !important;
        pointer-events: auto !important;
      }

      .ytconv-modal-polished .modal-dialog {
        width: min(100%, 760px) !important;
        max-width: 760px !important;
        min-height: calc(100dvh - max(24px, env(safe-area-inset-top)) - max(24px, env(safe-area-inset-bottom))) !important;
        margin: 0 auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        pointer-events: none !important;
        transform: none !important;
      }

      .ytconv-modal-polished .modal-content {
        position: relative !important;
        width: 100% !important;
        max-height: min(88dvh, 880px) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        border: 1px solid var(--ytconv-dialog-border) !important;
        border-radius: 24px !important;
        background: var(--ytconv-dialog-surface) !important;
        background-color: var(--ytconv-dialog-surface) !important;
        color: var(--ytconv-dialog-text) !important;
        box-shadow: var(--ytconv-dialog-shadow) !important;
        filter: none !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: translateZ(0) !important;
      }

      .ytconv-modal-polished .modal-header {
        position: sticky !important;
        top: 0 !important;
        z-index: 40 !important;
        min-height: 72px !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 16px 18px !important;
        border-bottom: 1px solid var(--ytconv-dialog-border) !important;
        background: var(--ytconv-dialog-surface) !important;
        color: var(--ytconv-dialog-text) !important;
      }

      .ytconv-modal-polished .modal-title {
        margin: 0 !important;
        color: var(--ytconv-dialog-text) !important;
        font-size: clamp(1.05rem, 2vw, 1.25rem) !important;
        font-weight: 800 !important;
        line-height: 1.25 !important;
        letter-spacing: -.012em;
      }

      .ytconv-modal-polished .modal-body {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        padding: clamp(18px, 3vw, 28px) !important;
        background: var(--ytconv-dialog-surface) !important;
        color: var(--ytconv-dialog-text) !important;
        scrollbar-width: thin;
        scrollbar-color: rgba(100, 116, 139, .55) transparent;
      }

      .ytconv-modal-polished .modal-footer {
        position: sticky !important;
        bottom: 0 !important;
        z-index: 30 !important;
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: flex-end !important;
        gap: 10px !important;
        padding: 14px 18px max(14px, env(safe-area-inset-bottom)) !important;
        border-top: 1px solid var(--ytconv-dialog-border) !important;
        background: var(--ytconv-dialog-surface) !important;
      }

      .ytconv-modal-polished .btn-close,
      .ytconv-modal-polished .ytconv-modal-close {
        position: relative !important;
        z-index: 60 !important;
        flex: 0 0 auto !important;
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        min-height: 44px !important;
        margin: 0 0 0 auto !important;
        padding: 0 !important;
        display: inline-grid !important;
        place-items: center !important;
        border: 1px solid var(--ytconv-dialog-border) !important;
        border-radius: 999px !important;
        background: var(--ytconv-dialog-surface-soft) !important;
        color: var(--ytconv-dialog-text) !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
        box-shadow: none !important;
        transform: none !important;
        transition: background-color .14s ease, border-color .14s ease !important;
        -webkit-tap-highlight-color: transparent;
      }

      .ytconv-modal-polished .btn-close::before,
      .ytconv-modal-polished .ytconv-modal-close::before {
        content: "×" !important;
        display: block !important;
        color: currentColor !important;
        font-size: 28px !important;
        font-weight: 500 !important;
        line-height: 1 !important;
      }

      .ytconv-modal-polished .btn-close {
        background-image: none !important;
      }

      .ytconv-modal-polished .btn-close:hover,
      .ytconv-modal-polished .ytconv-modal-close:hover {
        background: color-mix(in srgb, var(--ytconv-dialog-surface-soft) 78%, var(--ytconv-dialog-accent)) !important;
      }

      .ytconv-modal-polished :is(button, a, input, select, textarea, [tabindex]):focus-visible {
        outline: 3px solid color-mix(in srgb, var(--ytconv-dialog-accent) 78%, white) !important;
        outline-offset: 2px !important;
      }

      .ytconv-modal-polished :is(.form-control, .form-select, input:not([type="checkbox"]):not([type="radio"]), select, textarea) {
        width: 100%;
        min-height: 48px !important;
        padding: 11px 14px !important;
        border: 1px solid var(--ytconv-dialog-border) !important;
        border-radius: 14px !important;
        background: var(--ytconv-dialog-surface-soft) !important;
        color: var(--ytconv-dialog-text) !important;
        box-shadow: none !important;
      }

      .ytconv-modal-polished textarea,
      .ytconv-modal-support textarea {
        min-height: 132px !important;
        resize: vertical !important;
      }

      .ytconv-modal-polished :is(.form-label, label) {
        color: var(--ytconv-dialog-text) !important;
        font-weight: 700 !important;
      }

      .ytconv-modal-polished :is(.form-text, .text-muted, small) {
        color: var(--ytconv-dialog-muted) !important;
      }

      .ytconv-modal-polished :is(.btn, button[type="submit"]) {
        min-height: 46px;
        border-radius: 14px !important;
        font-weight: 750 !important;
        touch-action: manipulation;
      }

      .ytconv-dialog-helper {
        margin: 0 0 20px !important;
        padding: 14px 16px !important;
        display: grid !important;
        grid-template-columns: auto 1fr !important;
        gap: 12px !important;
        align-items: start !important;
        border: 1px solid var(--ytconv-dialog-border) !important;
        border-radius: 16px !important;
        background: var(--ytconv-dialog-surface-soft) !important;
        color: var(--ytconv-dialog-text) !important;
      }

      .ytconv-dialog-helper-icon {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: color-mix(in srgb, var(--ytconv-dialog-accent) 16%, transparent);
        color: var(--ytconv-dialog-accent);
        font-size: 1.05rem;
        font-weight: 800;
      }

      .ytconv-dialog-helper strong {
        display: block;
        margin-bottom: 4px;
        color: var(--ytconv-dialog-text);
      }

      .ytconv-dialog-helper p {
        margin: 0;
        color: var(--ytconv-dialog-muted);
        line-height: 1.55;
      }

      .ytconv-modal-community :is(.forum-login-card, [class*="forum-login"], [class*="community-login"]) {
        padding: clamp(18px, 4vw, 28px) !important;
        border: 1px solid var(--ytconv-dialog-border) !important;
        border-radius: 20px !important;
        background: var(--ytconv-dialog-surface-soft) !important;
        color: var(--ytconv-dialog-text) !important;
        box-shadow: none !important;
        opacity: 1 !important;
        filter: none !important;
      }

      .ytconv-modal-community :is(#googleSignInBtn, #forumGoogleLoginBtn) {
        width: 100% !important;
        min-height: 54px !important;
        padding: 12px 18px !important;
        border: 1px solid var(--ytconv-dialog-border) !important;
        border-radius: 16px !important;
        background: var(--ytconv-dialog-surface) !important;
        color: var(--ytconv-dialog-text) !important;
        font-weight: 800 !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }

      .ytconv-modal-support :is(form, .ticket-form, [class*="ticket-form"], [class*="support-form"]) {
        display: grid;
        gap: 16px;
      }

      .ytconv-modal-support :is([href^="mailto:"], .support-email, [class*="email-help"]) {
        overflow-wrap: anywhere;
      }

      .ytconv-modal-support button[type="submit"] {
        min-height: 52px !important;
        padding-inline: 22px !important;
      }

      body.ytconv-dialog-open {
        overflow: hidden !important;
        overscroll-behavior: none;
      }

      @media (max-width: 640px) {
        body > .modal.ytconv-modal-polished {
          padding: max(74px, calc(env(safe-area-inset-top) + 74px)) 0 0 !important;
        }

        .ytconv-modal-polished .modal-dialog {
          width: 100% !important;
          max-width: none !important;
          min-height: calc(100dvh - max(74px, calc(env(safe-area-inset-top) + 74px))) !important;
          align-items: flex-end !important;
        }

        .ytconv-modal-polished .modal-content {
          max-height: calc(100dvh - max(74px, calc(env(safe-area-inset-top) + 74px))) !important;
          border-right: 0 !important;
          border-bottom: 0 !important;
          border-left: 0 !important;
          border-radius: 24px 24px 0 0 !important;
        }

        .ytconv-modal-polished .modal-content::before {
          content: "";
          width: 42px;
          height: 4px;
          flex: 0 0 auto;
          margin: 9px auto -5px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--ytconv-dialog-muted) 55%, transparent);
        }

        .ytconv-modal-polished .modal-header {
          min-height: 66px !important;
          padding: 12px 16px !important;
        }

        .ytconv-modal-polished .modal-body {
          padding: 18px 16px !important;
        }

        .ytconv-modal-polished .modal-footer {
          padding-inline: 16px !important;
        }

        .ytconv-modal-polished .modal-footer > :is(.btn, button, a) {
          flex: 1 1 140px;
        }

        .ytconv-modal-support button[type="submit"] {
          width: 100% !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ytconv-modal-polished *,
        body > .modal-backdrop.ytconv-modal-backdrop {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      }

      @media (forced-colors: active) {
        .ytconv-modal-polished .modal-content,
        .ytconv-modal-polished .modal-header,
        .ytconv-modal-polished .modal-footer,
        .ytconv-dialog-helper {
          border: 1px solid CanvasText !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const modalSignature = (modal) => {
    const heading = modal.querySelector('.modal-title, h1, h2, h3, [role="heading"]')?.textContent || '';
    return `${modal.id || ''} ${modal.className || ''} ${modal.getAttribute('aria-label') || ''} ${heading}`.toLowerCase();
  };

  const classifyModal = (modal) => {
    const signature = modalSignature(modal);
    if (/(forum|community|komunitas)/i.test(signature)) return 'community';
    if (/(ticket|support|help|bantuan|contact|kontak|email)/i.test(signature)) return 'support';
    return 'general';
  };

  const ensureTitle = (modal) => {
    let title = modal.querySelector('.modal-title, [data-ytconv-dialog-title], h1, h2, h3');
    if (!title) {
      const header = modal.querySelector('.modal-header');
      if (header) {
        title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = classifyModal(modal) === 'community' ? 'Komunitas YTConv' : 'YTConv';
        header.prepend(title);
      }
    }

    if (!title) return;
    if (!title.id) title.id = `ytconv-dialog-title-${modal.id || Math.random().toString(36).slice(2, 8)}`;
    modal.setAttribute('aria-labelledby', title.id);
  };

  const fallbackHide = (modal) => {
    modal.classList.remove('show');
    modal.style.removeProperty('display');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('aria-modal');
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
    document.body.classList.remove('modal-open');
    modal.dispatchEvent(new Event('hidden.bs.modal', { bubbles: true }));
    scheduleSync();
  };

  const requestClose = (modal) => {
    if (!modal) return;
    try {
      const Modal = window.bootstrap?.Modal;
      const instance = Modal?.getOrCreateInstance?.(modal);
      if (instance?.hide) {
        instance.hide();
        return;
      }
    } catch (error) {
      console.warn('[modal-polish] Bootstrap hide fallback used', error);
    }
    fallbackHide(modal);
  };

  const ensureCloseButton = (modal) => {
    let button = modal.querySelector('.btn-close, [data-bs-dismiss="modal"], [data-dismiss="modal"]');
    if (!button) {
      let header = modal.querySelector('.modal-header');
      const content = modal.querySelector('.modal-content');
      if (!header && content) {
        header = document.createElement('div');
        header.className = 'modal-header';
        content.prepend(header);
      }
      if (header) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'ytconv-modal-close';
        button.dataset.bsDismiss = 'modal';
        header.appendChild(button);
      }
    }

    if (!button) return null;
    if (button.tagName === 'BUTTON' && !button.getAttribute('type')) button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'Tutup dialog');
    button.setAttribute('title', 'Tutup');
    button.classList.add('ytconv-modal-close-control');
    if (!button.dataset.ytconvCloseFallback) {
      button.dataset.ytconvCloseFallback = 'true';
      button.addEventListener('click', (event) => {
        if (!modal.classList.contains('show') && modal.getAttribute('aria-modal') !== 'true') return;
        if (!window.bootstrap?.Modal) {
          event.preventDefault();
          requestClose(modal);
        }
      });
    }
    return button;
  };

  const addHelper = (modal, type) => {
    if (type === 'general') return;
    const body = modal.querySelector('.modal-body');
    if (!body || body.querySelector(':scope > .ytconv-dialog-helper')) return;

    const helper = document.createElement('section');
    helper.className = 'ytconv-dialog-helper';
    helper.setAttribute('aria-label', type === 'community' ? 'Informasi komunitas' : 'Informasi bantuan');

    const icon = document.createElement('span');
    icon.className = 'ytconv-dialog-helper-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = type === 'community' ? '💬' : '✉';

    const copy = document.createElement('div');
    const title = document.createElement('strong');
    const description = document.createElement('p');

    if (type === 'community') {
      title.textContent = 'Bergabung dengan aman';
      description.textContent = 'Masuk dengan Google untuk memakai identitas forum. Tombol dan percakapan tetap menggunakan fungsi komunitas yang sudah ada.';
    } else {
      title.textContent = 'Ceritakan kendalanya dengan jelas';
      description.textContent = 'Isi email yang aktif serta detail masalah. Tim bantuan akan menggunakan informasi ini untuk memeriksa dan membalas tiketmu.';
    }

    copy.append(title, description);
    helper.append(icon, copy);
    body.prepend(helper);
  };

  const prepareModal = (modal) => {
    if (!(modal instanceof HTMLElement)) return;
    injectStyles();

    const body = document.body;
    if (modal.parentElement !== body) body.appendChild(modal);

    modal.classList.add('ytconv-modal-polished');
    modal.dataset.ytconvModalPolish = VERSION;
    modal.style.setProperty('z-index', String(MODAL_Z), 'important');
    modal.style.setProperty('pointer-events', 'auto', 'important');
    modal.setAttribute('role', 'dialog');

    const type = classifyModal(modal);
    modal.classList.toggle('ytconv-modal-community', type === 'community');
    modal.classList.toggle('ytconv-modal-support', type === 'support');

    ensureTitle(modal);
    ensureCloseButton(modal);
    addHelper(modal, type);
  };

  const visibleModals = () => Array.from(document.querySelectorAll(DIALOG_SELECTOR)).filter((modal) =>
    modal.classList.contains('show') || modal.getAttribute('aria-modal') === 'true' || (modal.style.display === 'block' && isVisible(modal))
  );

  const markBackdrop = () => {
    const backdrops = Array.from(document.querySelectorAll('body > .modal-backdrop'));
    backdrops.forEach((backdrop, index) => {
      backdrop.classList.add('ytconv-modal-backdrop');
      backdrop.style.setProperty('z-index', String(BACKDROP_Z + index), 'important');
      backdrop.style.setProperty('background', 'var(--ytconv-dialog-scrim)', 'important');
      backdrop.style.setProperty('opacity', '1', 'important');
    });

    if (backdrops.length > 1) {
      backdrops.slice(0, -1).forEach((backdrop) => backdrop.remove());
    }
  };

  const makeBackgroundInert = (modal) => {
    restoreBackground();
    inertedElements = Array.from(document.body.children)
      .filter((element) => element !== modal && !element.classList.contains('modal-backdrop') && element.tagName !== 'SCRIPT' && element.tagName !== 'STYLE')
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }));

    inertedElements.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
  };

  function restoreBackground() {
    inertedElements.forEach(({ element, inert, ariaHidden }) => {
      if (!element?.isConnected) return;
      element.inert = inert;
      if (ariaHidden == null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', ariaHidden);
    });
    inertedElements = [];
  }

  const focusableElements = (modal) => Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);

  const focusModal = (modal) => {
    requestAnimationFrame(() => {
      const preferred = modal.querySelector('[autofocus], .btn-close, .ytconv-modal-close, input:not([type="hidden"]), button:not([disabled]), a[href]');
      if (preferred && isVisible(preferred)) preferred.focus({ preventScroll: true });
      else {
        const content = modal.querySelector('.modal-content') || modal;
        if (!content.hasAttribute('tabindex')) content.setAttribute('tabindex', '-1');
        content.focus({ preventScroll: true });
      }
    });
  };

  const activateModal = (modal) => {
    prepareModal(modal);
    markBackdrop();

    if (activeModal !== modal) {
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      activeModal = modal;
      makeBackgroundInert(modal);
      focusModal(modal);
    }

    modal.setAttribute('aria-modal', 'true');
    modal.removeAttribute('aria-hidden');
    document.body.classList.add('ytconv-dialog-open');
  };

  const deactivateModal = () => {
    const previous = activeModal;
    activeModal = null;
    restoreBackground();
    document.body.classList.remove('ytconv-dialog-open');

    if (previous) {
      previous.setAttribute('aria-hidden', 'true');
      previous.removeAttribute('aria-modal');
    }

    const target = previouslyFocused;
    previouslyFocused = null;
    if (target?.isConnected) requestAnimationFrame(() => target.focus({ preventScroll: true }));
  };

  const sync = () => {
    injectStyles();
    document.querySelectorAll(DIALOG_SELECTOR).forEach(prepareModal);
    const open = visibleModals();

    if (open.length) activateModal(open[open.length - 1]);
    else {
      document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
      deactivateModal();
    }
  };

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 40);
  }

  const isStaticBackdrop = (modal) => modal?.getAttribute('data-bs-backdrop') === 'static' || modal?.getAttribute('data-backdrop') === 'static';

  document.addEventListener('show.bs.modal', (event) => {
    if (event.target?.matches?.(DIALOG_SELECTOR)) prepareModal(event.target);
  }, true);

  document.addEventListener('shown.bs.modal', (event) => {
    if (event.target?.matches?.(DIALOG_SELECTOR)) activateModal(event.target);
  }, true);

  document.addEventListener('hidden.bs.modal', scheduleSync, true);

  document.addEventListener('keydown', (event) => {
    if (!activeModal) return;

    if (event.key === 'Escape' && !isStaticBackdrop(activeModal)) {
      event.preventDefault();
      requestClose(activeModal);
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = focusableElements(activeModal);
    if (!focusable.length) {
      event.preventDefault();
      (activeModal.querySelector('.modal-content') || activeModal).focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  document.addEventListener('click', (event) => {
    const backdrop = event.target?.closest?.('.modal-backdrop');
    if (!backdrop || !activeModal || isStaticBackdrop(activeModal)) return;
    event.preventDefault();
    requestClose(activeModal);
  }, true);

  const boot = () => {
    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'aria-modal', 'data-bs-backdrop'],
    });
    window.addEventListener('pageshow', scheduleSync);
    window.addEventListener('resize', scheduleSync, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
