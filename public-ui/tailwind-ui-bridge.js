(() => {
  const markReady = () => {
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;
    root.dataset.tailwindUi = 'ready';
    body.classList.add('tw-enhanced');

    const interactiveSelector = 'button, a.btn, .btn, [role="button"], input, select, textarea';
    document.querySelectorAll(interactiveSelector).forEach((el) => {
      el.dataset.tailwindConnected = 'true';
    });

    document.addEventListener('pointerdown', (event) => {
      const target = event.target.closest('button, a, .btn, [role="button"]');
      if (!target) return;
      target.classList.add('tw-pressed');
      const rect = target.getBoundingClientRect?.();
      if (rect) {
        target.style.setProperty('--tw-press-x', `${Math.round(event.clientX - rect.left)}px`);
        target.style.setProperty('--tw-press-y', `${Math.round(event.clientY - rect.top)}px`);
      }
    }, { passive: true });

    ['pointerup', 'pointercancel', 'mouseleave', 'blur'].forEach((name) => {
      document.addEventListener(name, (event) => {
        const target = event.target.closest?.('button, a, .btn, [role="button"]');
        target?.classList.remove('tw-pressed');
      }, true);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, { once: true });
  } else {
    markReady();
  }
})();
