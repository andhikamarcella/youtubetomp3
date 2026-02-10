(() => {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const readPos = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.x !== "number" || typeof obj.y !== "number") return null;
      return obj;
    } catch {
      return null;
    }
  };

  const writePos = (key, pos) => {
    try {
      localStorage.setItem(key, JSON.stringify({ x: pos.x, y: pos.y }));
    } catch {}
  };

  const resolveDefault = (targetEl, def) => {
    const w = targetEl.offsetWidth || 56;
    const h = targetEl.offsetHeight || 56;
    const pad = 8;

    if (def && typeof def.left === "number" && typeof def.top === "number") {
      return {
        x: clamp(def.left, pad, window.innerWidth - w - pad),
        y: clamp(def.top, pad, window.innerHeight - h - pad),
      };
    }
    const right = typeof def?.right === "number" ? def.right : 20;
    const bottom = typeof def?.bottom === "number" ? def.bottom : 20;
    return {
      x: clamp(window.innerWidth - right - w, pad, window.innerWidth - w - pad),
      y: clamp(window.innerHeight - bottom - h, pad, window.innerHeight - h - pad),
    };
  };

  const setPos = (targetEl, pos) => {
    targetEl.style.position = "fixed";
    targetEl.style.left = `${Math.round(pos.x)}px`;
    targetEl.style.top = `${Math.round(pos.y)}px`;
    targetEl.style.right = "auto";
    targetEl.style.bottom = "auto";
  };

  const makeDraggable = ({ handleEl, targetEl, storageKey, defaultPos, enabled }) => {
    if (!handleEl || !targetEl) return;
    if (handleEl.dataset.dragReady === "1") return;
    handleEl.dataset.dragReady = "1";

    const applyInitial = () => {
      if (typeof enabled === "function" && !enabled()) return;
      const saved = readPos(storageKey);
      const pos = saved || resolveDefault(targetEl, defaultPos);
      setPos(targetEl, pos);
    };

    const preventClickIfDragged = (e) => {
      if (handleEl.dataset.dragJustNow === "1") {
        e.preventDefault();
        e.stopPropagation();
        handleEl.dataset.dragJustNow = "0";
      }
    };
    handleEl.addEventListener("click", preventClickIfDragged, true);

    handleEl.style.touchAction = "none";

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let didDrag = false;

    const onDown = (e) => {
      if (typeof enabled === "function" && !enabled()) return;
      if (e.button != null && e.button !== 0) return;
      const rect = targetEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      didDrag = false;
      try {
        handleEl.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onMove = (e) => {
      if (typeof enabled === "function" && !enabled()) return;
      if (startX === 0 && startY === 0) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!didDrag && Math.hypot(dx, dy) > 6) didDrag = true;
      if (!didDrag) return;

      const w = targetEl.offsetWidth || 56;
      const h = targetEl.offsetHeight || 56;
      const pad = 8;
      const x = clamp(startLeft + dx, pad, window.innerWidth - w - pad);
      const y = clamp(startTop + dy, pad, window.innerHeight - h - pad);
      setPos(targetEl, { x, y });
    };

    const onUp = () => {
      if (typeof enabled === "function" && !enabled()) return;
      if (didDrag) {
        const rect = targetEl.getBoundingClientRect();
        writePos(storageKey, { x: rect.left, y: rect.top });
        handleEl.dataset.dragJustNow = "1";
        window.setTimeout(() => {
          handleEl.dataset.dragJustNow = "0";
        }, 0);
      }
      startX = 0;
      startY = 0;
    };

    handleEl.addEventListener("pointerdown", onDown);
    handleEl.addEventListener("pointermove", onMove);
    handleEl.addEventListener("pointerup", onUp);
    handleEl.addEventListener("pointercancel", onUp);

    window.addEventListener("resize", () => applyInitial());
    applyInitial();
  };

  const isMaintenance = () => document.body.classList.contains("is-maintenance");

  const initStatic = () => {
    const musicWidget = document.getElementById("maintMusicWidget");
    const musicToggle = document.getElementById("maintMusicToggle");
    makeDraggable({
      handleEl: musicToggle,
      targetEl: musicWidget,
      storageKey: "dragpos:maintMusicWidget",
      defaultPos: { right: 90, bottom: 20 },
      enabled: isMaintenance,
    });

    const forumWidget = document.getElementById("forumWidget");
    const forumToggle = document.getElementById("forumWidgetToggle");
    makeDraggable({
      handleEl: forumToggle,
      targetEl: forumWidget,
      storageKey: "dragpos:forumWidget",
      defaultPos: { right: 20, bottom: 90 },
      enabled: isMaintenance,
    });
  };

  const initFaqIfPresent = () => {
    const faqBtn = document.getElementById("faqFloatBtn");
    if (!faqBtn) return;
    makeDraggable({
      handleEl: faqBtn,
      targetEl: faqBtn,
      storageKey: "dragpos:faqFloatBtn",
      defaultPos: { right: 20, bottom: 20 },
      enabled: isMaintenance,
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    initStatic();

    const obs = new MutationObserver(() => initFaqIfPresent());
    obs.observe(document.body, { subtree: true, childList: true });
    initFaqIfPresent();
  });
})();

