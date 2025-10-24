(() => {
  const globalKey = '__ytmp3ExtensionInjected__';
  if (window[globalKey]) return;
  window[globalKey] = true;

  const BUTTON_ID = 'ytmp3-convert-button';
  const STYLE_ID = 'ytmp3-convert-style';
  const CONVERTER_ORIGIN = 'https://mis-ytmp3-backend.onrender.com/';

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        align-items: center;
        background: linear-gradient(135deg, #0d6efd, #6610f2);
        border: none;
        border-radius: 999px;
        color: #fff;
        cursor: pointer;
        display: inline-flex;
        font-family: inherit;
        font-size: 14px;
        font-weight: 600;
        gap: 0.35rem;
        letter-spacing: 0.01em;
        line-height: 1;
        padding: 8px 16px;
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        white-space: nowrap;
      }
      #${BUTTON_ID}:hover {
        opacity: 0.92;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(13, 110, 253, 0.35);
      }
      #${BUTTON_ID}:focus-visible {
        outline: 3px solid rgba(13, 110, 253, 0.55);
        outline-offset: 2px;
      }
      #${BUTTON_ID} .ytmp3-icon {
        font-size: 16px;
      }
      html[dark] #${BUTTON_ID},
      html.dark #${BUTTON_ID},
      body.dark #${BUTTON_ID} {
        color: #0b1120;
        background: linear-gradient(135deg, #a5b4fc, #c7d2fe);
        box-shadow: none;
      }
      html[dark] #${BUTTON_ID}:hover,
      html.dark #${BUTTON_ID}:hover,
      body.dark #${BUTTON_ID}:hover {
        opacity: 1;
        box-shadow: 0 6px 18px rgba(165, 180, 252, 0.35);
      }
      @media (max-width: 640px) {
        #${BUTTON_ID} {
          font-size: 13px;
          padding: 6px 12px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const buildButton = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'ytmp3-convert-button';
    button.setAttribute('aria-label', 'Convert video to MP3 with YTMP3');
    button.innerHTML = '<span class="ytmp3-icon">🎧</span><span>Convert MP3</span>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const watchUrl = window.location.href;
      const target = `${CONVERTER_ORIGIN}?url=${encodeURIComponent(watchUrl)}`;
      window.open(target, '_blank', 'noopener');
    });
    return button;
  };

  const findContainer = () => {
    return (
      document.querySelector('#actions ytd-menu-renderer #top-level-buttons-computed') ||
      document.querySelector('#actions #top-level-buttons-computed') ||
      document.querySelector('#info-contents #menu-container #top-level-buttons-computed') ||
      document.querySelector('#owner #top-level-buttons-computed')
    );
  };

  const onWatchPage = () => /\/watch/.test(window.location.pathname);

  const injectButton = () => {
    if (!onWatchPage()) return;
    ensureStyle();
    const container = findContainer();
    if (!container) return;
    if (container.querySelector(`#${BUTTON_ID}`)) return;
    const button = buildButton();
    if (container.firstElementChild) {
      container.insertBefore(button, container.firstElementChild);
    } else {
      container.appendChild(button);
    }
  };

  const debouncedInject = (() => {
    let frame = null;
    return () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        injectButton();
      });
    };
  })();

  const observer = new MutationObserver(() => {
    debouncedInject();
  });

  const observeTarget = () => {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
  };

  document.addEventListener('yt-navigate-finish', debouncedInject);
  document.addEventListener('spfdone', debouncedInject);
  document.addEventListener('DOMContentLoaded', debouncedInject);
  window.addEventListener('load', debouncedInject);

  observeTarget();
  debouncedInject();
})();
