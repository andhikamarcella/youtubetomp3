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
        isolation: isolate;
        overflow: hidden;
        border-radius: 999px;
        font-weight: 800;
        letter-spacing: .01em;
        transform: translateZ(0);
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease, border-color .18s ease, background-color .18s ease;
        box-shadow: none;
      }
      .tw-enhanced button::before,
      .tw-enhanced a.btn::before,
      .tw-enhanced .btn::before,
      .tw-enhanced [role="button"]::before,
      .tw-enhanced a[class*="bg-"]::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background:
          radial-gradient(circle at var(--tw-press-x, 20%) var(--tw-press-y, 20%), rgba(255,255,255,.36), transparent 0 28%),
          linear-gradient(135deg, rgba(255,255,255,.18), transparent 45%, rgba(255,255,255,.08));
        opacity: .72;
        transition: opacity .18s ease;
      }
      .tw-enhanced button:hover,
      .tw-enhanced a.btn:hover,
      .tw-enhanced .btn:hover,
      .tw-enhanced [role="button"]:hover,
      .tw-enhanced a[class*="bg-"]:hover {
        transform: translateY(-2px);
        filter: none;
        box-shadow: none;
      }
      .tw-enhanced button:hover::before,
      .tw-enhanced a.btn:hover::before,
      .tw-enhanced .btn:hover::before,
      .tw-enhanced [role="button"]:hover::before,
      .tw-enhanced a[class*="bg-"]:hover::before {
        opacity: 1;
      }
      .tw-enhanced button:focus-visible,
      .tw-enhanced a.btn:focus-visible,
      .tw-enhanced .btn:focus-visible,
      .tw-enhanced [role="button"]:focus-visible,
      .tw-enhanced a[class*="bg-"]:focus-visible {
        outline: 3px solid rgba(125, 211, 252, .9);
        outline-offset: 3px;
      }
      .tw-enhanced button:disabled,
      .tw-enhanced .btn:disabled,
      .tw-enhanced [aria-disabled="true"] {
        cursor: not-allowed;
        filter: grayscale(.25);
        opacity: .62;
        transform: none;
        box-shadow: none;
      }
      .tw-enhanced input,
      .tw-enhanced select,
      .tw-enhanced textarea,
      .tw-enhanced .form-control,
      .tw-enhanced .form-select {
        transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
      }
      .tw-enhanced input:focus,
      .tw-enhanced select:focus,
      .tw-enhanced textarea:focus,
      .tw-enhanced .form-control:focus,
      .tw-enhanced .form-select:focus {
        box-shadow: none;
      }
      .tw-enhanced .premium-panel,
      .tw-enhanced .premium-card,
      .tw-enhanced .ytconv-premium-surface {
        border-color: rgba(129, 140, 248, .26);
        box-shadow: none;
      }
      .tw-enhanced {
        position: relative;
        isolation: isolate;
        font-family: Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        background-image: none;
      }
      .tw-glow-orb {
        position: fixed;
        left: var(--tw-glow-x, 50%);
        top: var(--tw-glow-y, 18%);
        width: min(58rem, 115vw);
        height: min(58rem, 115vw);
        z-index: 0;
        pointer-events: none;
        border-radius: 9999px;
        background: none;
        filter: none;
        opacity: 0;
        display: none;
        transform: translate3d(-50%, -50%, 0) scale(1);
        transition: opacity .25s ease, filter .25s ease;
        mix-blend-mode: screen;
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
        border-color: rgba(148, 163, 184, .20);
        box-shadow: none;
        backdrop-filter: none;
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease, filter .18s ease;
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
        border-color: rgba(125, 211, 252, .38);
        box-shadow: none;
        filter: none;
      }
      .tw-enhanced h1,
      .tw-enhanced h2,
      .tw-enhanced h3,
      .tw-enhanced h4,
      .tw-enhanced h5,
      .tw-enhanced h6 {
        letter-spacing: -.025em;
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
        border-collapse: separate;
        border-spacing: 0 .35rem;
      }
      .tw-enhanced tbody tr {
        transition: transform .16s ease, box-shadow .16s ease, background-color .16s ease;
      }
      .tw-enhanced tbody tr:hover {
        transform: translateY(-1px);
        box-shadow: none;
      }
      .tw-enhanced .badge,
      .tw-enhanced [class*="rounded-full"],
      .tw-enhanced .chip,
      .tw-enhanced .status-pill {
        box-shadow: none;
      }
      .tw-enhanced img,
      .tw-enhanced video,
      .tw-enhanced canvas {
        border-radius: inherit;
      }
      .tw-enhanced ::file-selector-button {
        border: 0;
        border-radius: 999px;
        font-weight: 800;
        box-shadow: none;
      }
      .tw-enhanced ::selection {
        color: #f8fafc;
        background: rgba(99, 102, 241, .62);
      }
      .tw-enhanced * {
        scrollbar-width: thin;
        scrollbar-color: rgba(99, 102, 241, .72) rgba(15, 23, 42, .72);
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
        background: linear-gradient(180deg, rgba(99, 102, 241, .9), rgba(6, 182, 212, .75));
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
