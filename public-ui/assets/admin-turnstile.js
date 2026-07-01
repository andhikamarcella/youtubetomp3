(function () {
  const TURNSTILE_SITE_KEY = "0x4AAAAAACJPcwOvzNFeWXfR";

  let widgetId = null;
  let token = "";

  function showTurnstileError(message) {
    const el = document.getElementById("admin-turnstile-error");
    if (!el) return;
    el.textContent = message || "Verifikasi keamanan diperlukan.";
    el.hidden = false;
  }

  function hideTurnstileError() {
    const el = document.getElementById("admin-turnstile-error");
    if (!el) return;
    el.hidden = true;
  }

  function renderAdminTurnstile() {
    const container = document.getElementById("admin-turnstile");
    if (!container) return;

    if (!window.turnstile) {
      setTimeout(renderAdminTurnstile, 300);
      return;
    }

    if (widgetId !== null) return;

    widgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback(value) {
        token = value || "";
        hideTurnstileError();
      },
      "expired-callback"() {
        token = "";
        showTurnstileError("Verifikasi kedaluwarsa. Silakan ulangi.");
      },
      "error-callback"() {
        token = "";
        showTurnstileError("Turnstile gagal dimuat. Coba refresh halaman.");
      },
    });
  }

  function getAdminTurnstileToken() {
    return token;
  }

  function resetAdminTurnstile() {
    token = "";

    if (window.turnstile && widgetId !== null) {
      window.turnstile.reset(widgetId);
    }
  }

  window.AdminTurnstile = {
    render: renderAdminTurnstile,
    getToken: getAdminTurnstileToken,
    reset: resetAdminTurnstile,
    showError: showTurnstileError,
    hideError: hideTurnstileError,
  };

  document.addEventListener("DOMContentLoaded", renderAdminTurnstile);
})();
