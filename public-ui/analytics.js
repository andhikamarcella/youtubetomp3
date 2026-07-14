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

  const loadChatInteraction = () => {
    if (document.querySelector('script[data-ytconv-chat-interaction]')) return;
    const interaction = document.createElement('script');
    interaction.src = '/chat-interaction-v6.js?v=20260714-6';
    interaction.async = false;
    interaction.dataset.ytconvChatInteraction = 'v6';
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
    realism.src = '/chat-realism-v5.js?v=20260714-6';
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
    chat.src = '/chat-layout-v4.js?v=20260714-6';
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
    script.src = '/ui-enhancements.js?v=20260714-6';
    script.async = false;
    script.dataset.ytconvUiEnhancements = 'true';
    script.addEventListener('load', loadChatLayout, { once: true });
    document.head.appendChild(script);
  }
})();