(() => {
  const safeText = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const fmtTime = (ts) => {
    try {
      const ms = ts?.toMillis?.() ? ts.toMillis() : 0;
      if (!ms) return "";
      return new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const waitForFirebase = ({ timeoutMs = 15000 } = {}) =>
    new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const m = window.firebaseModules;
        if (m?.db && m?.auth && m?.collection && m?.addDoc && m?.serverTimestamp && m?.onSnapshot && m?.query) {
          resolve(m);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error("Firebase belum siap"));
          return;
        }
        setTimeout(tick, 250);
      };
      tick();
    });

  const els = () => ({
    widget: document.getElementById("forumWidget"),
    panel: document.getElementById("forumWidgetPanel"),
    toggle: document.getElementById("forumWidgetToggle"),
    close: document.getElementById("forumWidgetClose"),
    loginOverlay: document.getElementById("forumWidgetLogin"),
    loginBtn: document.getElementById("forumWidgetLoginBtn"),
    messages: document.getElementById("forumWidgetMessages"),
    input: document.getElementById("forumWidgetInput"),
    send: document.getElementById("forumWidgetSend"),
    status: document.getElementById("forumWidgetStatus"),
  });

  const state = {
    inited: false,
    currentUser: null,
    unsubscribe: null,
    stickBottom: true,
  };

  const setPinned = (pinned) => {
    const { widget, toggle, status } = els();
    if (!widget) return;
    widget.classList.toggle("pinned", Boolean(pinned));
    if (toggle) {
      toggle.setAttribute("aria-expanded", pinned ? "true" : "false");
      const statusEl = status || document.getElementById("forumWidgetStatus");
      toggle.innerHTML = pinned
        ? '<i class="bi bi-x-lg"></i> Tutup'
        : '<i class="bi bi-chat-dots-fill"></i> Forum';
      if (statusEl) {
        statusEl.hidden = !Boolean(state.currentUser);
        statusEl.className = "badge text-bg-success ms-1";
        statusEl.id = "forumWidgetStatus";
        toggle.appendChild(statusEl);
      }
    }
  };

  const setLoginState = (loggedIn) => {
    const { loginOverlay, input, send, status } = els();
    if (loginOverlay) loginOverlay.hidden = loggedIn;
    if (input) input.disabled = !loggedIn;
    if (send) send.disabled = !loggedIn;
    if (status) status.hidden = !loggedIn;
  };

  const scrollToBottom = () => {
    const { messages } = els();
    if (!messages) return;
    messages.scrollTop = messages.scrollHeight;
  };

  const render = (docs) => {
    const { messages } = els();
    if (!messages) return;
    const atBottom =
      Math.abs(messages.scrollTop + messages.clientHeight - messages.scrollHeight) < 24;
    state.stickBottom = atBottom || state.stickBottom;

    const html = docs
      .map((docSnap) => {
        const data = docSnap.data?.() || {};
        const uid = String(data.uid || "");
        const me = state.currentUser && uid && uid === state.currentUser.uid;
        const name = safeText(data.name || "Warga");
        const text = safeText(data.text || "");
        const time = safeText(fmtTime(data.timestamp));
        return `
          <div class="forum-widget-msg ${me ? "me" : "other"}">
            <div class="forum-widget-bubble">
              <div class="small fw-semibold">${name}</div>
              <div>${text}</div>
              <div class="forum-widget-meta"><span>${time}</span></div>
            </div>
          </div>
        `;
      })
      .join("");

    messages.innerHTML = html || `<div class="text-center text-secondary small">Belum ada chat. Mulai duluan ya.</div>`;
    if (state.stickBottom) scrollToBottom();
  };

  const startListener = async () => {
    const m = await waitForFirebase();
    const { db, collection, query, where, orderBy, limit, onSnapshot } = m;
    if (typeof where !== "function") return;

    if (state.unsubscribe) {
      try {
        state.unsubscribe();
      } catch {}
      state.unsubscribe = null;
    }

    const colRef = collection(db, "forum-messages");
    const q = query(colRef, where("room", "==", "umum"), orderBy("timestamp", "desc"), limit(200));
    state.unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = Array.from(snapshot.docs || []).slice().reverse();
      render(docs);
    });
  };

  const sendMessage = async () => {
    const { input, send } = els();
    if (!input || !send) return;
    const text = input.value.trim();
    if (!text) return;
    if (!state.currentUser) return;

    const m = await waitForFirebase();
    const { db, collection, addDoc, serverTimestamp } = m;

    send.disabled = true;
    try {
      await addDoc(collection(db, "forum-messages"), {
        text,
        uid: state.currentUser.uid,
        name: state.currentUser.displayName || "Warga",
        timestamp: serverTimestamp(),
        room: "umum",
      });
      input.value = "";
      state.stickBottom = true;
      scrollToBottom();
    } catch {
      if (typeof window.setToast === "function") window.setToast("Gagal kirim chat.", "danger");
    } finally {
      send.disabled = false;
    }
  };

  const init = async () => {
    if (state.inited) return;
    state.inited = true;

    const { messages, input, send, loginBtn, close, panel } = els();
    if (!panel) return;

    if (close) close.addEventListener("click", () => window.toggleForumWidget(false));
    if (send) send.addEventListener("click", sendMessage);
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    if (messages) {
      messages.addEventListener("scroll", () => {
        const atBottom =
          Math.abs(messages.scrollTop + messages.clientHeight - messages.scrollHeight) < 24;
        state.stickBottom = atBottom;
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener("click", async () => {
        try {
          const m = await waitForFirebase();
          const { auth, signInWithPopup, signInWithRedirect, GoogleAuthProvider } = m;
          loginBtn.disabled = true;
          loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>...';
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          try {
            await signInWithPopup(auth, provider);
          } catch {
            await signInWithRedirect(auth, provider);
          }
        } catch {
          if (typeof window.setToast === "function") window.setToast("Login gagal.", "danger");
        } finally {
          loginBtn.disabled = false;
          loginBtn.innerHTML =
            '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G" class="me-2">Masuk dengan Google';
        }
      });
    }

    try {
      const m = await waitForFirebase();
      const { auth, onAuthStateChanged } = m;
      onAuthStateChanged(auth, (user) => {
        state.currentUser = user || null;
        setLoginState(Boolean(state.currentUser));
        startListener().catch(() => {});
      });
      setLoginState(Boolean(auth.currentUser));
      startListener().catch(() => {});
    } catch {
      setLoginState(false);
    }
  };

  window.toggleForumWidget = (forceOpen = null) => {
    const { widget, input } = els();
    if (!widget) return;
    const shouldPin = forceOpen === null ? !widget.classList.contains("pinned") : Boolean(forceOpen);
    setPinned(shouldPin);
    if (shouldPin) {
      init().catch(() => {});
      if (input && !input.disabled) input.focus();
    }
  };

  window.initForumWidget = () => init().catch(() => {});

  document.addEventListener("DOMContentLoaded", () => {
    const { toggle, widget } = els();
    if (toggle) toggle.addEventListener("click", () => window.toggleForumWidget());
    if (widget) widget.addEventListener("pointerenter", () => init().catch(() => {}), { once: true });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") window.toggleForumWidget(false);
    });
  });
})();

