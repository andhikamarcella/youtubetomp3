(() => {
  'use strict';

  const DESKTOP = 991.98;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const onReady = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  };

  const addStyles = () => {
    let style = $('#ytconv-chat-realism-v5');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ytconv-chat-realism-v5';
      document.head.appendChild(style);
    }

    style.textContent = `
      :root {
        --ycr-bg: #212121;
        --ycr-sidebar: #171717;
        --ycr-panel: #2f2f2f;
        --ycr-panel-hover: #383838;
        --ycr-panel-deep: #262626;
        --ycr-text: #ececec;
        --ycr-muted: #a8a8a8;
        --ycr-border: rgba(255, 255, 255, .10);
        --ycr-shadow: 0 18px 60px rgba(0, 0, 0, .30);
        --ycr-red: #ff0033;
        --ycr-side-width: 260px;
        --ycr-rail-width: 72px;
      }

      body.ytconv-chat-v5 {
        background: var(--ycr-bg) !important;
        color: var(--ycr-text) !important;
      }

      body.ytconv-chat-v5 #mainContent {
        width: min(100%, 860px) !important;
        max-width: 860px !important;
        min-height: 100dvh;
        padding: 18px 22px 176px !important;
      }

      body.ytconv-chat-v5 .section-header.ytconv-hero-clean {
        position: sticky;
        top: 0;
        z-index: 35;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 16px !important;
        min-height: 58px;
        margin: 0 -10px 8px !important;
        padding: 8px 10px !important;
        border: 0 !important;
        background: linear-gradient(180deg, var(--ycr-bg) 72%, rgba(33, 33, 33, 0)) !important;
        box-shadow: none !important;
      }

      body.ytconv-chat-v5 .section-header #activeSectionTitle {
        margin: 0 !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        letter-spacing: -.02em !important;
      }

      body.ytconv-chat-v5 .section-header #activeSectionSubtitle {
        display: none !important;
      }

      .ycr-title-wrap {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 10px;
      }

      .ycr-assistant-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 28px;
        padding: 5px 9px;
        border: 1px solid var(--ycr-border);
        border-radius: 999px;
        color: var(--ycr-muted);
        font-size: 12px;
        white-space: nowrap;
      }

      .ycr-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #10a37f;
        box-shadow: 0 0 0 3px rgba(16, 163, 127, .14);
      }

      body.ytconv-chat-v5 .ytconv-header-actions {
        display: flex !important;
        align-items: center;
        gap: 6px;
      }

      body.ytconv-chat-v5 .ytconv-header-action {
        min-height: 36px !important;
        padding: 7px 10px !important;
        border: 1px solid transparent !important;
        border-radius: 9px !important;
        background: transparent !important;
        color: var(--ycr-muted) !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        box-shadow: none !important;
      }

      body.ytconv-chat-v5 .ytconv-header-action:hover {
        background: var(--ycr-panel) !important;
        color: var(--ycr-text) !important;
        transform: none !important;
      }

      body.ytconv-chat-v5 .ytconv-header-action--music {
        color: #fff !important;
        background: var(--ycr-red) !important;
      }

      body.ytconv-chat-v5 .yc-welcome {
        min-height: min(64vh, 560px) !important;
        padding: 36px 14px 26px !important;
      }

      body.ytconv-chat-v5 .yc-welcome.compact {
        display: none !important;
      }

      body.ytconv-chat-v5 .yc-welcome img {
        width: 54px !important;
        height: 54px !important;
        margin-bottom: 18px !important;
        border-radius: 16px !important;
      }

      body.ytconv-chat-v5 .yc-welcome h2 {
        font-size: clamp(27px, 4.5vw, 36px) !important;
        font-weight: 600 !important;
        letter-spacing: -.04em !important;
      }

      body.ytconv-chat-v5 .yc-welcome p {
        max-width: 520px !important;
        margin-top: 11px !important;
        color: var(--ycr-muted) !important;
        font-size: 14px !important;
      }

      body.ytconv-chat-v5 .yc-suggestions {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: min(100%, 650px);
        margin: 24px auto 0 !important;
        gap: 10px !important;
      }

      body.ytconv-chat-v5 .yc-suggestion {
        min-height: 76px !important;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 13px 14px !important;
        border: 1px solid var(--ycr-border) !important;
        border-radius: 14px !important;
        background: transparent !important;
        color: var(--ycr-text) !important;
        text-align: left;
      }

      body.ytconv-chat-v5 .yc-suggestion:hover {
        background: var(--ycr-panel) !important;
        transform: none !important;
      }

      body.ytconv-chat-v5 .yc-suggestion i {
        color: var(--ycr-muted);
        font-size: 16px;
      }

      body.ytconv-chat-v5 .yc-conversation {
        width: 100%;
        display: grid;
        gap: 28px !important;
        margin: 18px 0 24px !important;
        padding: 0 4px;
      }

      body.ytconv-chat-v5 .yc-message {
        width: 100%;
        gap: 13px !important;
      }

      body.ytconv-chat-v5 .yc-user {
        justify-content: flex-end;
      }

      body.ytconv-chat-v5 .yc-user .yc-content {
        max-width: min(78%, 610px) !important;
        padding: 11px 15px !important;
        border: 1px solid rgba(255, 255, 255, .04);
        border-radius: 19px !important;
        background: var(--ycr-panel) !important;
        font-size: 14px;
        line-height: 1.5;
      }

      .ycr-source-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        color: var(--ycr-muted);
        font-size: 11px;
      }

      .ycr-source-row i {
        color: var(--ycr-red);
      }

      .ycr-prompt-text {
        overflow-wrap: anywhere;
      }

      body.ytconv-chat-v5 .yc-avatar {
        width: 32px !important;
        height: 32px !important;
        flex-basis: 32px !important;
        border-radius: 10px !important;
      }

      body.ytconv-chat-v5 .yc-assistant .yc-content {
        max-width: calc(100% - 45px) !important;
        color: var(--ycr-text) !important;
      }

      .ycr-message-meta {
        display: flex;
        align-items: center;
        gap: 7px;
        min-height: 22px;
        margin-bottom: 8px;
        color: var(--ycr-muted);
        font-size: 11px;
      }

      .ycr-message-meta strong {
        color: var(--ycr-text);
        font-size: 12px;
        font-weight: 600;
      }

      body.ytconv-chat-v5 .yc-pending {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 7px 0 !important;
        color: var(--ycr-muted) !important;
      }

      .ycr-thinking-dots {
        display: inline-flex;
        gap: 4px;
      }

      .ycr-thinking-dots span {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        animation: ycrThinking 1.1s infinite ease-in-out;
      }

      .ycr-thinking-dots span:nth-child(2) { animation-delay: .14s; }
      .ycr-thinking-dots span:nth-child(3) { animation-delay: .28s; }

      @keyframes ycrThinking {
        0%, 70%, 100% { opacity: .32; transform: translateY(0); }
        35% { opacity: 1; transform: translateY(-2px); }
      }

      .ycr-message-actions {
        display: flex;
        align-items: center;
        gap: 3px;
        margin-top: 10px;
      }

      .ycr-message-action {
        width: 32px;
        height: 32px;
        display: inline-grid;
        place-items: center;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--ycr-muted);
      }

      .ycr-message-action:hover {
        background: var(--ycr-panel);
        color: var(--ycr-text);
      }

      body.ytconv-chat-v5 #previewWrap,
      body.ytconv-chat-v5 #searchResultsWrap,
      body.ytconv-chat-v5 #resultWrap {
        margin: 0 !important;
      }

      body.ytconv-chat-v5 #previewWrap {
        padding: 14px !important;
        border: 1px solid var(--ycr-border);
        border-radius: 15px;
        background: var(--ycr-panel-deep);
      }

      body.ytconv-chat-v5 #videoPreviewWrap {
        overflow: hidden;
        border-radius: 12px !important;
      }

      body.ytconv-chat-v5 #videoTitle {
        margin-top: 2px;
        font-size: 16px;
        line-height: 1.35;
      }

      body.ytconv-chat-v5 #videoMeta {
        margin-top: 7px;
        color: var(--ycr-muted) !important;
        line-height: 1.55;
      }

      body.ytconv-chat-v5 #convertProgWrap {
        height: 7px !important;
        margin-top: 12px !important;
        background: var(--ycr-panel) !important;
      }

      body.ytconv-chat-v5 .yc-composer {
        position: fixed !important;
        left: calc(var(--ycr-side-width) + ((100vw - var(--ycr-side-width)) / 2));
        bottom: 14px !important;
        z-index: 2147481200 !important;
        width: min(790px, calc(100vw - var(--ycr-side-width) - 42px));
        margin: 0 !important;
        padding: 9px 10px 8px !important;
        border: 1px solid var(--ycr-border) !important;
        border-radius: 25px !important;
        background: var(--ycr-panel) !important;
        box-shadow: var(--ycr-shadow) !important;
        transform: translateX(-50%);
      }

      body.ytconv-chat-v5.ytclean-collapsed .yc-composer {
        left: calc(var(--ycr-rail-width) + ((100vw - var(--ycr-rail-width)) / 2));
        width: min(790px, calc(100vw - var(--ycr-rail-width) - 42px));
      }

      body.ytconv-chat-v5 .yc-composer::before {
        content: '';
        position: absolute;
        left: -24px;
        right: -24px;
        bottom: -16px;
        height: 122px;
        z-index: -1;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(33, 33, 33, 0), var(--ycr-bg) 48%);
      }

      body.ytconv-chat-v5 .yc-composer .input-group {
        display: grid !important;
        grid-template-columns: 40px minmax(0, 1fr) 38px 38px 42px !important;
        align-items: center;
        gap: 3px !important;
      }

      body.ytconv-chat-v5 .yc-composer .input-group-text {
        width: 38px !important;
        height: 38px !important;
        display: grid !important;
        place-items: center;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: transparent !important;
        color: var(--ycr-muted) !important;
        cursor: pointer;
      }

      body.ytconv-chat-v5 .yc-composer .input-group-text:hover {
        background: var(--ycr-panel-hover) !important;
        color: var(--ycr-text) !important;
      }

      body.ytconv-chat-v5 .yc-composer #url {
        min-height: 45px !important;
        padding: 8px 5px !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: var(--ycr-text) !important;
        font-size: 15px !important;
        box-shadow: none !important;
      }

      body.ytconv-chat-v5 .yc-composer #url::placeholder {
        color: #b4b4b4;
      }

      body.ytconv-chat-v5 .yc-composer #pasteBtn,
      body.ytconv-chat-v5 .yc-composer #sampleBtn,
      body.ytconv-chat-v5 .yc-composer #convertBtn {
        width: 36px !important;
        min-width: 36px !important;
        height: 36px !important;
        min-height: 36px !important;
        display: grid !important;
        place-items: center;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 50% !important;
        box-shadow: none !important;
      }

      body.ytconv-chat-v5 .yc-composer #pasteBtn,
      body.ytconv-chat-v5 .yc-composer #sampleBtn {
        background: transparent !important;
        color: var(--ycr-muted) !important;
      }

      body.ytconv-chat-v5 .yc-composer #pasteBtn:hover,
      body.ytconv-chat-v5 .yc-composer #sampleBtn:hover {
        background: var(--ycr-panel-hover) !important;
        color: var(--ycr-text) !important;
      }

      body.ytconv-chat-v5 .yc-composer #convertBtn {
        background: #f4f4f4 !important;
        color: #202020 !important;
      }

      body.ytconv-chat-v5 .yc-composer #convertBtn:disabled {
        opacity: 1 !important;
        background: #676767 !important;
        color: #a9a9a9 !important;
        cursor: default;
      }

      body.ytconv-chat-v5 .yc-composer-footer {
        display: grid !important;
        grid-template-columns: auto auto minmax(0, 1fr);
        align-items: center;
        gap: 9px !important;
        padding: 3px 7px 0 !important;
        color: var(--ycr-muted) !important;
        font-size: 10px !important;
      }

      .ycr-composer-option {
        border: 0;
        padding: 2px 0;
        background: transparent;
        color: var(--ycr-muted);
        font-size: 10px;
        font-weight: 600;
      }

      .ycr-composer-option:hover { color: var(--ycr-text); }

      .ycr-preset {
        padding-left: 9px;
        border-left: 1px solid var(--ycr-border);
        white-space: nowrap;
      }

      .ycr-disclaimer {
        overflow: hidden;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      body.ytconv-chat-v5 #ycOptions:not([open]) {
        display: none !important;
      }

      body.ytconv-chat-v5 #ycOptions[open] {
        position: fixed !important;
        left: calc(var(--ycr-side-width) + ((100vw - var(--ycr-side-width)) / 2));
        bottom: 112px;
        z-index: 2147481500;
        display: block !important;
        width: min(790px, calc(100vw - var(--ycr-side-width) - 42px));
        max-height: min(68vh, 650px);
        margin: 0 !important;
        overflow: auto;
        border: 1px solid var(--ycr-border) !important;
        border-radius: 18px !important;
        background: var(--ycr-panel-deep) !important;
        box-shadow: var(--ycr-shadow) !important;
        transform: translateX(-50%);
      }

      body.ytconv-chat-v5.ytclean-collapsed #ycOptions[open] {
        left: calc(var(--ycr-rail-width) + ((100vw - var(--ycr-rail-width)) / 2));
        width: min(790px, calc(100vw - var(--ycr-rail-width) - 42px));
      }

      body.ytconv-chat-v5 #ycOptions > summary {
        position: sticky;
        top: 0;
        z-index: 4;
        min-height: 54px !important;
        padding: 14px 16px !important;
        border-bottom: 1px solid var(--ycr-border);
        background: var(--ycr-panel-deep) !important;
      }

      body.ytconv-chat-v5 #ycOptions > summary::after {
        content: '×' !important;
        font-size: 22px !important;
        font-weight: 300;
        transform: none !important;
      }

      body.ytconv-chat-v5 .yc-options-content {
        padding: 14px 16px 20px !important;
        border: 0 !important;
      }

      body.ytconv-chat-v5 .yc-options-content > * {
        padding-top: 14px;
        padding-bottom: 14px;
        margin-bottom: 0 !important;
        border-bottom: 1px solid var(--ycr-border);
      }

      body.ytconv-chat-v5 .yc-options-content > *:last-child {
        border-bottom: 0;
      }

      body.ytconv-chat-v5 .yc-options-content .card,
      body.ytconv-chat-v5 .yc-options-content .form-control,
      body.ytconv-chat-v5 .yc-options-content .form-select {
        border-color: var(--ycr-border) !important;
        background: #242424 !important;
        box-shadow: none !important;
      }

      #ycrOptionsBackdrop {
        position: fixed;
        inset: 0;
        z-index: 2147481400;
        border: 0;
        background: rgba(0, 0, 0, .38);
      }

      body:not(.ycr-options-open) #ycrOptionsBackdrop {
        display: none !important;
      }

      body.ytconv-chat-v5.ytclean-route-converter #subtitleCard,
      body.ytconv-chat-v5.ytclean-route-converter #aiStudioCard,
      body.ytconv-chat-v5.ytclean-route-converter #historyPanel {
        display: none !important;
      }

      body.ytconv-chat-v5 #ycOptions #subtitleCard,
      body.ytconv-chat-v5 #ycOptions #aiStudioCard,
      body.ytconv-chat-v5 #ycOptions #historyPanel {
        display: block !important;
      }

      [data-bs-theme='light'] body.ytconv-chat-v5 {
        --ycr-bg: #ffffff;
        --ycr-sidebar: #f7f7f8;
        --ycr-panel: #f4f4f4;
        --ycr-panel-hover: #e9e9e9;
        --ycr-panel-deep: #ffffff;
        --ycr-text: #202123;
        --ycr-muted: #676767;
        --ycr-border: rgba(0, 0, 0, .10);
        --ycr-shadow: 0 18px 60px rgba(0, 0, 0, .14);
      }

      [data-bs-theme='light'] body.ytconv-chat-v5 .section-header.ytconv-hero-clean {
        background: linear-gradient(180deg, #fff 72%, rgba(255, 255, 255, 0)) !important;
      }

      [data-bs-theme='light'] body.ytconv-chat-v5 .yc-composer::before {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0), #fff 48%);
      }

      [data-bs-theme='light'] body.ytconv-chat-v5 .yc-user .yc-content {
        border-color: rgba(0, 0, 0, .04);
      }

      @media (max-width: ${DESKTOP}px) {
        body.ytconv-chat-v5 #mainContent {
          width: 100% !important;
          padding: calc(var(--ytclean-mobilebar-total-height) + 8px) 14px 170px !important;
        }

        body.ytconv-chat-v5 .yc-composer,
        body.ytconv-chat-v5.ytclean-collapsed .yc-composer {
          left: 50%;
          width: min(760px, calc(100vw - 24px));
          bottom: 10px !important;
        }

        body.ytconv-chat-v5 #ycOptions[open],
        body.ytconv-chat-v5.ytclean-collapsed #ycOptions[open] {
          left: 50%;
          width: min(760px, calc(100vw - 24px));
          bottom: 105px;
          max-height: 64vh;
        }

        body.ytconv-chat-v5 .section-header.ytconv-hero-clean {
          top: calc(var(--ytclean-mobilebar-total-height) + 2px);
        }
      }

      @media (max-width: 620px) {
        .ycr-assistant-status { display: none; }
        body.ytconv-chat-v5 .yc-suggestions { grid-template-columns: 1fr; }
        body.ytconv-chat-v5 .yc-suggestion { min-height: 58px !important; flex-direction: row; align-items: center; justify-content: flex-start; }
        body.ytconv-chat-v5 .yc-user .yc-content { max-width: 90% !important; }
        body.ytconv-chat-v5 .yc-composer .input-group { grid-template-columns: 38px minmax(0, 1fr) 36px 40px !important; }
        body.ytconv-chat-v5 .yc-composer #sampleBtn { display: none !important; }
        body.ytconv-chat-v5 .yc-composer-footer { grid-template-columns: auto auto; }
        .ycr-disclaimer { display: none; }
        body.ytconv-chat-v5 .ytconv-header-action span { display: none; }
        body.ytconv-chat-v5 .ytconv-header-action { width: 36px !important; padding: 0 !important; justify-content: center !important; }
      }

      @media (prefers-reduced-motion: reduce) {
        .ycr-thinking-dots span { animation: none !important; }
      }
    `;
  };

  const ensureHeader = () => {
    const header = $('#mainContent .section-header');
    const title = $('#activeSectionTitle');
    if (!header || !title) return;

    document.body.classList.add('ytconv-chat-v5');
    title.textContent = 'YTConv';

    let titleWrap = $('.ycr-title-wrap', header);
    if (!titleWrap) {
      titleWrap = document.createElement('div');
      titleWrap.className = 'ycr-title-wrap';
      title.parentElement?.insertBefore(titleWrap, title);
      titleWrap.appendChild(title);
    }

    let status = $('#ycrAssistantStatus');
    if (!status) {
      status = document.createElement('span');
      status.id = 'ycrAssistantStatus';
      status.className = 'ycr-assistant-status';
      status.innerHTML = '<span class="ycr-status-dot"></span><span>Media Assistant siap</span>';
      titleWrap.appendChild(status);
    }

    const music = $('#ytconvHeaderMusic');
    const mode = $('#headerModeToggle');
    if (music) {
      music.className = 'ytconv-header-action ytconv-header-action--music';
      music.innerHTML = '<i class="bi bi-youtube"></i><span>YT Music</span>';
      music.title = 'Buka YouTube Music';
    }
    if (mode) {
      mode.className = 'ytconv-header-action';
      mode.innerHTML = '<i class="bi bi-sliders"></i><span>Opsi</span>';
      mode.title = 'Pengaturan konversi';
    }
  };

  const moveUtilityCards = () => {
    const panelBody = $('#ycOptions .yc-options-content');
    if (!panelBody) return;

    ['aiStudioCard', 'subtitleCard', 'historyPanel'].forEach((id) => {
      const node = document.getElementById(id);
      if (node && node.parentElement !== panelBody) panelBody.appendChild(node);
    });
  };

  const setOptionsOpen = (open) => {
    const panel = $('#ycOptions');
    if (!panel) return;
    panel.open = Boolean(open);
    document.body.classList.toggle('ycr-options-open', Boolean(open));
    $('#ycOptionsButton')?.setAttribute('aria-expanded', String(Boolean(open)));
    $('#headerModeToggle')?.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) setTimeout(() => panel.focus({ preventScroll: true }), 0);
  };

  const ensureOptionsSheet = () => {
    const panel = $('#ycOptions');
    if (!panel) return;

    panel.setAttribute('tabindex', '-1');
    const summary = $('summary', panel);
    if (summary) summary.innerHTML = '<i class="bi bi-sliders"></i><span>Pengaturan konversi</span>';

    let backdrop = $('#ycrOptionsBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.id = 'ycrOptionsBackdrop';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Tutup pengaturan');
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', () => setOptionsOpen(false));
    }

    if (!panel.dataset.ycrBound) {
      panel.dataset.ycrBound = 'true';
      panel.addEventListener('toggle', () => {
        document.body.classList.toggle('ycr-options-open', panel.open);
      });
      summary?.addEventListener('click', (event) => {
        event.preventDefault();
        setOptionsOpen(!panel.open);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && panel.open) setOptionsOpen(false);
      });
    }

    const optionButton = $('#ycOptionsButton');
    if (optionButton) {
      const replacement = optionButton.cloneNode(true);
      optionButton.replaceWith(replacement);
      replacement.className = 'ycr-composer-option';
      replacement.innerHTML = '<i class="bi bi-sliders me-1"></i>Opsi';
      replacement.setAttribute('aria-controls', 'ycOptions');
      replacement.setAttribute('aria-expanded', String(panel.open));
      replacement.addEventListener('click', () => setOptionsOpen(!panel.open));
    }

    const mode = $('#headerModeToggle');
    if (mode && !mode.dataset.ycrBound) {
      mode.dataset.ycrBound = 'true';
      mode.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOptionsOpen(!panel.open);
      }, true);
    }
  };

  const updatePresetLabel = () => {
    const format = $('#format');
    const quality = $('#abr');
    const label = $('#ycrPresetLabel');
    if (!label) return;
    const formatText = format?.selectedOptions?.[0]?.textContent?.split(' ')[0] || 'MP3';
    const qualityText = quality?.value ? `${quality.value} kbps` : 'Otomatis';
    label.textContent = `${formatText} · ${qualityText}`;
  };

  const ensureComposer = () => {
    const input = $('#url');
    const composer = input?.closest('.yc-composer');
    const group = input?.closest('.input-group');
    const paste = $('#pasteBtn');
    const sample = $('#sampleBtn');
    const send = $('#convertBtn');
    const footer = composer ? $('.yc-composer-footer', composer) : null;
    if (!input || !composer || !group || !send || !footer) return;

    input.placeholder = 'Kirim tautan YouTube, YT Music, Spotify, atau SoundCloud';
    input.setAttribute('aria-label', 'Tautan media yang ingin dikonversi');

    const prefix = $('.input-group-text', group);
    if (prefix) {
      prefix.innerHTML = '<i class="bi bi-plus-lg"></i>';
      prefix.setAttribute('role', 'button');
      prefix.setAttribute('tabindex', '0');
      prefix.setAttribute('aria-label', 'Buka opsi konversi');
      prefix.title = 'Opsi konversi';
      if (!prefix.dataset.ycrBound) {
        prefix.dataset.ycrBound = 'true';
        prefix.addEventListener('click', () => setOptionsOpen(true));
        prefix.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOptionsOpen(true);
          }
        });
      }
    }

    if (paste) {
      paste.innerHTML = '<i class="bi bi-clipboard2"></i>';
      paste.title = 'Tempel dari clipboard';
      paste.setAttribute('aria-label', 'Tempel dari clipboard');
    }
    if (sample) {
      sample.innerHTML = '<i class="bi bi-stars"></i>';
      sample.title = 'Gunakan contoh tautan';
      sample.setAttribute('aria-label', 'Gunakan contoh tautan');
    }
    send.innerHTML = '<i class="bi bi-arrow-up"></i>';
    send.title = 'Kirim dan mulai konversi';

    footer.innerHTML = `
      <button class="ycr-composer-option" id="ycOptionsButton" type="button" aria-controls="ycOptions">
        <i class="bi bi-sliders me-1"></i>Opsi
      </button>
      <span class="ycr-preset" id="ycrPresetLabel"></span>
      <span class="ycr-disclaimer">Pastikan kamu memiliki hak untuk mengunduh media.</span>
    `;

    const syncSend = () => {
      send.disabled = !input.value.trim();
      send.setAttribute('aria-disabled', String(send.disabled));
    };

    if (!input.dataset.ycrBound) {
      input.dataset.ycrBound = 'true';
      input.addEventListener('input', syncSend);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          if (!send.disabled) send.click();
        }
      });
    }

    if (!send.dataset.ycrPromptBound) {
      send.dataset.ycrPromptBound = 'true';
      send.addEventListener('pointerdown', () => {
        send.dataset.ycrPrompt = input.value.trim();
      }, true);
      send.addEventListener('click', () => {
        const raw = send.dataset.ycrPrompt || input.value.trim();
        if (!raw) return;
        setTimeout(() => formatUserMessage(raw), 0);
      });
    }

    ['format', 'abr'].forEach((id) => {
      const control = document.getElementById(id);
      if (control && !control.dataset.ycrPresetBound) {
        control.dataset.ycrPresetBound = 'true';
        control.addEventListener('change', updatePresetLabel);
      }
    });

    syncSend();
    updatePresetLabel();
  };

  const formatUserMessage = (raw) => {
    const content = $('#ycUser .yc-content');
    if (!content || !raw) return;

    let source = 'Tautan media';
    let icon = 'bi-link-45deg';
    try {
      const hostname = new URL(raw).hostname.replace(/^www\./, '');
      source = hostname;
      if (/youtu/.test(hostname)) icon = 'bi-youtube';
      else if (/spotify/.test(hostname)) icon = 'bi-spotify';
      else if (/soundcloud/.test(hostname)) icon = 'bi-cloud';
    } catch {
      source = 'Permintaan konversi';
    }

    content.textContent = '';
    const sourceRow = document.createElement('div');
    sourceRow.className = 'ycr-source-row';
    sourceRow.innerHTML = `<i class="bi ${icon}"></i><span></span>`;
    $('span', sourceRow).textContent = source;

    const text = document.createElement('div');
    text.className = 'ycr-prompt-text';
    text.textContent = raw;
    content.append(sourceRow, text);
  };

  const ensureConversationDetails = () => {
    const assistantContent = $('#ycAssistant .yc-content');
    const pending = $('#ycPending');
    const user = $('#ycUser');
    const assistant = $('#ycAssistant');
    if (!assistantContent || !pending || !user || !assistant) return;

    let meta = $('.ycr-message-meta', assistantContent);
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'ycr-message-meta';
      meta.innerHTML = '<strong>YTConv</strong><span>•</span><span id="ycrMessageState">Media Assistant</span><span>•</span><time id="ycrMessageTime"></time>';
      assistantContent.prepend(meta);
    }

    pending.innerHTML = '<span class="ycr-thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span><span>Menyiapkan media dan opsi terbaik…</span>';

    let actions = $('.ycr-message-actions', assistantContent);
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'ycr-message-actions';
      actions.hidden = true;
      actions.innerHTML = `
        <button class="ycr-message-action" id="ycrCopyResponse" type="button" title="Salin ringkasan" aria-label="Salin ringkasan"><i class="bi bi-copy"></i></button>
        <button class="ycr-message-action" id="ycrDownloadResult" type="button" title="Unduh hasil" aria-label="Unduh hasil"><i class="bi bi-download"></i></button>
        <button class="ycr-message-action" id="ycrClearChat" type="button" title="Mulai percakapan baru" aria-label="Mulai percakapan baru"><i class="bi bi-arrow-counterclockwise"></i></button>
      `;
      assistantContent.appendChild(actions);
    }

    const dynamic = ['searchResultsWrap', 'previewWrap', 'statusWrap', 'convertProgWrap', 'resultWrap']
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const refresh = () => {
      const hasVisibleContent = dynamic.some((node) => !node.hidden);
      const resultVisible = !$('#resultWrap')?.hidden;
      const statusText = $('#status')?.textContent?.trim();
      const state = $('#ycrMessageState');
      const time = $('#ycrMessageTime');

      actions.hidden = !hasVisibleContent;
      $('#ycrDownloadResult').hidden = !resultVisible;
      if (state) state.textContent = resultVisible ? 'Selesai' : (statusText || 'Media Assistant');
      if (time) time.textContent = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date());
      $('#ycrAssistantStatus span:last-child')?.replaceChildren(document.createTextNode(resultVisible ? 'Konversi selesai' : 'Media Assistant siap'));
    };

    if (!assistant.dataset.ycrObserved) {
      assistant.dataset.ycrObserved = 'true';
      const observer = new MutationObserver(refresh);
      dynamic.forEach((node) => observer.observe(node, { attributes: true, childList: true, subtree: true, attributeFilter: ['hidden', 'style', 'class'] }));
      const status = $('#status');
      if (status) observer.observe(status, { childList: true, subtree: true });
    }

    const copy = $('#ycrCopyResponse');
    if (copy && !copy.dataset.bound) {
      copy.dataset.bound = 'true';
      copy.addEventListener('click', async () => {
        const text = assistantContent.innerText.trim();
        try {
          await navigator.clipboard.writeText(text);
          copy.innerHTML = '<i class="bi bi-check2"></i>';
          setTimeout(() => { copy.innerHTML = '<i class="bi bi-copy"></i>'; }, 1200);
        } catch {}
      });
    }

    const download = $('#ycrDownloadResult');
    if (download && !download.dataset.bound) {
      download.dataset.bound = 'true';
      download.addEventListener('click', () => $('#downloadLink')?.click());
    }

    const clear = $('#ycrClearChat');
    if (clear && !clear.dataset.bound) {
      clear.dataset.bound = 'true';
      clear.addEventListener('click', () => {
        $('#clearBtn')?.click();
        user.hidden = true;
        assistant.hidden = true;
        const conversation = $('#ycConversation');
        if (conversation) conversation.hidden = true;
        const welcome = $('#ycWelcome');
        welcome?.classList.remove('compact');
        $('#url')?.focus();
      });
    }

    refresh();
  };

  const tidySidebar = () => {
    const sidebar = $('#ytcleanSidebar');
    if (!sidebar) return;

    const sectionTitles = $$('.ytclean-sidebar-section-title', sidebar);
    sectionTitles.forEach((title) => {
      if (/ekosistem/i.test(title.textContent || '')) title.textContent = 'Lainnya';
    });

    const converter = $('.ytclean-nav .ytclean-link', sidebar);
    if (converter) {
      const label = $('.ytclean-label', converter);
      if (label) label.textContent = 'Percakapan baru';
    }
  };

  const apply = () => {
    addStyles();
    ensureHeader();
    tidySidebar();
    moveUtilityCards();
    ensureComposer();
    ensureOptionsSheet();
    ensureConversationDetails();
    document.documentElement.dataset.ytconvChatRealism = 'v5';
  };

  onReady(() => {
    apply();
    window.addEventListener('pageshow', apply, { passive: true });
    window.setTimeout(apply, 450);
    window.setTimeout(apply, 1300);
  });
})();