(() => {
  const config = window.YTCONV_ANALYTICS || {};
  const enabled = Boolean(config.enabled && config.endpoint);
  const allowedEvents = new Set([
    'page_view', 'convert_started', 'convert_completed', 'convert_failed',
    'format_selected', 'quality_selected', 'ticket_created', 'ai_opened',
    'advanced_opened', 'status_viewed'
  ]);
  const scrub = (value) => {
    if (!value || typeof value !== 'object') return {};
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (/url|email|name|token|cookie|secret|message|password/i.test(key)) continue;
      if (['string', 'number', 'boolean'].includes(typeof raw)) out[key] = raw;
    }
    return out;
  };
  window.trackYtconvEvent = (event, props = {}) => {
    if (!allowedEvents.has(event)) return;
    const payload = { event, props: scrub(props), at: new Date().toISOString(), path: location.pathname };
    window.dispatchEvent(new CustomEvent('ytconv:analytics', { detail: payload }));
    if (!enabled) return;
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) navigator.sendBeacon(config.endpoint, new Blob([body], { type: 'application/json' }));
      else fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch {}
  };
  window.trackYtconvEvent('page_view');

  const loadSecondaryRouteUi = () => {
    if (document.querySelector('script[data-ytconv-secondary-route-ui]')) return;
    const routeUi = document.createElement('script');
    routeUi.src = '/secondary-route-ui-v11.js?v=20260714-11';
    routeUi.async = false;
    routeUi.dataset.ytconvSecondaryRouteUi = 'v11';
    document.head.appendChild(routeUi);
  };

  const loadVisualFix = () => {
    const existingFix = document.querySelector('script[data-ytconv-visual-fix]');
    if (existingFix) {
      if (document.documentElement.dataset.ytconvVisualFix) loadSecondaryRouteUi();
      else existingFix.addEventListener('load', loadSecondaryRouteUi, { once: true });
      return;
    }
    const fix = document.createElement('script');
    fix.src = '/theme-mobile-fix-v9.js?v=20260714-11';
    fix.async = false;
    fix.dataset.ytconvVisualFix = 'v9';
    fix.addEventListener('load', loadSecondaryRouteUi, { once: true });
    document.head.appendChild(fix);
  };

  const loadResponsivePolish = () => {
    const existingPolish = document.querySelector('script[data-ytconv-responsive-polish]');
    if (existingPolish) {
      if (document.documentElement.dataset.ytconvResponsivePolish) loadVisualFix();
      else existingPolish.addEventListener('load', loadVisualFix, { once: true });
      return;
    }
    const polish = document.createElement('script');
    polish.src = '/responsive-polish-v8.js?v=20260714-11';
    polish.async = false;
    polish.dataset.ytconvResponsivePolish = 'v8';
    polish.addEventListener('load', loadVisualFix, { once: true });
    document.head.appendChild(polish);
  };

  const loadChatRuntime = () => {
    const existingRuntime = document.querySelector('script[data-ytconv-chat-runtime]');
    if (existingRuntime) {
      if (document.documentElement.dataset.ytconvChatRuntime) loadResponsivePolish();
      else existingRuntime.addEventListener('load', loadResponsivePolish, { once: true });
      return;
    }
    const runtime = document.createElement('script');
    runtime.src = '/chat-runtime-v7.js?v=20260714-11';
    runtime.async = false;
    runtime.dataset.ytconvChatRuntime = 'v7';
    runtime.addEventListener('load', loadResponsivePolish, { once: true });
    document.head.appendChild(runtime);
  };

  const loadChatInteraction = () => {
    const existingInteraction = document.querySelector('script[data-ytconv-chat-interaction]');
    if (existingInteraction) {
      if (document.documentElement.dataset.ytconvChatInteraction) loadChatRuntime();
      else existingInteraction.addEventListener('load', loadChatRuntime, { once: true });
      return;
    }
    const interaction = document.createElement('script');
    interaction.src = '/chat-interaction-v6.js?v=20260714-11';
    interaction.async = false;
    interaction.dataset.ytconvChatInteraction = 'v6';
    interaction.addEventListener('load', loadChatRuntime, { once: true });
    document.head.appendChild(interaction);
  };

  const loadRealisticChat = () => {
    const existingRealism = document.querySelector('script[data-ytconv-chat-realism]');
    if (existingRealism) {
      if (document.documentElement.dataset.ytconvChatRealism) loadChatInteraction();
      else existingRealism.addEventListener('load', loadChatInteraction, { once: true });
      return;
    }
    const realism = document.createElement('script');
    realism.src = '/chat-realism-v5.js?v=20260714-11';
    realism.async = false;
    realism.dataset.ytconvChatRealism = 'v5';
    realism.addEventListener('load', loadChatInteraction, { once: true });
    document.head.appendChild(realism);
  };

  const loadChatLayout = () => {
    const existingChat = document.querySelector('script[data-ytconv-chat-layout]');
    if (existingChat) {
      if (document.documentElement.dataset.ytconvChatLayout) loadRealisticChat();
      else existingChat.addEventListener('load', loadRealisticChat, { once: true });
      return;
    }
    const chat = document.createElement('script');
    chat.src = '/chat-layout-v4.js?v=20260714-11';
    chat.async = false;
    chat.dataset.ytconvChatLayout = 'v4';
    chat.addEventListener('load', loadRealisticChat, { once: true });
    document.head.appendChild(chat);
  };

  const existingEnhancement = document.querySelector('script[data-ytconv-ui-enhancements]');
  if (existingEnhancement) {
    if (document.documentElement.dataset.ytconvUiEnhancements) loadChatLayout();
    else existingEnhancement.addEventListener('load', loadChatLayout, { once: true });
  } else {
    const script = document.createElement('script');
    script.src = '/ui-enhancements.js?v=20260714-11';
    script.async = false;
    script.dataset.ytconvUiEnhancements = 'true';
    script.addEventListener('load', loadChatLayout, { once: true });
    document.head.appendChild(script);
  }
})();