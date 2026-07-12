(() => {
  const MOBILE_MAX_WIDTH = 991.98;
  const FORUM_MODAL_Z = '2147483200';
  const FORUM_BACKDROP_Z = '2147482000';
  const TAP_MOVE_TOLERANCE_PX = 18;

  if (window.__ytconvForumInteractionEmergencyV1) return;
  window.__ytconvForumInteractionEmergencyV1 = true;

  const isMobile = () => window.innerWidth <= MOBILE_MAX_WIDTH;
  const isCommunityRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return path.startsWith('/community') || hash.includes('community');
  };

  const forumModal = () => document.getElementById('forumModal');
  const loginButtons = () => Array.from(document.querySelectorAll('#googleSignInBtn, #forumGoogleLoginBtn'));

  const isVisible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
  };

  const eventPoint = (event) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    return {
      x: Number(touch?.clientX ?? event.clientX),
      y: Number(touch?.clientY ?? event.clientY),
    };
  };

  const pointInside = (element, x, y) => {
    if (!element || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const buttonAtPoint = (x, y) => loginButtons().find((button) => isVisible(button) && pointInside(button, x, y)) || null;

  const injectStyle = () => {
    if (document.getElementById('ytconv-forum-interaction-emergency-style')) return;
    const style = document.createElement('style');
    style.id = 'ytconv-forum-interaction-emergency-style';
    style.textContent = `
      @media (max-width: ${MOBILE_MAX_WIDTH}px) {
        body > #forumModal,
        body > #forumModal.show,
        body > #forumModal[aria-modal="true"] {
          position: fixed !important;
          inset: 0 !important;
          z-index: ${FORUM_MODAL_Z} !important;
          pointer-events: auto !important;
          visibility: visible !important;
          opacity: 1 !important;
          transform: none !important;
          filter: none !important;
          contain: none !important;
          isolation: isolate !important;
        }

        body > #forumModal .modal-dialog,
        body > #forumModal .modal-content,
        body > #forumModal .modal-body,
        body > #forumModal .forum-login-card,
        body > #forumModal #googleSignInBtn,
        body > #forumModal #forumGoogleLoginBtn {
          position: relative !important;
          pointer-events: auto !important;
          visibility: visible !important;
          opacity: 1 !important;
          filter: none !important;
        }

        body > #forumModal #googleSignInBtn,
        body > #forumModal #forumGoogleLoginBtn {
          z-index: 20 !important;
          touch-action: manipulation !important;
          -webkit-tap-highlight-color: transparent;
        }

        body:has(> #forumModal.show) > .modal-backdrop,
        body:has(> #forumModal[aria-modal="true"]) > .modal-backdrop {
          z-index: ${FORUM_BACKDROP_Z} !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const portalForumModal = () => {
    const body = document.body;
    const modal = forumModal();
    if (!body || !modal) return null;

    injectStyle();

    if (modal.parentElement !== body) body.appendChild(modal);
    modal.dataset.forumModalPortal = 'body';
    modal.style.setProperty('z-index', FORUM_MODAL_Z, 'important');
    modal.style.setProperty('pointer-events', 'auto', 'important');

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.style.setProperty('z-index', FORUM_BACKDROP_Z, 'important');
    });

    return modal;
  };

  const neutralizeBlockersOverButton = (button) => {
    if (!button || !isVisible(button)) return;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const stack = document.elementsFromPoint?.(x, y) || [];

    for (const element of stack) {
      if (element === button || button.contains(element) || element.contains(button)) break;
      const signature = `${element.id || ''} ${element.className || ''}`;
      if (!/(backdrop|overlay|scrim|mask|blocker|loading)/i.test(signature)) continue;
      if (element.closest('#forumModal') && !element.classList.contains('modal-backdrop')) continue;
      element.style.setProperty('pointer-events', 'none', 'important');
      element.dataset.forumPointerBlockerDisabled = 'true';
    }
  };

  const ensureForumInteractive = () => {
    if (!isMobile()) return;
    const modal = forumModal();
    if (!modal && !isCommunityRoute()) return;

    portalForumModal();

    loginButtons().forEach((button) => {
      button.style.setProperty('pointer-events', 'auto', 'important');
      button.style.setProperty('touch-action', 'manipulation', 'important');
      button.style.setProperty('opacity', '1', 'important');
      button.removeAttribute('aria-disabled');
      neutralizeBlockersOverButton(button);
    });
  };

  let gesture = null;
  let forwardingClick = false;
  let lastForwardedAt = 0;

  const beginTap = (event) => {
    if (!isMobile()) return;
    ensureForumInteractive();
    const { x, y } = eventPoint(event);
    const button = buttonAtPoint(x, y);
    if (!button) {
      gesture = null;
      return;
    }
    gesture = {
      button,
      pointerId: event.pointerId ?? 'touch',
      startX: x,
      startY: y,
    };
  };

  const finishTap = (event) => {
    if (!gesture || !isMobile()) return;
    if (event.pointerId != null && gesture.pointerId !== event.pointerId) return;

    const current = gesture;
    gesture = null;
    const { x, y } = eventPoint(event);
    const distance = Math.hypot(x - current.startX, y - current.startY);
    const endingButton = buttonAtPoint(x, y);
    if (endingButton !== current.button || distance > TAP_MOVE_TOLERANCE_PX) return;

    ensureForumInteractive();

    const directTarget = event.target?.closest?.('#googleSignInBtn, #forumGoogleLoginBtn');
    if (directTarget === current.button) return;

    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    if (Date.now() - lastForwardedAt < 900) return;
    lastForwardedAt = Date.now();
    forwardingClick = true;
    current.button.click();
    queueMicrotask(() => { forwardingClick = false; });
  };

  const captureBlockedClick = (event) => {
    if (!isMobile() || forwardingClick) return;
    const { x, y } = eventPoint(event);
    const button = buttonAtPoint(x, y);
    if (!button) return;
    if (event.target?.closest?.('#googleSignInBtn, #forumGoogleLoginBtn') === button) return;

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    ensureForumInteractive();

    forwardingClick = true;
    button.click();
    queueMicrotask(() => { forwardingClick = false; });
  };

  const cancelTap = () => { gesture = null; };

  if ('PointerEvent' in window) {
    window.addEventListener('pointerdown', beginTap, true);
    window.addEventListener('pointerup', finishTap, true);
    window.addEventListener('pointercancel', cancelTap, true);
  } else {
    window.addEventListener('touchstart', beginTap, { capture: true, passive: true });
    window.addEventListener('touchend', finishTap, { capture: true, passive: false });
    window.addEventListener('touchcancel', cancelTap, true);
  }
  window.addEventListener('click', captureBlockedClick, true);

  const boot = () => {
    ensureForumInteractive();

    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(ensureForumInteractive, 60);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'disabled', 'aria-hidden', 'aria-modal', 'aria-disabled'],
    });

    window.addEventListener('pageshow', schedule);
    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);
    window.addEventListener('resize', schedule, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
