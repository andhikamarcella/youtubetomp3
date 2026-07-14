(() => {
  'use strict';
  const DESKTOP = 991.98;
  const STORE = 'ytconv.sidebar.collapsed';
  const $ = (s, r = document) => r.querySelector(s);
  const closest = (s, c) => $(s)?.closest(c) || null;

  function addStyles() {
    let tag = $('#ytconv-chat-layout-v4');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'ytconv-chat-layout-v4';
      document.head.appendChild(tag);
    }
    tag.textContent = `
      :root{--yc-bg:#212121;--yc-side:#171717;--yc-surface:#2f2f2f;--yc-hover:#383838;--yc-border:rgba(255,255,255,.1);--yc-muted:rgba(255,255,255,.62);--yc-red:#ff0033;--yc-side-w:260px;--yc-rail:72px}
      body.ytconv-chat-v4{background:var(--yc-bg)!important;min-height:100dvh}
      body.ytconv-chat-v4 .ytclean-sidebar{width:var(--yc-side-w)!important;padding:10px 12px 12px!important;background:var(--yc-side)!important;border-right:1px solid var(--yc-border)!important;overflow-x:visible!important;scrollbar-width:none}
      body.ytconv-chat-v4 .ytclean-sidebar::-webkit-scrollbar{display:none}
      body.ytconv-chat-v4.ytclean-main-offset{margin-left:var(--yc-side-w)!important}
      body.ytconv-chat-v4 .ytclean-sidebar>.d-flex:first-child{min-height:52px}
      body.ytconv-chat-v4 .ytclean-brand{min-width:0;min-height:44px!important;padding:4px 7px!important;border-radius:9px}
      body.ytconv-chat-v4 .ytclean-brand:hover{background:rgba(255,255,255,.06)}
      body.ytconv-chat-v4 .ytclean-brand-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      body.ytconv-chat-v4 .ytclean-nav{gap:2px!important}
      body.ytconv-chat-v4 .ytclean-sidebar-section{margin-top:10px!important;padding-top:10px!important;border-color:var(--yc-border)!important}
      body.ytconv-chat-v4 .ytclean-link{position:relative;min-height:40px!important;padding:8px 10px!important;border:1px solid transparent!important;border-radius:8px!important;background:transparent!important;font-size:14px!important;font-weight:500!important;transition:background-color .14s ease!important}
      body.ytconv-chat-v4 .ytclean-link:hover{transform:none!important;background:rgba(255,255,255,.07)!important}
      body.ytconv-chat-v4 .ytclean-link.is-active{background:rgba(255,255,255,.1)!important;border-color:transparent!important;box-shadow:none!important}
      body.ytconv-chat-v4 .ytclean-link i{width:20px!important;color:rgba(255,255,255,.72)!important}
      body.ytconv-chat-v4 #ytcleanSidebarMusic i{color:var(--yc-red)!important}

      body.ytconv-chat-v4.ytclean-collapsed .ytclean-sidebar{width:var(--yc-rail)!important;padding-inline:10px!important;overflow:visible!important}
      body.ytconv-chat-v4.ytclean-collapsed.ytclean-main-offset{margin-left:var(--yc-rail)!important}
      body.ytconv-chat-v4.ytclean-collapsed .ytclean-sidebar>.d-flex:first-child{flex-direction:column;justify-content:flex-start!important;gap:6px!important}
      body.ytconv-chat-v4.ytclean-collapsed .ytclean-brand{width:44px;height:44px;justify-content:center;padding:5px!important}
      body.ytconv-chat-v4.ytclean-collapsed #ytcleanCollapse{display:inline-grid!important;width:42px!important;height:42px!important;margin:0 auto 6px;border-radius:9px!important}
      body.ytconv-chat-v4.ytclean-collapsed .ytclean-label,body.ytconv-chat-v4.ytclean-collapsed .ytclean-brand-text,body.ytconv-chat-v4.ytclean-collapsed .ytclean-sidebar-section-title{display:none!important}
      body.ytconv-chat-v4.ytclean-collapsed .ytclean-sidebar-section,body.ytconv-chat-v4.ytclean-collapsed .ytclean-sidebar-footer{display:none!important}
      body.ytconv-chat-v4.ytclean-collapsed #ytcleanSidebar>.ytclean-nav>:nth-child(n+5){display:none!important}
      body.ytconv-chat-v4.ytclean-collapsed .ytclean-link{width:44px!important;height:44px!important;min-height:44px!important;justify-content:center!important;gap:0!important;margin:2px auto!important;padding:0!important;border-radius:10px!important}
      body.ytconv-chat-v4.ytclean-collapsed .ytclean-link i{width:auto!important;margin:0!important;font-size:17px}
      body.ytconv-chat-v4.ytclean-collapsed [data-yc-tip]::after{content:attr(data-yc-tip);position:absolute;left:calc(100% + 12px);top:50%;z-index:2147483000;transform:translateY(-50%) translateX(-4px);padding:7px 10px;border:1px solid var(--yc-border);border-radius:8px;background:#2f2f2f;color:#f4f4f4;font-size:13px;white-space:nowrap;opacity:0;visibility:hidden;pointer-events:none;transition:.12s}
      body.ytconv-chat-v4.ytclean-collapsed [data-yc-tip]:hover::after,body.ytconv-chat-v4.ytclean-collapsed [data-yc-tip]:focus-visible::after{opacity:1;visibility:visible;transform:translateY(-50%)}

      body.ytconv-chat-v4 #mainContent{width:min(100%,920px)!important;max-width:920px!important;padding:24px 24px 48px!important}
      body.ytconv-chat-v4 .section-header.ytconv-hero-clean{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center!important;gap:16px!important;margin:0 0 14px!important;padding:3px 2px 13px!important;border:0!important;background:transparent!important;box-shadow:none!important}
      body.ytconv-chat-v4 .section-header.ytconv-hero-clean>.ytconv-header-actions{display:flex!important}
      body.ytconv-chat-v4 .section-header.ytconv-hero-clean #activeSectionTitle{margin:0!important;font-size:20px!important;line-height:1.2!important;letter-spacing:-.025em!important;text-transform:none!important}
      body.ytconv-chat-v4 .section-header.ytconv-hero-clean #activeSectionSubtitle{display:none!important}
      body.ytconv-chat-v4 .ytconv-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}
      body.ytconv-chat-v4 .ytconv-header-action{min-height:38px!important;width:auto!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;padding:7px 12px!important;border:1px solid var(--yc-border)!important;border-radius:9px!important;background:transparent!important;color:#f4f4f4!important;font-size:13px!important;font-weight:600!important;box-shadow:none!important}
      body.ytconv-chat-v4 .ytconv-header-action:hover{transform:none!important;background:var(--yc-surface)!important}
      body.ytconv-chat-v4 .ytconv-header-action--music{color:#fff!important;background:var(--yc-red)!important;border-color:var(--yc-red)!important}

      body.ytconv-chat-v4 #advanced-mode>.row,body.ytconv-chat-v4 #advanced-mode>.row>.col-lg-7,body.ytconv-chat-v4 #advanced-mode>.row>.col-lg-7>.card{width:100%!important;max-width:100%!important}
      body.ytconv-chat-v4 #advanced-mode>.row>.col-lg-7>.card{border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
      body.ytconv-chat-v4 #advanced-mode>.row>.col-lg-7>.card>.card-body.yc-chat-body{padding:0!important}

      .yc-welcome{display:grid;place-items:center;min-height:230px;padding:28px 18px 22px;text-align:center}
      .yc-welcome.compact{min-height:90px;padding-block:8px 14px}.yc-welcome.compact .yc-welcome-copy,.yc-welcome.compact .yc-suggestions{display:none}
      .yc-welcome img{width:48px;height:48px;margin-bottom:16px;border-radius:14px;object-fit:contain}
      .yc-welcome h2{margin:0;color:#f4f4f4;font-size:clamp(25px,4vw,34px);line-height:1.18;letter-spacing:-.035em;font-weight:600}
      .yc-welcome p{max-width:560px;margin:10px auto 0;color:var(--yc-muted);font-size:14px;line-height:1.55}
      .yc-suggestions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:20px}
      .yc-suggestion{min-height:38px;padding:8px 12px;border:1px solid var(--yc-border);border-radius:10px;background:transparent;color:#ececec;font-size:13px;font-weight:500}.yc-suggestion:hover{background:var(--yc-surface)}

      .yc-conversation{display:grid;gap:18px;margin:4px 0 18px}.yc-message{display:flex;gap:12px;align-items:flex-start}.yc-user{justify-content:flex-end}.yc-avatar{width:30px;height:30px;flex:0 0 30px;border-radius:9px;object-fit:contain}.yc-content{max-width:min(82%,690px);color:#ececec}.yc-user .yc-content{padding:10px 14px;border-radius:18px;background:var(--yc-surface);overflow-wrap:anywhere}.yc-assistant .yc-content{flex:1;max-width:calc(100% - 42px)}.yc-pending{padding:8px 0;color:var(--yc-muted);font-size:14px}

      .yc-composer{position:sticky;bottom:16px;z-index:20;margin:0 auto 14px!important;padding:10px 12px 9px;border:1px solid var(--yc-border);border-radius:24px;background:var(--yc-surface);box-shadow:0 8px 28px rgba(0,0,0,.2)}
      .yc-composer>label,.yc-composer #urlHelp{display:none!important}.yc-composer .input-group{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto auto auto;align-items:center;gap:4px}.yc-composer .input-group-text{width:38px;height:38px;display:grid;place-items:center;padding:0;border:0!important;border-radius:50%!important;background:transparent!important;color:var(--yc-muted)!important}
      body.ytconv-chat-v4 .yc-composer #url{min-height:46px!important;padding:8px 4px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#f4f4f4!important;font-size:15px}
      .yc-composer #pasteBtn,.yc-composer #sampleBtn{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;display:grid!important;place-items:center;border:0!important;border-radius:50%!important;background:transparent!important;color:var(--yc-muted)!important}.yc-composer #sampleBtn{width:auto!important;padding:0 9px!important;border-radius:10px!important;font-size:12px}
      .yc-composer #convertBtn{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;display:grid!important;place-items:center;border:0!important;border-radius:50%!important;background:#f4f4f4!important;color:#1f1f1f!important;box-shadow:none!important}.yc-composer #convertBtn:hover{background:#fff!important}
      .yc-composer-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 5px 0;color:var(--yc-muted);font-size:11px}.yc-options-button{border:0;background:transparent;color:var(--yc-muted);font-size:11px;font-weight:600}.yc-options-button:hover{color:#f4f4f4}

      .yc-options{margin:0 0 20px;border:1px solid var(--yc-border);border-radius:14px;background:rgba(255,255,255,.025);overflow:hidden}.yc-options>summary{display:flex;align-items:center;gap:9px;min-height:48px;padding:11px 14px;cursor:pointer;color:#ececec;font-size:14px;font-weight:600;list-style:none}.yc-options>summary::-webkit-details-marker{display:none}.yc-options>summary::after{content:'›';margin-left:auto;font-size:20px;transform:rotate(90deg)}.yc-options[open]>summary::after{transform:rotate(-90deg)}.yc-options-content{padding:8px 16px 16px;border-top:1px solid var(--yc-border)}
      body.ytconv-chat-v4 .yc-options .card,body.ytconv-chat-v4 .yc-options .form-control,body.ytconv-chat-v4 .yc-options .form-select,body.ytconv-chat-v4 .yc-assistant .card{border-color:var(--yc-border)!important;background:#272727!important;box-shadow:none!important}
      body.ytconv-chat-v4 #aiStudioCard,body.ytconv-chat-v4 #subtitleCard{border-color:var(--yc-border)!important;background:rgba(255,255,255,.025)!important;box-shadow:none!important}

      [data-bs-theme=light] body.ytconv-chat-v4{--yc-bg:#fff;--yc-side:#f7f7f8;--yc-surface:#f4f4f4;--yc-hover:#e9e9e9;--yc-border:rgba(0,0,0,.1);--yc-muted:rgba(0,0,0,.58)}
      [data-bs-theme=light] body.ytconv-chat-v4 .ytclean-link:hover,[data-bs-theme=light] body.ytconv-chat-v4 .ytclean-link.is-active{background:rgba(0,0,0,.06)!important}
      [data-bs-theme=light] .yc-welcome h2,[data-bs-theme=light] .yc-suggestion,[data-bs-theme=light] .yc-content,[data-bs-theme=light] .yc-options>summary{color:#202123}[data-bs-theme=light] body.ytconv-chat-v4 .ytconv-header-action,[data-bs-theme=light] body.ytconv-chat-v4 .yc-composer #url{color:#202123!important}[data-bs-theme=light] body.ytconv-chat-v4 .yc-options .card,[data-bs-theme=light] body.ytconv-chat-v4 .yc-options .form-control,[data-bs-theme=light] body.ytconv-chat-v4 .yc-options .form-select,[data-bs-theme=light] body.ytconv-chat-v4 .yc-assistant .card{background:#fff!important}

      @media(max-width:${DESKTOP}px){body.ytconv-chat-v4.ytclean-main-offset{margin-left:0!important}body.ytconv-chat-v4.ytclean-collapsed .ytclean-sidebar{width:min(86vw,310px)!important}body.ytconv-chat-v4 #mainContent{width:100%!important;padding:calc(var(--ytclean-mobilebar-total-height) + 14px) 14px 28px!important}body.ytconv-chat-v4 .section-header.ytconv-hero-clean{grid-template-columns:1fr}.yc-welcome{min-height:190px;padding-inline:8px}.yc-composer{bottom:10px;border-radius:20px}}
      @media(max-width:560px){body.ytconv-chat-v4 .ytconv-header-actions{width:100%}body.ytconv-chat-v4 .ytconv-header-action{flex:1}.yc-composer .input-group{grid-template-columns:auto minmax(0,1fr) auto auto}.yc-composer #sampleBtn{display:none!important}.yc-content{max-width:88%}}
      @media(prefers-reduced-motion:reduce){body.ytconv-chat-v4 *,body.ytconv-chat-v4 *::before,body.ytconv-chat-v4 *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
    `;
  }

  function sidebar() {
    const side = $('#ytcleanSidebar');
    const toggle = $('#ytcleanCollapse');
    if (!side || !toggle) return;
    const first = $('.ytclean-nav .ytclean-link', side);
    if (first) {
      const label = $('.ytclean-label', first);
      const icon = $('i', first);
      if (label) label.textContent = 'Konversi baru';
      if (icon) icon.className = 'bi bi-pencil-square';
    }
    side.querySelectorAll('.ytclean-link,.ytclean-icon-btn,.ytclean-brand').forEach((el) => {
      const text = el.querySelector('.ytclean-label,.ytclean-brand-text')?.textContent?.trim() || el.getAttribute('aria-label') || el.title;
      if (text) { el.dataset.ycTip = text; el.title = text; }
    });
    const sync = () => {
      const closed = document.body.classList.contains('ytclean-collapsed');
      toggle.setAttribute('aria-label', closed ? 'Buka sidebar' : 'Tutup sidebar');
      toggle.title = closed ? 'Buka sidebar' : 'Tutup sidebar';
      toggle.dataset.ycTip = toggle.title;
      toggle.innerHTML = `<i class="bi ${closed ? 'bi-layout-sidebar-inset-reverse' : 'bi-layout-sidebar-inset'}"></i>`;
      try { localStorage.setItem(STORE, closed ? '1' : '0'); } catch {}
    };
    if (innerWidth > DESKTOP && !document.documentElement.dataset.ycSideLoaded) {
      document.documentElement.dataset.ycSideLoaded = '1';
      let saved = null; try { saved = localStorage.getItem(STORE); } catch {}
      if (saved === '1') document.body.classList.add('ytclean-collapsed');
      else document.body.classList.remove('ytclean-collapsed');
    }
    if (!toggle.dataset.ycBound) {
      toggle.dataset.ycBound = '1';
      toggle.addEventListener('click', () => setTimeout(sync));
      new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    sync();
  }

  function header() {
    const h = $('#mainContent .section-header');
    if (!h) return;
    h.classList.add('ytconv-hero-clean');
    const title = $('#activeSectionTitle');
    if (title && /converter/i.test(title.textContent || '')) title.textContent = 'YTConv';
    const music = $('#ytconvHeaderMusic');
    const mode = $('#headerModeToggle');
    if (mode) {
      mode.className = 'ytconv-header-action';
      mode.innerHTML = '<i class="bi bi-sliders"></i><span>Opsi</span>';
      mode.setAttribute('aria-label', 'Buka opsi converter');
    }
    if (music) music.classList.add('ytconv-header-action', 'ytconv-header-action--music');
  }

  function optionsNodes() {
    const usage = $('#usageBadges');
    return [...new Set([
      $('#walkthroughTrigger')?.closest('.d-flex'), closest('#vpnFriendly', '.row'), usage, usage?.nextElementSibling,
      closest('#keywordInput', '.mb-3'), closest('#playlist', '.mb-3'), closest('#format', '.row'), $('#videoOptions'),
      closest('#noPlaylist', '.row'), closest('#autoDownload', '.row'), closest('#trimStart', '.row'), closest('#fileName', '.mb-3'),
      closest('#id3Title', '.mb-3'), closest('#convertServerMode', '.row'), closest('#normalize', '.form-check'), closest('#atmos', '.form-check'),
      closest('#denoise', '.row'), $('#ringtoneCard'), $('#dropzone'), $('#turnstile-container')?.closest('.d-grid'), $('#downloadAllBtn')?.closest('.d-grid.d-sm-flex')
    ].filter(Boolean))];
  }

  function chat() {
    const input = $('#url');
    const body = input?.closest('.card-body');
    const block = input?.closest('.mb-3');
    const group = input?.closest('.input-group');
    const convert = $('#convertBtn');
    if (!input || !body || !block || !group || !convert) return;
    document.body.classList.add('ytconv-chat-v4');
    body.classList.add('yc-chat-body');

    let welcome = $('#ycWelcome');
    if (!welcome) {
      welcome = document.createElement('section'); welcome.id = 'ycWelcome'; welcome.className = 'yc-welcome';
      welcome.innerHTML = `<div><img src="/logo.svg" onerror="this.onerror=null;this.src='/icons/icon.svg'" alt=""><div class="yc-welcome-copy"><h2>Apa yang ingin kamu konversi?</h2><p>Tempel tautan media atau cari judul lagu. YTConv akan membantu memilih format dan memprosesnya.</p></div><div class="yc-suggestions"><button class="yc-suggestion" data-yc="paste" type="button"><i class="bi bi-clipboard2 me-1"></i>Tempel tautan</button><button class="yc-suggestion" data-yc="search" type="button"><i class="bi bi-search me-1"></i>Cari lagu</button><button class="yc-suggestion" data-yc="music" type="button"><i class="bi bi-youtube me-1"></i>Buka YT Music</button></div></div>`;
      body.prepend(welcome);
    }

    let convo = $('#ycConversation');
    if (!convo) {
      convo = document.createElement('section'); convo.id = 'ycConversation'; convo.className = 'yc-conversation'; convo.hidden = true;
      convo.innerHTML = `<div class="yc-message yc-user" id="ycUser" hidden><div class="yc-content"></div></div><div class="yc-message yc-assistant" id="ycAssistant" hidden><img class="yc-avatar" src="/logo.svg" onerror="this.onerror=null;this.src='/icons/icon.svg'" alt=""><div class="yc-content"><div class="yc-pending" id="ycPending">Sedang menyiapkan konversi...</div></div></div>`;
      welcome.after(convo);
    }

    block.classList.add('yc-composer');
    if (convo.nextElementSibling !== block) convo.after(block);
    if (convert.parentElement !== group) group.appendChild(convert);
    convert.innerHTML = '<i class="bi bi-arrow-up"></i><span class="visually-hidden">Konversi</span>';
    convert.setAttribute('aria-label', 'Mulai konversi');

    let footer = $('.yc-composer-footer', block);
    if (!footer) {
      footer = document.createElement('div'); footer.className = 'yc-composer-footer';
      footer.innerHTML = '<span>Periksa kembali tautan sebelum mengunduh.</span><button class="yc-options-button" id="ycOptionsButton" type="button"><i class="bi bi-sliders me-1"></i>Opsi lanjutan</button>';
      block.appendChild(footer);
    }

    let panel = $('#ycOptions');
    if (!panel) {
      panel = document.createElement('details'); panel.id = 'ycOptions'; panel.className = 'yc-options';
      panel.innerHTML = '<summary><i class="bi bi-sliders"></i>Opsi lanjutan dan pencarian</summary><div class="yc-options-content"></div>';
      block.after(panel);
    }
    const panelBody = $('.yc-options-content', panel);
    optionsNodes().forEach((n) => { if (n !== panel && !n.closest('#ycConversation')) panelBody.appendChild(n); });

    const assistantContent = $('#ycAssistant .yc-content');
    const dynamic = ['searchResultsWrap','previewWrap','statusWrap','convertProgWrap','resultWrap'].map((id) => document.getElementById(id)).filter(Boolean);
    dynamic.forEach((n) => { if (n.parentElement !== assistantContent) assistantContent.appendChild(n); });

    const user = $('#ycUser'), assistant = $('#ycAssistant'), pending = $('#ycPending');
    const sync = () => {
      const visible = dynamic.some((n) => !n.hidden);
      const waiting = convo.dataset.waiting === '1';
      assistant.hidden = !(visible || waiting); pending.hidden = visible || !waiting;
      convo.hidden = user.hidden && assistant.hidden;
      welcome.classList.toggle('compact', !convo.hidden || !!input.value.trim());
    };

    if (!convo.dataset.bound) {
      convo.dataset.bound = '1';
      const obs = new MutationObserver(sync); dynamic.forEach((n) => obs.observe(n, { attributes: true, attributeFilter: ['hidden','style','class'], subtree: true }));
      convert.addEventListener('click', () => {
        $('.yc-content', user).textContent = input.value.trim() || 'Mulai konversi dengan pengaturan saat ini';
        user.hidden = false; convo.dataset.waiting = '1'; sync(); setTimeout(() => assistant.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      });
      $('#clearBtn')?.addEventListener('click', () => { convo.dataset.waiting = '0'; user.hidden = true; setTimeout(sync); });
      input.addEventListener('input', sync);
    }

    const optionButton = $('#ycOptionsButton');
    if (optionButton && !optionButton.dataset.bound) {
      optionButton.dataset.bound = '1';
      optionButton.addEventListener('click', () => { panel.open = !panel.open; optionButton.innerHTML = panel.open ? '<i class="bi bi-chevron-up me-1"></i>Tutup opsi' : '<i class="bi bi-sliders me-1"></i>Opsi lanjutan'; if (panel.open) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    }
    const mode = $('#headerModeToggle');
    if (mode && !mode.dataset.ycPanel) { mode.dataset.ycPanel = '1'; mode.addEventListener('click', () => setTimeout(() => { panel.open = true; panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); })); }

    welcome.querySelectorAll('[data-yc]').forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = '1';
      b.addEventListener('click', () => {
        if (b.dataset.yc === 'paste') $('#pasteBtn')?.click();
        if (b.dataset.yc === 'music') $('#ytconvHeaderMusic')?.click();
        if (b.dataset.yc === 'search') { panel.open = true; setTimeout(() => $('#keywordInput')?.focus(), 50); }
        if (b.dataset.yc !== 'music') setTimeout(() => input.focus(), 50);
      });
    });
    input.placeholder = 'Kirim tautan YouTube, YT Music, Spotify, atau SoundCloud';
    sync();
  }

  function apply() { addStyles(); sidebar(); header(); chat(); document.documentElement.dataset.ytconvChatLayout = 'v4'; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true }); else apply();
  addEventListener('pageshow', apply, { passive: true });
  setTimeout(apply, 500); setTimeout(apply, 1400);
})();