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
        box-shadow: 0 12px 28px rgba(2, 6, 23, .18);
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
        filter: brightness(1.08) saturate(1.08);
        box-shadow: 0 18px 38px rgba(2, 6, 23, .26), 0 0 0 1px rgba(255,255,255,.10) inset;
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
        box-shadow: 0 0 0 4px rgba(99, 102, 241, .18), 0 16px 32px rgba(2, 6, 23, .18);
      }
      .tw-enhanced .premium-panel,
      .tw-enhanced .premium-card,
      .tw-enhanced .ytconv-premium-surface {
        border-color: rgba(129, 140, 248, .26);
        box-shadow: 0 24px 70px rgba(2, 6, 23, .34);
      }
      .tw-enhanced {
        background-image:
          radial-gradient(circle at 12% 8%, rgba(59, 130, 246, .10), transparent 24rem),
          radial-gradient(circle at 88% 14%, rgba(20, 184, 166, .10), transparent 26rem);
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
        box-shadow: 0 18px 50px rgba(2, 6, 23, .18);
        backdrop-filter: blur(14px);
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
        box-shadow: 0 12px 28px rgba(2, 6, 23, .18);
      }
      .tw-enhanced .badge,
      .tw-enhanced [class*="rounded-full"],
      .tw-enhanced .chip,
      .tw-enhanced .status-pill {
        box-shadow: 0 10px 22px rgba(2, 6, 23, .16);
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
        box-shadow: 0 10px 24px rgba(2, 6, 23, .18);
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

  const markReady = () => {
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;
    root.dataset.tailwindUi = 'ready';
    body.classList.add('tw-enhanced');
    injectPolish();

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
