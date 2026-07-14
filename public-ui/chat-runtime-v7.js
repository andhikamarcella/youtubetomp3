(() => {
  'use strict';

  const DESKTOP = 991.98;
  const TURNSTILE_WAIT = 15000;
  const STALL_WARN = 30000;
  const STALL_LIMIT = 100000;
  const SECONDARY_ROUTES = ['studio', 'rewards', 'faq', 'community', 'profile', 'about'];
  const $ = (selector, root = document) => root.querySelector(selector);

  let pending = null;
  let active = null;
  let lastActivity = 0;
  let warnTimer = 0;
  let timeoutTimer = 0;
  let widgetId = null;
  let turnstileTimer = 0;
  let observerInstalled = false;

  const nativeValue = (element, value) => {
    if (!element) return;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    setter ? setter.call(element, value) : (element.value = value);
  };

  const resize = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  };

  const isUrl = (value) => {
    const text = String(value || '').trim();
    return /^(https?:\/\/|www\.)/i.test(text)
      || /(youtu\.be|youtube\.com|music\.youtube\.com|open\.spotify\.com|soundcloud\.com)\//i.test(text);
  };

  const isConverterRoute = () => {
    if (document.body.classList.contains('ytclean-route-converter')) return true;
    if (SECONDARY_ROUTES.some((route) => document.body.classList.contains(`ytclean-route-${route}`))) return false;
    const path = location.pathname.toLowerCase();
    return !SECONDARY_ROUTES.some((route) => path === `/${route}` || path.startsWith(`/${route}/`));
  };

  const dock = () => $('#ycrSecurityDock');
  const token = () => dock()?.dataset.token || $('input[name="cf-turnstile-response"]')?.value?.trim() || '';

  function styles() {
    let tag = $('#ytconv-chat-runtime-v7');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'ytconv-chat-runtime-v7';
      document.head.appendChild(tag);
    }

    tag.textContent = `
      body.ytconv-chat-v7 #ycrPromptInput,
      body.ytconv-chat-v7 .yc-composer #convertBtn {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        min-width: 1px !important;
        min-height: 1px !important;
        margin: -1px !important;
        padding: 0 !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      body.ytconv-chat-v7 .yc-composer .input-group {
        grid-template-columns: 40px minmax(0,1fr) 38px 38px 42px !important;
      }

      body.ytconv-runtime-secondary .yc-composer,
      body.ytconv-runtime-secondary #ycOptions,
      body.ytconv-runtime-secondary #ycrSecurityDock,
      body.ytconv-runtime-secondary #ycConversation,
      body.ytconv-runtime-secondary #ycWelcome {
        display: none !important;
      }

      .ycr-prompt-v7 {
        grid-column: 2;
        width: 100%;
        min-width: 0;
        min-height: 44px;
        max-height: 160px;
        padding: 10px 5px 8px;
        resize: none;
        overflow-y: auto;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ycr-text, #ececec);
        font: inherit;
        font-size: 15px;
        line-height: 1.45;
        caret-color: currentColor;
      }

      .ycr-prompt-v7::placeholder { color: #b4b4b4; }
      .ycr-prompt-v7:focus { outline: 0; box-shadow: none; }

      .ycr-send-v7 {
        grid-column: 5;
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: #f4f4f4;
        color: #202020;
        box-shadow: none;
        transition: .14s;
      }

      .ycr-send-v7:not(:disabled):hover { transform: scale(1.04); background: #fff; }
      .ycr-send-v7:disabled { background: #666; color: #aaa; cursor: default; }
      .ycr-send-v7.busy i { animation: ycrSpin .8s linear infinite; }
      @keyframes ycrSpin { to { transform: rotate(360deg); } }

      #ycrSecurityDock {
        position: fixed;
        left: calc(var(--ycr-side-width,260px) + ((100vw - var(--ycr-side-width,260px))/2));
        bottom: 112px;
        z-index: 2147482500;
        width: min(360px,calc(100vw - var(--ycr-side-width,260px) - 32px));
        padding: 12px;
        border: 1px solid var(--ycr-border,rgba(255,255,255,.1));
        border-radius: 16px;
        background: var(--ycr-panel-deep,#262626);
        box-shadow: 0 18px 60px rgba(0,0,0,.38);
        transform: translateX(-50%);
      }

      #ycrSecurityDock[hidden],
      #ycrSecurityDock:not(.is-open),
      body.ycr-options-open #ycrSecurityDock,
      #ycrSecurityDock.verified { display: none !important; }

      body.ytclean-collapsed #ycrSecurityDock {
        left: calc(var(--ycr-rail-width,72px) + ((100vw - var(--ycr-rail-width,72px))/2));
      }

      .ycr-security-head { display:flex; align-items:center; gap:9px; margin-bottom:10px; color:var(--ycr-text,#ececec); font-size:13px; font-weight:600; }
      .ycr-security-head i { color:#f59e0b; }
      .ycr-security-copy { margin-left:auto; color:var(--ycr-muted,#aaa); font-size:11px; font-weight:400; }
      .ycr-turnstile-host { min-height:65px; display:grid; place-items:center; overflow:hidden; border-radius:10px; }
      .ycr-security-error { margin-top:8px; color:#fca5a5; font-size:12px; }
      .ycr-security-retry { margin-left:7px; border:0; background:transparent; color:#fff; text-decoration:underline; }
      .ycr-security-badge { display:inline-flex; align-items:center; gap:5px; color:var(--ycr-muted,#aaa); white-space:nowrap; }
      .ycr-security-badge i { color:#10a37f; }
      .ycr-runtime-error { margin:10px 0 0; padding:12px 14px; border:1px solid rgba(239,68,68,.32); border-radius:12px; background:rgba(127,29,29,.18); color:#fecaca; font-size:13px; line-height:1.5; }
      .ycr-runtime-error button { margin-top:9px; padding:6px 10px; border:1px solid rgba(255,255,255,.16); border-radius:8px; background:transparent; color:inherit; }

      [data-bs-theme='light'] #ycrSecurityDock { background:#fff; color:#202123; }
      [data-bs-theme='light'] .ycr-runtime-error { background:#fff1f2; color:#991b1b; }

      @media(max-width:${DESKTOP}px) {
        #ycrSecurityDock,
        body.ytclean-collapsed #ycrSecurityDock { left:50%; bottom:105px; width:min(360px,calc(100vw - 24px)); }
      }

      @media(max-width:620px) {
        body.ytconv-chat-v7 .yc-composer .input-group { grid-template-columns:38px minmax(0,1fr) 36px 40px !important; }
        body.ytconv-chat-v7 .yc-composer #sampleBtn { display:none !important; }
        .ycr-send-v7 { grid-column:4; width:36px; height:36px; }
        #ycrSecurityDock { bottom:94px; }
      }
    `;
  }

  function syncOriginal(value) {
    const original = $('#url');
    const legacy = $('#ycrPromptInput');
    nativeValue(original, value);
    original?.dispatchEvent(new Event('input', { bubbles: true }));
    original?.dispatchEvent(new Event('change', { bubbles: true }));
    if (legacy) legacy.value = value;
  }

  function mode(value) {
    const element = $('.ycr-input-mode');
    if (!element) return;
    const url = isUrl(value);
    element.innerHTML = `<i class="bi ${url ? 'bi-link-45deg' : 'bi-search'}"></i><span>${url ? 'Link' : 'Judul'}</span>`;
  }

  function ensureComposer() {
    if (!isConverterRoute()) return;
    const group = $('#url')?.closest('.input-group');
    const nativeSend = $('#convertBtn');
    if (!group || !nativeSend) return;

    document.body.classList.add('ytconv-chat-v7');

    let prompt = $('#ycrPromptInputV7');
    if (!prompt) {
      prompt = document.createElement('textarea');
      prompt.id = 'ycrPromptInputV7';
      prompt.className = 'ycr-prompt-v7';
      prompt.rows = 1;
      prompt.autocomplete = 'off';
      prompt.spellcheck = true;
      prompt.placeholder = 'Tempel link atau ketik judul lagu…';
      prompt.setAttribute('aria-label', 'Link atau judul lagu yang ingin dikonversi');
      ($('#ycrPromptInput') || $('#url')).insertAdjacentElement('afterend', prompt);
    }

    let send = $('#ycrSendV7');
    if (!send) {
      send = document.createElement('button');
      send.id = 'ycrSendV7';
      send.className = 'ycr-send-v7';
      send.type = 'button';
      send.title = 'Kirim';
      send.setAttribute('aria-label', 'Kirim dan mulai konversi');
      send.innerHTML = '<i class="bi bi-arrow-up"></i>';
      group.appendChild(send);
    }

    const sync = () => {
      syncOriginal(prompt.value);
      resize(prompt);
      mode(prompt.value);
      send.disabled = !prompt.value.trim() || Boolean(active);
    };

    if (!prompt.dataset.v7) {
      prompt.dataset.v7 = '1';
      prompt.addEventListener('input', sync);
      prompt.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          request(prompt.value);
        }
      });
    }

    if (!send.dataset.v7) {
      send.dataset.v7 = '1';
      send.addEventListener('click', () => request(prompt.value));
    }

    ['pasteBtn', 'sampleBtn'].forEach((id) => {
      const button = document.getElementById(id);
      if (!button || button.dataset.v7) return;
      button.dataset.v7 = '1';
      button.addEventListener('click', () => {
        window.setTimeout(() => {
          prompt.value = $('#url')?.value || '';
          resize(prompt);
          mode(prompt.value);
          send.disabled = !prompt.value.trim() || Boolean(active);
          prompt.focus();
        }, 100);
      });
    });

    if (!prompt.value && $('#url')?.value) prompt.value = $('#url').value;
    resize(prompt);
    mode(prompt.value);
    send.disabled = !prompt.value.trim() || Boolean(active);
  }

  function securityState(state, message = '') {
    const securityDock = dock();
    if (!securityDock) return;

    securityDock.dataset.state = state;
    securityDock.classList.toggle('verified', state === 'verified');
    $('.ycr-security-copy', securityDock).textContent = state === 'verified'
      ? 'Terverifikasi'
      : state === 'loading'
        ? 'Memuat…'
        : 'Cloudflare';

    const errorElement = $('.ycr-security-error', securityDock);
    if (errorElement) {
      errorElement.hidden = !message;
      const messageElement = $('span', errorElement);
      if (messageElement) messageElement.textContent = message;
    }

    const badge = $('#ycrSecurityBadge');
    if (badge) {
      badge.hidden = state !== 'verified';
      badge.innerHTML = '<i class="bi bi-shield-check"></i><span>Cloudflare terverifikasi</span>';
    }

    if (state === 'verified') {
      securityDock.classList.remove('is-open');
      securityDock.hidden = true;
    }
  }

  function resume() {
    if (!pending || !token()) return;
    const job = pending;
    pending = null;
    securityState('verified');
    submit(job.raw, job.url);
  }

  function ensureSecurity() {
    let original = $('#turnstile-container');
    const sitekey = original?.dataset.sitekey || '0x4AAAAAACJPcwOvzNFeWXfR';
    let securityDock = dock();

    if (!securityDock) {
      securityDock = document.createElement('section');
      securityDock.id = 'ycrSecurityDock';
      securityDock.hidden = true;
      securityDock.setAttribute('aria-label', 'Verifikasi keamanan Cloudflare');
      securityDock.innerHTML = `
        <div class="ycr-security-head">
          <i class="bi bi-shield-lock"></i>
          <span>Verifikasi keamanan</span>
          <span class="ycr-security-copy">Cloudflare</span>
        </div>
        <div class="ycr-turnstile-host" id="ycrTurnstileHost"></div>
        <div class="ycr-security-error" hidden>
          <span></span>
          <button class="ycr-security-retry" type="button">Coba lagi</button>
        </div>
      `;
      document.body.appendChild(securityDock);
    }

    if (!$('#turnstile-container', securityDock)) {
      const wrapper = original?.closest('.d-grid');
      original?.remove();
      if (wrapper && wrapper !== securityDock && !wrapper.children.length) wrapper.remove();

      original = document.createElement('div');
      original.id = 'turnstile-container';
      original.className = 'cf-turnstile';
      original.dataset.sitekey = sitekey;
      original.dataset.theme = document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
      original.dataset.appearance = 'always';
      $('#ycrTurnstileHost', securityDock).appendChild(original);
      widgetId = null;
    }

    const retry = $('.ycr-security-retry', securityDock);
    if (retry && !retry.dataset.v7) {
      retry.dataset.v7 = '1';
      retry.addEventListener('click', renderTurnstile);
    }

    const footer = $('.yc-composer-footer');
    if (footer && !$('#ycrSecurityBadge')) {
      const badge = document.createElement('span');
      badge.id = 'ycrSecurityBadge';
      badge.className = 'ycr-security-badge';
      badge.hidden = true;
      footer.appendChild(badge);
    }

    return securityDock;
  }

  function renderTurnstile() {
    if (!isConverterRoute()) return;
    const securityDock = ensureSecurity();
    const host = $('#turnstile-container');
    if (!securityDock || !host) return;

    securityDock.hidden = false;
    securityDock.classList.add('is-open');
    securityDock.classList.remove('verified');

    const sitekey = host.dataset.sitekey;
    if (!sitekey) return securityState('error', 'Konfigurasi Cloudflare tidak ditemukan.');

    if (!window.turnstile?.render) {
      securityState('loading');
      const started = Date.now();
      clearInterval(turnstileTimer);
      turnstileTimer = setInterval(() => {
        if (window.turnstile?.render) {
          clearInterval(turnstileTimer);
          renderTurnstile();
        } else if (Date.now() - started > TURNSTILE_WAIT) {
          clearInterval(turnstileTimer);
          securityState('error', 'Cloudflare gagal dimuat. Periksa koneksi lalu coba lagi.');
        }
      }, 250);
      return;
    }

    try {
      if (widgetId !== null && window.turnstile.remove) {
        try { window.turnstile.remove(widgetId); } catch {}
      }

      host.replaceChildren();
      delete securityDock.dataset.token;
      securityState('ready');
      securityDock.hidden = false;
      securityDock.classList.add('is-open');

      widgetId = window.turnstile.render(host, {
        sitekey,
        theme: document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark',
        appearance: 'always',
        callback: (value) => {
          securityDock.dataset.token = value || '';
          securityState('verified');
          resume();
        },
        'expired-callback': () => {
          delete securityDock.dataset.token;
          securityState('ready');
          securityDock.hidden = false;
          securityDock.classList.add('is-open');
        },
        'error-callback': () => {
          delete securityDock.dataset.token;
          securityState('error', 'Verifikasi Cloudflare gagal. Coba lagi.');
        },
      });
    } catch (errorValue) {
      console.error('[ytconv] turnstile', errorValue);
      securityState('error', 'Widget Cloudflare tidak dapat ditampilkan.');
    }
  }

  function userMessage(raw, url) {
    const user = $('#ycUser');
    const content = $('#ycUser .yc-content');
    const conversation = $('#ycConversation');
    if (!user || !content || !conversation) return;

    content.textContent = '';
    const source = document.createElement('div');
    source.className = 'ycr-source-row';
    source.innerHTML = `<i class="bi ${url ? 'bi-link-45deg' : 'bi-search'}"></i><span>${url ? 'Tautan media' : 'Pencarian lagu'}</span>`;
    const text = document.createElement('div');
    text.className = 'ycr-prompt-text';
    text.textContent = raw;
    content.append(source, text);
    user.hidden = false;
    conversation.hidden = false;
    $('#ycWelcome')?.classList.add('compact');
  }

  function pendingMessage(message) {
    const assistant = $('#ycAssistant');
    const conversation = $('#ycConversation');
    const element = $('#ycPending');
    if (assistant) assistant.hidden = false;
    if (conversation) {
      conversation.hidden = false;
      conversation.dataset.waiting = '1';
    }
    if (element) {
      element.hidden = false;
      element.innerHTML = '<span class="ycr-thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span><span></span>';
      element.lastElementChild.textContent = message;
    }
  }

  const clearError = () => $('.ycr-runtime-error')?.remove();

  function showError(message, remembered = active?.raw || $('#url')?.value || '') {
    active = null;
    pending = null;
    clearTimeout(warnTimer);
    clearTimeout(timeoutTimer);
    const pendingElement = $('#ycPending');
    if (pendingElement) pendingElement.hidden = true;
    clearError();

    const content = $('#ycAssistant .yc-content');
    if (content) {
      const box = document.createElement('div');
      box.className = 'ycr-runtime-error';
      box.innerHTML = '<div></div><button type="button">Coba lagi</button>';
      $('div', box).textContent = message;
      $('button', box).addEventListener('click', () => {
        box.remove();
        const raw = $('#ycrPromptInputV7')?.value.trim() || remembered;
        raw ? request(raw) : $('#ycrPromptInputV7')?.focus();
      });
      content.appendChild(box);
    }

    const send = $('#ycrSendV7');
    if (send) {
      send.classList.remove('busy');
      send.innerHTML = '<i class="bi bi-arrow-up"></i>';
      send.disabled = !$('#ycrPromptInputV7')?.value.trim();
    }

    if ($('#ycrMessageState')) $('#ycrMessageState').textContent = 'Gagal';
  }

  function resetSecurity(delay = 0) {
    const securityDock = dock();
    if (securityDock) {
      securityDock.hidden = true;
      securityDock.classList.remove('is-open');
    }
    if (widgetId === null || !window.turnstile?.reset) return;

    setTimeout(() => {
      try { window.turnstile.reset(widgetId); } catch {}
      if (securityDock) delete securityDock.dataset.token;
      securityState('ready');
      if (securityDock) securityDock.hidden = true;
    }, delay);
  }

  function finish(ok) {
    const job = active;
    active = null;
    clearTimeout(warnTimer);
    clearTimeout(timeoutTimer);

    const send = $('#ycrSendV7');
    if (send) {
      send.classList.remove('busy');
      send.innerHTML = '<i class="bi bi-arrow-up"></i>';
      send.disabled = !$('#ycrPromptInputV7')?.value.trim();
    }

    if (ok) {
      nativeValue($('#url'), '');
      $('#url')?.dispatchEvent(new Event('input', { bubbles: true }));
    }

    resetSecurity(ok ? 1200 : 0);
    return job;
  }

  function watchdog() {
    lastActivity = Date.now();
    clearTimeout(warnTimer);
    clearTimeout(timeoutTimer);

    warnTimer = setTimeout(() => {
      if (active) pendingMessage('Server masih menyiapkan media. Tunggu sebentar…');
    }, STALL_WARN);

    timeoutTimer = setTimeout(() => {
      if (!active) return;
      if (Date.now() - lastActivity < STALL_LIMIT - 5000) return watchdog();
      const raw = active.raw;
      finish(false);
      const prompt = $('#ycrPromptInputV7');
      if (prompt && !prompt.value) {
        prompt.value = raw;
        resize(prompt);
      }
      showError('Proses tidak memberi respons terlalu lama. Coba kirim ulang.', raw);
    }, STALL_LIMIT);
  }

  function submit(raw, url) {
    if (!raw || active || !isConverterRoute()) return;
    active = { raw, url };
    clearError();
    syncOriginal(raw);
    userMessage(raw, url);
    pendingMessage('Menyiapkan media dan opsi terbaik…');

    const send = $('#ycrSendV7');
    if (send) {
      send.disabled = true;
      send.classList.add('busy');
      send.innerHTML = '<i class="bi bi-arrow-repeat"></i>';
    }

    watchdog();

    if (url) {
      const nativeSend = $('#convertBtn');
      if (!nativeSend) return showError('Tombol konversi tidak ditemukan. Muat ulang halaman.', raw);
      nativeSend.disabled = false;
      nativeSend.dataset.ycrPrompt = raw;
      nativeSend.dataset.ycrV6PassThrough = 'true';
      nativeSend.click();
      setTimeout(() => userMessage(raw, true), 0);
    } else {
      const keyword = $('#keywordInput');
      const target = $('#keywordConvertBtn') || $('#keywordSearchBtn');
      if (!keyword || !target) {
        finish(false);
        return showError('Fitur pencarian judul belum siap. Gunakan tautan media.', raw);
      }
      nativeValue(keyword, raw);
      keyword.dispatchEvent(new Event('input', { bubbles: true }));
      keyword.dispatchEvent(new Event('change', { bubbles: true }));
      target.click();
    }

    const prompt = $('#ycrPromptInputV7');
    if (prompt) {
      prompt.value = '';
      resize(prompt);
      mode('');
    }
  }

  function request(value) {
    const raw = String(value || '').trim();
    if (!raw || active || !isConverterRoute()) return;

    const url = isUrl(raw);
    const configured = Boolean($('#turnstile-container')?.dataset.sitekey || dock()?.querySelector('#turnstile-container')?.dataset.sitekey);

    if (configured && !token()) {
      pending = { raw, url };
      userMessage(raw, url);
      pendingMessage('Selesaikan verifikasi keamanan untuk melanjutkan…');
      renderTurnstile();

      const started = Date.now();
      const poll = setInterval(() => {
        if (!pending) return clearInterval(poll);
        if (token()) {
          clearInterval(poll);
          resume();
        } else if (Date.now() - started > 120000) {
          clearInterval(poll);
          pending = null;
          resetSecurity();
          showError('Verifikasi keamanan kedaluwarsa. Silakan coba lagi.', raw);
        }
      }, 300);
      return;
    }

    submit(raw, url);
  }

  function observeConversion() {
    if (observerInstalled) return;
    observerInstalled = true;

    const nodes = ['statusWrap', 'convertProgWrap', 'previewWrap', 'searchResultsWrap', 'resultWrap']
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const refresh = () => {
      lastActivity = Date.now();
      if (!active) return;
      const result = $('#resultWrap');
      const status = $('#status')?.textContent?.trim() || '';

      if (result && !result.hidden) return finish(true);
      if (/gagal|error|failed|invalid|tidak dapat|ditolak|kedaluwarsa/i.test(status)) {
        const raw = active.raw;
        finish(false);
        const prompt = $('#ycrPromptInputV7');
        if (prompt && !prompt.value) {
          prompt.value = raw;
          resize(prompt);
        }
        showError(status || 'Konversi gagal. Coba lagi.', raw);
      }
    };

    const observer = new MutationObserver(refresh);
    nodes.forEach((node) => observer.observe(node, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['hidden', 'style', 'class'],
    }));
    if ($('#status')) observer.observe($('#status'), { childList: true, subtree: true });
  }

  function syncRouteState() {
    const converter = isConverterRoute();
    document.body.classList.toggle('ytconv-runtime-secondary', !converter);

    if (!converter) {
      const securityDock = dock();
      if (securityDock) {
        securityDock.hidden = true;
        securityDock.classList.remove('is-open');
      }
      pending = null;
      return;
    }

    ensureComposer();
  }

  function apply() {
    styles();
    syncRouteState();
    observeConversion();
    document.documentElement.dataset.ytconvChatRuntime = 'v7';
  }

  const ready = () => {
    apply();
    addEventListener('pageshow', apply, { passive: true });
    addEventListener('popstate', () => setTimeout(apply, 0), { passive: true });
    addEventListener('hashchange', () => setTimeout(apply, 0), { passive: true });
    setTimeout(apply, 600);
    setTimeout(apply, 1700);

    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        syncRouteState();
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ready, { once: true })
    : ready();
})();