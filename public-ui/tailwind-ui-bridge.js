(() => {
  const injectPolish = () => {
    if (document.getElementById('tw-premium-button-polish')) return;
    const style = document.createElement('style');
    style.id = 'tw-premium-button-polish';
    style.textContent = `
      .tw-enhanced button,
      .tw-enhanced a.btn,
      .tw-enhanced .btn,
      .tw-enhanced [role="button"],
      .tw-enhanced a[class*="bg-"] {
        position: relative;
        overflow: hidden;
        border-radius: 999px;
        font-weight: 800;
        letter-spacing: .01em;
        transform: none !important;
        transition: transform .2s cubic-bezier(.22, 1, .36, 1), background-color .2s ease, border-color .2s ease, color .2s ease;
        box-shadow: none !important;
        text-shadow: none !important;
        filter: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .tw-enhanced button::before,
      .tw-enhanced a.btn::before,
      .tw-enhanced .btn::before,
      .tw-enhanced [role="button"]::before,
      .tw-enhanced a[class*="bg-"]::before {
        content: none !important;
        display: none !important;
      }
      .tw-enhanced button:hover,
      .tw-enhanced a.btn:hover,
      .tw-enhanced .btn:hover,
      .tw-enhanced [role="button"]:hover,
      .tw-enhanced a[class*="bg-"]:hover {
        transform: translateY(-1px) scale(1.01) !important;
        filter: none !important;
        box-shadow: none !important;
      }
      .tw-enhanced button:active,
      .tw-enhanced a.btn:active,
      .tw-enhanced .btn:active,
      .tw-enhanced [role="button"]:active,
      .tw-enhanced a[class*="bg-"]:active {
        transform: translateY(1px) scale(.985) !important;
      }
      .tw-enhanced :where(.btn, .app-nav-btn, .modern-nav-item, .footer-pill, .assistant-toggle, .assistant-fab, button, a.btn, [class*="bg-gradient"]) {
        background-image: none !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        filter: none !important;
      }
      .tw-enhanced :where(.btn-primary, .assistant-toggle, .assistant-fab) {
        background-color: #2563eb !important;
        border-color: #2563eb !important;
        color: #fff !important;
      }
      .tw-enhanced :where(.btn-outline-primary, .app-nav-btn, .modern-nav-item, .footer-pill) {
        background-color: #1f2937 !important;
        border-color: rgba(148, 163, 184, .45) !important;
        color: #e5e7eb !important;
      }
      .tw-enhanced button:focus-visible,
      .tw-enhanced a.btn:focus-visible,
      .tw-enhanced .btn:focus-visible,
      .tw-enhanced [role="button"]:focus-visible,
      .tw-enhanced a[class*="bg-"]:focus-visible {
        outline: 2px solid rgba(125, 211, 252, .9);
        outline-offset: 2px;
      }
      .tw-enhanced button:disabled,
      .tw-enhanced .btn:disabled,
      .tw-enhanced [aria-disabled="true"] {
        cursor: not-allowed;
        opacity: .62;
        transform: none !important;
        box-shadow: none !important;
        filter: none !important;
      }
      .tw-enhanced input,
      .tw-enhanced select,
      .tw-enhanced textarea,
      .tw-enhanced .form-control,
      .tw-enhanced .form-select {
        transition: border-color .18s ease, background-color .18s ease;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .tw-enhanced input:focus,
      .tw-enhanced select:focus,
      .tw-enhanced textarea:focus,
      .tw-enhanced .form-control:focus,
      .tw-enhanced .form-select:focus {
        box-shadow: none !important;
      }
      .tw-enhanced .premium-panel,
      .tw-enhanced .premium-card,
      .tw-enhanced .ytconv-premium-surface {
        border-color: rgba(148, 163, 184, .24);
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .tw-enhanced {
        position: relative;
        isolation: auto;
        font-family: Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        background-image: none !important;
      }
      .tw-glow-orb {
        display: none !important;
      }
      .tw-enhanced > :not(.tw-glow-orb) {
        position: relative;
        z-index: 1;
      }
      .tw-enhanced header,
      .tw-enhanced main > section,
      .tw-enhanced aside,
      .tw-enhanced .card,
      .tw-enhanced .modal-content,
      .tw-enhanced .dropdown-menu,
      .tw-enhanced .offcanvas,
      .tw-enhanced .list-group-item,
      .tw-enhanced .toast {
        border-color: rgba(148, 163, 184, .22);
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        filter: none !important;
        transition: border-color .18s ease, background-color .18s ease;
      }
      .tw-enhanced header:hover,
      .tw-enhanced main > section:hover,
      .tw-enhanced aside:hover,
      .tw-enhanced .card:hover,
      .tw-enhanced .modal-content:hover,
      .tw-enhanced .dropdown-menu:hover,
      .tw-enhanced .offcanvas:hover,
      .tw-enhanced .list-group-item:hover,
      .tw-enhanced .toast:hover {
        border-color: rgba(148, 163, 184, .34);
        box-shadow: none !important;
        filter: none !important;
      }
      .tw-enhanced h1,
      .tw-enhanced h2,
      .tw-enhanced h3,
      .tw-enhanced h4,
      .tw-enhanced h5,
      .tw-enhanced h6 {
        letter-spacing: -.015em;
        text-wrap: balance;
      }
      .tw-enhanced p,
      .tw-enhanced label,
      .tw-enhanced small,
      .tw-enhanced td,
      .tw-enhanced th {
        line-height: 1.6;
      }
      .tw-enhanced table {
        border-collapse: collapse;
        border-spacing: 0;
      }
      .tw-enhanced tbody tr,
      .tw-enhanced tbody tr:hover {
        transform: none !important;
        box-shadow: none !important;
        transition: background-color .18s ease;
      }
      .tw-enhanced .badge,
      .tw-enhanced [class*="rounded-full"],
      .tw-enhanced .chip,
      .tw-enhanced .status-pill,
      .tw-enhanced ::file-selector-button {
        box-shadow: none !important;
        text-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .tw-enhanced img,
      .tw-enhanced video,
      .tw-enhanced canvas {
        border-radius: inherit;
        filter: none !important;
      }
      .tw-enhanced ::selection {
        color: #f8fafc;
        background: rgba(37, 99, 235, .62);
      }
      .tw-enhanced * {
        scrollbar-width: thin;
        scrollbar-color: rgba(96, 165, 250, .7) rgba(15, 23, 42, .72);
      }
      .tw-enhanced ::-webkit-scrollbar {
        width: 9px;
        height: 9px;
      }
      .tw-enhanced ::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, .72);
        border-radius: 999px;
      }
      .tw-enhanced ::-webkit-scrollbar-thumb {
        background: #3b82f6;
        border-radius: 999px;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureGlowOrb = (body) => {
    let orb = document.getElementById('tw-glow-orb');
    if (!orb) {
      orb = document.createElement('div');
      orb.id = 'tw-glow-orb';
      orb.className = 'tw-glow-orb';
      orb.setAttribute('aria-hidden', 'true');
      body.prepend(orb);
    }
    return orb;
  };

  const markReady = () => {
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;
    root.dataset.tailwindUi = 'ready';
    body.classList.add('tw-enhanced');
    injectPolish();
    const glowOrb = ensureGlowOrb(body);

    const interactiveSelector = 'button, a.btn, .btn, a[class*="bg-"], [role="button"], input, select, textarea';
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

    let glowFrame = 0;
    document.addEventListener('pointermove', (event) => {
      if (glowFrame) cancelAnimationFrame(glowFrame);
      glowFrame = requestAnimationFrame(() => {
        const x = `${Math.round((event.clientX / Math.max(1, window.innerWidth)) * 100)}%`;
        const y = `${Math.round((event.clientY / Math.max(1, window.innerHeight)) * 100)}%`;
        body.style.setProperty('--tw-glow-x', x);
        body.style.setProperty('--tw-glow-y', y);
        glowOrb.style.setProperty('--tw-glow-x', x);
        glowOrb.style.setProperty('--tw-glow-y', y);
        glowFrame = 0;
      });
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
