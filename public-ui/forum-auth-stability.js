(() => {
  const VERSION = 'v1';
  const BUTTON_SELECTOR = '#googleSignInBtn, #forumGoogleLoginBtn';
  const STATUS_ID = 'ytconvForumAuthStabilityStatus';
  const MODULE_WAIT_MS = 15000;

  if (window.__ytconvForumAuthStabilityV1) return;
  window.__ytconvForumAuthStabilityV1 = true;
  window.__ytconvForumAuthPopupFirst = true;

  let authInFlight = false;
  let authObserverInstalled = false;
  const buttonSnapshots = new WeakMap();

  const getModules = () => {
    const modules = window.firebaseModules;
    if (!modules?.auth) return null;
    if (typeof modules.signInWithPopup !== 'function') return null;
    if (typeof modules.GoogleAuthProvider !== 'function') return null;
    return modules;
  };

  const clearStaleRedirectState = () => {
    try {
      const staleKeys = [];
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (!key) continue;
        if (/forum.*(?:login|auth|redirect|pending)|(?:login|auth|redirect|pending).*forum/i.test(key)) {
          staleKeys.push(key);
        }
      }
      staleKeys.forEach((key) => sessionStorage.removeItem(key));
    } catch {
      // Storage can be unavailable in hardened/private browser modes.
    }
  };

  const injectStyle = () => {
    if (document.getElementById('ytconv-forum-auth-stability-style')) return;
    const style = document.createElement('style');
    style.id = 'ytconv-forum-auth-stability-style';
    style.textContent = `
      #${STATUS_ID} {
        width: 100%;
        margin: 12px 0;
        padding: 12px 14px;
        border: 1px solid var(--ytconv-dialog-border, rgba(148, 163, 184, .28));
        border-radius: 14px;
        background: var(--ytconv-dialog-surface-soft, rgba(15, 23, 42, .08));
        color: var(--ytconv-dialog-text, inherit);
        font-size: .95rem;
        font-weight: 650;
        line-height: 1.5;
        text-align: left;
      }

      #${STATUS_ID}[data-tone="success"] {
        border-color: color-mix(in srgb, #16a34a 48%, transparent);
        background: color-mix(in srgb, #16a34a 12%, transparent);
      }

      #${STATUS_ID}[data-tone="danger"] {
        border-color: color-mix(in srgb, #ef4444 48%, transparent);
        background: color-mix(in srgb, #ef4444 12%, transparent);
      }

      #${STATUS_ID}[data-tone="info"] {
        border-color: color-mix(in srgb, #2563eb 48%, transparent);
        background: color-mix(in srgb, #2563eb 12%, transparent);
      }

      ${BUTTON_SELECTOR}[aria-busy="true"] {
        cursor: wait !important;
        opacity: .78 !important;
      }
    `;
    document.head.appendChild(style);
  };

  const loginButtons = () => Array.from(document.querySelectorAll(BUTTON_SELECTOR));

  const statusFor = (button) => {
    let status = document.getElementById(STATUS_ID);
    if (status) return status;

    status = document.createElement('div');
    status.id = STATUS_ID;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    const host = button?.parentElement || document.querySelector('#forumModal .modal-body');
    if (button?.parentElement) button.parentElement.insertBefore(status, button);
    else host?.prepend(status);
    return status;
  };

  const setStatus = (button, message, tone = 'info') => {
    injectStyle();
    const status = statusFor(button);
    if (!status) return;
    status.dataset.tone = tone;
    status.textContent = message;
    status.hidden = false;
  };

  const hideLegacyRedirectLoopMessage = () => {
    const modal = document.getElementById('forumModal');
    if (!modal) return;

    const candidates = Array.from(modal.querySelectorAll('p, div, small, span'));
    candidates.forEach((element) => {
      if (element.id === STATUS_ID) return;
      if (element.children.length > 0) return;
      const text = String(element.textContent || '').trim();
      if (!/login belum selesai|sistem akan coba popup dulu|mode mobile:\s*mengalihkan/i.test(text)) return;
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
      element.dataset.ytconvLegacyAuthMessageHidden = 'true';
    });
  };

  const setButtonBusy = (button, busy) => {
    if (!button) return;

    if (busy) {
      if (!buttonSnapshots.has(button)) {
        buttonSnapshots.set(button, {
          html: button.innerHTML,
          disabled: button.disabled,
          ariaDisabled: button.getAttribute('aria-disabled'),
        });
      }
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      button.style.setProperty('pointer-events', 'none', 'important');
      const label = button.querySelector('span');
      if (label) label.textContent = 'Membuka Google...';
      return;
    }

    const snapshot = buttonSnapshots.get(button);
    if (snapshot) {
      button.innerHTML = snapshot.html;
      button.disabled = snapshot.disabled;
      if (snapshot.ariaDisabled == null) button.removeAttribute('aria-disabled');
      else button.setAttribute('aria-disabled', snapshot.ariaDisabled);
      buttonSnapshots.delete(button);
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }
    button.removeAttribute('aria-busy');
    button.style.removeProperty('pointer-events');
  };

  const authErrorMessage = (error) => {
    const code = String(error?.code || 'auth/unknown').toLowerCase();
    if (code === 'auth/unauthorized-domain') {
      return `Domain ${location.hostname} belum diizinkan di Firebase Authentication. Tambahkan domain ini ke Authorized domains.`;
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Login Google belum diaktifkan di Firebase Authentication.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Popup Google diblokir browser. Izinkan pop-up untuk ytconv.onrender.com, lalu tekan tombol sekali lagi.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Jendela Google ditutup sebelum login selesai. Tekan tombol sekali lagi dan selesaikan pilihan akun.';
    }
    if (code === 'auth/cancelled-popup-request') {
      return 'Ada percobaan login lain yang masih berjalan. Tunggu sebentar lalu tekan tombol sekali.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Koneksi ke Firebase gagal. Periksa jaringan lalu coba kembali.';
    }
    if (code === 'auth/web-storage-unsupported') {
      return 'Browser memblokir penyimpanan yang dibutuhkan untuk login. Aktifkan cookie dan jangan gunakan mode samaran.';
    }
    return error?.message || 'Login Google belum berhasil. Silakan coba sekali lagi.';
  };

  const waitForModules = () => new Promise((resolve) => {
    const existing = getModules();
    if (existing) {
      resolve(existing);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const modules = getModules();
      if (modules || Date.now() - startedAt >= MODULE_WAIT_MS) {
        window.clearInterval(timer);
        resolve(modules);
      }
    }, 120);
  });

  const installAuthObserver = async () => {
    if (authObserverInstalled) return;
    const modules = await waitForModules();
    if (!modules || typeof modules.onAuthStateChanged !== 'function') return;

    authObserverInstalled = true;
    modules.onAuthStateChanged(modules.auth, (user) => {
      if (!user) return;
      authInFlight = false;
      clearStaleRedirectState();
      hideLegacyRedirectLoopMessage();
      loginButtons().forEach((button) => setButtonBusy(button, false));
      const button = loginButtons()[0];
      setStatus(button, 'Login berhasil. Membuka Forum Warga...', 'success');
      window.dispatchEvent(new CustomEvent('ytconv:forum-auth-success', { detail: { uid: user.uid } }));
    });
  };

  const beginPopupLogin = (event, button) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (authInFlight) {
      setStatus(button, 'Login Google masih dibuka. Selesaikan jendela Google yang sedang tampil.', 'info');
      return;
    }

    const modules = getModules();
    if (!modules) {
      setStatus(button, 'Firebase masih disiapkan. Tunggu sebentar, lalu tekan tombol sekali lagi.', 'danger');
      void installAuthObserver();
      return;
    }

    clearStaleRedirectState();
    hideLegacyRedirectLoopMessage();

    const provider = new modules.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    authInFlight = true;
    setButtonBusy(button, true);
    setStatus(button, 'Pilih akun di jendela Google. Halaman ini tidak akan dialihkan atau refresh berulang.', 'info');

    let popupPromise;
    try {
      // This call must happen synchronously inside the trusted click event.
      // Do not await readiness or any other promise before opening the popup.
      popupPromise = modules.signInWithPopup(modules.auth, provider);
    } catch (error) {
      authInFlight = false;
      setButtonBusy(button, false);
      setStatus(button, authErrorMessage(error), 'danger');
      console.error('[forum-auth-stability] Popup could not start', error);
      return;
    }

    Promise.resolve(popupPromise)
      .then((result) => {
        if (!result?.user && !modules.auth.currentUser) {
          throw Object.assign(new Error('Firebase tidak mengembalikan pengguna setelah popup selesai.'), { code: 'auth/no-user' });
        }
        clearStaleRedirectState();
        hideLegacyRedirectLoopMessage();
        setStatus(button, 'Login berhasil. Membuka Forum Warga...', 'success');
        window.dispatchEvent(new CustomEvent('ytconv:forum-auth-success', {
          detail: { uid: result?.user?.uid || modules.auth.currentUser?.uid || null },
        }));
      })
      .catch((error) => {
        setStatus(button, authErrorMessage(error), 'danger');
        console.error('[forum-auth-stability] Google popup login failed', error?.code, error);
      })
      .finally(() => {
        authInFlight = false;
        loginButtons().forEach((candidate) => setButtonBusy(candidate, false));
      });
  };

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.(BUTTON_SELECTOR);
    if (!button) return;
    beginPopupLogin(event, button);
  }, true);

  const boot = () => {
    injectStyle();
    clearStaleRedirectState();
    hideLegacyRedirectLoopMessage();
    void installAuthObserver();

    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        hideLegacyRedirectLoopMessage();
        void installAuthObserver();
      }, 60);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('pageshow', schedule);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
