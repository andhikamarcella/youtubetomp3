(() => {
  if (window.__ytconvModalLifecycleGuardV1) return;
  window.__ytconvModalLifecycleGuardV1 = true;

  const selector = '.modal.ytconv-modal-polished';
  let syncTimer = 0;

  const injectStyle = () => {
    if (document.getElementById('ytconv-modal-lifecycle-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'ytconv-modal-lifecycle-guard-style';
    style.textContent = `
      body > .modal.ytconv-modal-polished.ytconv-modal-active,
      body > .modal.ytconv-modal-polished.show {
        display: block !important;
        pointer-events: auto !important;
      }

      body > .modal.ytconv-modal-polished.ytconv-modal-closing,
      body > .modal.ytconv-modal-polished:not(.show):not(.ytconv-modal-active) {
        display: none !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  };

  const markOpen = (modal) => {
    if (!modal?.matches?.(selector)) return;
    modal.classList.remove('ytconv-modal-closing');
    modal.classList.add('ytconv-modal-active');
    if (modal.getAttribute('aria-modal') !== 'true') modal.setAttribute('aria-modal', 'true');
    modal.removeAttribute('aria-hidden');
  };

  const markClosing = (modal) => {
    if (!modal?.matches?.(selector)) return;
    modal.classList.remove('ytconv-modal-active');
    modal.classList.add('ytconv-modal-closing');
    modal.removeAttribute('aria-modal');
    modal.setAttribute('aria-hidden', 'true');
  };

  const markClosed = (modal) => {
    if (!modal?.matches?.(selector)) return;
    modal.classList.remove('ytconv-modal-active', 'ytconv-modal-closing');
    modal.removeAttribute('aria-modal');
    modal.setAttribute('aria-hidden', 'true');
  };

  const cleanupBackdrops = () => {
    const open = document.querySelector(`${selector}.show, ${selector}.ytconv-modal-active`);
    if (open) return;
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
    document.body.classList.remove('modal-open', 'ytconv-dialog-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
  };

  const sync = () => {
    injectStyle();
    document.querySelectorAll(selector).forEach((modal) => {
      if (modal.classList.contains('show')) markOpen(modal);
      else if (modal.getAttribute('aria-hidden') === 'true' || modal.style.display === 'none') markClosed(modal);
    });
    cleanupBackdrops();
  };

  const scheduleSync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 50);
  };

  document.addEventListener('show.bs.modal', (event) => markOpen(event.target), true);
  document.addEventListener('shown.bs.modal', (event) => markOpen(event.target), true);
  document.addEventListener('hide.bs.modal', (event) => {
    markClosing(event.target);
    scheduleSync();
  }, true);
  document.addEventListener('hidden.bs.modal', (event) => {
    markClosed(event.target);
    scheduleSync();
  }, true);

  const boot = () => {
    injectStyle();
    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'aria-modal'],
    });
    window.addEventListener('pageshow', scheduleSync);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
