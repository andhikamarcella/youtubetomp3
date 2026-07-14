(() => {
  'use strict';

  const DESKTOP = 991.98;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let syncingPrompt = false;

  const onReady = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  };

  const addStyles = () => {
    let style = $('#ytconv-chat-interaction-v6');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-chat-interaction-v6';
      document.head.appendChild(style);
    }

    style.textContent = `
      body.ytconv-chat-v6 .tw-glow-orb,
      body.ytconv-chat-v6::before,
      body.ytconv-chat-v6::after {
        display: none !important;
      }

      body.ytconv-chat-v6 .yc-composer {
        padding: 10px 11px 8px !important;
      }

      body.ytconv-chat-v6 .yc-composer:focus-within {
        border-color: rgba(255,255,255,.22) !important;
        box-shadow: 0 10px 42px rgba(0,0,0,.38), 0 0 0 1px rgba(255,255,255,.05) !important;
      }

      body.ytconv-chat-v6 .yc-composer #url {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        min-height: 1px !important;
        margin: -1px !important;
        padding: 0 !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      body.ytconv-chat-v6 .ycr-prompt-input {
        grid-column: 2;
        width: 100%;
        min-width: 0;
        min-height: 42px;
        max-height: 150px;
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
        caret-color: #fff;
        scrollbar-width: thin;
      }

      body.ytconv-chat-v6 .ycr-prompt-input::placeholder {
        color: #b4b4b4;
        opacity: 1;
      }

      body.ytconv-chat-v6 .ycr-prompt-input:focus {
        outline: 0;
        box-shadow: none;
      }

      body.ytconv-chat-v6 .yc-composer .input-group {
        grid-template-columns: 40px minmax(0,1fr) 38px 38px 42px !important;
      }

      body.ytconv-chat-v6 .yc-composer .input-group-text {
        grid-column: 1;
      }

      body.ytconv-chat-v6 .yc-composer #pasteBtn {
        grid-column: 3;
      }

      body.ytconv-chat-v6 .yc-composer #sampleBtn {
        grid-column: 4;
      }

      body.ytconv-chat-v6 .yc-composer #convertBtn {
        grid-column: 5;
      }

      body.ytconv-chat-v6 .yc-composer #convertBtn:not(:disabled) {
        background: #fff !important;
        color: #191919 !important;
        cursor: pointer !important;
      }

      body.ytconv-chat-v6 .yc-composer #convertBtn:not(:disabled):hover {
        transform: scale(1.04) !important;
      }

      body.ytconv-chat-v6 #ycOptions {
        pointer-events: auto !important;
        isolation: isolate !important;
      }

      body.ytconv-chat-v6 #ycOptions[open] {
        position: fixed !important;
        left: calc(var(--ycr-side-width, 260px) + ((100vw - var(--ycr-side-width, 260px)) / 2)) !important;
        right: auto !important;
        top: auto !important;
        bottom: 112px !important;
        z-index: 2147483600 !important;
        display: block !important;
        width: min(790px, calc(100vw - var(--ycr-side-width, 260px) - 42px)) !important;
        max-height: min(72vh, 680px) !important;
        margin: 0 !important;
        overflow: auto !important;
        overscroll-behavior: contain;
        border: 1px solid rgba(255,255,255,.15) !important;
        border-radius: 20px !important;
        background: var(--ycr-panel-deep, #262626) !important;
        box-shadow: 0 24px 90px rgba(0,0,0,.55) !important;
        transform: translateX(-50%) !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      body.ytconv-chat-v6.ytclean-collapsed #ycOptions[open] {
        left: calc(var(--ycr-rail-width, 72px) + ((100vw - var(--ycr-rail-width, 72px)) / 2)) !important;
        width: min(790px, calc(100vw - var(--ycr-rail-width, 72px) - 42px)) !important;
      }

      body.ytconv-chat-v6 #ycOptions,
      body.ytconv-chat-v6 #ycOptions *,
      body.ytconv-chat-v6 #ycOptions input,
      body.ytconv-chat-v6 #ycOptions select,
      body.ytconv-chat-v6 #ycOptions textarea,
      body.ytconv-chat-v6 #ycOptions button,
      body.ytconv-chat-v6 #ycOptions label {
        pointer-events: auto !important;
      }

      body.ytconv-chat-v6 #ycOptions > summary {
        display: none !important;
      }

      .ycr-sheet-header {
        position: sticky;
        top: 0;
        z-index: 8;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 58px;
        padding: 13px 16px;
        border-bottom: 1px solid var(--ycr-border, rgba(255,255,255,.1));
        background: var(--ycr-panel-deep, #262626);
      }

      .ycr-sheet-title {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--ycr-text, #ececec);
        font-size: 14px;
        font-weight: 650;
      }

      .ycr-sheet-close {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: var(--ycr-muted, #a8a8a8);
      }

      .ycr-sheet-close:hover {
        background: var(--ycr-panel-hover, #383838);
        color: var(--ycr-text, #ececec);
      }

      body.ytconv-chat-v6 #ycrOptionsBackdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483000 !important;
        display: block;
        border: 0 !important;
        background: rgba(0,0,0,.48) !important;
        pointer-events: auto !important;
        touch-action: none;
      }

      body.ytconv-chat-v6:not(.ycr-options-open) #ycrOptionsBackdrop {
        display: none !important;
      }

      body.ytconv-chat-v6.ycr-options-open {
        overflow: hidden !important;
      }

      body.ytconv-chat-v6 .yc-options-content {
        position: relative;
        z-index: 1;
      }

      body.ytconv-chat-v6 .yc-options-content input,
      body.ytconv-chat-v6 .yc-options-content select,
      body.ytconv-chat-v6 .yc-options-content textarea,
      body.ytconv-chat-v6 .yc-options-content button {
        position: relative;
        z-index: 2;
      }

      .ycr-input-mode {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--ycr-muted, #a8a8a8);
        white-space: nowrap;
      }

      [data-bs-theme='light'] body.ytconv-chat-v6 .ycr-prompt-input {
        color: #202123;
        caret-color: #202123;
      }

      [data-bs-theme='light'] body.ytconv-chat-v6 #ycOptions[open] {
        border-color: rgba(0,0,0,.12) !important;
      }

      @media (max-width: ${DESKTOP}px) {
        body.ytconv-chat-v6 #ycOptions[open],
        body.ytconv-chat-v6.ytclean-collapsed #ycOptions[open] {
          left: 50% !important;
          bottom: 104px !important;
          width: min(760px, calc(100vw - 20px)) !important;
          max-height: min(72vh, 680px) !important;
        }
      }

      @media (max-width: 620px) {
        body.ytconv-chat-v6 .yc-composer .input-group {
          grid-template-columns: 38px minmax(0,1fr) 36px 40px !important;
        }

        body.ytconv-chat-v6 .yc-composer #sampleBtn {
          display: none !important;
        }

        body.ytconv-chat-v6 .yc-composer #convertBtn {
          grid-column: 4;
        }

        body.ytconv-chat-v6 .yc-composer #pasteBtn {
          grid-column: 3;
        }

        body.ytconv-chat-v6 #ycOptions[open] {
          bottom: 94px !important;
          max-height: 70vh !important;
          border-radius: 18px !important;
        }
      }
    `;
  };

  const getOptionsPanel = () => $('#ycOptions');

  const setOptionsOpen = (open) => {
    const panel = getOptionsPanel();
    if (!panel) return;

    panel.open = Boolean(open);
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('ycr-options-open', Boolean(open));

    $('#ycOptionsButton')?.setAttribute('aria-expanded', String(Boolean(open)));
    $('#headerModeToggle')?.setAttribute('aria-expanded', String(Boolean(open)));

    if (open) {
      window.requestAnimationFrame(() => {
        panel.scrollTop = 0;
        $('.ycr-sheet-close', panel)?.focus({ preventScroll: true });
      });
    }
  };

  const ensureOptionsPortal = () => {
    const panel = getOptionsPanel();
    if (!panel) return;

    document.body.classList.add('ytconv-chat-v6');

    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }

    panel.removeAttribute('inert');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Pengaturan konversi');

    $$('[inert]', panel).forEach((node) => node.removeAttribute('inert'));

    const summary = $('summary', panel);
    if (summary) {
      summary.setAttribute('aria-hidden', 'true');
      summary.tabIndex = -1;
    }

    let header = $('.ycr-sheet-header', panel);
    if (!header) {
      header = document.createElement('div');
      header.className = 'ycr-sheet-header';
      header.innerHTML = `
        <div class="ycr-sheet-title">
          <i class="bi bi-sliders"></i>
          <span>Pengaturan konversi</span>
        </div>
        <button class="ycr-sheet-close" type="button" aria-label="Tutup pengaturan" title="Tutup">
          <i class="bi bi-x-lg"></i>
        </button>
      `;
      const content = $('.yc-options-content', panel);
      panel.insertBefore(header, content || panel.firstChild);
    }

    const closeButton = $('.ycr-sheet-close', panel);
    if (closeButton && !closeButton.dataset.ycrV6Bound) {
      closeButton.dataset.ycrV6Bound = 'true';
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOptionsOpen(false);
      });
    }

    let backdrop = $('#ycrOptionsBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.id = 'ycrOptionsBackdrop';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Tutup pengaturan');
      document.body.insertBefore(backdrop, panel);
    } else if (backdrop.nextElementSibling !== panel) {
      document.body.insertBefore(backdrop, panel);
    }

    if (!backdrop.dataset.ycrV6Bound) {
      backdrop.dataset.ycrV6Bound = 'true';
      backdrop.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOptionsOpen(false);
      });
    }

    document.body.classList.toggle('ycr-options-open', panel.open);
  };

  const looksLikeUrl = (value) => {
    const text = value.trim();
    if (!text) return false;
    if (/^(https?:\/\/|www\.)/i.test(text)) return true;
    if (/(youtu\.be|youtube\.com|music\.youtube\.com|open\.spotify\.com|soundcloud\.com)\//i.test(text)) return true;
    try {
      const parsed = new URL(text);
      return Boolean(parsed.protocol && parsed.hostname);
    } catch {
      return false;
    }
  };

  const autoResize = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const renderUserPrompt = (raw, isUrl) => {
    const user = $('#ycUser');
    const content = $('#ycUser .yc-content');
    const conversation = $('#ycConversation');
    const assistant = $('#ycAssistant');
    const pending = $('#ycPending');

    if (!user || !content || !conversation) return;

    content.textContent = '';

    const source = document.createElement('div');
    source.className = 'ycr-source-row';
    source.innerHTML = `<i class="bi ${isUrl ? 'bi-link-45deg' : 'bi-search'}"></i><span>${isUrl ? 'Tautan media' : 'Pencarian lagu'}</span>`;

    const text = document.createElement('div');
    text.className = 'ycr-prompt-text';
    text.textContent = raw;

    content.append(source, text);
    user.hidden = false;
    conversation.hidden = false;
    conversation.dataset.waiting = '1';

    if (assistant) assistant.hidden = false;
    if (pending) pending.hidden = false;

    $('#ycWelcome')?.classList.add('compact');
  };

  const setNativeValue = (element, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
    if (descriptor?.set) descriptor.set.call(element, value);
    else element.value = value;
  };

  const syncOriginalInput = (prompt, original) => {
    syncingPrompt = true;
    setNativeValue(original, prompt.value);
    original.dispatchEvent(new Event('input', { bubbles: true }));
    original.dispatchEvent(new Event('change', { bubbles: true }));
    syncingPrompt = false;
  };

  const submitPrompt = () => {
    const prompt = $('#ycrPromptInput');
    const original = $('#url');
    const send = $('#convertBtn');
    if (!prompt || !original || !send) return;

    const raw = prompt.value.trim();
    if (!raw) return;

    const isUrl = looksLikeUrl(raw);
    syncOriginalInput(prompt, original);
    renderUserPrompt(raw, isUrl);

    if (isUrl) {
      send.dataset.ycrV6PassThrough = 'true';
      send.click();
    } else {
      const keyword = $('#keywordInput');
      const keywordConvert = $('#keywordConvertBtn');
      const keywordSearch = $('#keywordSearchBtn');

      if (keyword) {
        setNativeValue(keyword, raw);
        keyword.dispatchEvent(new Event('input', { bubbles: true }));
        keyword.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const target = keywordConvert || keywordSearch;
      if (target) target.click();
      else {
        send.dataset.ycrV6PassThrough = 'true';
        send.click();
      }
    }

    window.setTimeout(() => {
      prompt.value = '';
      autoResize(prompt);
      setNativeValue(original, '');
      original.dispatchEvent(new Event('input', { bubbles: true }));
      send.disabled = true;
      send.setAttribute('aria-disabled', 'true');
    }, 0);
  };

  const ensurePromptInput = () => {
    const original = $('#url');
    const group = original?.closest('.input-group');
    const send = $('#convertBtn');
    if (!original || !group || !send) return;

    document.body.classList.add('ytconv-chat-v6');

    let prompt = $('#ycrPromptInput');
    if (!prompt) {
      prompt = document.createElement('textarea');
      prompt.id = 'ycrPromptInput';
      prompt.className = 'ycr-prompt-input';
      prompt.rows = 1;
      prompt.spellcheck = true;
      prompt.autocomplete = 'off';
      prompt.placeholder = 'Tempel link atau ketik judul lagu…';
      prompt.setAttribute('aria-label', 'Link atau judul lagu yang ingin dikonversi');
      original.insertAdjacentElement('afterend', prompt);
    }

    const syncSendState = () => {
      const hasValue = Boolean(prompt.value.trim());
      send.disabled = !hasValue;
      send.setAttribute('aria-disabled', String(!hasValue));
      const mode = $('.ycr-input-mode');
      if (mode) {
        const isUrl = looksLikeUrl(prompt.value);
        mode.innerHTML = `<i class="bi ${isUrl ? 'bi-link-45deg' : 'bi-search'}"></i><span>${isUrl ? 'Link' : 'Judul'}</span>`;
      }
    };

    if (!prompt.dataset.ycrV6Bound) {
      prompt.dataset.ycrV6Bound = 'true';

      prompt.addEventListener('input', () => {
        syncOriginalInput(prompt, original);
        autoResize(prompt);
        syncSendState();
      });

      prompt.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          submitPrompt();
        }
      });

      original.addEventListener('input', () => {
        if (syncingPrompt) return;
        prompt.value = original.value;
        autoResize(prompt);
        syncSendState();
      });

      ['pasteBtn', 'sampleBtn'].forEach((id) => {
        const button = document.getElementById(id);
        if (!button || button.dataset.ycrV6SyncBound) return;
        button.dataset.ycrV6SyncBound = 'true';
        button.addEventListener('click', () => {
          window.setTimeout(() => {
            prompt.value = original.value;
            autoResize(prompt);
            syncSendState();
            prompt.focus();
          }, 80);
        });
      });
    }

    let mode = $('.ycr-input-mode');
    const footer = $('.yc-composer-footer');
    if (footer && !mode) {
      mode = document.createElement('span');
      mode.className = 'ycr-input-mode';
      footer.insertBefore(mode, footer.firstChild?.nextSibling || footer.firstChild);
    }

    prompt.value = original.value || prompt.value;
    autoResize(prompt);
    syncSendState();
  };

  const installCaptureGuards = () => {
    if (window.__ytconvChatV6Guards) return;
    window.__ytconvChatV6Guards = true;

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest?.('#headerModeToggle, #ycOptionsButton, .yc-composer .input-group-text');
      if (trigger) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOptionsOpen(true);
        return;
      }

      const send = event.target.closest?.('#convertBtn');
      if (send) {
        if (send.dataset.ycrV6PassThrough === 'true') {
          delete send.dataset.ycrV6PassThrough;
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        submitPrompt();
      }
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && getOptionsPanel()?.open) {
        event.preventDefault();
        setOptionsOpen(false);
      }
    }, true);
  };

  const apply = () => {
    addStyles();
    ensureOptionsPortal();
    ensurePromptInput();
    installCaptureGuards();
    document.documentElement.dataset.ytconvChatInteraction = 'v6';
  };

  onReady(() => {
    apply();
    window.addEventListener('pageshow', apply, { passive: true });
    window.setTimeout(apply, 500);
    window.setTimeout(apply, 1500);

    const observer = new MutationObserver(() => {
      const panel = getOptionsPanel();
      if (panel && panel.parentElement !== document.body) ensureOptionsPortal();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();