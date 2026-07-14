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

  // Load small visual enhancements separately so the main converter HTML stays stable.
  if (!document.querySelector('script[data-ytconv-ui-enhancements]')) {
    const script = document.createElement('script');
    script.src = '/ui-enhancements.js?v=20260714';
    script.defer = true;
    script.dataset.ytconvUiEnhancements = 'true';
    document.head.appendChild(script);
  }
})();
