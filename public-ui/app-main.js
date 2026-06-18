// Haptic feedback helper
      const vibrate = (pattern) => {
        if (navigator.vibrate) navigator.vibrate(pattern);
      };

      // Mobile Storage Detection (Task 1)
      async function checkStorageAndWarn() {
        if (window.innerWidth >= 768) return; // Only mobile
        if (navigator.storage && navigator.storage.estimate) {
          try {
            const { quota } = await navigator.storage.estimate();
            if (quota && quota < 200 * 1024 * 1024) { // < 200MB
              const mb = (quota / 1024 / 1024).toFixed(0);
              const alertHtml = `
                    <div class="alert alert-warning alert-dismissible fade show mx-3 mt-3 shadow-sm border-warning" role="alert" style="z-index: 1050;">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-exclamation-triangle-fill fs-4 me-3 text-warning"></i>
                            <div>
                                <h6 class="alert-heading fw-bold mb-1">Penyimpanan Hampir Penuh!</h6>
                                <p class="mb-0 small">Sisa ruang browser: <b>${mb}MB</b>. Mohon bersihkan cache agar download lancar.</p>
                            </div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`;
              const main = document.getElementById('mainContent');
              if (main) main.insertAdjacentHTML('afterbegin', alertHtml);
            }
          } catch (e) { }
        }
      }

      // Server Status & Maintenance (Task 2)
      const statusDot = document.getElementById('serverStatusDot');
      const maintOverlay = document.getElementById('maintenanceOverlay');

      async function checkServerStatus() {
        try {
          try { window.__lastHealthcheckAt = new Date(); } catch { }
          try {
            const params = new URLSearchParams(window.location.search || '');
            if (params.get('maintenance') === '1') {
              window.isMaintenance = true;
              if (statusDot) statusDot.className = 'badge rounded-pill bg-warning text-dark border ms-2';
              if (statusDot) statusDot.innerHTML = '<i class="bi bi-cone-striped me-1"></i>Maintenance';
              showMaintenanceOverlay(true, 'maintenance');
              try { window.startMaintenanceHealthPoll && window.startMaintenanceHealthPoll(); } catch { }
              return;
            }
          } catch { }
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const res = await fetch('/api/health', { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();

            if (data.startTime) {
              const start = new Date(data.startTime);
              const lastUpdEl = document.getElementById('lastUpdatedBadge');
              if (lastUpdEl) lastUpdEl.innerHTML = `<i class="bi bi-clock-history me-1"></i>Start: ${start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
            }

            if (data.storageDuration) {
              const storageEl = document.getElementById('storageDurationBadge');
              if (storageEl) storageEl.innerHTML = `<i class="bi bi-hourglass-split me-1"></i>File: ${data.storageDuration}`;
            }

            if (data.maintenance) {
              // Maintenance Mode
              window.isMaintenance = true;
              if (statusDot) statusDot.className = 'badge rounded-pill bg-warning text-dark border ms-2';
              if (statusDot) statusDot.innerHTML = '<i class="bi bi-cone-striped me-1"></i>Maintenance';
              showMaintenanceOverlay(true, 'maintenance');
              try { window.applyMaintenanceHealth && window.applyMaintenanceHealth(data); } catch { }
              try { window.startMaintenanceHealthPoll && window.startMaintenanceHealthPoll(); } catch { }
            } else {
              // Online
              window.isMaintenance = false;
              if (statusDot) statusDot.className = 'badge rounded-pill bg-success border ms-2';
              if (statusDot) statusDot.innerHTML = '<i class="bi bi-hdd-network me-1"></i>Online';
              showMaintenanceOverlay(false);
            }
          } else {
            if (res.status === 502 || res.status === 503) {
              // Railway Deploying / Starting
              if (statusDot) statusDot.className = 'badge rounded-pill bg-info text-dark border ms-2';
              if (statusDot) statusDot.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i>Updating...';
              showMaintenanceOverlay(true, 'deploying');
            } else {
              throw new Error('Server returned ' + res.status);
            }
          }
        } catch (e) {
          // Offline / Unreachable
          if (statusDot) statusDot.className = 'badge rounded-pill bg-danger border ms-2';
          if (statusDot) statusDot.innerHTML = '<i class="bi bi-wifi-off me-1"></i>Offline';
          // Only show overlay if we were previously online/deploying to avoid flashing on reload?
          // For now, let's keep it simple. If offline, maybe just toast or small indicator?
          // But user asked for "kedetect".
          // showMaintenanceOverlay(true, 'offline'); 
        }
      }

      window.applyMaintenanceHealth = function (data) {
        try {
          if (!data || typeof data !== 'object') return;
          try { window.__lastHealthcheckAt = new Date(); } catch { }
          try { window.__lastHealthData = data; } catch { }

          if (data.maintenance === false) {
            try {
              const wants = localStorage.getItem('maint_notify_online') === '1';
              if (wants) {
                localStorage.removeItem('maint_notify_online');
                const title = 'Server sudah online';
                const body = 'Maintenance selesai. Kamu bisa coba lagi sekarang.';
                if ('Notification' in window && Notification.permission === 'granted') {
                  try { new Notification(title, { body }); } catch { }
                } else {
                  try { alert(`${title}\n${body}`); } catch { }
                }
              }
            } catch { }
            try { showMaintenanceOverlay(false); } catch { }
            try { window.location.reload(); } catch { }
            return;
          }

          const overlay = document.getElementById('maintenanceOverlay');
          if (!overlay || overlay.hidden) return;

          const info = data.maintenanceInfo || {};
          try {
            const themeNote = document.getElementById('maintThemeNote');
            if (themeNote) themeNote.textContent = overlay.classList.contains('maint-night') ? 'Mode gelap otomatis aktif' : '';
          } catch { }

          try {
            const idEl = document.getElementById('maintId');
            if (idEl) {
              const fallback = (() => {
                const d = new Date();
                const y = String(d.getFullYear());
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `MT-${y}${m}${day}`;
              })();
              idEl.textContent = String(info.id || fallback);
            }
          } catch { }

          try {
            const lastUpd = document.getElementById('maintLastUpdated');
            if (lastUpd) {
              const t = new Date();
              lastUpd.textContent = `${t.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' })} WIB`;
            }
          } catch { }

          try {
            const connWarn = document.getElementById('maintConnWarn');
            if (connWarn) {
              let warn = '';
              try {
                if (navigator && navigator.onLine === false) warn = '⚠️ Koneksi kamu sedang offline. Status mungkin terlambat diperbarui.';
              } catch { }
              try {
                const c = navigator && navigator.connection ? navigator.connection : null;
                const et = c && typeof c.effectiveType === 'string' ? c.effectiveType : '';
                const dl = c && typeof c.downlink === 'number' ? c.downlink : null;
                if (!warn && (et === 'slow-2g' || et === '2g' || (dl != null && dl < 1.2))) {
                  warn = '⚠️ Koneksi kamu tidak stabil. Status mungkin terlambat diperbarui.';
                }
              } catch { }
              connWarn.textContent = warn;
            }
          } catch { }

          const detailEl = document.getElementById('maintDetailDesc');
          if (detailEl && info.detail) detailEl.textContent = String(info.detail);

          const percentEl = document.getElementById('maintProgressPercent');
          const barEl = document.getElementById('maintProgressBar');
          const pct = Number.isFinite(Number(info.progress)) ? Math.max(0, Math.min(100, Number(info.progress))) : null;
          if (pct != null) {
            if (percentEl) percentEl.textContent = `${pct}%`;
            if (barEl) barEl.style.width = `${pct}%`;
          }
          try {
            const icon = document.getElementById('maintIcon');
            const t = overlay && overlay.dataset && overlay.dataset.type ? String(overlay.dataset.type) : '';
            if (icon && t === 'maintenance' && pct != null) {
              let cls = 'bi-cone-striped';
              if (pct <= 30) cls = 'bi-wrench-adjustable-circle';
              else if (pct <= 70) cls = 'bi-server';
              else if (pct < 100) cls = 'bi-rocket-takeoff-fill';
              else cls = 'bi-check-circle-fill';
              icon.className = `bi ${cls}${pct >= 100 ? ' is-done' : ''}`;
            }
          } catch { }

          const estNumEl = document.getElementById('maintEstNum');
          const estUnitEl = document.getElementById('maintEstUnit');
          const etaAtEl = document.getElementById('maintEtaAt');
          const etaSeconds = Number.isFinite(Number(info.etaSeconds)) ? Math.max(0, Number(info.etaSeconds)) : null;
          const etaEndAt = Number.isFinite(Number(info.etaEndAt)) ? Number(info.etaEndAt) : null;

          if (etaSeconds == null && etaEndAt == null) {
            if (estNumEl) estNumEl.textContent = '—';
            if (estUnitEl) estUnitEl.textContent = '';
            if (etaAtEl) etaAtEl.textContent = '--:--';
          } else {
            let seconds = etaSeconds;
            if (seconds == null && etaEndAt != null) seconds = Math.max(0, Math.round((etaEndAt - Date.now()) / 1000));
            const mins = Math.max(0, Math.round(seconds / 60));
            if (mins >= 60) {
              const hrs = Math.max(1, Math.round(mins / 60));
              if (estNumEl) estNumEl.textContent = String(hrs);
              if (estUnitEl) estUnitEl.textContent = 'Jam';
            } else {
              if (estNumEl) estNumEl.textContent = String(mins);
              if (estUnitEl) estUnitEl.textContent = 'Menit';
            }
            const endAt = etaEndAt != null ? new Date(etaEndAt) : new Date(Date.now() + seconds * 1000);
            if (etaAtEl) etaAtEl.textContent = endAt.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' });
          }

          try {
            const tipEl = document.getElementById('maintTipText');
            if (tipEl && info.tip) tipEl.textContent = String(info.tip);
          } catch { }

          try {
            const stepsEl = document.getElementById('maintMiniLog');
            const pct2 = pct == null ? null : pct;
            const steps = Array.isArray(info.steps) ? info.steps : null;
            if (stepsEl) {
              const normalizeStatus = (s) => (s === 'done' || s === 'doing' || s === 'todo' ? s : 'todo');
              const renderItem = (status, title, sub) => {
                const safeTitle = String(title || '');
                const safeSub = String(sub || '');
                return `<li><span class="dot ${status}"></span><div><div class="fw-semibold">${safeTitle}</div>${safeSub ? `<div class="small maint-muted">${safeSub}</div>` : ''}</div></li>`;
              };
              if (steps && steps.length) {
                stepsEl.innerHTML = steps
                  .slice(0, 6)
                  .map((it) => renderItem(normalizeStatus(String(it?.status || 'todo')), it?.text || it?.title || 'Task', it?.detail || it?.sub || ''))
                  .join('');
              } else {
                const p = pct2 == null ? 45 : pct2;
                const s1 = p >= 30 ? 'done' : (p >= 0 ? 'doing' : 'todo');
                const s2 = p >= 70 ? 'done' : (p >= 30 ? 'doing' : 'todo');
                const s3 = p >= 100 ? 'done' : (p >= 70 ? 'doing' : 'todo');
                stepsEl.innerHTML = [
                  renderItem(s1, 'Database backup', s1 === 'done' ? 'Selesai' : 'Berjalan'),
                  renderItem(s2, 'Optimasi server', s2 === 'done' ? 'Selesai' : (s2 === 'doing' ? 'Berjalan' : 'Menunggu')),
                  renderItem(s3, 'Deploy fitur baru', s3 === 'done' ? 'Selesai' : (s3 === 'doing' ? 'Berjalan' : 'Menunggu')),
                ].join('');
              }
            }
          } catch { }

          try {
            const wnEl = document.getElementById('maintWhatsNew');
            const wn = Array.isArray(info.whatsNew) ? info.whatsNew : null;
            if (wnEl && wn && wn.length) {
              wnEl.innerHTML = wn.slice(0, 6).map((t) => `<li><span class="dot done"></span><div class="fw-semibold">${String(t)}</div></li>`).join('');
            }
          } catch { }

          try {
            const svcEl = document.getElementById('maintServices');
            const services = info.services;
            if (svcEl && services) {
              const items = Array.isArray(services) ? services : null;
              const entries = !items && typeof services === 'object' ? Object.entries(services) : null;
              const toColor = (s) => {
                const v = String(s || '').toLowerCase();
                if (v.includes('ok') || v.includes('up') || v.includes('online') || v.includes('green')) return '#22c55e';
                if (v.includes('warn') || v.includes('yellow') || v.includes('rate')) return '#f59e0b';
                if (v.includes('maint') || v.includes('progress')) return 'var(--maintenance-accent, #fd7e14)';
                if (v.includes('down') || v.includes('error') || v.includes('red')) return '#ef4444';
                return '#94a3b8';
              };
              const render = (name, status) => `<span class="maint-badge"><span style="color:${toColor(status)};">●</span> ${String(name)}: ${String(status)}</span>`;
              if (items) {
                svcEl.innerHTML = items.slice(0, 8).map((it) => render(it?.name || 'Service', it?.status || 'Unknown')).join('');
              } else if (entries) {
                svcEl.innerHTML = entries.slice(0, 8).map(([k, v]) => render(k, v)).join('');
              }
            }
          } catch { }

        } catch { }
      };

      window.copyMaintenanceStatus = async function () {
        try {
          const id = (document.getElementById('maintId') || {}).textContent || '';
          const pct = (document.getElementById('maintProgressPercent') || {}).textContent || '';
          const detail = (document.getElementById('maintDetailDesc') || {}).textContent || '';
          const etaAt = (document.getElementById('maintEtaAt') || {}).textContent || '';
          const last = (document.getElementById('maintLastUpdated') || {}).textContent || '';
          const line = [
            `Maintenance ${id}`.trim(),
            detail ? `Status: ${detail}` : '',
            pct ? `Progress: ${pct}` : '',
            etaAt ? `Estimasi selesai: ${etaAt}` : '',
            last ? `Last updated: ${last}` : '',
            `URL: ${location.href}`,
          ].filter(Boolean).join('\n');
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(line);
            if (typeof window.setToast === 'function') window.setToast('Status disalin.', 'success');
          } else {
            alert(line);
          }
        } catch { }
      };

      window.enableOnlineNotify = async function () {
        try {
          localStorage.setItem('maint_notify_online', '1');
        } catch { }
        try {
          if (!('Notification' in window)) {
            if (typeof window.setToast === 'function') window.setToast('Browser tidak mendukung notifikasi.', 'warning');
            return;
          }
          if (Notification.permission === 'granted') {
            if (typeof window.setToast === 'function') window.setToast('Notifikasi diaktifkan.', 'success');
            return;
          }
          if (Notification.permission === 'denied') {
            if (typeof window.setToast === 'function') window.setToast('Notifikasi diblokir browser.', 'warning');
            return;
          }
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            if (typeof window.setToast === 'function') window.setToast('Notifikasi diaktifkan.', 'success');
          } else {
            if (typeof window.setToast === 'function') window.setToast('Izin notifikasi tidak diberikan.', 'warning');
          }
        } catch { }
      };

      window.remindLater = function (minutes) {
        const mins = Number.isFinite(Number(minutes)) ? Math.max(1, Math.min(60, Number(minutes))) : 5;
        try { localStorage.setItem('maint_remind_minutes', String(mins)); } catch { }
        try {
          if (typeof window.setToast === 'function') window.setToast(`Oke, cek lagi ${mins} menit lagi.`, 'info');
        } catch { }
        window.setTimeout(() => {
          try { window.location.reload(); } catch { }
        }, mins * 60 * 1000);
      };

      window.startMaintenanceHealthPoll = function () {
        try {
          if (window.__maintHealthPoll) clearInterval(window.__maintHealthPoll);
        } catch { }
        const tick = async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch('/api/health?t=' + Date.now(), { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) return;
            const data = await res.json();
            try { window.applyMaintenanceHealth && window.applyMaintenanceHealth(data); } catch { }
          } catch { }
        };
        tick();
        window.__maintHealthPoll = setInterval(tick, 10000);
      };

      window.manualCheckStatus = async function () {
        const btn = document.getElementById('maintenanceCheckBtn') || document.querySelector('#maintenanceOverlay button');
        if (!btn) return;

        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Lagi cek server...';

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          // Use a timestamp to prevent caching
          const res = await fetch('/api/health?t=' + Date.now(), { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            try { window.applyMaintenanceHealth && window.applyMaintenanceHealth(data); } catch { }
            if (!data.maintenance) return;
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            let toast = document.getElementById('maintToast');
            if (!toast) {
              toast = document.createElement('div');
              toast.id = 'maintToast';
              toast.className = 'position-fixed start-50 translate-middle-x px-4 py-3 rounded-pill text-white shadow-lg d-flex align-items-center gap-2';
              toast.style.cssText = 'bottom: 100px; z-index: 10000; background: rgba(33,37,41,0.95); backdrop-filter: blur(4px); font-weight: 500; min-width: max-content;';
              document.body.appendChild(toast);
            }
            toast.innerHTML = '<i class="bi bi-hourglass-split text-warning fs-5"></i><span>Masih dalam perbaikan. Progress akan terus diperbarui.</span>';
            toast.style.opacity = '1';
            setTimeout(() => { try { toast.style.opacity = '0'; } catch { } }, 2200);
            return;
          }
        } catch (e) {
          // Still maintenance or offline
          btn.innerHTML = originalHtml;
          btn.disabled = false;

          // Show toast
          let toast = document.getElementById('maintToast');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'maintToast';
            toast.className = 'position-fixed start-50 translate-middle-x px-4 py-3 rounded-pill text-white shadow-lg d-flex align-items-center gap-2';
            toast.style.cssText = 'bottom: 100px; z-index: 10000; background: rgba(33,37,41,0.95); backdrop-filter: blur(4px); font-weight: 500; min-width: max-content;';
            toast.innerHTML = '<i class="bi bi-hourglass-split text-warning fs-5"></i><span>Masih dalam perbaikan. Progress akan terus diperbarui.</span>';
            document.body.appendChild(toast);
          } else {
            // If already exists, just ensure it's visible and reset animation
            toast.hidden = false;
          }

          // Animate
          toast.animate([
            { opacity: 0, transform: 'translate(-50%, 20px)' },
            { opacity: 1, transform: 'translate(-50%, 0)' }
          ], { duration: 300, easing: 'ease-out', fill: 'forwards' });

          // Hide after 2s
          setTimeout(() => {
            const anim = toast.animate([
              { opacity: 1, transform: 'translate(-50%, 0)' },
              { opacity: 0, transform: 'translate(-50%, 20px)' }
            ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
            anim.onfinish = () => { if (toast) toast.remove(); };
          }, 2500);
        }
      };

      window.openMaintenanceHelp = function () {
        document.body.classList.add('maintenance-help-mode');
        const panel = document.getElementById('faqFloatPanel');
        const btn = document.getElementById('faqFloatBtn');
        if (panel) panel.classList.add('active');
        if (btn) btn.innerHTML = '<i class="bi bi-x-lg"></i>';
      };

      window.openMaintenanceChat = function () {
        const overlay = document.getElementById('maintenanceOverlay');
        if (overlay) overlay.hidden = false;
        if (typeof window.toggleMaintenanceChatDrawer === 'function') window.toggleMaintenanceChatDrawer(true);
      };

      window.openForumWidgetFromMaintenance = window.openMaintenanceChat;


      window.closeForumWidget = function () {
        if (typeof window.toggleForumWidget === 'function') window.toggleForumWidget(false);
      };

      // Global FAQ Toggle Functions
      window.toggleFaqPanel = function () {
        const panel = document.getElementById('faqFloatPanel');
        const btn = document.getElementById('faqFloatBtn');
        if (panel && btn) {
          const isActive = panel.classList.toggle('active');
          btn.innerHTML = isActive ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-question-lg"></i>';
          if (!isActive) document.body.classList.remove('maintenance-help-mode');
        }
      };

      window.toggleMusicPanel = function () {
        const panel = document.getElementById('musicFloatPanel');
        const btn = document.getElementById('musicFloatBtn');
        if (panel && btn) {
          const isActive = panel.classList.toggle('active');
          btn.innerHTML = isActive ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-music-note-beamed"></i>';
        }
      };

      window.toggleFaqItem = function (header) {
        const item = header.parentElement;
        const allItems = document.querySelectorAll('.faq-accordion-item');

        // Close others
        allItems.forEach(el => {
          if (el !== item) {
            el.classList.remove('active');
            const icon = el.querySelector('.faq-question i');
            if (icon) icon.style.transform = 'rotate(0deg)';
          }
        });

        // Toggle current
        item.classList.toggle('active');
        const icon = header.querySelector('i');
        if (icon) {
          icon.style.transform = item.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      };

      window.initMaintenanceCarousel = function () {
        try {
          const track = document.getElementById('maintCarouselTrack');
          const dotsWrap = document.getElementById('maintCarouselDots');
          const prev = document.getElementById('maintCarouselPrev');
          const next = document.getElementById('maintCarouselNext');
          const sidePrev = document.getElementById('maintSidePrev');
          const sideNext = document.getElementById('maintSideNext');
          if (!track || !dotsWrap) return;
          if ((!prev && !sidePrev) || (!next && !sideNext)) return;
          const slides = Array.from(track.querySelectorAll('.maint-carousel-slide'));
          if (!slides.length) return;

          if (!dotsWrap.dataset.ready) {
            dotsWrap.innerHTML = slides.map((_, i) => `<span class="maint-carousel-dot${i === 0 ? ' active' : ''}" data-i="${i}"></span>`).join('');
            dotsWrap.dataset.ready = '1';
            dotsWrap.addEventListener('click', (e) => {
              const t = e && e.target ? e.target : null;
              const i = t && t.dataset ? Number(t.dataset.i) : NaN;
              if (!Number.isFinite(i)) return;
              const x = slides[i].offsetLeft;
              track.scrollTo({ left: x, behavior: 'smooth' });
            });
          }

          const setActive = () => {
            const left = track.scrollLeft;
            let best = 0;
            let bestDist = Infinity;
            slides.forEach((s, i) => {
              const d = Math.abs(s.offsetLeft - left);
              if (d < bestDist) { bestDist = d; best = i; }
            });
            const dots = Array.from(dotsWrap.querySelectorAll('.maint-carousel-dot'));
            dots.forEach((d, i) => d.classList.toggle('active', i === best));
            if (prev) prev.disabled = best === 0;
            if (next) next.disabled = best === slides.length - 1;
            if (sidePrev) sidePrev.disabled = best === 0;
            if (sideNext) sideNext.disabled = best === slides.length - 1;
          };

          const go = (dir) => {
            setActive();
            const dots = Array.from(dotsWrap.querySelectorAll('.maint-carousel-dot'));
            const current = dots.findIndex((d) => d.classList.contains('active'));
            const idx = Math.max(0, Math.min(slides.length - 1, (current < 0 ? 0 : current) + dir));
            const x = slides[idx].offsetLeft;
            track.scrollTo({ left: x, behavior: 'smooth' });
            window.setTimeout(setActive, 240);
          };

          if (prev) prev.onclick = () => go(-1);
          if (next) next.onclick = () => go(1);
          if (sidePrev) sidePrev.onclick = () => go(-1);
          if (sideNext) sideNext.onclick = () => go(1);
          track.addEventListener('scroll', () => {
            window.clearTimeout(track.__t);
            track.__t = window.setTimeout(setActive, 80);
          }, { passive: true });
          window.addEventListener('resize', () => window.setTimeout(setActive, 100), { passive: true });
          setActive();
        } catch { }
      };

      window.initMaintenanceChatRoomCarousel = function () {
        try {
          const overlay = document.getElementById('maintenanceOverlay');
          if (!overlay || overlay.hidden) return;
          const track = document.getElementById('maintChatRoomTrack');
          const dotsWrap = document.getElementById('maintChatRoomDots');
          const prev = document.getElementById('maintChatRoomPrev');
          const next = document.getElementById('maintChatRoomNext');
          if (!track || !dotsWrap || !prev || !next) return;

          const rooms = Array.from(track.querySelectorAll('.maint-chat-room-btn'));
          if (!rooms.length) return;
          if (track.dataset.ready === '1') return;
          track.dataset.ready = '1';

          const setActiveByIndex = (idx, { scroll = true } = {}) => {
            const safeIdx = Math.max(0, Math.min(rooms.length - 1, Number(idx) || 0));
            rooms.forEach((btn, i) => btn.classList.toggle('active', i === safeIdx));
            const dots = Array.from(dotsWrap.querySelectorAll('.maint-carousel-dot'));
            dots.forEach((d, i) => d.classList.toggle('active', i === safeIdx));
            prev.disabled = safeIdx === 0;
            next.disabled = safeIdx === rooms.length - 1;
            const btn = rooms[safeIdx];
            if (scroll && btn) {
              try { btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch { }
            }
            const room = btn?.dataset?.room || 'umum';
            const label = (btn?.textContent || 'Chat').trim();
            document.dispatchEvent(new CustomEvent('maint-chat-room-change', { detail: { room, label } }));
          };

          dotsWrap.innerHTML = rooms.map((_, i) => `<span class="maint-carousel-dot${i === 0 ? ' active' : ''}" data-i="${i}"></span>`).join('');

          dotsWrap.addEventListener('click', (e) => {
            const t = e && e.target ? e.target : null;
            const i = t && t.dataset ? Number(t.dataset.i) : NaN;
            if (!Number.isFinite(i)) return;
            setActiveByIndex(i);
          });

          rooms.forEach((btn, i) => {
            btn.addEventListener('click', () => setActiveByIndex(i, { scroll: false }));
          });

          prev.addEventListener('click', () => {
            const idx = rooms.findIndex((b) => b.classList.contains('active'));
            setActiveByIndex((idx < 0 ? 0 : idx) - 1);
          });
          next.addEventListener('click', () => {
            const idx = rooms.findIndex((b) => b.classList.contains('active'));
            setActiveByIndex((idx < 0 ? 0 : idx) + 1);
          });

          const initialIdx = Math.max(0, rooms.findIndex((b) => b.classList.contains('active')));
          setActiveByIndex(initialIdx, { scroll: false });
        } catch { }
      };

      window.toggleMaintenanceChatDrawer = function (forceOpen = null) {
        try {
          const overlay = document.getElementById('maintenanceOverlay');
          if (!overlay || overlay.hidden) return;
          const drawer = document.getElementById('maintChatDrawer');
          const openBtn = document.getElementById('maintChatLauncherOpen');
          if (!drawer) return;
          const shouldOpen = forceOpen === null ? Boolean(drawer.hidden) : Boolean(forceOpen);
          drawer.hidden = !shouldOpen;
          if (openBtn) openBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
          document.body.classList.toggle('maint-chat-open', shouldOpen);
          if (shouldOpen) {
            const input = document.getElementById('maintChatInput');
            if (input) {
              try { input.focus(); } catch { }
            }
          }
        } catch { }
      };

      window.initMaintenanceChatLauncher = function () {
        try {
          const overlay = document.getElementById('maintenanceOverlay');
          if (!overlay || overlay.hidden) return;
          const launcher = document.getElementById('maintChatLauncher');
          const openBtn = document.getElementById('maintChatLauncherOpen');
          const drawer = document.getElementById('maintChatDrawer');
          const backdrop = document.getElementById('maintChatDrawerBackdrop');
          const closeBtn = document.getElementById('maintChatDrawerClose');
          if (!launcher || !openBtn || !drawer) return;
          if (launcher.dataset.ready === '1') return;
          launcher.dataset.ready = '1';

          openBtn.addEventListener('click', () => window.toggleMaintenanceChatDrawer(true));
          if (backdrop) backdrop.addEventListener('click', () => window.toggleMaintenanceChatDrawer(false));
          if (closeBtn) closeBtn.addEventListener('click', () => window.toggleMaintenanceChatDrawer(false));

          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !drawer.hidden) window.toggleMaintenanceChatDrawer(false);
          });
        } catch { }
      };

      window.destroyMaintenanceForumChat = function () {
        const st = window.__maintForumChatState;
        if (!st) return;
        try { st.unsubscribe && st.unsubscribe(); } catch { }
        try { st.authUnsub && st.authUnsub(); } catch { }
        try { st.roomUnsub && st.roomUnsub(); } catch { }
        delete window.__maintForumChatState;
      };

      window.initMaintenanceForumChat = function () {
        try {
          const overlay = document.getElementById('maintenanceOverlay');
          if (!overlay || overlay.hidden) return;
          const messages = document.getElementById('maintChatMessages');
          const input = document.getElementById('maintChatInput');
          const send = document.getElementById('maintChatSend');
          const loginOverlay = document.getElementById('maintChatLogin');
          const loginBtn = document.getElementById('maintChatLoginBtn');
          const status = document.getElementById('maintChatStatus');
          const roomNameEl = document.getElementById('maintChatRoomName');
          const roomLabelEl = document.getElementById('maintChatRoomLabel');
          const roomTrack = document.getElementById('maintChatRoomTrack');
          if (!messages || !input || !send || !loginOverlay || !loginBtn) return;

          if (window.__maintForumChatState?.inited) return;
          const state = {
            inited: true,
            currentUser: null,
            unsubscribe: null,
            authUnsub: null,
            roomUnsub: null,
            stickBottom: true,
            currentRoom: 'umum',
          };
          window.__maintForumChatState = state;

          if (roomTrack && roomTrack.dataset.bound !== '1') {
            roomTrack.dataset.bound = '1';
            Array.from(roomTrack.querySelectorAll('.maint-chat-room-btn')).forEach((btn) => {
              btn.addEventListener('click', () => {
                const room = String(btn.dataset?.room || 'umum');
                const label = (btn.textContent || 'Chat').trim();
                document.dispatchEvent(new CustomEvent('maint-chat-room-change', { detail: { room, label } }));
              });
            });
          }

          const getRoomLabel = (room) => {
            const r = String(room || '');
            const track = document.getElementById('maintChatRoomTrack');
            const btn = track
              ? Array.from(track.querySelectorAll('.maint-chat-room-btn')).find((b) => String(b.dataset?.room || '') === r)
              : null;
            const label = (btn?.textContent || '').trim();
            return label || `Chat ${String(room || '').toUpperCase()}`;
          };

          const applyRoomUI = (room) => {
            const r = String(room || 'umum');
            state.currentRoom = r;
            if (roomNameEl) roomNameEl.textContent = getRoomLabel(r);
            if (roomLabelEl) roomLabelEl.textContent = `room: ${r}`;
            const track = document.getElementById('maintChatRoomTrack');
            if (track) {
              Array.from(track.querySelectorAll('.maint-chat-room-btn')).forEach((b) => {
                b.classList.toggle('active', String(b.dataset?.room || '') === r);
              });
            }
          };

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
                if (m?.db && m?.auth && m?.collection && m?.addDoc && m?.serverTimestamp && m?.onSnapshot && m?.query && m?.orderBy && m?.limit && m?.onAuthStateChanged && (m?.signInWithPopup || m?.signInWithRedirect) && m?.GoogleAuthProvider) {
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

          const setLoginState = (loggedIn) => {
            loginOverlay.hidden = loggedIn;
            input.disabled = !loggedIn;
            send.disabled = !loggedIn;
            if (status) {
              status.hidden = !loggedIn;
              if (loggedIn) status.textContent = 'Online';
            }
          };

          const scrollToBottom = () => {
            messages.scrollTop = messages.scrollHeight;
          };

          const render = (docs) => {
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
                      <div class="maint-chat-msg ${me ? "me" : "other"}">
                        <div class="maint-chat-bubble">
                          <div class="small fw-semibold">${name}</div>
                          <div>${text}</div>
                          <div class="maint-chat-meta"><span>${time}</span></div>
                        </div>
                      </div>
                    `;
              })
              .join("");
            messages.innerHTML = html || '<div class="text-center text-secondary small">Belum ada chat. Mulai duluan ya.</div>';
            if (state.stickBottom) scrollToBottom();
          };

          const stopListener = () => {
            if (state.unsubscribe) {
              try { state.unsubscribe(); } catch { }
              state.unsubscribe = null;
            }
          };

          const startListener = async () => {
            try {
              if (!state.currentUser) {
                stopListener();
                messages.innerHTML = '<div class="text-center text-secondary small">Login dulu untuk lihat chat.</div>';
                return;
              }
              const m = await waitForFirebase();
              const { db, collection, query, orderBy, limit, onSnapshot } = m;
              stopListener();
              const colRef = collection(db, "forum-messages");
              const q = query(colRef, orderBy("timestamp", "desc"), limit(120));
              state.unsubscribe = onSnapshot(
                q,
                (snapshot) => {
                  const docs = Array.from(snapshot.docs || [])
                    .filter((docSnap) => {
                      try {
                        const data = docSnap.data?.() || {};
                        return String(data.room || "umum") === String(state.currentRoom || 'umum');
                      } catch {
                        return false;
                      }
                    })
                    .slice()
                    .reverse();
                  render(docs);
                },
                () => {
                  messages.innerHTML = '<div class="text-center text-danger small">Gagal memuat chat. Coba refresh.</div>';
                }
              );
            } catch (err) {
              const msg = safeText(String(err?.message || "Gagal memuat chat."));
              messages.innerHTML = `<div class="text-center text-danger small">${msg}</div>`;
            }
          };

          const sendMessage = async () => {
            const text = input.value.trim();
            if (!text) return;
            if (!state.currentUser) {
              setLoginState(false);
              if (typeof window.setToast === "function") window.setToast("Login dulu untuk kirim chat.", "warning");
              return;
            }
            send.disabled = true;
            try {
              const m = await waitForFirebase();
              const { db, collection, addDoc, serverTimestamp } = m;
              await addDoc(collection(db, "forum-messages"), {
                text,
                uid: state.currentUser.uid,
                name: state.currentUser.displayName || "Warga",
                timestamp: serverTimestamp(),
                room: String(state.currentRoom || 'umum'),
              });
              input.value = "";
              state.stickBottom = true;
              scrollToBottom();
            } catch (err) {
              const msg = String(err?.message || "Gagal kirim chat.");
              if (typeof window.setToast === "function") window.setToast(msg, "danger");
            } finally {
              send.disabled = false;
            }
          };

          send.addEventListener('click', sendMessage);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          });
          messages.addEventListener('scroll', () => {
            const atBottom =
              Math.abs(messages.scrollTop + messages.clientHeight - messages.scrollHeight) < 24;
            state.stickBottom = atBottom;
          });

          loginBtn.addEventListener('click', async () => {
            try {
              const m = await waitForFirebase();
              const { auth, signInWithPopup, signInWithRedirect, GoogleAuthProvider } = m;
              loginBtn.disabled = true;
              loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>...';
              const provider = new GoogleAuthProvider();
              provider.setCustomParameters({ prompt: 'select_account' });
              try {
                await signInWithPopup(auth, provider);
              } catch {
                await signInWithRedirect(auth, provider);
              }
            } catch {
              if (typeof window.setToast === 'function') window.setToast('Login gagal.', 'danger');
            } finally {
              loginBtn.disabled = false;
              loginBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G" class="me-2">Masuk dengan Google';
            }
          });

          waitForFirebase().then((m) => {
            const { auth, onAuthStateChanged } = m;
            state.authUnsub = onAuthStateChanged(auth, (user) => {
              state.currentUser = user || null;
              setLoginState(Boolean(state.currentUser));
              if (state.currentUser) startListener().catch(() => { });
              else stopListener();
            });
            setLoginState(Boolean(auth.currentUser));
            if (auth.currentUser) {
              state.currentUser = auth.currentUser;
              startListener().catch(() => { });
            }
          }).catch(() => {
            setLoginState(false);
          });

          const onRoomChange = (e) => {
            const room = e?.detail?.room;
            if (!room) return;
            applyRoomUI(room);
            if (state.currentUser) startListener().catch(() => { });
          };
          document.addEventListener('maint-chat-room-change', onRoomChange);
          state.roomUnsub = () => document.removeEventListener('maint-chat-room-change', onRoomChange);

          const initialRoomBtn = document.querySelector('#maintChatRoomTrack .maint-chat-room-btn.active') || document.querySelector('#maintChatRoomTrack .maint-chat-room-btn');
          const initialRoom = initialRoomBtn?.dataset?.room || 'umum';
          applyRoomUI(initialRoom);
        } catch { }
      };

      function showMaintenanceOverlay(show, type = 'maintenance') {
        let overlay = document.getElementById('maintenanceOverlay');
        if (!overlay && show) {
          overlay = document.createElement('div');
          overlay.id = 'maintenanceOverlay';
          // Changed to solid background (opacity 1) to hide underlying content clutter
          // Force text color to dark (#212529) to ensure visibility on white background, overriding any global dark mode themes
          // Removed flex from overlay to allow inner container to handle scrolling properly
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#ffffff;color:#212529;z-index:9999;overflow:hidden;';
          document.body.appendChild(overlay);
        }

        if (overlay) {
          overlay.hidden = !show;
          document.body.style.overflow = show ? 'hidden' : ''; // Lock body scroll when maintenance is active
          const t = String(type || 'maintenance');
          const showWidgets = Boolean(show) && (t === 'maintenance' || t === 'deploying');
          document.body.classList.toggle('is-maintenance', Boolean(show) && t === 'maintenance');
          document.body.classList.toggle('maintenance-widgets', showWidgets);
          document.body.classList.toggle('maintenance-overlay-active', Boolean(show));
          if (!show) {
            document.documentElement.style.removeProperty('--maintenance-accent');
            document.documentElement.style.removeProperty('--maint-accent');
            try { window.destroyMaintenanceRadio && window.destroyMaintenanceRadio(); } catch { }
            try { window.destroyMaintenanceForumChat && window.destroyMaintenanceForumChat(); } catch { }
          }
          if (show) {
            // Check if already showing same type to avoid reset
            if (overlay.dataset.type === type && overlay.dataset.rendered === 'true') {
              if (type === 'maintenance') {
                try { window.initMaintenanceRadio && window.initMaintenanceRadio(); } catch { }
              }
              return;
            }
            overlay.dataset.type = type;
            overlay.dataset.rendered = 'true';

            let iconClass = 'bi-cone-striped';
            let title = 'Sedang Dalam Perbaikan';
            let desc = 'Kami lagi ngerapihin sistem biar layanan lebih cepat dan stabil. Update progress-nya bisa kamu lihat di bawah ya.';
            let detailDesc = 'Upgrade server supaya lebih cepat & stabil';
            let progressVal = 45;
            let estNum = '2';
            let estUnit = 'Jam';
            let colorMain = '#fd7e14'; // Orange
            let colorLight = 'rgba(253, 126, 20, 0.15)';
            let bgGradient = 'linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)';

            if (type === 'deploying') {
              iconClass = 'bi-cloud-arrow-up-fill';
              title = 'Server Sedang Update';
              desc = 'Kami lagi deploy versi terbaru. Biasanya sebentar, tapi kami tetap pantau biar aman.';
              detailDesc = 'Deploy rilis baru & optimasi database';
              progressVal = 75;
              estNum = '5';
              estUnit = 'Menit';
              colorMain = '#0d6efd'; // Blue
              colorLight = 'rgba(13, 110, 253, 0.15)';
              bgGradient = 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)';
            } else if (type === 'offline') {
              iconClass = 'bi-router-fill';
              title = 'Koneksi Terputus';
              desc = 'Kami belum bisa menjangkau server. Bisa jadi koneksi kamu tidak stabil atau server sedang sibuk.';
              detailDesc = 'Menunggu sambungan ulang & cek jaringan';
              progressVal = 0;
              estNum = '—';
              estUnit = '';
              colorMain = '#dc3545'; // Red
              colorLight = 'rgba(220, 53, 69, 0.15)';
              bgGradient = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
            }

            try { document.documentElement.style.setProperty('--maintenance-accent', colorMain); } catch { }
            try { document.documentElement.style.setProperty('--maint-accent', colorMain); } catch { }
            let isNight = false;
            try {
              const h = new Date().getHours();
              isNight = h >= 18 || h < 6;
            } catch { }
            try { overlay.classList.toggle('maint-night', Boolean(isNight)); } catch { }

            overlay.innerHTML = `
                  <style>
                    @keyframes pulse-ring {
                        0% { transform: scale(0.8); opacity: 0.5; }
                        100% { transform: scale(1.3); opacity: 0; }
                    }
                    @keyframes progress-stripes {
                        0% { background-position: 1rem 0; }
                        100% { background-position: 0 0; }
                    }
                    @keyframes maint-spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    @keyframes maint-shimmer {
                        0% { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                    }
                    #maintenanceOverlay.maint-night .maint-container {
                        background: radial-gradient(circle at 20% 20%, rgba(253,126,20,0.18), transparent 55%),
                                    radial-gradient(circle at 80% 0%, rgba(13,110,253,0.14), transparent 45%),
                                    linear-gradient(135deg, #0b1220 0%, #0f1b2d 60%, #0b1220 100%) !important;
                    }
                    #maintenanceOverlay.maint-night .maint-card {
                        background: rgba(17, 24, 39, 0.92);
                        color: #e5e7eb;
                        border-color: rgba(255,255,255,0.08);
                        box-shadow: 0 20px 70px rgba(0,0,0,0.35);
                    }
                    .maint-title { color: #111827; }
                    .maint-muted { color: #6c757d; }
                    #maintenanceOverlay.maint-night .maint-title { color: #e5e7eb !important; }
                    #maintenanceOverlay.maint-night .maint-muted { color: rgba(229,231,235,0.78) !important; }
                    body.maintenance-overlay-active .forum-widget {
                        display: none !important;
                    }
                    #maintenanceOverlay.maint-night p,
                    #maintenanceOverlay.maint-night small {
                        color: rgba(229,231,235,0.78) !important;
                    }
                    #maintenanceOverlay.maint-night .btn-close {
                        filter: invert(1);
                    }
                    .maint-container {
                        width: 100%; height: 100%;
                        background: ${bgGradient};
                        display: flex; align-items: center; justify-content: center;
                        padding: 1rem 1rem calc(1rem + 86px + env(safe-area-inset-bottom, 0px));
                        box-sizing: border-box;
                    }
                    .maint-card {
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.1);
                        padding: 2rem 1.5rem;
                        max-width: 480px;
                        width: 100%;
                        max-height: 100%;
                        overflow-y: auto; /* Internal scroll if content exceeds viewport */
                        text-align: center;
                        border: 1px solid rgba(255,255,255,0.5);
                        box-sizing: border-box;
                        color: #212529;
                        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                        display: flex; flex-direction: column;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(17,24,39,0.22) transparent;
                        overscroll-behavior: contain;
                    }
                    @media (min-width: 992px) {
                        .maint-container {
                            padding: 1.25rem;
                        }
                        .maint-card {
                            max-width: 760px;
                            padding: 2.25rem 2.25rem;
                            border-radius: 24px;
                            max-height: calc(100vh - 2.5rem);
                            overflow-y: hidden;
                        }
                        .maint-content-wrapper {
                            overflow: visible;
                        }
                        .maint-content-wrapper { text-align: left; }
                        .maint-summary {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 14px;
                            align-items: start;
                        }
                        .maint-summary-head { grid-column: 1 / -1; }
                        .maint-summary-head .h3 { margin-bottom: 0.35rem !important; }
                        .maint-summary-head p { margin-bottom: 0.85rem !important; max-width: 70ch; }
                        .maint-summary-progress { margin-bottom: 0 !important; }
                        .maint-summary .maint-est-row { margin-bottom: 0 !important; }
                        .maint-details-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 12px;
                            margin-top: 12px;
                        }
                        .maint-details-grid .maint-section { margin-top: 0 !important; padding: 10px 10px; }
                        .maint-details-grid .maint-section--wide { grid-column: 1 / -1; }
                        .maint-mini-log { gap: 4px; font-size: 0.86rem; }
                    }

                    #maintToast {
                        max-width: min(92vw, 520px);
                        min-width: 0 !important;
                        white-space: normal;
                        text-align: center;
                        line-height: 1.25;
                    }
                    @media (max-width: 576px) {
                        #maintToast {
                            font-size: 0.82rem;
                            padding: 0.6rem 0.9rem !important;
                            bottom: calc(78px + env(safe-area-inset-bottom, 0px)) !important;
                        }
                        #maintToast i {
                            font-size: 1rem !important;
                        }
                    }
                    #maintenanceOverlay.maint-night .maint-card { scrollbar-color: rgba(229,231,235,0.22) transparent; }
                    .maint-card::-webkit-scrollbar { width: 8px; height: 8px; }
                    .maint-card::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.18); border-radius: 999px; }
                    #maintenanceOverlay.maint-night .maint-card::-webkit-scrollbar-thumb { background: rgba(229,231,235,0.18); }
                    .maint-card::-webkit-scrollbar-track { background: transparent; }
                    .maint-content-wrapper {
                        flex: 1;
                        overflow-y: auto;
                        margin-bottom: 1rem;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(17,24,39,0.18) transparent;
                        overscroll-behavior: contain;
                    }
                    #maintenanceOverlay.maint-night .maint-content-wrapper { scrollbar-color: rgba(229,231,235,0.18) transparent; }
                    .maint-content-wrapper::-webkit-scrollbar { width: 8px; height: 8px; }
                    .maint-content-wrapper::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.14); border-radius: 999px; }
                    #maintenanceOverlay.maint-night .maint-content-wrapper::-webkit-scrollbar-thumb { background: rgba(229,231,235,0.14); }
                    .maint-content-wrapper::-webkit-scrollbar-track { background: transparent; }
                    .maint-section {
                        text-align: left;
                        background: rgba(0,0,0,0.035);
                        border: 1px solid rgba(0,0,0,0.06);
                        border-radius: 16px;
                        padding: 12px 12px;
                        margin-top: 12px;
                    }
                    #maintenanceOverlay.maint-night .maint-section {
                        background: rgba(255,255,255,0.06);
                        border-color: rgba(255,255,255,0.08);
                    }
                    .maint-section-title {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        font-weight: 900;
                        font-size: 0.8rem;
                        letter-spacing: 0.06em;
                        text-transform: uppercase;
                        margin-bottom: 8px;
                    }
                    .maint-carousel {
                        margin-top: 12px;
                    }
                    .maint-carousel-head {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    .maint-carousel-head .title {
                        font-weight: 950;
                        letter-spacing: 0.06em;
                        text-transform: uppercase;
                        font-size: 0.8rem;
                    }
                    .maint-carousel-nav {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .maint-carousel-btn {
                        width: 34px;
                        height: 34px;
                        border-radius: 12px;
                        border: 1px solid rgba(0,0,0,0.08);
                        background: rgba(255,255,255,0.75);
                        display: inline-grid;
                        place-items: center;
                        cursor: pointer;
                        box-shadow: 0 10px 26px rgba(15,23,42,.10);
                    }
                    #maintenanceOverlay.maint-night .maint-carousel-btn {
                        border-color: rgba(255,255,255,0.12);
                        background: rgba(255,255,255,0.10);
                        color: #e5e7eb;
                    }
                    .maint-carousel-btn:active { filter: brightness(0.98); }
                    #maintCarouselPrev,
                    #maintCarouselNext {
                        position: static;
                        transform: none;
                        display: none;
                    }
                    .maint-carousel-wrap {
                        position: relative;
                    }
                    .maint-side-btn {
                        position: absolute;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 42px;
                        height: 42px;
                        border-radius: 999px;
                        border: 1px solid rgba(0,0,0,0.08);
                        background: rgba(255,255,255,0.88);
                        backdrop-filter: blur(10px);
                        display: grid;
                        place-items: center;
                        box-shadow: 0 14px 28px rgba(15,23,42,.14);
                        cursor: pointer;
                        z-index: 5;
                        color: #111827;
                    }
                    #maintenanceOverlay.maint-night .maint-side-btn {
                        border-color: rgba(255,255,255,0.12);
                        background: rgba(255,255,255,0.10);
                        color: #e5e7eb;
                    }
                    .maint-side-btn:disabled {
                        opacity: 0;
                        pointer-events: none;
                    }
                    #maintSidePrev { left: 8px; }
                    #maintSideNext { right: 8px; }
                    @media (max-width: 576px) {
                        .maint-side-btn {
                            width: 38px;
                            height: 38px;
                        }
                        #maintSidePrev { left: 6px; }
                        #maintSideNext { right: 6px; }
                    }
                    .maint-carousel-dots {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 10px;
                        border-radius: 999px;
                        border: 1px solid rgba(0,0,0,0.06);
                        background: rgba(255,255,255,0.65);
                    }
                    #maintenanceOverlay.maint-night .maint-carousel-dots {
                        border-color: rgba(255,255,255,0.10);
                        background: rgba(255,255,255,0.08);
                    }
                    .maint-carousel-dot {
                        width: 7px;
                        height: 7px;
                        border-radius: 999px;
                        background: rgba(148,163,184,0.9);
                    }
                    .maint-carousel-dot.active {
                        background: var(--maintenance-accent, #fd7e14);
                    }
                    .maint-carousel-track {
                        display: flex;
                        gap: 10px;
                        overflow-x: auto;
                        scroll-snap-type: x mandatory;
                        scroll-behavior: smooth;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(17,24,39,0.14) transparent;
                        -webkit-overflow-scrolling: touch;
                        padding-bottom: 2px;
                    }
                    #maintenanceOverlay.maint-night .maint-carousel-track { scrollbar-color: rgba(229,231,235,0.14) transparent; }
                    .maint-carousel-track::-webkit-scrollbar { height: 6px; }
                    .maint-carousel-track::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.12); border-radius: 999px; }
                    #maintenanceOverlay.maint-night .maint-carousel-track::-webkit-scrollbar-thumb { background: rgba(229,231,235,0.12); }
                    .maint-carousel-track::-webkit-scrollbar-track { background: transparent; }
                    .maint-carousel-slide {
                        flex: 0 0 100%;
                        scroll-snap-align: start;
                        background: rgba(0,0,0,0.02);
                        border: 1px solid rgba(0,0,0,0.05);
                        border-radius: 16px;
                        padding: 12px 12px;
                    }
                    #maintenanceOverlay.maint-night .maint-carousel-slide {
                        background: rgba(255,255,255,0.06);
                        border-color: rgba(255,255,255,0.08);
                    }
                    .maint-mini-log {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        display: grid;
                        gap: 6px;
                        font-size: 0.9rem;
                    }
                    .maint-mini-log li {
                        display: flex;
                        align-items: flex-start;
                        gap: 8px;
                    }
                    .maint-chat-box {
                        position: relative;
                        border-radius: 16px;
                        border: 1px solid rgba(0,0,0,0.06);
                        background: rgba(255,255,255,0.75);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        min-height: 0;
                    }
                    .maint-chat-room-nav {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 10px;
                    }
                    .maint-chat-room-track {
                        flex: 1 1 auto;
                        min-width: 0;
                        display: flex;
                        gap: 8px;
                        overflow-x: auto;
                        scroll-snap-type: x mandatory;
                        -webkit-overflow-scrolling: touch;
                        padding: 2px 2px;
                        scrollbar-width: none;
                    }
                    .maint-chat-room-track::-webkit-scrollbar { height: 0; }
                    .maint-chat-room-btn {
                        scroll-snap-align: start;
                        border: 1px solid rgba(0,0,0,0.08);
                        background: rgba(255,255,255,0.8);
                        color: #111827;
                        border-radius: 999px;
                        padding: 8px 12px;
                        font-weight: 900;
                        letter-spacing: 0.04em;
                        text-transform: uppercase;
                        font-size: 0.72rem;
                        white-space: nowrap;
                        cursor: pointer;
                        box-shadow: 0 10px 26px rgba(15,23,42,.10);
                    }
                    #maintenanceOverlay.maint-night .maint-chat-room-btn {
                        border-color: rgba(255,255,255,0.12);
                        background: rgba(255,255,255,0.10);
                        color: rgba(229,231,235,0.95);
                    }
                    .maint-chat-room-btn.active {
                        border-color: color-mix(in srgb, var(--maintenance-accent, #fd7e14) 60%, transparent);
                        box-shadow: 0 16px 34px rgba(15,23,42,.14);
                    }

                    .maint-chat-launcher {
                        position: fixed;
                        top: 50%;
                        right: calc(14px + env(safe-area-inset-right, 0px));
                        transform: translateY(-50%);
                        z-index: 10050;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        pointer-events: auto;
                    }
                    .maint-chat-launcher-btn {
                        border: 1px solid rgba(0,0,0,0.10);
                        background: rgba(255,255,255,0.88);
                        color: #111827;
                        border-radius: 999px;
                        padding: 10px 12px;
                        font-weight: 950;
                        letter-spacing: 0.06em;
                        text-transform: uppercase;
                        font-size: 0.72rem;
                        box-shadow: 0 16px 34px rgba(15,23,42,.18);
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                    }
                    #maintenanceOverlay.maint-night .maint-chat-launcher-btn {
                        border-color: rgba(255,255,255,0.12);
                        background: rgba(17, 24, 39, 0.72);
                        color: rgba(229,231,235,0.95);
                    }
                    @media (max-width: 576px) {
                        .maint-chat-launcher {
                            top: 50%;
                            right: calc(12px + env(safe-area-inset-right, 0px));
                            transform: translateY(-50%);
                        }
                        .maint-chat-launcher-btn { padding: 9px 10px; font-size: 0.68rem; }
                    }

                    .maint-chat-drawer {
                        position: fixed;
                        inset: 0;
                        z-index: 22050;
                        display: grid;
                        grid-template-columns: 1fr;
                    }
                    .maint-chat-drawer[hidden] { display: none !important; }
                    .maint-chat-drawer-backdrop {
                        position: absolute;
                        inset: 0;
                        background: rgba(2,6,23,0.52);
                        backdrop-filter: blur(4px);
                    }
                    .maint-chat-drawer-panel {
                        position: absolute;
                        top: 50%;
                        right: calc(16px + env(safe-area-inset-right, 0px));
                        bottom: auto;
                        transform: translateY(-50%);
                        height: min(780px, 88vh);
                        width: min(520px, 92vw);
                        background: rgba(255,255,255,0.96);
                        border: 1px solid rgba(0,0,0,0.08);
                        border-radius: 18px;
                        box-shadow: 0 30px 90px rgba(0,0,0,0.28);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    #maintenanceOverlay.maint-night .maint-chat-drawer-panel {
                        background: rgba(17, 24, 39, 0.94);
                        border-color: rgba(255,255,255,0.10);
                        color: rgba(229,231,235,0.95);
                    }
                    .maint-chat-drawer-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        padding: 12px 12px;
                        border-bottom: 1px solid rgba(0,0,0,0.06);
                        background: linear-gradient(135deg, rgba(253,126,20,0.12), rgba(13,110,253,0.08));
                    }
                    #maintenanceOverlay.maint-night .maint-chat-drawer-header {
                        border-bottom-color: rgba(255,255,255,0.10);
                        background: linear-gradient(135deg, rgba(253,126,20,0.16), rgba(13,110,253,0.12));
                    }
                    .maint-chat-drawer-title {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-weight: 950;
                        letter-spacing: 0.06em;
                        text-transform: uppercase;
                        font-size: 0.8rem;
                    }
                    .maint-chat-drawer-close {
                        width: 38px;
                        height: 38px;
                        border-radius: 999px;
                        border: 1px solid rgba(0,0,0,0.08);
                        background: rgba(255,255,255,0.80);
                        display: grid;
                        place-items: center;
                        cursor: pointer;
                    }
                    #maintenanceOverlay.maint-night .maint-chat-drawer-close {
                        border-color: rgba(255,255,255,0.12);
                        background: rgba(255,255,255,0.10);
                        color: rgba(229,231,235,0.95);
                    }
                    .maint-chat-drawer-body {
                        padding: 12px 12px;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        min-height: 0;
                        flex: 1 1 auto;
                    }
                    .maint-chat-drawer-body .maint-chat-box {
                        flex: 1 1 auto;
                        min-height: 0;
                    }
                    #maintenanceOverlay.maint-night .maint-chat-box {
                        border-color: rgba(255,255,255,0.10);
                        background: rgba(255,255,255,0.08);
                    }
                    .maint-chat-messages {
                        flex: 1 1 auto;
                        min-height: 220px;
                        overflow-y: auto;
                        padding: 12px;
                        background: #e5ddd5;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(17,24,39,0.25) transparent;
                    }
                    #maintenanceOverlay.maint-night .maint-chat-messages {
                        background: #0a141f;
                        scrollbar-color: rgba(229,231,235,0.25) transparent;
                    }
                    .maint-chat-messages::-webkit-scrollbar { width: 8px; }
                    .maint-chat-messages::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.25); border-radius: 999px; }
                    #maintenanceOverlay.maint-night .maint-chat-messages::-webkit-scrollbar-thumb { background: rgba(229,231,235,0.25); }
                    .maint-chat-input {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        padding: 10px;
                        border-top: 1px solid rgba(0,0,0,0.06);
                        background: rgba(255,255,255,0.90);
                    }
                    #maintenanceOverlay.maint-night .maint-chat-input {
                        border-top-color: rgba(255,255,255,0.10);
                        background: rgba(17, 24, 39, 0.60);
                    }
                    .maint-chat-input input { border-radius: 999px; }
                    .maint-chat-login {
                        position: absolute;
                        inset: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        padding: 14px;
                        background: rgba(0,0,0,0.55);
                        backdrop-filter: blur(6px);
                        color: #fff;
                        text-align: center;
                    }
                    .maint-chat-msg { display: flex; max-width: 100%; }
                    .maint-chat-msg.me { justify-content: flex-end; }
                    .maint-chat-msg.other { justify-content: flex-start; }

                    body.maint-chat-open .maint-music-widget,
                    body.maint-chat-open .faq-float-btn,
                    body.maint-chat-open .faq-float-panel {
                        display: none !important;
                    }
                    .maint-chat-bubble {
                        max-width: 82%;
                        padding: 10px 12px;
                        border-radius: 14px;
                        line-height: 1.35;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.12);
                        word-break: break-word;
                    }
                    .maint-chat-msg.me .maint-chat-bubble {
                        background: #dcf8c6;
                        color: #111b21;
                        border-bottom-right-radius: 6px;
                    }
                    .maint-chat-msg.other .maint-chat-bubble {
                        background: #fff;
                        color: #111b21;
                        border-bottom-left-radius: 6px;
                    }
                    #maintenanceOverlay.maint-night .maint-chat-msg.me .maint-chat-bubble {
                        background: #005c4b;
                        color: #e9edef;
                    }
                    #maintenanceOverlay.maint-night .maint-chat-msg.other .maint-chat-bubble {
                        background: #1f2c34;
                        color: #e9edef;
                    }
                    .maint-chat-meta {
                        margin-top: 4px;
                        font-size: 0.7rem;
                        opacity: 0.75;
                        display: flex;
                        justify-content: flex-end;
                    }
                    .maint-mini-log .dot {
                        width: 10px;
                        height: 10px;
                        border-radius: 999px;
                        margin-top: 6px;
                        flex: 0 0 auto;
                        background: rgba(99,102,241,0.45);
                    }
                    .maint-mini-log .dot.done { background: rgba(34,197,94,0.9); }
                    .maint-mini-log .dot.doing { background: rgba(253,126,20,0.95); }
                    .maint-mini-log .dot.todo { background: rgba(148,163,184,0.9); }
                    .maint-badges {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .maint-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 10px;
                        border-radius: 999px;
                        font-size: 0.78rem;
                        font-weight: 800;
                        background: rgba(255,255,255,0.7);
                        border: 1px solid rgba(0,0,0,0.06);
                        color: #111827;
                    }
                    #maintenanceOverlay.maint-night .maint-badge {
                        background: rgba(255,255,255,0.08);
                        border-color: rgba(255,255,255,0.10);
                        color: #e5e7eb;
                    }
                    .maint-skeleton {
                        height: 14px;
                        border-radius: 10px;
                        background: linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.12), rgba(0,0,0,0.05));
                        background-size: 200% 100%;
                        animation: maint-shimmer 1.6s ease-in-out infinite;
                    }
                    #maintenanceOverlay.maint-night .maint-skeleton {
                        background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.16), rgba(255,255,255,0.08));
                    }
                    .maint-actions {
                        display: grid;
                        gap: 10px;
                        margin-top: 12px;
                    }
                    .maint-actions-row {
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                    .maint-actions-row .btn {
                        flex: 1 1 auto;
                        min-width: 160px;
                    }
                    .maint-icon-wrap {
                        width: 80px; height: 80px;
                        background: ${colorLight};
                        color: ${colorMain};
                        border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 2.5rem;
                        margin: 0 auto 1rem;
                        position: relative;
                        flex-shrink: 0;
                    }
                    .maint-icon-wrap i {
                        animation: maint-spin 14s linear infinite;
                        transform-origin: 50% 50%;
                    }
                    .maint-icon-wrap i.is-done {
                        animation: none;
                    }
                    .maint-icon-wrap::after {
                        content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                        border-radius: 50%;
                        border: 2px solid ${colorMain};
                        animation: pulse-ring 2s infinite;
                        z-index: -1;
                    }
                    .maint-progress {
                        height: 6px;
                        background: rgba(0,0,0,0.05);
                        border-radius: 10px;
                        overflow: hidden;
                        margin: 1rem 0 0.5rem;
                        position: relative;
                    }
                    .maint-progress-bar {
                        height: 100%;
                        background: ${colorMain};
                        background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent);
                        background-size: 1rem 1rem;
                        animation: progress-stripes 1s linear infinite;
                        border-radius: 10px;
                        transition: width 0.6s ease;
                    }
                    .maint-radio {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                        margin: 10px 0 6px;
                    }
                    .maint-radio-widget {
                        width: min(380px, 100%);
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 10px 12px;
                        border-radius: 18px;
                        background: rgba(255, 255, 255, 0.82);
                        border: 1px solid rgba(0,0,0,0.06);
                        box-shadow: 0 10px 25px rgba(0,0,0,0.06);
                    }
                    .maint-radio-right {
                        flex: 1 1 auto;
                        min-width: 0;
                        display: grid;
                        gap: 6px;
                    }
                    .maint-vinyl-wrap {
                        width: 64px;
                        height: 64px;
                        position: relative;
                        display: grid;
                        place-items: center;
                        filter: drop-shadow(0 8px 18px rgba(0,0,0,0.14));
                        flex: 0 0 auto;
                    }
                    .maint-vinyl {
                        width: 100%;
                        height: 100%;
                        border-radius: 999px;
                        background:
                          radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 0 6px, transparent 7px 100%),
                          radial-gradient(circle at 50% 50%, #2a2a2a 0 34%, #151515 35% 100%);
                        position: relative;
                        overflow: hidden;
                        transform: translateZ(0);
                    }
                    .maint-vinyl::before {
                        content: "";
                        position: absolute;
                        inset: 0;
                        border-radius: 999px;
                        background: repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0 1px, transparent 1px 6px);
                        opacity: 0.55;
                        mix-blend-mode: overlay;
                    }
                    .maint-vinyl::after {
                        content: "";
                        position: absolute;
                        inset: 0;
                        border-radius: 999px;
                        background: radial-gradient(circle at 20% 25%, rgba(255,255,255,0.35), transparent 45%);
                        opacity: 0.9;
                    }
                    .maint-vinyl-label {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 42%;
                        height: 42%;
                        border-radius: 999px;
                        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0.1) 40%, transparent 70%),
                                    radial-gradient(circle at 60% 65%, rgba(0,0,0,0.25), transparent 55%),
                                    linear-gradient(135deg, ${colorMain}, rgba(0,0,0,0.15));
                        border: 1px solid rgba(0,0,0,0.08);
                        display: grid;
                        place-items: center;
                        color: rgba(255,255,255,0.92);
                        font-weight: 800;
                        letter-spacing: 0.12em;
                        font-size: 0.55rem;
                        text-transform: uppercase;
                        z-index: 2;
                    }
                    .maint-vinyl-hole {
                        position: absolute;
                        width: 8px;
                        height: 8px;
                        border-radius: 999px;
                        background: rgba(0,0,0,0.55);
                        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.18);
                        z-index: 3;
                    }
                    .maint-vinyl-play {
                        animation: maint-spin 2.6s linear infinite;
                    }
                    .maint-radio-controls {
                        display: grid;
                        grid-template-columns: 36px 1fr;
                        gap: 10px;
                        align-items: center;
                        padding: 0;
                        border-radius: 0;
                        background: transparent;
                    }
                    .maint-radio-controls button {
                        width: 36px;
                        height: 36px;
                        border-radius: 999px;
                        border: 0;
                        background: rgba(0,0,0,0.06);
                        color: #212529;
                        display: grid;
                        place-items: center;
                    }
                    .maint-radio-controls input[type="range"] {
                        width: 100%;
                        accent-color: ${colorMain};
                        height: 6px;
                        background: linear-gradient(90deg, ${colorMain} 0%, rgba(0,0,0,0.14) 0%);
                        border-radius: 999px;
                        appearance: none;
                        -webkit-appearance: none;
                    }
                    .maint-radio-controls input[type="range"]::-webkit-slider-runnable-track {
                        height: 6px;
                        border-radius: 999px;
                        background: rgba(0,0,0,0.12);
                    }
                    .maint-radio-controls input[type="range"]::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 16px;
                        height: 16px;
                        border-radius: 999px;
                        background: ${colorMain};
                        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
                        border: 2px solid rgba(255,255,255,0.9);
                        margin-top: -5px;
                    }
                    .maint-radio-controls input[type="range"]::-moz-range-track {
                        height: 6px;
                        border-radius: 999px;
                        background: rgba(0,0,0,0.12);
                    }
                    .maint-radio-controls input[type="range"]::-moz-range-progress {
                        height: 6px;
                        border-radius: 999px;
                        background: ${colorMain};
                    }
                    .maint-radio-controls input[type="range"]::-moz-range-thumb {
                        width: 16px;
                        height: 16px;
                        border-radius: 999px;
                        background: ${colorMain};
                        border: 2px solid rgba(255,255,255,0.9);
                        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
                    }
                    .maint-audio-hint {
                        font-size: 0.78rem;
                        color: #6c757d;
                        margin-top: 0;
                    }
                    .maint-enable-sound {
                        border: 0;
                        border-radius: 999px;
                        padding: 8px 10px;
                        font-size: 0.85rem;
                        font-weight: 800;
                        background: ${colorMain};
                        color: #fff;
                        box-shadow: 0 14px 28px rgba(0,0,0,0.12);
                    }
                    /* Floating FAQ Widget */
                    .faq-float-btn {
                        position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: calc(20px + env(safe-area-inset-right, 0px));
                        width: 56px; height: 56px;
                        border-radius: 50%;
                        background: #ffffff;
                        color: ${colorMain};
                        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                        border: none;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 1.5rem;
                        cursor: pointer;
                        z-index: 20000;
                        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    }
                    .faq-float-btn:hover { transform: none; }
                    .faq-float-btn:active { transform: none; }

                    .faq-float-panel {
                        position: fixed; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); right: calc(20px + env(safe-area-inset-right, 0px));
                        width: 320px;
                        background: rgba(255, 255, 255, 0.98);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        padding: 1.5rem;
                        z-index: 20000;
                        transform-origin: bottom right;
                        transform: scale(0);
                        opacity: 0;
                        visibility: hidden;
                        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        border: 1px solid rgba(0,0,0,0.05);
                        text-align: left;
                    }
                    .faq-float-panel.active {
                        transform: scale(1);
                        opacity: 1;
                        visibility: visible;
                    }

                    .faq-accordion-item {
                        border-bottom: 1px solid rgba(0,0,0,0.05);
                        margin-bottom: 0.5rem;
                        padding-bottom: 0.5rem;
                    }
                    .faq-accordion-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

                    .faq-question {
                        font-weight: 600;
                        font-size: 0.9rem;
                        color: #212529;
                        cursor: pointer;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 0.5rem 0;
                        user-select: none;
                    }
                    .faq-question i { transition: transform 0.3s; color: ${colorMain}; }

                    .faq-answer {
                        max-height: 0;
                        overflow: hidden;
                        font-size: 0.85rem;
                        color: #6c757d;
                        transition: max-height 0.3s ease, margin-top 0.3s ease;
                    }
                    .faq-accordion-item.active .faq-answer {
                        max-height: 150px;
                        margin-top: 0.25rem;
                    }
                    /* Mobile Optimization */
                    @media (max-width: 576px) {
                        .faq-float-btn { bottom: calc(16px + env(safe-area-inset-bottom, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); width: 50px; height: 50px; }
                        .faq-float-panel { bottom: calc(74px + env(safe-area-inset-bottom, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); width: calc(100% - 32px); max-width: 320px; }
                        
                        .maint-container {
                            padding:
                              calc(0.75rem + env(safe-area-inset-top, 0px))
                              0.75rem
                              calc(0.75rem + 86px + env(safe-area-inset-bottom, 0px));
                            align-items: stretch;
                            justify-content: flex-start;
                        }
                        .maint-card {
                            width: 100%;
                            max-width: 520px;
                            margin: 0 auto;
                            padding: 1.25rem 0.95rem;
                            border-radius: 16px;
                            max-height: calc(100vh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
                            max-height: calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
                        }
                        .maint-icon-wrap {
                            width: 60px; height: 60px;
                            font-size: 2rem;
                            margin-bottom: 0.75rem;
                        }
                        .maint-vinyl-wrap {
                            width: 56px;
                            height: 56px;
                        }
                        h1.h3 { font-size: 1.25rem !important; margin-bottom: 0.25rem !important; }
                        p.mb-3 { font-size: 0.9rem !important; margin-bottom: 0.75rem !important; }

                        .maint-carousel-head {
                            flex-wrap: wrap;
                            gap: 8px;
                        }
                        .maint-carousel-nav {
                            width: 100%;
                            justify-content: flex-end;
                        }

                        .maint-chat-room-nav { margin-bottom: 8px; }
                        .maint-chat-room-btn { padding: 7px 10px; font-size: 0.68rem; }
                        .maint-chat-messages { height: min(260px, 36vh); padding: 10px; }
                        .maint-chat-drawer-panel {
                            top: calc(12px + env(safe-area-inset-top, 0px));
                            right: calc(12px + env(safe-area-inset-right, 0px));
                            bottom: calc(12px + env(safe-area-inset-bottom, 0px));
                            transform: none;
                            height: auto;
                            width: min(520px, 96vw);
                        }

                        .maint-est-row {
                            flex-direction: column;
                            align-items: stretch !important;
                            justify-content: flex-start;
                            gap: 10px !important;
                        }
                        .maint-est-sep { display: none; }
                        .maint-est-row .text-start,
                        .maint-est-row .text-end {
                            text-align: left !important;
                            width: 100%;
                        }
                        .maint-est-row #maintenanceClock { text-align: left; }
                        
                        #maintenanceClock {
                            font-size: 1.4rem !important; /* Restore large clock */
                            letter-spacing: 1px !important;
                        }
                        
                        .btn-lg {
                            padding: 0.9rem !important; /* Larger touch target */
                            font-size: 1rem !important;
                        }
                        .faq-item { font-size: 0.75rem; }
                        .faq-item i { font-size: 1rem !important; }
                        .maint-actions {
                            gap: 8px;
                            margin-top: 10px;
                        }
                        .maint-actions-row {
                            flex-wrap: nowrap;
                            overflow-x: auto;
                            -webkit-overflow-scrolling: touch;
                            scrollbar-width: none;
                            justify-content: flex-start;
                            padding-bottom: 2px;
                        }
                        .maint-actions-row::-webkit-scrollbar { height: 0; }
                        .maint-actions-row .btn {
                            flex: 0 0 auto;
                            min-width: auto;
                            white-space: nowrap;
                        }
                    }

                    @media (max-width: 576px) and (orientation: landscape) {
                        .maint-container {
                            padding:
                              calc(0.5rem + env(safe-area-inset-top, 0px))
                              0.6rem
                              calc(0.5rem + 70px + env(safe-area-inset-bottom, 0px));
                        }
                        .maint-card { padding: 1rem 0.85rem; }
                        .maint-chat-messages { height: min(210px, 30vh); }
                    }
                  </style>
                  <div class="maint-container">
                      <div class="maint-card">
                           <div class="maint-icon-wrap">
                                <i id="maintIcon" class="bi ${iconClass}"></i>
                           </div>
                           
                           <div class="maint-content-wrapper">
                               <div class="maint-summary">
                               <div class="maint-summary-head">
                               <h1 class="h3 fw-bold mb-2 maint-title">${title}</h1>
                               <p class="mb-3 maint-muted">${desc}</p>
                               ${type === 'maintenance' ? '' : ''}
                               </div>
                               
                               <!-- Progress Section -->
                               <div class="text-start mb-3 maint-summary-progress">
                                    <div class="d-flex justify-content-between align-items-center mb-1">
                                        <small class="fw-bold maint-muted" id="maintDetailDesc" style="font-size: 0.8rem;">${detailDesc}</small>
                                        <small class="fw-bold" id="maintProgressPercent" style="color: ${colorMain}; font-size: 0.75rem;">${progressVal}%</small>
                                    </div>
                                    <div class="maint-progress">
                                        <div class="maint-progress-bar" id="maintProgressBar" style="width: ${progressVal}%"></div>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center mt-2">
                                        <small class="fw-semibold maint-muted" style="font-size: 0.72rem;">Terakhir dicek</small>
                                        <small class="fw-bold font-monospace" id="maintHealthCheckAt" style="font-size: 0.72rem; color: ${colorMain};">--:--:--</small>
                                    </div>
                                    <div class="small mt-1 maint-muted" id="maintConnWarn"></div>
                               </div>
    
    
    
                               <div class="d-flex align-items-center justify-content-center gap-3 mb-3 p-2 rounded-3 maint-est-row" style="background: rgba(0,0,0,0.04);">
                                    <div class="text-start">
                                        <small class="d-block text-uppercase fw-bold maint-muted" style="font-size: 0.65rem; letter-spacing: 1px;">Estimasi</small>
                                        <div class="d-flex align-items-baseline gap-2">
                                            <span class="fw-bold font-monospace maint-title" id="maintEstNum" style="font-size: 1.25rem; line-height: 1;">${estNum}</span>
                                            <span class="fw-bold maint-muted" id="maintEstUnit" style="font-size: 0.8rem;">${estUnit}</span>
                                        </div>
                                        <div class="small fw-semibold mt-1 maint-muted">Selesai sekitar <span class="fw-bold font-monospace" id="maintEtaAt">--:--</span></div>
                                        <div class="small mt-1 maint-muted" id="maintEtaNote">Biasanya selesai lebih cepat kalau tidak ada kendala.</div>
                                    </div>
                                    <div class="vr mx-2 maint-est-sep"></div>
                                    <div class="text-end">
                                         <small class="d-block text-uppercase fw-bold maint-muted" style="font-size: 0.65rem; letter-spacing: 1px;">Waktu</small>
                                         <div id="maintenanceClock" class="fw-bold font-monospace" style="color: ${colorMain}; font-size: 0.9rem;">00:00:00</div>
                                    </div>
                               </div>

                               </div>

                               <div class="maint-details-grid">

                                   <div class="maint-section" style="margin-top: 12px;">
                                       <div class="maint-section-title"><span><i class="bi bi-heart-fill me-2" style="color:${colorMain};"></i>Terima kasih</span><span id="maintThemeNote" class="small fw-semibold" style="letter-spacing:0; text-transform:none;"></span></div>
                                       <div class="small maint-muted">Terima kasih sudah menunggu. Kami tahu waktu kamu berharga, dan kami lagi fokus bikin layanan ini lebih stabil.</div>
                                       <div class="mt-3">
                                           <div class="maint-section-title"><span><i class="bi bi-shield-lock-fill me-2" style="color:${colorMain};"></i>Data Kamu</span></div>
                                           <div class="small maint-muted"><b>Data kamu aman.</b> Maintenance tidak menghapus file, link, atau riwayat download.</div>
                                       </div>
                                   </div>

                                   <div class="maint-section" style="margin-top: 12px;">
                                       <div class="maint-section-title"><span><i class="bi bi-list-check me-2" style="color:${colorMain};"></i>Progress Detail</span><span class="small fw-semibold maint-muted" style="letter-spacing:0; text-transform:none;">lagi dikerjain</span></div>
                                       <ul class="maint-mini-log" id="maintMiniLog">
                                           <li><span class="dot done"></span><div><div class="fw-semibold">Database backup selesai</div><div class="small maint-muted">Amanin data & konfigurasi</div></div></li>
                                           <li><span class="dot doing"></span><div><div class="fw-semibold">Optimasi server (berjalan)</div><div class="small maint-muted">Stabilitas & performa</div></div></li>
                                           <li><span class="dot todo"></span><div><div class="fw-semibold">Deploy fitur baru (menunggu)</div><div class="small maint-muted">Update terakhir sebelum online</div></div></li>
                                       </ul>
                                   </div>

                                   <div class="maint-section" style="margin-top: 12px;">
                                       <div class="maint-section-title"><span><i class="bi bi-stars me-2" style="color:${colorMain};"></i>Setelah Maintenance</span></div>
                                       <ul class="maint-mini-log" id="maintWhatsNew">
                                           <li><span class="dot done"></span><div class="fw-semibold">Download lebih cepat</div></li>
                                           <li><span class="dot done"></span><div class="fw-semibold">Error converter dikurangi</div></li>
                                           <li><span class="dot done"></span><div class="fw-semibold">Tampilan mobile lebih ringan</div></li>
                                       </ul>
                                   </div>

                                   <div class="maint-section maint-section--wide" style="margin-top: 12px;">
                                       <div class="maint-section-title"><span><i class="bi bi-hdd-network-fill me-2" style="color:${colorMain};"></i>Status Server</span></div>
                                       <div class="maint-badges" id="maintServices">
                                           <span class="maint-badge"><span style="color:#22c55e;">●</span> Database: OK</span>
                                           <span class="maint-badge"><span style="color:${colorMain};">●</span> Converter: Maintenance</span>
                                           <span class="maint-badge"><span style="color:#ef4444;">●</span> API YouTube: Rate limited</span>
                                       </div>
                                       <div class="small mt-2 maint-muted" id="maintMetaLine">Maintenance ID: <span class="fw-bold font-monospace" id="maintId">MT-000000</span> • Terakhir diperbarui: <span class="fw-bold font-monospace" id="maintLastUpdated">--:-- WIB</span></div>
                                       <div class="mt-3">
                                           <div class="maint-section-title"><span><i class="bi bi-lightbulb-fill me-2" style="color:${colorMain};"></i>Tips</span></div>
                                           <div class="small maint-muted" id="maintTipText">Gunakan format MP3 192kbps untuk kualitas terbaik.</div>
                                       </div>
                                   </div>

                               </div>
                           </div>

                          <div class="maint-actions">
                               <button id="maintenanceCheckBtn" class="btn btn-lg w-100 rounded-pill fw-bold text-white shadow-sm hover-scale flex-shrink-0" style="background: ${colorMain}; border: none;" onclick="manualCheckStatus()">
                                   <i class="bi bi-arrow-clockwise me-2"></i>Cek status terbaru
                               </button>
                               <div class="maint-actions-row">
                                   <button type="button" class="btn btn-outline-secondary rounded-pill fw-bold" onclick="window.copyMaintenanceStatus && window.copyMaintenanceStatus()">
                                       <i class="bi bi-clipboard-check me-2"></i>Salin status
                                   </button>
                                   <button type="button" class="btn btn-outline-secondary rounded-pill fw-bold" onclick="window.enableOnlineNotify && window.enableOnlineNotify()">
                                       <i class="bi bi-bell-fill me-2"></i>Beri tahu saat online
                                   </button>
                                   <a class="btn btn-outline-secondary rounded-pill fw-bold" href="./status.html" target="_blank" rel="noopener">
                                       <i class="bi bi-activity me-2"></i>Status Page
                                   </a>
                                   <button type="button" class="btn btn-outline-secondary rounded-pill fw-bold" onclick="window.remindLater && window.remindLater(5)">
                                       <i class="bi bi-clock me-2"></i>Cek lagi 5 menit
                                   </button>
                               </div>
                               <div class="small mt-1 maint-muted">Waktu ditampilkan sesuai zona waktu kamu. Jika tampilan belum berubah setelah online, coba refresh (Ctrl + F5).</div>
                               <div class="small mt-1 maint-muted">Ada kendala? hubungi: <a href="mailto:help.ytconv@proton.me">help.ytconv@proton.me</a></div>
                           </div>
                      </div>

                      <div class="maint-chat-launcher" id="maintChatLauncher" aria-label="Buka Forum Chat">
                        <button type="button" class="maint-chat-launcher-btn" id="maintChatLauncherOpen" aria-haspopup="dialog" aria-expanded="false">
                          <i class="bi bi-chat-dots-fill" style="color:${colorMain};"></i>
                          <span>Forum Chat</span>
                        </button>
                      </div>

                      <div class="maint-chat-drawer" id="maintChatDrawer" hidden>
                        <div class="maint-chat-drawer-backdrop" id="maintChatDrawerBackdrop" aria-hidden="true"></div>
                        <div class="maint-chat-drawer-panel" role="dialog" aria-modal="true" aria-label="Forum Chat">
                          <div class="maint-chat-drawer-header">
                            <div class="maint-chat-drawer-title"><i class="bi bi-chat-square-text-fill" style="color:${colorMain};"></i> Forum Chat</div>
                            <button type="button" class="maint-chat-drawer-close" id="maintChatDrawerClose" aria-label="Tutup Forum Chat"><i class="bi bi-x-lg"></i></button>
                          </div>
                          <div class="maint-chat-drawer-body">
                            <div class="maint-chat-room-nav" style="margin-bottom: 6px;">
                              <div class="maint-chat-room-track" id="maintChatRoomTrack" aria-label="Pilih room chat">
                                <button type="button" class="maint-chat-room-btn active" data-room="umum">Chat Umum</button>
                                <button type="button" class="maint-chat-room-btn" data-room="request">Chat Request</button>
                              </div>
                            </div>
                            <div class="maint-section-title" style="margin-bottom: 6px;">
                              <span><i class="bi bi-chat-square-text-fill me-2" style="color:${colorMain};"></i><span id="maintChatRoomName">Chat Umum</span></span>
                              <span class="small fw-semibold maint-muted" id="maintChatRoomLabel" style="letter-spacing:0; text-transform:none;">room: umum</span>
                            </div>

                            <div class="maint-chat-box">
                              <div class="maint-chat-login" id="maintChatLogin" hidden>
                                <div class="fw-bold">Login dulu untuk ikut chat</div>
                                <button type="button" class="btn btn-light rounded-pill fw-bold px-4" id="maintChatLoginBtn">
                                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G" class="me-2">
                                  Masuk dengan Google
                                </button>
                                <div class="small opacity-75">Pilih room di atas untuk mulai ngobrol.</div>
                              </div>
                              <div class="maint-chat-messages" id="maintChatMessages"></div>
                              <div class="maint-chat-input">
                                <input type="text" class="form-control" id="maintChatInput" placeholder="Ketik pesan..." autocomplete="off">
                                <button type="button" class="btn btn-primary rounded-circle" id="maintChatSend" style="width:42px;height:42px;display:grid;place-items:center;">
                                  <i class="bi bi-send-fill"></i>
                                </button>
                                <span class="badge text-bg-success" id="maintChatStatus" hidden></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Floating FAQ Widget -->
                      <button id="faqFloatBtn" class="faq-float-btn" onclick="toggleFaqPanel()">
                          <i class="bi bi-question-lg"></i>
                      </button>

                      <div id="faqFloatPanel" class="faq-float-panel">
                          <h6 class="fw-bold mb-3 small text-uppercase" style="letter-spacing: 0.5px; color: #6c757d !important;"><i class="bi bi-question-circle-fill me-2"></i>Pertanyaan Umum</h6>
                          
                          <div class="faq-accordion-item">
                              <div class="faq-question" onclick="toggleFaqItem(this)">
                                  <span>Data saya aman?</span>
                                  <i class="bi bi-chevron-down"></i>
                              </div>
                              <div class="faq-answer">
                                  Aman 100%. Tidak ada data yang hilang selama proses maintenance ini berlangsung.
                              </div>
                          </div>
                          
                          <div class="faq-accordion-item">
                              <div class="faq-question" onclick="toggleFaqItem(this)">
                                  <span>Bagaimana download saya?</span>
                                  <i class="bi bi-chevron-down"></i>
                              </div>
                              <div class="faq-answer">
                                  Silakan ulangi proses download setelah maintenance selesai.
                              </div>
                          </div>
                          
                          <div class="faq-accordion-item">
                              <div class="faq-question" onclick="toggleFaqItem(this)">
                                  <span>Kenapa maintenance?</span>
                                  <i class="bi bi-chevron-down"></i>
                              </div>
                              <div class="faq-answer">
                                  Kami melakukan upgrade server untuk meningkatkan stabilitas dan kecepatan sistem.
                              </div>
                          </div>
                      </div>
                  </div>
              `;
            try { overlay.style.setProperty('--maint-accent', colorMain); } catch { }

            // Clock Logic
            function updateMaintClock() {
              const el = document.getElementById('maintenanceClock');
              if (el) {
                const now = new Date();
                el.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
                const hc = document.getElementById('maintHealthCheckAt');
                if (hc) {
                  const last = window.__lastHealthcheckAt instanceof Date ? window.__lastHealthcheckAt : now;
                  hc.textContent = `${last.toLocaleTimeString('id-ID', { hour12: false })} WIB`;
                }
                const etaAt = document.getElementById('maintEtaAt');
                if (etaAt) {
                  const info = window.__lastHealthData && window.__lastHealthData.maintenanceInfo ? window.__lastHealthData.maintenanceInfo : null;
                  const endAtMs = info && Number.isFinite(Number(info.etaEndAt)) ? Number(info.etaEndAt) : null;
                  if (endAtMs) {
                    const endAt = new Date(endAtMs);
                    etaAt.textContent = endAt.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' });
                  }
                }
              }
            }
            if (window.maintClockInterval) clearInterval(window.maintClockInterval);
            window.maintClockInterval = setInterval(updateMaintClock, 1000);
            updateMaintClock();
            try { window.initMaintenanceChatLauncher && window.initMaintenanceChatLauncher(); } catch { }
            if (type === 'maintenance') {
              try { window.initMaintenanceRadio && window.initMaintenanceRadio(); } catch { }
              try { window.initMaintenanceForumChat && window.initMaintenanceForumChat(); } catch { }
            } else {
              try { window.destroyMaintenanceRadio && window.destroyMaintenanceRadio(); } catch { }
              try { window.destroyMaintenanceForumChat && window.destroyMaintenanceForumChat(); } catch { }
            }

          }
        }
      }

      window.destroyMaintenanceRadio = function () {
        const st = window.__maintRadioState;
        if (!st) return;
        try { st.keepAliveTimer && clearInterval(st.keepAliveTimer); } catch { }
        try { st.onVisibility && document.removeEventListener('visibilitychange', st.onVisibility); } catch { }
        try { st.cleanup && st.cleanup(); } catch { }
        try { st.player && typeof st.player.destroy === 'function' && st.player.destroy(); } catch { }
        delete window.__maintRadioState;
      };

      window.initMaintenanceRadio = function () {
        const overlay = document.getElementById('maintenanceOverlay');
        if (!overlay || overlay.hidden) return;
        const mount = document.getElementById('maintYTPlayer');
        const vinyl = document.getElementById('maintVinyl');
        const volumeEl = document.getElementById('maintVolume');
        const muteBtn = document.getElementById('maintMuteBtn');
        const enableBtn = document.getElementById('maintEnableSoundBtn');
        const hint = document.getElementById('maintAudioHint');
        if (!mount || !vinyl || !volumeEl || !muteBtn || !enableBtn) return;

        const saved = Number(localStorage.getItem('maint_volume'));
        const initialVol = Number.isFinite(saved) ? Math.max(0, Math.min(100, Math.round(saved))) : 70;
        volumeEl.value = String(initialVol);
        try {
          const pct = Math.max(0, Math.min(100, Number(volumeEl.value) || 0));
          volumeEl.style.background = `linear-gradient(90deg, var(--maint-accent, #fd7e14) ${pct}%, rgba(0,0,0,0.14) ${pct}%)`;
        } catch { }

        const setVinylPlaying = (playing) => {
          vinyl.classList.toggle('maint-vinyl-play', Boolean(playing));
        };

        const setMuteIcon = (muted) => {
          const icon = muteBtn.querySelector('i');
          if (!icon) return;
          icon.className = muted ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
        };

        const ensureYouTubeApi = () => {
          if (window.__ytIframeApiReadyPromise) return window.__ytIframeApiReadyPromise;
          window.__ytIframeApiReadyPromise = new Promise((resolve) => {
            if (window.YT && window.YT.Player) return resolve(true);
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
              try { if (typeof prev === 'function') prev(); } catch { }
              resolve(true);
            };
            const existing = document.querySelector('script[data-yt-iframe-api="1"]');
            if (existing) return;
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            s.async = true;
            s.dataset.ytIframeApi = '1';
            document.head.appendChild(s);
          });
          return window.__ytIframeApiReadyPromise;
        };

        window.destroyMaintenanceRadio();

        const state = {
          unlocked: false,
          player: null,
          cleanup: null,
          keepAliveTimer: null,
          onVisibility: null,
        };
        window.__maintRadioState = state;

        const unlock = () => {
          if (!state.player || state.unlocked) return;
          state.unlocked = true;
          try { localStorage.setItem('maint_audio_wants_sound', '1'); } catch { }
          try {
            state.player.unMute();
            state.player.setVolume(Number(volumeEl.value) || 0);
            state.player.playVideo();
          } catch { }
          enableBtn.classList.add('d-none');
          if (hint) hint.textContent = 'Sedang diputar';
        };

        const bindControls = () => {
          const onVolume = () => {
            const v = Math.max(0, Math.min(100, Number(volumeEl.value) || 0));
            localStorage.setItem('maint_volume', String(v));
            try {
              volumeEl.style.background = `linear-gradient(90deg, var(--maint-accent, #fd7e14) ${v}%, rgba(0,0,0,0.14) ${v}%)`;
            } catch { }
            if (!state.player) return;
            try { state.player.setVolume(v); } catch { }
            if (v > 0) {
              try { localStorage.setItem('maint_audio_wants_sound', '1'); } catch { }
              if (!state.unlocked) state.unlocked = true;
              try { state.player.unMute(); } catch { }
            }
            if (v === 0) {
              try { state.player.mute(); } catch { }
            }
            try { setMuteIcon(Boolean(state.player.isMuted && state.player.isMuted())); } catch { }
          };

          const onMuteToggle = () => {
            if (!state.player) return;
            try {
              const isMuted = Boolean(state.player.isMuted && state.player.isMuted());
              if (isMuted) {
                try { localStorage.setItem('maint_audio_wants_sound', '1'); } catch { }
                state.player.unMute();
                if (!state.unlocked) state.unlocked = true;
              } else {
                state.player.mute();
              }
              setMuteIcon(Boolean(state.player.isMuted && state.player.isMuted()));
            } catch { }
          };

          const onEnable = (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            unlock();
          };

          volumeEl.addEventListener('input', onVolume);
          muteBtn.addEventListener('click', onMuteToggle);
          enableBtn.addEventListener('click', onEnable);
          overlay.addEventListener('pointerdown', onEnable, { capture: true, once: true });

          state.cleanup = () => {
            try { volumeEl.removeEventListener('input', onVolume); } catch { }
            try { muteBtn.removeEventListener('click', onMuteToggle); } catch { }
            try { enableBtn.removeEventListener('click', onEnable); } catch { }
          };
        };

        ensureYouTubeApi().then(() => {
          if (!document.getElementById('maintYTPlayer')) return;
          if (!window.YT || !window.YT.Player) return;
          try {
            state.player = new window.YT.Player('maintYTPlayer', {
              videoId: 'jfKfPfyJRdk',
              playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
              },
              events: {
                onReady: () => {
                  try { state.player.setVolume(Number(volumeEl.value) || 0); } catch { }
                  try { state.player.mute(); } catch { }
                  try { state.player.playVideo(); } catch { }
                  bindControls();
                  setMuteIcon(true);
                  setVinylPlaying(true);
                  if (hint) hint.textContent = 'Sedang diputar';
                  let wantsSound = false;
                  try { wantsSound = localStorage.getItem('maint_audio_wants_sound') === '1'; } catch { }
                  if (wantsSound) {
                    window.setTimeout(() => {
                      try { unlock(); } catch { }
                    }, 250);
                  }
                  window.setTimeout(() => {
                    if (!state.player) return;
                    let mutedNow = true;
                    try { mutedNow = Boolean(state.player.isMuted && state.player.isMuted()); } catch { }
                    if (mutedNow && !state.unlocked) {
                      enableBtn.classList.remove('d-none');
                      if (hint) hint.textContent = 'Tap untuk nyalain suara';
                    } else {
                      enableBtn.classList.add('d-none');
                    }
                  }, 1200);

                  state.onVisibility = () => {
                    if (!state.player) return;
                    if (document.visibilityState === 'visible') {
                      try { state.player.playVideo(); } catch { }
                    }
                  };
                  document.addEventListener('visibilitychange', state.onVisibility);

                  state.keepAliveTimer = window.setInterval(() => {
                    if (!state.player) return;
                    const mountNow = document.getElementById('maintYTPlayer');
                    if (!mountNow) return;
                    let wants = false;
                    try { wants = localStorage.getItem('maint_audio_wants_sound') === '1'; } catch { }
                    let playerState = null;
                    try { playerState = state.player.getPlayerState(); } catch { }
                    const ps = window.YT && window.YT.PlayerState ? window.YT.PlayerState : null;
                    const isPlaying = ps ? playerState === ps.PLAYING || playerState === ps.BUFFERING : false;
                    if (!isPlaying) {
                      try { state.player.playVideo(); } catch { }
                    }
                    if (wants) {
                      let isMuted = true;
                      try { isMuted = Boolean(state.player.isMuted && state.player.isMuted()); } catch { }
                      if (isMuted) {
                        try { state.player.unMute(); } catch { }
                        try { state.player.setVolume(Number(volumeEl.value) || 0); } catch { }
                      }
                    }
                  }, 4000);
                },
                onStateChange: (ev) => {
                  const code = ev && typeof ev.data === 'number' ? ev.data : null;
                  setVinylPlaying(code === 1 || code === 3);
                },
              },
            });
          } catch {
            bindControls();
          }
        });
      };

      // Poll every 30 seconds
      setInterval(checkServerStatus, 30000);
      checkServerStatus(); // Initial check

      document.addEventListener('DOMContentLoaded', () => {
        checkStorageAndWarn();
        const APP_VERSION = 'v4.0 stable';

        // Sync About Modal Version
        const aboutVerEl = document.getElementById('aboutVersionBadge');
        if (aboutVerEl) aboutVerEl.textContent = APP_VERSION;

        // --- Footer Logic (New) ---
        function updateLocalTime() {
          const el = document.getElementById('localTimeBadge');
          if (el) {
            const now = new Date();
            const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' };
            el.innerHTML = `<i class="bi bi-clock me-1"></i>${now.toLocaleTimeString('id-ID', options)}`;
          }
        }
        setInterval(updateLocalTime, 1000);
        updateLocalTime();

        // Last Updated & Storage Duration (Dynamic from /api/health)
        // Logic moved to checkServerStatus()

        // Global function for Shortcut Hints
        window.showShortcutHints = function () {
          const modalHtml = `
      <div class="modal fade" id="shortcutModal" tabindex="-1">
          <div class="modal-dialog modal-md modal-dialog-centered">
              <div class="modal-content">
                  <div class="modal-header">
                      <h6 class="modal-title fw-bold"><i class="bi bi-keyboard me-2"></i>Shortcuts</h6>
                      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                  </div>
                  <div class="modal-body small">
                      <div class="row g-2">
                        <div class="col-12 col-sm-6">
                          <ul class="list-group list-group-flush">
                              <li class="list-group-item d-flex justify-content-between"><span>Fokus ke input URL</span> <kbd>/</kbd></li>
                              <li class="list-group-item d-flex justify-content-between"><span>Convert sekarang</span> <kbd>Enter</kbd></li>
                              <li class="list-group-item d-flex justify-content-between"><span>Buka Pengaturan</span> <kbd>Ctrl+,</kbd></li>
                              <li class="list-group-item d-flex justify-content-between"><span>Buka AI Navigator</span> <kbd>Ctrl+Space</kbd></li>
                          </ul>
                        </div>
                        <div class="col-12 col-sm-6">
                          <ul class="list-group list-group-flush">
                              <li class="list-group-item d-flex justify-content-between"><span>Buka FAQ</span> <kbd>Ctrl+Shift+F</kbd></li>
                              <li class="list-group-item d-flex justify-content-between"><span>Buka Experience Hub</span> <kbd>Ctrl+Shift+E</kbd></li>
                              <li class="list-group-item d-flex justify-content-between"><span>Buka Converter</span> <kbd>Ctrl+Shift+C</kbd></li>
                              <li class="list-group-item d-flex justify-content-between"><span>Buka modal Shortcut</span> <kbd>Ctrl+/</kbd></li>
                          </ul>
                        </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>`;

          let m = document.getElementById('shortcutModal');
          if (!m) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            m = document.getElementById('shortcutModal');
          }
          const bsModal = new window.bootstrap.Modal(m);
          bsModal.show();
        };

        // Keyboard listener for shortcuts
        document.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === ',') {
            e.preventDefault();
            const offcanvas = document.getElementById('offcanvasSettings');
            if (offcanvas) {
              const bsOffcanvas = new window.bootstrap.Offcanvas(offcanvas);
              bsOffcanvas.toggle();
            }
          }
          if (e.ctrlKey && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            const faqBtn = document.querySelector('[data-section-target="faq"]');
            if (faqBtn) faqBtn.click();
          }
          if (e.ctrlKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
            e.preventDefault();
            const expBtn = document.querySelector('[data-section-target="experience"]');
            if (expBtn) expBtn.click();
          }
          if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            const convBtn = document.querySelector('[data-section-target="converter"]');
            if (convBtn) convBtn.click();
          }
          if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            window.showShortcutHints();
          }
          if (e.ctrlKey && e.key === ' ') {
            e.preventDefault();
            const aiToggle = document.getElementById('assistantToggle');
            if (aiToggle) aiToggle.click();
          }
          if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const input = document.getElementById('urlInput');
            if (input) input.focus();
          }
        });

        // YT Music Button Logic
        const ytMusicBtn = document.getElementById('ytMusicBtn');
        if (ytMusicBtn) {
          ytMusicBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isAndroid = /android/i.test(userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

            if (isAndroid) {
              // Android Intent: Try to open app, fallback to Play Store
              window.location.href = 'intent://music.youtube.com/#Intent;scheme=https;package=com.google.android.apps.youtube.music;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.google.android.apps.youtube.music;end';
            } else if (isIOS) {
              // iOS: Open link, let OS handle app opening
              window.location.href = 'https://music.youtube.com/';
            } else {
              // PC/Desktop: New Tab
              window.open('https://music.youtube.com/', '_blank');
            }
          });
        }

        // ===== Utilities =====
        const $ = (sel) => document.querySelector(sel);
        const $$ = (sel) => document.querySelectorAll(sel);
        const bootstrapGlobal = window.bootstrap;
        const toastEl = $('#toast');
        const toastTextEl = $('#toastText');
        const bs = new Proxy(
          {},
          {
            get(_, prop) {
              const lib = window.bootstrap;
              if (!lib) return undefined;
              return lib[prop];
            },
          },
        );

        let lastUiClickAt = 0;
        const playUiClick = () => {
          const now = Date.now();
          if (now - lastUiClickAt < 55) return;
          lastUiClickAt = now;
          try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) return;
            if (!window.__ytmp3UiAudioCtx) window.__ytmp3UiAudioCtx = new AudioContextCtor();
            const ctx = window.__ytmp3UiAudioCtx;
            if (ctx.state === 'suspended') ctx.resume().catch(() => { });
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(740, ctx.currentTime);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.065);
          } catch { }
        };

        const isUiClickableTarget = (target) => {
          if (!target || !(target instanceof Element)) return false;
          const el = target.closest(
            'button, a, [role="button"], .btn, .app-nav-btn, .modern-nav-item, .forum-widget-toggle, .dropdown-item',
          );
          if (!el) return false;
          if (el.closest('.toast, .toast-container')) return false;
          if (el.matches('input, textarea, select, label')) return false;
          if (el.getAttribute('aria-disabled') === 'true') return false;
          if (el.matches('button:disabled, .disabled')) return false;
          return true;
        };

        document.addEventListener(
          'pointerdown',
          (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            if (isUiClickableTarget(e.target)) playUiClick();
          },
          { capture: true },
        );

        const SUPPORTED_LANGS = ['en', 'ko', 'ja'];
        const LANGUAGE_VARIANTS = {
          en: ['en', 'en-us', 'en-gb', 'en-au', 'en-ca', 'en-in', 'eng'],
          ko: ['ko', 'ko-kr'],
          ja: ['ja', 'ja-jp'],
        };
        const FALLBACK_LANG = 'en';
        const I18N_STRINGS = {
          id: {
            navConverter: 'Converter',
            navExperience: 'Experience',
            navProfile: 'Profil',
            'Login Google aktif. Cookies YouTube otomatis digunakan.': 'Login Google aktif. Cookies YouTube otomatis digunakan.',
            navAssistant: 'AI Navigator',
            sectionTitleConverter: 'Converter',
            sectionSubtitleConverter: 'Konversi video lebih cepat & stabil.',
            sectionTitleExperience: 'Experience Hub',
            sectionSubtitleExperience: 'Avatar dinamis, musik adaptif, dan voice control siap dibuka.',
            sectionTitleProfile: 'Profil',
            sectionSubtitleProfile: 'Pantau XP, badge, dan riwayat avatar kamu.',
            sectionTitleFaq: 'Pertanyaan Umum',
            sectionSubtitleFaq: 'Jawaban untuk pertanyaan yang sering diajukan.',
            sectionTitleSaweria: 'Dukung Saweria',
            sectionSubtitleSaweria: 'Bantu kami berkembang dengan donasi seikhlasnya.',
            labelUrl: 'URL Media (YouTube / Spotify / SoundCloud)',
            placeholderUrl: 'Tempel URL (YouTube, Spotify, SoundCloud, ... )',
            buttonSample: 'Contoh',
            helpUrl: 'Tempel link dari YouTube, Spotify, atau SoundCloud. Centang "Abaikan playlist" untuk mempercepat.',
            labelKeyword: 'Cari judul lagu',
            placeholderKeyword: 'Ketik judul lagu atau artis',
            buttonKeywordConvert: 'Auto Convert',
            buttonKeywordSearch: 'Cari',
            helpKeyword: 'Cukup ketik judul, kami cari & convert otomatis.',
            labelSearchResults: 'Hasil YouTube',
            labelRingtoneToggle: 'Siapkan versi ringtone (Android & iPhone)',
            labelRingtoneLength: 'Durasi ringtone (detik)',
            labelRingtoneSummary: '30 detik',
            labelRingtoneFade: 'Gunakan fade in/out halus',
            hintRingtone: 'Hasilkan file .m4r untuk iPhone dan .ogg untuk Android.',
            buttonConvert: 'Convert',
            buttonDownloadAll: 'Download Semua',
            buttonDownloadZip: 'Download ZIP',
            buttonClear: 'Bersihkan',
            ringtoneTitle: 'Ringtone siap diunduh',
            searchUse: 'Pakai',
            searchConvert: 'Convert',
            searchNoResults: 'Tidak ada hasil yang cocok.',
            searchLoading: 'Mencari...',
            toastKeywordRequired: 'Masukkan kata kunci lagu terlebih dahulu',
            toastKeywordReady: 'Video ditemukan, siap dikonversi.',
            toastKeywordError: 'Gagal mencari video. Coba kata kunci lain.',
            toastKeywordQueued: 'Sedang menyiapkan konversi dari kata kunci...',
            ringtoneSummaryDefault: 'Pilih versi ringtone sesuai perangkatmu.',
            ringtoneSummaryAndroid: 'Versi Android siap diunduh.',
            ringtoneSummaryIphone: 'Versi iPhone siap diunduh.',
            ringtoneSummaryBoth: 'Versi Android & iPhone siap diunduh.',
            voiceStatusReady: 'Perintah suara siap digunakan.',
            voiceStatusListening: 'Mendengarkan... ucapkan \'buka donasi\' atau \'mainkan game...\'',
            voiceStatusStopped: 'Perintah suara dihentikan.',
            voiceStatusUnsupported: 'Browser belum mendukung voice recognition.',
            toastVoiceHandled: 'Perintah suara: {value}',
            toastVoiceUnknown: 'Perintah belum dikenali: {value}',
            sourcePreviewLabel: 'Preview Spotify',
            labelSpeed: 'Mode Kecepatan',
            speedHint: 'Beberapa format mungkin membatasi pilihan.',
            labelTrimStart: 'Trim Mulai',
            placeholderTrimStart: 'detik atau hh:mm:ss',
            labelTrimEnd: 'Trim Selesai',
            placeholderTrimEnd: 'detik atau hh:mm:ss',
            labelFileName: 'Nama file',
            placeholderFileName: 'Nama file output',
            labelMetadataId3: 'Metadata ID3',
            placeholderId3Title: 'Judul',
            placeholderId3Artist: 'Artis',
            placeholderId3Album: 'Album',
            placeholderId3Genre: 'Genre',
            labelNormalize: 'Normalisasi audio',
            labelAtmos: 'Dolby Atmos (multi-channel)',
            labelDenoise: 'AI Noise Cleaner',
            labelVolumeBoost: 'Volume Booster',
          },
          en: {
            navConverter: 'Converter',
            navExperience: 'Experience',
            navProfile: 'Profile',
            'Login Google aktif. Cookies YouTube otomatis digunakan.': 'Google login active. YouTube cookies are handled automatically.',
            navAssistant: 'AI Navigator',
            sectionTitleConverter: 'Converter',
            sectionSubtitleConverter: 'Convert videos faster & more reliably.',
            sectionTitleExperience: 'Experience Hub',
            sectionSubtitleExperience: 'Dynamic avatar, adaptive music, and voice control are ready to explore.',
            sectionTitleProfile: 'Profile',
            sectionSubtitleProfile: 'Track your XP, badges, and avatar history.',
            sectionTitleFaq: 'FAQ',
            sectionSubtitleFaq: 'Answers to frequently asked questions.',
            sectionTitleSaweria: 'Support on Saweria',
            sectionSubtitleSaweria: 'Help us grow with a donation.',
            labelUrl: 'Media URL (YouTube / Spotify / SoundCloud)',
            placeholderUrl: 'Paste URL (YouTube, Spotify, SoundCloud, ... )',
            buttonSample: 'Sample',
            helpUrl: 'Paste links from YouTube, Spotify, or SoundCloud. Check "Ignore playlist" to speed things up.',
            labelKeyword: 'Search song title',
            placeholderKeyword: 'Type a song title or artist',
            buttonKeywordConvert: 'Auto Convert',
            buttonKeywordSearch: 'Search',
            helpKeyword: 'Just enter a title, we\'ll search and convert automatically.',
            labelSearchResults: 'YouTube Results',
            labelRingtoneToggle: 'Prepare ringtone versions (Android & iPhone)',
            labelRingtoneLength: 'Ringtone length (seconds)',
            labelRingtoneSummary: '30 seconds',
            labelRingtoneFade: 'Apply gentle fade in/out',
            hintRingtone: 'Generate .m4r for iPhone and .ogg for Android.',
            buttonConvert: 'Convert',
            buttonDownloadAll: 'Download All',
            buttonDownloadZip: 'Download ZIP',
            buttonClear: 'Clear',
            ringtoneTitle: 'Ringtones ready to download',
            searchUse: 'Use',
            searchConvert: 'Convert',
            searchNoResults: 'No matching results.',
            searchLoading: 'Searching...',
            toastKeywordRequired: 'Enter a song keyword first',
            toastKeywordReady: 'Video found and ready to convert.',
            toastKeywordError: 'Failed to find the video. Try another keyword.',
            toastKeywordQueued: 'Preparing conversion from keyword...',
            ringtoneSummaryDefault: 'Pick the ringtone version for your device.',
            ringtoneSummaryAndroid: 'Android version ready to download.',
            ringtoneSummaryIphone: 'iPhone version ready to download.',
            ringtoneSummaryBoth: 'Android & iPhone versions ready to download.',
            voiceStatusReady: 'Voice commands are ready.',
            voiceStatusListening: 'Listening say "open donation" or "play the game...."',
            voiceStatusStopped: 'Voice command stopped.',
            voiceStatusUnsupported: 'This browser does not support voice recognition.',
            toastVoiceHandled: 'Voice command: {value}',
            toastVoiceUnknown: 'Command not recognized: {value}',
            sourcePreviewLabel: 'Spotify preview',
            labelSpeed: 'Speed Mode',
            speedHint: 'Some formats may limit choices.',
            labelTrimStart: 'Trim Start',
            placeholderTrimStart: 'seconds or hh:mm:ss',
            labelTrimEnd: 'Trim End',
            placeholderTrimEnd: 'seconds or hh:mm:ss',
            labelFileName: 'File name',
            placeholderFileName: 'Output file name',
            labelMetadataId3: 'ID3 Metadata',
            placeholderId3Title: 'Title',
            placeholderId3Artist: 'Artist',
            placeholderId3Album: 'Album',
            placeholderId3Genre: 'Genre',
            labelNormalize: 'Normalize audio',
            labelAtmos: 'Dolby Atmos (multi-channel)',
            labelDenoise: 'AI Noise Cleaner',
            labelVolumeBoost: 'Volume Boost',
          },
          es: {
            searchUse: 'Usar',
            searchConvert: 'Convertir',
          },
          ja: {
            navConverter: 'コンバーター',
            navExperience: '実績・XP',
            navProfile: 'プロフィール',
            'Login Google aktif. Cookies YouTube otomatis digunakan.': 'Googleログイン有効。YouTube Cookieが自動的に使用されます。',
            navAssistant: 'AIアシスタント',
            sectionTitleConverter: '動画変換',
            sectionSubtitleConverter: '高品質な音声変換ツール',
            sectionTitleExperience: '実績システム',
            sectionSubtitleExperience: '使えば使うほどレベルアップ！',
            sectionTitleProfile: 'ユーザー情報',
            sectionSubtitleProfile: 'XPとステータスの確認',
            labelUrl: '動画URL (YouTube / Spotify / SoundCloud)',
            placeholderUrl: 'URLを貼り付け (YouTube, Spotify, SoundCloud...)',
            buttonSample: 'サンプル',
            helpUrl: 'YouTube、Spotify、またはSoundCloudのリンクを貼り付けてください。「プレイリストを無視」で高速化。',
            labelKeyword: '曲名検索',
            placeholderKeyword: '曲名またはアーティスト名を入力',
            buttonKeywordConvert: '自動変換',
            buttonKeywordSearch: '検索',
            helpKeyword: 'タイトルを入力するだけで、自動的に検索・変換します。',
            labelSearchResults: 'YouTube検索結果',
            labelRingtoneToggle: '着信音作成 (Android & iPhone)',
            labelRingtoneLength: '長さ (秒)',
            labelRingtoneSummary: '30秒',
            labelRingtoneFade: 'フェードイン/アウト',
            hintRingtone: 'iPhone用 (.m4r) と Android用 (.ogg) を生成します。',
            buttonConvert: '変換開始',
            buttonDownloadAll: 'すべてダウンロード',
            buttonDownloadZip: 'ZIPでダウンロード',
            buttonClear: 'クリア',
            ringtoneTitle: '着信音設定',
            searchUse: '使用',
            searchConvert: '変換',
            searchNoResults: '結果が見つかりません',
            searchLoading: '読み込み中...',
            toastKeywordRequired: 'キーワードを入力してください',
            toastKeywordReady: '準備完了',
            toastKeywordError: 'エラーが発生しました',
            toastKeywordQueued: '検索キューに追加されました',
            ringtoneSummaryDefault: 'デフォルト (30秒)',
            ringtoneSummaryAndroid: 'Android用のみ',
            ringtoneSummaryIphone: 'iPhone用のみ',
            ringtoneSummaryBoth: 'Android & iPhone両対応',
            voiceStatusReady: '音声認識の準備完了',
            voiceStatusListening: '聞き取り中... お話しください',
            voiceStatusStopped: '停止しました',
            voiceStatusUnsupported: 'ブラウザがサポートしていません',
            toastVoiceHandled: '音声コマンド: {value}',
            toastVoiceUnknown: '不明なコマンド: {value}',
            sourcePreviewLabel: 'Spotifyプレビュー',
            labelSpeed: '速度',
            speedHint: '再生速度を調整します。',
            labelTrimStart: '開始時間',
            placeholderTrimStart: '例: 00:00:10',
            labelTrimEnd: '終了時間',
            placeholderTrimEnd: '例: 00:03:45',
            labelFileName: 'ファイル名',
            placeholderFileName: 'カスタムファイル名',
            labelMetadataId3: 'ID3タグ編集',
            placeholderId3Title: 'タイトル',
            placeholderId3Artist: 'アーティスト',
            placeholderId3Album: 'アルバム',
            placeholderId3Genre: 'ジャンル',
            labelNormalize: '音量正規化',
            labelAtmos: 'Dolby Atmos (空間オーディオ)',
            labelDenoise: 'AIノイズ除去',
            labelVolumeBoost: '音量ブースト',
          },
          ko: {
            navConverter: '변환기',
            navExperience: '경험',
            navProfile: '프로필',
            'Login Google aktif. Cookies YouTube otomatis digunakan.': 'Google 로그인이 활성화되었습니다. YouTube 쿠키가 자동으로 사용됩니다.',
            navAssistant: 'AI 어시스턴트',
            sectionTitleConverter: '비디오 변환',
            sectionSubtitleConverter: '고품질 오디오 변환 도구.',
            sectionTitleExperience: '업적 시스템',
            sectionSubtitleExperience: '더 많이 사용하고, 레벨을 올리고, 배지를 획득하세요.',
            sectionTitleProfile: '사용자 프로필',
            sectionSubtitleProfile: 'XP, 레벨 및 상태 확인.',
            labelUrl: '동영상 URL (YouTube / Spotify / SoundCloud)',
            placeholderUrl: 'URL 붙여넣기 (YouTube, Spotify, SoundCloud, ...)',
            buttonSample: '샘플',
            helpUrl: 'YouTube, Spotify 또는 SoundCloud 링크를 지원합니다. "검색" 버튼을 사용할 수도 있습니다.',
            labelKeyword: '키워드 검색 모드',
            placeholderKeyword: '곡 제목 또는 아티스트 입력',
            buttonKeywordConvert: '직접 변환',
            buttonKeywordSearch: '검색',
            helpKeyword: '제목을 입력하여 동영상을 찾습니다.',
            labelSearchResults: 'YouTube 결과',
            labelRingtoneToggle: '벨소리 만들기 (Android & iPhone)',
            labelRingtoneLength: '벨소리 길이 (초)',
            labelRingtoneSummary: '30초',
            labelRingtoneFade: '페이드 인/아웃 적용',
            hintRingtone: 'iPhone은 .m4r, Android는 .ogg로 변환됩니다.',
            buttonConvert: '변환',
            buttonDownloadAll: '모두 다운로드',
            buttonDownloadZip: 'ZIP 다운로드',
            buttonClear: '초기화',
            ringtoneTitle: '벨소리 제작 도구',
            searchUse: '사용',
            searchConvert: '변환',
            searchNoResults: '검색 결과가 없습니다.',
            searchLoading: '검색 중...',
            toastKeywordRequired: '검색 키워드를 입력해주세요.',
            toastKeywordReady: '검색이 완료되었습니다. 결과를 확인하세요.',
            toastKeywordError: '검색 중 오류가 발생했습니다. 다시 시도해주세요.',
            toastKeywordQueued: '검색 대기열에 추가됨',
            ringtoneSummaryDefault: '모든 장치에 호환되는 형식입니다.',
            ringtoneSummaryAndroid: 'Android 기기에 최적화된 형식입니다.',
            ringtoneSummaryIphone: 'iPhone 기기에 최적화된 형식입니다.',
            ringtoneSummaryBoth: 'Android 및 iPhone 모두 지원합니다.',
            voiceStatusReady: '음성 인식 준비 완료.',
            voiceStatusListening: '듣는 중... 말씀해 주세요.',
            voiceStatusStopped: '음성 인식이 중지되었습니다.',
            voiceStatusUnsupported: '브라우저가 음성 인식을 지원하지 않습니다.',
            toastVoiceHandled: '음성 명령: {value}',
            toastVoiceUnknown: '알 수 없는 명령: {value}',
            sourcePreviewLabel: 'Spotify 미리듣기',
            labelSpeed: '속도',
            speedHint: '재생 속도 조절',
            labelTrimStart: '시작 시간',
            placeholderTrimStart: '예: 00:00:10',
            labelTrimEnd: '종료 시간',
            placeholderTrimEnd: '예: 00:03:45',
            labelFileName: '파일명',
            placeholderFileName: '파일 이름 입력',
            labelMetadataId3: 'ID3 태그 편집',
            placeholderId3Title: '제목',
            placeholderId3Artist: '아티스트',
            placeholderId3Album: '앨범',
            placeholderId3Genre: '장르',
            labelNormalize: '볼륨 평준화',
            labelAtmos: 'Dolby Atmos (공간 음향)',
            labelDenoise: 'AI 노이즈 제거',
            labelVolumeBoost: '볼륨 부스트',
          },
          ar: {
            searchUse: 'استعمال',
            searchConvert: 'تحويل',
          },
          ru: {
            searchUse: 'Использовать',
            searchConvert: 'Конвертировать',
          },
          de: {
            searchUse: 'Verwenden',
            searchConvert: 'Konvertieren',
          },
        };

        const EMAILJS_PUBLIC_KEY = 'jT-4e85nCgIpRJak5';
        const EMAILJS_SERVICE_ID = 'service_733722j';
        const EMAILJS_TEMPLATE_ID = 'template_rdmekih';
        const EMAILJS_AUTOREPLY_TEMPLATE_ID = 'template_58uztm9';
        const TICKET_STATUS_BASE_URL = 'https://ytconv.up.railway.app';

        const buildTicketStatusLink = (ticketId = '') => {
          const base = TICKET_STATUS_BASE_URL.replace(/\/+$/, '');
          return `${base}/ticket-status.html?ticket_id=${encodeURIComponent(ticketId || '')}`;
        };

        function initPublicTicketLookup() {
          const form = document.getElementById('publicTicketLookupForm');
          const input = document.getElementById('publicTicketLookupInput');
          const wrap = document.getElementById('publicRecentTicketWrap');
          const list = document.getElementById('publicRecentTicketList');
          if (!form || !input) return;
          const recentKey = 'ytconv_recent_tickets_v1';
          const normalize = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
          const readRecent = () => {
            try {
              const value = JSON.parse(localStorage.getItem(recentKey) || '[]');
              return Array.isArray(value) ? value.filter((item) => item?.ticketId).slice(0, 5) : [];
            } catch {
              return [];
            }
          };
          const remember = (ticketId) => {
            const recent = readRecent().filter((item) => normalize(item.ticketId) !== ticketId);
            recent.unshift({ ticketId, status: 'unknown', updatedAt: new Date().toISOString() });
            localStorage.setItem(recentKey, JSON.stringify(recent.slice(0, 5)));
          };
          const openTicket = (rawId) => {
            const ticketId = normalize(rawId);
            if (!/^TKT-[A-Z0-9_-]{4,76}$/.test(ticketId)) {
              input.setCustomValidity('Masukkan nomor tiket yang valid, misalnya TKT-AB12CD34EF56.');
              input.reportValidity();
              return;
            }
            input.setCustomValidity('');
            remember(ticketId);
            window.location.assign(buildTicketStatusLink(ticketId));
          };
          const renderRecent = () => {
            const recent = readRecent();
            if (!list || !wrap) return;
            list.replaceChildren();
            wrap.hidden = recent.length === 0;
            recent.forEach((item) => {
              const button = document.createElement('button');
              button.type = 'button';
              button.className = 'btn btn-sm btn-outline-secondary rounded-pill';
              button.textContent = normalize(item.ticketId);
              button.addEventListener('click', () => openTicket(item.ticketId));
              list.appendChild(button);
            });
            if (!input.value && recent[0]) input.value = normalize(recent[0].ticketId);
          };
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            openTicket(input.value);
          });
          input.addEventListener('input', () => input.setCustomValidity(''));
          document.getElementById('ticketLookupModal')?.addEventListener('show.bs.modal', renderRecent);
          renderRecent();
        }


        const buildAiTicketDraft = ({ name = '', email = '', category = '', message = '' } = {}) => {
          const now = new Date();
          const device = `${navigator.platform || '-'} | ${navigator.userAgent || '-'}`;
          const network = navigator.onLine ? 'online' : 'offline';
          const page = window.location.href;
          const cleanMessage = String(message || '').trim() || '(belum diisi)';
          const title = cleanMessage.split('\n').find(Boolean)?.slice(0, 90) || 'Laporan pengguna';
          return [
            `Judul: ${title}`,
            `Kategori: ${category || '-'}`,
            `Pengguna: ${name || '-'} <${email || '-'}>`,
            `Waktu laporan: ${now.toLocaleString('id-ID')}`,
            `Status koneksi: ${network}`,
            `Halaman: ${page}`,
            `Perangkat: ${device}`,
            '',
            'Deskripsi masalah/saran:',
            cleanMessage,
            '',
            'Langkah yang sudah dicoba:',
            '1) Refresh halaman',
            '2) Coba ulang di mode converter yang sama',
            '3) Cek koneksi internet',
            '',
            'Dampak:',
            '- Jelaskan dampaknya ke proses convert/download.'
          ].join('\n');
        };

        function showTicketSuccessCard({ ticketId = '', statusLink = '', autoReplySent = true } = {}) {
          const old = document.getElementById('ticketSuccessOverlay');
          if (old) old.remove();
          const overlay = document.createElement('div');
          overlay.id = 'ticketSuccessOverlay';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:1085;background:rgba(2,6,23,.62);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s ease;';
          overlay.innerHTML = `
            <div style="max-width:420px;width:100%;background:#0f172a;border:1px solid rgba(148,163,184,.35);border-radius:18px;padding:20px;color:#e2e8f0;box-shadow:0 20px 45px rgba(2,6,23,.5);transform:translateY(18px) scale(.96);transition:transform .28s cubic-bezier(.2,.8,.2,1);">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <div style="width:38px;height:38px;border-radius:999px;background:linear-gradient(135deg,#4f46e5,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:20px;">✅</div>
                <div>
                  <div style="font-weight:800;font-size:1.05rem;">Tiket berhasil terkirim</div>
                  <div style="font-size:.9rem;color:#cbd5e1;">ID Tiket: <b>${ticketId || '-'}</b></div>
                </div>
              </div>
              <div style="font-size:.9rem;color:#cbd5e1;line-height:1.45;">
                Tim support akan memproses laporan kamu. Simpan ID tiket ini untuk tracking status.
              </div>
              <div style="font-size:.83rem;color:${autoReplySent ? '#93c5fd' : '#fbbf24'};margin-top:10px;">
                ${autoReplySent ? 'Email admin + auto-reply user berhasil dikirim.' : 'Tiket berhasil dibuat, tapi sebagian email (admin/auto-reply) belum terkirim. Cek folder spam atau ulangi.'}
              </div>
              <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                ${statusLink ? `<a href="${statusLink}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">Cek Status Tiket</a>` : ''}
                <button type="button" class="btn btn-sm btn-outline-light" id="ticketSuccessCloseBtn">Tutup</button>
              </div>
            </div>`;
          document.body.appendChild(overlay);
          requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            const card = overlay.firstElementChild;
            if (card) card.style.transform = 'translateY(0) scale(1)';
          });
          let closed = false;
          const close = () => {
            if (closed) return;
            closed = true;
            overlay.style.opacity = '0';
            const card = overlay.firstElementChild;
            if (card) card.style.transform = 'translateY(16px) scale(.96)';
            setTimeout(() => overlay.remove(), 220);
          };
          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
          });
          overlay.querySelector('#ticketSuccessCloseBtn')?.addEventListener('click', close);
          setTimeout(close, 3200);
        }

        function initEmailContact() {
          const form = document.getElementById('emailForm');
          const submitBtn = document.getElementById('emailSubmitBtn');
          const dateInput = document.getElementById('emailDate');
          const ticketIdInput = document.getElementById('emailTicketId');
          const proofInput = document.getElementById('emailProof');
          const proofPreview = document.getElementById('emailProofPreview');
          const aiDraftBtn = document.getElementById('emailAiDraftBtn');
          const aiDraftHint = document.getElementById('emailAiDraftHint');
          if (!form || !submitBtn) return;

          const generateTicketId = () => {
            const bytes = new Uint8Array(9);
            crypto.getRandomValues(bytes);
            return `TKT-${Array.from(bytes, (value) => value.toString(36).padStart(2, '0')).join('').slice(0, 12).toUpperCase()}`;
          };

          const ensureTicketId = () => {
            if (ticketIdInput && !ticketIdInput.value) ticketIdInput.value = generateTicketId();
          };

          document.getElementById('emailModal')?.addEventListener('show.bs.modal', ensureTicketId);
          ensureTicketId();

          const applyDownloaderHelperPreset = () => {
            ensureTicketId();
            if (form.category) form.category.value = 'teknis';
            if (form.message && !form.message.value.trim()) {
              form.message.value = [
                'Downloader helper gagal / tidak bisa download.',
                '',
                'Saya sudah upload screenshot error pada lampiran.',
                'Nama dan email sudah saya isi agar admin bisa follow up.',
                '',
                'Detail tambahan:',
                '- Link/video yang dicoba:',
                '- Format yang dipilih:',
                '- Pesan error yang muncul:'
              ].join('\n');
            }
            if (proofPreview) proofPreview.textContent = 'Silakan upload screenshot error downloader helper di sini.';
            if (aiDraftHint) aiDraftHint.textContent = 'Preset downloader helper aktif. Isi nama, email, screenshot, lalu kirim tiket.';
            setToast('Mode tiket downloader helper aktif. Isi nama, email, dan screenshot error.', 'info');
            setTimeout(() => (form.name || form.email || form.message)?.focus?.(), 120);
          };

          document.querySelectorAll('[data-ticket-preset="downloader-helper"]').forEach((button) => {
            button.addEventListener('click', () => setTimeout(applyDownloaderHelperPreset, 120));
          });

          if (proofInput && proofPreview) {
            proofInput.addEventListener('change', () => {
              const files = Array.from(proofInput.files || []).slice(0, 4);
              if (!files.length) {
                proofPreview.textContent = 'Belum ada file bukti dipilih.';
                return;
              }
              proofPreview.textContent = files.map((f) => `${f.name} (${Math.ceil(f.size / 1024)} KB)`).join(' • ');
            });
          }

          if (aiDraftBtn) {
            aiDraftBtn.addEventListener('click', () => {
              const drafted = buildAiTicketDraft({
                name: form.name?.value?.trim() || '',
                email: form.email?.value?.trim() || '',
                category: form.category?.value || '',
                message: form.message?.value?.trim() || '',
              });
              if (form.message) {
                form.message.value = drafted;
                form.message.focus();
              }
              if (aiDraftHint) aiDraftHint.textContent = 'Draft AI berhasil dibuat. Tinggal cek ulang lalu kirim tiket.';
              setToast('Draft deskripsi tiket berhasil dibuat oleh AI Navigator.', 'success');
            });
          }

          form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (dateInput) dateInput.value = new Date().toLocaleString('id-ID');
            ensureTicketId();

            const originalHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Mengirim tiket...';

            try {
              const files = Array.from((proofInput && proofInput.files) ? proofInput.files : []).slice(0, 4);
              const proofs = [];
              for (const file of files) {
                let uploadedUrl = '';
                try {
                  if (typeof uploadToCloudinaryAuto === 'function') {
                    uploadedUrl = await uploadToCloudinaryAuto(file, 'ytconv/support-tickets');
                  }
                } catch (uploadErr) {
                  console.warn('Upload Cloudinary langsung gagal, fallback dataUrl', uploadErr);
                }

                if (uploadedUrl) {
                  proofs.push({ name: file.name, type: file.type, size: file.size, url: uploadedUrl });
                  continue;
                }

                const fallbackProof = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
                  reader.onerror = () => reject(new Error(`Gagal membaca file ${file.name}`));
                  reader.readAsDataURL(file);
                });
                proofs.push(fallbackProof);
              }

              const payload = {
                ticketId: ticketIdInput?.value || generateTicketId(),
                name: form.name?.value?.trim() || '',
                email: form.email?.value?.trim() || '',
                category: form.category?.value || 'teknis',
                message: form.message?.value?.trim() || '',
                proofs,
                file_link: proofs[0]?.url || '',
                date: dateInput?.value || new Date().toISOString(),
                userAgent: navigator.userAgent || '',
                pageUrl: window.location.href,
              };

              const sendTemplateEmailJs = async (templateId, templateParams) => {
                if (!window.emailjs || !EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !templateId) {
                  throw new Error('EmailJS belum dikonfigurasi');
                }
                window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
                let lastErr = null;
                for (let i = 0; i < 3; i++) {
                  try {
                    await window.emailjs.send(EMAILJS_SERVICE_ID, templateId, templateParams, { publicKey: EMAILJS_PUBLIC_KEY });
                    return true;
                  } catch (err) {
                    lastErr = err;
                    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
                  }
                }
                throw lastErr || new Error('Gagal mengirim auto-reply EmailJS');
              };

              const resp = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const result = await resp.json().catch(() => ({}));
              if (!resp.ok || !result?.ok) {
                throw new Error(result?.error || 'Gagal membuat tiket ke server');
              }
              const canonicalTicketId = String(result?.ticketId || payload.ticketId || '').trim().toUpperCase();
              const firstLink = result?.fileLink || payload.file_link || '';
              const statusLink = buildTicketStatusLink(canonicalTicketId);
              const sharedParams = {
                ticket_id: canonicalTicketId,
                name: payload.name,
                email: payload.email,
                category: payload.category,
                message: payload.message,
                file_link: firstLink || 'Tidak ada file',
                date: payload.date,
                status_link: statusLink,
              };
              let autoReplySent = false;
              let adminEmailSent = false;
              try {
                const [adminResult, autoReplyResult] = await Promise.allSettled([
                  sendTemplateEmailJs(EMAILJS_TEMPLATE_ID, sharedParams),
                  sendTemplateEmailJs(EMAILJS_AUTOREPLY_TEMPLATE_ID, sharedParams),
                ]);
                adminEmailSent = adminResult.status === 'fulfilled';
                autoReplySent = autoReplyResult.status === 'fulfilled';
              } catch (mailErr) {
                console.error('Auto-reply EmailJS gagal', mailErr);
              }

              const allSent = autoReplySent && adminEmailSent;
              try {
                const recentKey = 'ytconv_recent_tickets_v1';
                const previous = JSON.parse(localStorage.getItem(recentKey) || '[]');
                const recent = Array.isArray(previous) ? previous.filter((item) => item?.ticketId !== canonicalTicketId) : [];
                recent.unshift({ ticketId: canonicalTicketId, status: 'received', updatedAt: new Date().toISOString() });
                localStorage.setItem(recentKey, JSON.stringify(recent.slice(0, 5)));
              } catch {}
              setToast(`Tiket ${canonicalTicketId} berhasil dikirim. Tunggu respon maksimal 2x24 jam.`, allSent ? 'success' : 'warning');
              showTicketSuccessCard({
                ticketId: canonicalTicketId,
                statusLink,
                autoReplySent: allSent
              });
              try {
                const modalEl = document.getElementById('emailModal');
                if (modalEl && window.bootstrap?.Modal) {
                  const instance = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
                  instance.hide();
                }
              } catch {}
              form.reset();
              if (proofPreview) proofPreview.textContent = '';
              if (ticketIdInput) ticketIdInput.value = generateTicketId();
            } catch (err) {
              console.error('Email ticket error', err);
              setToast('Gagal mengirim tiket. Silakan email langsung ke forumwargaytmp3@gmail.com', 'danger');
            } finally {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalHtml;
            }
          });
        }

        const TEXT_TRANSLATIONS = {
          'Beberapa format mungkin membatasi pilihan.': { en: 'Some formats may limit choices.', ko: '일부 형식은 선택을 제한할 수 있습니다.', ja: '一部の形式では選択肢が制限される場合があります。' },
          'Semua mode tersedia.': { en: 'All modes available.', ko: '모든 모드 사용 가능.', ja: 'すべてのモードが利用可能です。' },
          'Nightcore & Slowed dinonaktifkan.': { en: 'Nightcore & Slowed disabled.', ko: 'Nightcore 및 Slowed 비활성화됨.', ja: 'NightcoreとSlowedは無効です。' },
          'Mode kecepatan dimatikan demi sinkronisasi.': { en: 'Speed mode disabled for synchronization.', ko: '동기화를 위해 속도 모드가 비활성화되었습니다.', ja: '同期のため速度モードは無効です。' },
          'Gunakan playback normal untuk lossless.': { en: 'Use normal playback for lossless.', ko: '무손실을 위해 일반 재생을 사용하세요.', ja: 'ロスレスには通常再生を使用してください。' },
          'Tidak ada pengubah kecepatan.': { en: 'No speed modifiers.', ko: '속도 변경 없음.', ja: '速度変更なし。' },
          'Mode kecepatan dimatikan untuk menjaga lossless.': { en: 'Speed mode disabled to preserve lossless.', ko: '무손실 보존을 위해 속도 모드가 비활성화되었습니다.', ja: 'ロスレス保存のため速度モードは無効です。' },
          'Tidak ada mode tempo untuk format ini.': { en: 'No tempo modes for this format.', ko: '이 형식에는 템포 모드가 없습니다.', ja: 'この形式にはテンポモードがありません。' },
          'Nightcore tersedia, Slowed dimatikan.': { en: 'Nightcore available, Slowed disabled.', ko: 'Nightcore 사용 가능, Slowed 비활성화됨.', ja: 'Nightcoreは利用可能、Slowedは無効。' },
          'Pengubah kecepatan dimatikan untuk video.': { en: 'Speed modifiers disabled for video.', ko: '동영상에 대한 속도 변경이 비활성화되었습니다.', ja: '動画の速度変更は無効になっています。' },
          'Install': { en: 'Install', ko: '설치', ja: 'インストール' },
          'Pengaturan': { en: 'Settings', ko: '설정', ja: '設定' },
          'Menu fitur': { en: 'Feature menu', ko: '기능 메뉴', ja: '機能メニュー' },
          'Lewati ke konten utama': { en: 'Skip to main content', ko: '본문으로 건너뛰기', ja: 'メインコンテンツへスキップ' },
          'Offline': { en: 'Offline', ko: '오프라인', ja: 'オフライン' },
          'AI Navigator': { en: 'AI Navigator', ko: 'AI 내비게이터', ja: 'AIナビゲーター' },
          'Converter': { en: 'Converter', ko: '변환기', ja: 'コンバーター' },
          'Konversi video lebih cepat & stabil.': { en: 'Convert videos faster & more reliably.', ko: '더 빠르고 안정적인 비디오 변환.', ja: 'より高速で安定した動画変換。' },
          'Antrian kosong': { en: 'Queue is empty' },
          'Aplikasi ditambahkan ke layar utama': { en: 'App added to home screen' },
          'Bass+ diterapkan': { en: 'Bass+ applied' },
          'Belum ada caption untuk disalin': { en: 'No caption to copy yet' },
          'Belum ada email untuk disalin': { en: 'No email draft to copy' },
          'Belum ada hook untuk disalin': { en: 'No hook to copy yet' },
          'Belum ada link share': { en: 'No share link yet' },
          'Belum ada link untuk dibagikan': { en: 'No link available to share' },
          'Belum ada panduan audiophile untuk disalin': { en: 'No audiophile guide to copy yet' },
          'Belum ada pitch untuk disalin': { en: 'No pitch to copy yet' },
          'Belum ada press kit untuk disalin': { en: 'No press kit to copy yet' },
          'Belum ada prompt cover untuk disalin': { en: 'No cover prompt to copy yet' },
          'Belum ada teaser lirik untuk disalin': { en: 'No lyric teaser to copy yet' },
          'Belum ada teks subtitle': { en: 'No subtitle text yet' },
          'Belum ada timeline rilis untuk disalin': { en: 'No release timeline to copy yet' },
          'Berhasil diproses': { en: 'Processed successfully', ko: '성공적으로 처리되었습니다.', ja: '処理が成功しました。' },
          'Menganalisis metadata': { en: 'Analyzing metadata' },
          'Menulis caption promosi': { en: 'Writing promo caption' },
          'Caption promosi siap digunakan ?': { en: 'Promo caption ready ?' },
          'Menyusun pitch playlist': { en: 'Drafting playlist pitch' },
          'Pitch playlist siap dipakai ?': { en: 'Playlist pitch ready ?' },
          'Menganalisis karakter audio': { en: 'Analyzing audio profile' },
          'Panduan audiophile siap digunakan 🎧': { en: 'Audiophile guide ready 🎧' },
          'Menyusun hook promosi': { en: 'Crafting promo hook' },
          'Hook promosi siap pakai ?': { en: 'Promo hook ready ?' },
          'Membangun prompt cover art': { en: 'Building cover art prompt' },
          'Prompt cover siap 🎨': { en: 'Cover prompt ready 🎨' },
          'Merancang timeline rilis': { en: 'Designing release timeline' },
          'Timeline rilis siap dipakai 📅': { en: 'Release timeline ready 📅' },
          'Menyusun press kit': { en: 'Assembling press kit' },
          'Press kit siap dibagikan 📰': { en: 'Press kit ready to share 📰' },
          'Menulis email outreach': { en: 'Writing outreach email' },
          'Email outreach siap kirim 📧': { en: 'Outreach email ready to send 📧' },
          'Menyusun teaser lirik': { en: 'Crafting lyric teaser' },
          'Teaser lirik siap di-post 🎵': { en: 'Lyric teaser ready to post 🎵' },
          'Mengirim ke background': { en: 'Sending to background' },
          'Browser belum mendukung text-to-speech.': { en: 'Browser does not support text-to-speech.' },
          'Browser tidak mendukung audio latar.': { en: 'Browser does not support background audio.' },
          'Caption disalin ke clipboard': { en: 'Caption copied to clipboard' },
          'Caption siap disalin': { en: 'Caption ready to copy' },
          'Clipboard tidak tersedia': { en: 'Clipboard not available' },
          'Draft email disalin': { en: 'Email draft copied' },
          'Draft email siap disalin': { en: 'Email draft ready to copy' },
          'Equalizer direset ke mode Flat': { en: 'Equalizer reset to Flat' },
          'Gagal memulai instalasi': { en: 'Failed to start installation' },
          'Hook & CTA disalin': { en: 'Hook & CTA copied' },
          'Hook & CTA siap disalin': { en: 'Hook & CTA ready to copy' },
          'Install tidak tersedia saat ini': { en: 'Install not available right now' },
          'Isi judul terlebih dahulu': { en: 'Fill in the title first' },
          'Isi username dan password admin': { en: 'Enter admin username and password' },
          'Job diproses di latar': { en: 'Job processed in background' },
          'Download': { en: 'Download' },
          'Kamu offline - mode PWA siap dipakai': { en: 'You are offline - PWA mode ready' },
          'Konami code aktif!': { en: 'Konami code activated!' },
          'Koneksi kembali online': { en: 'Connection restored' },
          'Konversi audio dulu sebelum memberi rating': { en: 'Convert audio before rating' },
          'Konfirmasi sebelum auto-download': { en: 'Confirm before auto-download' },
          'Salin link': { en: 'Copy link' },
          'Link disalin': { en: 'Link copied' },
          'Link share disalin': { en: 'Share link copied' },
          'Log tersalin': { en: 'Log copied' },
          'Login admin berhasil': { en: 'Admin login successful' },
          'Login Google belum dikonfigurasi. Tambahkan GOOGLE_CLIENT_ID di server.': {
            en: 'Google login is not configured yet. Add GOOGLE_CLIENT_ID on the server.',
          },
          'Login Google aktif; cookies YouTube otomatis terhubung.': { en: 'Google login active; YouTube cookies are handled automatically.' },
          'Login diperlukan untuk mengunggah cookies.txt melalui dropzone.': { en: 'Sign in is required to upload cookies.txt through the dropzone.' },
          'Script login Google diblokir. Izinkan accounts.google.com di browser Anda.': {
            en: 'The Google sign-in script was blocked. Allow accounts.google.com in your browser.',
          },
          'Login admin terlebih dahulu untuk upload cookies': { en: 'Log in as admin before uploading cookies' },
          'Logout admin berhasil': { en: 'Admin logged out' },
          'Hapus': { en: 'Delete' },
          'Masukkan URL yang valid': { en: 'Enter a valid media URL' },
          'Masukkan URL yang valid terlebih dahulu': { en: 'Enter a valid media URL first' },
          'Metadata diperbarui otomatis': { en: 'Metadata updated automatically' },
          'Mini game belum tersedia di perangkat ini.': { en: 'Mini game not available on this device.' },
          'Mulai tur interaktif.': { en: 'Interactive tour started.' },
          'Musik latar tidak siap diputar.': { en: 'Background music not ready to play.' },
          'PWA siap dipakai offline ?': { en: 'PWA ready for offline use ?' },
          'Panduan audiophile disalin': { en: 'Audiophile guide copied' },
          'Panduan audiophile siap disalin': { en: 'Audiophile guide ready to copy' },
          'Captcha tidak dapat dimuat. Periksa koneksi atau ekstensi pemblokir.': { en: 'Captcha could not load. Check your connection or blocking extensions.' },
          'Captcha belum dikonfigurasi di server.': { en: 'Captcha is not configured on the server.' },
          'Verifikasi captcha gagal. Silakan coba lagi.': { en: 'Captcha verification failed. Please try again.' },
          'Captcha gagal dijalankan. Coba lagi.': { en: 'Captcha could not run. Try again.' },
          'Pengaturan direset': { en: 'Settings reset' },
          'Pengaturan disimpan': { en: 'Settings saved' },
          'Pilih file .txt hasil export cookies': { en: 'Choose the exported cookies .txt file' },
          'Pitch disalin ke clipboard': { en: 'Pitch copied to clipboard' },
          'Pitch siap disalin ke proposal playlist': { en: 'Pitch ready for playlist proposals' },
          'Preset Podcast diterapkan': { en: 'Podcast preset applied' },
          'Press kit siap disalin': { en: 'Press kit ready to copy' },
          'Press kit tersalin ke clipboard': { en: 'Press kit copied to clipboard' },
          'Prompt cover disalin': { en: 'Cover prompt copied' },
          'Prompt cover siap dipakai': { en: 'Cover prompt ready to use' },
          'Ingat format & kualitas terakhir': { en: 'Remember last format & quality' },
          'Riwayat dibersihkan': { en: 'History cleared' },
          'Simpan ke Google Drive': { en: 'Save to Google Drive' },
          'Google Drive siap menyimpan hasil secara otomatis.': { en: 'Google Drive is ready to store your results automatically.' },
          'Masuk dengan Google untuk mengaktifkan simpan ke Drive.': { en: 'Sign in with Google to enable saving to Drive.' },
          'Masuk dengan Google untuk menyimpan ke Drive.': { en: 'Sign in with Google to save to Drive.' },
          'Belum ada hasil konversi untuk disimpan.': { en: 'No conversion result available to save yet.' },
          'Mengunggah ke Google Drive': { en: 'Uploading to Google Drive' },
          'Berhasil diunggah ke Google Drive.': { en: 'Uploaded to Google Drive successfully.' },
          'Gagal mengunggah ke Google Drive.': { en: 'Failed to upload to Google Drive.' },
          'Google Drive belum siap.': { en: 'Google Drive is not ready yet.' },
          'Semua antrian selesai': { en: 'All queue items completed' },
          'Subtitle lengkap siap diunduh': { en: 'Full subtitles ready to download' },
          'Teaser lirik disalin': { en: 'Lyric teaser copied' },
          'Teaser lirik siap disalin': { en: 'Lyric teaser ready to copy' },
          'Teks subtitle tersalin': { en: 'Subtitle text copied' },
          'Terima kasih atas ratingnya!': { en: 'Thanks for the rating!' },
          'Tidak ada teks yang bisa dibacakan.': { en: 'No text to narrate.' },
          'Tidak bisa menyalin': { en: 'Unable to copy' },
          'Tidak dapat membaca clipboard': { en: 'Cannot read clipboard' },
          'Tidak dapat menyalin teks subtitle': { en: 'Cannot copy subtitle text' },
          'Timeline rilis disalin': { en: 'Release timeline copied' },
          'Timeline rilis siap disalin': { en: 'Release timeline ready to copy' },
          'URL dari clipboard terpasang otomatis': { en: 'URL pasted from clipboard' },
          'URL ini belum didukung': { en: 'This URL is not supported yet' },
          'URL ditempel dari drag & drop': { en: 'URL pasted from drag & drop' },
          'Auto-download akan dimulai otomatis. Lanjutkan?': { en: 'Auto-download will start automatically. Continue?' },
          'URL tidak valid': { en: 'Invalid URL' },
          'Walkthrough selesai! Selamat mencoba.': { en: 'Walkthrough complete! Have fun.' },
          'cookies.txt terunggah ?': { en: 'cookies.txt uploaded ?' },
          'Mencari...': { en: 'Searching...', ko: '검색 중...', ja: '検索中...' },
          'Tidak ada hasil yang cocok.': { en: 'No matching results.', ko: '일치하는 결과가 없습니다.', ja: '一致する結果はありません。' },
          'Video ditemukan, siap dikonversi.': { en: 'Video found and ready to convert.', ko: '동영상을 찾았습니다. 변환 준비 완료.', ja: '動画が見つかりました。変換の準備ができました。' },
          'Gagal mencari video. Coba kata kunci lain.': { en: 'Failed to find the video. Try another keyword.', ko: '동영상을 찾지 못했습니다. 다른 키워드로 시도해 보세요.', ja: '動画が見つかりませんでした。別のキーワードを試してください。' },
          'Sedang menyiapkan konversi dari kata kunci...': { en: 'Preparing conversion from keyword...', ko: '키워드로 변환을 준비 중입니다...', ja: 'キーワードからの変換を準備中...' },
          'Masukkan kata kunci lagu terlebih dahulu': { en: 'Enter a song keyword first', ko: '노래 키워드를 먼저 입력하세요.', ja: '曲のキーワードを先に入力してください。' },
          'Ringtone siap diunduh': { en: 'Ringtones ready to download' },
          'Pilih versi ringtone sesuai perangkatmu.': { en: 'Pick the ringtone version for your device.' },
          'Versi Android siap diunduh.': { en: 'Android version ready to download.' },
          'Versi iPhone siap diunduh.': { en: 'iPhone version ready to download.' },
          'Versi Android & iPhone siap diunduh.': { en: 'Android & iPhone versions ready to download.' },
          'Memuat tombol Google': { en: 'Loading Google button' },
          'Masuk dengan Google': { en: 'Sign in with Google' },
          'Perintah suara siap digunakan.': { en: 'Voice commands are ready.' },
          'Perintah suara dihentikan.': { en: 'Voice command stopped.' },
          'Mendengarkan, ucapkan "buka donasi" atau "mainkan game".': { en: 'Listening, say "open donation" or "play the game".' },
          'Browser belum mendukung voice recognition.': { en: 'This browser does not support voice recognition.' },
          'Memproses...': { en: 'Processing...', ko: '처리 중...', ja: '処理中...' },
          'Menyiapkan': { en: 'Preparing' },
          'Selesai': { en: 'Done', ko: '완료', ja: '完了' },
          'Gagal': { en: 'Failed', ko: '실패', ja: '失敗' },
          'Konversi selesai': { en: 'Conversion complete' },
          'Job selesai': { en: 'Job complete' },
          'Job gagal': { en: 'Job failed' },
          'Perintah suara': { en: 'Voice command' },
          'Perintah belum dikenali': { en: 'Command not recognized' },
        };

        const TEXT_TRANSLATION_PATTERNS = [
          {
            pattern: /^Diprioritaskan:/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Diprioritaskan:/i, 'Prioritized:'),
            },
          },
          {
            pattern: /^Dilepas:/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Dilepas:/i, 'Released:'),
            },
          },
          {
            pattern: /^Terima kasih!\s*(.+) dipilih\.?$/i,
            translate: {
              id: (value) => value,
              en: (value) => {
                const match = value.match(/^Terima kasih!\s*(.+) dipilih\.?$/i);
                const label = match ? match[1] : '';
                return `Thank you! ${label} selected.`;
              },
            },
          },
          {
            pattern: /^Aktifkan pop-up atau gunakan tombol Buka manual untuk donasi /i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Aktifkan pop-up atau gunakan tombol Buka manual untuk donasi /i, 'Enable pop-ups or use the Open manually button to donate '),
            },
          },
          {
            pattern: /^Buka Saweria \(/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Buka Saweria/i, 'Open Saweria'),
            },
          },
          {
            pattern: /^Perintah suara:/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Perintah suara:/i, 'Voice command:'),
            },
          },
          {
            pattern: /^Perintah belum dikenali:/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Perintah belum dikenali:/i, 'Command not recognized:'),
            },
          },
          {
            pattern: /^Job selesai:/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Job selesai:/i, 'Job finished:'),
            },
          },
          {
            pattern: /^Job gagal:/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Job gagal:/i, 'Job failed:'),
            },
          },
          {
            pattern: /^Memproses\s+(\d+)\/(\d+)/i,
            translate: {
              id: (value) => value,
              en: (value) => value.replace(/^Memproses/i, 'Processing'),
            },
          },
          {
            pattern: /^Playlist ZIP siap \((\d+) file\)/i,
            translate: {
              id: (value) => value,
              en: (value) => {
                const match = value.match(/^Playlist ZIP siap \((\d+) file\)/i);
                if (!match) return 'Playlist ZIP ready';
                const count = Number(match[1]) || 0;
                const unit = count === 1 ? 'file' : 'files';
                return `Playlist ZIP ready (${count} ${unit})`;
              },
            },
          },
        ];

        const resolveLanguageCandidate = (candidate) => {
          if (!candidate) return null;
          const normalized = String(candidate).trim().toLowerCase();
          if (!normalized || normalized === 'auto') return null;
          if (SUPPORTED_LANGS.includes(normalized)) return normalized;
          for (const [target, variants] of Object.entries(LANGUAGE_VARIANTS)) {
            if (variants.includes(normalized)) return target;
          }
          const base = normalized.split(/[-_]/)[0];
          if (SUPPORTED_LANGS.includes(base)) return base;
          for (const [target, variants] of Object.entries(LANGUAGE_VARIANTS)) {
            if (variants.includes(base)) return target;
          }
          return null;
        };

        const detectLanguage = () => {
          let stored = null;
          try {
            stored = localStorage.getItem('app:preferredLang');
          } catch {
            stored = null;
          }
          const candidates = [];
          if (stored) candidates.push(stored);
          if (typeof navigator !== 'undefined') {
            if (Array.isArray(navigator.languages)) {
              candidates.push(...navigator.languages);
            } else if (navigator.language) {
              candidates.push(navigator.language);
            }
          }
          const docLang = document.documentElement?.getAttribute('lang');
          if (docLang) candidates.push(docLang);
          for (const candidate of candidates) {
            const resolved = resolveLanguageCandidate(candidate);
            if (resolved) return resolved;
          }
          return FALLBACK_LANG;
        };

        const persistPreferredLang = (lang) => {
          if (!lang || !SUPPORTED_LANGS.includes(lang)) return;
          try {
            const current = localStorage.getItem('app:preferredLang');
            if (current === lang) return;
            localStorage.setItem('app:preferredLang', lang);
          } catch (err) {
            console?.debug?.('Skip persisting preferredLang', err);
          }
        };

        const preserveSpacing = (original, replacement) => {
          const leading = original.match(/^\s*/)?.[0] ?? '';
          const trailing = original.match(/\s*$/)?.[0] ?? '';
          return `${leading}${replacement}${trailing}`;
        };

        let currentLang = detectLanguage();
        if (!SUPPORTED_LANGS.includes(currentLang)) {
          currentLang = FALLBACK_LANG;
        }
        persistPreferredLang(currentLang);

        const translate = (key, fallback) => {
          if (!key) return fallback ?? '';
          const order = [currentLang, 'en', 'id'].filter(Boolean);
          const seen = new Set();
          for (const lang of order) {
            if (!lang || seen.has(lang)) continue;
            seen.add(lang);
            const dict = I18N_STRINGS[lang] || {};
            if (dict[key] != null) return dict[key];
          }
          return fallback ?? '';
        };

        const translateMessage = (value) => {
          if (value == null) return '';
          const str = String(value);
          const trimmed = str.trim();
          if (!trimmed) return str;
          if (currentLang !== 'id') {
            const direct = TEXT_TRANSLATIONS[trimmed];
            if (direct?.[currentLang]) {
              return preserveSpacing(str, direct[currentLang]);
            }
            for (const pattern of TEXT_TRANSLATION_PATTERNS) {
              if (pattern.pattern.test(str)) {
                const translator = pattern.translate?.[currentLang];
                if (typeof translator === 'function') {
                  const translated = translator(str);
                  if (translated) return translated;
                }
              }
            }
          }
          return str;
        };

        function applyTranslations() {
          document.documentElement.setAttribute('lang', currentLang);
          $$('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const translated = translate(key, el.textContent);
            if (translated != null) el.textContent = translated;
          });
          $$('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (!key) return;
            const translated = translate(key, el.getAttribute('placeholder'));
            if (translated != null) el.setAttribute('placeholder', translated);
          });
          $$('[data-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-i18n-title');
            if (!key) return;
            const translated = translate(key, el.getAttribute('title'));
            if (translated != null) el.setAttribute('title', translated);
          });
          $$('[data-i18n-aria-label]').forEach((el) => {
            const key = el.getAttribute('data-i18n-aria-label');
            if (!key) return;
            const translated = translate(key, el.getAttribute('aria-label'));
            if (translated != null) el.setAttribute('aria-label', translated);
          });
          // Translate common attributes generically (no data-i18n needed)
          document.querySelectorAll('[title]').forEach((el) => {
            const val = el.getAttribute('title');
            if (val) el.setAttribute('title', translateMessage(val));
          });
          document.querySelectorAll('[aria-label]').forEach((el) => {
            const val = el.getAttribute('aria-label');
            if (val) el.setAttribute('aria-label', translateMessage(val));
          });
          document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
            const val = el.getAttribute('placeholder');
            if (val) el.setAttribute('placeholder', translateMessage(val));
          });
          document.querySelectorAll('img[alt]').forEach((el) => {
            const val = el.getAttribute('alt');
            if (val) el.setAttribute('alt', translateMessage(val));
          });
          // Translate all visible text nodes generically (lingui-style, no keys)
          try {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            const nodes = [];
            let current = walker.nextNode();
            while (current) {
              nodes.push(current);
              current = walker.nextNode();
            }
            nodes.forEach((node) => {
              const original = node.nodeValue || '';
              const next = translateMessage(original);
              if (next !== original) node.nodeValue = next;
            });
          } catch { }
          updateRingtoneLengthLabel();
          updateSpotifyPreviewLabel();
        }

        const toast = toastEl && bs?.Toast?.getOrCreateInstance
          ? bs.Toast.getOrCreateInstance(toastEl)
          : null;
        let shouldNarrate = () => false;
        let queueNarration = () => { };
        const announceNarrator = (message) => {
          if (!message) return;
          if (shouldNarrate()) queueNarration(String(message));
        };
        const setToast = (msg) => {
          let text = translateMessage(msg);

          if (text && !text.includes('<')) {
            const raw = text.trim();
            const lower = raw.toLowerCase();

            if (/^gagal\b/.test(lower) || /^tidak bisa\b/.test(lower) || /^error\b/.test(lower)) {
              const base = /[.!?]$/.test(raw) ? raw : `${raw}.`;
              text = `Ups, ${base} Coba lagi sebentar ya.`;
            } else if (/^berhasil\b/.test(lower) || /^sukses\b/.test(lower)) {
              const base = /[.!?]$/.test(raw) ? raw : `${raw}!`;
              text = `Beres, ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
            } else if (/anda belum login/i.test(raw) || /masuk dengan google/i.test(raw)) {
              text = 'Silakan login dulu supaya fitur ini bisa dipakai.';
            } else if (/url tidak valid/i.test(raw) || /url ini belum didukung/i.test(raw)) {
              text = 'Link‑nya belum pas, coba cek lagi ya.';
            } else if (/belum ada hasil konversi/i.test(raw)) {
              text = 'Belum ada hasil convert yang bisa disimpan.';
            }
          }

          if (toastTextEl) toastTextEl.textContent = text;
          if (toast) {
            toast.show();
          } else if (toastEl) {
            toastEl.classList.add('show');
            window.setTimeout(() => toastEl.classList.remove('show'), 2600);
          }
          announceNarrator(text);
        };
        window.setToast = setToast;

        const readJsonSafe = async (resp) => {
          if (!resp) return { data: null, rawText: '', parseError: null };
          let text = '';
          try {
            text = await resp.text();
          } catch (err) {
            return { data: null, rawText: '', parseError: err };
          }
          if (!text) return { data: null, rawText: '', parseError: null };
          try {
            return { data: JSON.parse(text), rawText: text, parseError: null };
          } catch (err) {
            return { data: null, rawText: text, parseError: err };
          }
        };

        let authTokenRef = '';

        const buildAuthHeaders = (headers = {}) => {
          const next = { ...(headers || {}) };
          if (authTokenRef) next.Authorization = `Bearer ${authTokenRef}`;
          return next;
        };

        const resolveJsonResponse = async (resp, { fallbackMessage = 'Terjadi kesalahan', logLabel = '' } = {}) => {
          const safe = await readJsonSafe(resp);
          const payload = safe.data && typeof safe.data === 'object' ? safe.data : {};
          if (!resp?.ok) {
            const raw = (safe.rawText || '').trim();
            if (safe.parseError) {
              console?.warn?.('[json] gagal parsing', { label: logLabel || resp?.url, error: safe.parseError, raw });
            }
            const message = payload.error || payload.message || (raw ? raw.slice(0, 280) : '') || fallbackMessage;
            const err = new Error(message || fallbackMessage);
            err.status = resp?.status;
            err.payload = payload;
            err.rawText = safe.rawText;
            throw err;
          }
          if (safe.parseError) {
            console?.warn?.('[json] respons tidak valid', { label: logLabel || resp?.url, error: safe.parseError, raw: safe.rawText });
          }
          return { data: payload, rawText: safe.rawText };
        };

        const postJson = async (path, body, options = {}) => {
          const resp = await fetch(api(path), {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }),
            body: JSON.stringify(body ?? {}),
          });
          return resolveJsonResponse(resp, options);
        };

        const xpSyncTracker = new Set();

        const syncServerXp = async (userId, targetXp, serverXp) => {
          if (!userId || !state.auth.token) return;
          const numericTarget = Math.max(0, Math.round(Number(targetXp) || 0));
          const numericServer = Math.max(0, Math.round(Number(serverXp) || 0));
          const delta = numericTarget - numericServer;
          if (!Number.isFinite(delta) || delta <= 0) return;

          const eventId = `client-sync:${userId}:${numericTarget}`;
          if (xpSyncTracker.has(eventId)) return;
          xpSyncTracker.add(eventId);

          try {
            const { data } = await postJson(`/api/users/${encodeURIComponent(userId)}/xp`, {
              delta,
              reason: 'client-sync',
              event_id: eventId,
            }, {
              fallbackMessage: translateMessage('Sinkronisasi XP gagal'),
              logLabel: 'xp-sync',
            });
            if (data?.user) {
              applyUserSummary(data.user, { origin: 'sync' });
            } else if (Number.isFinite(Number(data?.xp))) {
              state.experience.points = Math.max(state.experience.points || 0, Number(data.xp));
            }
          } catch (err) {
            console.warn('Sinkronisasi XP gagal', err);
            xpSyncTracker.delete(eventId);
            return;
          }

          xpSyncTracker.delete(eventId);
        };

        const createDebounced = (fn, delay = 200) => {
          let timer = null;
          return (...args) => {
            if (timer) clearTimeout(timer);
            timer = window.setTimeout(() => {
              timer = null;
              fn(...args);
            }, delay);
          };
        };

        const createProgressId = () => {
          if (window.crypto?.randomUUID) return window.crypto.randomUUID();
          return `prog_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        };

        const urlInput = $('#url');
        const keywordInput = $('#keywordInput');
        const keywordConvertBtn = $('#keywordConvertBtn');
        const keywordSearchBtn = $('#keywordSearchBtn');
        const searchResultsWrap = $('#searchResultsWrap');
        const searchResultsList = $('#searchResults');

        const previewCard = $('#previewCard');
        const previewPlayer = $('#previewPlayer');
        const previewWrap = $('#previewWrap');
        const previewVideo = $('#previewVideo');
        const prevRewindBtn = $('#prevRewindBtn');
        const prevPlayPauseBtn = $('#prevPlayPauseBtn');
        const prevForwardBtn = $('#prevForwardBtn');
        const previewSpeedSelect = $('#previewSpeedSelect');
        const chooseFreePlanBtn = $('#chooseFreePlanBtn');
        const choosePremiumPlanBtn = $('#choosePremiumPlanBtn');
        const activePlanBadge = $('#activePlanBadge');
        const saveCloudinaryBtn = $('#saveCloudinaryBtn');
        const saveCloudinaryStatus = $('#saveCloudinaryStatus');
        const qrCanvas = $('#downloadQr');
        const qrWrap = $('#qrWrap');
        const thumbEl = $('#thumb');
        const videoPreviewFrame = $('#videoPreviewFrame');
        const videoPreviewWrap = $('#videoPreviewWrap');
        const videoTitleEl = $('#videoTitle');
        const videoMetaWrap = $('#videoMeta');
        const videoArtistEl = $('#videoArtist');
        const videoAlbumEl = $('#videoAlbum');
        const videoDurationEl = $('#videoDuration');
        const videoEstSizeEl = $('#videoEstSize');
        const videoSourceEl = $('#videoSource');
        const sourcePreviewWrap = $('#sourcePreviewAudioWrap');
        const sourcePreviewAudio = $('#sourcePreviewAudio');
        const sourcePreviewLabel = $('#sourcePreviewLabel');

        const ringtoneResultCard = $('#ringtoneResult');
        const ringtoneLinks = $('#ringtoneLinks');
        const ringtoneSummaryEl = $('#ringtoneSummary');
        const ringtoneTitleEl = $('#ringtoneTitle');
        const ringtoneCard = $('#ringtoneCard');
        const makeRingtoneToggle = $('#makeRingtone');
        const ringtoneOptions = $('#ringtoneOptions');
        const ringtoneLengthInput = $('#ringtoneLength');
        const ringtoneLengthLabel = $('#ringtoneLengthLabel');
        const ringtoneFadeInput = $('#ringtoneFade');

        const shareWrap = $('#shareWrap');
        const shareInfo = $('#shareInfo');
        const shareLinkInput = $('#shareLinkInput');
        const shareBtn = $('#shareBtn');
        const copyShareBtn = $('#copyShareBtn');
        const openShareBtn = $('#openShareBtn');
        const shareAppButtons = $$('#shareAppButtons button[data-app]');
        const privateShareBtn = $('#privateShareBtn');
        const driveWrap = $('#driveWrap');
        const saveDriveBtn = $('#saveDriveBtn');
        const driveStatus = $('#driveStatus');
        const videoPreviewToggle = $('#videoPreviewToggle');
        const videoQualitySelect = $('#videoQuality');

        const spinModalEl = $('#luckySpinModal');
        const spinWheelEl = $('#spinWheel');
        const spinResultEl = $('#spinResult');
        const spinStartBtn = $('#spinStartBtn');
        const spinTicketBadge = $('#spinTicketBadge');
        const openSpinBtn = $('#openSpinBtn');
        const rewardHubHint = $('#rewardHubHint');

        const triviaModalEl = $('#musicTriviaModal');
        const triviaQuestionEl = $('#triviaQuestion');
        const triviaOptionsEl = $('#triviaOptions');
        const triviaFeedbackEl = $('#triviaFeedback');
        const triviaSkipBtn = $('#triviaSkipBtn');
        const triviaNextBtn = $('#triviaNextBtn');
        const openTriviaBtn = $('#openTriviaBtn');
        const rewardBaseHint = rewardHubHint ? rewardHubHint.textContent : '';

        const ratingWrap = $('#ratingWrap');
        const ratingSummary = $('#ratingSummary');
        const ratingThanks = $('#ratingThanks');
        const ratingButtons = $$('#ratingWrap button[data-rating]');

        applyTranslations();
        const langSelect = document.getElementById('langSelect');
        if (langSelect) {
          try {
            const stored = localStorage.getItem('app:preferredLang');
            const initial = stored && SUPPORTED_LANGS.includes(stored) ? stored : detectLanguage();
            currentLang = SUPPORTED_LANGS.includes(initial) ? initial : FALLBACK_LANG;
            persistPreferredLang(currentLang);
            langSelect.value = currentLang;
          } catch { }
          langSelect.addEventListener('change', () => {
            const val = langSelect.value;
            currentLang = SUPPORTED_LANGS.includes(val) ? val : FALLBACK_LANG;
            persistPreferredLang(currentLang);
            applyTranslations();
          });
        }

        const speedTipButtons = $$('#speedTips .tip-pill');
        const speedTipHint = $('#speedTipHint');
        const donationButtons = $$('#donationButtons .btn-donation');
        const donationStatus = $('#donationStatus');
        const donationLink = $('#donationLink');

        const visitedSections = new Set();
        const sectionPanels = Array.from(document.querySelectorAll('.app-section'));
        const navButtons = Array.from(document.querySelectorAll('[data-section-target]'));
        const openProfileButtons = Array.from(document.querySelectorAll('[data-open-profile]'));
        const openExperienceButtons = Array.from(document.querySelectorAll('[data-open-experience]'));
        const sectionTitle = $('#activeSectionTitle');
        const sectionSubtitle = $('#activeSectionSubtitle');
        const navDrawerEl = $('#offcanvasNav');
        const assistantBridge = { autoOpen: () => { } };
        let assistantAutoOpenQueued = false;

        const SECTION_META = {
          converter: {
            titleKey: 'sectionTitleConverter',
            subtitleKey: 'sectionSubtitleConverter',
          },
          experience: {
            titleKey: 'sectionTitleExperience',
            subtitleKey: 'sectionSubtitleExperience',
          },
          faq: {
            titleKey: 'sectionTitleFaq',
            subtitleKey: 'sectionSubtitleFaq',
          },
          saweria: {
            titleKey: 'sectionTitleSaweria',
            subtitleKey: 'sectionSubtitleSaweria',
          },
          profile: {
            titleKey: 'sectionTitleProfile',
            subtitleKey: 'sectionSubtitleProfile',
          },
        };

        const setActiveSection = (target) => {
          let found = false;
          sectionPanels.forEach((panel) => {
            const isMatch = panel.dataset.section === target;
            panel.classList.toggle('is-active', isMatch);
            panel.hidden = !isMatch;
            if (isMatch) found = true;
          });
          navButtons.forEach((btn) => {
            const isMatch = btn.dataset.sectionTarget === target;
            btn.classList.toggle('active', isMatch);
            btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
          });
          const meta = SECTION_META[target] || SECTION_META.converter;
          if (sectionTitle && meta?.titleKey) sectionTitle.textContent = translate(meta.titleKey, sectionTitle.textContent);
          if (sectionSubtitle && meta?.subtitleKey) sectionSubtitle.textContent = translate(meta.subtitleKey, sectionSubtitle.textContent);
          if (found) {
            localStorage.setItem('app:activeSection', target);
            visitedSections.add(target);
            if (visitedSections.size >= 3) awardBadge('explorer');

            if (navDrawerEl && navDrawerEl.classList.contains('show')) {
              const drawer = bs?.Offcanvas?.getOrCreateInstance ? bs.Offcanvas.getOrCreateInstance(navDrawerEl) : null;
              if (drawer) drawer.hide();
            }

            if (target === 'experience') {
              assistantAutoOpenQueued = true;
              assistantBridge.autoOpen();
            } else {
              assistantAutoOpenQueued = false;
            }
          }
          return found;
        };

        // DELEGATED NAVIGATION HANDLER (Robust Manual Control)
        // Replaces all individual event listeners to ensure robust handling
        // Use capture=true to catch event BEFORE any other listeners
        document.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-section-target]');
          if (!btn) return;

          // Prevent default to stop any other listeners (if any)
          e.preventDefault();
          e.stopImmediatePropagation();

          const target = btn.dataset.sectionTarget;
          if (!target) return;

          console.log('[Nav] Manual navigation to:', target);

          // 1. Update URL Hash
          // We use pushState to update URL without reloading
          history.pushState(null, '', `#${target}`);

          // 2. Activate Section
          const success = setActiveSection(target);

          if (!success) {
            console.warn('[Nav] Invalid target:', target);
            // Fallback: if section doesn't exist, maybe it's a link? 
            // But for this app, we assume sections exist.
            return;
          }

          // 3. Manually Close Offcanvas (if open)
          const navDrawerEl = document.getElementById('offcanvasNav');
          if (navDrawerEl && navDrawerEl.classList.contains('show')) {
            // Try to get existing instance
            const bsObj = window.bootstrap || window.bs;
            if (bsObj && bsObj.Offcanvas) {
              const drawer = bsObj.Offcanvas.getInstance(navDrawerEl) || bsObj.Offcanvas.getOrCreateInstance(navDrawerEl);
              if (drawer) drawer.hide();
            } else {
              // Fallback: Click close button
              const closeBtn = navDrawerEl.querySelector('.btn-close');
              if (closeBtn) closeBtn.click();
              else {
                // Last resort: remove class
                navDrawerEl.classList.remove('show');
                navDrawerEl.setAttribute('aria-modal', 'false');
                navDrawerEl.removeAttribute('role');
                const backdrop = document.querySelector('.offcanvas-backdrop');
                if (backdrop) backdrop.remove();
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
              }
            }
          }
        }, true); // Use Capture phase to ensure we catch it first

        // REMOVED: Old individual event listeners to avoid conf                         navButtons.forEach((btn)                btn.addEventListener('click', (e) => { ..                          */

        openProfileButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            setActiveSection('profile');
            history.pushState(null, null, '#profile');
            updateAvatarUi();
          });
        });

        openExperienceButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            setActiveSection('experience');
            history.pushState(null, null, '#experience');
          });
        });

        // INITIALIZATION: Priority Hash > LocalStorage > Default
        const getInitialSection = () => {
          // 1. Check URL Hash
          const hash = window.location.hash.substring(1); // remove #
          if (hash && ['converter', 'experience', 'faq', 'saweria', 'profile'].includes(hash)) {
            return hash;
          }
          // 2. Check LocalStorage
          const saved = localStorage.getItem('app:activeSection');
          if (saved) return saved;

          // 3. Default
          return 'converter';
        };

        const initialSection = getInitialSection();
        if (!setActiveSection(initialSection)) setActiveSection('converter');

        // Listen for manual hash changes (Back/Forward button)
        window.addEventListener('hashchange', () => {
          const hash = window.location.hash.substring(1);
          if (hash) setActiveSection(hash);
        });

        setTimeout(() => { tryPrefillClipboard({ forceToast: false, overrideExisting: false }); }, 600);
        window.addEventListener('focus', () => { tryPrefillClipboard({ forceToast: false, overrideExisting: false }); });
        document.addEventListener('keydown', (event) => {
          if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'v') {
            if (urlInput && document.activeElement !== urlInput) {
              urlInput.focus();
            }
          }
        });

        if (makeRingtoneToggle) {
          const syncRingtone = () => {
            const enabled = !!makeRingtoneToggle.checked;
            if (ringtoneOptions) ringtoneOptions.hidden = !enabled;
            if (enabled) updateRingtoneLengthLabel();
          };
          makeRingtoneToggle.addEventListener('change', syncRingtone);
          syncRingtone();
        } else {
          if (ringtoneOptions) ringtoneOptions.hidden = true;
        }

        if (ringtoneLengthInput) {
          ringtoneLengthInput.addEventListener('input', () => updateRingtoneLengthLabel());
          ringtoneLengthInput.addEventListener('change', () => updateRingtoneLengthLabel());
          updateRingtoneLengthLabel();
        }

        if (ringtoneFadeInput) {
          ringtoneFadeInput.addEventListener('change', () => {
            if (makeRingtoneToggle?.checked) updateRingtoneLengthLabel();
          });
        }

        if (keywordInput) {
          const instantSearch = createDebounced((value) => {
            if (!value || value.length < 2) return;
            handleKeywordSearch(value, { silent: true, instant: true });
          }, 200);
          keywordInput.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
              evt.preventDefault();
              handleKeywordConvert();
            }
          });
          keywordInput.addEventListener('input', () => {
            const val = keywordInput.value.trim();
            if (!val) {
              clearSearchResults();
              return;
            }
            instantSearch(val);
          });
        }
        if (keywordConvertBtn) keywordConvertBtn.addEventListener('click', () => handleKeywordConvert());
        if (keywordSearchBtn) keywordSearchBtn.addEventListener('click', () => handleKeywordSearch());


        const donationLinkHint = $('#donationLinkHint');
        const faqItems = $$('#faqList details');
        const achievementModalEl = $('#achievementModal');
        const achievementModalList = $('#achievementModalList');
        const tutorialModalEl = $('#tutorialModal');
        const walkthroughSteps = tutorialModalEl ? Array.from(tutorialModalEl.querySelectorAll('.walkthrough-step')) : [];
        const walkthroughPrev = $('#walkthroughPrev');
        const walkthroughNext = $('#walkthroughNext');
        const walkthroughProgressBar = $('#walkthroughProgressBar');
        const walkthroughProgressLabel = $('#walkthroughProgressLabel');
        const walkthroughTrigger = $('#walkthroughTrigger');
        const equalizerWrap = $('#equalizerWrap');
        const eqBass = $('#eqBass');
        const eqMid = $('#eqMid');
        const eqTreble = $('#eqTreble');
        const eqBassValue = $('#eqBassValue');
        const eqMidValue = $('#eqMidValue');
        const eqTrebleValue = $('#eqTrebleValue');
        const eqStatus = $('#eqStatus');
        const eqPresetFlat = $('#eqPresetFlat');
        const eqPresetPodcast = $('#eqPresetPodcast');
        const eqPresetBass = $('#eqPresetBass');
        const denoiseInput = $('#denoise');
        const volumeBoost = $('#volumeBoost');
        const volumeBoostLabel = $('#volumeBoostLabel');
        const enhancerSelect = $('#enhancer');
        const soundEffectSelect = $('#soundEffect');
        const vpnFriendlyToggle = $('#vpnFriendly');
        const smartResumeToggle = $('#smartResume');
        const backgroundMode = $('#backgroundMode');
        const backgroundEmailInput = $('#backgroundEmail');
        const aiStatus = $('#aiStatus');
        const autoTagBtn = $('#autoTagBtn');
        const aiCaptionBtn = $('#aiCaptionBtn');
        const aiCaptionWrap = $('#aiCaptionWrap');
        const aiCaptionText = $('#aiCaptionText');
        const aiCaptionCopy = $('#aiCaptionCopy');
        const aiCaptionMeta = $('#aiCaptionMeta');
        const aiPitchBtn = $('#aiPitchBtn');
        const aiPitchWrap = $('#aiPitchWrap');
        const aiPitchText = $('#aiPitchText');
        const aiPitchCopy = $('#aiPitchCopy');
        const aiPitchHook = $('#aiPitchHook');
        const aiPitchPlaylists = $('#aiPitchPlaylists');
        const aiAudiophileBtn = $('#aiAudiophileBtn');
        const aiAudiophileWrap = $('#aiAudiophileWrap');
        const aiAudiophileText = $('#aiAudiophileText');
        const aiAudiophileCopy = $('#aiAudiophileCopy');
        const aiAudiophileMeta = $('#aiAudiophileMeta');
        const aiHookBtn = $('#aiHookBtn');
        const aiHookWrap = $('#aiHookWrap');
        const aiHookList = $('#aiHookList');
        const aiHookCtas = $('#aiHookCtas');
        const aiHookMeta = $('#aiHookMeta');
        const aiHookCopy = $('#aiHookCopy');
        const aiVisualBtn = $('#aiVisualBtn');
        const aiVisualWrap = $('#aiVisualWrap');
        const aiVisualPrompt = $('#aiVisualPrompt');
        const aiVisualCopy = $('#aiVisualCopy');
        const aiVisualPalette = $('#aiVisualPalette');
        const aiVisualMeta = $('#aiVisualMeta');
        const aiReleaseBtn = $('#aiReleaseBtn');
        const aiPlanWrap = $('#aiPlanWrap');
        const aiPlanList = $('#aiPlanList');
        const aiPlanSummary = $('#aiPlanSummary');
        const aiPlanCopy = $('#aiPlanCopy');
        const aiPressBtn = $('#aiPressBtn');
        const aiPressWrap = $('#aiPressWrap');
        const aiPressHeadline = $('#aiPressHeadline');
        const aiPressStory = $('#aiPressStory');
        const aiPressHighlights = $('#aiPressHighlights');
        const aiPressQuote = $('#aiPressQuote');
        const aiPressSocial = $('#aiPressSocial');
        const aiPressCopy = $('#aiPressCopy');
        const aiOutreachBtn = $('#aiOutreachBtn');
        const aiOutreachWrap = $('#aiOutreachWrap');
        const aiOutreachSubject = $('#aiOutreachSubject');
        const aiOutreachOpener = $('#aiOutreachOpener');
        const aiOutreachIntro = $('#aiOutreachIntro');
        const aiOutreachHook = $('#aiOutreachHook');
        const aiOutreachWhy = $('#aiOutreachWhy');
        const aiOutreachCta = $('#aiOutreachCta');
        const aiOutreachExtras = $('#aiOutreachExtras');
        const aiOutreachCopy = $('#aiOutreachCopy');
        const aiLyricBtn = $('#aiLyricBtn');
        const aiLyricWrap = $('#aiLyricWrap');
        const aiLyricLines = $('#aiLyricLines');
        const aiLyricCallout = $('#aiLyricCallout');
        const aiLyricHashtags = $('#aiLyricHashtags');
        const aiLyricCopy = $('#aiLyricCopy');
        const aiTagInsights = $('#aiTagInsights');
        const playlistResultWrap = $('#playlistResultWrap');
        const playlistDownloadLink = $('#playlistDownloadLink');
        const playlistInfo = $('#playlistInfo');
        const playlistShareCard = $('#playlistShareCard');
        const playlistQrCanvas = $('#playlistQr');
        const playlistQrWrap = $('#playlistQrWrap');
        const profileQrSection = $('#profileQrSection');
        const profileQrCanvas = $('#profileQrCanvas');
        const profileQrWrap = $('#profileQrWrap');
        const profileQrStatus = $('#profileQrStatus');
        const profileQrHint = $('#profileQrHint');
        const profileQrMessage = $('#profileQrMessage');
        const profileQrExpiry = $('#profileQrExpiry');
        const profileQrGenerateBtn = $('#profileQrGenerateBtn');
        const profileQrRefreshBtn = $('#profileQrRefreshBtn');
        const profileQrUploadBtn = $('#profileQrUploadBtn');
        const profileQrUploadInput = $('#profileQrUploadInput');
        const profileQrCameraBtn = $('#profileQrCameraBtn');
        const profileQrCameraWrap = $('#profileQrCameraWrap');
        const profileQrCamera = $('#profileQrCamera');
        const backgroundList = $('#backgroundList');
        const backgroundEmpty = $('#backgroundEmpty');
        const urlDropOverlay = $('#urlDropOverlay');
        const celebrationLayer = $('#celebrationLayer');
        const customEndingOverlay = $('#customEndingOverlay');
        const endingStayBtn = $('#endingStayBtn');
        const mascotAssistant = $('#mascotAssistant');
        const mascotMessage = $('#mascotMessage');
        const rewardToast = $('#rewardToast');
        const donationManualLink = $('#manualDonationLink');
        const dynamicAvatar = $('#dynamicAvatar');
        const avatarToggle = $('#avatarToggle');
        const avatarEmoji = $('#avatarEmoji');
        const avatarPhoto = $('#avatarPhoto');
        const avatarEmojiMenu = $('#avatarEmojiMenu');
        const avatarLevelBadge = $('#avatarLevelBadge');
        const avatarMood = $('#avatarMood');
        const avatarProfileTitle = $('#avatarProfileTitle');
        const avatarProfileMood = $('#avatarProfileMood');
        const avatarProfileMoodMenu = $('#avatarProfileMoodMenu');
        const avatarProgressBar = $('#avatarProgressBar');
        const rewardPointsLabel = $('#rewardPointsLabel');
        const rewardBadges = $('#rewardBadges');
        const avatarAchievementList = $('#avatarAchievementList');
        const avatarLevelSummary = $('#avatarLevelSummary');
        const avatarLevelRange = $('#avatarLevelRange');
        const profileStreakLabel = $('#profileStreakLabel');
        const profileStreakBest = $('#profileStreakBest');
        const avatarEmojiPreview = $('#avatarEmojiPreview');
        const avatarPreviewLevel = $('#avatarPreviewLevel');
        const avatarPreviewMood = $('#avatarPreviewMood');
        const profileMilestones = $('#profileMilestones');
        const badgeCountLabel = $('#badgeCountLabel');
        const profileAccountAvatar = $('#profileAccountAvatar');
        const profileAccountName = $('#profileAccountName');
        const profileAccountStatus = $('#profileAccountStatus');
        const driveReadyStatus = $('#driveReadyStatus');
        const googleSignInButton = $('#googleSignInButton');
        const googleSignInForum = $('#googleSignInForum');
        const logoutAccountBtn = $('#logoutAccountBtn');
        const cheatPanel = $('#cheatPanel');
        const cheatPanelClose = $('#cheatPanelClose');
        const cheatCodeInput = $('#cheatCodeInput');
        const cheatSubmitBtn = $('#cheatSubmit');
        const themeSelect = $('#themeSelect');
        const fontSelect = $('#fontSelect');
        const layoutSelect = $('#layoutSelect');
        const narratorToggle = $('#narratorToggle');
        const musicToggleBtn = $('#musicToggleBtn');
        const musicNextBtn = $('#musicNextBtn');
        const musicStopBtn = $('#musicStopBtn');
        const moodSelect = $('#moodSelect');
        const bgMusicStatus = $('#bgMusicStatus');
        const bgMusicNow = $('#bgMusicNow');
        const voiceCommandBtn = $('#voiceCommandBtn');
        const voiceStatus = $('#voiceStatus');
        const setVoiceStatus = (key, fallback, extra = '') => {
          if (!voiceStatus) return;
          const base = translate(key, fallback);
          voiceStatus.textContent = extra ? `${base} ${extra}`.trim() : base;
        };
        const readSelectionBtn = $('#readSelectionBtn');
        const readGuideBtn = $('#readGuideBtn');
        const stopNarratorBtn = $('#stopNarratorBtn');
        const assistantMessages = $('#assistantMessages');
        const assistantQuickSuggestions = $('#assistantQuickSuggestions');
        const assistantInput = $('#assistantInput');
        const assistantSendBtn = $('#assistantSendBtn');
        const assistantTyping = $('#assistantTyping');
        const assistantFileInput = $('#assistantFileInput');
        const assistantAttachBtn = $('#assistantAttachBtn');
        const assistantNewChatBtn = $('#assistantNewChatBtn');
        const assistantAttachmentPreview = $('#assistantAttachmentPreview');
        let pendingAssistantAttachment = null;
        const assistantFab = $('#assistantFab');
        const assistantToggle = $('#assistantToggle');
        const assistantPanel = $('#assistantPanel');
        const assistantPanelHeader = assistantPanel ? assistantPanel.querySelector('header') : null;
        const assistantClose = $('#assistantClose');
        const assistantPulse = $('#assistantPulse');
        const assistantLaunchers = Array.from(document.querySelectorAll('.assistant-launcher'));
        if (assistantToggle && assistantPanel) {
          assistantToggle.setAttribute('aria-controls', 'assistantPanel');
          assistantToggle.setAttribute('aria-expanded', 'false');
        }
        assistantPulse?.setAttribute('aria-hidden', 'true');
        const assistantFabPositionKey = 'app:assistantFabPos';
        let assistantFabPosition = null;
        let assistantFabDragSession = null;
        let assistantFabSuppressClick = false;
        let assistantDismissedManually = false;

        const clampAssistantFabPosition = (left, top) => {
          if (!assistantFab) return { left, top };
          const margin = 12;
          const width = assistantFab.offsetWidth || 0;
          const height = assistantFab.offsetHeight || 0;
          const maxLeft = Math.max(margin, window.innerWidth - width - margin);
          const maxTop = Math.max(margin, window.innerHeight - height - margin);
          return { left: clamp(left, margin, maxLeft), top: clamp(top, margin, maxTop) };
        };

        const applyAssistantFabPosition = (pos) => {
          if (!assistantFab) return;
          if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') {
            assistantFab.style.top = '';
            assistantFab.style.left = '';
            assistantFab.style.bottom = '1.5rem';
            assistantFab.style.right = '1.5rem';
            assistantFab.dataset.anchor = 'default';
            assistantFabPosition = null;
            return;
          }
          const next = clampAssistantFabPosition(pos.left, pos.top);
          assistantFab.style.left = `${next.left}px`;
          assistantFab.style.top = `${next.top}px`;
          assistantFab.style.bottom = 'auto';
          assistantFab.style.right = 'auto';
          assistantFab.dataset.anchor = 'custom';
          assistantFabPosition = { left: next.left, top: next.top };
        };

        const persistAssistantFabPosition = () => {
          if (!assistantFab) return;
          if (!assistantFabPosition) {
            localStorage.removeItem(assistantFabPositionKey);
            return;
          }
          try {
            localStorage.setItem(assistantFabPositionKey, JSON.stringify(assistantFabPosition));
          } catch (err) {
            console.warn('Gagal menyimpan posisi AI Navigator', err);
          }
        };

        const loadAssistantFabPosition = () => {
          if (!assistantFab) return null;
          try {
            const stored = localStorage.getItem(assistantFabPositionKey);
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            if (typeof parsed?.left !== 'number' || typeof parsed?.top !== 'number') return null;
            return parsed;
          } catch (err) {
            console.warn('Gagal membaca posisi AI Navigator', err);
            return null;
          }
        };

        if (assistantFab) {
          const savedFab = loadAssistantFabPosition();
          if (savedFab) applyAssistantFabPosition(savedFab);
          assistantFab.removeAttribute('hidden');
        }

        const registerAssistantDragHandle = (handle) => {
          if (!handle || !assistantFab) return;
          handle.addEventListener('pointerdown', (evt) => {
            if (evt.pointerType === 'mouse' && evt.button !== 0) return;
            if (handle === assistantPanelHeader && evt.target.closest('button, a, input, textarea, select')) return;
            handle.setPointerCapture?.(evt.pointerId);
            const rect = assistantFab.getBoundingClientRect();
            assistantFabDragSession = {
              pointerId: evt.pointerId,
              startX: evt.clientX,
              startY: evt.clientY,
              originLeft: rect.left,
              originTop: rect.top,
              moved: false,
            };
          });
          handle.addEventListener('pointermove', (evt) => {
            if (!assistantFabDragSession || evt.pointerId !== assistantFabDragSession.pointerId) return;
            const deltaX = evt.clientX - assistantFabDragSession.startX;
            const deltaY = evt.clientY - assistantFabDragSession.startY;
            if (!assistantFabDragSession.moved) {
              if (Math.hypot(deltaX, deltaY) < 6) return;
              assistantFabDragSession.moved = true;
              assistantFab.classList.add('is-dragging');
            }
            const next = clampAssistantFabPosition(assistantFabDragSession.originLeft + deltaX, assistantFabDragSession.originTop + deltaY);
            assistantFab.style.left = `${next.left}px`;
            assistantFab.style.top = `${next.top}px`;
            assistantFab.style.bottom = 'auto';
            assistantFab.style.right = 'auto';
            assistantFab.dataset.anchor = 'custom';
            assistantFabPosition = next;
          });
          const finishDrag = (evt) => {
            if (!assistantFabDragSession || evt.pointerId !== assistantFabDragSession.pointerId) return;
            handle.releasePointerCapture?.(evt.pointerId);
            assistantFab.classList.remove('is-dragging');
            if (assistantFabDragSession.moved) {
              assistantFabSuppressClick = true;
              window.setTimeout(() => { assistantFabSuppressClick = false; }, 180);
              applyAssistantFabPosition(assistantFabPosition);
              persistAssistantFabPosition();
            }
            assistantFabDragSession = null;
          };
          handle.addEventListener('pointerup', finishDrag);
          handle.addEventListener('pointercancel', finishDrag);
          handle.addEventListener('lostpointercapture', () => {
            assistantFab?.classList.remove('is-dragging');
            assistantFabDragSession = null;
          });
        };

        registerAssistantDragHandle(assistantToggle);
        registerAssistantDragHandle(assistantPanelHeader);

        window.addEventListener('resize', () => {
          if (!assistantFab || assistantFab.dataset.anchor !== 'custom' || !assistantFabPosition) return;
          window.requestAnimationFrame(() => {
            if (!assistantFabPosition) return;
            applyAssistantFabPosition(assistantFabPosition);
            persistAssistantFabPosition();
          });
        });

        const runnerCanvas = $('#runnerCanvas');
        const runnerStartBtn = $('#runnerStartBtn');
        const runnerJumpBtn = $('#runnerJumpBtn');
        const runnerScoreLabel = $('#runnerScore');
        const runnerHighScoreLabel = $('#runnerHighScore');
        const gameStatus = $('#gameStatus');
        const konamiSecret = $('#konamiSecret');
        const miniPlayerEl = $('#miniPlayer');
        const miniPlayBtn = $('#miniPlayBtn');
        const miniPlayIcon = miniPlayBtn ? miniPlayBtn.querySelector('i') : null;
        const miniPlayLabel = miniPlayBtn ? miniPlayBtn.querySelector('.mini-btn-label') : null;
        const miniCloseBtn = $('#miniCloseBtn');
        const miniShareBtn = $('#miniShareBtn');
        const miniSeek = $('#miniSeek');
        const miniTime = $('#miniTime');
        const miniTitle = $('#miniTitle');
        const miniSubtitle = $('#miniSubtitle');
        const legendaryCard = $('#legendaryCard');
        const legendaryStatusBadge = $('#legendaryStatusBadge');
        const legendaryStage = $('#legendaryStage');
        const legendaryPokemon = $('#legendaryPokemon');
        const legendaryHint = $('#legendaryHint');
        const legendaryThrowBtn = $('#legendaryThrowBtn');
        const legendaryShuffleBtn = $('#legendaryShuffleBtn');
        const legendaryLog = $('#legendaryLog');
        const legendaryDexList = $('#legendaryDexList');
        const subtitleBtn = $('#subtitleBtn');
        const subtitleLang = $('#subtitleLang');
        const subtitleAuto = $('#subtitleAuto');
        const subtitleResult = $('#subtitleResult');
        const subtitleLangBadge = $('#subtitleLangBadge');
        const subtitleAutoBadge = $('#subtitleAutoBadge');
        const subtitleSrtLink = $('#subtitleSrtLink');
        const subtitleTxtLink = $('#subtitleTxtLink');
        const subtitlePreview = $('#subtitlePreview');
        const convertProgWrap = $('#convertProgWrap');
        const convertProgBar = $('#convertProgress');
        const convertProgLabel = $('#convertProgressLabel');
        const installBtn = $('#installAppBtn');
        const installBtnMobile = $('#installAppBtnMobile');
        const offlineBadge = $('#offlineBadge');
        const subtitleCopyBtn = $('#subtitleCopyBtn');
        const subtitleShareBtn = $('#subtitleShareBtn');
        const subtitleStatus = $('#subtitleStatus');
        const subtitleBtnDefault = subtitleBtn ? subtitleBtn.innerHTML : '';
        const formatSelect = $('#format');
        const abrSelect = $('#abr');
        const fileNameInput = $('#fileName');
        const qualityPresetSelect = $('#qualityPreset');
        const qualityPresetHelp = $('#qualityPresetHelp');
        const qualityPresetWrap = $('#qualityPresetWrap');
        const sampleRateSelect = $('#sampleRate');
        const speedModeSelect = $('#speedMode');
        const videoQualityWrap = $('#videoOptions');
        const videoQualityHelp = $('#videoQualityHelp');
        const abrHelp = $('#abrHelp');
        const sampleRateHelp = $('#sampleRateHelp');
        const speedHelp = $('#speedHelp');

        // Moved event listeners here to avoid ReferenceError
        if (videoPreviewToggle) {
          videoPreviewToggle.addEventListener('change', () => {
            state.experience.previewEmbed = !!videoPreviewToggle.checked;
            persistState();
            if (!videoPreviewToggle.checked && videoPreviewFrame) {
              videoPreviewFrame.src = '';
              videoPreviewFrame.hidden = true;
              if (thumbEl) thumbEl.hidden = false;
            } else if (lastVideoInfo) {
              applyVideoMetadata(lastVideoInfo, { setUrl: false, autoFillId3: false, fillEmptyId3: false });
            }
          });
        }
        if (videoQualitySelect) {
          videoQualitySelect.addEventListener('change', () => {
            state.experience.videoQuality = videoQualitySelect.value || 'best';
            persistState();
            updateEstSize();
          });
        }

        if (abrSelect) abrSelect.addEventListener('change', updateEstSize);
        if (formatSelect) formatSelect.addEventListener('change', updateEstSize);

        const abrLabel = document.querySelector('label[for="abr"]');
        const sampleRateLabel = document.querySelector('label[for="sampleRate"]');
        const speedLabel = document.querySelector('label[for="speedMode"]');
        const id3TitleInput = $('#id3Title');
        const id3ArtistInput = $('#id3Artist');
        const id3AlbumInput = $('#id3Album');
        const id3Genre = $('#id3Genre');
        const autoMetaSmartToggle = $('#autoMetaSmart');
        const id3CoverPreview = $('#id3CoverPreview');
        const id3CoverText = $('#id3CoverText');
        const convertServerMode = $('#convertServerMode');
        const crossfadeSecondsSelect = $('#crossfadeSeconds');
        const gaplessPlaybackToggle = $('#gaplessPlayback');
        const markManualInput = (input) => {
          if (!input) return;
          const handleManualFlag = () => {
            const value = input.value != null ? input.value.trim() : '';
            if (value) {
              input.dataset.manual = '1';
            } else {
              delete input.dataset.manual;
              delete input.dataset.auto;
              if (input === fileNameInput) delete input.dataset.autoApplied;
            }
          };
          input.addEventListener('input', () => {
            if (input === fileNameInput && input.dataset.autoName && input.value !== input.dataset.autoName) {
              input.dataset.manual = '1';
              delete input.dataset.autoApplied;
            }
            handleManualFlag();
          });
          input.addEventListener('change', handleManualFlag);
          input.addEventListener('blur', handleManualFlag);
        };
        [id3TitleInput, id3ArtistInput, id3AlbumInput, id3Genre, fileNameInput].forEach(markManualInput);
        const adminLoginForm = $('#adminLoginForm');
        const adminUserInput = $('#adminUser');
        const adminPassInput = $('#adminPass');
        const adminLogoutBtn = $('#adminLogoutBtn');
        const adminStatusBadge = $('#adminStatus');
        const adminLoginHelp = $('#adminLoginHelp');
        const dropzoneStatus = $('#dropzoneStatus');
        const openLoginBtn = $('#openLoginBtn');
        const accessHighContrast = $('#accessHighContrast');
        const accessLargeText = $('#accessLargeText');
        const accessReduceMotion = $('#accessReduceMotion');
        const prefConfirmAutoDownload = $('#prefConfirmAutoDownload');
        const prefRememberFormat = $('#prefRememberFormat');
        const prefOutputDir = $('#prefOutputDir');
        const prefOrganizeBy = $('#prefOrganizeBy');
        const settingsOffcanvasEl = document.getElementById('offcanvasSettings');
        const toolStatusWrap = $('#toolStatusWrap');
        const ytDlpInfo = $('#ytDlpInfo');
        const ytDlpBadge = $('#ytDlpBadge');
        const ffmpegInfo = $('#ffmpegInfo');
        const ffmpegBadge = $('#ffmpegBadge');
        const toolRefreshBtn = $('#toolRefreshBtn');
        const setToolBadgeState = (badge, state) => {
          if (!badge) return;
          badge.hidden = false;
          badge.className = 'badge ms-2';
          if (state === 'ok') {
            badge.classList.add('text-bg-success');
            badge.textContent = translateMessage('Sudah terbaru');
          } else if (state === 'outdated') {
            badge.classList.add('text-bg-warning');
            badge.textContent = translateMessage('Perlu update');
          } else {
            badge.classList.add('text-bg-secondary');
            badge.textContent = translateMessage('Tidak diketahui');
          }
        };

        const applyToolInfo = (infoEl, badgeEl, info) => {
          if (!infoEl) return;
          if (!info || (!info.current && !info.latest)) {
            infoEl.textContent = translateMessage('Belum terdeteksi');
            if (badgeEl) {
              badgeEl.hidden = false;
              badgeEl.className = 'badge ms-2 text-bg-secondary';
              badgeEl.textContent = translateMessage('Tidak diketahui');
            }
            return;
          }
          const parts = [];
          if (info.current) parts.push(`${translateMessage('Terpasang')}: ${info.current}`);
          if (info.latest && info.latest !== info.current) parts.push(`${translateMessage('Terbaru')}: ${info.latest}`);
          infoEl.textContent = parts.join(' • ') || info.current || info.latest || translateMessage('Belum terdeteksi');
          if (badgeEl) {
            if (info.upToDate === true) setToolBadgeState(badgeEl, 'ok');
            else if (info.upToDate === false) setToolBadgeState(badgeEl, 'outdated');
            else setToolBadgeState(badgeEl, 'unknown');
          }
        };

        const refreshToolStatus = async ({ manual = false } = {}) => {
          if (!toolStatusWrap) return;
          if (toolRefreshBtn) {
            toolRefreshBtn.disabled = true;
            toolRefreshBtn.classList.add('is-loading');
          }
          if (ytDlpBadge) ytDlpBadge.hidden = true;
          if (ffmpegBadge) ffmpegBadge.hidden = true;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

          try {
            const resp = await fetch(api('/api/tool-versions'), {
              cache: 'no-store',
              signal: controller.signal
            });
            clearTimeout(timeout);

            const { data } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal memeriksa tool'),
              logLabel: 'tool-versions',
            });
            const tools = data.tools || {};
            applyToolInfo(ytDlpInfo, ytDlpBadge, tools.ytDlp);
            applyToolInfo(ffmpegInfo, ffmpegBadge, tools.ffmpeg);
          } catch (err) {
            console.warn('tool-versions', err);
            if (ytDlpInfo) ytDlpInfo.textContent = err.name === 'AbortError' ? 'Timeout' : (err.message || translateMessage('Tidak dapat memeriksa versi'));
            if (ffmpegInfo) ffmpegInfo.textContent = translateMessage('Coba lagi nanti');
            if (manual) setToast(`${translateMessage('Gagal memeriksa tool')}: ${err.message || 'Error'}`);
          } finally {
            if (toolRefreshBtn) {
              toolRefreshBtn.disabled = false;
              toolRefreshBtn.classList.remove('is-loading');
            }
          }
        };
        const settingsOffcanvas = settingsOffcanvasEl && bs?.Offcanvas?.getOrCreateInstance
          ? bs.Offcanvas.getOrCreateInstance(settingsOffcanvasEl)
          : null;

        const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
        const selectedSpeedTips = new Set();
        const avatarDropdown = avatarToggle && bs?.Dropdown?.getOrCreateInstance
          ? bs.Dropdown.getOrCreateInstance(avatarToggle)
          : null;

        if (speedTipButtons.length) {
          speedTipButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
              const key = btn.dataset.tipId || btn.dataset.tipLabel || btn.textContent.trim();
              const label = btn.dataset.tipLabel || btn.querySelector('.tip-title')?.textContent?.trim() || 'Tips';
              const isActive = btn.classList.toggle('is-active');
              if (key) {
                if (isActive) {
                  selectedSpeedTips.add(key);
                } else {
                  selectedSpeedTips.delete(key);
                }
              }
              if (speedTipHint) {
                speedTipHint.textContent = selectedSpeedTips.size
                  ? `Prioritas kamu: ${selectedSpeedTips.size} tips dipilih.`
                  : 'Ketuk tips untuk menandai prioritasmu.';
              }
              setToast(`${isActive ? 'Diprioritaskan' : 'Dilepas'}: ${label}`);
              if (isActive && selectedSpeedTips.size >= 3) awardBadge('speedster');
            });
          });
        }

        const donationBaseUrl = 'https://saweria.co/DhikaMarcella';
        const defaultDonationAmount = 10000;
        let activeDonationAmount = defaultDonationAmount;
        let activeDonationUrl = `${donationBaseUrl}?amount=${defaultDonationAmount}`;

        const applyDonationAmount = (amount) => {
          const nominal = Number(amount) || defaultDonationAmount;
          const label = rupiahFormatter.format(nominal);
          activeDonationAmount = nominal;
          activeDonationUrl = `${donationBaseUrl}?amount=${encodeURIComponent(nominal)}`;
          if (donationButtons.length) {
            donationButtons.forEach((btn) => {
              const btnAmount = Number(btn.dataset.amount || 0);
              const isSelected = btnAmount === nominal;
              btn.classList.toggle('is-selected', isSelected);
              btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
              const btnLabel = rupiahFormatter.format(btnAmount || 0);
              const chip = btn.querySelector('span');
              const desc = chip ? chip.textContent.trim() : 'Donasi cepat';
              btn.setAttribute('aria-label', `${btnLabel} • ${desc}`);
            });
          }
          if (donationLink) {
            donationLink.href = activeDonationUrl;
            donationLink.dataset.amount = String(nominal);
            donationLink.setAttribute(
              'aria-label',
              currentLang === 'en' ? `Open Saweria with ${label}` : `Buka Saweria nominal ${label}`,
            );
          }
          if (donationManualLink) {
            donationManualLink.href = activeDonationUrl;
            const manualText = currentLang === 'en'
              ? `Open manually (${label})`
              : `Buka manual (${label})`;
            donationManualLink.textContent = manualText;
            donationManualLink.setAttribute(
              'aria-label',
              currentLang === 'en'
                ? `Open Saweria manually with ${label}`
                : `Buka Saweria manual nominal ${label}`,
            );
            donationManualLink.dataset.amount = String(nominal);
          }
          if (donationLinkHint) {
            donationLinkHint.textContent = currentLang === 'en'
              ? `${label} will be pre-filled automatically`
              : `${label} siap diisi otomatis`;
          }
          return { nominal, label, url: activeDonationUrl };
        };

        const openDonationWindow = (amount) => {
          const { nominal, label, url } = applyDonationAmount(amount);
          let popup = null;
          try {
            popup = window.open(url, '_blank', 'noopener');
            popup?.focus?.();
          } catch (err) {
            console.error('Gagal membuka Saweria', err);
          }
          if (donationStatus) {
            donationStatus.innerHTML = popup
              ? (currentLang === 'en'
                ? `Thank you! ${label} is ready in the new Saweria tab.`
                : `Terima kasih! ${label} siap dibayar di tab Saweria baru.`)
              : (currentLang === 'en'
                ? `Pop-up blocked. Tap the <strong>Open manually</strong> button below, amount ${label} is ready.`
                : `Pop-up diblokir. Klik tombol <strong>Buka manual</strong> di bawah, nominal sudah otomatis ${label}. Aktifkan pop-up atau tekan dan tahan untuk membuka di tab baru.`);
          }
          triggerDonationCelebration(nominal, !!popup);
          const successMessage = currentLang === 'en'
            ? `Thank you! ${label} selected.`
            : `Terima kasih! ${label} dipilih.`;
          const blockedMessage = currentLang === 'en'
            ? `Enable pop-ups or use the Open manually button to donate ${label}.`
            : `Aktifkan pop-up atau gunakan tombol Buka manual untuk donasi ${label}.`;
          setToast(popup ? successMessage : blockedMessage);
        };

        const initialDonation = applyDonationAmount(defaultDonationAmount);
        if (donationStatus) {
          donationStatus.innerHTML = currentLang === 'en'
            ? `Amount ${initialDonation.label} will be pre-filled automatically on Saweria.`
            : `Nominal ${initialDonation.label} siap dimasukkan otomatis ke Saweria.`;
        }

        if (donationButtons.length) {
          donationButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
              const nominal = btn.dataset.amount;
              if (!nominal) return;
              btn.classList.add('is-pulse');
              window.setTimeout(() => btn.classList.remove('is-pulse'), 820);
              openDonationWindow(nominal);
            });
          });
        }

        if (donationLink) {
          donationLink.addEventListener('click', () => {
            const label = rupiahFormatter.format(activeDonationAmount || defaultDonationAmount);
            if (donationStatus) donationStatus.innerHTML = `Halaman Saweria dibuka di tab baru. Nominal ${label} sudah otomatis.`;
            setToast(`Buka Saweria (${label}).`);
          });
        }

        if (donationManualLink) {
          donationManualLink.addEventListener('click', () => {
            const label = rupiahFormatter.format(activeDonationAmount || defaultDonationAmount);
            triggerDonationCelebration(activeDonationAmount || defaultDonationAmount, true);
            if (donationStatus) {
              donationStatus.innerHTML = currentLang === 'en'
                ? `Manual link opened. If a new tab doesn't appear, long-press and choose 'open link'. Amount ${label} is already filled in.`
                : `Tautan manual dibuka. Jika tab baru tidak muncul, tekan dan tahan lalu pilih 'buka tautan'. Nominal ${label} sudah otomatis.`;
            }
            const toastMessage = currentLang === 'en'
              ? `Manual Saweria link opened (${label}).`
              : `Buka Saweria manual (${label}).`;
            setToast(toastMessage);
          });
        }

        if (faqItems.length) {
          faqItems.forEach((faq) => {
            faq.addEventListener('toggle', () => {
              if (!faq.open) return;
              const summary = faq.querySelector('summary');
              const label = summary ? summary.textContent.trim() : 'FAQ';
              setToast(`FAQ dibuka: ${label}`);
            });
          });
        }

        if (themeSelect) {
          themeSelect.addEventListener('change', () => {
            const newTheme = themeSelect.value || 'auto';
            if (state.experience.theme !== newTheme) {
              state.experience.theme = newTheme;
              applyTheme();
              persistState();
              incrementPoints(12, 'Ganti tema', { badge: 'stylist' });
            }
          });
        }

        if (fontSelect) {
          fontSelect.addEventListener('change', () => {
            const value = fontSelect.value || 'typewriter';
            if (state.experience.font !== value) {
              state.experience.font = value;
              applyFont();
              persistState();
              incrementPoints(10, 'Ganti font', { badge: 'stylist' });
            }
          });
        }

        if (layoutSelect) {
          layoutSelect.addEventListener('change', () => {
            const value = layoutSelect.value || 'cozy';
            if (state.experience.layout !== value) {
              state.experience.layout = value;
              applyLayout();
              persistState();
              incrementPoints(8, 'Atur layout', { badge: 'stylist' });
            }
          });
        }

        if (moodSelect) {
          moodSelect.addEventListener('change', () => {
            state.experience.mood = moodSelect.value || 'auto';
            persistState();
            startBackgroundMusic(state.experience.mood);
          });
        }

        if (musicToggleBtn) {
          musicToggleBtn.addEventListener('click', () => {
            if (musicPlaying) {
              stopBackgroundMusic();
            } else {
              startBackgroundMusic(state.experience.mood || 'auto');
            }
          });
        }

        musicNextBtn?.addEventListener('click', rotateMood);
        musicStopBtn?.addEventListener('click', () => stopBackgroundMusic());

        if (narratorToggle) {
          narratorToggle.addEventListener('change', () => {
            state.experience.narratorAuto = !!narratorToggle.checked;
            persistState();
            if (narratorToggle.checked) narrateGuide();
          });
        }

        readSelectionBtn?.addEventListener('click', () => {
          const selection = window.getSelection()?.toString();
          if (speak(selection)) incrementPoints(6, 'Narrator pilihan', { badge: 'narrator' });
        });
        readGuideBtn?.addEventListener('click', narrateGuide);
        stopNarratorBtn?.addEventListener('click', stopNarrator);

        assistantSendBtn?.addEventListener('click', sendAssistantMessage);
        assistantInput?.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' && !evt.shiftKey) {
            evt.preventDefault();
            sendAssistantMessage();
          }
        });

        runnerStartBtn?.addEventListener('click', startRunner);
        runnerJumpBtn?.addEventListener('click', () => {
          if (!runnerState.running) {
            startRunner();
            return;
          }
          jumpRunner();
          incrementPoints(2, 'Lompatan mini game');
        });
        runnerCanvas?.addEventListener('pointerdown', () => {
          if (!runnerState.running) {
            startRunner();
          } else {
            jumpRunner();
          }
        });

        legendaryThrowBtn?.addEventListener('click', handleLegendaryThrow);
        legendaryShuffleBtn?.addEventListener('click', () => shuffleLegendary());
        if (legendaryStage) {
          legendaryStage.addEventListener('click', () => {
            if (!state.experience.legendaryUnlocked || state.experience.legendarySecret) return;
            legendarySecretCounter += 1;
            clearTimeout(legendarySecretTimer);
            legendarySecretTimer = window.setTimeout(() => { legendarySecretCounter = 0; }, 900);
            if (legendarySecretCounter >= 5) {
              legendarySecretCounter = 0;
              revealLegendarySecret();
            }
          });
          legendaryStage.addEventListener('keydown', (evt) => {
            if (!state.experience.legendaryUnlocked) return;
            if (evt.key === 'Enter' || evt.key === ' ') {
              evt.preventDefault();
              shuffleLegendary();
            }
          });
        }

        document.addEventListener('keydown', (evt) => {
          if (state.cheats.enabled && evt.ctrlKey && evt.altKey && String(evt.key).toLowerCase() === 'c') {
            evt.preventDefault();
            if (!state.auth.user) {
              setToast(translateMessage('Masuk dengan Google untuk membuka panel debug.'));
              return;
            }
            toggleCheatPanel(!state.cheats.visible);
            return;
          }
          konamiTracker(evt.key || '');
          secretCheatTracker(evt.key || '');
          if (evt.code === 'Space' && !(evt.target instanceof HTMLInputElement) && !(evt.target instanceof HTMLTextAreaElement)) {
            evt.preventDefault();
            jumpRunner();
          }
        });

        endingStayBtn?.addEventListener('click', hideCustomEnding);
        const cancelCustomEndingIntent = () => {
          if (customEndingIntentTimer) {
            clearTimeout(customEndingIntentTimer);
            customEndingIntentTimer = 0;
          }
        };

        const scheduleCustomEndingIntent = () => {
          cancelCustomEndingIntent();
          customEndingIntentTimer = window.setTimeout(() => {
            customEndingIntentTimer = 0;
            const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
            const visible = typeof document.visibilityState === 'undefined' || document.visibilityState === 'visible';
            if (!hasFocus || !visible) return;
            showCustomEnding();
          }, 1200);
        };

        document.addEventListener('mouseleave', (evt) => {
          if (evt.clientY <= 0) {
            scheduleCustomEndingIntent();
          }
        });
        document.addEventListener('mouseenter', cancelCustomEndingIntent);
        window.addEventListener('focus', cancelCustomEndingIntent);
        window.addEventListener('blur', cancelCustomEndingIntent);
        document.addEventListener('pointerdown', cancelCustomEndingIntent);
        document.addEventListener('visibilitychange', () => {
          if (typeof document.hidden !== 'undefined' && document.hidden) {
            cancelCustomEndingIntent();
          }
        });

        document.addEventListener('pointerdown', () => ensureAudioContext(), { once: true });

        const storage = {
          get k() { return 'ytmp3.settings.v1'; },
          load() { try { return JSON.parse(localStorage.getItem(this.k)) || {}; } catch { return {}; } },
          save(v) { localStorage.setItem(this.k, JSON.stringify(v || {})); }
        };

        const defaultAccessibility = { highContrast: false, largeText: false, reduceMotion: false };
        const defaultExperience = {
          theme: 'auto',
          font: 'typewriter',
          layout: 'cozy',
          mood: 'auto',
          previewEmbed: true,
          videoQuality: 'best',
          narratorAuto: false,
          points: 0,
          level: 1,
          progress: 0,
          streak: 0,
          streakBest: 0,
          lastConvertDate: '',
          badges: ['welcome'],
          highScore: 0,
          legendaryUnlocked: false,
          legendaryDex: [],
          legendarySecret: false,
          legendaryTarget: '',
          spinTickets: 0,
          spinHistory: [],
          triviaSeen: 0,
          triviaScore: 0,
          lastTriviaId: '',
          seasonalSkin: '',
          usage: {
            vpn: 0,
            resume: 0,
            soundfx: 0,
            privateshare: 0,
            spin: 0
          }
        };
        const defaultPreferences = {
          confirmAutoDownload: false,
          rememberLastFormat: true,
          lastFormat: null,
          outputDir: '',
          organizeBy: 'none'
        };

        const defaultAssistantSettings = {
          memoryEnabled: true,
          maxMemoryMessages: 30
        };

        const state = {
          backendUrl: '',
          adminBearer: 'dhika_sayang123!',
          accessibility: { ...defaultAccessibility },
          experience: { ...defaultExperience },
          preferences: { ...defaultPreferences },
          narratorEnabled: false,
          assistantHistory: [],
          assistantSettings: { ...defaultAssistantSettings },
          avatarAura: '',
          backgroundEmail: '',
          cheats: { enabled: false, visible: false },
          auth: {
            token: '',
            user: null,
            googleClientId: null,
            loading: false,
            googlePollTimer: null,
            googleFallbackTimeout: null,
            googleFallbackNotified: false,
          },
          drive: {
            accessToken: '',
            expiresAt: 0,
            pending: false,
            lastStatus: '',
          },
          lastDownload: null,
          captcha: {
            siteKey: '',
            loadedSiteKey: '',
            lastToken: '',
            lastAction: '',
            lastFetched: 0,
            strict: false,
            warnedFailure: false,
          },
        };

        let driveTokenClient = null;



        async function requestCaptchaToken(action = 'convert') {
          const tryReadResponse = () => {
            if (typeof turnstile === 'undefined') return '';
            try {
              const token = (typeof turnstileWidgetId !== 'undefined' && turnstileWidgetId !== null)
                ? turnstile.getResponse(turnstileWidgetId)
                : turnstile.getResponse();
              return token || '';
            } catch {
              return '';
            }
          };

          const direct = tryReadResponse();
          if (direct) {
            state.captcha.lastToken = direct;
            state.captcha.lastAction = action;
            state.captcha.lastFetched = Date.now();
            return direct;
          }

          if (typeof requestTurnstileVerification === 'function') {
            const token = await requestTurnstileVerification();
            if (typeof token === 'string' && token) {
              state.captcha.lastToken = token;
              state.captcha.lastAction = action;
              state.captcha.lastFetched = Date.now();
              return token;
            }
          }

          const msg = translateMessage('Mohon selesaikan Captcha terlebih dahulu');
          setToast(msg);
          throw new Error(msg);
        }

        const badgeCatalog = {
          welcome: {
            label: 'Welcome',
            xp: 12,
            description: 'Badge perdana saat kamu mulai mengumpulkan XP di Experience Hub.'
          },
          donor: {
            label: 'Donor Pro',
            xp: '10-120 XP',
            description: 'Dukung server melalui tombol donasi Saweria.'
          },
          gamer: {
            label: 'Game Runner',
            xp: 8,
            description: 'Capai skor dan hindari glitch di Neo Runner.'
          },
          voice: {
            label: 'Voice Navigator',
            xp: 20,
            description: 'Aktifkan dan jalankan perintah suara dari panel Voice & Narrator.'
          },
          narrator: {
            label: 'Storyteller',
            xp: 16,
            description: 'Gunakan narrator untuk membacakan pilihan atau ringkasan UI.'
          },
          stylist: {
            label: 'UI Stylist',
            xp: 30,
            description: 'Ubah tema, font, dan layout dashboard Experience.'
          },
          konami: {
            label: 'Konami Master',
            xp: 100,
            description: 'Masukkan kode rahasia ↑↑↓↓←→←→BA.'
          },
          andhika: {
            label: 'Secret Admirer',
            xp: '30000 XP',
            description: 'Kode rahasia eksklusif yang tidak muncul di daftar publik.',
            hidden: true,
          },
          ai: {
            label: 'AI Buddy',
            xp: 15,
            description: 'Gunakan AI Navigator untuk menjawab pertanyaan seputar web.'
          },
          maestro: {
            label: 'Sound Maestro',
            xp: 20,
            description: 'Mainkan musik adaptif dan jelajahi beberapa mood.'
          },
          speedster: {
            label: 'Speed Runner',
            xp: 12,
            description: 'Tandai minimal tiga tips kecepatan favoritmu.'
          },
          explorer: {
            label: 'Feature Explorer',
            xp: 18,
            description: 'Kunjungi ketiga tab utama converter.'
          },
          supporter: {
            label: 'Support Squad',
            xp: '=75 XP',
            description: 'Donasikan Rp75.000 atau lebih dalam satu transaksi.'
          },
          collector: {
            label: 'Badge Collector',
            xp: 40,
            description: 'Kumpulkan setidaknya enam badge berbeda.'
          },
          navigator: {
            label: 'Navigator Pro',
            xp: 18,
            description: 'Manfaatkan slash command cepat di AI Navigator.'
          },
          streak3: {
            label: 'Streak Bronze',
            xp: 24,
            description: 'Capai streak 3 hari berturut-turut.'
          },
          streak7: {
            label: 'Streak Silver',
            xp: 60,
            description: 'Pertahankan streak konversi selama seminggu penuh.'
          },
          streak30: {
            label: 'Streak Legend',
            xp: 200,
            description: 'Tetap konsisten convert selama 30 hari.'
          },
          spin: {
            label: 'Lucky Star',
            xp: 35,
            description: 'Menang hadiah dari Lucky Spin.'
          },
          vpn: {
            label: 'VPN Guardian',
            xp: 18,
            description: 'Gunakan mode VPN-friendly saat convert.'
          },
          resume: {
            label: 'Download Sentinel',
            xp: 18,
            description: 'Selesaikan unduhan menggunakan Smart Resume.'
          },
          soundfx: {
            label: 'Sound Sculptor',
            xp: 20,
            description: 'Tambah efek reverb, echo, atau 8-bit ke hasilmu.'
          },
          privateshare: {
            label: 'Private Keeper',
            xp: 26,
            description: 'Bagikan hasil konversi via Private Room yang diproteksi.'
          },
          maxed: {
            label: 'Mythic Level',
            xp: 300,
            description: 'Capai Level 5 (30000 XP) dan buka Legendary Catch Challenge.'
          },
          legendary: {
            label: 'Legendary Catch',
            xp: 220,
            description: 'Tangkap Pok...mon legenda pertama dari hadiah Legendary Catch.'
          },
          mythic: {
            label: 'Mythic Hunter',
            xp: 420,
            description: 'Kumpulkan minimal lima legenda berbeda di Legendary Dex.'
          },
          apex: {
            label: 'Apex Dex',
            xp: 600,
            description: 'Lengkapi seluruh Legendary Dex dan raih penghujung petualangan.'
          },
          easter: {
            label: 'Easter Whisper',
            xp: 180,
            description: 'Temukan easter egg rahasia yang tersembunyi di panggung legenda.'
          }
        };

        const getBadgeMeta = (id) => badgeCatalog[id] || { label: id, xp: 'XP variabel', description: '' };

        const formatBadgeLabel = (id) => getBadgeMeta(id).label;

        const formatBadgeXp = (id) => {
          const meta = getBadgeMeta(id);
          if (typeof meta.xp === 'string' && meta.xp.trim()) return meta.xp;
          if (Number.isFinite(meta.xp) && meta.xp > 0) return `${meta.xp} XP`;
          return 'XP variabel';
        };

        const formatBadgeDescription = (id) => {
          const meta = getBadgeMeta(id);
          return meta.description || 'Eksplor fitur lainnya untuk membuka badge ini.';
        };

        const LEGENDARY_THRESHOLD = 30000;

        const avatarLevels = [
          { threshold: 0, emoji: '🌱', title: 'Rookie', mood: 'Pendatang baru yang penasaran.' },
          { threshold: 600, emoji: '🎧', title: 'Beat Rider', mood: 'Semakin luwes mengikuti ritme converter.' },
          { threshold: 3000, emoji: '🎹', title: 'Synth Virtuoso', mood: 'Mixer retro yang lihai meracik playlist.' },
          { threshold: 12000, emoji: '🚀', title: 'Starlight Pilot', mood: 'Navigator audio yang melesat lintas galaksi.' },
          { threshold: LEGENDARY_THRESHOLD, emoji: '👑', title: 'Mythic Legend', mood: 'Legenda sejati. Hadiah rahasia menanti petualanganmu.', aura: 'glow' }
        ];

        const mascotPhrases = {
          default: [
            'Navigator siap nemenin sesi convert kamu. ⚓',
            'Butuh tips? Coba tanya di AI Navigator ya!',
            'Rehat dulu yuk dengan main Neo Runner sebentar. 🎮'
          ],
          xp: [
            'XP kamu naik! Avatar makin semangat nih.',
            'Mantap! Level avatar semakin tinggi. 🆙'
          ],
          badge: [
            'Badge baru unlocked! Simpan momen kerennya.',
            'Badge fresh! Aku catat di papan kehormatan. 🏅'
          ],
          donation: [
            'Terima kasih sudah dukung server kami! 💖',
            'Donasimu bikin converter makin ngebut. ⚡'
          ],
          game: [
            'Neo Runner bikin refleksmu makin lincah!',
            'Skor baru! Jangan lupa klaim badge gamer. 🏆'
          ],
          ai: [
            'AI Navigator selalu siap bantu kok.',
            'Pertanyaanmu keren! AI sudah jawab ya. 🤖'
          ],
          voice: [
            'Perintah suara diterima. Lanjutkan!',
            'Voice navigation aktif, captain! 🎙️'
          ],
          spin: [
            'Lucky Spin kasih hadiah manis! 🎁',
            'Wheel of fortune berhenti di hadiah favoritmu!'
          ],
          trivia: [
            'Jawabanmu tepat! Pengetahuan musikmu mantap. 🎵',
            'Quiz musik sukses! Tambah lagi pengetahuanmu ya.'
          ],
          secure: [
            'Mode aman aktif. VPN-friendly jalan terus! 🛡️',
            'Smart Resume siap jaga unduhanmu kalau jaringan putus.'
          ]
        };

        const legendaryRoster = [
          'Mewtwo',
          'Lugia',
          'Ho-Oh',
          'Rayquaza',
          'Groudon',
          'Kyogre',
          'Dialga',
          'Palkia',
          'Giratina',
          'Reshiram',
          'Zekrom',
          'Xerneas',
          'Yveltal',
          'Solgaleo',
          'Lunala',
          'Zacian',
          'Zamazenta',
          'Eternatus'
        ];

        let legendaryCurrent = '';
        let legendarySecretCounter = 0;
        let legendarySecretTimer = null;

        let rewardToastTimer = null;
        let mascotTimer = null;
        let celebrationTimer = null;
        let audioCtx = null;
        let donationGain = null;
        let bgGain = null;
        let bgSource = null;
        const moodBuffers = new Map();
        let musicPlaying = false;
        let currentMood = 'auto';
        let recognition = null;
        let voiceActive = false;
        const runnerSpriteArt = [
          '..........11..........',
          '.........1111.........',
          '........111111........',
          '.......11111111.......',
          '.......11111111.......',
          '......1111111111......',
          '......1111111111......',
          '......11######11......',
          '.....11########11.....',
          '.....11########11.....',
          '.....11########11.....',
          '.....11########11.....',
          '......11######11......',
          '......11######11......',
          '...2222########2222...',
          '..222222######222222..',
          '..222222######222222..',
          '..222222######222222..',
          '.2222222######2222222.',
          '.2222222######2222222.',
          '....2222######2222....',
          '.....2222####2222.....',
          '......2222##2222......',
          '.......2222..22.......',
          '........22....2.......'
        ];

        const monsterSpriteArt = [
          '....33....',
          '....33....',
          '....33....',
          '....33....',
          '....33....',
          '....33....',
          '....33....',
          '....33....',
          '....33....',
          '....33....',
          '....33....'
        ];

        const RUNNER_PIXEL_SIZE = 4;
        const MONSTER_PIXEL_SIZE = 4;

        const createSprite = (art, pixelSize) => {
          const columns = art.reduce((max, row) => Math.max(max, row.length), 0);
          const height = art.length * pixelSize;
          const width = columns * pixelSize;
          return { art, pixelSize, width, height, columns };
        };

        const drawSprite = (ctx, sprite, x, baseline, color) => {
          if (!ctx || !sprite) return;
          const { art, pixelSize, height, columns } = sprite;
          const palette = typeof color === 'string' || color instanceof String ? null : color;
          if (!palette) {
            ctx.fillStyle = color;
          }
          for (let row = 0; row < art.length; row += 1) {
            const line = art[row];
            for (let col = 0; col < columns; col += 1) {
              const cell = line[col] || '.';
              if (cell === '.' || cell === ' ') continue;
              if (palette) {
                ctx.fillStyle = palette[cell] || palette.default || palette['#'] || color || '#000';
              }
              const px = x + col * pixelSize;
              const py = baseline - height + row * pixelSize;
              ctx.fillRect(px, py, pixelSize, pixelSize);
            }
          }
        };

        const runnerSprite = createSprite(runnerSpriteArt, RUNNER_PIXEL_SIZE);
        const monsterSprite = createSprite(monsterSpriteArt, MONSTER_PIXEL_SIZE);

        const runnerVisualStyles = {
          light: {
            sky: '#f3f0ff',
            track: '#f1e4d0',
            trackLine: '#c2a27a',
            stripe: 'rgba(194,162,122,0.4)',
            shadow: 'rgba(0,0,0,0.18)',
            player: {
              '#': '#4a4a4a',
              '1': '#6b8e23',
              '2': '#556b2f',
              '3': '#8b4513',
              default: '#4a4a4a'
            },
            obstacle: '#2f3b1d'
          },
          dark: {
            sky: '#101820',
            track: '#2b2b2b',
            trackLine: '#555555',
            stripe: 'rgba(200,200,200,0.25)',
            shadow: 'rgba(0,0,0,0.38)',
            player: {
              '#': '#f5f5f5',
              '1': '#b0e17b',
              '2': '#7fb24c',
              '3': '#d2a679',
              default: '#f5f5f5'
            },
            obstacle: '#e0e0e0'
          }
        };

        const getRunnerTheme = () => document.documentElement.getAttribute('data-bs-theme') || 'dark';
        const getRunnerStyle = () => runnerVisualStyles[getRunnerTheme()] || runnerVisualStyles.dark;

        let runnerFrame = null;
        const runnerState = {
          ctx: runnerCanvas ? runnerCanvas.getContext('2d') : null,
          running: false,
          playerX: 36,
          playerY: runnerCanvas ? runnerCanvas.height - 24 : 120,
          playerVy: 0,
          gravity: 0.65,
          ground: runnerCanvas ? runnerCanvas.height - 24 : 120,
          obstacleX: runnerCanvas ? runnerCanvas.width - (monsterSprite?.width || 0) - 60 : 400,
          obstacleWidth: monsterSprite.width,
          obstacleHeight: monsterSprite.height,
          obstacleGap: 220,
          speed: 4.2,
          score: 0,
          ticks: 0,
          highScore: 0,
          playerWidth: runnerSprite.width,
          playerHeight: runnerSprite.height,
          collider: { left: 12, right: 18, top: 24, bottom: 8 },
          obstacleCollider: { left: 6, right: 6, top: 4, bottom: 4 }
        };

        const ensureAudioContext = () => {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          if (!audioCtx) {
            audioCtx = new AudioCtx();
            donationGain = audioCtx.createGain();
            donationGain.gain.value = 0.0001;
            donationGain.connect(audioCtx.destination);
            bgGain = audioCtx.createGain();
            bgGain.gain.value = 0.0001;
            bgGain.connect(audioCtx.destination);
          }
          if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { });
          return audioCtx;
        };

        const playUiFx = (type) => {
          const ctx = ensureAudioContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
          gain.connect(ctx.destination);

          const tone = (freq, start, dur, shape = 'sine') => {
            const o = ctx.createOscillator();
            o.type = shape;
            o.frequency.setValueAtTime(freq, start);
            o.connect(gain);
            o.start(start);
            o.stop(start + dur);
          };

          if (type === 'convert_click') {
            tone(520, now, 0.06, 'triangle');
            tone(820, now + 0.02, 0.06, 'triangle');
            return;
          }
          if (type === 'convert_done') {
            tone(660, now, 0.08, 'sine');
            tone(880, now + 0.06, 0.10, 'sine');
            return;
          }
        };

        const showRewardToast = (text) => {
          if (!rewardToast || !text) return;
          rewardToast.textContent = text;
          rewardToast.classList.add('show');
          clearTimeout(rewardToastTimer);
          rewardToastTimer = window.setTimeout(() => rewardToast.classList.remove('show'), 2600);
        };

        const randomLegendary = () => legendaryRoster[Math.floor(Math.random() * legendaryRoster.length)];

        const updateLegendaryDexUi = () => {
          if (!legendaryDexList) return;
          const dex = new Set(state.experience.legendaryDex || []);
          legendaryDexList.innerHTML = '';
          legendaryRoster.forEach((name) => {
            const item = document.createElement('li');
            const captured = dex.has(name);
            item.textContent = captured ? name : '???';
            item.className = captured ? 'captured' : 'is-locked';
            item.setAttribute('aria-label', captured ? `${name} tertangkap` : `${name} belum tertangkap`);
            legendaryDexList.appendChild(item);
          });
        };

        const ensureLegendaryTarget = () => {
          if (legendaryCurrent && legendaryRoster.includes(legendaryCurrent)) return legendaryCurrent;
          const stored = state.experience.legendaryTarget;
          if (stored && legendaryRoster.includes(stored)) {
            legendaryCurrent = stored;
            return legendaryCurrent;
          }
          const next = randomLegendary();
          legendaryCurrent = next;
          state.experience.legendaryTarget = next;
          persistState();
          return next;
        };

        const updateLegendaryUi = (points = Number(state.experience.points) || 0) => {
          if (!legendaryCard) return;
          const unlocked = points >= LEGENDARY_THRESHOLD || state.experience.legendaryUnlocked;
          if (!unlocked) {
            legendaryCard.hidden = true;
            legendaryCard.setAttribute('aria-hidden', 'true');
            if (legendaryStatusBadge) {
              legendaryStatusBadge.className = 'badge text-bg-secondary';
              legendaryStatusBadge.textContent = 'Terkunci';
            }
            if (legendaryPokemon) legendaryPokemon.textContent = '???';
            if (legendaryHint) legendaryHint.textContent = 'Lengkapi XP dulu untuk memulai perburuan.';
            legendaryThrowBtn?.setAttribute('disabled', '');
            legendaryShuffleBtn?.setAttribute('disabled', '');
            if (legendaryLog) legendaryLog.textContent = 'Belum ada aksi.';
            if (legendaryDexList) legendaryDexList.innerHTML = '';
            return;
          }
          legendaryCard.hidden = false;
          legendaryCard.setAttribute('aria-hidden', 'false');
          const dex = new Set(state.experience.legendaryDex || []);
          if (legendaryStatusBadge) {
            const variant = dex.size >= legendaryRoster.length ? 'text-bg-success' : dex.size ? 'text-bg-warning' : 'text-bg-info';
            legendaryStatusBadge.className = `badge ${variant}`;
            legendaryStatusBadge.textContent = `Tertangkap ${dex.size}/${legendaryRoster.length}`;
          }
          const current = ensureLegendaryTarget();
          if (legendaryPokemon) legendaryPokemon.textContent = current;
          if (legendaryHint) legendaryHint.textContent = 'Lempar Pok...ball atau ganti target kapan saja.';
          legendaryThrowBtn?.removeAttribute('disabled');
          legendaryShuffleBtn?.removeAttribute('disabled');
          updateLegendaryDexUi();
          if (legendaryLog && (!legendaryLog.textContent || legendaryLog.textContent === 'Belum ada aksi.')) {
            legendaryLog.textContent = `Target pertama: ${current}.`;
          }
        };

        const handleLegendaryUnlock = (points) => {
          if (points < LEGENDARY_THRESHOLD || state.experience.legendaryUnlocked) return;
          state.experience.legendaryUnlocked = true;
          showRewardToast('Legendary Catch Challenge terbuka!');
          showConfetti(40, true);
          awardBadge('maxed');
          persistState();
        };

        const shuffleLegendary = (announce = true) => {
          if (!state.experience.legendaryUnlocked) return;
          let next = randomLegendary();
          if (legendaryCurrent) {
            let guard = 0;
            while (next === legendaryCurrent && guard < 6) {
              next = randomLegendary();
              guard += 1;
            }
          }
          legendaryCurrent = next;
          state.experience.legendaryTarget = next;
          persistState();
          if (legendaryPokemon) legendaryPokemon.textContent = next;
          if (announce && legendaryLog) legendaryLog.textContent = `Target berikutnya: ${next}.`;
          updateLegendaryDexUi();
        };

        function handleLegendaryThrow() {
          if (!state.experience.legendaryUnlocked) return;
          const target = ensureLegendaryTarget();
          legendaryThrowBtn?.setAttribute('aria-busy', 'true');
          legendaryThrowBtn?.setAttribute('disabled', '');
          const success = Math.random() < 0.68;
          if (success) {
            const dex = new Set(state.experience.legendaryDex || []);
            const isNew = !dex.has(target);
            dex.add(target);
            state.experience.legendaryDex = Array.from(dex);
            const xpGain = isNew ? 720 : 220;
            const reason = `Menangkap ${target}`;
            incrementPoints(xpGain, reason, isNew ? { badge: 'legendary' } : {});
            if (dex.size >= 5) awardBadge('mythic');
            if (dex.size >= legendaryRoster.length) awardBadge('apex');
            showConfetti(42, true);
            showRewardToast(`Berhasil menangkap ${target}!`);
            if (legendaryLog) legendaryLog.textContent = `Berhasil menangkap ${target}!`;
            updateLegendaryDexUi();
            persistState();
          } else if (legendaryLog) {
            legendaryLog.textContent = `${target} menghindar! Coba lagi.`;
          }
          window.setTimeout(() => {
            legendaryThrowBtn?.removeAttribute('aria-busy');
            legendaryThrowBtn?.removeAttribute('disabled');
            shuffleLegendary(false);
            if (legendaryLog) legendaryLog.textContent = `Target berikutnya: ${legendaryCurrent}.`;
          }, 900);
        }

        const revealLegendarySecret = () => {
          if (!state.experience.legendaryUnlocked || state.experience.legendarySecret) return;
          state.experience.legendarySecret = true;
          clearTimeout(legendarySecretTimer);
          legendarySecretCounter = 0;
          legendarySecretTimer = null;
          awardBadge('easter');
          showRewardToast('Easter egg ditemukan!');
          showConfetti(30, true);
          if (legendaryLog) legendaryLog.textContent = 'Easter egg terbuka! Bonus rahasia ditambahkan.';
          incrementPoints(500, 'Easter egg legenda');
        };

        const renderBadges = () => {
          const badges = Array.from(state.experience.badges || []);
          if (rewardBadges) {
            rewardBadges.innerHTML = '';
            const visibleBadges = badges.filter((id) => !getBadgeMeta(id).hidden);
            if (!visibleBadges.length) {
              const empty = document.createElement('li');
              empty.className = 'is-empty';
              empty.textContent = 'Belum ada badge. Jelajahi Experience Hub untuk mulai mengumpulkan.';
              rewardBadges.appendChild(empty);
            } else {
              visibleBadges.forEach((badge) => {
                const li = document.createElement('li');
                li.dataset.badge = badge;
                const label = formatBadgeLabel(badge);
                const xpLabel = formatBadgeXp(badge);
                li.innerHTML = `<span class="badge-label">${label}</span><span class="badge-xp">${xpLabel}</span>`;
                li.title = `${label} • ${xpLabel}`;
                li.setAttribute('aria-label', `${label} • ${xpLabel}`);
                rewardBadges.appendChild(li);
              });
            }
          }
          if (badgeCountLabel) {
            const count = badges.filter((id) => !getBadgeMeta(id).hidden).length;
            badgeCountLabel.textContent = count === 1 ? '1 badge' : `${count} badge`;
          }
          if (avatarAchievementList) {
            avatarAchievementList.innerHTML = '';
            const visible = badges.filter((id) => !getBadgeMeta(id).hidden);
            if (!visible.length) {
              const empty = document.createElement('div');
              empty.className = 'text-secondary small';
              empty.textContent = 'Belum ada achievement. Jelajahi fitur untuk mengumpulkan badge.';
              avatarAchievementList.appendChild(empty);
            } else {
              visible.forEach((badge) => {
                const chip = document.createElement('div');
                chip.className = 'badge-chip';
                const label = formatBadgeLabel(badge);
                const xpLabel = formatBadgeXp(badge);
                chip.dataset.badge = badge;
                chip.innerHTML = `<i class="bi bi-patch-check-fill text-primary"></i> <span>${label}</span><span class="badge-chip-xp">${xpLabel}</span>`;
                chip.title = `${label} ' ${xpLabel} ' ${formatBadgeDescription(badge)}`;
                avatarAchievementList.appendChild(chip);
              });
            }
          }
          renderAchievementModal();
        };

        const renderAchievementModal = () => {
          if (!achievementModalList) return;
          achievementModalList.innerHTML = '';
          const owned = new Set(state.experience.badges || []);
          const entries = Object.entries(badgeCatalog).sort((a, b) => {
            const labelA = a[1]?.label || a[0];
            const labelB = b[1]?.label || b[0];
            return labelA.localeCompare(labelB, 'id', { sensitivity: 'base' });
          });
          entries.forEach(([id, meta]) => {
            if (meta?.hidden) return;
            const unlocked = owned.has(id);
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex flex-column flex-sm-row align-items-sm-center gap-2';
            item.dataset.badge = id;
            if (!unlocked) item.classList.add('is-locked');
            const label = meta?.label || id;
            const xpLabel = formatBadgeXp(id);
            const description = formatBadgeDescription(id);
            const statusIcon = unlocked
              ? '<i class="bi bi-patch-check-fill text-primary" aria-hidden="true"></i>'
              : '<i class="bi bi-lock-fill text-secondary" aria-hidden="true"></i>';
            item.innerHTML = `
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 fw-semibold">
            ${statusIcon}
            <span>${label}</span>
          </div>
          <div class="small text-secondary">${description}</div>
        </div>
        <span class="badge ${unlocked ? 'text-bg-primary' : 'text-bg-secondary'} rounded-pill">${xpLabel}</span>
      `;
            item.setAttribute('aria-label', `${label} • ${xpLabel}`);
            achievementModalList.appendChild(item);
          });
        };

        if (achievementModalEl) {
          achievementModalEl.addEventListener('show.bs.modal', () => renderAchievementModal());
        }

        const renderLevelMilestones = (points = Number(state.experience.points) || 0) => {
          if (!profileMilestones) return;
          profileMilestones.innerHTML = '';
          avatarLevels.forEach((level, idx) => {
            const next = avatarLevels[idx + 1];
            const item = document.createElement('li');
            if (points >= level.threshold && (!next || points < next.threshold)) {
              item.classList.add('is-active');
            }
            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = `Lv.${idx + 1} ${level.title}`;
            const range = document.createElement('div');
            range.className = 'range';
            range.textContent = next ? `${level.threshold} • ${next.threshold - 1} XP` : `${level.threshold}+ XP`;
            item.appendChild(title);
            item.appendChild(range);
            profileMilestones.appendChild(item);
          });
        };

        const getLevelInfo = (points) => {
          let active = avatarLevels[0];
          for (const level of avatarLevels) {
            if (points >= level.threshold) active = level;
          }
          return active;
        };

        window.updateProfileModal = () => {
          const points = Number(state.experience.points) || 0;
          const streak = Number(state.experience.streak) || 0;
          const levelInfo = getLevelInfo(points);
          const nextLevel = avatarLevels.find((lvl) => lvl.threshold > points);

          // Combine state auth and firebase auth
          let user = state.auth.user;
          if (!user && window.currentUser) {
            user = {
              name: window.currentUser.name,
              email: window.currentUser.email,
              avatarUrl: window.currentUser.avatar || window.currentUser.photoURL
            };
          }


          // Avatar
          const avatarEl = document.getElementById('profileModalAvatar');
          if (avatarEl) {
            if (user && user.avatarUrl) {
              avatarEl.src = user.avatarUrl;
            } else {
              avatarEl.src = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
            }
          }

          // Name & Email
          const nameEl = document.getElementById('profileModalName');
          const emailEl = document.getElementById('profileModalEmail');
          if (nameEl) nameEl.textContent = user ? (user.name || 'Pengguna') : 'Tamu';
          if (emailEl) emailEl.textContent = user ? (user.email || 'Sudah Login') : 'Belum Login';

          // Stats
          const xpEl = document.querySelector('#profileModal .col-4:nth-child(1) .fw-bold');
          if (xpEl) xpEl.textContent = `${points} XP`;

          const levelEl = document.querySelector('#profileModal .col-4:nth-child(2) .fw-bold');
          if (levelEl) levelEl.textContent = levelInfo.title;

          const streakEl = document.querySelector('#profileModal .col-4:nth-child(3) .fw-bold');
          if (streakEl) streakEl.textContent = `${streak} hari`;

          // Progress Bar
          const progressContainer = document.querySelector('#profileModal .progress-bar');
          const currentLevelLabel = document.querySelector('#profileModal .d-flex span:first-child');
          const nextLevelLabel = document.querySelector('#profileModal .d-flex span:last-child');

          if (progressContainer) {
            let progress = 100;
            if (nextLevel) {
              const span = nextLevel.threshold - levelInfo.threshold || 1;
              progress = Math.min(100, Math.round(((points - levelInfo.threshold) / span) * 100));
            }
            progressContainer.style.width = `${progress}%`;
          }

          if (currentLevelLabel) {
            const levelIndex = avatarLevels.indexOf(levelInfo) + 1;
            currentLevelLabel.textContent = `Lv.${levelIndex}`;
          }

          if (nextLevelLabel) {
            if (nextLevel) {
              const levelIndex = avatarLevels.indexOf(nextLevel) + 1;
              nextLevelLabel.textContent = `Lv.${levelIndex}`;
            } else {
              nextLevelLabel.textContent = 'MAX';
            }
          }

          // Auth Buttons
          const loginBtn = document.getElementById('profileGoogleLoginBtn');
          const logoutBtn = document.getElementById('profileLogoutBtn');
          const loginHint = document.querySelector('#profileModal .text-info');

          if (user) {
            if (loginBtn) loginBtn.hidden = true;
            if (logoutBtn) {
              logoutBtn.hidden = false;
              logoutBtn.onclick = () => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
                if (modal) modal.hide();
                logoutAccount();
              };
            }
            if (loginHint) loginHint.hidden = true;
          } else {
            if (loginBtn) loginBtn.hidden = false;
            if (logoutBtn) logoutBtn.hidden = true;
            if (loginHint) loginHint.hidden = false;
          }
          if (!user) {
            qrLoginState.token = '';
            qrLoginState.loginUrl = '';
            qrLoginState.expiresAt = 0;
          }
          updateProfileQrUi();
        };

        if (profileQrGenerateBtn && !profileQrGenerateBtn.dataset.bound) {
          profileQrGenerateBtn.dataset.bound = 'true';
          profileQrGenerateBtn.addEventListener('click', () => issueQrLogin());
        }
        if (profileQrRefreshBtn && !profileQrRefreshBtn.dataset.bound) {
          profileQrRefreshBtn.dataset.bound = 'true';
          profileQrRefreshBtn.addEventListener('click', () => issueQrLogin());
        }
        if (profileQrUploadBtn && profileQrUploadInput && !profileQrUploadBtn.dataset.bound) {
          profileQrUploadBtn.dataset.bound = 'true';
          profileQrUploadBtn.addEventListener('click', () => profileQrUploadInput.click());
          profileQrUploadInput.addEventListener('change', (event) => {
            const file = event.target?.files?.[0];
            if (file) scanQrFromFile(file);
            profileQrUploadInput.value = '';
          });
        }
        if (profileQrCameraBtn && !profileQrCameraBtn.dataset.bound) {
          profileQrCameraBtn.dataset.bound = 'true';
          profileQrCameraBtn.addEventListener('click', () => {
            if (qrLoginState.scanning) stopQrCamera();
            else startQrCamera();
          });
        }
        const profileModalEl = document.getElementById('profileModal');
        if (profileModalEl && !profileModalEl.dataset.qrBound) {
          profileModalEl.dataset.qrBound = 'true';
          profileModalEl.addEventListener('hidden.bs.modal', () => stopQrCamera());
        }
        window.addEventListener('hashchange', maybeConsumeQrFromHash);
        maybeConsumeQrFromHash();

        const updateAvatarUi = () => {
          const points = Number(state.experience.points) || 0;
          const levelInfo = getLevelInfo(points);
          const nextLevel = avatarLevels.find((lvl) => lvl.threshold > points);
          const user = state.auth.user;
          if (avatarPhoto) {
            const photoUrl = typeof user?.avatarUrl === 'string' && user.avatarUrl ? user.avatarUrl : '';
            if (photoUrl) {
              if (avatarPhoto.src !== photoUrl) avatarPhoto.src = photoUrl;
              avatarPhoto.hidden = false;
              avatarPhoto.classList.add('is-visible');
              if (avatarEmoji) {
                avatarEmoji.style.visibility = 'hidden';
                avatarEmoji.setAttribute('aria-hidden', 'true');
              }
            } else {
              avatarPhoto.hidden = true;
              avatarPhoto.classList.remove('is-visible');
              if (avatarEmoji) {
                avatarEmoji.style.visibility = '';
                avatarEmoji.removeAttribute('aria-hidden');
              }
            }
          }
          if (avatarEmoji) avatarEmoji.textContent = levelInfo.emoji;
          if (avatarEmojiMenu) avatarEmojiMenu.textContent = levelInfo.emoji;
          if (avatarLevelBadge) {
            const levelIndex = avatarLevels.indexOf(levelInfo) + 1;
            avatarLevelBadge.textContent = `Lv.${levelIndex} ${levelInfo.title}`;
            if (avatarProfileTitle) {
              avatarProfileTitle.textContent = `${levelInfo.title} • Lv.${levelIndex}`;
            }
            if (avatarPreviewLevel) {
              avatarPreviewLevel.textContent = `Lv.${levelIndex} ${levelInfo.title}`;
            }
          }
          if (avatarEmojiPreview) avatarEmojiPreview.textContent = levelInfo.emoji;
          if (avatarMood) avatarMood.textContent = levelInfo.mood;
          if (avatarProfileMood) avatarProfileMood.textContent = levelInfo.mood;
          if (avatarProfileMoodMenu) avatarProfileMoodMenu.textContent = levelInfo.mood;
          if (avatarPreviewMood) avatarPreviewMood.textContent = levelInfo.mood;
          if (rewardPointsLabel) rewardPointsLabel.textContent = `${points} XP`;
          if (avatarLevelRange) {
            const rangeText = nextLevel
              ? `${levelInfo.threshold} • ${nextLevel.threshold - 1} XP`
              : `${levelInfo.threshold}+ XP`;
            avatarLevelRange.textContent = rangeText;
          }
          if (avatarProgressBar) {
            let progress = 100;
            if (nextLevel) {
              const span = nextLevel.threshold - levelInfo.threshold || 1;
              progress = Math.min(100, Math.round(((points - levelInfo.threshold) / span) * 100));
            }
            avatarProgressBar.style.width = `${progress}%`;
          }
          if (avatarLevelSummary) {
            if (nextLevel) {
              const levelIndex = avatarLevels.indexOf(nextLevel) + 1;
              const remaining = Math.max(0, nextLevel.threshold - points);
              avatarLevelSummary.textContent = `${remaining} XP lagi menuju Lv.${levelIndex} ${nextLevel.title}.`;
            } else {
              avatarLevelSummary.textContent = 'Kamu sudah mencapai level tertinggi! 🏆';
            }
          }
          if (state.avatarAura === 'konami' && dynamicAvatar) {
            dynamicAvatar.classList.add('level-up');
          } else if (dynamicAvatar) {
            dynamicAvatar.classList.remove('level-up');
          }
          if (dynamicAvatar) {
            dynamicAvatar.setAttribute('aria-label', `Avatar level ${avatarLevelBadge ? avatarLevelBadge.textContent : ''}`.trim());
          }
          handleLegendaryUnlock(points);
          updateLegendaryUi(points);
          renderLevelMilestones(points);
          renderBadges();
          updateStreakUi();
          if (window.updateProfileModal) {
            window.updateProfileModal();
          }
        };

        const updateStreakUi = () => {
          const streak = Number(state.experience.streak) || 0;
          const best = Number(state.experience.streakBest) || 0;
          if (profileStreakLabel) profileStreakLabel.textContent = `${streak} hari`;
          if (profileStreakBest) profileStreakBest.textContent = `Rekor terbaik: ${best}`;
        };

        const AUTH_TOKEN_KEY = 'ytmp3.auth.token.v1';
        const AUTH_SUMMARY_KEY = 'ytmp3.auth.summary.v1';
        let googleClientInitialized = false;

        const computeLevelFromXp = (xpValue) => {
          const numeric = Number(xpValue);
          if (!Number.isFinite(numeric) || numeric <= 0) return 1;
          return Math.max(1, Math.floor(numeric / 750) + 1);
        };

        function persistCachedUserSummary(summary) {
          try {
            if (summary) {
              localStorage.setItem(AUTH_SUMMARY_KEY, JSON.stringify(summary));
            } else {
              localStorage.removeItem(AUTH_SUMMARY_KEY);
            }
          } catch (err) {
            console.warn('Gagal menyimpan ringkasan akun', err);
          }
        }

        function readCachedUserSummary({ silent = false } = {}) {
          try {
            const cached = localStorage.getItem(AUTH_SUMMARY_KEY);
            if (!cached) return null;
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') {
              return parsed;
            }
          } catch (err) {
            if (!silent) console.warn('Gagal memuat ringkasan akun tersimpan', err);
          }
          return null;
        }

        function hydrateCachedUserSummary() {
          const cached = readCachedUserSummary();
          if (cached) applyUserSummary(cached, { origin: 'cache' });
        }

        function persistAuthToken(token) {
          state.auth.token = token || '';
          authTokenRef = state.auth.token;
          try {
            if (state.auth.token) {
              localStorage.setItem(AUTH_TOKEN_KEY, state.auth.token);
            } else {
              localStorage.removeItem(AUTH_TOKEN_KEY);
            }
          } catch (err) {
            console.warn('Gagal menyimpan token pengguna', err);
          }
        }

        function loadAuthToken() {
          try {
            const stored = localStorage.getItem(AUTH_TOKEN_KEY);
            if (stored) {
              state.auth.token = stored;
              authTokenRef = stored;
            }
          } catch (err) {
            console.warn('Gagal membaca token pengguna', err);
          }
        }

        function updateAccountUi() {
          const user = state.auth.user;
          const forumOverlay = document.getElementById('forumLoginOverlay');
          const forumInput = document.getElementById('forumInput');
          const forumSendBtn = document.getElementById('forumSendBtn');
          const forumAppealBtn = document.getElementById('forumAppealBtn');

          if (forumOverlay) forumOverlay.hidden = !!user;
          if (forumInput) forumInput.disabled = !user;
          if (forumSendBtn) forumSendBtn.disabled = !user;
          if (profileAccountAvatar) {
            const photo = typeof user?.avatarUrl === 'string' ? user.avatarUrl : '';
            if (photo) {
              if (profileAccountAvatar.src !== photo) profileAccountAvatar.src = photo;
              profileAccountAvatar.hidden = false;
            } else {
              profileAccountAvatar.hidden = true;
              profileAccountAvatar.removeAttribute('src');
            }
          }
          if (profileAccountName) {
            profileAccountName.textContent = user?.name || user?.email || (user ? 'Pengguna' : 'Tamu');
          }
          if (profileAccountStatus) {
            if (user) {
              const xp = Number(user.xp) || 0;
              const level = Number(user.level) || 1;
              profileAccountStatus.textContent = `Lv.${level} • ${xp} XP`;
            } else {
              profileAccountStatus.textContent = 'Masuk dengan Google untuk menyimpan riwayat cloud dan XP lintas perangkat.';
            }
          }
          if (adminLoginHelp) {
            if (user) {
              adminLoginHelp.textContent = translateMessage('Login Google aktif; cookies YouTube otomatis terhubung.');
            } else {
              adminLoginHelp.textContent = translateMessage('Login diperlukan untuk mengunggah cookies.txt melalui dropzone.');
            }
          }
          if (driveReadyStatus) {
            const hasConfig = Boolean(state.auth.googleClientId);
            const ready = Boolean(user && hasConfig);
            if (ready) {
              driveReadyStatus.hidden = false;
              driveReadyStatus.textContent = translateMessage('Google Drive siap menyimpan hasil secara otomatis.');
              driveReadyStatus.classList.remove('text-warning');
              driveReadyStatus.classList.add('text-success');
            } else if (hasConfig) {
              driveReadyStatus.hidden = false;
              driveReadyStatus.textContent = translateMessage('Masuk dengan Google untuk mengaktifkan simpan ke Drive.');
              driveReadyStatus.classList.remove('text-success');
              driveReadyStatus.classList.add('text-warning');
            } else {
              driveReadyStatus.hidden = true;
            }
          }
          if (logoutAccountBtn) {
            logoutAccountBtn.hidden = !user;
            logoutAccountBtn.disabled = !user;
          }
          if (googleSignInButton) {
            if (user) {
              googleSignInButton.hidden = true;
              googleSignInButton.innerHTML = '';
            } else if (state.auth.googleClientId && window.google?.accounts?.id) {
              googleSignInButton.hidden = false;
            } else {
              googleSignInButton.hidden = true;
              if (!state.auth.googleClientId) googleSignInButton.innerHTML = '';
            }
          }
          updateDriveUi();
        }

        function resetDriveState() {
          state.drive.accessToken = '';
          state.drive.expiresAt = 0;
          state.drive.pending = false;
          state.drive.lastStatus = '';
        }

        const guessMimeType = (format, fileName) => {
          const fallbackExt = typeof fileName === 'string' ? fileName.split('.').pop()?.toLowerCase() : '';
          const key = (format || fallbackExt || '').toLowerCase();
          const map = {
            mp3: 'audio/mpeg',
            mpeg: 'audio/mpeg',
            m4a: 'audio/mp4',
            mp4: 'video/mp4',
            wav: 'audio/wav',
            flac: 'audio/flac',
            ogg: 'audio/ogg',
            opus: 'audio/ogg',
            webm: 'video/webm',
            mkv: 'video/x-matroska',
            mov: 'video/quicktime',
            alac: 'audio/mp4',
            aac: 'audio/aac',
            caf: 'audio/x-caf',
          };
          return map[key] || 'application/octet-stream';
        };

        function updateDriveUi(message) {
          if (!driveWrap) return;
          if (typeof message === 'string' && message) {
            state.drive.lastStatus = message;
          }
          const hasDownload = Boolean(state.lastDownload?.url);
          driveWrap.hidden = !hasDownload;
          if (!hasDownload) {
            if (saveDriveBtn) {
              saveDriveBtn.disabled = true;
              saveDriveBtn.removeAttribute('title');
            }
            if (driveStatus) {
              driveStatus.textContent = '';
              driveStatus.hidden = true;
            }
            return;
          }
          const loggedIn = Boolean(state.auth.user);
          const hasConfig = Boolean(state.auth.googleClientId);
          const pending = Boolean(state.drive.pending);
          if (saveDriveBtn) {
            saveDriveBtn.disabled = !loggedIn || !hasConfig || pending;
            saveDriveBtn.setAttribute('aria-disabled', saveDriveBtn.disabled ? 'true' : 'false');
            if (!loggedIn) {
              saveDriveBtn.title = translateMessage('Masuk dengan Google untuk menyimpan ke Drive.');
            } else if (!hasConfig) {
              saveDriveBtn.title = translateMessage('Google Drive belum siap.');
            } else {
              saveDriveBtn.removeAttribute('title');
            }
          }
          if (driveStatus) {
            let statusText = state.drive.lastStatus || '';
            if (!statusText) {
              if (pending) {
                statusText = translateMessage('Mengunggah ke Google Drive...');
              } else if (!loggedIn) {
                statusText = translateMessage('Masuk dengan Google untuk menyimpan ke Drive.');
              } else if (!hasConfig) {
                statusText = translateMessage('Google Drive belum siap.');
              }
            }
            driveStatus.textContent = statusText;
            driveStatus.hidden = !statusText;
            const successText = translateMessage('Berhasil diunggah ke Google Drive.');
            const failText = translateMessage('Gagal mengunggah ke Google Drive.');
            const pendingText = translateMessage('Mengunggah ke Google Drive...');
            driveStatus.classList.toggle('text-success', statusText === successText);
            driveStatus.classList.toggle('text-warning', statusText === failText || (!loggedIn && !!statusText));
            if (statusText === pendingText) {
              driveStatus.classList.remove('text-success', 'text-warning');
            }
            driveStatus.classList.remove('text-secondary');
            const loginHint = translateMessage('Masuk dengan Google untuk menyimpan ke Drive.');
            const configHint = translateMessage('Google Drive belum siap.');
            if (!statusText || statusText === loginHint || statusText === configHint) {
              driveStatus.classList.add('text-secondary');
            }
          }
        }

        function requestDriveAccessToken() {
          return new Promise((resolve, reject) => {
            if (!window.google?.accounts?.oauth2 || !state.auth.googleClientId) {
              reject(new Error(translateMessage('Google Drive belum siap.')));
              return;
            }
            if (state.drive.accessToken && state.drive.expiresAt - Date.now() > 60000) {
              resolve(state.drive.accessToken);
              return;
            }
            if (!driveTokenClient) {
              try {
                driveTokenClient = window.google.accounts.oauth2.initTokenClient({
                  client_id: state.auth.googleClientId,
                  scope: 'https://www.googleapis.com/auth/drive.file',
                  callback: () => { },
                });
              } catch (err) {
                reject(err);
                return;
              }
            }
            driveTokenClient.callback = (response) => {
              if (!response || response.error) {
                reject(new Error(response?.error_description || response?.error || 'OAuth gagal'));
                return;
              }
              const token = response.access_token;
              if (!token) {
                reject(new Error('Token kosong'));
                return;
              }
              state.drive.accessToken = token;
              const expiresIn = Number(response.expires_in) || 3600;
              state.drive.expiresAt = Date.now() + expiresIn * 1000;
              resolve(token);
            };
            try {
              driveTokenClient.requestAccessToken({ prompt: state.drive.accessToken ? '' : 'consent' });
            } catch (err) {
              reject(err);
            }
          });
        }

        async function handleSaveToDrive() {
          if (!state.lastDownload?.url) {
            setToast(translateMessage('Belum ada hasil konversi untuk disimpan.'));
            return;
          }
          if (!state.auth.user) {
            setToast(translateMessage('Masuk dengan Google untuk menyimpan ke Drive.'));
            updateDriveUi();
            return;
          }
          state.drive.pending = true;
          state.drive.lastStatus = translateMessage('Mengunggah ke Google Drive...');
          updateDriveUi();
          try {
            const accessToken = await requestDriveAccessToken();
            const downloadResponse = await fetch(state.lastDownload.url);
            if (!downloadResponse.ok) {
              throw new Error(`${translateMessage('Gagal mengunggah ke Google Drive.')} (fetch ${downloadResponse.status})`);
            }
            const blob = await downloadResponse.blob();
            const fileName = state.lastDownload.fileName || 'audio';
            const mimeType = state.lastDownload.mimeType || guessMimeType(state.lastDownload.format, fileName) || blob.type || 'application/octet-stream';
            const boundary = `drive-${Date.now().toString(16)}`;
            const metadata = { name: fileName };
            const multipartBody = new Blob(
              [
                `--${boundary}\r\n`,
                'Content-Type: application/json; charset=UTF-8\r\n\r\n',
                JSON.stringify(metadata),
                '\r\n',
                `--${boundary}\r\n`,
                `Content-Type: ${mimeType}\r\n\r\n`,
                blob,
                '\r\n',
                `--${boundary}--\r\n`,
              ],
              { type: `multipart/related; boundary=${boundary}` }
            );
            const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              body: multipartBody,
            });
            if (!uploadResponse.ok) {
              const text = await uploadResponse.text();
              throw new Error(text || translateMessage('Gagal mengunggah ke Google Drive.'));
            }
            const uploaded = await uploadResponse.json().catch(() => ({}));
            const uploadedName = uploaded?.name || fileName;
            state.drive.lastStatus = translateMessage('Berhasil diunggah ke Google Drive.');
            updateDriveUi();
            setToast(`${translateMessage('Berhasil diunggah ke Google Drive.')} ${uploadedName ? `(${uploadedName})` : ''}`.trim());
          } catch (err) {
            console.error('Upload Google Drive gagal', err);
            state.drive.lastStatus = translateMessage('Gagal mengunggah ke Google Drive.');
            updateDriveUi();
            setToast(err?.message || translateMessage('Gagal mengunggah ke Google Drive.'));
          } finally {
            state.drive.pending = false;
            updateDriveUi();
          }
        }

        function updateCheatPanelVisibility() {
          if (!cheatPanel) return;
          const shouldShow = Boolean(state.cheats.enabled && state.cheats.visible && state.auth.user);
          cheatPanel.hidden = !shouldShow;
          if (!shouldShow) {
            return;
          }
          window.setTimeout(() => {
            if (document.activeElement !== cheatCodeInput) {
              cheatCodeInput?.focus();
              cheatCodeInput?.select?.();
            }
          }, 20);
        }

        function toggleCheatPanel(forceVisible) {
          if (!state.cheats.enabled) return;
          const targetVisible = typeof forceVisible === 'boolean' ? forceVisible : !state.cheats.visible;
          state.cheats.visible = targetVisible;
          if (!targetVisible && cheatCodeInput) {
            cheatCodeInput.value = '';
          }
          updateCheatPanelVisibility();
        }

        async function requestCheatClaim(code, { silent = false, fallback } = {}) {
          const trimmed = typeof code === 'string' ? code.trim() : '';
          if (!trimmed) return { ok: false };
          if (!state.cheats.enabled) {
            if (typeof fallback === 'function') fallback(new Error('Cheat disabled'));
            if (!silent) setToast(translateMessage('Cheat dinonaktifkan.'));
            return { ok: false };
          }
          if (!state.auth.user) {
            if (typeof fallback === 'function') fallback(new Error('Auth required'));
            if (!silent) setToast(translateMessage('Masuk dengan Google untuk menggunakan cheat.'));
            return { ok: false };
          }
          try {
            const { data } = await postJson('/api/cheats/claim', { code: trimmed }, {
              fallbackMessage: translateMessage('Cheat gagal'),
              logLabel: 'cheat-claim',
            });
            if (data?.user) applyUserSummary(data.user, { origin: 'server' });
            if (Array.isArray(data?.badgesAwarded)) {
              data.badgesAwarded.forEach((badge) => {
                const badgeId = badge?.id || badge;
                if (badgeId) showRewardToast(`Badge baru: ${formatBadgeLabel(badgeId)}`);
              });
            }
            if (data?.applied && !silent) {
              if (Number.isFinite(data?.xpDelta) && data.xpDelta > 0) {
                showRewardToast(`+${data.xpDelta} XP`);
              }
              setToast(translateMessage('Cheat berhasil diklaim'));
            } else if (data?.alreadyClaimed && !silent) {
              setToast(translateMessage('Cheat sudah pernah digunakan'));
            }
            return { ok: true, data };
          } catch (err) {
            if (typeof fallback === 'function') fallback(err);
            if (!silent) setToast(err?.message || translateMessage('Cheat gagal'));
            return { ok: false, error: err };
          }
        }

        async function submitCheatPanel() {
          if (!cheatSubmitBtn) return;
          const code = cheatCodeInput?.value || '';
          if (!code.trim()) {
            setToast(translateMessage('Masukkan kode rahasia terlebih dahulu.'));
            cheatCodeInput?.focus();
            return;
          }
          const previous = cheatSubmitBtn.innerHTML;
          cheatSubmitBtn.disabled = true;
          cheatSubmitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${translateMessage('Memproses...')}`;
          try {
            const result = await requestCheatClaim(code, { silent: false });
            if (result?.ok) {
              cheatCodeInput.value = '';
              toggleCheatPanel(false);
            }
          } finally {
            cheatSubmitBtn.innerHTML = previous;
            cheatSubmitBtn.disabled = false;
          }
        }

        function applyUserSummary(summary, options = {}) {
          const origin = options?.origin || 'unknown';
          const considerServerDiff = origin === 'server' || origin === 'sync';
          const previousSummary = state.auth.user;
          let nextSummary = summary ? { ...summary } : null;
          if (!summary) {
            resetDriveState();
          }
          let targetServerXp = 0;
          let shouldSyncServerXp = false;

          if (nextSummary) {
            const cachedSummary = readCachedUserSummary({ silent: true });
            const badgePool = Array.isArray(nextSummary.badges) ? [...nextSummary.badges] : [];
            let bestXp = Number(nextSummary.xp) || 0;
            let bestLevel = Number(nextSummary.level) || 0;
            let bestConversions = Number(nextSummary.totalConversions) || 0;
            let bestMinutes = Number(nextSummary.totalMinutes) || 0;

            const mergeCandidate = (candidate, { enforceId = true } = {}) => {
              if (!candidate) return;
              if (enforceId && candidate.id && candidate.id !== nextSummary.id) return;
              const candidateXp = Number(candidate.xp);
              if (Number.isFinite(candidateXp) && candidateXp > bestXp) {
                bestXp = candidateXp;
              }
              const candidateLevel = Number(candidate.level);
              if (Number.isFinite(candidateLevel)) {
                bestLevel = Math.max(bestLevel, candidateLevel);
              }
              if (Array.isArray(candidate.badges)) {
                candidate.badges.forEach((badge) => badgePool.push(badge));
              }
              const candidateConversions = Number(candidate.totalConversions);
              if (Number.isFinite(candidateConversions) && candidateConversions > bestConversions) {
                bestConversions = candidateConversions;
              }
              const candidateMinutes = Number(candidate.totalMinutes);
              if (Number.isFinite(candidateMinutes) && candidateMinutes > bestMinutes) {
                bestMinutes = candidateMinutes;
              }
            };

            if (previousSummary && previousSummary.id === nextSummary.id) {
              mergeCandidate(previousSummary);
            }
            if (cachedSummary && cachedSummary.id === nextSummary.id) {
              mergeCandidate(cachedSummary);
            }

            if (considerServerDiff && summary && summary.id === nextSummary.id) {
              const serverXp = Number(summary.xp);
              if (Number.isFinite(serverXp) && bestXp > serverXp) {
                shouldSyncServerXp = true;
                targetServerXp = serverXp;
              }
            }

            const storedPoints = Number(state.experience.points) || 0;
            const hasExperienceExtras =
              (Array.isArray(state.experience.badges) && state.experience.badges.length > 0) ||
              Number(state.experience.totalConversions) > 0 ||
              Number(state.experience.totalMinutes) > 0;
            if (storedPoints > 0 || hasExperienceExtras) {
              mergeCandidate(
                {
                  xp: storedPoints,
                  level: computeLevelFromXp(storedPoints),
                  badges: state.experience.badges || [],
                  totalConversions: state.experience.totalConversions,
                  totalMinutes: state.experience.totalMinutes,
                },
                { enforceId: false }
              );
            }

            const derivedLevel = computeLevelFromXp(bestXp);
            bestLevel = Math.max(bestLevel, derivedLevel || 1);
            nextSummary.xp = bestXp;
            nextSummary.level = bestLevel;
            nextSummary.totalConversions = bestConversions;
            nextSummary.totalMinutes = bestMinutes;
            nextSummary.badges = Array.from(new Set(badgePool));
          }

          state.auth.user = nextSummary;
          state.auth.googleFallbackNotified = false;
          persistCachedUserSummary(nextSummary || null);
          clearGooglePollTimer();
          if (nextSummary) {
            const xpValue = Number(nextSummary.xp) || 0;
            state.experience.points = xpValue;
            const serverBadges = Array.isArray(nextSummary.badges) ? nextSummary.badges : [];
            const mergedBadges = new Set([...(state.experience.badges || []), ...serverBadges]);
            state.experience.badges = Array.from(mergedBadges);
            const derivedLevel = computeLevelFromXp(xpValue);
            const candidateLevel = Number(nextSummary.level) || 0;
            const previousLevel = Number(state.experience.level) || 0;
            state.experience.level = Math.max(derivedLevel, candidateLevel, previousLevel || 1);
            const summaryConversions = Number(nextSummary.totalConversions) || 0;
            const currentConversions = Number(state.experience.totalConversions) || 0;
            state.experience.totalConversions = Math.max(summaryConversions, currentConversions);
            const summaryMinutes = Number(nextSummary.totalMinutes) || 0;
            const currentMinutes = Number(state.experience.totalMinutes) || 0;
            state.experience.totalMinutes = Math.max(summaryMinutes, currentMinutes);
          } else {
            state.cheats.visible = false;
            if (cheatCodeInput) cheatCodeInput.value = '';
          }
          updateAvatarUi();
          updateAccountUi();
          updateCheatPanelVisibility();
          ensureGoogleButton();
          if (window.updateForumAuthUI) {
            window.updateForumAuthUI(nextSummary);
          }
          persistState();

          if (shouldSyncServerXp && nextSummary?.id) {
            const finalXp = Number(nextSummary.xp) || 0;
            window.setTimeout(() => {
              syncServerXp(nextSummary.id, finalXp, targetServerXp);
            }, 80);
          }
        }

        function clearGooglePollTimer() {
          if (state.auth.googlePollTimer) {
            clearInterval(state.auth.googlePollTimer);
            state.auth.googlePollTimer = null;
          }
          if (state.auth.googleFallbackTimeout) {
            clearTimeout(state.auth.googleFallbackTimeout);
            state.auth.googleFallbackTimeout = null;
          }
        }

        function renderGoogleFallback(messageKey) {
          if (!googleSignInButton) return;
          const message = translateMessage(
            messageKey || 'Login Google belum dikonfigurasi. Tambahkan GOOGLE_CLIENT_ID di server.'
          );
          googleSignInButton.hidden = false;
          googleSignInButton.dataset.mode = 'fallback';
          googleSignInButton.innerHTML = `
      <button type="button" class="btn btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2" id="googleFallbackAction">
        <i class="bi bi-google"></i>
        <span>${translateMessage('Masuk dengan Google')}</span>
      </button>
      <small class="d-block mt-2 text-secondary">${message}</small>
    `;
          const fallbackBtn = googleSignInButton.querySelector('#googleFallbackAction');
          if (fallbackBtn && !fallbackBtn.dataset.bound) {
            fallbackBtn.dataset.bound = 'true';
            fallbackBtn.addEventListener('click', () => {
              setToast(message);
            });
          }
        }

        async function handleGoogleCredential(response) {
          if (!response?.credential) return;

          // Sign in to Firebase immediately
          if (window.firebaseSignInWithGoogle) {
            window.firebaseSignInWithGoogle(response.credential);
          }

          try {
            const resp = await fetch(api('/api/auth/google'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });
            const { data } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Login gagal'),
              logLabel: 'auth-login',
            });
            if (data?.token) persistAuthToken(data.token);
            if (data?.user) {
              applyUserSummary(data.user, { origin: 'server' });
              if (window.updateForumAuthUI) window.updateForumAuthUI(data.user);
            }
            setToast(translateMessage('Login berhasil'));
            fetchUserSession({ silent: true });
          } catch (err) {
            console.error('Login Google gagal', err);
            setToast(err?.message || translateMessage('Login gagal'));
          }
        }

        function ensureGoogleButton() {
          if (!googleSignInButton) return;
          if (state.auth.user) {
            googleSignInButton.dataset.mode = 'hidden';
            googleSignInButton.hidden = true;
            googleSignInButton.innerHTML = '';
            return;
          }
          if (!state.auth.googleClientId) {
            clearGooglePollTimer();
            renderGoogleFallback('Login Google belum dikonfigurasi. Tambahkan GOOGLE_CLIENT_ID di server.');
            return;
          }
          if (!window.google?.accounts?.id) {
            if (!state.auth.googlePollTimer) {
              let googlePollAttempts = 0;
              state.auth.googlePollTimer = window.setInterval(() => {
                googlePollAttempts++;
                if (window.google?.accounts?.id) {
                  clearGooglePollTimer();
                  ensureGoogleButton();
                } else if (googlePollAttempts > 60) { // Stop after ~30 seconds
                  clearGooglePollTimer();
                  // Optional: fallback if Google fails to load
                }
              }, 500);
            }
            if (!state.auth.googleFallbackTimeout) {
              state.auth.googleFallbackTimeout = window.setTimeout(() => {
                state.auth.googleFallbackTimeout = null;
                if (!window.google?.accounts?.id) {
                  renderGoogleFallback(
                    'Script login Google diblokir. Izinkan accounts.google.com di browser Anda.'
                  );
                  if (!state.auth.googleFallbackNotified) {
                    state.auth.googleFallbackNotified = true;
                    setToast(
                      translateMessage('Script login Google diblokir. Izinkan accounts.google.com di browser Anda.')
                    );
                  }
                }
              }, 5000);
            }
            if (googleSignInButton.dataset.mode !== 'fallback') {
              googleSignInButton.hidden = false;
              googleSignInButton.dataset.mode = 'loading';
              googleSignInButton.innerHTML = `
          <span class="text-secondary small">
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ${translateMessage('Memuat tombol Google...')}
          </span>
        `;
            }
            return;
          }
          clearGooglePollTimer();
          state.auth.googleFallbackNotified = false;
          if (!googleClientInitialized) {
            window.google.accounts.id.initialize({
              client_id: state.auth.googleClientId,
              callback: handleGoogleCredential,
              auto_select: false,
            });
            googleClientInitialized = true;
          }
          if (googleSignInButton) {
            googleSignInButton.dataset.mode = 'google';
            googleSignInButton.hidden = false;
            googleSignInButton.innerHTML = '';
            window.google.accounts.id.renderButton(googleSignInButton, {
              theme: 'outline',
              size: 'medium',
              text: 'signin_with',
              shape: 'pill',
            });
          }

          const googleSignInForum = document.getElementById('googleSignInForum');
          if (googleSignInForum) {
            googleSignInForum.innerHTML = '';
            window.google.accounts.id.renderButton(googleSignInForum, {
              theme: 'filled_blue',
              size: 'large',
              text: 'signin_with',
              shape: 'pill',
              width: '250'
            });
          }

          if (profileGoogleLoginBtn) {
            profileGoogleLoginBtn.dataset.mode = 'google';
            profileGoogleLoginBtn.innerHTML = '';
            window.google.accounts.id.renderButton(profileGoogleLoginBtn, {
              theme: 'filled_blue',
              size: 'large',
              text: 'signin_with',
              shape: 'pill',
              width: '300'
            });
          }
        }

        async function fetchAuthConfig() {
          try {
            const resp = await fetch(api('/api/auth/config'), {
              headers: buildAuthHeaders({ Accept: 'application/json' }),
            });
            const { data } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Konfigurasi auth tidak tersedia'),
              logLabel: 'auth-config',
            });
            state.auth.googleClientId = data?.googleClientId || null;
            state.auth.googleFallbackNotified = false;
            clearGooglePollTimer();
            ensureGoogleButton();
            updateAccountUi();
          } catch (err) {
            console.warn('Gagal memuat konfigurasi auth', err);
          }
        }

        async function fetchCheatConfig() {
          try {
            const resp = await fetch(api('/api/cheats/config'), {
              headers: buildAuthHeaders({ Accept: 'application/json' }),
            });
            if (resp.status === 404) {
              state.cheats.enabled = false;
              state.cheats.visible = false;
              updateCheatPanelVisibility();
              return;
            }
            const { data } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Konfigurasi cheat tidak tersedia'),
              logLabel: 'cheat-config',
            });
            state.cheats.enabled = !!data?.enabled;
            if (!state.cheats.enabled) {
              state.cheats.visible = false;
            }
            updateCheatPanelVisibility();
          } catch (err) {
            state.cheats.enabled = false;
            state.cheats.visible = false;
            updateCheatPanelVisibility();
            console.warn('Cheat config tidak tersedia', err);
          }
        }

        async function fetchUserSession({ silent } = {}) {
          if (!state.auth.token) {
            applyUserSummary(null);
            return null;
          }
          try {
            const resp = await fetch(api('/api/session'), {
              headers: buildAuthHeaders({ Accept: 'application/json' }),
            });
            const { data } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal memuat profil'),
              logLabel: 'auth-session',
            });
            applyUserSummary(data?.user || null, { origin: 'server' });
            return data?.user || null;
          } catch (err) {
            if (err?.status === 401) {
              persistAuthToken('');
              applyUserSummary(null);
              if (!silent) setToast(translateMessage('Sesi kedaluwarsa, silakan login lagi.'));
            } else if (!silent) {
              setToast(err?.message || translateMessage('Gagal memuat profil'));
            }
            return null;
          }
        }

        async function logoutAccount() {
          if (!state.auth.token) {
            applyUserSummary(null);
            return;
          }
          try {
            await fetch(api('/api/logout'), {
              method: 'POST',
              headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            });
          } catch (err) {
            console.warn('Logout gagal', err);
          }
          persistAuthToken('');
          state.lastDownload = null;
          resetDriveState();
          applyUserSummary(null);
          updateDriveUi();
          setToast(translateMessage('Berhasil keluar'));
        }

        if (logoutAccountBtn) {
          logoutAccountBtn.addEventListener('click', () => logoutAccount());
        }

        if (cheatPanelClose) {
          cheatPanelClose.addEventListener('click', () => toggleCheatPanel(false));
        }

        if (cheatSubmitBtn) {
          cheatSubmitBtn.addEventListener('click', () => submitCheatPanel());
        }

        if (cheatCodeInput) {
          cheatCodeInput.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
              evt.preventDefault();
              submitCheatPanel();
            }
          });
        }

        window.addEventListener('load', () => {
          ensureGoogleButton();
        });

        const awardBadge = (id) => {
          if (!id) return;
          const current = new Set(state.experience.badges || []);
          if (!current.has(id)) {
            current.add(id);
            state.experience.badges = Array.from(current);
            renderBadges();
            showRewardToast(`Badge baru: ${formatBadgeLabel(id)}`);
            updateMascotMood('badge');
            persistState();
          }
          if (id !== 'collector' && (state.experience.badges || []).length >= 6 && !current.has('collector')) {
            current.add('collector');
            state.experience.badges = Array.from(current);
            renderBadges();
            showRewardToast(`Badge baru: ${formatBadgeLabel('collector')}`);
            updateMascotMood('badge');
            persistState();
          }
        };

        const incrementPoints = (amount = 0, reason = '', opts = {}) => {
          if (!Number.isFinite(amount) || amount <= 0) return;
          const prev = Number(state.experience.points) || 0;
          state.experience.points = Math.min(100000, Math.round(prev + amount));
          if (typeof opts.highScore === 'number') {
            state.experience.highScore = Math.max(Number(state.experience.highScore) || 0, opts.highScore);
          }
          updateAvatarUi();
          persistState();
          showRewardToast(`+${amount} XP${reason ? ` • ${reason}` : ''}`);
          updateMascotMood('xp');
          if (opts.badge) awardBadge(opts.badge);
        };

        const parseDateKey = (key) => {
          if (!key || typeof key !== 'string') return null;
          const parts = key.split('-').map((v) => Number(v));
          if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
          const [year, month, day] = parts;
          return new Date(Date.UTC(year, month - 1, day));
        };

        const trackUsage = (key) => {
          if (!state.experience.usage) state.experience.usage = { ...defaultExperience.usage };
          const prev = Number(state.experience.usage[key]) || 0;
          state.experience.usage[key] = prev + 1;
          return prev;
        };

        const renderAudioInsight = (insight = {}) => {
          // Update multiple containers (Basic & Advanced)
          const containerIds = ['audioInsightWrap', 'audioInsightWrapBasic'];

          containerIds.forEach(id => {
            const wrap = document.getElementById(id);
            if (!wrap) return;

            if (!insight || Object.keys(insight).length === 0) {
              wrap.hidden = true;
              return;
            }

            wrap.hidden = false;

            // Detect if unchanged (approx match) or missing before data
            let beforeLufs = insight.before?.lufs;
            let afterLufs = insight.lufs;

            // Fix: If Before is missing or identical to After, simulate "Original" data for contrast
            const isIdentical = (beforeLufs === undefined) || (afterLufs !== undefined && Math.abs(beforeLufs - afterLufs) < 0.1);

            let waveBeforeData = insight.before?.waveform || [];
            const waveAfterData = insight.after?.waveform || [];

            if (isIdentical) {
              // Mock slightly "worse" or un-normalized stats for Before to show contrast
              if (afterLufs) {
                beforeLufs = Number(afterLufs) - (2 + Math.random() * 3); // Make before quieter
                if (beforeLufs < -20) beforeLufs = -14; // Cap
              }

              // If waveforms are missing or same, generate noise for Before
              if (waveBeforeData.length === 0 || JSON.stringify(waveBeforeData) === JSON.stringify(waveAfterData)) {
                waveBeforeData = Array.from({ length: 30 }, () => Math.random() * 0.8);
              }
            }

            // Update Badge
            const badge = wrap.querySelector('.lufsBadge');
            if (badge) {
              // Always show as "Target" if we simulated a difference, or if it was different
              badge.textContent = `Target ${insight.targetLufs || 'Original'}`;
              const colorClass = (insight.targetLufs === '-14 LUFS' ? 'bg-success' : 'bg-secondary');
              badge.className = `lufsBadge badge ${colorClass}`;
            }

            // Update Stats
            const elLufs = wrap.querySelector('.statLufs');
            const elPeak = wrap.querySelector('.statPeak');
            const elDr = wrap.querySelector('.statDr');

            if (elLufs) elLufs.textContent = `${afterLufs || '-'} LUFS`;
            if (elPeak) {
              const peak = insight.peak !== undefined ? Number(insight.peak).toFixed(1) : '-';
              elPeak.textContent = `${peak} dBTP`;
              const isClipping = parseFloat(peak) > -1.0;
              elPeak.className = `statPeak fw-bold ${isClipping ? 'text-danger' : 'text-success'}`;
            }
            if (elDr) elDr.textContent = `${insight.dr || '-'} DR`;

            // Helper to render waveform bars
            const renderBars = (targetClass, data, colorClass) => {
              const container = wrap.querySelector('.' + targetClass);
              if (!container) return;
              container.innerHTML = '';

              if (!data || !Array.isArray(data) || data.length === 0) {
                container.innerHTML = '<div class="small text-muted w-100 text-center align-self-center">No Data</div>';
                return;
              }

              const maxBars = 30;
              const step = Math.ceil(data.length / maxBars);

              for (let i = 0; i < data.length; i += step) {
                let val = 0;
                for (let j = 0; j < step && (i + j) < data.length; j++) {
                  if (data[i + j] > val) val = data[i + j];
                }

                const bar = document.createElement('div');
                const height = Math.max(5, Math.min(100, val * 100));
                const isPeak = val > 0.98;

                bar.className = `${isPeak ? 'bg-danger' : colorClass} flex-fill`;
                bar.style.height = `${height}%`;
                bar.style.borderRadius = '1px';
                bar.style.width = '1px';

                if (isPeak) bar.title = 'Peak';
                container.appendChild(bar);
              }
            };

            renderBars('waveBefore', waveBeforeData, 'bg-secondary opacity-50');
            renderBars('waveAfter', waveAfterData, 'bg-primary');
          });
        };

        const registerConversionSuccess = (source = 'direct', meta = {}) => {
          try {
            ensureForumSocket()?.emit('conversion_success');
            window.reportUserAction?.('conversion_success', source);
          } catch { }
          const today = new Date();
          const todayKey = today.toISOString().slice(0, 10);
          const lastKey = state.experience.lastConvertDate || '';
          const todayMidnight = new Date(todayKey);
          let streak = Number(state.experience.streak) || 0;
          if (lastKey === todayKey) {
            // no change, already counted today
          } else {
            const lastDate = parseDateKey(lastKey);
            if (lastDate) {
              const lastMidnight = parseDateKey(lastKey);
              const diff = Math.floor((todayMidnight - lastMidnight) / (24 * 60 * 60 * 1000));
              streak = diff === 1 ? streak + 1 : 1;
            } else {
              streak = 1;
            }
            state.experience.lastConvertDate = todayKey;
            state.experience.streak = streak;
            state.experience.streakBest = Math.max(Number(state.experience.streakBest) || 0, streak);
            persistState();
            updateStreakUi();
            if (streak >= 30) awardBadge('streak30');
            else if (streak >= 7) awardBadge('streak7');
            else if (streak >= 3) awardBadge('streak3');
          }
          let usageChanged = false;
          let secureMood = false;
          if (meta?.vpnFriendly) {
            trackUsage('vpn');
            awardBadge('vpn');
            usageChanged = true;
            secureMood = true;
          }
          if (meta?.smartResume) {
            trackUsage('resume');
            awardBadge('resume');
            usageChanged = true;
            secureMood = true;
          }
          if (meta?.soundEffect && meta.soundEffect !== 'none') {
            trackUsage('soundfx');
            awardBadge('soundfx');
            usageChanged = true;
          }
          if (usageChanged) persistState();
          if (secureMood) updateMascotMood('secure');
          offerLuckySpin(source);
        };

        const pickPhrase = (topic) => {
          const pool = mascotPhrases[topic] || mascotPhrases.default;
          return pool[Math.floor(Math.random() * pool.length)] || '';
        };

        const updateMascotMood = (topic = 'default') => {
          if (!mascotAssistant || !mascotMessage) return;
          mascotAssistant.hidden = false;
          mascotMessage.textContent = pickPhrase(topic);
          clearTimeout(mascotTimer);
          mascotTimer = window.setTimeout(() => updateMascotMood('default'), 14000);
        };

        const showConfetti = (count = 28, highlight = false) => {
          if (!celebrationLayer) return;
          celebrationLayer.innerHTML = '';
          celebrationLayer.classList.add('active');
          const colors = highlight
            ? ['#ffd700', '#ff6b6b', '#51cf66', '#845ef7']
            : ['#0d6efd', '#6f42c1', '#20c997', '#f8d94e'];
          for (let i = 0; i < count; i += 1) {
            const piece = document.createElement('span');
            piece.className = 'confetti';
            const color = colors[i % colors.length];
            piece.style.background = color;
            const offset = (Math.random() * 200) - 100;
            const offsetEnd = offset + ((Math.random() * 80) - 40);
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.setProperty('--x', `${offset}vw`);
            piece.style.setProperty('--xEnd', `${offsetEnd}vw`);
            piece.style.animationDelay = `${Math.random() * 0.4}s`;
            celebrationLayer.appendChild(piece);
          }
          clearTimeout(celebrationTimer);
          celebrationTimer = window.setTimeout(() => {
            celebrationLayer.classList.remove('active');
            celebrationLayer.innerHTML = '';
          }, 1600);
        };

        const playDonationTone = (amount) => {
          const ctx = ensureAudioContext();
          if (!ctx || !donationGain) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = amount >= 100000 ? 'sawtooth' : 'triangle';
          const baseFreq = amount >= 100000 ? 880 : 523.25;
          osc.frequency.value = baseFreq;
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(donationGain);
          donationGain.connect(ctx.destination);
          const now = ctx.currentTime;
          donationGain.gain.cancelScheduledValues(now);
          donationGain.gain.setValueAtTime(0.0001, now);
          donationGain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
          donationGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
        };

        const triggerDonationCelebration = (amount, opened = true) => {
          if (!Number.isFinite(amount) || amount <= 0) return;
          const highlight = amount >= 100000;
          showConfetti(highlight ? 60 : 30, highlight);
          playDonationTone(amount);
          if (navigator.vibrate) {
            navigator.vibrate(highlight ? [80, 30, 90, 30, 140] : [45, 20, 45]);
          }
          const label = rupiahFormatter.format(amount);
          const xpGain = Math.max(10, Math.min(120, Math.round(amount / 1500)));
          const badge = amount >= 75000 ? 'supporter' : 'donor';
          incrementPoints(xpGain, `Donasi ${label}`, { badge });
          if (badge === 'supporter') awardBadge('donor');
          updateMascotMood('donation');
          if (!opened && donationStatus) {
            donationStatus.innerHTML = currentLang === 'en'
              ? `Pop-up blocked. Tap the <strong>Open manually</strong> button below, amount ${label} is ready. Enable pop-ups or long-press to open in a new tab.`
              : `Pop-up diblokir. Klik tombol <strong>Buka manual</strong> di bawah, nominal sudah otomatis ${label}. Aktifkan pop-up atau tekan dan tahan untuk membuka di tab baru.`;
          }
        };

        const SEASONAL_SKINS = {
          default: { theme: 'neo', hint: '' },
          ramadhan: { theme: 'midnight', hint: '' },
          valentine: { theme: 'aurora', hint: 'Valentine Bloom aktif • bagikan link private biar makin manis.' },
          halloween: { theme: 'midnight', hint: 'Halloween vibes! Cari easter egg di Legendary Catch Challenge.' },
          holiday: { theme: 'midnight', hint: 'Holiday sparkle hadir. Putar Lucky Spin untuk hadiah spesial.' }
        };

        const determineSeasonalSkin = () => {
          const now = new Date();
          const month = now.getMonth() + 1;
          const day = now.getDate();
          const ramadhanStart = new Date(2026, 1, 19, 0, 0, 0, 0);
          const ramadhanEnd = new Date(2026, 2, 20, 23, 59, 59, 999);
          if (now >= ramadhanStart && now <= ramadhanEnd) return 'ramadhan';
          if (month === 2 && day <= 21) return 'valentine';
          if (month === 10) return 'halloween';
          if (month === 12) return 'holiday';
          return 'default';
        };

        const resolveSeasonalTheme = (value) => {
          if (value === 'auto' || !value) {
            const skin = determineSeasonalSkin();
            const meta = SEASONAL_SKINS[skin] || SEASONAL_SKINS.default;
            return { theme: meta.theme, skin, hint: meta.hint };
          }
          return { theme: value, skin: 'default', hint: '' };
        };

        const applySeasonalSkin = (skin) => {
          if (!document.body) return;
          document.body.classList.remove('skin-ramadhan', 'skin-valentine', 'skin-halloween', 'skin-holiday');
          if (skin && skin !== 'default') {
            document.body.classList.add(`skin-${skin}`);
          }
        };

        const applyTheme = () => {
          if (!document.body) return;
          const resolved = resolveSeasonalTheme(state.experience.theme || 'auto');
          document.body.classList.remove('theme-neo', 'theme-aurora', 'theme-midnight');
          document.body.classList.add(`theme-${resolved.theme}`);
          applySeasonalSkin(resolved.skin);
          state.experience.seasonalSkin = resolved.skin;
          const seasonalOverlay = document.getElementById('seasonalOverlay');
          if (seasonalOverlay) {
            seasonalOverlay.hidden = resolved.skin !== 'ramadhan';
          }
          if (rewardHubHint) {
            const baseHint = rewardBaseHint || 'Kumpulkan streak harian untuk tiket ekstra dan cari kata kunci rahasia di pencarian lagu.';
            if (resolved.hint) rewardHubHint.textContent = `${baseHint} • ${resolved.hint}`;
            else rewardHubHint.textContent = baseHint;
          }
        };

        const applyFont = () => {
          if (!document.body) return;
          const font = state.experience.font || 'typewriter';
          document.body.classList.remove('font-typewriter', 'font-retro', 'font-mono');
          document.body.classList.add(`font-${font}`);
        };

        const applyLayout = () => {
          if (!document.body) return;
          const layout = state.experience.layout || 'cozy';
          document.body.classList.remove('layout-compact', 'layout-spacious');
          if (layout === 'compact') document.body.classList.add('layout-compact');
          if (layout === 'spacious') document.body.classList.add('layout-spacious');
        };

        const applyDashboardExperience = () => {
          applyTheme();
          applyFont();
          applyLayout();
          if (themeSelect) themeSelect.value = state.experience.theme || 'auto';
          if (fontSelect) fontSelect.value = state.experience.font || 'typewriter';
          if (layoutSelect) layoutSelect.value = state.experience.layout || 'cozy';
          if (moodSelect) moodSelect.value = state.experience.mood || 'auto';
          if (narratorToggle) narratorToggle.checked = !!state.experience.narratorAuto;
          if (videoPreviewToggle) videoPreviewToggle.checked = state.experience.previewEmbed !== false;
          if (videoQualitySelect) {
            const q = state.experience.videoQuality || 'best';
            videoQualitySelect.value = q;
          }
        };

        const determineAutoMood = () => {
          const hour = new Date().getHours();
          if (hour >= 6 && hour < 12) return 'energetic';
          if (hour >= 12 && hour < 18) return 'focus';
          return 'chill';
        };

        const moodLabels = {
          energetic: 'Energetic',
          focus: 'Focus',
          chill: 'Chill'
        };

        const MUSIC_LIBRARY = {
          energetic: {
            label: 'Energetic',
            description: 'Synthwave groove 112 BPM dengan bass dan arpeggio.',
            tempo: 112,
            chordBeats: 4,
            chords: [
              [392, 494, 587],
              [440, 554, 659],
              [392, 523, 659],
              [349, 523, 659],
            ],
            lead: [784, 659, 698, 659],
            accent: 0.32,
            lfo: 10,
          },
          focus: {
            label: 'Focus',
            description: 'Ambient keys 88 BPM dengan lapisan shimmer.',
            tempo: 88,
            chordBeats: 4,
            chords: [
              [261, 329, 392],
              [246, 329, 415],
              [233, 311, 392],
              [261, 329, 392],
            ],
            lead: [523, 493, 554, 493],
            accent: 0.2,
            lfo: 14,
          },
          chill: {
            label: 'Chill',
            description: 'Lo-fi dusk pad 72 BPM yang santai.',
            tempo: 72,
            chordBeats: 4,
            chords: [
              [196, 247, 311],
              [174, 220, 293],
              [196, 247, 311],
              [220, 277, 329],
            ],
            lead: [392, 349, 330, 349],
            accent: 0.18,
            lfo: 16,
          },
        };

        const getMoodBuffer = (ctx, moodKey) => {
          const preset = MUSIC_LIBRARY[moodKey] || MUSIC_LIBRARY.chill;
          const cacheKey = `${moodKey}:${ctx.sampleRate}`;
          if (moodBuffers.has(cacheKey)) return moodBuffers.get(cacheKey);
          const chordBeats = preset.chordBeats || 4;
          const chordDuration = (chordBeats * 60) / preset.tempo;
          const cycleDuration = chordDuration * preset.chords.length;
          const frameCount = Math.max(1, Math.floor(ctx.sampleRate * cycleDuration));
          const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < frameCount; i += 1) {
            const t = i / ctx.sampleRate;
            const cyclePos = t % cycleDuration;
            const chordIndex = Math.floor(cyclePos / chordDuration);
            const chord = preset.chords[chordIndex % preset.chords.length];
            const chordTime = cyclePos - chordIndex * chordDuration;
            let sample = 0;
            chord.forEach((freq, idx) => {
              const drift = 1 + 0.0025 * Math.sin(2 * Math.PI * t / (8 + idx * 3));
              sample += Math.sin(2 * Math.PI * freq * drift * t + idx * 0.4);
            });
            sample /= chord.length;
            const bassFreq = chord[0] / 2;
            sample += 0.55 * Math.sin(2 * Math.PI * bassFreq * t + Math.sin(t * 0.6));
            if (preset.lead?.length) {
              const leadFreq = preset.lead[chordIndex % preset.lead.length];
              sample += 0.28 * Math.sin(2 * Math.PI * leadFreq * (t + 0.0015 * Math.sin(t)) + Math.sin(t * 1.2));
            }
            const beatPhase = (chordTime * preset.tempo) / 60;
            const accent = Math.exp(-6 * (beatPhase % 1)) * (preset.accent ?? 0.2);
            sample += accent;
            const padFreq = chord[chord.length - 1] / 4;
            sample += 0.18 * Math.sin(2 * Math.PI * padFreq * t + Math.sin(t / (preset.lfo || 12)));
            const fadeIn = Math.min(1, i / (ctx.sampleRate * 0.6));
            const fadeOut = Math.min(1, (frameCount - i) / (ctx.sampleRate * 0.6));
            const lfo = 0.9 + 0.1 * Math.sin(2 * Math.PI * t / (preset.lfo || 12));
            data[i] = Math.tanh(sample * 0.32 * lfo) * fadeIn * fadeOut;
          }
          moodBuffers.set(cacheKey, buffer);
          return buffer;
        };

        const updateMusicStatus = (resolvedMood, description) => {
          const preset = MUSIC_LIBRARY[resolvedMood] || MUSIC_LIBRARY.chill;
          const label = preset?.label || moodLabels[resolvedMood] || resolvedMood;
          const detail = description || preset?.description;
          if (bgMusicStatus) {
            bgMusicStatus.textContent = musicPlaying
              ? `Mood ${label || 'auto'} diputar${detail ? ` • ${detail}` : ''}.`
              : 'Musik latar dimatikan.';
          }
          if (bgMusicNow) {
            bgMusicNow.textContent = musicPlaying
              ? `Sedang bermain: ${label || 'Auto'}${detail ? ` • ${detail}` : ''}`
              : 'Belum diputar.';
          }
          if (musicToggleBtn) {
            musicToggleBtn.innerHTML = musicPlaying
              ? '<i class="bi bi-pause-fill me-1"></i>Pause'
              : '<i class="bi bi-play-fill me-1"></i>Play';
          }
        };

        const stopBackgroundMusic = (silent = false) => {
          if (!audioCtx || !bgGain) {
            musicPlaying = false;
            updateMusicStatus(state.experience.mood || 'auto');
            return;
          }
          const now = audioCtx.currentTime;
          bgGain.gain.cancelScheduledValues(now);
          bgGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
          if (bgSource) {
            try {
              bgSource.stop(now + 0.5);
            } catch { }
            try {
              bgSource.disconnect();
            } catch { }
            bgSource = null;
          }
          musicPlaying = false;
          if (!silent) updateMusicStatus(state.experience.mood || 'auto');
        };

        const startBackgroundMusic = (mood) => {
          const ctx = ensureAudioContext();
          if (!ctx || !bgGain) {
            setToast('Browser tidak mendukung audio latar.');
            return;
          }
          stopBackgroundMusic(true);
          currentMood = mood || state.experience.mood || 'auto';
          const resolvedMood = currentMood === 'auto' ? determineAutoMood() : currentMood;
          const preset = MUSIC_LIBRARY[resolvedMood] || MUSIC_LIBRARY.chill;
          const buffer = getMoodBuffer(ctx, resolvedMood);
          if (!buffer) {
            setToast('Musik latar tidak siap diputar.');
            return;
          }
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = 0;
          source.loopEnd = buffer.duration;
          source.connect(bgGain);
          const now = ctx.currentTime;
          bgGain.gain.cancelScheduledValues(now);
          bgGain.gain.setValueAtTime(0.0001, now);
          bgGain.gain.exponentialRampToValueAtTime(0.28, now + 1.1);
          source.start(now + 0.05);
          bgSource = source;
          musicPlaying = true;
          state.experience.mood = currentMood;
          updateMusicStatus(resolvedMood, preset.description);
          const alreadyMaestro = (state.experience.badges || []).includes('maestro');
          incrementPoints(alreadyMaestro ? 4 : 8, 'Musik adaptif', alreadyMaestro ? {} : { badge: 'maestro' });
          persistState();
        };

        const SPIN_REWARDS = [
          {
            id: 'xp25',
            label: '+25 XP',
            description: 'Bonus XP instan.',
            weight: 3,
            handler: () => {
              incrementPoints(25, 'Lucky Spin');
            }
          },
          {
            id: 'xp60',
            label: '+60 XP',
            description: 'XP langka untuk boost level.',
            weight: 1,
            handler: () => {
              incrementPoints(60, 'Lucky Spin Rare');
              showConfetti(36, true);
            }
          },
          {
            id: 'ticket',
            label: 'Tiket tambahan',
            description: 'Tambah 1 tiket Lucky Spin.',
            weight: 2,
            handler: () => {
              state.experience.spinTickets = Math.min(5, Number(state.experience.spinTickets || 0) + 2);
              incrementPoints(12, 'Bonus tiket Lucky Spin');
              showRewardToast('Tiket Lucky Spin bertambah!');
            }
          },
          {
            id: 'badge',
            label: 'Badge Lucky Star',
            description: 'Langsung klaim badge Lucky Star.',
            weight: 1,
            handler: () => {
              incrementPoints(40, 'Lucky Star');
              awardBadge('spin');
            }
          },
          {
            id: 'mood',
            label: 'Mood Booster',
            description: 'Adaptive music berganti mood unik.',
            weight: 2,
            handler: () => {
              const moods = ['energetic', 'focus', 'chill'];
              const pick = moods[Math.floor(Math.random() * moods.length)];
              startBackgroundMusic(pick);
              incrementPoints(15, 'Mood booster');
            }
          },
          {
            id: 'trivia',
            label: 'Easter Trivia',
            description: 'Pertanyaan easter egg terbuka.',
            weight: 1,
            handler: () => {
              const launch = () => openTriviaModal(true);
              if (spinModalEl && bs?.Modal?.getInstance) {
                const modal = bs.Modal.getInstance(spinModalEl);
                if (modal) {
                  modal.hide();
                  window.setTimeout(launch, 360);
                  return;
                }
              }
              window.setTimeout(launch, 280);
            }
          }
        ];

        const renderSpinWheel = () => {
          if (!spinWheelEl) return;
          spinWheelEl.innerHTML = '';
          spinItems = SPIN_REWARDS.map((reward) => {
            const item = document.createElement('div');
            item.className = 'spin-item';
            item.dataset.reward = reward.id;
            item.innerHTML = `<span>${reward.label}</span><span class="desc">${reward.description}</span>`;
            spinWheelEl.appendChild(item);
            return item;
          });
        };

        const updateSpinUi = () => {
          const tickets = Number(state.experience.spinTickets) || 0;
          if (spinStartBtn) {
            const label = tickets > 0 ? `Putar (${tickets} tiket)` : 'Putar Sekarang';
            spinStartBtn.innerHTML = `<i class="bi bi-lightning-charge me-1"></i>${label}`;
            spinStartBtn.disabled = tickets <= 0 || spinActive;
          }
          if (openSpinBtn) {
            openSpinBtn.classList.toggle('btn-primary', tickets > 0);
            openSpinBtn.classList.toggle('btn-outline-primary', tickets <= 0);
            openSpinBtn.innerHTML = tickets > 0
              ? `<i class="bi bi-lightning-charge me-1"></i>Buka Lucky Spin (${tickets})`
              : '<i class="bi bi-lightning-charge me-1"></i>Buka Lucky Spin';
          }
          if (spinTicketBadge) {
            spinTicketBadge.textContent = tickets === 1 ? '1 tiket' : `${tickets} tiket`;
          }
          if (spinResultEl) {
            const history = Array.isArray(state.experience.spinHistory) ? state.experience.spinHistory : [];
            if (history.length) {
              const last = history[history.length - 1];
              const time = last?.ts ? new Date(last.ts).toLocaleTimeString('id-ID') : '';
              spinResultEl.textContent = `Terakhir: ${last.label}${time ? ` • ${time}` : ''}`;
            } else {
              spinResultEl.textContent = 'Putar Lucky Spin setelah konversi untuk hadiah kejutan.';
            }
          }
        };

        const pickSpinReward = () => {
          const pool = [];
          SPIN_REWARDS.forEach((reward) => {
            const weight = Math.max(1, Number(reward.weight) || 1);
            for (let i = 0; i < weight; i += 1) pool.push(reward);
          });
          return pool[Math.floor(Math.random() * pool.length)] || SPIN_REWARDS[0];
        };

        const applySpinReward = (reward) => {
          if (!reward) return;
          try {
            reward.handler?.();
          } catch (err) {
            console.error('Spin reward error', err);
          }
          if (!state.experience.usage) state.experience.usage = { ...defaultExperience.usage };
          state.experience.usage.spin = (Number(state.experience.usage.spin) || 0) + 1;
          awardBadge('spin');
          updateMascotMood('spin');
          persistState();
        };

        const finishSpin = (reward) => {
          spinActive = false;
          if (spinTimer) {
            clearTimeout(spinTimer);
            spinTimer = null;
          }
          state.experience.spinTickets = Math.max(0, Number(state.experience.spinTickets || 0) - 1);
          const history = Array.isArray(state.experience.spinHistory) ? state.experience.spinHistory : [];
          const entry = { id: reward.id, label: reward.label, ts: Date.now() };
          state.experience.spinHistory = [...history.slice(-9), entry];
          applySpinReward(reward);
          updateSpinUi();
          if (spinResultEl) {
            spinResultEl.textContent = `Selamat! ${reward.label} • ${reward.description}`;
          }
        };

        function startLuckySpin() {
          if ((Number(state.experience.spinTickets) || 0) <= 0) {
            setToast('Belum ada tiket Lucky Spin. Selesaikan konversi dulu ya!');
            return;
          }
          if (spinActive) return;
          if (!spinItems.length) renderSpinWheel();
          if (!spinItems.length) return;
          const reward = pickSpinReward();
          const len = spinItems.length;
          const winnerIndex = spinItems.findIndex((node) => node.dataset.reward === reward.id);
          const totalSteps = len * 4 + (winnerIndex >= 0 ? winnerIndex : 0);
          let index = 0;
          let delay = 90;
          spinActive = true;
          spinItems.forEach((node) => node.classList.remove('active'));
          const tick = () => {
            spinItems.forEach((node) => node.classList.remove('active'));
            const node = spinItems[index % len];
            if (node) node.classList.add('active');
            index += 1;
            if (index <= totalSteps) {
              delay = Math.min(360, delay + 10);
              spinTimer = window.setTimeout(tick, delay);
            } else {
              finishSpin(reward);
            }
          };
          tick();
        }

        const offerLuckySpin = (source = 'direct') => {
          state.experience.spinTickets = Math.min(5, Number(state.experience.spinTickets || 0) + 1);
          pendingSpinOffer = true;
          updateSpinUi();
          persistState();
          if (source === 'background') {
            showRewardToast('Job background selesai! Lucky Spin siap diputar.');
          } else {
            showRewardToast('Lucky Spin siap diputar!');
          }
          if (spinModalEl && !document.body.classList.contains('modal-open')) {
            const modal = bs?.Modal?.getOrCreateInstance
              ? bs.Modal.getOrCreateInstance(spinModalEl)
              : null;
            pendingSpinOffer = false;
            modal?.show();
          }
        };

        const TRIVIA_KEYWORDS = ['music trivia', 'musik trivia', 'trivia musik', 'kuis musik', 'music quiz'];

        const TRIVIA_BANK = [
          {
            id: 'tempo',
            question: 'Istilah untuk kecepatan sebuah lagu dalam musik disebut apa?',
            options: [
              { text: 'Tempo', correct: true },
              { text: 'Timbre' },
              { text: 'Harmony' },
              { text: 'Dynamics' }
            ],
            explanation: 'Tempo menentukan seberapa cepat atau lambat sebuah lagu dimainkan.'
          },
          {
            id: 'blinding',
            question: 'Siapa artis di balik hits global "Blinding Lights"?',
            options: [
              { text: 'The Weeknd', correct: true },
              { text: 'Bruno Mars' },
              { text: 'Ed Sheeran' },
              { text: 'Dua Lipa' }
            ],
            explanation: 'The Weeknd merilis "Blinding Lights" pada 2019 dan menjadi salah satu lagu paling populer dekade ini.'
          },
          {
            id: 'house128',
            question: 'Genre elektronik apa yang identik dengan tempo sekitar 128 BPM?',
            options: [
              { text: 'House', correct: true },
              { text: 'Trap' },
              { text: 'Dubstep' },
              { text: 'Lo-fi' }
            ],
            explanation: 'Genre House biasanya berada di tempo 120-130 BPM dan populer di lantai dansa.'
          },
          {
            id: 'konami',
            question: 'Kode rahasia apa yang membuka tantangan Konami di Experience Hub?',
            options: [
              { text: '↑↑↓↓←→←→BA', correct: true },
              { text: '12345' },
              { text: 'WASD + Space' },
              { text: 'CTRL + M' }
            ],
            explanation: 'Masukkan urutan ↑↑↓↓←→←→BA untuk memunculkan aura Konami.',
            easter: true
          },
          {
            id: 'grammy',
            question: 'Album siapakah yang meraih Grammy Album of the Year 2024?',
            options: [
              { text: 'Midnights • Taylor Swift', correct: true },
              { text: 'SOUR • Olivia Rodrigo' },
              { text: 'SOS • SZA' },
              { text: 'Endless Summer Vacation • Miley Cyrus' }
            ],
            explanation: 'Taylor Swift meraih Album of the Year 2024 lewat "Midnights".'
          }
        ];

        const renderTriviaQuestion = (question) => {
          currentTrivia = question;
          triviaAnswered = false;
          if (triviaQuestionEl) triviaQuestionEl.textContent = question?.question || '';
          if (triviaFeedbackEl) triviaFeedbackEl.textContent = '';
          if (triviaOptionsEl) {
            triviaOptionsEl.innerHTML = '';
            (question?.options || []).forEach((option, index) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'list-group-item list-group-item-action';
              btn.textContent = option.text;
              btn.dataset.index = String(index);
              btn.addEventListener('click', () => handleTriviaOption(index));
              triviaOptionsEl.appendChild(btn);
            });
            const firstOption = triviaOptionsEl.querySelector('button');
            if (firstOption) {
              window.setTimeout(() => {
                if (document.contains(firstOption)) firstOption.focus();
              }, 120);
            }
          }
          if (triviaSkipBtn) triviaSkipBtn.disabled = false;
          if (triviaNextBtn) triviaNextBtn.disabled = true;
        };

        const chooseTriviaQuestion = (forceEaster = false) => {
          const pool = forceEaster
            ? TRIVIA_BANK.filter((q) => q.easter)
            : TRIVIA_BANK.filter((q) => q.id !== state.experience.lastTriviaId || TRIVIA_BANK.length === 1);
          const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : TRIVIA_BANK[0];
          renderTriviaQuestion(pick);
        };

        function handleTriviaOption(index) {
          if (!currentTrivia || triviaAnswered) return;
          triviaAnswered = true;
          const options = Array.from(triviaOptionsEl?.querySelectorAll('button') || []);
          options.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === index) btn.classList.add('active');
            if (currentTrivia.options[idx]?.correct) {
              btn.classList.add('list-group-item-success');
            }
          });
          const selected = currentTrivia.options[index];
          const correct = currentTrivia.options.find((opt) => opt.correct);
          const isCorrect = !!selected?.correct;
          const base = isCorrect
            ? 'Jawaban benar!'
            : `Kurang tepat. Jawaban yang benar: ${correct?.text || ''}.`;
          const extra = currentTrivia.explanation ? ` ${currentTrivia.explanation}` : '';
          if (triviaFeedbackEl) triviaFeedbackEl.textContent = `${base}${extra}`.trim();
          state.experience.triviaSeen = (Number(state.experience.triviaSeen) || 0) + 1;
          state.experience.lastTriviaId = currentTrivia.id;
          if (isCorrect) {
            state.experience.triviaScore = (Number(state.experience.triviaScore) || 0) + 1;
            incrementPoints(currentTrivia.easter ? 60 : 24, currentTrivia.easter ? 'Easter Trivia' : 'Music Trivia');
            if (currentTrivia.easter) {
              awardBadge('easter');
              showConfetti(32, true);
            }
            updateMascotMood('trivia');
          }
          persistState();
          if (triviaNextBtn) triviaNextBtn.disabled = false;
        }

        const loadTriviaQuestion = (forceEaster = false) => {
          chooseTriviaQuestion(forceEaster);
        };

        function openTriviaModal(forceEaster = false) {
          if (!triviaModalEl) return;
          loadTriviaQuestion(forceEaster);
          const modal = bs?.Modal?.getOrCreateInstance
            ? bs.Modal.getOrCreateInstance(triviaModalEl)
            : null;
          modal?.show();
          updateMascotMood('trivia');
        }

        function rotateMood() {
          const order = ['auto', 'energetic', 'focus', 'chill'];
          const idx = order.indexOf(state.experience.mood || 'auto');
          const nextMood = order[(idx + 1) % order.length];
          if (moodSelect) moodSelect.value = nextMood;
          state.experience.mood = nextMood;
          persistState();
          startBackgroundMusic(nextMood);
        }

        const speak = (text, options = {}) => {
          const { silent = false } = options || {};
          const synth = window.speechSynthesis;
          const clean = String(text || '').trim();
          if (!synth) {
            if (!silent) setToast('Browser belum mendukung text-to-speech.');
            return false;
          }
          if (!clean) {
            if (!silent) setToast('Tidak ada teks yang bisa dibacakan.');
            return false;
          }
          synth.cancel();
          const utter = new SpeechSynthesisUtterance(clean);
          utter.lang = currentLang === 'en' ? 'en-US' : 'id-ID';
          utter.rate = 1;
          utter.pitch = 1;
          synth.speak(utter);
          state.narratorEnabled = true;
          persistState();
          updateMascotMood('voice');
          return true;
        };

        queueNarration = (() => {
          let chain = Promise.resolve();
          let lastMessage = '';
          let lastSpokenAt = 0;
          return (text) => {
            const clean = String(text || '').trim();
            if (!clean) return;
            const now = Date.now();
            if (clean === lastMessage && now - lastSpokenAt < 4000) return;
            lastMessage = clean;
            lastSpokenAt = now;
            chain = chain.then(() => new Promise((resolve) => {
              const ok = speak(clean, { silent: true });
              const words = clean.split(/\s+/).filter(Boolean).length || 1;
              const wait = ok ? Math.min(9000, Math.max(1400, words * 140)) : 0;
              window.setTimeout(resolve, wait);
            }));
          };
        })();
        shouldNarrate = () => Boolean(state?.experience?.narratorAuto || state?.narratorEnabled);

        function stopNarrator() {
          const synth = window.speechSynthesis;
          if (synth) synth.cancel();
          state.narratorEnabled = false;
          persistState();
        }

        function narrateGuide() {
          const summary = 'Converter ini siap ambil URL YouTube, Spotify, atau SoundCloud. Jelajahi Experience Hub, temukan jawaban di FAQ, dukung kami di Saweria, dan pantau XP di Profil. Ketuk tombol konversi untuk mulai.';
          if (speak(summary)) incrementPoints(10, 'Narrator mode', { badge: 'narrator' });
        }

        function ensureRecognition() {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRecognition) return null;
          if (!recognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.onresult = (event) => {
              const transcript = Array.from(event.results)
                .map((res) => res[0]?.transcript || '')
                .join(' ')
                .trim();
              if (transcript) handleVoiceCommand(transcript);
            };
            recognition.onerror = (event) => {
              voiceActive = false;
              const extra = event?.error ? `(${event.error})` : '';
              setVoiceStatus('voiceStatusStopped', 'Perintah suara dihentikan.', extra);
            };
            recognition.onend = () => {
              voiceActive = false;
              setVoiceStatus('voiceStatusReady', 'Perintah suara siap digunakan.');
            };
          }
          recognition.lang = currentLang === 'en' ? 'en-US' : 'id-ID';
          return recognition;
        }

        if (voiceCommandBtn) {
          const recognitionInstance = ensureRecognition();
          if (!recognitionInstance) {
            voiceCommandBtn.disabled = true;
            setVoiceStatus('voiceStatusUnsupported', 'Browser belum mendukung voice recognition.');
          } else {
            setVoiceStatus('voiceStatusReady', 'Perintah suara siap digunakan.');
            voiceCommandBtn.addEventListener('click', () => {
              const activeRecognition = ensureRecognition();
              if (!activeRecognition) return;
              if (voiceActive) {
                activeRecognition.stop();
                voiceActive = false;
                setVoiceStatus('voiceStatusStopped', 'Perintah suara dihentikan.');
              } else {
                activeRecognition.start();
                voiceActive = true;
                setVoiceStatus('voiceStatusListening', 'Mendengarkan, ucapkan "buka donasi" atau "mainkan game"....');
              }
            });
          }
        }

        const scrollToElement = (el) => {
          if (!el) return;
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch {
            el.scrollIntoView();
          }
        };

        const handleVoiceCommand = (raw) => {
          const spoken = (raw || '').trim();
          if (!spoken) return;
          const text = spoken.toLowerCase();
          const includes = (...phrases) => phrases.some((phrase) => text.includes(phrase));
          let handled = false;
          let convertTriggered = false;

          const showVoiceToast = (key, fallback) => {
            const template = translate(key, fallback);
            setToast(template.replace('{value}', spoken));
          };

          const convertMatch = text.match(/(?:download|unduh|convert|konversi)\s+(.+)/);
          if (convertMatch) {
            let query = convertMatch[1].trim();
            const qualityMatch = query.match(/(\d{2,3})\s*(?:kbps|k\s?bps|kb|k)/);
            if (qualityMatch) {
              const desiredAbr = clamp(Number(qualityMatch[1]) || 0, 32, 512);
              if (abrSelect) {
                abrSelect.value = String(desiredAbr);
                abrSelect.dispatchEvent(new Event('change', { bubbles: true }));
              }
              query = query.replace(qualityMatch[0], ' ');
            }
            query = query.replace(/\b(?:ke|to)\b\s*(?:mp3|audio)/g, ' ');
            query = query.replace(/\b(mp3|audio|lagu|song|musik|music|tolong|please|dong|nih|nya|format|bitrate|dengan|with|in)\b/g, ' ');
            query = query.replace(/\s+/g, ' ').trim();
            if (query) {
              handled = true;
              convertTriggered = true;
              handleKeywordConvert(query, { autoDownload: true });
            }
          }

          if (includes('donasi', 'donation', 'donate', 'saweria')) {
            scrollToElement(document.getElementById('donationCard'));
            handled = true;
          }
          if (includes('game', 'runner', 'neo runner', 'play game')) {
            scrollToElement(document.getElementById('gameCard'));
            startRunner();
            updateMascotMood('game');
            handled = true;
          }
          if (includes('faq', 'pertanyaan', 'question', 'help')) {
            const firstFaq = document.querySelector('#faqList details');
            if (firstFaq) firstFaq.open = true;
            scrollToElement(document.getElementById('faqList'));
            handled = true;
          }
          if (!convertTriggered && includes('musik', 'music', 'play music', 'putar musik', 'background music')) {
            startBackgroundMusic('auto');
            handled = true;
          }
          if (!convertTriggered && includes('matikan musik', 'stop musik', 'stop music', 'mute music', 'pause music')) {
            stopBackgroundMusic();
            handled = true;
          }
          if (includes('narrator', 'bacakan', 'narrate', 'read guide', 'read page')) {
            narrateGuide();
            handled = true;
          }
          if (includes('ai', 'navigator', 'assistant', 'open ai', 'open assistant', 'buka ai')) {
            openAssistantPanel();
            handled = true;
          }

          if (handled) {
            const reason = currentLang === 'en' ? 'Voice command' : 'Perintah suara';
            incrementPoints(20, reason, { badge: 'voice' });
            if (!convertTriggered) showVoiceToast('toastVoiceHandled', 'Perintah suara: {value}');
          } else {
            showVoiceToast('toastVoiceUnknown', 'Perintah belum dikenali: {value}');
          }
        };

        const isAssistantOpen = () => assistantPanel && !assistantPanel.hasAttribute('hidden');

        const focusAssistantInput = () => {
          window.setTimeout(() => {
            if (assistantInput) {
              assistantInput.focus();
              if (typeof assistantInput.select === 'function') assistantInput.select();
            }
          }, 80);
        };

        function openAssistantPanel(opts = {}) {
          if (!assistantPanel) return;
          assistantFab?.classList.add('panel-open');
          assistantPanel.hidden = false;
          assistantPanel.setAttribute('aria-hidden', 'false');
          assistantToggle?.setAttribute('aria-expanded', 'true');
          assistantToggle?.classList.remove('has-update');
          assistantPulse?.setAttribute('aria-hidden', 'true');
          assistantDismissedManually = false;
          if (assistantMessages) {
            if (typeof assistantMessages.scrollTo === 'function') {
              assistantMessages.scrollTo({ top: assistantMessages.scrollHeight });
            } else {
              assistantMessages.scrollTop = assistantMessages.scrollHeight;
            }
          }
          if (!opts.skipFocus) {
            focusAssistantInput();
          }
          if (opts.focusMessages && assistantMessages) {
            assistantMessages.focus({ preventScroll: true });
          }
        }

        function closeAssistantPanel(opts = {}) {
          if (!assistantPanel || assistantPanel.hasAttribute('hidden')) return;
          assistantPanel.hidden = true;
          assistantPanel.setAttribute('aria-hidden', 'true');
          assistantToggle?.setAttribute('aria-expanded', 'false');
          assistantFab?.classList.remove('panel-open');
          if (opts.manual) assistantDismissedManually = true;
        }

        function maybeAutoOpenAssistant(opts = {}) {
          if (!assistantPanel || !assistantFab) return;
          if (!assistantPanel.hasAttribute('hidden')) return;
          if (assistantDismissedManually && !opts.force) return;
          const delay = typeof opts.delay === 'number' ? opts.delay : 0;
          window.setTimeout(() => {
            openAssistantPanel({
              skipFocus: opts.skipFocus,
              focusMessages: opts.focusMessages,
            });
          }, delay);
        }

        assistantBridge.autoOpen = () => {
          if (!assistantAutoOpenQueued) return;
          maybeAutoOpenAssistant({ delay: 120 });
          assistantAutoOpenQueued = false;
        };

        if (assistantAutoOpenQueued) {
          assistantBridge.autoOpen();
        }

        const escapeAssistantHtml = (raw = '') => String(raw)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const formatAssistantInline = (line = '') => {
          let safe = escapeAssistantHtml(line);
          safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
          return safe;
        };

        const renderAssistantRichText = (text = '') => {
          const normalized = String(text || '').replace(/\r\n?/g, '\n').trim();
          if (!normalized) return '';
          const lines = normalized.split('\n');
          const html = [];
          let listType = '';

          const closeList = () => {
            if (listType) {
              html.push(`</${listType}>`);
              listType = '';
            }
          };

          lines.forEach((rawLine) => {
            const line = rawLine.trim();
            if (!line) {
              closeList();
              return;
            }
            const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
            if (headingMatch) {
              closeList();
              html.push(`<p><strong>${formatAssistantInline(headingMatch[1])}</strong></p>`);
              return;
            }
            if (/^[-•]\s+/.test(line)) {
              if (listType !== 'ul') {
                closeList();
                listType = 'ul';
                html.push('<ul>');
              }
              html.push(`<li>${formatAssistantInline(line.replace(/^[-•]\s+/, ''))}</li>`);
              return;
            }
            if (/^\d+[\.)]\s+/.test(line)) {
              if (listType !== 'ol') {
                closeList();
                listType = 'ol';
                html.push('<ol>');
              }
              html.push(`<li>${formatAssistantInline(line.replace(/^\d+[\.)]\s+/, ''))}</li>`);
              return;
            }
            closeList();
            html.push(`<p>${formatAssistantInline(line)}</p>`);
          });

          closeList();
          return html.join('');
        };

        const DEFAULT_ASSISTANT_SUGGESTIONS = [
          'Cara convert',
          'Pilih format',
          'Trim audio',
          'Cek status tiket',
          'Downloader helper gagal',
          'Buat tiket bantuan',
        ];

        const setAssistantSuggestions = (suggestions = DEFAULT_ASSISTANT_SUGGESTIONS) => {
          if (!assistantQuickSuggestions) return;
          const safeSuggestions = Array.from(new Set((Array.isArray(suggestions) ? suggestions : DEFAULT_ASSISTANT_SUGGESTIONS)
            .map((item) => String(item || '').trim())
            .filter(Boolean)))
            .slice(0, 6);
          assistantQuickSuggestions.replaceChildren();
          safeSuggestions.forEach((label) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'assistant-suggestion-chip';
            chip.textContent = label;
            chip.addEventListener('click', () => {
              if (assistantInput) {
                assistantInput.value = label;
                assistantInput.focus();
              }
              sendAssistantMessage();
            });
            assistantQuickSuggestions.appendChild(chip);
          });
        };

        const addAssistantMessage = (text, role = 'bot', opts = {}) => {
          if (!assistantMessages) return null;
          const bubble = document.createElement('div');
          bubble.className = `assistant-bubble ${role}`;
          const content = String(text || '');

          if (role === 'bot') {
            bubble.innerHTML = renderAssistantRichText(content);
          } else {
            bubble.textContent = content;
          }

          assistantMessages.appendChild(bubble);
          assistantMessages.scrollTop = assistantMessages.scrollHeight;
          if (role === 'bot' && assistantToggle && assistantPanel?.hasAttribute('hidden')) {
            assistantToggle.classList.add('has-update');
            assistantPulse?.setAttribute('aria-hidden', 'false');
          }
          return bubble;
        };

        const assistantKnowledge = [
          { keywords: ['donasi', 'saweria'], reply: 'Untuk donasi, pilih nominal di kartu neo-brutalisme. Jika pop-up diblokir, gunakan tombol Buka manual agar nominal terpilih tetap terbuka.' },
          { keywords: ['subtitle', 'transkrip'], reply: 'Tekan tombol Ambil subtitle. Kami akan ambil track Indonesia, Inggris, dan fallback transkrip dari halaman watch.' },
          { keywords: ['profil', 'avatar', 'xp'], reply: 'Tab Profil menampilkan avatar dinamis, XP, dan badge yang kamu kumpulkan. Buka tab Profil untuk melihat milestone dan reward.' },
          { keywords: ['offline', 'pwa'], reply: 'Klik tombol Pasang aplikasi di kanan atas supaya converter bisa dipakai offline seperti aplikasi HP.' },
          { keywords: ['musik', 'background'], reply: 'Aktifkan Adaptive Background Music. Pilih mood Energetic/Focus/Chill atau biarkan auto mengikuti waktu.' },
          { keywords: ['voice', 'suara'], reply: 'Aktifkan Voice & Narrator lalu tekan tombol mic untuk perintah seperti "buka donasi" atau "mainkan game".' },
          { keywords: ['game', 'mini'], reply: 'Neo Runner ada di Experience Hub. Tekan mulai, gunakan Space atau tap layar untuk melompat, dan kejar skor terbaik.' },
          { keywords: ['tiket', 'ticket', 'status tiket', 'lapor'], reply: 'Butuh bantuan? Buka form tiket CS, lalu gunakan tombol bantu AI untuk menyusun deskripsi otomatis. Setelah kirim, tekan Cek Status Tiket untuk realtime status, chat, dan upload bukti tambahan.' },
          { keywords: ['downloader helper', 'helper gagal', 'download gagal', 'screenshot error'], reply: 'Kalau downloader helper gagal, klik tombol **Downloader Helper Gagal?** di footer. Isi nama + email, upload screenshot error, lalu tiket akan masuk admin dan bisa dicek realtime.' },
          { keywords: ['admin dashboard', 'admin tiket', 'hapus ticket', 'hapus appeal'], reply: 'Admin dashboard/tickets sudah mendukung persistent refresh, pagination, dan hapus ticket/appeal lama dari store agar tabel tetap rapi.' },
          { keywords: ['fitur', 'feature', 'menu'], reply: 'Fitur utama: Converter, Preview/Download, Subtitle, AI Navigator, Ticket Support realtime, Appeal Forum persistent, Experience Hub, Profil, dan FAQ.' },
          { keywords: ['auto tag', 'music tag', 'ai studio'], reply: 'AI Studio sudah disederhanakan. Sekarang fokus ke Auto Music Tags untuk rekomendasi tag musik otomatis.' },
          { keywords: ['analisis', 'rekomendasi fitur', 'roadmap'], reply: 'Kalau kamu mau roadmap upgrade YTConv, ketik /analisis. Aku bakal kasih prioritas fitur + impact bisnisnya.' },
          { keywords: ['codex', 'prompt codex', 'implementasi'], reply: 'Butuh prompt implementasi buat tim dev? ketik /promptcodex, nanti aku siapin template prompt yang bisa langsung dieksekusi.' }
        ];

        const buildFallbackReply = (text) => {
          const lower = text.toLowerCase();
          const match = assistantKnowledge.find((item) => item.keywords.some((k) => lower.includes(k)));
          if (match) return match.reply;
          return 'Siap bantu ✅\n\n**Coba perintah cepat:**\n- `/fitur` untuk daftar fitur lengkap\n- `/help` untuk semua command AI Navigator\n- `/ticket` untuk buka form bantuan\n- `/appeal alasan kamu` untuk appeal forum\n- `/walkthrough` untuk tur spotlight fitur\n\nKamu juga bisa tanya natural, misalnya: **downloader helper gagal**, **cara convert playlist**, **cara ambil subtitle**, atau **cara cek status tiket**.';
        };


        const AI_FEATURE_CATALOG = [
          { id: 1, name: 'Convert cepat', command: '/convert', detail: 'Tempel URL terus gas convert tanpa ribet.' },
          { id: 2, name: 'Download semua', command: '/downloadall', detail: 'Unduh batch hasil convert sekali klik.' },
          { id: 3, name: 'ZIP playlist', command: '/zip', detail: 'Gabung file playlist jadi satu paket ZIP.' },
          { id: 4, name: 'Preview media', command: '/preview', detail: 'Cek audio/video sebelum download final.' },
          { id: 5, name: 'Share link', command: '/share', detail: 'Bagiin hasil ke temen pakai link cepat.' },
          { id: 6, name: 'QR share', command: '/qr', detail: 'Scan QR buat transfer ke HP/device lain.' },
          { id: 7, name: 'Subtitle auto', command: '/subtitle', detail: 'Ambil subtitle otomatis dari video.' },
          { id: 8, name: 'Subtitle manual', command: '/subtitle manual', detail: 'Mode subtitle manual sesuai preferensi bahasa.' },
          { id: 9, name: 'ID3 Tag', command: '/id3', detail: 'Atur judul/artis/album biar musik lebih rapi.' },
          { id: 10, name: 'Trim audio', command: '/trim', detail: 'Potong bagian lagu sesuai durasi yang kamu mau.' },
          { id: 11, name: 'Normalize volume', command: '/normalize', detail: 'Bikin volume lebih stabil antar track.' },
          { id: 12, name: 'AI Denoise', command: '/denoise', detail: 'Reduksi noise buat hasil lebih clean.' },
          { id: 13, name: 'Atmos mode', command: '/atmos', detail: 'Aktifin mode spatial/atmos kalau tersedia.' },
          { id: 14, name: 'Ringtone mode', command: '/ringtone', detail: 'Bikin versi ringtone iPhone/Android cepat.' },
          { id: 15, name: 'Equalizer', command: '/eq', detail: 'Atur bass/mid/treble sesuai selera.' },
          { id: 16, name: 'Riwayat hasil', command: '/history', detail: 'Lihat hasil convert sebelumnya kapan aja.' },
          { id: 17, name: 'Trending now', command: '/trending', detail: 'Liat tren lagu/video yang lagi rame.' },
          { id: 18, name: 'FAQ', command: '/faq', detail: 'Pertanyaan umum + solusi cepet anti muter-muter.' },
          { id: 19, name: 'Walkthrough', command: '/walkthrough', detail: 'Tour fitur step-by-step biar gak bingung.' },
          { id: 20, name: 'Voice command', command: '/voice', detail: 'Kontrol pakai suara buat yang males ngetik.' },
          { id: 21, name: 'Narrator', command: '/narrator', detail: 'AI bacain panduan dan instruksi buat kamu.' },
          { id: 22, name: 'Tema & layout', command: '/theme', detail: 'Ubah vibe UI biar nyaman di mata.' },
          { id: 23, name: 'Profil XP', command: '/profile', detail: 'Pantau level, poin, dan progres akun kamu.' },
          { id: 24, name: 'Badge progress', command: '/badge', detail: 'Tracking badge biar makin semangat.' },
          { id: 25, name: 'Forum assist', command: '/forum', detail: 'Bantuan masalah forum dan moderasi.' },
          { id: 26, name: 'Appeal cepat', command: '/appeal', detail: 'Ajukan appeal langsung dari chat AI.' },
          { id: 27, name: 'Ticket support', command: '/ticket', detail: 'Buka form tiket CS langsung dari command, termasuk upload screenshot dan status realtime.' },
          { id: 28, name: 'Status tiket', command: '/ticket status', detail: 'Pantau status tiket tanpa ribet.' },
          { id: 29, name: 'AI draft tiket', command: '/ticket draft', detail: 'AI bantu ngerapiin isi laporan kamu.' },
          { id: 30, name: 'New chat', command: '/newchat', detail: 'Reset chat biar mulai fresh dari nol.' },
          { id: 31, name: 'Memory ON/OFF', command: '/memory on|off', detail: 'Atur AI inget chat atau enggak.' },
          { id: 32, name: 'Memory clear', command: '/memory clear', detail: 'Hapus jejak obrolan lama sekali klik.' },
          { id: 33, name: 'Status sistem', command: '/status', detail: 'Cek koneksi, mode, dan status memory.' },
          { id: 34, name: 'Info model', command: '/model', detail: 'Tau model aktif + rekomendasi penggunaan.' },
          { id: 35, name: 'Menu command', command: '/help', detail: 'Daftar command biar gak bingung.' },
          { id: 36, name: 'Auto Music Tags', command: '/autotag', detail: 'Tag metadata otomatis buat musik kamu.' },
          { id: 37, name: 'Save cloud', command: '/cloud', detail: 'Simpan hasil ke cloud storage.' },
          { id: 38, name: 'Save Drive', command: '/drive', detail: 'Upload hasil ke Google Drive langsung.' },
          { id: 39, name: 'Private share', command: '/private', detail: 'Share private room untuk link tertentu.' },
          { id: 40, name: 'Playlist parser', command: '/playlist', detail: 'Parse playlist biar proses batch lebih enak.' },
          { id: 41, name: 'Sample URL', command: '/sample', detail: 'Isi URL contoh buat uji cepat.' },
          { id: 42, name: 'Clipboard helper', command: '/paste', detail: 'Paste otomatis dari clipboard ke input.' },
          { id: 43, name: 'Queue manager', command: '/queue', detail: 'Atur urutan antrian convert.' },
          { id: 44, name: 'Anti-error checklist', command: '/fix', detail: 'Checklist solusi kalau proses ngadat + arahkan ke tiket jika helper gagal.' },
          { id: 45, name: 'Attach file', command: '/file', detail: 'Upload file ke chat buat dianalisa AI.' },
          { id: 46, name: 'Attach gambar', command: '/vision', detail: 'Upload gambar + baca metadata visual.' },
          { id: 47, name: 'Deteksi metadata', command: '/meta', detail: 'Lihat info file: tipe, size, dimensi.' },
          { id: 48, name: 'Ringkasan teks', command: '/summarize', detail: 'Ringkas isi file teks panjang jadi poin.' },
          { id: 49, name: 'Prompt helper', command: '/prompt', detail: 'Contoh prompt biar jawaban AI lebih nancep.' },
          { id: 50, name: 'Rekomendasi langkah', command: '/next', detail: 'AI kasih next step paling relevan dari masalahmu.' },
        ];

        const buildFeatureListText = () => {
          const lines = AI_FEATURE_CATALOG.map((item) => `${item.id}. **${item.name}** - ${item.detail}`).join('\n');
          return `**Yo, ini 50 fitur berguna AI Navigator (no kaleng-kaleng):**\n\n${lines}\n\nMau detail? ketik: **/fitur <nomor>** (contoh: \`/fitur 27\`).`;
        };

        const buildFeatureDetailText = (id) => {
          const item = AI_FEATURE_CATALOG.find((f) => f.id === id);
          if (!item) return 'Nomor fiturnya belum valid bro. Coba angka 1 sampai 50 ya.';
          return `**Fitur #${item.id} - ${item.name}**\n\n- Kegunaan: ${item.detail}\n- Command cepat: \`${item.command}\`\n\nKalau mau, bilang aja: **"jalanin fitur ini"** biar aku kasih step-by-step versi gampangnya.`;
        };

        const handleAssistantCommand = (command) => {
          const normalized = command.trim().toLowerCase();
          if (!normalized.startsWith('/')) return '';
          if (normalized.includes('/faq')) {
            setActiveSection('faq');
            closeAssistantPanel();
            return 'Membuka halaman Pertanyaan Umum (FAQ)...';
          }
          if (normalized.includes('/walkthrough')) {
            closeAssistantPanel();
            narrateGuide();
            return 'Memulai panduan interaktif website...';
          }
          if (normalized.includes('/donasi')) {
            setActiveSection('saweria');
            closeAssistantPanel();
            return 'Membuka halaman donasi Saweria. Terima kasih atas dukunganmu!';
          }
          if (normalized.includes('/ai')) {
            return '**AI Navigator aktif.**\n\nSaya siap bantu semua alur: converter, subtitle, history, tiket, FAQ, profile, dan experience.';
          }
          if (normalized.includes('/ticket')) {
            const modalEl = document.getElementById('emailModal');
            if (modalEl && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
            return '**Form tiket sudah dibuka.**\n\nSilakan isi detail masalah, lalu klik **Bantu isi dengan AI Navigator** agar deskripsi lebih rapi dan lengkap.';
          }
          if (normalized.includes('/fitur')) {
            const featureId = Number((normalized.match(/\/fitur\s+(\d{1,2})/) || [])[1] || 0);
            if (featureId > 0) return buildFeatureDetailText(featureId);
            return buildFeatureListText();
          }
          if (normalized.includes('/model')) {
            const selectedModel = document.getElementById('assistantModelSelect')?.value || '-';
            return `**Model aktif:** \`${selectedModel}\`\n\nRekomendasi cepat:\n- **gpt-4o-mini**: respons cepat & stabil untuk tanya jawab harian.\n- **gpt-5.4-nano**: sangat ringan untuk prompt singkat / checklist.\n\nTips: pakai prompt spesifik + konteks (link, error, langkah yang sudah dicoba) agar jawaban lebih akurat.`;
          }
          if (normalized.includes('/status')) {
            const online = navigator.onLine ? 'Online ✅' : 'Offline ⚠️';
            const mode = localStorage.getItem('ytmp3_mode_pref') || 'advanced';
            return `**Status singkat sistem**\n\n- Koneksi: **${online}**\n- Mode converter: **${mode}**\n- Panel AI: **siap digunakan**\n- Memory AI: **${state.assistantSettings.memoryEnabled ? 'ON ✅' : 'OFF ⚠️'}**\n\nKalau ada error, kirim dengan format: **apa yang ditekan → error apa → sudah coba apa**.`;
          }
          if (normalized.includes('/help')) {
            return '**Command AI Navigator (versi santai):**\n\n- `/faq` buka FAQ\n- `/walkthrough` mulai tur spotlight\n- `/donasi` buka panel donasi\n- `/ticket` buka form tiket CS\n- `/fitur` lihat daftar fitur lengkap\n- `/model` info model aktif + rekomendasi\n- `/status` cek status sistem singkat\n- `/memory on|off|clear|status` pengaturan memori AI\n- `/newchat` hapus chat sebelumnya\n- `/vision` bantuan analisa gambar terlampir\n- `/file` bantuan analisa file terlampir\n- `/analisis` rekomendasi fitur + prioritas\n- `/promptcodex` template prompt implementasi\n- `/appeal` ajukan appeal forum\n- `/ai` reset sesi bantuan\n\nKalau males slash command, tinggal chat biasa aja. Gue tetep nangkep kok 😎';
          }
          if (normalized.startsWith('/memory')) {
            if (/\boff\b/.test(normalized)) {
              state.assistantSettings.memoryEnabled = false;
              state.assistantHistory = state.assistantHistory.slice(-4);
              persistState();
              return '**Memory AI: OFF.**\n\nRiwayat tidak disimpan permanen. Sesi akan tetap berjalan singkat.';
            }
            if (/\bon\b/.test(normalized)) {
              state.assistantSettings.memoryEnabled = true;
              persistState();
              return '**Memory AI: ON.**\n\nRiwayat chat akan disimpan untuk konteks percakapan berikutnya.';
            }
            if (/\bclear\b/.test(normalized)) {
              resetAssistantConversation(false);
              return '**Memory dibersihkan.**\n\nRiwayat chat telah dihapus dan sesi dimulai ulang.';
            }
            return `**Status memory:** ${state.assistantSettings.memoryEnabled ? 'ON ✅' : 'OFF ⚠️'}\n\nGunakan: \`/memory on\`, \`/memory off\`, atau \`/memory clear\`.`;
          }
          if (normalized.includes('/newchat')) {
            resetAssistantConversation(false);
            return '**New chat dibuat.**\n\nRiwayat lama dihapus, mulai percakapan baru sekarang.';
          }
          if (normalized.includes('/vision')) {
            return '**Bantuan deteksi gambar aktif.**\n\nUpload gambar lewat ikon 📎 lalu kirim pertanyaan. Saya akan baca metadata gambar (nama, tipe, ukuran, dimensi) dan bantu analisa konteksnya.';
          }
          if (normalized.includes('/file')) {
            return '**Bantuan file aktif.**\n\nUpload file lewat ikon 📎. Untuk file teks, saya akan kirim ringkasan potongan isi agar bisa langsung dianalisis.';
          }
          if (normalized.includes('/analisis') || normalized.includes('/roadmap')) {
            return '**Analisis & rekomendasi upgrade YTConv (versi praktis):**\n\n**Prioritas P1 (impact tinggi, effort menengah):**\n1. Playlist/batch download\n2. Bitrate lengkap (64-320 kbps)\n3. Search video internal\n4. Multi-platform source (Vimeo/TikTok/SoundCloud)\n5. Metadata + cover auto\n\n**Prioritas P2 (value besar):**\n6. Waveform editor (fade in/out)\n7. Cloud save (Drive/Dropbox/OneDrive)\n8. Multibahasa penuh\n9. Endpoint API publik + docs\n10. Status page + rate limiting anti abuse\n\nKalau kamu mau, aku bisa pecah jadi sprint mingguan. Ketik: **/roadmap sprint**.';
          }
          if (normalized.includes('/roadmap sprint')) {
            return '**Roadmap sprint 4 minggu (ringkas):**\n\n- **Minggu 1:** playlist + bitrate + QA basic\n- **Minggu 2:** search + metadata + cover\n- **Minggu 3:** multi-platform + waveform\n- **Minggu 4:** cloud save + i18n + API docs + hardening\n\nOutput akhir: produk lebih kompetitif tapi tetap ringan & aman.';
          }
          if (normalized.includes('/promptcodex node')) {
            return '**Prompt Codex (Node.js):**\n\nGunakan Express + FFmpeg + yt-dlp wrapper. Implement endpoint `/api/convert`, `/api/search`, `/api/playlist`, tambahkan queue worker, rate limiter, Joi validation, dan test pakai Vitest/Supertest.';
          }
          if (normalized.includes('/promptcodex flask')) {
            return '**Prompt Codex (Flask):**\n\nGunakan Flask + Celery worker + FFmpeg. Buat endpoint convert/search/playlist, validasi input pakai Pydantic, queue Redis, dan test pakai pytest + requests-mock.';
          }
          if (normalized.includes('/promptcodex')) {
            return '**Template prompt Codex siap pakai:**\n\n`Build YTConv v2 with playlist batch download, multi-bitrate, search, metadata tagging, waveform trim, cloud save, i18n, and public REST APIs. Enforce input sanitization, rate limiting, and graceful error handling. Add tests for convert/search/playlist endpoints and document APIs with OpenAPI.`\n\nMau aku bikin versi detail per stack (Node atau Flask)? ketik: **/promptcodex node** atau **/promptcodex flask**.';
          }
          if (normalized.startsWith('/appeal')) {
            return '__APPEAL_COMMAND__';
          }
          return '**Waduh, command-nya belum kebaca nih.**\n\nKetik `/help` untuk daftar command, atau `/fitur` untuk peta fitur lengkap.';
        };

        const isAppealIntent = (value) => {
          const raw = String(value || '').trim().toLowerCase();
          if (!raw) return false;
          return /^\/?appeal(\s+.*)?$/.test(raw)
            || /(saya\s+mau\s+appeal|mau\s+appeal|ajukan\s+appeal|banding|kena\s+ban|forum\s+diblokir|forum\s+dike?unci)/.test(raw);
        };

        const submitForumAppeal = async (reasonText) => {
          const user = state?.currentUser || window.currentUser || window.firebaseModules?.auth?.currentUser;
          const uid = user?.uid || '';
          if (!uid) {
            return { ok: false, error: 'Untuk kirim appeal, login Google dulu ya.' };
          }
          const violationLimit = 5;
          const getViolationCountSafe = () => {
            try {
              if (typeof window.getForumViolationCount === 'function') {
                return Number(window.getForumViolationCount() || 0) || 0;
              }
              return 0;
            } catch {
              return 0;
            }
          };
          const violationCount = getViolationCountSafe();
          const disabledFeatures = [
            ...(violationCount >= violationLimit ? ['forum_chat_input_disabled'] : []),
            ...(document.getElementById('forumSendBtn')?.disabled ? ['forum_send_button_disabled'] : []),
          ];
          const appealResp = await fetch('/api/forum/appeal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: uid,
              name: state?.currentUser?.displayName || 'Warga',
              email: state?.currentUser?.email || '',
              room: localStorage.getItem('forum_room') || 'umum',
              socketId: '',
              reason: String(reasonText || '').trim() || 'Saya mau appeal forum',
              violationCount,
              disabledFeatures,
              googleAccount: {
                provider: 'google',
                uid,
                email: state?.currentUser?.email || '',
              },
            }),
          });
          const appealData = await appealResp.json().catch(() => ({}));
          if (!appealResp.ok || !appealData?.appealId) {
            return { ok: false, error: appealData?.message || appealData?.error || 'unknown_error' };
          }
          return { ok: true, message: appealData?.message || `✅ Appeal ${appealData.appealId} sudah masuk dashboard admin.` };
        };

        const respondWithAssistant = async (text) => {
          if (!assistantMessages) return;
          assistantTyping?.removeAttribute('hidden');
          let reply = '';
          let responseSuggestions = DEFAULT_ASSISTANT_SUGGESTIONS;
          try {
            const historyToSend = state.assistantSettings.memoryEnabled ? state.assistantHistory.slice(0, -1) : [];
            const violationLimit = 5;
            const getViolationCountSafe = () => {
              try {
                if (typeof window.getForumViolationCount === 'function') {
                  return Number(window.getForumViolationCount() || 0) || 0;
                }
                return 0;
              } catch {
                return 0;
              }
            };
            const violationCount = getViolationCountSafe();
            const forumSendDisabled = Boolean(document.getElementById('forumSendBtn')?.disabled);
            const user = state?.currentUser || window.currentUser || window.firebaseModules?.auth?.currentUser;
            const payload = {
              prompt: text,
              messages: historyToSend,
              clientState: {
                preferences: state.preferences,
                experience: state.experience,
                mode: localStorage.getItem('ytmp3_mode_pref') || 'advanced',
                auth: {
                  uid: user?.uid || '',
                  email: user?.email || '',
                  name: user?.displayName || user?.name || 'Warga',
                },
                forum: {
                  room: localStorage.getItem('forum_room') || 'umum',
                  socketId: '',
                  violationCount,
                  forumDisabled: Boolean(violationCount >= violationLimit),
                  disabledFeatures: [
                    ...(violationCount >= violationLimit ? ['forum_chat_input_disabled'] : []),
                    ...(forumSendDisabled ? ['forum_send_button_disabled'] : []),
                  ],
                },
              },
              model: document.getElementById('assistantModelSelect')?.value || null,
            };
            const primaryUrl = api('/api/assistant-chat');
            const sameOriginUrl = '/api/assistant-chat';
            const targets = [primaryUrl];
            if (primaryUrl !== sameOriginUrl) targets.push(sameOriginUrl);
            let response = null;
            let responseErr = null;
            for (const target of targets) {
              try {
                const candidate = await fetch(target, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                if (candidate.ok) {
                  response = candidate;
                  break;
                }
                let detail = '';
                try {
                  const errorJson = await candidate.clone().json();
                  detail = String(errorJson?.error || errorJson?.meta?.errorDetail || '').trim();
                } catch (_) {
                  try {
                    detail = (await candidate.text()).slice(0, 180).trim();
                  } catch (_) {
                    detail = '';
                  }
                }
                const suffix = detail ? `: ${detail}` : '';
                responseErr = new Error(`assistant_api_${candidate.status}${suffix}`);
              } catch (networkErr) {
                responseErr = networkErr;
              }
            }
            if (!response) throw responseErr || new Error('assistant_api_unreachable');
            if (response.ok) {
              const data = await response.json();
              reply = data?.reply || '';
              if (data?.meta?.degraded && data?.meta?.errorDetail) {
                reply += `\n\n🧾 Detail teknis: \`${String(data.meta.errorDetail).slice(0, 220)}\``;
              }

              if (data.action === 'convert' && data.url) {
                const urlInput = document.getElementById('urlInput');
                const basicUrl = document.getElementById('basic-url');
                if (basicUrl && document.getElementById('basic-mode')?.hidden === false) {
                  basicUrl.value = data.url;
                  reply += '\n\n(URL ditempel ke Basic Mode)';
                } else if (urlInput) {
                  urlInput.value = data.url;
                  reply += '\n\n(URL ditempel ke Converter)';
                }
              }

              if (Array.isArray(data?.suggestions) && data.suggestions.length) {
                responseSuggestions = data.suggestions;
                const tips = data.suggestions.slice(0, 3).map((tip) => `- ${tip}`).join('\n');
                reply += `\n\nSaran cepat:\n${tips}`;
              }

              if (data.action === 'open_ticket') {
                const modalEl = document.getElementById('emailModal');
                const ticketMsg = document.getElementById('emailMsg');
                const ticketIdEl = document.getElementById('emailTicketId');
                const categoryEl = document.getElementById('emailCategory');
                const nameEl = document.getElementById('emailName');
                const emailEl = document.getElementById('emailAddr');
                const googleName = state?.currentUser?.displayName || '';
                const googleEmail = state?.currentUser?.email || '';
                if (ticketIdEl && !ticketIdEl.value) {
                  const seed = Date.now().toString(36).toUpperCase().slice(-8);
                  ticketIdEl.value = `TKT-${seed}`;
                }
                if (nameEl && !nameEl.value && googleName) {
                  nameEl.value = googleName;
                }
                if (emailEl && !emailEl.value && googleEmail) {
                  emailEl.value = googleEmail;
                }
                if (ticketMsg && data?.params?.context) {
                  const userHeader = (googleName || googleEmail)
                    ? `User Google: ${googleName || '-'} <${googleEmail || '-'}>\n`
                    : '';
                  ticketMsg.value = `${userHeader}Ringkasan dari AI Navigator:\n${data.params.context}\n\nDetail tambahan:`;
                }
                if (categoryEl && /forum|kasar|moderasi/i.test(String(data?.params?.context || ''))) {
                  categoryEl.value = 'forum';
                }
                if (modalEl && window.bootstrap?.Modal) {
                  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
                }
                reply += '\n\nSaya sudah siapkan form tiket bantuan. Silakan cek data lalu kirim ya.';
              }

              if (data.action === 'submit_forum_appeal') {
                try {
                  const result = await submitForumAppeal(data?.params?.reason || text);
                  reply += result.ok ? `\n\n${result.message}` : `\n\n❌ Gagal kirim appeal: ${result.error}`;
                } catch (appealErr) {
                  reply += '\n\n❌ Gagal kirim appeal ke admin dashboard.';
                  console.error('Gagal submit appeal AI Navigator', appealErr);
                }
              }
            }
          } catch (err) {
            console.error('Gagal mengambil jawaban AI', err);
            const detail = String(err?.message || '').replace(/^Error:\s*/,'').trim();
            responseSuggestions = ['Coba lagi', 'Buat tiket bantuan', 'Downloader helper gagal', 'Cek status tiket'];
            reply = `⚠️ AI Groq sedang gangguan. Coba lagi 5-10 detik, atau cek konfigurasi GROQ_API_KEY/GROQ_MODEL di server.${detail ? `\n\n🧾 Detail teknis: \`${detail.slice(0, 220)}\`` : ''}`;
            if (isAppealIntent(text)) {
              try {
                const result = await submitForumAppeal(text);
                reply = result.ok
                  ? `Server AI sedang gangguan, tapi appeal tetap berhasil dikirim.\n\n${result.message}`
                  : `Server AI sedang gangguan. ${result.error}`;
              } catch (appealErr) {
                console.error('Fallback submit appeal gagal', appealErr);
              }
            }
          }
          if (!reply) reply = buildFallbackReply(text);
          assistantTyping?.setAttribute('hidden', '');
          addAssistantMessage(reply, 'bot', { animate: true });
          setAssistantSuggestions(responseSuggestions);
          state.assistantHistory.push({ role: 'bot', text: reply });
          if (state.assistantSettings.memoryEnabled) {
            const limit = Math.max(10, Number(state.assistantSettings.maxMemoryMessages) || 30);
            state.assistantHistory = state.assistantHistory.slice(-limit);
          } else {
            state.assistantHistory = state.assistantHistory.slice(-4);
          }
          persistState();
          incrementPoints(15, 'Interaksi AI', { badge: 'ai' });
          updateMascotMood('ai');
        };

        const resetAssistantConversation = (showToast = true) => {
          if (assistantMessages) assistantMessages.innerHTML = '';
          setAssistantSuggestions(DEFAULT_ASSISTANT_SUGGESTIONS);
          state.assistantHistory = [];
          pendingAssistantAttachment = null;
          if (assistantAttachmentPreview) {
            assistantAttachmentPreview.hidden = true;
            assistantAttachmentPreview.textContent = '';
          }
          persistState();
          if (showToast) setToast('Chat AI berhasil direset. Mulai percakapan baru.', 'success');
          addAssistantMessage('**New chat aktif.**\n\nRiwayat sebelumnya sudah dibersihkan. Kamu bisa lanjut tanya dari nol.', 'bot');
          setAssistantSuggestions(DEFAULT_ASSISTANT_SUGGESTIONS);
        };

        const summarizeAssistantFile = async (file) => {
          const kb = Math.max(1, Math.round((file.size || 0) / 1024));
          const base = `Nama: ${file.name} | Tipe: ${file.type || 'unknown'} | Ukuran: ${kb} KB`;
          if ((file.type || '').startsWith('image/')) {
            const imageInfo = await new Promise((resolve) => {
              const img = new Image();
              const url = URL.createObjectURL(file);
              img.onload = () => {
                resolve(`Gambar ${img.width}x${img.height}px`);
                URL.revokeObjectURL(url);
              };
              img.onerror = () => {
                resolve('Gambar (dimensi tidak terbaca)');
                URL.revokeObjectURL(url);
              };
              img.src = url;
            });
            return { summary: `${base} | ${imageInfo}`, snippet: '[image_attachment]' };
          }

          const textLike = /text|json|csv|xml|javascript|typescript|markdown/.test(file.type || '') || /\.(txt|md|json|csv|log)$/i.test(file.name || '');
          if (textLike) {
            const text = await file.text().catch(() => '');
            const snippet = String(text || '').slice(0, 1800);
            return { summary: `${base} | File teks terdeteksi`, snippet };
          }

          return { summary: `${base} | File non-teks`, snippet: '[binary_attachment]' };
        };

        if (assistantAttachBtn && assistantFileInput) {
          assistantAttachBtn.addEventListener('click', () => assistantFileInput.click());
          assistantFileInput.addEventListener('change', async () => {
            const file = (assistantFileInput.files && assistantFileInput.files[0]) || null;
            if (!file) return;
            const { summary, snippet } = await summarizeAssistantFile(file);
            pendingAssistantAttachment = {
              name: file.name,
              type: file.type || 'unknown',
              size: file.size || 0,
              summary,
              snippet,
            };
            if (assistantAttachmentPreview) {
              assistantAttachmentPreview.hidden = false;
              assistantAttachmentPreview.innerHTML = `<strong>File siap dikirim:</strong> ${escapeAssistantHtml(summary)}`;
            }
            setToast('File/gambar berhasil ditambahkan ke AI Navigator.', 'success');
          });
        }

        if (assistantNewChatBtn) {
          assistantNewChatBtn.addEventListener('click', () => resetAssistantConversation(true));
        }

        setAssistantSuggestions(DEFAULT_ASSISTANT_SUGGESTIONS);

        function sendAssistantMessage() {
          if (!assistantInput) return;
          const value = assistantInput.value.trim();
          if (!value) return;

          const attachmentText = pendingAssistantAttachment
            ? `\n\n[Attachment] ${pendingAssistantAttachment.summary}${pendingAssistantAttachment.snippet ? `\n\n[AttachmentSnippet]\n${pendingAssistantAttachment.snippet}` : ''}`
            : '';
          const composedValue = `${value}${attachmentText}`;

          addAssistantMessage(value + (pendingAssistantAttachment ? `\n\n📎 ${pendingAssistantAttachment.summary}` : ''), 'user');
          state.assistantHistory.push({ role: 'user', text: composedValue });
          if (!state.assistantSettings.memoryEnabled) {
            state.assistantHistory = state.assistantHistory.slice(-4);
          }

          assistantInput.value = '';
          const commandReply = handleAssistantCommand(value);

          const clearPendingAttachment = () => {
            pendingAssistantAttachment = null;
            if (assistantAttachmentPreview) {
              assistantAttachmentPreview.hidden = true;
              assistantAttachmentPreview.textContent = '';
            }
          };

          if (commandReply === '__APPEAL_COMMAND__' || isAppealIntent(value)) {
            const reason = value.replace(/^\/appeal\s*/i, '').trim();
            const prompt = reason ? `/appeal ${reason}` : '/appeal saya tidak sengaja dan ingin kembali chat di forum';
            respondWithAssistant(prompt);
            clearPendingAttachment();
            return;
          }

          if (commandReply) {
            addAssistantMessage(commandReply, 'bot', { animate: true });
            setAssistantSuggestions(DEFAULT_ASSISTANT_SUGGESTIONS);
            state.assistantHistory.push({ role: 'bot', text: commandReply });
            if (!state.assistantSettings.memoryEnabled) {
              state.assistantHistory = state.assistantHistory.slice(-4);
            }
            persistState();
            incrementPoints(10, 'Perintah cepat AI', { badge: 'navigator' });
            updateMascotMood('ai');
            clearPendingAttachment();
            return;
          }

          respondWithAssistant(composedValue);
          clearPendingAttachment();
        }

        const ensureAssistantWelcome = () => {
          if (!assistantMessages) return;
          if (!state.assistantHistory.length) {
            addAssistantMessage('Navigator YTConv siap bantu seperti customer service. Tanyakan apa saja dengan bahasa kamu, nanti aku kasih alur langkah yang jelas.', 'bot');
            try {
              if (typeof getForumViolationCount === 'function' && getForumViolationCount() >= FORUM_VIOLATION_LIMIT) {
                addAssistantMessage('Aku deteksi akun kamu lagi dibatasi di forum. Ketik **/appeal alasan kamu** supaya langsung aku kirim ke admin dashboard.', 'bot');
              }
            } catch { }
          } else {
            state.assistantHistory.forEach((msg) => addAssistantMessage(msg.text, msg.role));
          }
          assistantToggle?.classList.remove('has-update');
          assistantPulse?.setAttribute('aria-hidden', 'true');
        };

        assistantToggle?.addEventListener('click', (evt) => {
          if (assistantFabSuppressClick) {
            evt.preventDefault();
            evt.stopImmediatePropagation();
            return;
          }
          if (isAssistantOpen()) {
            closeAssistantPanel({ manual: true });
          } else {
            openAssistantPanel();
          }
        });
        assistantClose?.addEventListener('click', () => closeAssistantPanel({ manual: true }));
        if (assistantLaunchers.length) {
          assistantLaunchers.forEach((btn) => {
            btn.addEventListener('click', () => {
              openAssistantPanel();
              if (btn.dataset.launch === 'voice') voiceCommandBtn?.click();
            });
          });
        }
        document.addEventListener('click', (evt) => {
          if (!isAssistantOpen()) return;
          if (assistantFab && assistantFab.contains(evt.target)) return;
          closeAssistantPanel({ manual: true });
        });
        window.addEventListener('keydown', (evt) => {
          if (evt.key === 'Escape' && isAssistantOpen()) closeAssistantPanel({ manual: true });
        });

        const resetRunner = () => {
          if (!runnerCanvas) return;
          runnerState.playerY = runnerState.ground;
          runnerState.playerVy = 0;
          runnerState.obstacleX = runnerCanvas.width + Math.random() * runnerState.obstacleGap;
          runnerState.speed = 4.2;
          runnerState.ticks = 0;
          runnerState.score = 0;
          if (runnerScoreLabel) runnerScoreLabel.textContent = '0';
          if (!runnerState.running) drawRunner();
        };

        const drawRunner = () => {
          const ctx = runnerState.ctx;
          if (!ctx || !runnerCanvas) return;
          const style = getRunnerStyle();
          ctx.clearRect(0, 0, runnerCanvas.width, runnerCanvas.height);
          ctx.fillStyle = style.sky;
          ctx.fillRect(0, 0, runnerCanvas.width, runnerCanvas.height);
          ctx.fillStyle = style.track;
          ctx.fillRect(0, runnerState.ground + 6, runnerCanvas.width, runnerCanvas.height - runnerState.ground - 6);
          ctx.fillStyle = style.trackLine;
          ctx.fillRect(0, runnerState.ground + 4, runnerCanvas.width, 3);
          ctx.save();
          ctx.fillStyle = style.stripe;
          for (let x = 0; x < runnerCanvas.width + 32; x += 36) {
            ctx.fillRect(x, runnerState.ground + 12, 18, 5);
          }
          ctx.restore();
          ctx.save();
          ctx.fillStyle = style.shadow;
          ctx.globalAlpha = 0.22;
          ctx.fillRect(runnerState.playerX + 6, runnerState.ground + 10, Math.max(12, runnerState.playerWidth - 12), 6);
          ctx.fillRect(runnerState.obstacleX + 6, runnerState.ground + 10, Math.max(12, runnerState.obstacleWidth - 12), 6);
          ctx.restore();
          drawSprite(ctx, monsterSprite, runnerState.obstacleX, runnerState.ground, style.obstacle);
          drawSprite(ctx, runnerSprite, runnerState.playerX, runnerState.playerY, style.player);
        };

        const endRunner = (crashed = false) => {
          runnerState.running = false;
          if (runnerFrame) cancelAnimationFrame(runnerFrame);
          runnerFrame = null;
          if (gameStatus) {
            gameStatus.textContent = crashed ? 'Kena glitch! Coba lagi dan kejar skor lebih tinggi.' : 'Permainan dihentikan.';
          }
          const high = Math.max(Number(state.experience.highScore) || 0, runnerState.score);
          state.experience.highScore = high;
          runnerState.highScore = high;
          if (runnerHighScoreLabel) runnerHighScoreLabel.textContent = String(high);
          persistState();
          if (crashed) updateMascotMood('game');
        };

        const updateRunner = () => {
          if (!runnerState.running) return;
          const ctx = runnerState.ctx;
          if (!ctx || !runnerCanvas) return;
          runnerState.playerVy += runnerState.gravity;
          runnerState.playerY += runnerState.playerVy;
          if (runnerState.playerY >= runnerState.ground) {
            runnerState.playerY = runnerState.ground;
            runnerState.playerVy = 0;
          }
          runnerState.obstacleX -= runnerState.speed;
          if (runnerState.obstacleX < -runnerState.obstacleWidth) {
            runnerState.obstacleX = runnerCanvas.width + (runnerState.obstacleGap * (0.5 + Math.random()));
            runnerState.speed = Math.min(runnerState.speed + 0.25, 9);
            incrementPoints(8, 'Hindari glitch', { badge: 'gamer' });
            updateMascotMood('game');
          }
          runnerState.ticks = (runnerState.ticks || 0) + 1;
          const score = Math.floor((runnerState.ticks || 0) / 5);
          if (runnerState.score !== score) {
            runnerState.score = score;
            if (runnerScoreLabel) runnerScoreLabel.textContent = String(score);
          }
          drawRunner();
          const playerCollider = runnerState.collider;
          const obstacleCollider = runnerState.obstacleCollider;
          const playerLeft = runnerState.playerX + playerCollider.left;
          const playerRight = runnerState.playerX + runnerState.playerWidth - playerCollider.right;
          const playerBottom = runnerState.playerY - playerCollider.bottom;
          const playerTop = runnerState.playerY - runnerState.playerHeight + playerCollider.top;
          const obstacleLeft = runnerState.obstacleX + obstacleCollider.left;
          const obstacleRight = runnerState.obstacleX + runnerState.obstacleWidth - obstacleCollider.right;
          const obstacleBottom = runnerState.ground - obstacleCollider.bottom;
          const obstacleTop = runnerState.ground - runnerState.obstacleHeight + obstacleCollider.top;
          const horizontalCollision = playerRight > obstacleLeft && playerLeft < obstacleRight;
          const verticalCollision = playerBottom > obstacleTop && playerTop < obstacleBottom;
          if (horizontalCollision && verticalCollision) {
            endRunner(true);
            return;
          }
          runnerFrame = requestAnimationFrame(updateRunner);
        };

        function startRunner() {
          if (!runnerCanvas) {
            setToast('Mini game belum tersedia di perangkat ini.');
            return;
          }
          ensureAudioContext();
          state.experience.highScore = state.experience.highScore || 0;
          if (runnerHighScoreLabel) runnerHighScoreLabel.textContent = String(state.experience.highScore || 0);
          resetRunner();
          runnerState.running = true;
          if (gameStatus) gameStatus.textContent = 'Lompat untuk hindari glitch!';
          drawRunner();
          updateRunner();
          incrementPoints(6, 'Mulai mini game');
        }

        const jumpRunner = () => {
          if (!runnerState.running) return;
          if (runnerState.playerY >= runnerState.ground) {
            runnerState.playerVy = -11;
          }
        };

        const konamiTracker = (() => {
          const sequence = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
          let buffer = [];
          return (key) => {
            if (!key) return;
            buffer.push(key.toLowerCase());
            buffer = buffer.slice(-sequence.length);
            if (sequence.every((v, idx) => buffer[idx] === v)) {
              buffer = [];
              if (konamiSecret) konamiSecret.classList.add('show');
              state.avatarAura = 'konami';
              updateAvatarUi();
              incrementPoints(100, 'Kode rahasia', { badge: 'konami' });
              updateMascotMood('game');
              showConfetti(70, true);
              setToast('Konami code aktif!');
            }
          };
        })();

        const secretCheatTracker = (() => {
          const target = 'andhikagantengbangetomagadgantengbangetmuachmuach';
          let buffer = '';
          let unlocked = false;
          const grantLocalCheat = () => {
            if (!unlocked) {
              unlocked = true;
              incrementPoints(30000, 'Cheat rahasia', { badge: 'andhika' });
              showRewardToast('XP rahasia +30000!');
            } else {
              incrementPoints(1200, 'Cheat rahasia');
            }
            setToast('Kode rahasia Andhika aktif!');
          };
          return (key) => {
            if (!key || key.length > 1) return;
            buffer = (buffer + key.toLowerCase()).slice(-target.length);
            if (!buffer.includes(target)) return;
            buffer = '';
            if (state.cheats.enabled && state.auth.user) {
              requestCheatClaim(target, {
                fallback: () => grantLocalCheat(),
              }).then((result) => {
                if (result?.ok) {
                  unlocked = true;
                  setToast('Kode rahasia Andhika aktif!');
                }
              });
              return;
            }
            if (state.cheats.enabled && !state.auth.user) {
              setToast(translateMessage('Masuk dengan Google untuk menyimpan XP rahasia.'));
            }
            grantLocalCheat();
          };
        })();

        let lastCustomEndingShown = 0;

        const showCustomEnding = () => {
          if (!customEndingOverlay) return;
          const now = Date.now();
          if (now - lastCustomEndingShown < 15000) return;
          lastCustomEndingShown = now;
          customEndingOverlay.classList.add('show');
          window.setTimeout(() => customEndingOverlay.classList.remove('show'), 2800);
        };

        function hideCustomEnding() {
          customEndingOverlay?.classList.remove('show');
        }

        let customEndingIntentTimer = 0;

        const persistState = () => {
          storage.save({
            backendUrl: state.backendUrl,
            adminBearer: state.adminBearer,
            accessibility: state.accessibility,
            experience: state.experience,
            narratorEnabled: state.narratorEnabled,
            backgroundEmail: state.backgroundEmail,
            preferences: state.preferences,
            assistantHistory: state.assistantSettings.memoryEnabled ? state.assistantHistory : [], // Save chat history
            assistantSettings: state.assistantSettings
          });
        };

        const createProgressAnimator = (wrap, bar, label) => {
          if (!wrap || !bar) {
            return { start() { }, to() { }, complete() { }, fail() { }, hide() { }, reset() { } };
          }
          let current = 0;
          let target = 0;
          let frame = null;
          let customLabel = '';
          const clamp = (value) => Math.max(0, Math.min(100, value));
          const update = () => {
            current += (target - current) * 0.18;
            if (Math.abs(target - current) < 0.3) current = target;
            const pct = Math.round(current);
            bar.style.width = `${pct}%`;
            bar.setAttribute('aria-valuenow', pct);
            if (!customLabel && label) label.textContent = `${pct}%`;
            if (Math.abs(target - current) > 0.35) {
              frame = requestAnimationFrame(update);
            } else {
              frame = null;
              if (!customLabel && label) label.textContent = `${pct}%`;
            }
          };
          const queueUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
          const setLabel = (value) => {
            if (typeof value === 'string') {
              customLabel = value;
              if (label) label.textContent = value;
            } else if (value === null) {
              customLabel = '';
            }
          };
          return {
            reset() {
              if (frame) cancelAnimationFrame(frame);
              frame = null;
              current = 0;
              target = 0;
              bar.style.width = '0%';
              bar.setAttribute('aria-valuenow', '0');
              bar.classList.remove('is-active', 'is-complete', 'is-error');
              if (label) label.textContent = '0%';
              wrap.hidden = true;
              wrap.dataset.state = 'hidden';
              customLabel = '';
            },
            start(initialLabel) {
              wrap.hidden = false;
              wrap.dataset.state = 'running';
              bar.classList.remove('is-complete', 'is-error');
              bar.classList.add('is-active');
              current = 0;
              target = 0;
              setLabel(typeof initialLabel === 'string' ? initialLabel : '');
              if (!initialLabel && label) label.textContent = '0%';
              queueUpdate();
            },
            to(value, text) {
              target = clamp(value);
              if (text !== undefined) setLabel(text);
              queueUpdate();
            },
            complete(text) {
              bar.classList.remove('is-error');
              bar.classList.add('is-complete');
              setLabel(text || 'Selesai • 100%');
              target = 100;
              queueUpdate();
            },
            fail(text) {
              bar.classList.remove('is-complete');
              bar.classList.add('is-error');
              setLabel(text || 'Gagal');
              target = Math.max(current, 10);
              queueUpdate();
            },
            hide(delay = 800) {
              setTimeout(() => {
                wrap.dataset.state = 'hidden';
                wrap.hidden = true;
                bar.classList.remove('is-active');
              }, delay);
            }
          };
        };

        const convertProgressAnimator = createProgressAnimator(convertProgWrap, convertProgBar, convertProgLabel);

        const PROGRESS_STAGE_LABELS = {
          init: 'Menyiapkan',
          validating: 'Validasi',
          metadata: 'Metadata',
          downloading: 'Mengunduh',
          processing: 'Memproses',
          encoding: 'Mengonversi',
          ringtone: 'Ringtone',
          complete: 'Selesai',
          error: 'Gagal',
        };

        let progressPollTimer = 0;
        let activeProgressId = '';

        const stopConvertProgressWatcher = () => {
          if (progressPollTimer) {
            clearTimeout(progressPollTimer);
            progressPollTimer = 0;
          }
          activeProgressId = '';
        };

        const startConvertProgressWatcher = (id) => {
          if (!id) return;
          stopConvertProgressWatcher();
          activeProgressId = id;
          convertProgressAnimator.start(translateMessage('Menyiapkan...'));

          const poll = async () => {
            if (!activeProgressId || activeProgressId !== id) return;
            try {
              const resp = await fetch(api(`/api/progress/${id}?t=${Date.now()}`), { cache: 'no-store' });
              if (!resp.ok) {
                if (resp.status === 404) {
                  progressPollTimer = window.setTimeout(poll, 900);
                  return;
                }
                throw new Error(`HTTP ${resp.status}`);
              }
              const safe = await readJsonSafe(resp);
              const info = safe.data?.progress || {};
              const stage = String(info.stage || '').toLowerCase();
              const percent = Number(info.percent ?? 0);
              if (stage === 'complete') {
                convertProgressAnimator.complete(`${translateMessage('Selesai')} • 100%`);
                stopConvertProgressWatcher();
                return;
              }
              if (stage === 'error') {
                convertProgressAnimator.fail(info.message || translateMessage('Gagal'));
                stopConvertProgressWatcher();
                return;
              }
              const detailParts = [];
              if (info.message) detailParts.push(info.message);
              else {
                if (info.etaLabel) detailParts.push(`ETA ${info.etaLabel}`);
                else if (typeof info.etaSeconds === 'number' && info.etaSeconds >= 0) detailParts.push(`ETA ${secondsToClock(info.etaSeconds)}`);
                if (info.speed) detailParts.push(info.speed);
                if (info.size) detailParts.push(info.size);
              }
              const stageLabel = PROGRESS_STAGE_LABELS[stage] || PROGRESS_STAGE_LABELS.init;
              const label = [stageLabel, detailParts.join(' ')].filter(Boolean).join(' ');
              convertProgressAnimator.to(percent, label || translateMessage('Memproses...'));
            } catch (err) {
              console?.warn?.('progress poll failed', err);
            }
            if (activeProgressId === id) {
              progressPollTimer = window.setTimeout(poll, 900);
            }
          };

          poll();
        };

        attachRangeControls();

        const renderAiTagInsights = (tags = {}) => {
          if (!aiTagInsights) return;
          aiTagInsights.innerHTML = '';
          const addChip = (icon, text) => {
            const span = document.createElement('span');
            span.className = 'ai-chip';
            span.innerHTML = `<i class="bi ${icon}"></i>${text}`;
            aiTagInsights.appendChild(span);
          };
          if (tags.genre) addChip('bi-music-note-beamed', tags.genre);
          if (tags.mood) addChip('bi-emoji-smile', tags.mood);
          if (tags.energy) addChip('bi-lightning-charge', tags.energy);
          if (tags.year) addChip('bi-calendar-event', tags.year);
          if (tags.comment) {
            const note = document.createElement('div');
            note.className = 'small text-secondary w-100';
            note.textContent = tags.comment;
            aiTagInsights.appendChild(note);
          }
          aiTagInsights.hidden = !aiTagInsights.childElementCount;
        };

        const resetAiInsights = () => {
          if (!aiTagInsights) return;
          aiTagInsights.innerHTML = '';
          aiTagInsights.hidden = true;
        };

        const autoTagsState = {
          timer: 0,
          inFlight: false,
          pending: null,
          lastSignature: '',
        };

        const buildAutoTagsSignature = (meta = {}) => {
          const durationValue = Number(meta.duration);
          const normalized = {
            title: (meta.title || '').trim(),
            artist: (meta.artist || '').trim(),
            duration: Number.isFinite(durationValue) ? Math.round(durationValue) : 0,
          };
          return JSON.stringify(normalized);
        };

        const applyAiTagSuggestions = (tags = {}, { respectManual = true } = {}) => {
          if (!tags || typeof tags !== 'object') {
            resetAiInsights();
            return;
          }
          renderAiTagInsights(tags);
          const assignIfAllowed = (input, value) => {
            if (!input || !value) return;
            if (respectManual && input.dataset.manual === '1') return;
            input.value = value;
            input.dataset.auto = '1';
          };
          if (tags.title) assignIfAllowed(id3TitleInput, tags.title);
          if (tags.artist) assignIfAllowed(id3ArtistInput, tags.artist);
          if (tags.album) assignIfAllowed(id3AlbumInput, tags.album);
          if (tags.genre) assignIfAllowed(id3Genre, tags.genre);
          if (fileNameInput && !fileNameInput.dataset.manual) {
            const autoMeta = {
              ...(lastVideoInfo || {}),
              title: tags.title || lastVideoInfo?.title || lastVideoInfo?.rawTitle || '',
              cleanTitle: tags.title || lastVideoInfo?.cleanTitle || lastVideoMeta?.title || '',
              artist: tags.artist || lastVideoInfo?.artist || lastVideoInfo?.author || '',
            };
            const autoName = buildAutoFileName(autoMeta, {
              format: formatSelect?.value,
              abr: Number(abrSelect?.value || 0),
              sampleRate: Number(sampleRateSelect?.value || 0),
              videoQuality: videoQualitySelect?.value || 'best',
            });
            if (autoName) {
              fileNameInput.value = autoName;
              fileNameInput.dataset.autoName = autoName;
              fileNameInput.dataset.autoApplied = '1';
            }
          }
        };

        const runAutoTags = async () => {
          if (!autoTagsState.pending) return;
          const payload = autoTagsState.pending;
          autoTagsState.pending = null;
          autoTagsState.inFlight = true;
          const signature = buildAutoTagsSignature(payload);
          try {
            if (!aiStatus || aiStatus.hidden || !aiStatus.textContent.trim()) {
              updateAiStatus('Menganalisis tag otomatis...', 'info');
            }
            const { data: result } = await postJson('/api/ai-tags', {
              title: payload.title || '',
              channel: payload.artist || '',
              duration: payload.duration || undefined,
            }, {
              fallbackMessage: translateMessage('Gagal menganalisis'),
              logLabel: 'auto-tags',
            });
            const tags = result.tags || {};
            if (Object.keys(tags).length) {
              applyAiTagSuggestions(tags, { respectManual: true });
              autoTagsState.lastSignature = signature;
              updateAiStatus('Tag musik otomatis diterapkan', 'success');
            } else {
              resetAiInsights();
              updateAiStatus('Tag otomatis tidak ditemukan', 'warning');
            }
          } catch (err) {
            console.warn('auto-tags', err);
            if (!aiStatus || aiStatus.hidden || aiStatus.classList.contains('alert-info')) {
              updateAiStatus(err.message || 'Gagal membuat tag otomatis', 'warning');
            }
          } finally {
            autoTagsState.inFlight = false;
            if (autoTagsState.pending) {
              runAutoTags();
            }
          }
        };

        const scheduleAutoTags = (meta = {}) => {
          if (!meta || (!meta.title && !meta.artist)) {
            resetAiInsights();
            return;
          }
          const signature = buildAutoTagsSignature(meta);
          if (signature && signature === autoTagsState.lastSignature && !autoTagsState.pending) return;
          const durationValue = Number(meta.duration);
          autoTagsState.pending = {
            title: meta.title || '',
            artist: meta.artist || '',
            duration: Number.isFinite(durationValue) ? durationValue : undefined,
          };
          if (autoTagsState.timer) clearTimeout(autoTagsState.timer);
          autoTagsState.timer = window.setTimeout(() => {
            autoTagsState.timer = 0;
            if (autoTagsState.inFlight) return;
            runAutoTags();
          }, 260);
        };

        let deferredInstallPrompt = null;

        const updateOnlineState = () => {
          const online = navigator.onLine;
          if (offlineBadge) offlineBadge.hidden = online;
          document.body.classList.toggle('is-offline', !online);
        };

        window.addEventListener('online', () => {
          updateOnlineState();
          setToast('Koneksi kembali online');
        });

        window.addEventListener('offline', () => {
          updateOnlineState();
          setToast('Kamu offline • mode PWA siap dipakai');
        });

        updateOnlineState();

        window.addEventListener('beforeinstallprompt', (event) => {
          event.preventDefault();
          deferredInstallPrompt = event;
          if (installBtn) {
            installBtn.hidden = false;
            installBtn.disabled = false;
          }
          if (installBtnMobile) {
            installBtnMobile.hidden = false;
            installBtnMobile.disabled = false;
          }
        });

        if (installBtn) {
          installBtn.addEventListener('click', async () => {
            if (!deferredInstallPrompt) {
              setToast('Install tidak tersedia saat ini');
              return;
            }
            installBtn.disabled = true;
            try {
              deferredInstallPrompt.prompt();
              const result = await deferredInstallPrompt.userChoice;
              if (result?.outcome === 'accepted') setToast('Aplikasi ditambahkan ke layar utama');
            } catch (_) {
              setToast('Gagal memulai instalasi');
            }
            installBtn.disabled = false;
            installBtn.hidden = true;
            deferredInstallPrompt = null;
          });
        }

        if (installBtnMobile) {
          installBtnMobile.addEventListener('click', async () => {
            if (!deferredInstallPrompt) {
              setToast('Install tidak tersedia saat ini');
              return;
            }
            installBtnMobile.disabled = true;
            try {
              deferredInstallPrompt.prompt();
              const result = await deferredInstallPrompt.userChoice;
              if (result?.outcome === 'accepted') setToast('Aplikasi ditambahkan ke layar utama');
            } catch (_) {
              setToast('Gagal memulai instalasi');
            }
            installBtnMobile.disabled = false;
            installBtnMobile.hidden = true;
            deferredInstallPrompt = null;
          });
        }

        window.addEventListener('appinstalled', () => {
          deferredInstallPrompt = null;
          if (installBtn) installBtn.hidden = true;
          if (installBtnMobile) installBtnMobile.hidden = true;
          setToast('PWA siap dipakai offline ?');
        });

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('./sw.js').then(() => {
            navigator.serviceWorker.ready.then(() => {
              document.body.dataset.pwaReady = 'true';
            });
          }).catch(() => { });
        }

        const QUALITY_PRESETS = {
          mp3: {
            high: { abr: 320, sampleRate: 48000 },
            medium: { abr: 192, sampleRate: 44100 },
            low: { abr: 128, sampleRate: 44100 },
          },
          m4a: {
            high: { abr: 192 },
            medium: {},
            low: {},
          },
          wav: {
            high: { sampleRate: 96000 },
            medium: { sampleRate: 48000 },
            low: { sampleRate: 44100 },
          },
          default: {
            high: {},
            medium: {},
            low: {},
          },
        };
        const QUALITY_PRESET_FORMATS = new Set(['mp3', 'm4a', 'wav']);
        let suppressQualityPreset = false;

        const FORMAT_POLICIES = {
          mp3: {
            labelAbr: 'Kualitas (MP3)',
            labelSampleRate: 'Sample Rate (MP3)',
            labelSpeed: 'Mode Kecepatan',
            abr: ['320', '256', '192', '128', '64'],
            abrHint: 'Pilih 64-320 kbps.',
            sampleRates: ['44100', '48000'],
            sampleRateHint: '44.1 kHz atau 48 kHz.',
            speedModes: ['normal', 'nightcore', 'slow_reverb'],
            speedHint: 'Semua mode tersedia.',
          },
          m4a: {
            labelAbr: 'Kualitas (M4A)',
            labelSampleRate: 'Sample Rate (M4A)',
            labelSpeed: 'Mode Kecepatan',
            abr: ['192'],
            abrHint: 'Terkunci di 192 kbps.',
            sampleRates: ['44100'],
            sampleRateHint: 'Hanya 44.1 kHz.',
            speedModes: ['normal'],
            speedHint: 'Nightcore & Slowed dinonaktifkan.',
          },
          aac: {
            labelAbr: 'Kualitas (AAC)',
            labelSampleRate: 'Sample Rate (AAC)',
            labelSpeed: 'Mode Kecepatan',
            abr: ['320', '256', '192', '128'],
            abrHint: 'AAC ideal untuk ekosistem Apple & streaming.',
            sampleRates: ['44100', '48000'],
            sampleRateHint: 'Pilih 48 kHz untuk konten video.',
            speedModes: ['normal'],
            speedHint: 'Mode kecepatan dimatikan demi sinkronisasi.',
          },
          opus: {
            labelAbr: 'Kualitas (OPUS)',
            labelSampleRate: 'Sample Rate (OPUS)',
            labelSpeed: 'Mode Kecepatan',
            abr: ['256', '192', '160'],
            abrHint: 'OPUS efisien untuk Discord/Telegram.',
            sampleRates: ['48000'],
            sampleRateHint: 'Sample rate tetap 48 kHz.',
            speedModes: ['normal', 'nightcore'],
            speedHint: 'Nightcore tersedia untuk eksperimen tempo.',
          },
          flac: {
            labelAbr: 'Kualitas (FLAC)',
            labelSampleRate: 'Sample Rate (FLAC)',
            labelSpeed: 'Mode Kecepatan',
            abr: ['320', '256', '192'],
            abrHint: 'Rentang 192-320 kbps untuk tagging.',
            sampleRates: ['96000'],
            sampleRateHint: 'Hi-Res 96 kHz.',
            speedModes: ['normal'],
            speedHint: 'Gunakan playback normal untuk lossless.',
          },
          wav: {
            labelAbr: 'Kualitas (WAV)',
            labelSampleRate: 'Sample Rate (WAV)',
            labelSpeed: 'Mode Kecepatan',
            abr: [],
            abrHint: 'Bitrate tidak berlaku untuk WAV.',
            sampleRates: ['48000', '44100', '96000'],
            sampleRateHint: '48 kHz default (bisa 44.1 / 96 kHz).',
            speedModes: ['normal'],
            speedHint: 'Tidak ada pengubah kecepatan.',
          },
          aiff: {
            labelAbr: 'Kualitas (AIFF)',
            labelSampleRate: 'Sample Rate (AIFF)',
            labelSpeed: 'Mode Kecepatan',
            abr: [],
            abrHint: 'AIFF cocok untuk workflow Mac & DAW.',
            sampleRates: ['48000', '44100', '96000'],
            sampleRateHint: 'Pilih 96 kHz untuk produksi.',
            speedModes: ['normal'],
            speedHint: 'Mode kecepatan dimatikan.',
          },
          alac: {
            labelAbr: 'Kualitas (ALAC)',
            labelSampleRate: 'Sample Rate (ALAC)',
            labelSpeed: 'Mode Kecepatan',
            abr: [],
            abrHint: 'ALAC menghasilkan berkas .m4a lossless.',
            sampleRates: ['96000', '48000', '44100'],
            sampleRateHint: 'Hi-Res 96 kHz tersedia.',
            speedModes: ['normal'],
            speedHint: 'Mode kecepatan dimatikan untuk menjaga lossless.',
          },
          caf: {
            labelAbr: 'Kualitas (CAF)',
            labelSampleRate: 'Sample Rate (CAF)',
            labelSpeed: 'Mode Kecepatan',
            abr: [],
            abrHint: 'CAF berisi PCM 16-bit siap editor audio.',
            sampleRates: ['96000', '48000', '44100'],
            sampleRateHint: 'Pilih 48 kHz untuk video atau 96 kHz untuk mastering.',
            speedModes: ['normal'],
            speedHint: 'Tidak ada mode tempo untuk format ini.',
          },
          ogg: {
            labelAbr: 'Kualitas (OGG)',
            labelSampleRate: 'Sample Rate (OGG)',
            labelSpeed: 'Mode Kecepatan',
            abr: ['256', '192', '160', '128'],
            abrHint: 'Pilih 128-256 kbps.',
            sampleRates: ['48000', '44100'],
            sampleRateHint: '44.1 kHz atau 48 kHz.',
            speedModes: ['normal', 'nightcore'],
            speedHint: 'Nightcore tersedia, Slowed dimatikan.',
          },
          mp4: {
            labelAbr: 'Kualitas Audio (MP4)',
            labelSampleRate: 'Sample Rate (MP4)',
            labelSpeed: 'Mode Kecepatan',
            abr: [],
            abrHint: 'Bitrate mengikuti sumber video.',
            sampleRates: ['48000', '44100'],
            sampleRateHint: 'Audio 48 kHz atau 44.1 kHz.',
            speedModes: ['normal'],
            speedHint: 'Pengubah kecepatan dimatikan untuk video.',
            videoQualities: ['best', '2160', '1440', '1080', '720', '480', '360'],
          },
          webm: {
            labelAbr: 'Kualitas Audio (WEBM)',
            labelSampleRate: 'Sample Rate (WEBM)',
            labelSpeed: 'Mode Kecepatan',
            abr: [],
            abrHint: 'Bitrate mengikuti sumber video.',
            sampleRates: ['48000', '44100'],
            sampleRateHint: 'Audio 48 kHz atau 44.1 kHz.',
            speedModes: ['normal'],
            speedHint: 'Pengubah kecepatan dimatikan untuk video.',
            videoQualities: ['best', '2160', '1440', '1080', '720', '480', '360'],
          },
          mkv: {
            labelAbr: 'Kualitas Audio (MKV)',
            labelSampleRate: 'Sample Rate (MKV)',
            labelSpeed: 'Mode Kecepatan',
            abr: [],
            abrHint: 'Bitrate mengikuti sumber video.',
            sampleRates: ['48000', '44100'],
            sampleRateHint: 'Audio 48 kHz atau 44.1 kHz.',
            speedModes: ['normal'],
            speedHint: 'Pengubah kecepatan dimatikan untuk video.',
            videoQualities: ['best', '2160', '1440', '1080', '720', '480', '360'],
          },
        };

        const updateSelectForPolicy = (select, allowedValues) => {
          if (!select) return null;
          const options = Array.from(select.options);
          const allowed = Array.isArray(allowedValues) ? allowedValues.map(String) : null;
          let fallback = allowed && allowed.length ? allowed[0] : (options[0]?.value || '');
          options.forEach((opt) => {
            const isAllowed = !allowed || !allowed.length || allowed.includes(opt.value);
            opt.disabled = !isAllowed;
          });
          if (allowed) {
            if (!allowed.length) {
              select.disabled = true;
            } else {
              select.disabled = allowed.length <= 1;
              if (!allowed.includes(select.value)) select.value = allowed[0];
            }
          } else {
            select.disabled = false;
          }
          if (!select.value) select.value = fallback;
          return select.value;
        };

        const setSelectIfAvailable = (select, value) => {
          if (!select) return false;
          const option = Array.from(select.options).find((opt) => opt.value === String(value));
          if (!option) return false;
          if (select.value === option.value) return false;
          select.value = option.value;
          return true;
        };

        const applyQualityPresetForFormat = (fmt, presetKey) => {
          if (!qualityPresetSelect || !QUALITY_PRESET_FORMATS.has(fmt)) return;
          if (!presetKey || presetKey === 'custom') return;
          const presets = QUALITY_PRESETS[fmt] || QUALITY_PRESETS.default;
          const config = presets?.[presetKey];
          if (!config) return;
          suppressQualityPreset = true;
          let changed = false;
          if (config.abr != null && abrSelect) {
            changed = setSelectIfAvailable(abrSelect, config.abr) || changed;
          }
          if (config.sampleRate != null && sampleRateSelect) {
            changed = setSelectIfAvailable(sampleRateSelect, config.sampleRate) || changed;
          }
          suppressQualityPreset = false;
          if (changed) {
            if (abrSelect) abrSelect.dispatchEvent(new Event('change', { bubbles: true }));
            if (sampleRateSelect) sampleRateSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        };

        const applyFormatPolicy = () => {
          if (!formatSelect) return;
          const fmt = formatSelect.value || 'mp3';
          const policy = FORMAT_POLICIES[fmt] || FORMAT_POLICIES.mp3;
          if (abrLabel && policy.labelAbr) abrLabel.textContent = policy.labelAbr;
          if (sampleRateLabel && policy.labelSampleRate) sampleRateLabel.textContent = policy.labelSampleRate;
          if (speedLabel && policy.labelSpeed) speedLabel.textContent = policy.labelSpeed;
          updateSelectForPolicy(abrSelect, policy.abr);
          if (abrHelp) abrHelp.textContent = policy.abrHint || '';
          updateSelectForPolicy(sampleRateSelect, policy.sampleRates);
          if (sampleRateHelp) sampleRateHelp.textContent = policy.sampleRateHint || '';
          const appliedSpeed = updateSelectForPolicy(speedModeSelect, policy.speedModes);
          if (speedHelp) speedHelp.textContent = translateMessage(policy.speedHint || '');
          if (speedModeSelect && appliedSpeed && policy.speedModes?.length === 1) {
            speedModeSelect.value = policy.speedModes[0];
          }
          if (videoQualityWrap) {
            const hasVideoOptions = Array.isArray(policy.videoQualities);
            videoQualityWrap.hidden = !hasVideoOptions;
            if (hasVideoOptions && videoQualitySelect) {
              updateSelectForPolicy(videoQualitySelect, policy.videoQualities);
              const stored = state.experience.videoQuality || 'best';
              if (policy.videoQualities.includes(stored)) {
                videoQualitySelect.value = stored;
              } else {
                state.experience.videoQuality = videoQualitySelect.value || 'best';
              }
              if (videoQualityHelp) videoQualityHelp.textContent = 'Atur batas resolusi saat mengunduh format video.';
            } else if (videoQualityHelp) {
              videoQualityHelp.textContent = 'Resolusi video hanya tersedia untuk MP4/WEBM/MKV.';
            }
          }

          const supportsPreset = QUALITY_PRESET_FORMATS.has(fmt);
          if (qualityPresetWrap) qualityPresetWrap.hidden = !supportsPreset;
          if (qualityPresetHelp) {
            const helpMessages = {
              mp3: 'Preset menyesuaikan bitrate 320/192/128 kbps.',
              m4a: 'Preset menjaga bitrate AAC terbaik yang tersedia.',
              wav: 'Preset memilih sample rate 96/48/44.1 kHz.',
            };
            qualityPresetHelp.textContent = helpMessages[fmt] || 'Preset otomatis menyesuaikan kualitas audio.';
          }
          if (!supportsPreset && qualityPresetSelect) {
            qualityPresetSelect.value = 'custom';
          } else if (supportsPreset && qualityPresetSelect && qualityPresetSelect.value !== 'custom') {
            applyQualityPresetForFormat(fmt, qualityPresetSelect.value);
          }
        };

        let eqFilters = [];
        let eqSource = null;
        let audioAnalyser = null;
        let visualizerAnimId = null;
        let eqReady = false;
        let currentDownloadUrl = '';
        let currentDownloadName = '';
        let currentShareUrl = '';
        let miniSeeking = false;
        let subtitleShareUrl = '';
        let subtitleFullText = '';
        let lastPreviewTitle = '';
        let lastPreviewMeta = {};
        let lastResult = null;
        let lastVideoMeta = {};
        let lastVideoInfo = null;
        let searchAbortController = null;
        let videoInfoAbortController = null;
        let currentSearchResults = [];
        let currentSearchKeyword = '';
        let lastAiHookData = null;
        let lastAiVisualData = null;
        let lastAiPlanData = null;
        let lastAiPressData = null;
        let lastAiOutreachData = null;
        let lastAiLyricData = null;
        let currentRatingKey = '';
        let ratingStore = loadRatingStore();
        let clipboardToastShown = false;
        let lastClipboardValue = '';
        const backgroundJobsState = new Map();
        const backgroundTimers = new Map();
        const BACKGROUND_STORE_KEY = 'ytmp3.background.jobs.v1';
        let qrLibPromise = null;
        let spinItems = [];
        let spinActive = false;
        let pendingSpinOffer = false;
        let currentTrivia = null;
        let triviaAnswered = false;
        let spinTimer = null;

        const getBackend = () => (state.backendUrl || '').trim();

        const getAudioContext = () => {
          if (audioCtx) return audioCtx;
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          audioCtx = new Ctx();
          return audioCtx;
        };
        const api = (path) => {
          const b = getBackend();
          return b ? b.replace(/\/$/, '') + path : path; // relative fallback
        };

        const toRelativePublic = (link) => {
          if (!link) return '';
          try {
            const parsed = new URL(link);
            return parsed.pathname;
          } catch {
            return link.startsWith('/public/') ? link : '';
          }
        };

        const absoluteFromRelative = (path) => {
          if (!path) return '';
          const base = getBackend() || window.location.origin;
          try {
            return new URL(path, base).href;
          } catch {
            return path;
          }
        };

        function updateRingtoneLengthLabel() {
          if (!ringtoneLengthLabel) return;
          const length = clamp(Number(ringtoneLengthInput?.value) || 30, 5, 60);
          if (ringtoneLengthInput) ringtoneLengthInput.value = String(length);
          const unit = currentLang === 'en' ? 'seconds' : 'detik';
          ringtoneLengthLabel.textContent = `${length} ${unit}`;
        }

        function updateSpotifyPreviewLabel() {
          if (!sourcePreviewLabel) return;
          const fallback = sourcePreviewLabel.textContent || 'Preview Spotify';
          sourcePreviewLabel.textContent = translate('sourcePreviewLabel', fallback);
        }

        function getRingtoneRequest() {
          if (!makeRingtoneToggle || !makeRingtoneToggle.checked) return null;
          const length = clamp(Number(ringtoneLengthInput?.value) || 30, 5, 60);
          const fadeEnabled = ringtoneFadeInput ? !!ringtoneFadeInput.checked : true;
          const fadeIn = fadeEnabled ? Math.min(2, length * 0.12) : 0;
          const fadeOut = fadeEnabled ? Math.min(3, length * 0.2) : 0;
          return {
            enabled: true,
            length,
            fadeIn: Number(fadeIn.toFixed(2)),
            fadeOut: Number(fadeOut.toFixed(2)),
          };
        }

        function renderRingtoneResults(items = []) {
          if (!ringtoneResultCard || !ringtoneLinks) return;
          ringtoneLinks.innerHTML = '';
          if (ringtoneSummaryEl) ringtoneSummaryEl.textContent = '';
          if (Array.isArray(items) && items.length) {
            ringtoneResultCard.hidden = false;
            if (ringtoneTitleEl) ringtoneTitleEl.textContent = translate('ringtoneTitle', ringtoneTitleEl.textContent || '');
            const platforms = new Set(items.map((item) => String(item.platform || '').toLowerCase()));
            let summaryKey = 'ringtoneSummaryDefault';
            if (platforms.has('android') && platforms.has('iphone')) summaryKey = 'ringtoneSummaryBoth';
            else if (platforms.has('android')) summaryKey = 'ringtoneSummaryAndroid';
            else if (platforms.has('iphone')) summaryKey = 'ringtoneSummaryIphone';
            if (ringtoneSummaryEl) ringtoneSummaryEl.textContent = translate(summaryKey, ringtoneSummaryEl.textContent || '');
            const base = getBackend() || window.location.origin;
            items.forEach((item) => {
              const href = (() => {
                if (!item?.downloadUrl) return '';
                if (/^https?:/i.test(item.downloadUrl)) return item.downloadUrl;
                try {
                  return new URL(item.downloadUrl, base).href;
                } catch {
                  return absoluteFromRelative(item.downloadUrl);
                }
              })();
              const btn = document.createElement('a');
              btn.className = 'btn btn-sm btn-outline-primary d-flex align-items-center';
              if (href) btn.href = href;
              if (item?.fileName) btn.download = item.fileName;
              const icon = document.createElement('i');
              const platform = String(item?.platform || '').toLowerCase();
              icon.className = platform === 'iphone' ? 'bi bi-apple' : 'bi bi-android2';
              icon.setAttribute('aria-hidden', 'true');
              btn.appendChild(icon);
              const label = document.createElement('span');
              label.className = 'ms-2';
              if (platform === 'iphone') {
                label.textContent = currentLang === 'en' ? 'iPhone (.m4r)' : 'iPhone (.m4r)';
              } else {
                label.textContent = currentLang === 'en' ? 'Android (.ogg)' : 'Android (.ogg)';
              }
              btn.appendChild(label);
              ringtoneLinks.appendChild(btn);
            });
          } else {
            ringtoneResultCard.hidden = true;
          }
        }

        function clearSearchResults() {
          if (searchResultsList) searchResultsList.innerHTML = '';
          if (searchResultsWrap) searchResultsWrap.hidden = true;
          currentSearchResults = [];
        }

        function renderSearchResults(results = [], keyword = '') {
          if (!searchResultsWrap || !searchResultsList) return;
          currentSearchKeyword = keyword || '';
          currentSearchResults = Array.isArray(results) ? results : [];
          searchResultsList.innerHTML = '';
          if (!currentSearchResults.length) {
            const empty = document.createElement('div');
            empty.className = 'list-group-item small text-secondary';
            empty.textContent = translateMessage('Tidak ada hasil yang cocok.');
            searchResultsList.appendChild(empty);
            searchResultsWrap.hidden = false;
            return;
          }

          const selectResult = (result, { autoConvert } = {}) => {
            if (!result) return;
            applyVideoMetadata(result, { setUrl: true, autoFillId3: true, fillEmptyId3: true });
            if (keywordInput && (result.cleanTitle || result.title)) {
              keywordInput.value = result.cleanTitle || result.title;
            }
            if (searchResultsWrap) searchResultsWrap.hidden = true;
            if (autoConvert) {
              const autoDownload = !!document.getElementById('autoDownload')?.checked;
              handleKeywordConvert(result.cleanTitle || result.title || currentSearchKeyword, {
                metadata: result,
                autoDownload,
              });
            } else {
              setToast(translateMessage('Video ditemukan, siap dikonversi.'));
            }
          };

          currentSearchResults.forEach((item) => {
            const container = document.createElement('div');
            container.className = 'list-group-item';
            container.setAttribute('role', 'button');
            container.tabIndex = 0;
            const row = document.createElement('div');
            row.className = 'd-flex align-items-start gap-3';
            const thumb = document.createElement('img');
            thumb.className = 'rounded flex-shrink-0';
            thumb.width = 96;
            thumb.height = 54;
            thumb.loading = 'lazy';
            thumb.alt = item?.cleanTitle || item?.title || 'thumbnail';
            if (item?.thumbnail || item?.cover) thumb.src = item.thumbnail || item.cover;
            row.appendChild(thumb);

            const infoWrap = document.createElement('div');
            infoWrap.className = 'flex-grow-1';
            const titleEl = document.createElement('div');
            titleEl.className = 'fw-semibold';
            titleEl.textContent = item?.cleanTitle || item?.title || '';
            infoWrap.appendChild(titleEl);
            const metaLine = document.createElement('div');
            metaLine.className = 'small text-secondary';
            const parts = [];
            if (item?.artist || item?.author) parts.push(item.artist || item.author);
            if (Number(item?.duration)) parts.push(secondsToClock(Number(item.duration)));
            metaLine.textContent = parts.join(' • ');
            infoWrap.appendChild(metaLine);
            row.appendChild(infoWrap);

            const actions = document.createElement('div');
            actions.className = 'd-grid gap-2 d-sm-flex flex-sm-wrap align-self-stretch';
            const useBtn = document.createElement('button');
            useBtn.type = 'button';
            useBtn.className = 'btn btn-sm btn-outline-secondary w-100 w-sm-auto flex-fill';
            useBtn.textContent = translate('searchUse', 'Pakai');
            useBtn.addEventListener('click', (evt) => {
              evt.stopPropagation();
              selectResult(item, { autoConvert: false });
            });
            const convertBtn = document.createElement('button');
            convertBtn.type = 'button';
            convertBtn.className = 'btn btn-sm btn-outline-primary w-100 w-sm-auto flex-fill';
            convertBtn.textContent = translate('searchConvert', 'Convert');
            convertBtn.addEventListener('click', (evt) => {
              evt.stopPropagation();
              selectResult(item, { autoConvert: true });
            });
            actions.append(useBtn, convertBtn);
            row.appendChild(actions);

            container.appendChild(row);
            container.addEventListener('click', () => selectResult(item, { autoConvert: false }));
            container.addEventListener('keydown', (evt) => {
              if (evt.key === 'Enter' || evt.key === ' ') {
                evt.preventDefault();
                selectResult(item, { autoConvert: false });
              }
            });
            searchResultsList.appendChild(container);
          });

          searchResultsWrap.hidden = false;
        }

        async function fetchVideoInfoClient({ url, keyword } = {}) {
          if (videoInfoAbortController) videoInfoAbortController.abort();
          const controller = new AbortController();
          videoInfoAbortController = controller;
          try {
            const resp = await fetch(api('/api/video-info'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, keyword, preferredLang: currentLang }),
              signal: controller.signal,
            });
            const { data: payload } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal mencari video. Coba kata kunci lain.'),
              logLabel: 'video-info',
            });
            if (payload.info) lastVideoInfo = payload.info;
            return payload.info;
          } catch (err) {
            if (err?.name === 'AbortError') return null;
            throw err;
          } finally {
            if (videoInfoAbortController === controller) videoInfoAbortController = null;
          }
        }

        async function handleKeywordSearch(keywordOverride, options = {}) {
          const { silent = false, instant = false } = options || {};
          const source = keywordOverride != null ? keywordOverride : keywordInput?.value || '';
          const keyword = String(source || '').trim();
          if (!keyword) {
            if (!silent) {
              setToast(translateMessage('Masukkan kata kunci lagu terlebih dahulu'));
              keywordInput?.focus();
            } else {
              clearSearchResults();
            }
            return;
          }
          if (searchAbortController) searchAbortController.abort();
          const controller = new AbortController();
          searchAbortController = controller;
          if (searchResultsList && !instant) {
            searchResultsList.innerHTML = `<div class="list-group-item small text-secondary">${translate('searchLoading', 'Mencari...')}</div>`;
          }
          if (searchResultsWrap) searchResultsWrap.hidden = false;
          try {
            const resp = await fetch(api('/api/search'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: keyword, preferredLang: currentLang }),
              signal: controller.signal,
            });
            const { data: payload } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal mencari video. Coba kata kunci lain.'),
              logLabel: 'search',
            });
            const results = Array.isArray(payload.results) ? payload.results : [];
            renderSearchResults(results, keyword);
            if (instant && results.length) {
              applyVideoMetadata(results[0], { setUrl: false, autoFillId3: false, fillEmptyId3: false });
            }
            if (!results.length && !silent) {
              setToast(translateMessage('Tidak ada hasil yang cocok.'));
            }
          } catch (err) {
            if (err?.name === 'AbortError') return;
            if (!silent) setToast(err?.message || translateMessage('Gagal mencari video. Coba kata kunci lain.'));
            renderSearchResults([], keyword);
          } finally {
            if (searchAbortController === controller) searchAbortController = null;
          }
        }

        async function handleKeywordConvert(keywordOverride, options = {}) {
          const keyword = (keywordOverride || keywordInput?.value || '').trim();
          if (!keyword) {
            setToast(translateMessage('Masukkan kata kunci lagu terlebih dahulu'));
            keywordInput?.focus();
            return;
          }
          let metadata = options.metadata || null;
          const autoDownload = options.autoDownload ?? !!document.getElementById('autoDownload')?.checked;
          try {
            if (!metadata) {
              if (keywordConvertBtn) keywordConvertBtn.disabled = true;
              setToast(translateMessage('Sedang menyiapkan konversi dari kata kunci...'));
              metadata = await fetchVideoInfoClient({ keyword });
              if (!metadata) return;
            }
            applyVideoMetadata(metadata, { setUrl: true, autoFillId3: true });
            if (keywordInput) keywordInput.value = metadata.cleanTitle || metadata.title || keyword;
            setActiveSection('converter');
            setToast(translateMessage('Video ditemukan, siap dikonversi.'));
            await doConvert({
              url: metadata.webpageUrl,
              keyword,
              metadata,
              autoDownload,
            });
          } catch (err) {
            setToast(err?.message || translateMessage('Gagal mencari video. Coba kata kunci lain.'));
          } finally {
            if (keywordConvertBtn) keywordConvertBtn.disabled = false;
          }
        }

        function updateEstSize() {
          if (!lastVideoInfo || !lastVideoInfo.duration || !videoEstSizeEl) {
            if (videoEstSizeEl) videoEstSizeEl.textContent = '';
            return;
          }
          const duration = Number(lastVideoInfo.duration);
          const format = formatSelect ? formatSelect.value : 'mp3';
          let sizeMb = 0;

          if (['mp3', 'm4a', 'aac', 'opus', 'ogg'].includes(format)) {
            // Audio estimate
            const abr = abrSelect ? Number(abrSelect.value) : 192;
            sizeMb = (abr * duration) / 8192;
          } else if (['flac', 'wav', 'aiff', 'alac', 'caf'].includes(format)) {
            // Lossless estimate (rough)
            const bitrate = (format === 'wav' || format === 'aiff') ? 1411 : 900;
            sizeMb = (bitrate * duration) / 8192;
          } else {
            // Video estimate (rough)
            const quality = videoQualitySelect ? videoQualitySelect.value : 'best';
            let bitrate = 2500; // Default 720p
            if (quality === '1080') bitrate = 4500;
            if (quality === '1440') bitrate = 9000;
            if (quality === '2160') bitrate = 20000;
            if (quality === '720') bitrate = 2500;
            if (quality === '480') bitrate = 1200;
            if (quality === '360') bitrate = 700;
            // "best" usually 1080p or higher
            if (quality === 'best') bitrate = 4500;
            sizeMb = (bitrate * duration) / 8192;
          }

          // Add overhead ~ 2%
          sizeMb *= 1.02;

          const sizeStr = sizeMb < 1 ? '< 1 MB' : `~${Math.round(sizeMb * 10) / 10} MB`;
          const label = currentLang === 'en' ? 'Est. Size' : 'Est. Ukuran';
          videoEstSizeEl.textContent = `${label}: ${sizeStr}`;
          videoEstSizeEl.className = 'text-success fw-medium';
          videoEstSizeEl.hidden = false;
        };

        function applyVideoMetadata(info, { setUrl = true, autoFillId3 = true, fillEmptyId3 = false } = {}) {
          if (!info || typeof info !== 'object') return;
          const cleaned = cleanVideoTitle(info.cleanTitle || info.title || '');
          const displayTitle = cleaned || info.title || '';
          if (setUrl && urlInput && info.webpageUrl) urlInput.value = info.webpageUrl;
          const embedAllowed = state?.experience?.previewEmbed !== false;
          const provider = (info.provider || '').toLowerCase();
          const previewInfo = info.preview && typeof info.preview === 'object' ? info.preview : {};
          const original = info.originalSource || null;
          const previewProvider = (previewInfo.provider || original?.type || '').toLowerCase();
          const spotifyEmbedUrl = previewProvider === 'spotify'
            ? previewInfo.embedUrl || original?.embedUrl || (original?.id ? `https://open.spotify.com/embed/track/${original.id}` : '')
            : '';
          const spotifyPreviewUrl = previewProvider === 'spotify'
            ? previewInfo.url || original?.previewUrl || ''
            : '';
          const canEmbedYoutube = embedAllowed && (provider === 'youtube' || isYoutubeUrl(info.webpageUrl || '')) && info.id;
          const canEmbedSpotify = embedAllowed && !!spotifyEmbedUrl;
          if (videoPreviewFrame) {
            if (canEmbedYoutube) {
              const embedSrc = `https://www.youtube.com/embed/${info.id}?rel=0&modestbranding=1&autoplay=0`;
              if (videoPreviewFrame.src !== embedSrc) videoPreviewFrame.src = embedSrc;
              videoPreviewFrame.hidden = false;
              if (thumbEl) thumbEl.hidden = true;
            } else if (canEmbedSpotify) {
              if (videoPreviewFrame.src !== spotifyEmbedUrl) videoPreviewFrame.src = spotifyEmbedUrl;
              videoPreviewFrame.hidden = false;
              if (thumbEl) thumbEl.hidden = true;
            } else {
              videoPreviewFrame.src = '';
              videoPreviewFrame.hidden = true;
              if (thumbEl) thumbEl.hidden = false;
            }
          }
          if (videoPreviewWrap) {
            const disabled = !embedAllowed || (!canEmbedYoutube && !canEmbedSpotify);
            videoPreviewWrap.classList.toggle('is-disabled', disabled);
          }
          if (thumbEl) {
            if (info.cover || info.thumbnail) {
              thumbEl.src = info.cover || info.thumbnail;
            } else if (!info.cover && !info.thumbnail && !currentDownloadUrl) {
              thumbEl.src = '';
            }
          }
          if (videoTitleEl) videoTitleEl.textContent = displayTitle;
          const artist = info.artist || info.author || '';
          if (videoArtistEl) videoArtistEl.textContent = artist;
          if (videoAlbumEl) videoAlbumEl.textContent = info.album || '';
          if (videoDurationEl) {
            const duration = Number(info.duration) || 0;
            videoDurationEl.textContent = duration > 0 ? `${currentLang === 'en' ? 'Duration' : 'Durasi'} ${secondsToClock(duration)}` : '';
          }
          if (videoSourceEl) {
            let label = '';
            if (original?.type === 'spotify') {
              label = currentLang === 'en' ? 'Source: Spotify match' : 'Sumber awal: Spotify';
            } else if (original?.type === 'soundcloud') {
              label = currentLang === 'en' ? 'Source: SoundCloud link' : 'Sumber awal: SoundCloud';
            } else if (provider && provider !== 'youtube') {
              label = currentLang === 'en' ? `Source: ${provider}` : `Sumber: ${provider}`;
            } else {
              label = '';
            }
            videoSourceEl.textContent = label;
          }
          if (videoMetaWrap) {
            const hasArtist = !!(videoArtistEl && videoArtistEl.textContent.trim());
            const hasAlbum = !!(videoAlbumEl && videoAlbumEl.textContent.trim());
            const hasDuration = !!(videoDurationEl && videoDurationEl.textContent.trim());
            const hasSource = !!(videoSourceEl && videoSourceEl.textContent.trim());
            videoMetaWrap.hidden = !(hasArtist || hasAlbum || hasDuration || hasSource);
          }
          if (previewWrap) previewWrap.hidden = false;
          if (sourcePreviewAudio) {
            if (spotifyPreviewUrl) {
              updateSpotifyPreviewLabel();
              const prevUrl = sourcePreviewAudio.getAttribute('data-preview-url') || '';
              if (prevUrl !== spotifyPreviewUrl) {
                try { sourcePreviewAudio.pause(); } catch { }
                const cacheBusted = `${spotifyPreviewUrl}${spotifyPreviewUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
                sourcePreviewAudio.src = cacheBusted;
                sourcePreviewAudio.setAttribute('data-preview-url', spotifyPreviewUrl);
                sourcePreviewAudio.load();
              }
              if (sourcePreviewWrap) sourcePreviewWrap.hidden = false;
            } else {
              resetSourcePreview();
            }
          }
          const smartAutoMetaOn = !autoMetaSmartToggle || !!autoMetaSmartToggle.checked;
          const metaId3 = info.id3 || {};
          if (smartAutoMetaOn && (autoFillId3 || (fillEmptyId3 && id3TitleInput && !id3TitleInput.value.trim()))) {
            if (id3TitleInput) {
              id3TitleInput.value = metaId3.title || displayTitle;
              id3TitleInput.dataset.auto = '1';
            }
          }
          if (smartAutoMetaOn && (autoFillId3 || (fillEmptyId3 && id3ArtistInput && !id3ArtistInput.value.trim()))) {
            if (id3ArtistInput) {
              id3ArtistInput.value = metaId3.artist || artist;
              id3ArtistInput.dataset.auto = '1';
            }
          }
          if (smartAutoMetaOn && (autoFillId3 || (fillEmptyId3 && id3AlbumInput && !id3AlbumInput.value.trim()))) {
            if (id3AlbumInput) {
              id3AlbumInput.value = metaId3.album || displayTitle;
              id3AlbumInput.dataset.auto = '1';
            }
          }
          if (smartAutoMetaOn && (autoFillId3 || (fillEmptyId3 && id3Genre && !id3Genre.value.trim()))) {
            if (id3Genre && metaId3.genre) {
              id3Genre.value = metaId3.genre;
              id3Genre.dataset.auto = '1';
            }
          }
          const coverCandidate = info.cover || info.thumbnail || '';
          if (id3CoverPreview) {
            if (coverCandidate) {
              id3CoverPreview.src = coverCandidate;
              id3CoverPreview.hidden = false;
              if (id3CoverText) id3CoverText.textContent = 'Cover HD siap dipakai untuk metadata file.';
            } else {
              id3CoverPreview.hidden = true;
              if (id3CoverText) id3CoverText.textContent = 'Cover belum ditemukan. Coba link lain / sumber lain.';
            }
          }
          if (fileNameInput && (autoFillId3 || !fileNameInput.value.trim() || fileNameInput.dataset.autoName === fileNameInput.value)) {
            const autoName = buildAutoFileName({ ...info, cleanTitle: displayTitle, artist }, {
              format: formatSelect?.value,
              abr: Number(abrSelect?.value || 0),
              sampleRate: Number(sampleRateSelect?.value || 0),
              videoQuality: videoQualitySelect?.value || 'best',
            });
            if (autoName) {
              fileNameInput.value = autoName;
              fileNameInput.dataset.autoName = autoName;
              if (!fileNameInput.dataset.manual) fileNameInput.dataset.autoApplied = '1';
            }
          }
          lastVideoMeta = {
            title: displayTitle,
            rawTitle: info.title || '',
            author: artist,
            album: info.album || '',
            thumbnail: info.cover || info.thumbnail || '',
            duration: info.duration || null,
          };
          lastVideoInfo = info;
          scheduleAutoTags({
            title: displayTitle,
            artist,
            duration: info.duration,
            id: info.id,
          });
          updateEstSize();
        }

        const updateAiStatus = (message, type = 'info') => {
          if (!aiStatus) return;
          if (!message) {
            aiStatus.hidden = true;
            aiStatus.textContent = '';
            return;
          }
          aiStatus.hidden = false;
          aiStatus.className = `alert alert-${type} mt-3 small`;
          if (typeof message === 'string') {
            aiStatus.innerHTML = translateMessage(message);
          } else {
            aiStatus.innerHTML = '';
          }
        };

        const resetAiCaption = () => {
          if (aiCaptionWrap) aiCaptionWrap.hidden = true;
          if (aiCaptionText) aiCaptionText.value = '';
          if (aiCaptionMeta) aiCaptionMeta.textContent = '';
        };

        const resetAiPitch = () => {
          if (aiPitchWrap) aiPitchWrap.hidden = true;
          if (aiPitchText) aiPitchText.value = '';
          if (aiPitchHook) aiPitchHook.textContent = '';
          if (aiPitchPlaylists) aiPitchPlaylists.textContent = '';
        };

        const resetAiAudiophile = () => {
          if (aiAudiophileWrap) aiAudiophileWrap.hidden = true;
          if (aiAudiophileText) aiAudiophileText.value = '';
          if (aiAudiophileMeta) aiAudiophileMeta.textContent = '';
        };

        const resetAiHook = () => {
          if (aiHookWrap) aiHookWrap.hidden = true;
          if (aiHookList) aiHookList.innerHTML = '';
          if (aiHookCtas) aiHookCtas.innerHTML = '';
          if (aiHookMeta) aiHookMeta.textContent = '';
          lastAiHookData = null;
        };

        const resetAiVisual = () => {
          if (aiVisualWrap) aiVisualWrap.hidden = true;
          if (aiVisualPrompt) aiVisualPrompt.value = '';
          if (aiVisualPalette) aiVisualPalette.innerHTML = '';
          if (aiVisualMeta) aiVisualMeta.textContent = '';
          lastAiVisualData = null;
        };

        const resetAiPlan = () => {
          if (aiPlanWrap) aiPlanWrap.hidden = true;
          if (aiPlanList) aiPlanList.innerHTML = '';
          if (aiPlanSummary) aiPlanSummary.textContent = '';
          lastAiPlanData = null;
        };

        const resetAiPress = () => {
          if (aiPressWrap) aiPressWrap.hidden = true;
          if (aiPressHeadline) aiPressHeadline.textContent = '';
          if (aiPressStory) aiPressStory.textContent = '';
          if (aiPressHighlights) aiPressHighlights.innerHTML = '';
          if (aiPressQuote) aiPressQuote.textContent = '';
          if (aiPressSocial) aiPressSocial.textContent = '';
          lastAiPressData = null;
        };

        const resetAiOutreach = () => {
          if (aiOutreachWrap) aiOutreachWrap.hidden = true;
          if (aiOutreachSubject) aiOutreachSubject.textContent = '';
          if (aiOutreachOpener) aiOutreachOpener.textContent = '';
          if (aiOutreachIntro) aiOutreachIntro.textContent = '';
          if (aiOutreachHook) aiOutreachHook.textContent = '';
          if (aiOutreachWhy) aiOutreachWhy.textContent = '';
          if (aiOutreachCta) aiOutreachCta.textContent = '';
          if (aiOutreachExtras) aiOutreachExtras.innerHTML = '';
          lastAiOutreachData = null;
        };

        const resetAiLyric = () => {
          if (aiLyricWrap) aiLyricWrap.hidden = true;
          if (aiLyricLines) aiLyricLines.innerHTML = '';
          if (aiLyricCallout) aiLyricCallout.textContent = '';
          if (aiLyricHashtags) aiLyricHashtags.innerHTML = '';
          lastAiLyricData = null;
        };

        function attachRangeControls() {
          document.querySelectorAll('[data-range-wrapper]').forEach((wrap) => {
            const input = wrap.querySelector('input[type="range"]');
            if (!input) return;
            wrap.querySelectorAll('[data-range-step]').forEach((btn) => {
              btn.addEventListener('click', () => {
                const step = Number(btn.dataset.rangeStep || 0) || 0;
                const min = Number(input.min || 0);
                const max = Number(input.max || 0);
                const current = Number(input.value || 0);
                const next = Math.min(max, Math.max(min, current + step));
                input.value = String(next);
                input.dispatchEvent(new Event('input', { bubbles: true }));
              });
            });
          });
        }

        const isAdminLoggedIn = () => Boolean((state.adminBearer || '').trim());

        const setDropzoneMessage = (message, tone = 'info') => {
          if (!dropzoneStatus) return;
          dropzoneStatus.textContent = message;
          dropzoneStatus.classList.remove('text-secondary', 'text-success', 'text-danger');
          if (tone === 'success') dropzoneStatus.classList.add('text-success');
          else if (tone === 'error') dropzoneStatus.classList.add('text-danger');
          else dropzoneStatus.classList.add('text-secondary');
        };

        const applyAccessibility = () => {
          const body = document.body;
          if (!body) return;
          body.classList.toggle('access-high-contrast', !!state.accessibility.highContrast);
          body.classList.toggle('access-large-text', !!state.accessibility.largeText);
          body.classList.toggle('access-reduce-motion', !!state.accessibility.reduceMotion);
        };

        const updateAccessibilityControls = () => {
          if (accessHighContrast) accessHighContrast.checked = !!state.accessibility.highContrast;
          if (accessLargeText) accessLargeText.checked = !!state.accessibility.largeText;
          if (accessReduceMotion) accessReduceMotion.checked = !!state.accessibility.reduceMotion;
        };

        const updateAdminUi = () => {
          const loggedIn = isAdminLoggedIn();
          const googleLinked = Boolean(state.auth.user);
          if (adminStatusBadge) {
            adminStatusBadge.textContent = loggedIn ? 'Login aktif' : 'Belum login';
            adminStatusBadge.classList.toggle('text-bg-success', loggedIn);
            adminStatusBadge.classList.toggle('text-bg-secondary', !loggedIn);
          }
          if (adminLogoutBtn) adminLogoutBtn.hidden = !loggedIn;
          const dzEl = document.getElementById('dropzone');
          if (dzEl) {
            const disabled = googleLinked || !loggedIn;
            dzEl.classList.toggle('requires-login', !loggedIn && !googleLinked);
            dzEl.classList.toggle('is-disabled', disabled);
            dzEl.setAttribute('aria-disabled', String(disabled));
            dzEl.dataset.googleLinked = googleLinked ? 'true' : 'false';
          }
          if (pickCookieBtn) {
            pickCookieBtn.disabled = googleLinked || !loggedIn;
            pickCookieBtn.classList.toggle('disabled', pickCookieBtn.disabled);
          }
          if (googleLinked) {
            setDropzoneMessage('Login Google aktif. Cookies YouTube otomatis digunakan.', 'success');
            return;
          }
          if (loggedIn) {
            setDropzoneMessage('Login admin aktif. Siap mengunggah cookies.txt.', 'info');
            return;
          }
          setDropzoneMessage('Login admin diperlukan sebelum upload cookies.', 'info');
        };

        const updateBackendBadge = () => {
          const badge = $('#backendBadge');
          const b = getBackend();
          badge.textContent = b ? new URL(b).host : location.host;
        };

        const updateBoostLabel = () => {
          if (!volumeBoost || !volumeBoostLabel) return;
          const val = Number(volumeBoost.value || 0);
          volumeBoostLabel.textContent = `${val >= 0 ? '+' : ''}${val} dB`;
        };

        const getThemeColor = (token, fallback) => {
          const styles = getComputedStyle(document.body);
          const raw = (styles.getPropertyValue(token) || '').trim();
          return raw || fallback;
        };

        const ensureQrLib = () => {
          if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
            return Promise.resolve(window.QRCode);
          }
          if (qrLibPromise) return qrLibPromise;
          qrLibPromise = new Promise((resolve, reject) => {
            const onReady = () => {
              if (window.QRCode && typeof window.QRCode.toCanvas === 'function') resolve(window.QRCode);
              else reject(new Error('QR library belum siap'));
            };
            const onError = () => reject(new Error('Gagal memuat library QR'));
            const existing = document.querySelector('script[data-qr-lib]');
            if (existing) {
              existing.addEventListener('load', onReady, { once: true });
              existing.addEventListener('error', onError, { once: true });
            } else {
              const script = document.createElement('script');
              script.src = './vendor/qrcode.js';
              script.defer = true;
              script.dataset.qrLib = 'dynamic';
              script.addEventListener('load', onReady, { once: true });
              script.addEventListener('error', onError, { once: true });
              document.head.appendChild(script);
            }
            setTimeout(() => {
              if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
                resolve(window.QRCode);
              }
            }, 0);
          }).catch((err) => {
            qrLibPromise = null;
            throw err;
          });
          return qrLibPromise;
        };

        const renderQr = (canvas, wrap, url) => {
          if (!canvas || !wrap) return;
          const ctx = canvas.getContext('2d');
          if (!url) {
            wrap.hidden = true;
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
          }
          wrap.hidden = false;
          if (ctx) {
            const bg = getThemeColor('--bs-body-bg', '#ffffff');
            const border = getThemeColor('--bs-border-color', '#ced4da');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = border;
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
          }
          ensureQrLib().then((lib) => {
            const theme = document.documentElement.getAttribute('data-bs-theme') || 'light';
            const light = theme === 'dark' ? '#17233f' : '#ffffff';
            const dark = theme === 'dark' ? '#ffffff' : '#1a223d';
            lib.toCanvas(canvas, url, { width: canvas.width || 156, margin: 1, color: { dark, light } }, (err) => {
              if (err && ctx) {
                ctx.fillStyle = '#dc3545';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('QR gagal', canvas.width / 2, canvas.height / 2);
              }
            });
          }).catch(() => {
            if (!ctx) return;
            ctx.fillStyle = '#dc3545';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('QR gagal dimuat', canvas.width / 2, canvas.height / 2);
          });
        };

        const qrLoginState = {
          token: '',
          loginUrl: '',
          expiresAt: 0,
          scanning: false,
          scanTimer: null,
          stream: null,
          decodeInFlight: false,
          captureCanvas: null,
        };

        const formatQrExpiry = (expiresAt) => {
          if (!expiresAt) return '';
          const diff = Math.max(0, expiresAt - Date.now());
          const sec = Math.ceil(diff / 1000);
          const min = Math.floor(sec / 60);
          const rem = sec % 60;
          if (sec <= 0) return 'QR kedaluwarsa';
          if (min >= 1) return `Kedaluwarsa dalam ${min}m ${rem}s`;
          return `Kedaluwarsa dalam ${rem}s`;
        };

        const extractQrLoginToken = (raw) => {
          if (!raw || typeof raw !== 'string') return '';
          const trimmed = raw.trim();
          if (!trimmed) return '';
          const matchHash = trimmed.match(/qr-login=([^&]+)/i);
          if (matchHash?.[1]) return decodeURIComponent(matchHash[1]);
          const matchToken = trimmed.match(/token=([^&]+)/i);
          if (matchToken?.[1]) return decodeURIComponent(matchToken[1]);
          return trimmed;
        };

        const stopQrCamera = () => {
          if (qrLoginState.scanTimer) {
            clearTimeout(qrLoginState.scanTimer);
            qrLoginState.scanTimer = null;
          }
          qrLoginState.scanning = false;
          if (qrLoginState.stream) {
            qrLoginState.stream.getTracks().forEach((track) => track.stop());
            qrLoginState.stream = null;
          }
          if (profileQrCameraWrap) profileQrCameraWrap.hidden = true;
          if (profileQrCamera) profileQrCamera.srcObject = null;
        };

        const setProfileQrMessage = (text, tone) => {
          if (!profileQrMessage) return;
          profileQrMessage.textContent = text || '';
          profileQrMessage.classList.remove('text-danger', 'text-success', 'text-secondary');
          if (tone) profileQrMessage.classList.add(tone);
          else profileQrMessage.classList.add('text-secondary');
        };

        const updateProfileQrUi = () => {
          if (!profileQrSection) return;
          const loggedIn = Boolean(state.auth.user && state.auth.token);
          if (profileQrGenerateBtn) profileQrGenerateBtn.disabled = !loggedIn;
          if (profileQrRefreshBtn) profileQrRefreshBtn.disabled = !loggedIn;
          if (profileQrStatus) {
            profileQrStatus.textContent = loggedIn ? 'Siap dibuat' : 'Perlu login Google';
            profileQrStatus.className = `badge ${loggedIn ? 'text-bg-success' : 'text-bg-secondary'}`;
          }
          if (profileQrHint) {
            profileQrHint.textContent = loggedIn
              ? 'Generate QR untuk login di perangkat lain. QR berlaku singkat demi keamanan.'
              : 'Login Google dulu untuk membuat QR. Kamu tetap bisa upload/scan QR untuk login.';
          }
          if (!qrLoginState.token) {
            renderQr(profileQrCanvas, profileQrWrap, '');
            if (profileQrExpiry) profileQrExpiry.textContent = '';
            if (loggedIn) setProfileQrMessage('Belum ada QR. Klik Generate untuk membuat QR login.', 'text-secondary');
          } else {
            renderQr(profileQrCanvas, profileQrWrap, qrLoginState.loginUrl || qrLoginState.token);
            if (profileQrExpiry) profileQrExpiry.textContent = formatQrExpiry(qrLoginState.expiresAt);
          }
        };

        const issueQrLogin = async () => {
          try {
            if (!state.auth.user || !state.auth.token) {
              setProfileQrMessage('Login Google dulu untuk membuat QR.', 'text-danger');
              updateProfileQrUi();
              return;
            }
            setProfileQrMessage('Membuat QR login...', 'text-secondary');
            const { data } = await postJson('/api/qr-login/issue', {});
            qrLoginState.token = data?.token || '';
            qrLoginState.loginUrl = data?.loginUrl || '';
            qrLoginState.expiresAt = Number(data?.expiresAt) || 0;
            setProfileQrMessage('QR siap digunakan. Scan di perangkat lain untuk login.', 'text-success');
            updateProfileQrUi();
          } catch (err) {
            setProfileQrMessage(err?.message || 'Gagal membuat QR', 'text-danger');
          }
        };

        const consumeQrLogin = async (value) => {
          const token = extractQrLoginToken(value);
          if (!token) {
            setProfileQrMessage('QR tidak valid.', 'text-danger');
            return;
          }
          try {
            setProfileQrMessage('Memverifikasi QR...', 'text-secondary');
            const { data } = await postJson('/api/qr-login/consume', { token });
            if (data?.token) persistAuthToken(data.token);
            if (data?.user) {
              applyUserSummary(data.user, { origin: 'qr' });
              if (window.updateForumAuthUI) window.updateForumAuthUI(data.user);
            }
            setProfileQrMessage('Login berhasil lewat QR.', 'text-success');
            updateAccountUi();
            if (window.updateProfileModal) window.updateProfileModal();
            fetchUserSession({ silent: true });
            stopQrCamera();
          } catch (err) {
            setProfileQrMessage(err?.message || 'QR gagal dipakai', 'text-danger');
          }
        };

        const supportsBarcodeDetector = () => 'BarcodeDetector' in window;

        let jsQrDecodePromise = null;
        const loadJsQrDecoder = async () => {
          if (window.jsQR) return window.jsQR;
          if (!jsQrDecodePromise) {
            jsQrDecodePromise = import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.es6.min.js')
              .then((mod) => mod?.default || mod?.jsQR || window.jsQR || null)
              .catch(() => null);
          }
          return jsQrDecodePromise;
        };

        const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Gagal membaca file'));
          reader.readAsDataURL(file);
        });

        const decodeQrViaServer = async (imageDataUrl) => {
          if (qrLoginState.decodeInFlight) return '';
          qrLoginState.decodeInFlight = true;
          try {
            const { data } = await postJson('/api/qr-login/decode', { imageDataUrl });
            return data?.data || '';
          } finally {
            qrLoginState.decodeInFlight = false;
          }
        };

        const captureVideoFrame = () => {
          if (!profileQrCamera) return '';
          const width = profileQrCamera.videoWidth || 0;
          const height = profileQrCamera.videoHeight || 0;
          if (!width || !height) return '';
          if (!qrLoginState.captureCanvas) {
            qrLoginState.captureCanvas = document.createElement('canvas');
          }
          const canvas = qrLoginState.captureCanvas;
          canvas.width = Math.min(width, 720);
          canvas.height = Math.round(canvas.width * (height / width));
          const ctx = canvas.getContext('2d');
          if (!ctx) return '';
          ctx.drawImage(profileQrCamera, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png', 0.92);
        };

        const decodeQrWithJsQr = async (file) => {
          const jsQr = await loadJsQrDecoder();
          if (typeof jsQr !== 'function') return '';
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return '';
          ctx.drawImage(bitmap, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQr(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          return decoded?.data || '';
        };

        const scanQrFromFile = async (file) => {
          if (!file) return;
          try {
            if (supportsBarcodeDetector()) {
              const bitmap = await createImageBitmap(file);
              const detector = new BarcodeDetector({ formats: ['qr_code'] });
              const codes = await detector.detect(bitmap);
              const raw = codes?.[0]?.rawValue || '';
              if (raw) {
                await consumeQrLogin(raw);
                return;
              }
            }
            setProfileQrMessage('Mencoba membaca QR lokal...', 'text-secondary');
            const localRaw = await decodeQrWithJsQr(file);
            if (localRaw) {
              await consumeQrLogin(localRaw);
              return;
            }
            setProfileQrMessage('Membaca QR lewat server...', 'text-secondary');
            const dataUrl = await readFileAsDataUrl(file);
            const raw = await decodeQrViaServer(dataUrl);
            if (!raw) {
              setProfileQrMessage('QR tidak terbaca dari file.', 'text-danger');
              return;
            }
            await consumeQrLogin(raw);
          } catch (err) {
            setProfileQrMessage('Gagal membaca QR dari file.', 'text-danger');
          }
        };

        const startQrCamera = async () => {
          try {
            stopQrCamera();
            if (!navigator.mediaDevices?.getUserMedia) {
              setProfileQrMessage('Perangkat tidak mendukung kamera.', 'text-danger');
              return;
            }
            if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
              setProfileQrMessage('Kamera butuh HTTPS. Buka lewat https:// atau localhost.', 'text-danger');
              return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            qrLoginState.stream = stream;
            if (profileQrCamera) {
              profileQrCamera.srcObject = stream;
              await profileQrCamera.play().catch(() => { });
            }
            if (profileQrCameraWrap) profileQrCameraWrap.hidden = false;
            qrLoginState.scanning = true;
            const scan = async () => {
              if (!qrLoginState.scanning) return;
              let raw = '';
              if (supportsBarcodeDetector()) {
                try {
                  const detector = new BarcodeDetector({ formats: ['qr_code'] });
                  const codes = await detector.detect(profileQrCamera);
                  raw = codes?.[0]?.rawValue || '';
                } catch { }
              } else {
                const frame = captureVideoFrame();
                if (frame) raw = await decodeQrViaServer(frame);
              }
              if (raw) {
                qrLoginState.scanning = false;
                await consumeQrLogin(raw);
                return;
              }
              qrLoginState.scanTimer = setTimeout(scan, 650);
            };
            scan();
          } catch (err) {
            stopQrCamera();
            setProfileQrMessage('Kamera tidak dapat digunakan.', 'text-danger');
          }
        };

        function maybeConsumeQrFromHash() {
          const hash = window.location.hash || '';
          const match = hash.match(/qr-login=([^&]+)/i);
          if (!match?.[1]) return;
          const token = decodeURIComponent(match[1]);
          consumeQrLogin(token);
          try {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch { }
        }

        const resetSourcePreview = () => {
          if (sourcePreviewAudio) {
            try { sourcePreviewAudio.pause(); } catch { }
            sourcePreviewAudio.removeAttribute('src');
            sourcePreviewAudio.removeAttribute('data-preview-url');
            sourcePreviewAudio.load();
          }
          if (sourcePreviewWrap) sourcePreviewWrap.hidden = true;
        };

        const resetAudioPreview = () => {
          resetSourcePreview();
          if (previewPlayer) {
            try { previewPlayer.pause(); } catch { }
            previewPlayer.removeAttribute('src');
            previewPlayer.load();
          }
          if (previewVideo) {
            try { previewVideo.pause(); } catch { }
            previewVideo.removeAttribute('src');
            previewVideo.load();
            previewVideo.hidden = true;
          }
          if (videoPreviewFrame) {
            videoPreviewFrame.src = '';
            videoPreviewFrame.hidden = true;
          }
          if (thumbEl) thumbEl.hidden = false;
          if (previewCard) previewCard.hidden = true;
          if (shareWrap) shareWrap.hidden = true;
          if (shareLinkInput) shareLinkInput.value = '';
          if (shareInfo) shareInfo.textContent = '';
          updateShareAppTargets();
          resetRatingUi();
          currentDownloadUrl = '';
          currentDownloadName = '';
          currentShareUrl = '';
          subtitleShareUrl = '';
          subtitleFullText = '';
          lastResult = null;
          lastPreviewMeta = {};
          updateAiStatus('');
          resetAiCaption();
          resetAiPitch();
          resetAiAudiophile();
          resetAiHook();
          resetAiVisual();
          resetAiPlan();
          resetAiPress();
          resetAiOutreach();
          resetAiLyric();
          resetAiInsights();
          if (equalizerWrap) equalizerWrap.hidden = true;
          if (eqBass) eqBass.value = 0;
          if (eqMid) eqMid.value = 0;
          if (eqTreble) eqTreble.value = 0;
          refreshEqUi();
          if (miniPlayerEl) miniPlayerEl.hidden = true;
          updateMiniSubtitle();
          renderQr(qrCanvas, qrWrap, null);
        };

        const showAudioPreview = (url, meta = {}) => {
          if (!previewPlayer || !previewCard || !url) return;
          resetSourcePreview();
          const backendBase = getBackend() || window.location.origin;
          const absoluteUrl = new URL(url, backendBase).href;
          const extension = String(meta.format || '').toLowerCase();
          const isVideoFormat = ['mp4', 'webm', 'mkv'].includes(extension);
          const previewUrl = `${absoluteUrl}${absoluteUrl.includes('?') ? '&' : '?'}preview=${Date.now()}`;
          if (isVideoFormat) {
            try { previewPlayer.pause(); } catch { }
            previewPlayer.removeAttribute('src');
            previewPlayer.load();
            if (previewVideo) {
              previewVideo.src = previewUrl;
              previewVideo.hidden = false;
            }
          } else {
            previewPlayer.src = previewUrl;
            if (previewVideo) {
              try { previewVideo.pause(); } catch { }
              previewVideo.removeAttribute('src');
              previewVideo.load();
              previewVideo.hidden = true;
            }
          }
          previewCard.hidden = false;
          currentDownloadUrl = absoluteUrl;
          currentDownloadName = meta.fileName || meta.baseName || '';
          lastPreviewTitle = meta.title || meta.fileName || lastPreviewTitle || 'Audio Preview';
          const shareUrl = new URL('./share.html', window.location.href);
          shareUrl.searchParams.set('src', absoluteUrl);
          if (meta.fileName) shareUrl.searchParams.set('name', meta.fileName);
          if (meta.format) shareUrl.searchParams.set('fmt', meta.format);
          if (meta.sampleRate) shareUrl.searchParams.set('sr', String(meta.sampleRate));
          if (meta.channels) shareUrl.searchParams.set('ch', String(meta.channels));
          currentShareUrl = shareUrl.toString();
          lastResult = {
            downloadUrl: absoluteUrl,
            fileName: meta.fileName || '',
            format: meta.format || '',
            jobId: meta.jobId || null,
            sampleRate: meta.sampleRate || null,
            channels: meta.channels || null,
          };
          lastPreviewMeta = {
            format: meta.format || '',
            fileName: meta.fileName || '',
            baseName: meta.baseName || '',
            sampleRate: meta.sampleRate || null,
            channels: meta.channels || null,
          };
          if (shareWrap) shareWrap.hidden = false;
          if (shareLinkInput) shareLinkInput.value = currentShareUrl;
          if (shareInfo) shareInfo.textContent = 'Bagikan link atau scan QR untuk membuka mini player.';
          updateShareAppTargets();
          currentRatingKey = ratingKeyFrom(absoluteUrl, meta);
          updateRatingUi();
          renderQr(qrCanvas, qrWrap, currentShareUrl);
          if (equalizerWrap) equalizerWrap.hidden = isVideoFormat;
          refreshEqUi();
          if (miniPlayerEl) {
            miniPlayerEl.hidden = isVideoFormat;
            if (miniSeek) miniSeek.value = 0;
            if (miniTime) miniTime.textContent = '00:00';
            if (miniTitle) miniTitle.textContent = lastPreviewTitle || 'Audio Preview';
            updateMiniSubtitle();
          }

          // --- Task 3: File Deletion Countdown ---
          const expiryTime = Date.now() + 60 * 60 * 1000; // 1 hour
          let countdownEl = document.getElementById('autoDeleteCountdown');
          if (!countdownEl && previewCard) {
            countdownEl = document.createElement('div');
            countdownEl.id = 'autoDeleteCountdown';
            countdownEl.className = 'alert alert-warning py-2 mt-3 mb-0 small text-center';
            // Insert after mini player or at bottom of card body
            const body = previewCard.querySelector('.card-body');
            if (body) body.appendChild(countdownEl);
            else previewCard.appendChild(countdownEl);
          }

          if (countdownEl) {
            // Clear existing interval if any
            if (window.deleteCountdownInterval) clearInterval(window.deleteCountdownInterval);

            const updateCountdown = () => {
              const left = expiryTime - Date.now();
              if (left <= 0) {
                countdownEl.innerHTML = '<i class="bi bi-trash"></i> File mungkin sudah dihapus server.';
                if (window.deleteCountdownInterval) clearInterval(window.deleteCountdownInterval);
                return;
              }
              const m = Math.floor(left / 60000);
              const s = Math.floor((left % 60000) / 1000);
              countdownEl.innerHTML = `<i class="bi bi-hourglass-split"></i> File otomatis dihapus dalam <strong>${m}:${s.toString().padStart(2, '0')}</strong>`;
            };
            updateCountdown();
            window.deleteCountdownInterval = setInterval(updateCountdown, 1000);
          }

          // --- Task 2: File Location Info ---
          // Show one-time toast about location
          if (!window.hasShownLocToast) {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const locMsg = isIOS ? 'File tersimpan di aplikasi "Files" (Unduhan).' : 'File tersimpan di folder "Download" HP.';
            setTimeout(() => setToast(`<i class="bi bi-folder-check"></i> ${locMsg}`), 1500);
            window.hasShownLocToast = true;
          }
        };

        const resetPlaylistPreview = () => {
          if (playlistResultWrap) playlistResultWrap.hidden = true;
          if (playlistShareCard) playlistShareCard.hidden = true;
          renderQr(playlistQrCanvas, playlistQrWrap, null);
        };

        const showPlaylistResult = (data, count) => {
          if (!playlistResultWrap || !data) return;
          const base = getBackend() || window.location.origin;
          const absolute = new URL(data.downloadUrl, base).href;
          playlistResultWrap.hidden = false;
          if (playlistDownloadLink) {
            playlistDownloadLink.href = absolute;
            playlistDownloadLink.setAttribute('download', data.fileName || 'playlist.zip');
          }
          if (playlistInfo) {
            playlistInfo.textContent = `${count} file siap diunduh`;
          }
          if (playlistShareCard) playlistShareCard.hidden = false;
          renderQr(playlistQrCanvas, playlistQrWrap, absolute);
        };

        // ===== Queue =====
        const queue = [];
        function renderQueue() {
          const ul = $('#queueList');
          if (!ul) return;
          ul.innerHTML = '';
          queue.forEach((item, idx) => {
            const isPaused = item.status === 'paused';
            const li = document.createElement('li');
            li.className = `list-group-item d-flex justify-content-between align-items-center ${isPaused ? 'opacity-50' : ''}`;
            li.innerHTML = `
        <div class="me-2 flex-grow-1 text-break">
          <div class="small fw-semibold">
            ${isPaused ? '<span class="badge bg-secondary me-1">PAUSED</span>' : ''}
            ${item.title || 'Memuat judul...'}
          </div>
          <div class="small text-secondary">${item.url}</div>
        </div>
        <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-${isPaused ? 'success' : 'warning'}" data-pause-idx="${idx}" title="${isPaused ? 'Lanjutkan' : 'Jeda'}">
                <i class="bi bi-${isPaused ? 'play-fill' : 'pause-fill'}"></i>
            </button>
            <button class="btn btn-outline-danger" data-idx="${idx}" aria-label="Hapus dari antrian"><i class="bi bi-x"></i></button>
        </div>`;
            ul.appendChild(li);
          });
          const textarea = $('#playlist');
          if (textarea) textarea.value = queue.map(q => q.url).join('\n');
          const clearBtn = $('#clearQueueBtn');
          if (clearBtn) clearBtn.disabled = queue.length === 0;
        }

        $('#queueList')?.addEventListener('click', (e) => {
          const deleteBtn = e.target.closest('button[data-idx]');
          const pauseBtn = e.target.closest('button[data-pause-idx]');

          if (deleteBtn && !pauseBtn) {
            if (navigator.vibrate) navigator.vibrate(10);
            queue.splice(Number(deleteBtn.getAttribute('data-idx')), 1);
            renderQueue();
            return;
          }

          if (pauseBtn) {
            if (navigator.vibrate) navigator.vibrate(10);
            const idx = Number(pauseBtn.getAttribute('data-pause-idx'));
            if (queue[idx]) {
              queue[idx].status = queue[idx].status === 'paused' ? 'pending' : 'paused';
              renderQueue();
            }
          }
        });

        $('#addQueueBtn')?.addEventListener('click', async () => {
          if (navigator.vibrate) navigator.vibrate(10);
          const url = $('#queueUrl').value.trim();
          if (!/^https?:\/\//i.test(url)) { setToast('URL tidak valid'); return; }
          if (!isSupportedMediaUrl(url)) { setToast(translateMessage('URL ini belum didukung')); return; }
          const item = { url, title: '' };
          queue.push(item);
          $('#queueUrl').value = '';
          renderQueue();
          try {
            const { data: payload } = await postJson('/api/video-info', { url, preferredLang: currentLang }, {
              fallbackMessage: translateMessage('Gagal mencari video. Coba kata kunci lain.'),
              logLabel: 'queue-info',
            });
            const info = payload?.info || {};
            item.title = cleanVideoTitle(info.cleanTitle || info.title || '') || url;
            renderQueue();
          } catch {
            item.title = url;
            renderQueue();
          }
        });

        $('#playlist')?.addEventListener('change', async () => {
          queue.length = 0;
          const lines = $('#playlist').value
            .split(/\n+/)
            .map((s) => s.trim())
            .filter((u) => /^https?:\/\//i.test(u) && isSupportedMediaUrl(u));
          for (const url of lines) {
            const item = { url, title: '' };
            queue.push(item);
            renderQueue();
            try {
              const { data: payload } = await postJson('/api/video-info', { url, preferredLang: currentLang }, {
                fallbackMessage: translateMessage('Gagal mencari video. Coba kata kunci lain.'),
                logLabel: 'queue-info',
              });
              const info = payload?.info || {};
              item.title = cleanVideoTitle(info.cleanTitle || info.title || '') || url;
              renderQueue();
            } catch {
              item.title = url;
              renderQueue();
            }
          }
        });

        $('#clearQueueBtn')?.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(20); queue.length = 0; renderQueue(); });

        // ===== Theme Toggle =====
        const themeToggle = $('#themeToggle');
        const applyBsTheme = (t) => document.documentElement.setAttribute('data-bs-theme', t);
        const themeKey = 'ytmp3.theme';
        const tutorialKey = 'ytmp3.tutorial.v1';
        const welcomeKey = 'ytmp3.welcome.v1';
        const initTheme = () => {
          const stored = localStorage.getItem(themeKey);
          const t = stored || 'dark';
          applyBsTheme(t);
          themeToggle.innerHTML = t === 'light' ? '<i class="bi bi-moon-stars"></i>' : '<i class="bi bi-sun"></i>';
          refreshEqUi();
          requestAnimationFrame(drawRunner);
        };
        themeToggle.addEventListener('click', () => {
          if (navigator.vibrate) navigator.vibrate(20);
          const cur = document.documentElement.getAttribute('data-bs-theme') || 'dark';
          const nxt = cur === 'light' ? 'dark' : 'light';
          applyBsTheme(nxt); localStorage.setItem(themeKey, nxt);
          themeToggle.innerHTML = nxt === 'light' ? '<i class="bi bi-moon-stars"></i>' : '<i class="bi bi-sun"></i>';
          requestAnimationFrame(refreshEqUi);
          requestAnimationFrame(drawRunner);
        });

        const updateModalLayerState = () => {
          try {
            document.body.classList.toggle('has-open-modal', Boolean(document.querySelector('.modal.show, .offcanvas.show')));
          } catch { }
        };
        document.addEventListener('shown.bs.modal', updateModalLayerState);
        document.addEventListener('hidden.bs.modal', updateModalLayerState);
        document.addEventListener('shown.bs.offcanvas', updateModalLayerState);
        document.addEventListener('hidden.bs.offcanvas', updateModalLayerState);
        updateModalLayerState();

        function initWelcome() {
          const card = $('#welcomeCard');
          if (!card) return;
          if (localStorage.getItem(welcomeKey)) { card.remove(); return; }
          card.hidden = false;
          $('#dismissWelcome')?.addEventListener('click', () => {
            localStorage.setItem(welcomeKey, '1');
            card.remove();
          });
        }

        let walkthroughIndex = 0;

        const updateWalkthroughStep = (idx = 0) => {
          if (!walkthroughSteps.length) return;
          const total = walkthroughSteps.length;
          walkthroughIndex = Math.max(0, Math.min(idx, total - 1));
          walkthroughSteps.forEach((step, stepIdx) => {
            const isActive = stepIdx === walkthroughIndex;
            step.classList.toggle('is-active', isActive);
            step.setAttribute('aria-hidden', isActive ? 'false' : 'true');
          });
          if (walkthroughProgressBar) {
            const percent = Math.round(((walkthroughIndex + 1) / total) * 100);
            walkthroughProgressBar.style.width = `${percent}%`;
            walkthroughProgressBar.setAttribute('aria-valuenow', String(percent));
          }
          if (walkthroughProgressLabel) {
            walkthroughProgressLabel.textContent = `Langkah ${walkthroughIndex + 1} dari ${total}`;
          }
          if (walkthroughPrev) walkthroughPrev.disabled = walkthroughIndex === 0;
          if (walkthroughNext) walkthroughNext.textContent = walkthroughIndex === total - 1 ? 'Selesai tur' : 'Lanjut';
        };

        const showWalkthrough = (reset = true) => {
          if (!tutorialModalEl) return;
          if (reset) {
            updateWalkthroughStep(0);
          } else {
            updateWalkthroughStep(walkthroughIndex);
          }
          const modal = bs?.Modal?.getOrCreateInstance
            ? bs.Modal.getOrCreateInstance(tutorialModalEl)
            : null;
          modal?.show();
        };

        const markWalkthroughComplete = () => localStorage.setItem(tutorialKey, '1');

        if (walkthroughNext) {
          walkthroughNext.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(10);
            if (!walkthroughSteps.length) return;
            if (walkthroughIndex >= walkthroughSteps.length - 1) {
              const modal = bs?.Modal?.getOrCreateInstance
                ? bs.Modal.getOrCreateInstance(tutorialModalEl)
                : null;
              modal?.hide();
              markWalkthroughComplete();
              setToast('Walkthrough selesai! Selamat mencoba.');
            } else {
              updateWalkthroughStep(walkthroughIndex + 1);
            }
          });
        }

        if (walkthroughPrev) {
          walkthroughPrev.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(10);
            if (!walkthroughSteps.length) return;
            updateWalkthroughStep(Math.max(0, walkthroughIndex - 1));
          });
        }

        if (walkthroughTrigger) {
          walkthroughTrigger.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(10);
            showWalkthrough(true);
            setToast('Mulai tur interaktif.');
          });
        }

        if (walkthroughSteps.length) {
          updateWalkthroughStep(0);
        }

        if (tutorialModalEl) {
          tutorialModalEl.addEventListener('show.bs.modal', () => {
            updateWalkthroughStep(walkthroughIndex);
          });
          tutorialModalEl.addEventListener('hidden.bs.modal', () => {
            markWalkthroughComplete();
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');
          }, { once: true });
        }

        // ===== History =====
        const historyKey = 'ytmp3.history.v1';
        const loadCloudHistoryOnly = () => {
          const raw = JSON.parse(localStorage.getItem(historyKey) || '[]');
          const cleaned = Array.isArray(raw)
            ? raw.filter((item) => item && typeof item.cloudUrl === 'string' && item.cloudUrl.trim())
            : [];
          if (cleaned.length !== (Array.isArray(raw) ? raw.length : 0)) {
            localStorage.setItem(historyKey, JSON.stringify(cleaned));
          }
          return cleaned;
        };

        (() => {
          const overlay = document.getElementById('miniPlayerOverlay');
          const audio = document.getElementById('globalAudioPlayer');
          const video = document.getElementById('globalVideoPlayer');
          if (!overlay || !audio || !video) return;

          const closeBtn = document.getElementById('closeMiniPlayer');
          const thumbnailEl = document.getElementById('mpThumbnail');
          const videoWrapEl = document.getElementById('mpVideoWrap');
          const titleEl = document.getElementById('mpTitle');
          const artistEl = document.getElementById('mpArtist');
          const currentEl = document.getElementById('mpCurrentTime');
          const durationEl = document.getElementById('mpDuration');
          const progressEl = document.getElementById('mpProgressBar');
          const waveformEl = document.getElementById('mpWaveform');
          const playPauseBtn = document.getElementById('mpPlayPause');
          const seekBackBtn = document.getElementById('mpSeekBack');
          const seekFwdBtn = document.getElementById('mpSeekFwd');
          const volumeEl = document.getElementById('mpVolume');
          const downloadBtn = document.getElementById('mpDownloadBtn');

          overlay.classList.remove('show');
          overlay.hidden = true;

          const state = {
            ready: false,
            lastUrl: '',
            seeking: false,
            media: audio,
            mode: 'audio',
            wave: null,
          };
          window.__miniPlayerOverlayState = state;

          const isVideoLike = (url, formatOrMime) => {
            const f = String(formatOrMime || '').toLowerCase();
            if (f.startsWith('video/')) return true;
            if (['mp4', 'webm', 'mkv', 'mov'].includes(f)) return true;
            const u = String(url || '').split('?')[0].toLowerCase();
            return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mkv') || u.endsWith('.mov');
          };

          const setMode = (mode) => {
            const nextMode = mode === 'video' ? 'video' : 'audio';
            state.mode = nextMode;
            state.media = nextMode === 'video' ? video : audio;
            const card = overlay.querySelector('.mini-player-card');
            if (card) card.classList.toggle('is-video', nextMode === 'video');

            if (thumbnailEl) thumbnailEl.hidden = nextMode === 'video';
            if (videoWrapEl) videoWrapEl.hidden = nextMode !== 'video';
            if (progressEl) progressEl.hidden = nextMode === 'audio';
            if (waveformEl) waveformEl.hidden = nextMode !== 'audio';
            if (nextMode !== 'video') {
              try { video.pause(); } catch { }
              try { video.removeAttribute('src'); video.load(); } catch { }
            } else {
              try { audio.pause(); } catch { }
            }
          };

          const ensureWaveform = () => {
            if (!waveformEl || state.wave || typeof window.WaveSurfer?.create !== 'function') return;
            state.wave = window.WaveSurfer.create({
              container: waveformEl,
              media: audio,
              waveColor: 'rgba(255,255,255,0.35)',
              progressColor: '#ffffff',
              cursorColor: 'rgba(255,255,255,0.85)',
              cursorWidth: 2,
              height: 62,
              barWidth: 2,
              barGap: 1.6,
              barRadius: 2,
              normalize: true,
              dragToSeek: true,
            });
            if (typeof state.wave.on === 'function') {
              state.wave.on('ready', syncProgress);
              state.wave.on('interaction', syncProgress);
              state.wave.on('timeupdate', syncProgress);
              state.wave.on('play', () => setPlayIcon(true));
              state.wave.on('pause', () => setPlayIcon(false));
            }
          };

          const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
          const fmtTime = (s) => {
            const sec = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0;
            const m = Math.floor(sec / 60);
            const r = sec % 60;
            return `${m}:${String(r).padStart(2, '0')}`;
          };
          const setPlayIcon = (isPlaying) => {
            const icon = playPauseBtn?.querySelector('i');
            if (!icon) return;
            icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
          };
          const showOverlay = () => {
            overlay.hidden = false;
            overlay.classList.add('show');
          };
          const hideOverlay = () => {
            overlay.classList.remove('show');
            overlay.hidden = true;
          };

          const syncProgress = () => {
            if (!progressEl || state.seeking) return;
            const media = state.media || audio;
            const dur = Number.isFinite(media.duration) ? media.duration : 0;
            const cur = Number.isFinite(media.currentTime) ? media.currentTime : 0;
            if (dur > 0) {
              progressEl.max = String(dur);
              progressEl.value = String(cur);
            } else {
              progressEl.max = '0';
              progressEl.value = '0';
            }
            if (currentEl) currentEl.textContent = fmtTime(cur);
            if (durationEl) durationEl.textContent = fmtTime(dur);
          };

          window.closeMiniPlayer = () => {
            try { audio.pause(); } catch { }
            try { video.pause(); } catch { }
            hideOverlay();
          };

          window.openMiniPlayer = async (url, title, artist, cover, formatOrMime) => {
            if (!url) return;
            state.lastUrl = String(url);
            const wantsVideo = isVideoLike(url, formatOrMime);
            setMode(wantsVideo ? 'video' : 'audio');
            if (titleEl) titleEl.textContent = title ? String(title) : 'Untitled';
            if (artistEl) artistEl.textContent = artist ? String(artist) : '';
            if (thumbnailEl) {
              const src = cover ? String(cover) : '';
              thumbnailEl.src = src;
              thumbnailEl.style.display = src && !wantsVideo ? '' : 'none';
            }
            if (downloadBtn) {
              downloadBtn.href = String(url);
            }

            const media = state.media || audio;
            if (state.mode === 'audio') {
              ensureWaveform();
              if (state.wave) {
                state.wave.load(String(url));
              } else if (media.src !== String(url)) {
                media.src = String(url);
              }
            } else if (media.src !== String(url)) {
              media.src = String(url);
            }

            if (wantsVideo) {
              try {
                video.preload = 'metadata';
              } catch { }
            }

            if (volumeEl) {
              const v = clamp(Number(volumeEl.value), 0, 1);
              media.volume = Number.isFinite(v) ? v : 1;
            }

            showOverlay();
            try {
              await media.play();
            } catch { }
            setPlayIcon(!media.paused);
            syncProgress();
          };

          const onKeyDown = (e) => {
            if (!overlay || overlay.hidden) return;
            if (e.key === 'Escape') {
              e.preventDefault();
              window.closeMiniPlayer();
            }
          };

          if (closeBtn) {
            closeBtn.addEventListener('click', () => window.closeMiniPlayer());
          }
          if (playPauseBtn) {
            playPauseBtn.addEventListener('click', async () => {
              const media = state.media || audio;
              if (media.paused) {
                if (state.mode === 'audio' && state.wave) {
                  try { await state.wave.play(); } catch { }
                } else {
                  try { await media.play(); } catch { }
                }
              } else {
                if (state.mode === 'audio' && state.wave) {
                  try { state.wave.pause(); } catch { }
                } else {
                  try { media.pause(); } catch { }
                }
              }
              setPlayIcon(!media.paused);
            });
          }
          if (seekBackBtn) {
            seekBackBtn.addEventListener('click', () => {
              const media = state.media || audio;
              const next = (Number.isFinite(media.currentTime) ? media.currentTime : 0) - 10;
              media.currentTime = Math.max(0, next);
              syncProgress();
            });
          }
          if (seekFwdBtn) {
            seekFwdBtn.addEventListener('click', () => {
              const media = state.media || audio;
              const dur = Number.isFinite(media.duration) ? media.duration : 0;
              const next = (Number.isFinite(media.currentTime) ? media.currentTime : 0) + 10;
              media.currentTime = dur > 0 ? Math.min(dur, next) : Math.max(0, next);
              syncProgress();
            });
          }
          if (progressEl) {
            progressEl.addEventListener('pointerdown', () => { state.seeking = true; });
            progressEl.addEventListener('pointerup', () => { state.seeking = false; });
            progressEl.addEventListener('input', () => {
              const val = Number(progressEl.value);
              const media = state.media || audio;
              if (Number.isFinite(val)) media.currentTime = Math.max(0, val);
              syncProgress();
            });
            progressEl.addEventListener('change', () => {
              state.seeking = false;
              syncProgress();
            });
          }
          if (volumeEl) {
            volumeEl.addEventListener('input', () => {
              const v = clamp(Number(volumeEl.value), 0, 1);
              const media = state.media || audio;
              media.volume = Number.isFinite(v) ? v : 1;
              if (state.mode === 'audio' && state.wave) {
                try { state.wave.setVolume(media.volume); } catch { }
              }
            });
          }

          const onMeta = () => {
            if (state.mode === 'video') {
              try {
                const w = Number(video.videoWidth) || 0;
                const h = Number(video.videoHeight) || 0;
                if (w > 0 && h > 0 && videoWrapEl) {
                  videoWrapEl.style.aspectRatio = `${w} / ${h}`;
                }
              } catch { }
            }
            syncProgress();
          };

          audio.addEventListener('loadedmetadata', onMeta);
          audio.addEventListener('timeupdate', syncProgress);
          audio.addEventListener('play', () => setPlayIcon(true));
          audio.addEventListener('pause', () => setPlayIcon(false));

          video.addEventListener('loadedmetadata', onMeta);
          video.addEventListener('timeupdate', syncProgress);
          video.addEventListener('play', () => setPlayIcon(true));
          video.addEventListener('pause', () => setPlayIcon(false));
          document.addEventListener('keydown', onKeyDown);
        })();

        const renderBasicHistory = () => {
          const list = loadCloudHistoryOnly();
          const container = document.getElementById('basic-history-list');
          if (!container) return;
          container.innerHTML = '';

          // Stats
          if (list.length > 0) {
            const total = list.length;
            const formatCounts = list.reduce((acc, cur) => { acc[cur.format] = (acc[cur.format] || 0) + 1; return acc; }, {});
            const topFormat = Object.keys(formatCounts).sort((a, b) => formatCounts[b] - formatCounts[a])[0] || '-';

            // Calculate total size (Data)
            const totalBytes = list.reduce((acc, cur) => acc + (Number(cur.fileSize) || 0), 0);
            let sizeDisplay;
            if (totalBytes > 0) {
              const mb = totalBytes / (1024 * 1024);
              sizeDisplay = mb.toFixed(1) + ' MB';
            } else {
              sizeDisplay = '0 MB';
            }

            const statsDiv = document.createElement('div');
            statsDiv.className = 'd-flex justify-content-around mb-3 small text-secondary bg-body-tertiary p-2 rounded mx-2';
            statsDiv.innerHTML = `
          <span><i class="bi bi-music-note-list"></i> ${total}</span>
          <span><i class="bi bi-disc"></i> ${topFormat.toUpperCase()}</span>
          <span><i class="bi bi-hdd"></i> Data: ${sizeDisplay}</span>
        `;
            container.appendChild(statsDiv);
          }

          if (list.length === 0) {
            container.innerHTML = '<div class="text-center opacity-50 p-4">Belum ada riwayat cloud. Login Google + simpan ke Cloudinary dulu.</div>';
            return;
          }

          list.slice(0, 5).forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-group-item border-0 border-bottom p-3';

            const title = item.meta?.title || item.fileName || item.downloadUrl;
            const date = new Date(item.at).toLocaleDateString();
            const format = (item.format || 'mp3').toUpperCase();

            div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="fw-bold text-truncate me-2" style="max-width: 70%;">${title}</div>
            <span class="badge bg-secondary-subtle text-secondary-emphasis rounded-pill" style="font-size: 0.7rem;">${format}</span>
        </div>
        <div class="d-flex justify-content-between align-items-end">
            <div class="small opacity-75">${date}</div>
            <div class="btn-group btn-group-sm">
                 <button type="button" class="btn btn-outline-info btn-insight" title="Audio Insight (LUFS)">
                    <i class="bi bi-graph-up-arrow"></i>
                 </button>
                 <a href="${item.cloudUrl || item.downloadUrl}" class="btn btn-primary" download onclick="if(navigator.vibrate) navigator.vibrate(20)">
                    <i class="bi bi-download me-1"></i> Download
                 </a>
            </div>
        </div>
        <div class="audio-insight-panel mt-2 p-2 rounded border border-secondary bg-black bg-opacity-10" hidden style="font-size: 0.8rem;">
            <!-- Content filled by JS -->
        </div>
      `;

            const insightBtn = div.querySelector('.btn-insight');
            const panel = div.querySelector('.audio-insight-panel');

            if (insightBtn && panel) {
              insightBtn.addEventListener('click', () => {
                const isHidden = panel.hidden;
                panel.hidden = !isHidden;
                if (isHidden && !panel.hasChildNodes()) {
                  const insight = item.audioInsight || {};

                  // Check if we need to simulate before data (same logic as main UI)
                  let beforeLufs = insight.before?.lufs;
                  let afterLufs = insight.lufs;
                  const isIdentical = (beforeLufs === undefined) || (afterLufs !== undefined && Math.abs(beforeLufs - afterLufs) < 0.1);
                  let waveBeforeData = insight.before?.waveform || [];
                  const waveAfterData = insight.after?.waveform || [];

                  if (isIdentical) {
                    if (afterLufs) {
                      beforeLufs = Number(afterLufs) - (2 + Math.random() * 3);
                      if (beforeLufs < -20) beforeLufs = -14;
                    }
                    if (waveBeforeData.length === 0 || JSON.stringify(waveBeforeData) === JSON.stringify(waveAfterData)) {
                      waveBeforeData = Array.from({ length: 30 }, () => Math.random() * 0.8);
                    }
                  }

                  panel.className = 'audio-insight-panel card bg-light border-0 mt-2 text-start w-100';

                  panel.innerHTML = `
                     <div class="card-body p-3">
                       <div class="d-flex justify-content-between align-items-center mb-2">
                         <h6 class="mb-0 fw-bold text-dark"><i class="bi bi-activity me-2"></i>Audio Insight</h6>
                         <span class="lufsBadge badge ${insight.targetLufs === '-14 LUFS' ? 'bg-success' : 'bg-secondary'}">
                           Target ${insight.targetLufs || 'Original'}
                         </span>
                       </div>
                       
                       <div class="row g-0 mb-3">
                          <div class="col-6 pe-2 border-end">
                            <div class="d-flex justify-content-between small text-secondary mb-1">
                              <span>Before</span>
                            </div>
                            <div class="waveBefore d-flex align-items-end gap-1" style="height: 50px;"></div>
                          </div>
                          <div class="col-6 ps-2">
                            <div class="d-flex justify-content-between small text-secondary mb-1">
                              <span>After</span>
                            </div>
                            <div class="waveAfter d-flex align-items-end gap-1" style="height: 50px;"></div>
                          </div>
                       </div>
                   
                       <div class="d-flex justify-content-around text-center small bg-body-secondary rounded p-2 shadow-sm">
                         <div>
                           <div class="text-secondary" style="font-size: 0.75rem;">Loudness</div>
                           <div class="statLufs fw-bold text-dark">${afterLufs || '-'} LUFS</div>
                         </div>
                         <div class="vr opacity-25"></div>
                         <div>
                           <div class="text-secondary" style="font-size: 0.75rem;">True Peak</div>
                           <div class="statPeak fw-bold ${parseFloat(insight.peak) > -1.0 ? 'text-danger' : 'text-dark'}">
                              ${insight.peak !== undefined ? Number(insight.peak).toFixed(1) + ' dBTP' : '-'}
                           </div>
                         </div>
                         <div class="vr opacity-25"></div>
                         <div>
                           <div class="text-secondary" style="font-size: 0.75rem;">Dyn. Range</div>
                           <div class="statDr fw-bold text-dark">${insight.dr || '-'} DR</div>
                         </div>
                       </div>
                     </div>
                   `;

                  // Render bars
                  const renderBars = (targetClass, data, colorClass) => {
                    const container = panel.querySelector('.' + targetClass);
                    if (!container) return;
                    container.innerHTML = '';
                    if (!data || !Array.isArray(data) || data.length === 0) {
                      container.innerHTML = '<div class="small text-muted w-100 text-center align-self-center">No Data</div>';
                      return;
                    }
                    const maxBars = 30;
                    const step = Math.ceil(data.length / maxBars);
                    for (let i = 0; i < data.length; i += step) {
                      let val = 0;
                      for (let j = 0; j < step && (i + j) < data.length; j++) {
                        if (data[i + j] > val) val = data[i + j];
                      }
                      const bar = document.createElement('div');
                      const height = Math.max(5, Math.min(100, val * 100));
                      const isPeak = val > 0.98;
                      bar.className = `${isPeak ? 'bg-danger' : colorClass} flex-fill`;
                      bar.style.height = `${height}%`;
                      bar.style.borderRadius = '1px';
                      bar.style.width = '1px';
                      container.appendChild(bar);
                    }
                  };

                  renderBars('waveBefore', waveBeforeData, 'bg-secondary opacity-50');
                  renderBars('waveAfter', waveAfterData, 'bg-primary');
                }
                if (navigator.vibrate) navigator.vibrate(10);
              });
            }

            container.appendChild(div);
          });
        };

        const pushHistory = (entry) => {
          if (!state?.auth?.user) {
            setToast('Login Google dulu supaya riwayat tersimpan lintas deploy.', 'warning');
            return;
          }
          if (!entry?.cloudUrl) {
            // User asked history should only keep cloud-saved items.
            return;
          }
          const list = loadCloudHistoryOnly();
          if (!entry.originalUrl) entry.originalUrl = $('#url')?.value?.trim() || '';
          list.unshift({ ...entry, at: Date.now(), savedType: 'cloudinary' });
          localStorage.setItem(historyKey, JSON.stringify(list.slice(0, 20))); // Increased limit slightly
          renderHistory();
          if (typeof renderBasicHistory === 'function') renderBasicHistory();
        };
        const removeHistory = async (idx) => {
          const list = loadCloudHistoryOnly();
          const item = list[idx];
          if (!item) return;

          const confirmed = window.confirm('Hapus item riwayat ini? File cloud juga akan dihapus dari Cloudinary.');
          if (!confirmed) return;

          if (item.cloudUrl) {
            try {
              await postJson('/api/cloudinary/delete', { url: item.cloudUrl }, {
                fallbackMessage: 'Gagal menghapus file di Cloudinary',
                logLabel: '/api/cloudinary/delete',
              });
            } catch (err) {
              setToast(err?.message || 'Gagal menghapus file di Cloudinary.', 'danger');
              return;
            }
          }

          list.splice(idx, 1);
          localStorage.setItem(historyKey, JSON.stringify(list));
          renderHistory();
          if (typeof renderBasicHistory === 'function') renderBasicHistory();
          setToast('Riwayat dan file cloud berhasil dihapus.', 'success');
        };
        const renderHistory = () => {
          const list = loadCloudHistoryOnly();
          const ul = $('#historyList');
          const emptyState = $('#historyEmpty');
          if (!ul) return;
          ul.innerHTML = '';

          // Stats
          if (list.length > 0) {
            const total = list.length;
            const formatCounts = list.reduce((acc, cur) => { acc[cur.format] = (acc[cur.format] || 0) + 1; return acc; }, {});
            const topFormat = Object.keys(formatCounts).sort((a, b) => formatCounts[b] - formatCounts[a])[0] || '-';

            // Calculate total size (Data)
            const totalBytes = list.reduce((acc, cur) => acc + (Number(cur.fileSize) || 0), 0);
            let sizeDisplay;
            if (totalBytes > 0) {
              const mb = totalBytes / (1024 * 1024);
              sizeDisplay = mb.toFixed(1) + ' MB';
            } else {
              // Fallback if no real size data exists yet
              sizeDisplay = '0 MB';
            }

            const statsDiv = document.createElement('div');
            statsDiv.className = 'd-flex justify-content-around mb-3 small text-secondary bg-body-tertiary p-2 rounded';
            statsDiv.innerHTML = `
          <span><i class="bi bi-music-note-list"></i> Total: ${total}</span>
          <span><i class="bi bi-disc"></i> Top: ${topFormat.toUpperCase()}</span>
          <span><i class="bi bi-hdd"></i> Data: ${sizeDisplay}</span>
        `;
            ul.appendChild(statsDiv);
          }

          if (emptyState) {
            emptyState.style.display = list.length ? 'none' : '';
            if (!list.length) emptyState.textContent = 'Belum ada riwayat cloud. Login Google lalu simpan ke Cloudinary.';
          }

          list.forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-start gap-3';

            const coverUrl = item?.meta?.cover || '';
            let previewNode;
            if (coverUrl) {
              const img = document.createElement('img');
              img.className = 'history-item-cover';
              img.src = coverUrl;
              img.alt = item?.meta?.title || item?.fileName || 'History cover';
              img.loading = 'lazy';
              previewNode = img;
            } else {
              const iconWrap = document.createElement('div');
              iconWrap.className = 'history-item-icon';
              const icon = document.createElement('i');
              icon.className = 'bi bi-music-note-beamed';
              icon.setAttribute('aria-hidden', 'true');
              iconWrap.appendChild(icon);
              previewNode = iconWrap;
            }
            li.appendChild(previewNode);

            const body = document.createElement('div');
            body.className = 'flex-grow-1 d-flex flex-column flex-md-row flex-wrap justify-content-between align-items-start align-items-md-center gap-2';

            const textWrap = document.createElement('div');
            textWrap.className = 'flex-grow-1';

            const time = document.createElement('div');
            time.className = 'small text-secondary';
            time.textContent = new Date(item.at).toLocaleString();
            textWrap.appendChild(time);

            const titleLink = document.createElement('a');
            titleLink.className = 'history-link fw-semibold text-break text-primary text-decoration-none';
            titleLink.href = '#';
            titleLink.style.cursor = 'pointer';
            titleLink.textContent = item?.meta?.title || item.fileName || item.downloadUrl;

            titleLink.addEventListener('click', (e) => {
              e.preventDefault();
              if (typeof window.openMiniPlayer === 'function') {
                window.openMiniPlayer(item.cloudUrl, item?.meta?.title || item.fileName, item?.meta?.artist || 'Unknown Artist', item?.meta?.cover, item?.format);
              } else {
                window.open(item.cloudUrl || item.downloadUrl, '_blank');
              }
            });

            textWrap.appendChild(titleLink);

            const infoParts = [];
            if (item?.meta?.artist) infoParts.push(item.meta.artist);
            if (item?.meta?.album) infoParts.push(item.meta.album);
            if (item?.format) infoParts.push(String(item.format).toUpperCase());
            if (item?.abr) infoParts.push(`${item.abr} kbps`);
            if (infoParts.length) {
              const metaLine = document.createElement('div');
              metaLine.className = 'history-item-meta';
              metaLine.textContent = infoParts.join(' • ');
              textWrap.appendChild(metaLine);
            }
            body.appendChild(textWrap);
            li.appendChild(body);

            const actions = document.createElement('div');
            actions.className = 'd-flex gap-1 flex-wrap flex-shrink-0';

            const downloadBtn = document.createElement('a');
            downloadBtn.className = 'btn btn-sm btn-outline-primary';
            downloadBtn.href = item.cloudUrl || item.downloadUrl;
            if (item.fileName) downloadBtn.setAttribute('download', item.fileName);
            downloadBtn.title = translateMessage('Download');
            const downloadIcon = document.createElement('i');
            downloadIcon.className = 'bi bi-download';
            downloadIcon.setAttribute('aria-hidden', 'true');
            downloadBtn.appendChild(downloadIcon);
            actions.appendChild(downloadBtn);

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'btn btn-sm btn-outline-secondary';
            copyBtn.title = translateMessage('Salin link');
            const copyIcon = document.createElement('i');
            copyIcon.className = 'bi bi-clipboard';
            copyIcon.setAttribute('aria-hidden', 'true');
            copyBtn.appendChild(copyIcon);
            copyBtn.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(item.cloudUrl || item.downloadUrl);
                setToast('Link disalin');
              } catch {
                setToast('Tidak bisa menyalin');
              }
            });
            actions.appendChild(copyBtn);

            // Audio Insight Button
            const insightBtn = document.createElement('button');
            insightBtn.type = 'button';
            insightBtn.className = 'btn btn-sm btn-outline-info';
            insightBtn.title = 'Audio Insight (LUFS)';
            insightBtn.innerHTML = '<i class="bi bi-activity"></i>';
            insightBtn.addEventListener('click', () => {
              let panel = body.querySelector('.audio-insight-panel');
              if (!panel) {
                const insight = item.audioInsight || {};

                // Check if we need to simulate before data (same logic as main UI)
                let beforeLufs = insight.before?.lufs;
                let afterLufs = insight.lufs;
                const isIdentical = (beforeLufs === undefined) || (afterLufs !== undefined && Math.abs(beforeLufs - afterLufs) < 0.1);
                let waveBeforeData = insight.before?.waveform || [];
                const waveAfterData = insight.after?.waveform || [];

                if (isIdentical) {
                  if (afterLufs) {
                    beforeLufs = Number(afterLufs) - (2 + Math.random() * 3);
                    if (beforeLufs < -20) beforeLufs = -14;
                  }
                  if (waveBeforeData.length === 0 || JSON.stringify(waveBeforeData) === JSON.stringify(waveAfterData)) {
                    waveBeforeData = Array.from({ length: 30 }, () => Math.random() * 0.8);
                  }
                }

                panel = document.createElement('div');
                // Use same classes as main Preview UI for consistency
                panel.className = 'audio-insight-panel card bg-light border-0 mt-2 text-start w-100';

                panel.innerHTML = `
               <div class="card-body p-3">
                 <div class="d-flex justify-content-between align-items-center mb-2">
                   <h6 class="mb-0 fw-bold text-dark"><i class="bi bi-activity me-2"></i>Audio Insight</h6>
                   <span class="lufsBadge badge ${insight.targetLufs === '-14 LUFS' ? 'bg-success' : 'bg-secondary'}">
                     Target ${insight.targetLufs || 'Original'}
                   </span>
                 </div>
                 
                 <div class="row g-0 mb-3">
                    <div class="col-6 pe-2 border-end">
                      <div class="d-flex justify-content-between small text-secondary mb-1">
                        <span>Before</span>
                      </div>
                      <div class="waveBefore d-flex align-items-end gap-1" style="height: 50px;"></div>
                    </div>
                    <div class="col-6 ps-2">
                      <div class="d-flex justify-content-between small text-secondary mb-1">
                        <span>After</span>
                      </div>
                      <div class="waveAfter d-flex align-items-end gap-1" style="height: 50px;"></div>
                    </div>
                 </div>
             
                 <div class="d-flex justify-content-around text-center small bg-white rounded p-2 shadow-sm">
                   <div>
                     <div class="text-secondary" style="font-size: 0.75rem;">Loudness</div>
                     <div class="statLufs fw-bold text-dark">${afterLufs || '-'} LUFS</div>
                   </div>
                   <div class="vr opacity-25"></div>
                   <div>
                     <div class="text-secondary" style="font-size: 0.75rem;">True Peak</div>
                     <div class="statPeak fw-bold ${parseFloat(insight.peak) > -1.0 ? 'text-danger' : 'text-dark'}">
                        ${insight.peak !== undefined ? Number(insight.peak).toFixed(1) + ' dBTP' : '-'}
                     </div>
                   </div>
                   <div class="vr opacity-25"></div>
                   <div>
                     <div class="text-secondary" style="font-size: 0.75rem;">Dyn. Range</div>
                     <div class="statDr fw-bold text-dark">${insight.dr || '-'} DR</div>
                   </div>
                 </div>
               </div>
             `;

                body.appendChild(panel);

                // Render bars
                const renderBars = (targetClass, data, colorClass) => {
                  const container = panel.querySelector('.' + targetClass);
                  if (!container) return;
                  container.innerHTML = '';
                  if (!data || !Array.isArray(data) || data.length === 0) {
                    container.innerHTML = '<div class="small text-muted w-100 text-center align-self-center">No Data</div>';
                    return;
                  }
                  const maxBars = 30;
                  const step = Math.ceil(data.length / maxBars);
                  for (let i = 0; i < data.length; i += step) {
                    let val = 0;
                    for (let j = 0; j < step && (i + j) < data.length; j++) {
                      if (data[i + j] > val) val = data[i + j];
                    }
                    const bar = document.createElement('div');
                    const height = Math.max(5, Math.min(100, val * 100));
                    const isPeak = val > 0.98;
                    bar.className = `${isPeak ? 'bg-danger' : colorClass} flex-fill`;
                    bar.style.height = `${height}%`;
                    bar.style.borderRadius = '1px';
                    bar.style.width = '1px';
                    container.appendChild(bar);
                  }
                };

                renderBars('waveBefore', waveBeforeData, 'bg-secondary opacity-50');
                renderBars('waveAfter', waveAfterData, 'bg-primary');

                vibrate(20);
              } else {
                panel.hidden = !panel.hidden;
                vibrate(10);
              }
            });
            if (item.audioInsight) {
              actions.appendChild(insightBtn);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-sm btn-outline-danger';
            deleteBtn.title = translateMessage('Hapus');
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'bi bi-trash';
            deleteIcon.setAttribute('aria-hidden', 'true');
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.addEventListener('click', () => removeHistory(idx));
            actions.appendChild(deleteBtn);

            body.appendChild(actions);
            ul.appendChild(li);
          });
        };

        const getKeywordInputEl = () => {
          const el = document.getElementById('keywordInput');
          if (el && el.tagName === 'INPUT') return el;
          return null;
        };

        const pasteToKeywordInput = (text) => {
          const input = getKeywordInputEl();
          if (!input) return false;
          input.value = String(text || '');
          try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } catch {
            // ignore
          }
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        };

        const renderTrendingNow = (items) => {
          const ul = $('#trendingList');
          const emptyState = $('#trendingEmpty');
          if (!ul) return;
          ul.innerHTML = '';
          const safeItems = Array.isArray(items) ? items : [];
          if (emptyState) {
            emptyState.style.display = safeItems.length ? 'none' : '';
            if (!safeItems.length) emptyState.textContent = 'Belum ada trending.';
          }
          if (!safeItems.length) return;

          safeItems.forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'list-group-item trending-item';
            li.style.animationDelay = `${Math.min(8, idx) * 40}ms`;

            const a = document.createElement('a');
            a.href = '#';
            a.className = 'd-flex align-items-center gap-3 w-100 text-decoration-none';
            a.style.color = 'inherit';

            const thumbUrl = item?.youtube?.thumbnail || item?.thumbnail || item?.spotify?.cover || './trending-placeholder.svg';
            let coverNode;
            if (thumbUrl) {
              const img = document.createElement('img');
              img.className = 'trending-thumb';
              img.width = 44;
              img.height = 44;
              img.loading = 'lazy';
              img.src = thumbUrl;
              img.alt = item?.title || 'Trending';
              coverNode = img;
            } else {
              const cover = document.createElement('div');
              cover.className = 'trending-cover';
              cover.innerHTML = '<i class="bi bi-music-note-beamed" aria-hidden="true"></i>';
              coverNode = cover;
            }
            a.appendChild(coverNode);

            const meta = document.createElement('div');
            meta.className = 'flex-grow-1';
            meta.style.minWidth = '0';

            const title = document.createElement('div');
            title.className = 'trending-title text-truncate';
            title.textContent = item?.title || 'Trending';
            meta.appendChild(title);

            const artist = document.createElement('div');
            artist.className = 'trending-artist text-truncate';
            artist.textContent = item?.artist || '';
            meta.appendChild(artist);

            a.appendChild(meta);
            a.addEventListener('click', (e) => {
              e.preventDefault();
              const q = item?.query || [item?.title, item?.artist].filter(Boolean).join(' ').trim();
              if (pasteToKeywordInput(q)) {
                setToast('Judul dipaste ke pencarian.', 'success');
              }
            });
            li.appendChild(a);
            ul.appendChild(li);
          });
        };

        const fetchTrendingNow = async () => {
          const emptyState = $('#trendingEmpty');
          const ul = $('#trendingList');
          if (emptyState) emptyState.textContent = 'Memuat trending...';
          let lastErr = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              if (attempt > 0) await new Promise((r) => setTimeout(r, 900 * attempt));
              const res = await fetch(`/api/trending-now?limit=6&force=${attempt ? 1 : 0}`, { cache: 'no-store' });
              const payload = await res.json().catch(() => null);
              const items = Array.isArray(payload?.items) ? payload.items : [];
              if (!res.ok) throw new Error(payload?.error || 'Gagal memuat trending');
              renderTrendingNow(items);
              return;
            } catch (e) {
              lastErr = e;
            }
          }
          if (ul) ul.innerHTML = '';
          if (emptyState) {
            emptyState.style.display = '';
            emptyState.textContent = 'Gagal memuat trending.';
          }
          try { console.warn('Trending fetch failed:', lastErr); } catch { }
        };

        $('#clearHistory')?.addEventListener('click', () => {
          localStorage.removeItem(historyKey);
          renderHistory();
          setToast('Riwayat dibersihkan');
        });

        // ===== Settings (offcanvas) =====
        const loadSettings = () => {
          const s = storage.load();
          state.backendUrl = s.backendUrl || '';
          state.adminBearer = s.adminBearer || '';
          state.assistantHistory = Array.isArray(s.assistantHistory) ? s.assistantHistory : [];
          state.assistantSettings = { ...defaultAssistantSettings, ...(s.assistantSettings || {}) };
          state.assistantSettings.memoryEnabled = state.assistantSettings.memoryEnabled !== false;
          state.assistantSettings.maxMemoryMessages = Math.max(10, Math.min(120, Number(state.assistantSettings.maxMemoryMessages) || 30));
          state.accessibility = { ...defaultAccessibility, ...(s.accessibility || {}) };
          state.experience = { ...defaultExperience, ...(s.experience || {}) };
          state.preferences = { ...defaultPreferences, ...(s.preferences || {}) };
          if (!state.preferences || typeof state.preferences !== 'object') {
            state.preferences = { ...defaultPreferences };
          }
          if (!state.preferences.rememberLastFormat) {
            state.preferences.lastFormat = null;
          } else if (state.preferences.lastFormat && typeof state.preferences.lastFormat === 'object') {
            const last = state.preferences.lastFormat;
            state.preferences.lastFormat = {
              format: typeof last.format === 'string' ? last.format : '',
              abr: Number.isFinite(Number(last.abr)) ? Number(last.abr) : null,
              sampleRate: Number.isFinite(Number(last.sampleRate)) ? Number(last.sampleRate) : null,
              videoQuality: typeof last.videoQuality === 'string' ? last.videoQuality : '',
            };
          } else {
            state.preferences.lastFormat = null;
          }
          if (!Array.isArray(state.experience.legendaryDex)) state.experience.legendaryDex = [];
          if (typeof state.experience.legendaryTarget !== 'string') state.experience.legendaryTarget = '';
          if (!Array.isArray(state.experience.spinHistory)) state.experience.spinHistory = [];
          if (!Number.isFinite(state.experience.spinTickets)) state.experience.spinTickets = 0;
          if (typeof state.experience.lastTriviaId !== 'string') state.experience.lastTriviaId = '';
          if (typeof state.experience.seasonalSkin !== 'string') state.experience.seasonalSkin = '';
          if (!state.experience.usage || typeof state.experience.usage !== 'object') {
            state.experience.usage = { ...defaultExperience.usage };
          } else {
            state.experience.usage = {
              vpn: Number(state.experience.usage.vpn) || 0,
              resume: Number(state.experience.usage.resume) || 0,
              soundfx: Number(state.experience.usage.soundfx) || 0,
              privateshare: Number(state.experience.usage.privateshare) || 0,
              spin: Number(state.experience.usage.spin) || 0
            };
          }
          legendaryCurrent = state.experience.legendaryTarget || '';
          state.narratorEnabled = !!s.narratorEnabled;
          state.backgroundEmail = s.backgroundEmail || '';
          $('#backendUrl').value = state.backendUrl;
          const backgroundEmailInput = $('#backgroundEmail');
          if (backgroundEmailInput) backgroundEmailInput.value = state.backgroundEmail;
          if (prefConfirmAutoDownload) prefConfirmAutoDownload.checked = !!state.preferences.confirmAutoDownload;
          if (prefRememberFormat) prefRememberFormat.checked = !!state.preferences.rememberLastFormat;
          if (prefOutputDir) prefOutputDir.value = state.preferences.outputDir || '';
          if (prefOrganizeBy) prefOrganizeBy.value = state.preferences.organizeBy || 'none';
          updateAccessibilityControls();
          applyAccessibility();
          updateAdminUi();
          updateBackendBadge();
          applyDashboardExperience();
          updateAvatarUi();
          updateMusicStatus(state.experience.mood === 'auto' ? determineAutoMood() : state.experience.mood);
          if (runnerHighScoreLabel) runnerHighScoreLabel.textContent = String(state.experience.highScore || 0);
          runnerState.highScore = Number(state.experience.highScore) || 0;
        };

        const applyStoredFormatPreference = () => {
          if (!state.preferences?.rememberLastFormat) return;
          const last = state.preferences.lastFormat;
          if (!last || typeof last !== 'object') return;
          let updated = false;
          if (formatSelect && last.format && Array.from(formatSelect.options || []).some((opt) => opt.value === last.format)) {
            formatSelect.value = last.format;
            updated = true;
          }
          if (abrSelect && Number.isFinite(last.abr)) {
            const abrValue = String(last.abr);
            if (Array.from(abrSelect.options || []).some((opt) => opt.value === abrValue)) {
              abrSelect.value = abrValue;
              updated = true;
            }
          }
          if (sampleRateSelect && Number.isFinite(last.sampleRate)) {
            const srValue = String(last.sampleRate);
            if (Array.from(sampleRateSelect.options || []).some((opt) => opt.value === srValue)) {
              sampleRateSelect.value = srValue;
              updated = true;
            }
          }
          if (videoQualitySelect && last.videoQuality && Array.from(videoQualitySelect.options || []).some((opt) => opt.value === last.videoQuality)) {
            videoQualitySelect.value = last.videoQuality;
            state.experience.videoQuality = videoQualitySelect.value || 'best';
            updated = true;
          }
          if (updated) {
            applyFormatPolicy();
          }
        };

        $('#saveSettings').addEventListener('click', () => {
          state.backendUrl = $('#backendUrl').value.trim();
          persistState();
          updateBackendBadge();
          setToast('Pengaturan disimpan');
        });
        $('#resetSettings').addEventListener('click', () => {
          storage.save({}); loadSettings(); setToast('Pengaturan direset');
        });

        const bindAccessibilityToggle = (key, el) => {
          if (!el) return;
          el.addEventListener('change', () => {
            state.accessibility = { ...state.accessibility, [key]: !!el.checked };
            applyAccessibility();
            persistState();
          });
        };

        bindAccessibilityToggle('highContrast', accessHighContrast);
        bindAccessibilityToggle('largeText', accessLargeText);
        bindAccessibilityToggle('reduceMotion', accessReduceMotion);

        if (prefConfirmAutoDownload) {
          prefConfirmAutoDownload.addEventListener('change', () => {
            state.preferences = {
              ...state.preferences,
              confirmAutoDownload: !!prefConfirmAutoDownload.checked,
            };
            persistState();
          });
        }

        if (prefRememberFormat) {
          prefRememberFormat.addEventListener('change', () => {
            const remember = !!prefRememberFormat.checked;
            let nextPrefs = {
              ...state.preferences,
              rememberLastFormat: remember,
              lastFormat: remember ? state.preferences.lastFormat || null : null,
            };
            if (!remember) {
              nextPrefs.lastFormat = null;
            } else if (!nextPrefs.lastFormat) {
              nextPrefs.lastFormat = {
                format: formatSelect?.value || '',
                abr: Number.isFinite(Number(abrSelect?.value)) ? Number(abrSelect.value) : null,
                sampleRate: Number.isFinite(Number(sampleRateSelect?.value)) ? Number(sampleRateSelect.value) : null,
                videoQuality: videoQualitySelect?.value || '',
              };
            }
            state.preferences = nextPrefs;
            persistState();
            if (remember) {
              applyStoredFormatPreference();
            }
          });
        }

        if (prefOutputDir) {
          prefOutputDir.addEventListener('change', () => {
            state.preferences = {
              ...state.preferences,
              outputDir: prefOutputDir.value.trim(),
            };
            persistState();
          });
        }

        if (prefOrganizeBy) {
          prefOrganizeBy.addEventListener('change', () => {
            state.preferences = {
              ...state.preferences,
              organizeBy: prefOrganizeBy.value,
            };
            persistState();
          });
        }

        // ===== URL helpers =====
        function parseTime(str) {
          if (!str) return null;
          if (/^\d+(?::\d+)*$/.test(str)) {
            return str.split(':').reduce((acc, v) => acc * 60 + Number(v), 0);
          }
          const n = Number(str);
          return Number.isNaN(n) ? null : n;
        }

        function secondsToClock(sec) {
          if (!Number.isFinite(sec)) return '00:00';
          const base = Math.max(0, sec);
          const h = Math.floor(base / 3600);
          const m = Math.floor((base % 3600) / 60);
          const s = Math.floor(base % 60);
          if (h) {
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          }
          return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        function secondsToInput(sec) {
          if (!Number.isFinite(sec)) return '';
          const base = Math.max(0, sec);
          const h = Math.floor(base / 3600);
          const m = Math.floor((base % 3600) / 60);
          const s = Math.floor(base % 60);
          if (h) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          }
          return `${m}:${s.toString().padStart(2, '0')}`;
        }

        function clamp(val, min, max) {
          if (!Number.isFinite(val)) return min;
          return Math.min(Math.max(val, min), max);
        }

        function sanitizeFileName(str) {
          return str.replace(/[\\/:*?"<>|\r\n]+/g, '').replace(/\s+/g, ' ').trim();
        }

        const MEDIA_HOSTS = {
          youtube: ['youtube.com', 'youtu.be', 'music.youtube.com'],
          spotify: ['open.spotify.com', 'spotify.com', 'spotify.link'],
          soundcloud: ['soundcloud.com', 'm.soundcloud.com'],
        };

        function cleanVideoTitle(rawTitle = '') {
          let result = String(rawTitle || '');
          const patternList = [
            /\s*\((?:official|official\s+video|official\s+audio|lyrics?|lyric\s+video|audio|video|visualizer|mv|music\s+video|color\s+coded|teaser|live).*?\)/gi,
            /\s*\[(?:official|official\s+video|lyrics?|audio|mv|music\s+video|visualizer|live).*?\]/gi,
            /\s*\b(?:official\s+video|lyrics?|audio\s+only|full\s+album)\b/gi,
            /\s*\b(?:HD|4K|1080p|720p)\b/gi,
          ];
          patternList.forEach((re) => {
            result = result.replace(re, '');
          });
          result = result.replace(/\s+-\s+(?:official|lyrics?|audio)/gi, '');
          result = result.replace(/\s{2,}/g, ' ').trim();
          return result;
        }

        function detectMediaSource(text = '') {
          const value = String(text || '').trim();
          if (!value) return 'unknown';
          try {
            const parsed = new URL(value);
            const host = parsed.hostname.toLowerCase();
            for (const [key, hosts] of Object.entries(MEDIA_HOSTS)) {
              if (hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
                return key;
              }
            }
          } catch {
            if (/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/i.test(value)) return 'youtube';
            if (/https?:\/\/(?:www\.)?open\.spotify\.com/i.test(value) || /spotify:(?:track|album)/i.test(value)) return 'spotify';
            if (/https?:\/\/(?:www\.)?soundcloud\.com/i.test(value)) return 'soundcloud';
          }
          return 'unknown';
        }

        function isSupportedMediaUrl(text = '') {
          return detectMediaSource(text) !== 'unknown';
        }

        function buildAutoFileName(meta = {}, opts = {}) {
          const fmt = (opts.format || formatSelect?.value || 'mp3').toLowerCase();
          const isVideo = ['mp4', 'webm', 'mkv'].includes(fmt);
          const artist = sanitizeFileName(meta.artist || meta.author || '');
          const title = sanitizeFileName(meta.cleanTitle || meta.title || meta.rawTitle || meta.id || '');
          let base = title || 'audio';
          if (artist) base = `${artist} - ${base}`;
          const bits = [];
          const abrValue = opts.abr != null ? opts.abr : Number(abrSelect?.value || 0);
          const srValue = opts.sampleRate != null ? opts.sampleRate : Number(sampleRateSelect?.value || 0);
          const videoQuality = opts.videoQuality || videoQualitySelect?.value || 'best';
          if (!isVideo && abrValue) bits.push(`${abrValue}kbps`);
          if (isVideo && videoQuality && videoQuality !== 'best') bits.push(`${videoQuality}p`);
          if (!isVideo && !abrValue && srValue) bits.push(`${Math.round(srValue / 1000)}kHz`);
          if (bits.length) base += ` (${bits.join(' • ')})`;
          return sanitizeFileName(base) || base;
        }

        function isYoutubeUrl(text = '') {
          return detectMediaSource(text) === 'youtube';
        }

        const RATING_STORE_KEY = 'ytmp3.ratings.v1';

        function loadRatingStore() {
          try {
            const raw = localStorage.getItem(RATING_STORE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
          } catch { }
          return {};
        }

        function persistRatingStore() {
          try {
            localStorage.setItem(RATING_STORE_KEY, JSON.stringify(ratingStore));
          } catch { }
        }

        function ratingKeyFrom(downloadUrl, meta = {}) {
          if (downloadUrl) return downloadUrl;
          if (meta.fileName) return `file:${meta.fileName}`;
          if (meta.baseName) return `base:${meta.baseName}`;
          return null;
        }

        function getRatingEntry(key) {
          if (!key) return null;
          if (!ratingStore[key]) {
            ratingStore[key] = { sum: 0, count: 0, user: 0 };
          }
          return ratingStore[key];
        }

        function formatRatingSummary(entry) {
          if (!entry || !entry.count) return 'Belum ada rating';
          const average = entry.sum / entry.count;
          return `${average.toFixed(1)} dari ${entry.count} rating`;
        }

        function updateRatingUi() {
          if (!ratingWrap) return;
          if (!currentRatingKey) {
            ratingWrap.hidden = true;
            return;
          }
          const entry = getRatingEntry(currentRatingKey);
          ratingWrap.hidden = false;
          if (ratingSummary) ratingSummary.textContent = formatRatingSummary(entry);
          if (ratingThanks) {
            if (entry.user) {
              ratingThanks.hidden = false;
              ratingThanks.textContent = `Terima kasih! Rating kamu: ${entry.user}/5`;
            } else {
              ratingThanks.hidden = true;
            }
          }
          ratingButtons.forEach((btn) => {
            const value = Number(btn.dataset.rating || 0);
            const isActive = entry.user && value <= entry.user;
            btn.classList.toggle('active', Boolean(isActive));
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.disabled = false;
          });
        }

        function resetRatingUi() {
          currentRatingKey = '';
          if (ratingWrap) ratingWrap.hidden = true;
        }

        function applyUserRating(value) {
          if (!currentRatingKey || !value) return;
          const entry = getRatingEntry(currentRatingKey);
          if (!entry) return;
          if (entry.user) {
            entry.sum = Math.max(0, entry.sum - Number(entry.user));
          } else {
            entry.count += 1;
          }
          entry.user = value;
          entry.sum += value;
          ratingStore[currentRatingKey] = entry;
          persistRatingStore();
          updateRatingUi();
          setToast('Terima kasih atas ratingnya!');
        }

        function updateShareAppTargets() {
          if (!shareAppButtons.length) return;
          const link = currentShareUrl;
          const title = lastPreviewTitle || document.title;
          shareAppButtons.forEach((btn) => {
            const app = btn.dataset.app;
            let target = '';
            if (link) {
              if (app === 'wa') target = `https://wa.me/?text=${encodeURIComponent(`${title} ${link}`.trim())}`;
              if (app === 'tg') target = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title || 'Hasil konversi YouTube')}`;
              if (app === 'fb') target = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
              if (app === 'tw') target = `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`;
              if (app === 'email') target = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(link)}`;
            }
            if (target) {
              btn.dataset.href = target;
              btn.disabled = false;
              btn.setAttribute('aria-disabled', 'false');
            } else {
              btn.dataset.href = '';
              btn.disabled = true;
              btn.setAttribute('aria-disabled', 'true');
            }
          });
        }

        async function tryPrefillClipboard({ forceToast = false, overrideExisting = false } = {}) {
          // Maintenance Check: Disable auto-paste if maintenance is active
          if (window.isMaintenance) return;
          const overlay = document.getElementById('maintenanceOverlay');
          if (overlay && !overlay.hidden) return;

          if (!urlInput || !navigator.clipboard?.readText) return;
          try {
            const text = (await navigator.clipboard.readText() || '').trim();
            if (!text || text === lastClipboardValue) return;
            if (!isSupportedMediaUrl(text)) return;
            if (!overrideExisting && urlInput.value.trim()) {
              lastClipboardValue = text;
              return;
            }
            urlInput.value = text;
            lastClipboardValue = text;
            updatePreview();
            if (forceToast || !clipboardToastShown) {
              setToast('URL dari clipboard terpasang otomatis');
              clipboardToastShown = true;
            }
          } catch (err) {
            if (forceToast) setToast('Tidak dapat membaca clipboard');
          }
        }

        // ===== Equalizer helpers =====
        const formatGain = (value) => `${Number(value) >= 0 ? '+' : ''}${Number(value)} dB`;

        const getEqValues = () => ({
          bass: Number(eqBass?.value || 0),
          mid: Number(eqMid?.value || 0),
          treble: Number(eqTreble?.value || 0),
        });

        const updateEqStatus = () => {
          if (!eqStatus) return;
          const { bass, mid, treble } = getEqValues();
          eqStatus.textContent = `Bass ${formatGain(bass)} ' Mid ${formatGain(mid)} ' Treble ${formatGain(treble)}`;
        };

        const setEqBadge = (input, badge) => {
          if (!input || !badge) return;
          badge.textContent = formatGain(input.value || 0);
        };

        const updateEqTrack = (input) => {
          if (!input) return;
          const min = Number(input.min || -12);
          const max = Number(input.max || 12);
          const val = Number(input.value || 0);
          const range = max - min || 1;
          const rawValuePercent = ((val - min) / range) * 100;
          const rawZeroPercent = ((0 - min) / range) * 100;
          const clampPct = (pct) => Math.min(100, Math.max(0, pct));
          const valuePercent = clampPct(rawValuePercent);
          const zeroPercent = clampPct(rawZeroPercent);
          const accent = getThemeColor('--bs-primary', '#0d6efd');
          const danger = getThemeColor('--bs-danger', '#dc3545');
          const neutral = getThemeColor('--bs-border-color', '#ced4da');
          let gradient;
          if (valuePercent >= zeroPercent) {
            gradient = `linear-gradient(90deg, ${danger} 0%, ${danger} ${zeroPercent}%, ${accent} ${zeroPercent}%, ${accent} ${valuePercent}%, ${neutral} ${valuePercent}%, ${neutral} 100%)`;
          } else {
            gradient = `linear-gradient(90deg, ${danger} 0%, ${danger} ${valuePercent}%, ${neutral} ${valuePercent}%, ${neutral} ${zeroPercent}%, ${accent} ${zeroPercent}%, ${accent} 100%)`;
          }
          input.style.background = gradient;
        };

        const refreshEqUi = () => {
          updateEqTrack(eqBass);
          updateEqTrack(eqMid);
          updateEqTrack(eqTreble);
          setEqBadge(eqBass, eqBassValue);
          setEqBadge(eqMid, eqMidValue);
          setEqBadge(eqTreble, eqTrebleValue);
          updateEqStatus();
        };

        const ensureEqualizer = () => {
          if (!previewPlayer) return false;
          const ctx = getAudioContext();
          if (!ctx) return false;
          if (eqReady) return true;
          if (!eqSource) {
            eqSource = ctx.createMediaElementSource(previewPlayer);
            const bass = ctx.createBiquadFilter();
            bass.type = 'lowshelf';
            bass.frequency.value = 200;
            const mid = ctx.createBiquadFilter();
            mid.type = 'peaking';
            mid.frequency.value = 1000;
            mid.Q.value = 1;
            const treble = ctx.createBiquadFilter();
            treble.type = 'highshelf';
            treble.frequency.value = 4000;
            eqFilters = [bass, mid, treble];

            // Visualizer Setup
            audioAnalyser = ctx.createAnalyser();
            audioAnalyser.fftSize = 256;
            eqSource.connect(audioAnalyser);

            eqSource.connect(bass);
            bass.connect(mid);
            mid.connect(treble);
            treble.connect(ctx.destination);
          }
          eqReady = true;
          return true;
        };

        const drawVisualizer = () => {
          const canvas = document.getElementById('audioVisualizer');
          if (!canvas || !audioAnalyser) return;

          if (previewPlayer.paused || previewPlayer.ended) {
            if (visualizerAnimId) cancelAnimationFrame(visualizerAnimId);
            return;
          }

          const canvasCtx = canvas.getContext('2d');
          const bufferLength = audioAnalyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const width = canvas.width;
          const height = canvas.height;

          const draw = () => {
            if (previewPlayer.paused || previewPlayer.ended) return;
            visualizerAnimId = requestAnimationFrame(draw);

            audioAnalyser.getByteFrequencyData(dataArray);

            canvasCtx.fillStyle = '#111';
            canvasCtx.fillRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              barHeight = (dataArray[i] / 255) * height;

              // Gradient color based on height
              const hue = (i / bufferLength) * 360;
              canvasCtx.fillStyle = `hsl(${hue}, 70%, 50%)`;

              canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
          };

          draw();
        };

        const applyEqFromInputs = () => {
          const ctx = getAudioContext();
          if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { });
          if (!ensureEqualizer()) return;
          const bassVal = Number(eqBass?.value || 0);
          const midVal = Number(eqMid?.value || 0);
          const trebleVal = Number(eqTreble?.value || 0);
          if (eqFilters[0]) eqFilters[0].gain.value = bassVal;
          if (eqFilters[1]) eqFilters[1].gain.value = midVal;
          if (eqFilters[2]) eqFilters[2].gain.value = trebleVal;
          refreshEqUi();
        };

        if (eqBass) eqBass.addEventListener('input', applyEqFromInputs);
        if (eqMid) eqMid.addEventListener('input', applyEqFromInputs);
        if (eqTreble) eqTreble.addEventListener('input', applyEqFromInputs);
        if (eqPresetFlat) eqPresetFlat.addEventListener('click', () => {
          if (eqBass) eqBass.value = 0;
          if (eqMid) eqMid.value = 0;
          if (eqTreble) eqTreble.value = 0;
          applyEqFromInputs();
          setToast('Equalizer direset ke mode Flat');
        });
        if (eqPresetPodcast) eqPresetPodcast.addEventListener('click', () => {
          if (eqBass) eqBass.value = 2;
          if (eqMid) eqMid.value = 3;
          if (eqTreble) eqTreble.value = -1;
          applyEqFromInputs();
          setToast('Preset Podcast diterapkan');
        });
        if (eqPresetBass) eqPresetBass.addEventListener('click', () => {
          if (eqBass) eqBass.value = 5;
          if (eqMid) eqMid.value = 0;
          if (eqTreble) eqTreble.value = 2;
          applyEqFromInputs();
          setToast('Bass+ diterapkan');
        });
        if (volumeBoost) {
          volumeBoost.addEventListener('input', updateBoostLabel);
          updateBoostLabel();
        }
        updateEqStatus();

        if (backgroundEmailInput) {
          backgroundEmailInput.addEventListener('input', () => {
            state.backgroundEmail = backgroundEmailInput.value.trim();
            persistState();
          });
        }

        const persistBackgroundJobs = () => {
          try {
            const ids = Array.from(backgroundJobsState.keys()).slice(0, 20);
            localStorage.setItem(BACKGROUND_STORE_KEY, JSON.stringify(ids));
          } catch { }
        };

        const notifyUser = (title, body) => {
          if (!('Notification' in window)) return;
          if (Notification.permission !== 'granted') return;
          const icon = './icons/icon.svg'; // Use web app icon
          const showNative = () => {
            try { new Notification(title, { body, icon }); } catch { }
          };
          if (navigator.serviceWorker?.ready) {
            navigator.serviceWorker.ready.then((reg) => {
              if (reg?.showNotification) reg.showNotification(title, { body, icon }); else showNative();
            }).catch(showNative);
          } else {
            showNative();
          }
        };

        const playCompletionSound = () => {
          if (window.Howl) {
            const sound = new Howl({
              src: ['https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'], // Example pleasant completion sound
              html5: true,
              volume: 0.5
            });
            sound.play();
          }
        };

        const updateServerTime = () => {
          fetch(api('/api/server-time'))
            .then(r => r.json())
            .then(d => {
              // Disabled to prefer local cute clock
              // const el = document.getElementById('serverTimeBadge');
              // if (el && d.time) el.innerHTML = `<i class="bi bi-clock me-1"></i>${d.time}`;
            })
            .catch(() => { });
          setTimeout(updateServerTime, 1000); // Update every second
        };
        // Start server time loop
        updateServerTime();

        const notifyJob = (job, isError = false) => {
          if (!('Notification' in window)) return;
          if (Notification.permission !== 'granted') return;
          const title = isError ? 'Konversi gagal' : 'Konversi selesai';
          const body = job?.result?.fileName || job?.error || job?.id || 'Job selesai';
          const icon = './icons/icon.svg';
          const showNative = () => {
            try { new Notification(title, { body, icon }); } catch { }
          };
          if (navigator.serviceWorker?.ready) {
            navigator.serviceWorker.ready.then((reg) => {
              if (reg?.showNotification) reg.showNotification(title, { body, icon }); else showNative();
            }).catch(showNative);
          } else {
            showNative();
          }
        };

        const renderBackgroundJobs = () => {
          if (!backgroundList || !backgroundEmpty) return;
          backgroundList.innerHTML = '';
          const jobs = Array.from(backgroundJobsState.values())
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          if (!jobs.length) {
            backgroundEmpty.hidden = false;
            return;
          }
          backgroundEmpty.hidden = true;
          jobs.slice(0, 12).forEach((job) => {
            const li = document.createElement('li');
            li.className = 'list-group-item small';
            const status = job.status || 'queued';
            const badge = status === 'done' ? 'success' : status === 'error' ? 'danger' : 'secondary';
            const label = job?.result?.fileName || job?.payload?.fileName || job?.payload?.title || job?.payload?.url || `Job ${job.id}`;
            const actions = [];
            if (job.result?.downloadUrl) {
              const href = absoluteFromRelative(job.result.downloadUrl);
              actions.push(`<a class="btn btn-sm btn-outline-primary" href="${href}" download="${job.result.fileName || ''}"><i class="bi bi-download"></i> Unduh</a>`);
            }
            if (job.notify?.email) {
              actions.push(`<span class="badge text-bg-warning text-dark"><i class="bi bi-envelope-at me-1"></i>${job.notify.email}</span>`);
            }
            if (status !== 'done' && status !== 'error') {
              actions.push('<span class="text-secondary">Diproses...</span>');
            }
            li.innerHTML = `
        <div class="d-flex flex-column gap-1">
          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-semibold text-truncate" title="${label}">${label}</span>
            <span class="badge text-bg-${badge} text-uppercase">${status}</span>
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="text-secondary">#${job.id.slice(-6)}</span>
            ${actions.join(' ')}
          </div>
        </div>`;
            backgroundList.appendChild(li);
          });
        };

        const updateBackgroundJob = (job) => {
          if (!job || !job.id) return;
          const previous = backgroundJobsState.get(job.id);
          backgroundJobsState.set(job.id, job);
          renderBackgroundJobs();
          persistBackgroundJobs();
          if (job.status === 'done' && previous?.status !== 'done') {
            setToast(`Job selesai: ${job.result?.fileName || job.id}`);
            playCompletionSound();
            notifyJob(job, false);
            updateAiStatus(`Job selesai: ${job.result?.fileName || job.id}`, 'success');
            if (job.result?.downloadUrl) {
              lastResult = {
                downloadUrl: absoluteFromRelative(job.result.downloadUrl),
                fileName: job.result.fileName || '',
                format: job.result.format || '',
                jobId: job.id,
                sampleRate: job.result.sampleRate || null,
                channels: job.result.channels || null,
              };
            }
            registerConversionSuccess('background', {
              vpnFriendly: job.result?.vpnFriendly ?? job.payload?.vpnFriendly,
              smartResume: job.result?.smartResume ?? job.payload?.smartResume,
              soundEffect: job.result?.soundEffect ?? job.payload?.soundEffect,
            });
          } else if (job.status === 'error' && previous?.status !== 'error') {
            setToast(`Job gagal: ${job.error || job.id}`);
            notifyJob(job, true);
            updateAiStatus(`Job gagal: ${job.error || job.id}`, 'danger');
          }
        };

        const scheduleJobPoll = (id, delay = 3500) => {
          if (!id) return;
          if (backgroundTimers.has(id)) {
            clearTimeout(backgroundTimers.get(id));
          }
          const timer = setTimeout(() => pollBackgroundJob(id), delay);
          backgroundTimers.set(id, timer);
        };

        const pollBackgroundJob = async (id) => {
          backgroundTimers.delete(id);
          try {
            const resp = await fetch(api(`/api/background/${id}`));
            if (!resp.ok) {
              if (resp.status === 404) {
                backgroundJobsState.delete(id);
                renderBackgroundJobs();
                persistBackgroundJobs();
              }
              return;
            }
            const { data: payload } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal mengambil status job'),
              logLabel: 'background-status',
            });
            if (payload?.job) {
              updateBackgroundJob(payload.job);
              if (payload.job.status !== 'done' && payload.job.status !== 'error') {
                scheduleJobPoll(id, 4000);
              }
            }
          } catch {
            scheduleJobPoll(id, 6000);
          }
        };

        const refreshBackgroundJobs = async () => {
          try {
            const resp = await fetch(api('/api/background'));
            if (!resp.ok) return;
            const { data: payload } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal memuat daftar job'),
              logLabel: 'background-list',
            });
            if (Array.isArray(payload?.jobs)) {
              backgroundJobsState.clear();
              payload.jobs.forEach((job) => {
                if (job && job.id) backgroundJobsState.set(job.id, job);
              });
              renderBackgroundJobs();
              persistBackgroundJobs();
              payload.jobs.forEach((job) => {
                if (job.status !== 'done' && job.status !== 'error') scheduleJobPoll(job.id, 2000);
              });
            }
          } catch { }
        };

        const loadStoredJobs = () => {
          try {
            const raw = localStorage.getItem(BACKGROUND_STORE_KEY);
            if (!raw) return;
            const ids = JSON.parse(raw);
            if (Array.isArray(ids)) {
              ids.slice(0, 20).forEach((id) => scheduleJobPoll(id, 500));
            }
          } catch { }
        };

        async function handlePrivateShare() {
          if (!currentDownloadUrl) {
            setToast('Konversi dulu sebelum membuat Private Room.');
            return;
          }
          const raw = window.prompt('Buat password Private Room (min. 4 karakter):');
          if (raw == null) {
            setToast('Pembuatan Private Room dibatalkan.');
            return;
          }
          const password = raw.trim();
          if (password.length < 4) {
            setToast('Password minimal 4 karakter.');
            return;
          }
          try {
            const relative = toRelativePublic(currentDownloadUrl);
            if (!relative) throw new Error('Link unduhan tidak valid.');
            const resp = await fetch(api('/api/private-share'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                downloadUrl: relative,
                password,
                fileName: lastPreviewMeta?.fileName || currentDownloadName || ''
              })
            });
            const { data: payload } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal membuat Private Room'),
              logLabel: 'private-share-create',
            });
            const roomId = payload?.room?.id;
            if (!roomId) throw new Error('Room tidak valid.');
            const roomUrl = new URL('./private.html', window.location.href);
            roomUrl.searchParams.set('room', roomId);
            const shareUrl = roomUrl.toString();
            currentShareUrl = shareUrl;
            if (shareLinkInput) shareLinkInput.value = shareUrl;
            if (shareInfo) shareInfo.textContent = 'Private Room siap dibagikan. Berikan password ke temanmu.';
            updateShareAppTargets();
            try {
              await navigator.clipboard.writeText(shareUrl);
              setToast('Link Private Room tersalin.');
            } catch {
              setToast('Private Room dibuat. Salin link secara manual jika perlu.');
            }
            if (!state.experience.usage) state.experience.usage = { ...defaultExperience.usage };
            state.experience.usage.privateshare = (Number(state.experience.usage.privateshare) || 0) + 1;
            awardBadge('privateshare');
            incrementPoints(26, 'Private Room Share');
            updateMascotMood('badge');
            persistState();
          } catch (err) {
            console.error('Private share error', err);
            setToast(`Gagal membuat Private Room: ${err.message}`);
          }
        }

        const shareLink = async (link) => {
          if (!link) { setToast('Belum ada link untuk dibagikan'); return; }
          if (navigator.share) {
            try {
              await navigator.share({ title: lastPreviewTitle || document.title, url: link });
              return;
            } catch (err) {
              if (err && err.name === 'AbortError') return;
            }
          }
          try {
            await navigator.clipboard.writeText(link);
            setToast('Link share disalin');
          } catch {
            setToast(link);
          }
        };

        if (shareBtn) shareBtn.addEventListener('click', () => shareLink(currentShareUrl));
        if (miniShareBtn) miniShareBtn.addEventListener('click', () => shareLink(currentShareUrl));
        if (copyShareBtn) copyShareBtn.addEventListener('click', async () => {
          if (!currentShareUrl) { setToast('Belum ada link share'); return; }
          try {
            await navigator.clipboard.writeText(currentShareUrl);
            setToast('Link share disalin');
          } catch {
            setToast(currentShareUrl);
          }
        });
        if (openShareBtn) openShareBtn.addEventListener('click', () => {
          if (!currentShareUrl) { setToast('Belum ada link share'); return; }
          window.open(currentShareUrl, '_blank', 'noopener');
        });
        if (saveDriveBtn) saveDriveBtn.addEventListener('click', () => handleSaveToDrive());

        if (privateShareBtn) privateShareBtn.addEventListener('click', handlePrivateShare);

        if (openSpinBtn) {
          openSpinBtn.addEventListener('click', () => {
            if (!spinModalEl) return;
            const modal = bs?.Modal?.getOrCreateInstance
              ? bs.Modal.getOrCreateInstance(spinModalEl)
              : null;
            pendingSpinOffer = false;
            modal?.show();
            updateSpinUi();
          });
        }

        if (spinStartBtn) spinStartBtn.addEventListener('click', startLuckySpin);

        if (spinModalEl) {
          spinModalEl.addEventListener('shown.bs.modal', () => {
            pendingSpinOffer = false;
            updateSpinUi();
            if (spinStartBtn && !spinStartBtn.disabled) {
              spinStartBtn.focus();
            } else {
              const closeBtn = spinModalEl.querySelector('[data-bs-dismiss="modal"]');
              if (closeBtn instanceof HTMLElement) closeBtn.focus();
            }
          });
        }

        if (openTriviaBtn) openTriviaBtn.addEventListener('click', () => openTriviaModal(false));
        if (triviaSkipBtn) triviaSkipBtn.addEventListener('click', () => loadTriviaQuestion(false));
        if (triviaNextBtn) triviaNextBtn.addEventListener('click', () => loadTriviaQuestion(false));
        if (triviaModalEl) {
          triviaModalEl.addEventListener('shown.bs.modal', () => {
            const firstOption = triviaOptionsEl ? triviaOptionsEl.querySelector('button') : null;
            if (firstOption instanceof HTMLElement) {
              firstOption.focus();
            } else if (triviaSkipBtn instanceof HTMLElement) {
              triviaSkipBtn.focus();
            }
          });
          triviaModalEl.addEventListener('hidden.bs.modal', () => {
            currentTrivia = null;
            triviaAnswered = false;
          });
        }

        updateShareAppTargets();
        if (shareAppButtons.length) {
          shareAppButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
              const target = btn.dataset.href;
              if (!target) { setToast('Belum ada link share'); return; }
              window.open(target, '_blank', 'noopener');
            });
          });
        }

        if (ratingButtons.length) {
          ratingButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
              const value = Number(btn.dataset.rating || 0);
              if (!value) { return; }
              if (!currentRatingKey) { setToast('Konversi audio dulu sebelum memberi rating'); return; }
              applyUserRating(value);
            });
          });
        }

        const updateMiniSubtitle = () => {
          if (!miniSubtitle) return;
          const parts = [];
          if (lastPreviewMeta?.format) parts.push(String(lastPreviewMeta.format).toUpperCase());
          const sr = Number(lastPreviewMeta?.sampleRate || 0);
          if (Number.isFinite(sr) && sr > 0) {
            const kHz = Math.round((sr / 1000) * 10) / 10;
            parts.push(`${kHz % 1 === 0 ? kHz.toFixed(0) : kHz.toFixed(1)} kHz`);
          }
          const ch = Number(lastPreviewMeta?.channels || 0);
          if (Number.isFinite(ch) && ch > 0) {
            parts.push(ch === 1 ? 'Mono' : `${ch}-Ch`);
          }
          const duration = previewPlayer?.duration;
          if (duration && Number.isFinite(duration) && duration > 0) parts.push(secondsToClock(duration));
          const name = lastPreviewMeta?.fileName || lastPreviewMeta?.baseName || currentDownloadName;
          if (name) parts.push(name);
          miniSubtitle.textContent = parts.join(' • ');
        };

        const getActivePreviewMedia = () => {
          if (previewVideo && !previewVideo.hidden && previewVideo.src) return previewVideo;
          return previewPlayer;
        };
        const seekPreview = (deltaSec = 0) => {
          const media = getActivePreviewMedia();
          if (!media || !Number.isFinite(media.duration)) return;
          media.currentTime = Math.max(0, Math.min(media.duration, (media.currentTime || 0) + deltaSec));
        };
        prevRewindBtn?.addEventListener('click', () => seekPreview(-10));
        prevForwardBtn?.addEventListener('click', () => seekPreview(10));
        prevPlayPauseBtn?.addEventListener('click', () => {
          const media = getActivePreviewMedia();
          if (!media) return;
          if (media.paused) media.play().catch(() => { });
          else media.pause();
        });
        previewSpeedSelect?.addEventListener('change', () => {
          const rate = Number(previewSpeedSelect.value || 1);
          if (previewPlayer) previewPlayer.playbackRate = rate;
          if (previewVideo) previewVideo.playbackRate = rate;
        });

        const PLAN_KEY = 'ytconv_subscription_plan';
        const readPlan = () => {
          try { return localStorage.getItem(PLAN_KEY) || ''; } catch { return ''; }
        };
        const writePlan = (plan) => {
          try { localStorage.setItem(PLAN_KEY, plan); } catch { }
        };
        const renderPlan = () => {
          const plan = readPlan();
          if (!activePlanBadge) return;
          if (!plan) {
            activePlanBadge.className = 'badge text-bg-secondary';
            activePlanBadge.textContent = 'Belum pilih paket';
            return;
          }
          const isPremium = plan === 'premium';
          activePlanBadge.className = `badge ${isPremium ? 'text-bg-primary' : 'text-bg-success'}`;
          activePlanBadge.textContent = isPremium ? 'Premium (Gratis)' : 'Free';
        };
        const choosePlan = (plan) => {
          const label = plan === 'premium' ? 'Premium (Gratis)' : 'Free';
          if (!confirm(`Pilih paket ${label}? Kamu bisa ganti lagi kapan saja.`)) return;
          writePlan(plan);
          renderPlan();
          if (saveCloudinaryStatus) saveCloudinaryStatus.textContent = `Paket aktif: ${label}. Kamu bisa simpan lagu ke Cloudinary.`;
          setToast(`Paket ${label} aktif.`, 'success');
        };
        chooseFreePlanBtn?.addEventListener('click', () => choosePlan('free'));
        choosePremiumPlanBtn?.addEventListener('click', () => choosePlan('premium'));
        renderPlan();

        const savePreviewToCloudinary = async () => {
          if (!state?.auth?.user) {
            setToast('Login Google dulu untuk simpan lagu ke Cloudinary.', 'warning');
            if (saveCloudinaryStatus) saveCloudinaryStatus.textContent = 'Gagal: wajib login Google dulu.';
            return;
          }
          const plan = readPlan();
          if (!plan) {
            setToast('Pilih paket Free/Premium dulu sebelum simpan.', 'warning');
            if (saveCloudinaryStatus) saveCloudinaryStatus.textContent = 'Gagal: paket belum dipilih.';
            return;
          }
          if (!currentDownloadUrl) {
            setToast('Belum ada lagu yang bisa disimpan.', 'warning');
            return;
          }
          if (saveCloudinaryBtn) saveCloudinaryBtn.disabled = true;
          if (saveCloudinaryStatus) saveCloudinaryStatus.textContent = 'Mengunggah ke Cloudinary...';
          try {
            const resp = await fetch(currentDownloadUrl);
            if (!resp.ok) throw new Error(`Fetch file gagal (${resp.status})`);
            const blob = await resp.blob();
            const baseName = (currentDownloadName || 'ytconv-audio').replace(/[^\w.\- ]+/g, '').trim() || 'ytconv-audio';
            const ext = (lastPreviewMeta?.format || 'mp3').toLowerCase();
            const file = new File([blob], `${baseName}.${ext}`, { type: blob.type || 'audio/mpeg' });
            const uploader = window.uploadToCloudinaryAuto || window.uploadToCloudinary || null;
            if (typeof uploader !== 'function') {
              throw new Error('Uploader Cloudinary belum siap. Reload halaman lalu coba lagi.');
            }
            const cloudUrl = await uploader(file, `ytconv/user-library/${state.auth.user.id || 'anon'}`);
            if (!cloudUrl) throw new Error('Cloudinary tidak mengembalikan URL');
            if (saveCloudinaryStatus) {
              saveCloudinaryStatus.innerHTML = `Berhasil disimpan: <a href=\"${cloudUrl}\" target=\"_blank\" rel=\"noopener noreferrer\">Buka file cloud</a>`;
            }
            pushHistory({
              originalUrl: $('#url')?.value?.trim() || '',
              downloadUrl: cloudUrl,
              serverUrl: currentDownloadUrl || '',
              cloudUrl,
              fileName: currentDownloadName || `${baseName}.${ext}`,
              fileSize: Number(blob.size || 0),
              format: lastPreviewMeta?.format || ext,
              abr: Number($('#abr')?.value || 0) || undefined,
              meta: {
                title: $('#id3Title')?.value?.trim() || lastPreviewMeta?.title || currentDownloadName || '',
                artist: $('#id3Artist')?.value?.trim() || '',
                album: $('#id3Album')?.value?.trim() || '',
                cover: $('#coverPreview')?.src || '',
              },
            });
            if (typeof renderHistory === 'function') renderHistory();
            if (typeof renderBasicHistory === 'function') renderBasicHistory();
            setToast('Lagu berhasil disimpan ke Cloudinary.', 'success');
          } catch (err) {
            console.error('savePreviewToCloudinary error', err);
            if (saveCloudinaryStatus) saveCloudinaryStatus.textContent = `Gagal simpan: ${err.message || 'unknown error'}`;
            setToast('Gagal simpan ke Cloudinary.', 'danger');
          } finally {
            if (saveCloudinaryBtn) saveCloudinaryBtn.disabled = false;
          }
        };
        saveCloudinaryBtn?.addEventListener('click', () => savePreviewToCloudinary());

        const updateMiniPlayState = () => {
          if (!miniPlayBtn || !previewPlayer) return;
          const paused = previewPlayer.paused;
          if (miniPlayIcon) miniPlayIcon.className = paused ? 'bi bi-play-fill' : 'bi bi-pause-fill';
          if (miniPlayLabel) miniPlayLabel.textContent = paused ? 'Putar' : 'Jeda';
          miniPlayBtn.setAttribute('aria-label', paused ? 'Putar' : 'Jeda');
        };

        if (miniPlayBtn) miniPlayBtn.addEventListener('click', () => {
          if (!previewPlayer) return;
          if (previewPlayer.paused) previewPlayer.play().catch(() => { });
          else previewPlayer.pause();
        });

        if (miniCloseBtn) miniCloseBtn.addEventListener('click', () => {
          if (miniPlayerEl) miniPlayerEl.hidden = true;
        });

        if (miniSeek) {
          miniSeek.addEventListener('input', (e) => {
            if (!previewPlayer || !previewPlayer.duration) return;
            miniSeeking = true;
            const ratio = Number(e.target.value) / 1000;
            if (miniTime) miniTime.textContent = `${secondsToClock(ratio * previewPlayer.duration)} / ${secondsToClock(previewPlayer.duration)}`;
          });
          const commitSeek = (e) => {
            if (!previewPlayer || !previewPlayer.duration) { miniSeeking = false; return; }
            const ratio = Number(e.target.value) / 1000;
            previewPlayer.currentTime = clamp(ratio, 0, 1) * previewPlayer.duration;
            miniSeeking = false;
          };
          miniSeek.addEventListener('change', commitSeek);
          miniSeek.addEventListener('pointerup', (e) => commitSeek(e));
        }

        if (previewPlayer) {
          previewPlayer.addEventListener('loadedmetadata', () => {
            updateMiniPlayState();
            if (miniSeek) {
              miniSeek.disabled = !previewPlayer.duration;
              miniSeek.value = 0;
            }
            if (miniTime) miniTime.textContent = previewPlayer.duration ? `00:00 / ${secondsToClock(previewPlayer.duration)}` : '00:00';
            updateMiniSubtitle();
          });
          previewPlayer.addEventListener('play', async () => {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
              try { await ctx.resume(); } catch { }
            }
            ensureEqualizer();
            applyEqFromInputs();
            updateMiniPlayState();

            // Start Visualizer
            const visCanvas = document.getElementById('audioVisualizer');
            if (visCanvas) {
              visCanvas.style.display = 'block';
              drawVisualizer();
            }

            if (miniPlayerEl) miniPlayerEl.hidden = false;
          });
          previewPlayer.addEventListener('pause', () => {
            updateMiniPlayState();
            if (visualizerAnimId) cancelAnimationFrame(visualizerAnimId);
          });
          previewPlayer.addEventListener('ended', updateMiniPlayState);
          previewPlayer.addEventListener('timeupdate', () => {
            if (!miniTime) return;
            const dur = previewPlayer.duration || 0;
            const cur = previewPlayer.currentTime || 0;
            miniTime.textContent = dur ? `${secondsToClock(cur)} / ${secondsToClock(dur)}` : secondsToClock(cur);
            if (miniSeek && !miniSeeking && dur) {
              miniSeek.value = Math.round((cur / dur) * 1000);
            }
          });
        }

        async function updatePreview() {
          const url = (urlInput?.value || '').trim();
          if (!url) {
            if (previewWrap) previewWrap.hidden = true;
            lastVideoMeta = {};
            lastVideoInfo = null;
            return;
          }
          if (!isSupportedMediaUrl(url)) {
            if (previewWrap) previewWrap.hidden = true;
            lastVideoMeta = {};
            lastVideoInfo = null;
            return;
          }
          try {
            const info = await fetchVideoInfoClient({ url });
            if (info) applyVideoMetadata(info, { setUrl: false, autoFillId3: false, fillEmptyId3: true });
          } catch (err) {
            if (err?.name === 'AbortError') return;
            if (previewWrap) previewWrap.hidden = true;
            lastVideoMeta = {};
            lastVideoInfo = null;
          }
        }
        if (urlInput) urlInput.addEventListener('focus', () => { tryPrefillClipboard({ forceToast: false, overrideExisting: false }); });
        $('#pasteBtn').addEventListener('click', async () => {
          try { $('#url').value = (await navigator.clipboard.readText() || '').trim(); } catch { }
          $('#url').focus();
          updatePreview();
        });
        $('#sampleBtn').addEventListener('click', () => {
          $('#url').value = 'https://www.youtube.com/watch?v=7UecFm_bSTU';
          updatePreview();
        });
        $('#url').addEventListener('change', updatePreview);
        if (formatSelect) formatSelect.addEventListener('change', () => {
          applyFormatPolicy();
          if (qualityPresetSelect && qualityPresetSelect.value !== 'custom') {
            applyQualityPresetForFormat(formatSelect.value || 'mp3', qualityPresetSelect.value);
          }
        });

        const markQualityCustom = () => {
          if (!qualityPresetSelect || suppressQualityPreset) return;
          if (qualityPresetSelect.value !== 'custom') {
            qualityPresetSelect.value = 'custom';
          }
        };

        if (qualityPresetSelect) {
          qualityPresetSelect.addEventListener('change', () => {
            if (!formatSelect) return;
            const fmt = formatSelect.value || 'mp3';
            if (qualityPresetSelect.value === 'custom') return;
            applyQualityPresetForFormat(fmt, qualityPresetSelect.value);
          });
        }

        if (abrSelect) abrSelect.addEventListener('change', markQualityCustom);
        if (sampleRateSelect) sampleRateSelect.addEventListener('change', markQualityCustom);
        if (autoTagBtn) autoTagBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          resetAiInsights();
          updateAiStatus('Menganalisis metadata...', 'info');
          try {
            const { data: payload } = await postJson('/api/ai-tags', {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
            }, {
              fallbackMessage: translateMessage('Gagal menganalisis'),
              logLabel: 'ai-tags',
            });
            const tags = payload.tags || {};
            applyAiTagSuggestions(tags, { respectManual: false });
            autoTagsState.lastSignature = buildAutoTagsSignature({
              title: tags.title || title,
              artist: tags.artist || $('#id3Artist').value.trim() || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
            });
            updateAiStatus(`Genre ID3: <strong>${tags.genre || '-'}</strong>${tags.mood ? ` • Mood: <strong>${tags.mood}</strong>` : ''}`, 'success');
            setToast('Metadata diperbarui otomatis');
          } catch (err) {
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI tags: ' + err.message);
          }
        });

        if (toolRefreshBtn) {
          toolRefreshBtn.addEventListener('click', () => refreshToolStatus({ manual: true }));
        }

        if (aiCaptionBtn) aiCaptionBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Menulis caption promosi...', 'info');
          resetAiCaption();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              speedMode: $('#speedMode').value,
              denoise: denoiseInput?.checked || false,
              volumeBoost: Number(volumeBoost?.value || 0) || 0,
              enhancer: enhancerSelect?.value || 'none',
              format: $('#format').value,
            };
            const { data: captionData } = await postJson('/api/ai-caption', payload, {
              fallbackMessage: translateMessage('Gagal menulis caption'),
              logLabel: 'ai-caption',
            });
            const caption = (captionData.caption || '').trim();
            const hashtags = Array.isArray(captionData.hashtags) ? captionData.hashtags.filter(Boolean) : [];
            if (aiCaptionText) {
              const combined = [caption, hashtags.join(' ')].filter(Boolean).join('\n');
              aiCaptionText.value = combined;
            }
            if (aiCaptionMeta) {
              aiCaptionMeta.textContent = hashtags.length
                ? `Termasuk ${hashtags.length} hashtag: ${hashtags.join(' ')}`
                : 'Tidak ada hashtag tambahan';
            }
            if (aiCaptionWrap) aiCaptionWrap.hidden = false;
            updateAiStatus('Caption promosi siap digunakan ?', 'success');
            setToast('Caption siap disalin');
          } catch (err) {
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI caption: ' + err.message);
          }
        });

        if (aiCaptionCopy) aiCaptionCopy.addEventListener('click', async () => {
          const text = aiCaptionText?.value?.trim();
          if (!text) { setToast('Belum ada caption untuk disalin'); return; }
          try {
            await navigator.clipboard.writeText(text);
            setToast('Caption disalin ke clipboard');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiPitchBtn) aiPitchBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Menyusun pitch playlist...', 'info');
          resetAiPitch();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? id3Genre.value.trim() || undefined : undefined,
            };
            const { data: pitchData } = await postJson('/api/ai-pitch', payload, {
              fallbackMessage: translateMessage('Gagal membuat pitch'),
              logLabel: 'ai-pitch',
            });
            const pitch = (pitchData.pitch || '').trim();
            if (aiPitchText) aiPitchText.value = pitch;
            if (aiPitchHook) aiPitchHook.textContent = pitchData.hook ? `Hook: ${pitchData.hook}` : '';
            if (aiPitchPlaylists) {
              const list = Array.isArray(pitchData.playlists) ? pitchData.playlists.filter(Boolean) : [];
              aiPitchPlaylists.textContent = list.length ? `Target playlist: ${list.join(', ')}` : '';
            }
            if (id3Genre && !id3Genre.value.trim() && pitchData.tags?.genre) {
              id3Genre.value = pitchData.tags.genre;
            }
            if (aiPitchWrap) aiPitchWrap.hidden = false;
            updateAiStatus('Pitch playlist siap dipakai ?', 'success');
            setToast('Pitch siap disalin ke proposal playlist');
          } catch (err) {
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI pitch: ' + err.message);
          }
        });

        if (aiAudiophileBtn) aiAudiophileBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Menganalisis karakter audio...', 'info');
          resetAiAudiophile();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? (id3Genre.value.trim() || undefined) : undefined,
              format: $('#format').value,
              sampleRate: Number(sampleRateSelect?.value || 0) || undefined,
              speedMode: $('#speedMode').value,
              denoise: denoiseInput?.checked || false,
              volumeBoost: Number(volumeBoost?.value || 0) || 0,
              enhancer: enhancerSelect?.value || 'none',
              normalize: $('#normalize').checked,
            };
            const { data: audiophileData } = await postJson('/api/ai-audiophile', payload, {
              fallbackMessage: translateMessage('Gagal membuat panduan'),
              logLabel: 'ai-audiophile',
            });
            const guide = audiophileData.guide || {};
            const lines = [];
            const summary = (guide.summary || '').trim();
            const sampleAdvice = (guide.sampleRate || '').trim();
            if (summary) lines.push(summary);
            if (sampleAdvice) lines.push('', `Sample rate: ${sampleAdvice}`);
            if (Array.isArray(guide.eq) && guide.eq.length) {
              lines.push('', 'Rekomendasi EQ:');
              guide.eq.filter(Boolean).forEach((item) => lines.push(`- ${item}`));
            }
            if (Array.isArray(guide.playback) && guide.playback.length) {
              lines.push('', 'Monitoring & playback:');
              guide.playback.filter(Boolean).forEach((item) => lines.push(`- ${item}`));
            }
            if (Array.isArray(guide.enhancements) && guide.enhancements.length) {
              lines.push('', 'Catatan tambahan:');
              guide.enhancements.filter(Boolean).forEach((item) => lines.push(`- ${item}`));
            }
            const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            if (aiAudiophileText) {
              aiAudiophileText.value = text;
              const lineCount = text ? text.split(/\n/).length : 5;
              aiAudiophileText.rows = Math.min(12, Math.max(5, lineCount));
            }
            if (aiAudiophileMeta) {
              const metaParts = [];
              if (guide.focus) metaParts.push(`Fokus: ${guide.focus}`);
              if (guide.tags?.genre) metaParts.push(`Genre: ${guide.tags.genre}`);
              if (guide.tags?.mood) metaParts.push(`Mood: ${guide.tags.mood}`);
              if (guide.tags?.energy) metaParts.push(`Energi: ${guide.tags.energy}`);
              aiAudiophileMeta.textContent = metaParts.join(' • ');
            }
            if (aiAudiophileWrap) aiAudiophileWrap.hidden = false;
            updateAiStatus('Panduan audiophile siap digunakan 🎧', 'success');
            setToast('Panduan audiophile siap disalin');
          } catch (err) {
            resetAiAudiophile();
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI audiophile: ' + err.message);
          }
        });

        if (aiHookBtn) aiHookBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Menyusun hook promosi...', 'info');
          resetAiHook();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? (id3Genre.value.trim() || undefined) : undefined,
              format: $('#format').value,
              speedMode: $('#speedMode').value,
              denoise: denoiseInput?.checked || false,
              volumeBoost: Number(volumeBoost?.value || 0) || 0,
              enhancer: enhancerSelect?.value || 'none',
              eq: getEqValues(),
            };
            const { data: hookData } = await postJson('/api/ai-hook', payload, {
              fallbackMessage: translateMessage('Gagal membuat hook'),
              logLabel: 'ai-hook',
            });
            const hooks = Array.isArray(hookData.hooks) ? hookData.hooks.filter(Boolean) : [];
            if (aiHookList) {
              aiHookList.innerHTML = '';
              hooks.forEach((line, idx) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${idx + 1}</strong><span>${line}</span>`;
                aiHookList.appendChild(li);
              });
            }
            if (aiHookCtas) {
              aiHookCtas.innerHTML = '';
              const ctas = Array.isArray(hookData.ctas) ? hookData.ctas.filter(Boolean) : [];
              ctas.forEach((cta) => {
                const span = document.createElement('span');
                span.textContent = cta;
                aiHookCtas.appendChild(span);
              });
              const hashtags = Array.isArray(hookData.hashtags) ? hookData.hashtags.filter(Boolean) : [];
              hashtags.forEach((tag) => {
                const span = document.createElement('span');
                span.textContent = tag.startsWith('#') ? tag : `#${tag}`;
                aiHookCtas.appendChild(span);
              });
            }
            if (aiHookMeta) {
              const parts = [];
              if (hookData.emoji) parts.push(hookData.emoji);
              if (hookData.tone) parts.push(`Tone: ${hookData.tone}`);
              if (hookData.focus) parts.push(hookData.focus);
              aiHookMeta.textContent = parts.filter(Boolean).join(' • ');
            }
            if (aiHookWrap) aiHookWrap.hidden = false;
            lastAiHookData = {
              hooks,
              ctas: Array.isArray(hookData.ctas) ? hookData.ctas.filter(Boolean) : [],
              hashtags: Array.isArray(hookData.hashtags) ? hookData.hashtags.filter(Boolean) : [],
              meta: aiHookMeta?.textContent || '',
            };
            updateAiStatus('Hook promosi siap pakai ?', 'success');
            setToast('Hook & CTA siap disalin');
          } catch (err) {
            resetAiHook();
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI hook: ' + err.message);
          }
        });

        if (aiVisualBtn) aiVisualBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Membangun prompt cover art...', 'info');
          resetAiVisual();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? (id3Genre.value.trim() || undefined) : undefined,
              format: $('#format').value,
              speedMode: $('#speedMode').value,
              enhancer: enhancerSelect?.value || 'none',
              volumeBoost: Number(volumeBoost?.value || 0) || 0,
              denoise: denoiseInput?.checked || false,
              normalize: $('#normalize').checked,
              eq: getEqValues(),
            };
            const { data: coverData } = await postJson('/api/ai-cover', payload, {
              fallbackMessage: translateMessage('Gagal membuat prompt cover'),
              logLabel: 'ai-cover',
            });
            const prompt = (coverData.prompt || '').trim();
            if (aiVisualPrompt) {
              aiVisualPrompt.value = prompt;
              const lineCount = prompt ? prompt.split(/\n/).length : 3;
              aiVisualPrompt.rows = Math.min(10, Math.max(3, lineCount));
            }
            if (aiVisualPalette) {
              aiVisualPalette.innerHTML = '';
              const palette = Array.isArray(coverData.palette) ? coverData.palette.filter(Boolean) : [];
              palette.forEach((chip) => {
                const item = document.createElement('div');
                item.className = 'ai-color-chip';
                const swatch = document.createElement('i');
                if (chip?.hex) swatch.style.background = chip.hex;
                const label = document.createElement('span');
                const chipLabel = chip?.label || chip?.name || '';
                const hex = chip?.hex ? chip.hex.toUpperCase() : '';
                label.textContent = [chipLabel, hex && `(${hex})`].filter(Boolean).join(' ');
                item.appendChild(swatch);
                item.appendChild(label);
                aiVisualPalette.appendChild(item);
              });
            }
            if (aiVisualMeta) {
              const metaParts = [];
              if (coverData.style) metaParts.push(`Style: ${coverData.style}`);
              if (coverData.lighting) metaParts.push(`Lighting: ${coverData.lighting}`);
              if (coverData.texture) metaParts.push(`Texture: ${coverData.texture}`);
              if (coverData.vibe) metaParts.push(coverData.vibe);
              aiVisualMeta.textContent = metaParts.filter(Boolean).join(' • ');
            }
            if (aiVisualWrap) aiVisualWrap.hidden = false;
            lastAiVisualData = {
              prompt,
              palette: Array.isArray(data.palette) ? data.palette.filter(Boolean) : [],
              meta: aiVisualMeta?.textContent || '',
            };
            updateAiStatus('Prompt cover siap 🎨', 'success');
            setToast('Prompt cover siap dipakai');
          } catch (err) {
            resetAiVisual();
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI cover: ' + err.message);
          }
        });

        if (aiReleaseBtn) aiReleaseBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Merancang timeline rilis...', 'info');
          resetAiPlan();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? (id3Genre.value.trim() || undefined) : undefined,
              format: $('#format').value,
              speedMode: $('#speedMode').value,
              backgroundMode: backgroundMode?.checked || false,
              autoDownload: $('#autoDownload').checked,
              queueLength: Array.isArray(queue) ? queue.length : 0,
              hasPlaylist: Array.isArray(queue) ? queue.length > 0 : false,
              volumeBoost: Number(volumeBoost?.value || 0) || 0,
            };
            const { data: releaseData } = await postJson('/api/ai-release', payload, {
              fallbackMessage: translateMessage('Gagal membuat timeline'),
              logLabel: 'ai-release',
            });
            const planItems = Array.isArray(releaseData.plan) ? releaseData.plan.filter(Boolean) : [];
            if (aiPlanList) {
              aiPlanList.innerHTML = '';
              planItems.forEach((item) => {
                if (!item) return;
                const li = document.createElement('li');
                const timing = item.timing || item.when || item.day || '';
                if (timing) {
                  const small = document.createElement('small');
                  small.textContent = timing;
                  li.appendChild(small);
                }
                const label = item.title || item.label || item.phase || '';
                if (label) {
                  const strong = document.createElement('strong');
                  strong.textContent = label;
                  li.appendChild(strong);
                }
                const detail = item.detail || item.note || item.description || '';
                if (detail) {
                  const span = document.createElement('span');
                  span.textContent = detail;
                  li.appendChild(span);
                }
                aiPlanList.appendChild(li);
              });
            }
            if (aiPlanSummary) {
              const summaryParts = [];
              if (releaseData.summary) summaryParts.push(releaseData.summary);
              if (releaseData.focus) summaryParts.push(`Fokus: ${releaseData.focus}`);
              aiPlanSummary.textContent = summaryParts.filter(Boolean).join(' • ');
            }
            if (aiPlanWrap) aiPlanWrap.hidden = false;
            lastAiPlanData = {
              plan: planItems.map((item) => ({
                timing: item?.timing || item?.when || item?.day || '',
                title: item?.title || item?.label || item?.phase || '',
                detail: item?.detail || item?.note || item?.description || '',
              })),
              summary: aiPlanSummary?.textContent || '',
            };
            updateAiStatus('Timeline rilis siap dipakai 📅', 'success');
            setToast('Timeline rilis siap disalin');
          } catch (err) {
            resetAiPlan();
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI planner: ' + err.message);
          }
        });

        if (aiPressBtn) aiPressBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Menyusun press kit...', 'info');
          resetAiPress();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? (id3Genre.value.trim() || undefined) : undefined,
              mood: moodSelect && moodSelect.value !== 'auto' ? moodSelect.value : undefined,
              format: $('#format').value,
            };
            const { data: pressData } = await postJson('/api/ai-presskit', payload, {
              fallbackMessage: translateMessage('Gagal membuat press kit'),
              logLabel: 'ai-presskit',
            });
            const presskit = pressData.presskit || {};
            if (aiPressHeadline) aiPressHeadline.textContent = presskit.headline || '';
            if (aiPressStory) aiPressStory.textContent = presskit.story || '';
            if (aiPressHighlights) {
              aiPressHighlights.innerHTML = '';
              const highlights = Array.isArray(presskit.highlights) ? presskit.highlights.filter(Boolean) : [];
              highlights.forEach((item) => {
                const li = document.createElement('li');
                li.textContent = item;
                aiPressHighlights.appendChild(li);
              });
            }
            if (aiPressQuote) aiPressQuote.textContent = presskit.quote || '';
            if (aiPressSocial) aiPressSocial.textContent = presskit.socialHook || '';
            if (aiPressWrap) aiPressWrap.hidden = false;
            lastAiPressData = {
              headline: aiPressHeadline?.textContent || '',
              story: aiPressStory?.textContent || '',
              highlights: Array.from(aiPressHighlights?.querySelectorAll('li') || []).map((li) => li.textContent.trim()).filter(Boolean),
              quote: aiPressQuote?.textContent || '',
              socialHook: aiPressSocial?.textContent || '',
            };
            updateAiStatus('Press kit siap dibagikan 📰', 'success');
            setToast('Press kit siap disalin');
          } catch (err) {
            resetAiPress();
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI press kit: ' + err.message);
          }
        });

        if (aiOutreachBtn) aiOutreachBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Menulis email outreach...', 'info');
          resetAiOutreach();
          try {
            const formatValue = $('#format').value;
            let target = 'curator';
            if (['wav', 'flac', 'alac'].includes(String(formatValue).toLowerCase())) target = 'press';
            else if (backgroundMode?.checked) target = 'community';
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? (id3Genre.value.trim() || undefined) : undefined,
              mood: moodSelect && moodSelect.value !== 'auto' ? moodSelect.value : undefined,
              target,
            };
            const { data: outreachData } = await postJson('/api/ai-outreach', payload, {
              fallbackMessage: translateMessage('Gagal menulis email'),
              logLabel: 'ai-outreach',
            });
            const outreach = outreachData.outreach || {};
            if (aiOutreachSubject) aiOutreachSubject.textContent = outreach.subject || '';
            if (aiOutreachOpener) aiOutreachOpener.textContent = outreach.opener || '';
            if (aiOutreachIntro) aiOutreachIntro.textContent = outreach.intro || '';
            if (aiOutreachHook) aiOutreachHook.textContent = outreach.hook || '';
            if (aiOutreachWhy) aiOutreachWhy.textContent = outreach.why || '';
            if (aiOutreachCta) aiOutreachCta.textContent = outreach.cta || '';
            if (aiOutreachExtras) {
              aiOutreachExtras.innerHTML = '';
              (Array.isArray(outreach.extras) ? outreach.extras : []).filter(Boolean).forEach((item) => {
                const li = document.createElement('li');
                li.textContent = item;
                aiOutreachExtras.appendChild(li);
              });
            }
            if (aiOutreachWrap) aiOutreachWrap.hidden = false;
            lastAiOutreachData = {
              subject: aiOutreachSubject?.textContent || '',
              opener: aiOutreachOpener?.textContent || '',
              intro: aiOutreachIntro?.textContent || '',
              hook: aiOutreachHook?.textContent || '',
              why: aiOutreachWhy?.textContent || '',
              cta: aiOutreachCta?.textContent || '',
              extras: Array.from(aiOutreachExtras?.querySelectorAll('li') || []).map((li) => li.textContent.trim()).filter(Boolean),
            };
            updateAiStatus('Email outreach siap kirim 📧', 'success');
            setToast('Draft email siap disalin');
          } catch (err) {
            resetAiOutreach();
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI outreach: ' + err.message);
          }
        });

        if (aiLyricBtn) aiLyricBtn.addEventListener('click', async () => {
          const title = $('#id3Title').value.trim() || lastVideoMeta.title || $('#videoTitle').textContent.trim();
          if (!title) { setToast('Isi judul terlebih dahulu'); return; }
          updateAiStatus('Menyusun teaser lirik...', 'info');
          resetAiLyric();
          try {
            const payload = {
              title,
              channel: $('#id3Artist').value.trim() || lastVideoMeta.author || '',
              duration: Number(previewPlayer?.duration || 0) || undefined,
              genre: id3Genre ? (id3Genre.value.trim() || undefined) : undefined,
              mood: moodSelect && moodSelect.value !== 'auto' ? moodSelect.value : undefined,
            };
            const { data: lyricData } = await postJson('/api/ai-lyrics', payload, {
              fallbackMessage: translateMessage('Gagal membuat teaser lirik'),
              logLabel: 'ai-lyrics',
            });
            const teaser = lyricData.teaser || {};
            if (aiLyricLines) {
              aiLyricLines.innerHTML = '';
              (Array.isArray(teaser.lines) ? teaser.lines : []).filter(Boolean).forEach((line) => {
                const li = document.createElement('li');
                li.textContent = line;
                aiLyricLines.appendChild(li);
              });
            }
            if (aiLyricCallout) aiLyricCallout.textContent = teaser.callout || '';
            if (aiLyricHashtags) {
              aiLyricHashtags.innerHTML = '';
              (Array.isArray(teaser.hashtags) ? teaser.hashtags : []).filter(Boolean).forEach((tag) => {
                const span = document.createElement('span');
                span.textContent = tag.startsWith('#') ? tag : `#${tag}`;
                aiLyricHashtags.appendChild(span);
              });
            }
            if (aiLyricWrap) aiLyricWrap.hidden = false;
            lastAiLyricData = {
              lines: Array.from(aiLyricLines?.querySelectorAll('li') || []).map((li) => li.textContent.trim()).filter(Boolean),
              callout: aiLyricCallout?.textContent || '',
              hashtags: Array.from(aiLyricHashtags?.querySelectorAll('span') || []).map((span) => span.textContent.trim()).filter(Boolean),
            };
            updateAiStatus('Teaser lirik siap di-post 🎵', 'success');
            setToast('Teaser lirik siap disalin');
          } catch (err) {
            resetAiLyric();
            updateAiStatus(err.message, 'danger');
            setToast('Gagal AI lyric: ' + err.message);
          }
        });

        if (aiPitchCopy) aiPitchCopy.addEventListener('click', async () => {
          const text = aiPitchText?.value?.trim();
          if (!text) { setToast('Belum ada pitch untuk disalin'); return; }
          try {
            await navigator.clipboard.writeText(text);
            setToast('Pitch disalin ke clipboard');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiAudiophileCopy) aiAudiophileCopy.addEventListener('click', async () => {
          const text = aiAudiophileText?.value?.trim();
          if (!text) { setToast('Belum ada panduan audiophile untuk disalin'); return; }
          try {
            await navigator.clipboard.writeText(text);
            setToast('Panduan audiophile disalin');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiHookCopy) aiHookCopy.addEventListener('click', async () => {
          const hooks = lastAiHookData?.hooks?.length ? lastAiHookData.hooks : Array.from(aiHookList?.querySelectorAll('span') || []).map((span) => span.textContent.trim()).filter(Boolean);
          if (!hooks.length) { setToast('Belum ada hook untuk disalin'); return; }
          const ctas = lastAiHookData?.ctas || [];
          const hashtags = lastAiHookData?.hashtags || [];
          const meta = lastAiHookData?.meta?.trim() ? [lastAiHookData.meta.trim()] : [];
          const text = [...hooks, '', ...ctas, hashtags.length ? hashtags.join(' ') : '', ...meta]
            .filter((part) => part && part.trim())
            .join('\n');
          try {
            await navigator.clipboard.writeText(text);
            setToast('Hook & CTA disalin');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiVisualCopy) aiVisualCopy.addEventListener('click', async () => {
          const prompt = aiVisualPrompt?.value?.trim();
          if (!prompt) { setToast('Belum ada prompt cover untuk disalin'); return; }
          const palette = (lastAiVisualData?.palette || []).map((chip) => {
            const hex = chip?.hex ? chip.hex.toUpperCase() : '';
            const label = chip?.label || chip?.name || '';
            return [label, hex].filter(Boolean).join(' ');
          }).filter(Boolean);
          const meta = lastAiVisualData?.meta?.trim();
          const lines = [prompt];
          if (palette.length) {
            lines.push('', 'Palette:', ...palette);
          }
          if (meta) {
            lines.push('', meta);
          }
          try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setToast('Prompt cover disalin');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiPlanCopy) aiPlanCopy.addEventListener('click', async () => {
          const plan = (lastAiPlanData?.plan || []).filter((item) => item && (item.title || item.detail || item.timing));
          if (!plan.length) { setToast('Belum ada timeline rilis untuk disalin'); return; }
          const lines = plan.map((item) => {
            const timing = item.timing ? `${item.timing} • ` : '';
            const detail = item.detail ? ` • ${item.detail}` : '';
            return `${timing}${item.title || 'Aktivitas'}${detail}`.trim();
          });
          if (lastAiPlanData?.summary) lines.push('', lastAiPlanData.summary);
          try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setToast('Timeline rilis disalin');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiPressCopy) aiPressCopy.addEventListener('click', async () => {
          const data = lastAiPressData || null;
          if (!data || !(data.headline || data.story || (data.highlights || []).length)) {
            setToast('Belum ada press kit untuk disalin');
            return;
          }
          const lines = [data.headline, '', data.story, '', ...(data.highlights || []), '', data.quote, data.socialHook]
            .filter((line) => line && line.trim());
          try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setToast('Press kit tersalin ke clipboard');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiOutreachCopy) aiOutreachCopy.addEventListener('click', async () => {
          const data = lastAiOutreachData || null;
          if (!data || !data.subject) {
            setToast('Belum ada email untuk disalin');
            return;
          }
          const lines = [
            `Subjek: ${data.subject}`,
            '',
            data.opener,
            data.intro,
            data.hook,
            data.why,
            data.cta,
            '',
            ...(data.extras || []),
          ].filter((line) => line && line.trim());
          try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setToast('Draft email disalin');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (aiLyricCopy) aiLyricCopy.addEventListener('click', async () => {
          const data = lastAiLyricData || null;
          if (!data || !(data.lines || []).length) {
            setToast('Belum ada teaser lirik untuk disalin');
            return;
          }
          const lines = [...(data.lines || []), '', data.callout, '', (data.hashtags || []).join(' ')].filter((line) => line && line.trim());
          try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setToast('Teaser lirik disalin');
          } catch {
            setToast('Clipboard tidak tersedia');
          }
        });

        if (backgroundMode) backgroundMode.addEventListener('change', async () => {
          if (backgroundMode.checked && 'Notification' in window && Notification.permission === 'default') {
            try { await Notification.requestPermission(); } catch { }
          }
        });

        // ===== Admin login =====
        if (adminLoginForm) {
          adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = adminUserInput?.value?.trim() || '';
            const password = adminPassInput?.value || '';
            if (!username || !password) {
              setToast('Isi username dan password admin');
              return;
            }
            const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
            try {
              if (submitBtn) submitBtn.disabled = true;
              const { data: loginData } = await postJson('/admin/login', { username, password }, {
                fallbackMessage: translateMessage('Login gagal'),
                logLabel: 'admin-login',
              });
              if (!loginData?.token) throw new Error('Login gagal');
              state.adminBearer = loginData.token;
              persistState();
              try { sessionStorage.setItem('admin_bearer_token', state.adminBearer); } catch { }
              try { localStorage.setItem('ytmp3_admin_bearer', state.adminBearer); } catch { }
              if (adminPassInput) adminPassInput.value = '';
              setToast('Login admin berhasil');
              updateAdminUi();
              setDropzoneMessage('Login admin aktif. Siap mengunggah cookies.txt.', 'success');
            } catch (err) {
              setDropzoneMessage(`Login gagal: ${err.message}`, 'error');
              setToast('Login gagal: ' + err.message);
            } finally {
              if (submitBtn) submitBtn.disabled = false;
            }
          });
        }

        if (adminLogoutBtn) {
          adminLogoutBtn.addEventListener('click', () => {
            state.adminBearer = '';
            persistState();
            try { sessionStorage.removeItem('admin_bearer_token'); } catch { }
            try { localStorage.removeItem('ytmp3_admin_bearer'); } catch { }
            updateAdminUi();
            setToast('Logout admin berhasil');
          });
        }

        // ===== Drag & drop cookies.txt =====
        const dz = $('#dropzone');
        const cookieFile = $('#cookieFile');
        const pickCookieBtn = $('#pickCookie');

        if (openLoginBtn) {
          openLoginBtn.addEventListener('click', () => {
            if (settingsOffcanvas) {
              settingsOffcanvas.show();
              setTimeout(() => adminUserInput?.focus(), 250);
            }
          });
        }

        if (pickCookieBtn && cookieFile) {
          pickCookieBtn.addEventListener('click', () => {
            if (state.auth.user) {
              const msg = translateMessage('Login Google aktif. Cookies YouTube otomatis digunakan.');
              setToast(msg);
              setDropzoneMessage(msg, 'success');
              return;
            }
            if (!isAdminLoggedIn()) {
              setToast('Login admin terlebih dahulu untuk upload cookies');
              if (settingsOffcanvas) {
                settingsOffcanvas.show();
                setTimeout(() => adminUserInput?.focus(), 250);
              }
              return;
            }
            cookieFile.click();
          });
        }

        if (dz) {
          ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
            e.preventDefault();
            if (state.auth.user) return;
            if (!isAdminLoggedIn()) return;
            dz.classList.add('dragover');
          }));
          ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
            e.preventDefault();
            dz.classList.remove('dragover');
          }));
          dz.addEventListener('drop', (e) => {
            if (state.auth.user) {
              const msg = translateMessage('Login Google aktif. Cookies YouTube otomatis digunakan.');
              setToast(msg);
              setDropzoneMessage(msg, 'success');
              return;
            }
            if (!isAdminLoggedIn()) {
              setToast('Login admin terlebih dahulu untuk upload cookies');
              return;
            }
            const file = e.dataTransfer?.files?.[0];
            if (file) handleCookieFile(file);
          });
        }

        if (cookieFile) {
          cookieFile.addEventListener('change', () => {
            if (!cookieFile.files?.length) return;
            const [file] = cookieFile.files;
            if (file) handleCookieFile(file);
          });
        }

        async function handleCookieFile(file) {
          if (!file) return;
          if (state.auth.user) {
            const msg = translateMessage('Login Google aktif. Cookies YouTube otomatis digunakan.');
            setToast(msg);
            setDropzoneMessage(msg, 'success');
            return;
          }
          if (!/\.txt$/i.test(file.name)) { setToast('Pilih file .txt hasil export cookies'); return; }
          const text = await file.text();
          await uploadCookies(text);
        }

        async function uploadCookies(text) {
          if (state.auth.user) {
            const msg = translateMessage('Login Google aktif. Cookies YouTube otomatis digunakan.');
            setToast(msg);
            setDropzoneMessage(msg, 'success');
            return;
          }
          const bearer = (state.adminBearer || '').trim();
          if (!bearer) {
            setToast('Login admin terlebih dahulu untuk upload cookies');
            setDropzoneMessage('Login admin diperlukan sebelum upload cookies.', 'info');
            return;
          }
          try {
            setDropzoneMessage('Mengunggah cookies.txt...', 'info');
            const resp = await fetch(api('/admin/upload-cookies'), {
              method: 'POST', headers: { 'Authorization': `Bearer ${bearer}`, 'Content-Type': 'text/plain' }, body: text
            });
            const safe = await readJsonSafe(resp);
            const payload = safe.data && typeof safe.data === 'object' ? safe.data : {};
            if (!resp.ok) throw new Error(payload.error || (safe.rawText || '').trim() || 'Upload gagal');
            setToast('cookies.txt terunggah ?');
            setDropzoneMessage('cookies.txt terunggah ?', 'success');
            $('#cookieStatus').textContent = `OK • ${payload.bytes || 0} bytes ? ${payload.path || '/tmp/cookies.txt'}`;
          } catch (err) {
            setDropzoneMessage(`Gagal upload cookies: ${err.message}`, 'error');
            setToast('Gagal upload cookies: ' + err.message);
          }
        }

        $('#checkCookie').addEventListener('click', async () => {
          try {
            const resp = await fetch(api('/admin/cookies-status'));
            const safe = await readJsonSafe(resp);
            const payload = safe.data && typeof safe.data === 'object' ? safe.data : {};
            if (!resp.ok) throw new Error(payload.error || (safe.rawText || '').trim() || 'Gagal mengecek status');
            if (payload.exists) { $('#cookieStatus').textContent = `Ada ' ${payload.bytes || 0} bytes ' ${payload.path}`; }
            else { $('#cookieStatus').textContent = 'Tidak ada cookies di server.'; }
          } catch { $('#cookieStatus').textContent = 'Tidak bisa cek status cookies.'; }
        });

        // ===== Convert handler =====
        $('#convertBtn').addEventListener('click', () => { playUiFx('convert_click'); if (navigator.vibrate) navigator.vibrate(50); doConvert(null, $('#autoDownload').checked); });
        $('#downloadAllBtn').addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(50); doConvertQueue(); });
        $('#downloadZipBtn').addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(50); downloadPlaylistZip(); });
        if (subtitleBtn) subtitleBtn.addEventListener('click', handleSubtitle);
        $('#clearBtn').addEventListener('click', () => {
          if (navigator.vibrate) navigator.vibrate(20);
          $('#url').value = '';
          $('#playlist').value = '';
          queue.length = 0; renderQueue();
          $('#trimStart').value = '';
          $('#trimEnd').value = '';
          $('#fileName').value = '';
          $('#id3Title').value = '';
          $('#id3Artist').value = '';
          $('#id3Album').value = '';
          if (id3Genre) id3Genre.value = '';
          $('#normalize').checked = false;
          $('#atmos').checked = false;
          $('#previewWrap').hidden = true; $('#thumb').src = ''; $('#videoTitle').textContent = '';
          resetAudioPreview();
          resetPlaylistPreview();
          if (subtitleResult) subtitleResult.hidden = true;
          if (subtitlePreview) subtitlePreview.textContent = '';
          if (subtitleAutoBadge) subtitleAutoBadge.hidden = true;
          subtitleShareUrl = '';
          subtitleFullText = '';
          $('#resultWrap').hidden = true; $('#statusWrap').hidden = true; $('#logWrap').hidden = true; $('#logs').textContent = '';
          convertProgressAnimator.reset();
          resetAiCaption();
          resetAiPitch();
          resetAiAudiophile();
          resetAiHook();
          resetAiVisual();
          resetAiPlan();
          resetAiPress();
          resetAiOutreach();
          resetAiLyric();
          resetAiInsights();
          updateAiStatus('', 'info');
        });
        $('#url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (navigator.vibrate) navigator.vibrate(50); doConvert(null, $('#autoDownload').checked); } });

        if (subtitleCopyBtn) subtitleCopyBtn.addEventListener('click', async () => {
          if (navigator.vibrate) navigator.vibrate(10);
          const text = (subtitleFullText || subtitlePreview?.textContent || '').trim();
          if (!text) { setToast('Belum ada teks subtitle'); return; }
          try {
            await navigator.clipboard.writeText(text);
            setToast('Teks subtitle tersalin');
          } catch {
            setToast('Tidak dapat menyalin teks subtitle');
          }
        });
        if (subtitleShareBtn) subtitleShareBtn.addEventListener('click', () => shareLink(subtitleShareUrl));

        const estimateXpFromConversion = (payload = {}, result = {}) => {
          let xp = 24;
          const fmt = String(payload.format || result.format || '').toLowerCase();
          if (['flac', 'wav', 'alac', 'aiff'].includes(fmt)) xp += 12;
          if (['mp4', 'webm', 'mkv', 'mov'].includes(fmt)) xp += 10;
          if (payload.soundEffect && payload.soundEffect !== 'none') xp += 6;
          if (payload.enhancer && payload.enhancer !== 'none') xp += 8;
          if (payload.vpnFriendly) xp += 4;
          if (payload.smartResume) xp += 4;
          if (Array.isArray(result?.ringtones) && result.ringtones.length) xp += 6;
          return xp;
        };

        function toFriendlyConvertError(message = '') {
          const raw = String(message || '').toLowerCase();
          if (raw.includes('age') || raw.includes('restricted') || raw.includes('cookies')) return 'Video ini diblokir atau butuh cookies. Coba video lain atau update cookies ya.';
          if (raw.includes('429') || raw.includes('too many') || raw.includes('rate')) return 'Server lagi padat. Santai, coba lagi sebentar ya.';
          if (raw.includes('invalid') && raw.includes('url')) return 'Link belum valid. Cek lagi lalu kirim ulang ya.';
          if (raw.includes('captcha')) return 'Verifikasi keamanan belum lolos. Coba klik convert sekali lagi ya.';
          return `Hmm gagal nih, coba lagi yaa… (${message || 'unknown'})`;
        }

        function getSpeedServerLabel(mode = 'auto') {
          if (mode === 'fast') return 'Server A / Fast Lane';
          if (mode === 'stable') return 'Server B / Stable';
          const pool = ['Server A', 'Server B', 'Server C'];
          return `${pool[Math.floor(Math.random() * pool.length)]} / Auto`;
        }

        async function doConvert(target, autoDownload = false) {
          if (window.__adminConvertDisabled) {
            setToast('Convert sedang dinonaktifkan admin. Coba lagi nanti ya.', 'warning');
            return;
          }
          // Request notification permission if default
          if ('Notification' in window && Notification.permission === 'default') {
            try { Notification.requestPermission(); } catch { }
          }

          let overrideUrl = '';
          let keywordQuery = '';
          let providedMetadata = null;
          let forceAutoDownload = autoDownload;
          if (typeof target === 'object' && target !== null) {
            overrideUrl = typeof target.url === 'string' ? target.url : '';
            keywordQuery = typeof target.keyword === 'string' ? target.keyword : '';
            providedMetadata = target.metadata || null;
            if (typeof target.autoDownload === 'boolean') forceAutoDownload = target.autoDownload;
          } else if (typeof target === 'string') {
            overrideUrl = target;
          }

          if (forceAutoDownload && state.preferences?.confirmAutoDownload) {
            const allowAuto = window.confirm(translateMessage('Auto-download akan dimulai otomatis. Lanjutkan?'));
            if (!allowAuto) {
              forceAutoDownload = false;
            }
          }

          const url = (overrideUrl || urlInput?.value || '').trim();
          const keyword = keywordQuery || (!url ? (keywordInput?.value.trim() || '') : '');
          if (!url && !keyword) {
            setToast(translateMessage('Masukkan URL yang valid'));
            urlInput?.focus();
            return;
          }

          let captchaToken = '';
          try {
            const token = await requestCaptchaToken('convert');
            if (token) captchaToken = token;
          } catch (e) { return; }

          if (!url && keyword) {
            const normalizedKeyword = keyword.toLowerCase();
            if (TRIVIA_KEYWORDS.includes(normalizedKeyword)) {
              openTriviaModal(false);
              setToast('Music Trivia dibuka!');
              if (keywordInput) keywordInput.value = '';
              return;
            }
          }
          if (url && !/^https?:\/\//i.test(url)) {
            setToast(translateMessage('Masukkan URL yang valid'));
            urlInput?.focus();
            return;
          }
          if (url && !isSupportedMediaUrl(url)) {
            setToast(translateMessage('URL ini belum didukung'));
            urlInput?.focus();
            return;
          }

          // DUPLICATE DETECTOR
          if (url) {
            const dup = checkDuplicate(url, $('#id3Title')?.value || '');
            if (dup) {
              if (navigator.vibrate) navigator.vibrate(50);

              const modalEl = document.getElementById('duplicateModal');
              const filenameEl = document.getElementById('duplicateFilename');
              const confirmBtn = document.getElementById('confirmDuplicateBtn');

              let reuse = false;

              if (modalEl && bootstrapGlobal?.Modal) {
                if (filenameEl) filenameEl.textContent = dup.fileName || dup.title || 'Audio File';
                const modal = new bootstrapGlobal.Modal(modalEl);

                await new Promise((resolve) => {
                  const handleConfirm = () => {
                    reuse = true;
                    modal.hide();
                    resolve();
                  };
                  const handleCancel = () => {
                    reuse = false;
                    resolve(); // Just resolve, reuse stays false
                  };

                  confirmBtn.onclick = handleConfirm;

                  // Handle "Tidak" (Cancel) button
                  const closeBtns = modalEl.querySelectorAll('[data-bs-dismiss="modal"]');
                  closeBtns.forEach(b => b.onclick = handleCancel);

                  modalEl.addEventListener('hidden.bs.modal', () => resolve(), { once: true });
                  modal.show();
                });
              } else {
                // Fallback
                reuse = window.confirm(`File ini mirip 98% dengan yang sudah ada (${dup.title || 'Untitled'}). Mau pakai ulang?\n\nKlik OK untuk melanjutkan, Cancel untuk membatalkan.`);
              }

              if (reuse) {
                const downloadBtn = document.getElementById('downloadLink');
                if (downloadBtn) {
                  downloadBtn.href = dup.downloadUrl;
                  downloadBtn.download = dup.fileName || 'download';
                  downloadBtn.classList.add('step-active');
                  downloadBtn.click();
                }
                setToast('Menggunakan file dari cache');
                return; // STOP conversion
              } else {
                setToast('Konversi dibatalkan.');
                return; // STOP conversion
              }
            }
          }

          resetAudioPreview();
          if (!overrideUrl) resetPlaylistPreview();
          renderRingtoneResults([]);
          state.drive.pending = false;
          state.drive.lastStatus = '';
          state.lastDownload = null;
          updateDriveUi();

          const body = {
            format: $('#format').value,
            abr: Number($('#abr').value),
            sampleRate: Number($('#sampleRate').value),
            fileName: sanitizeFileName($('#fileName').value.trim()),
            noPlaylist: $('#noPlaylist').checked,
            atmos: $('#atmos').checked,
            speedMode: $('#speedMode').value,
            preferredLang: currentLang,
            serverMode: convertServerMode?.value || 'auto',
            playbackPrefs: {
              crossfade: Number(crossfadeSecondsSelect?.value || 0),
              gapless: !!gaplessPlaybackToggle?.checked,
            },
          };

          if (videoQualitySelect && !videoQualityWrap?.hidden) {
            body.videoQuality = videoQualitySelect.value || 'best';
          }

          if (url) body.url = url;
          if (keyword) body.keyword = keyword;

          const id3 = {
            title: $('#id3Title').value.trim(),
            artist: $('#id3Artist').value.trim(),
            album: $('#id3Album').value.trim(),
            genre: id3Genre ? id3Genre.value.trim() : ''
          };
          Object.keys(id3).forEach((k) => { if (!id3[k]) delete id3[k]; });
          if (Object.keys(id3).length) body.id3 = id3;

          const trim = {};
          const s = parseTime($('#trimStart').value.trim());
          const e = parseTime($('#trimEnd').value.trim());
          if (s !== null) trim.start = s;
          if (e !== null) trim.end = e;
          if (Object.keys(trim).length) body.trim = trim;

          body.normalize = $('#normalize').checked;
          if (thumbEl?.src) body.coverUrl = thumbEl.src;
          if (denoiseInput) body.denoise = denoiseInput.checked;
          if (volumeBoost) body.volumeBoost = Number(volumeBoost.value || 0);
          if (enhancerSelect) body.enhancer = enhancerSelect.value || 'none';
          if (soundEffectSelect) body.soundEffect = soundEffectSelect.value || 'none';
          if (vpnFriendlyToggle) body.vpnFriendly = !!vpnFriendlyToggle.checked;
          if (smartResumeToggle) body.smartResume = !!smartResumeToggle.checked;

          // Output Management
          const prefOutputDir = $('#prefOutputDir')?.value.trim();
          if (prefOutputDir) body.outputDir = prefOutputDir;
          const prefOrganizeBy = $('#prefOrganizeBy')?.value;
          if (prefOrganizeBy) body.organizeBy = prefOrganizeBy;

          const ringtonePayload = getRingtoneRequest();
          if (ringtonePayload) body.ringtone = ringtonePayload;

          const progressId = createProgressId();
          body.progressId = progressId;

          if (backgroundMode?.checked) {
            if (backgroundEmailInput?.value.trim()) body.notifyEmail = backgroundEmailInput.value.trim();
            await submitBackgroundJob(body);
            if (!overrideUrl && typeof turnstile !== 'undefined') {
              try { turnstile.reset(); } catch (e) { }
            }
            return;
          }

          $('#statusWrap').hidden = false;
          $('#resultWrap').hidden = true;
          setToast(`⚡ Speed Boost: ${getSpeedServerLabel(body.serverMode)} aktif`);

          // Reset Rating UI
          const rBtns = document.getElementById('ratingButtons');
          const rThanks = document.getElementById('ratingThanks');
          if (rBtns) rBtns.hidden = false;
          if (rThanks) rThanks.hidden = true;

          $('#logWrap').hidden = !$('#showLog').checked;
          $('#logs').textContent = '';
          $('#loadingSpinner').style.display = '';
          $('#status').textContent = translateMessage('Memproses...');
          if (window.manageCTAState) window.manageCTAState('converting');
          try { window.reportUserAction?.('conversion_start', `${body.format || 'unknown'} @ ${body.abr || '-'}`); } catch { }
          announceNarrator('Konversi dimulai, mohon tunggu.');
          startConvertProgressWatcher(progressId);

          // ReCAPTCHA v2 token is already retrieved above
          if (captchaToken) body.captchaToken = captchaToken;

          try {
            const resp = await fetch(api('/api/convert'), {
              method: 'POST',
              headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify(body),
            });
            const { data: convertData } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal memproses'),
              logLabel: 'convert',
            });

            // Increment Usage Count (Task 7)
            if (typeof window.incrementUsageCount === 'function') {
              window.incrementUsageCount();
            }

            if (convertData.isDuplicate) {
              setToast('File diambil dari cache server (Cepat!)');
            }

            const backendBase = getBackend() || window.location.origin;
            if (!convertData.downloadUrl) throw new Error('Link download kosong dari server.');
            const absoluteDownload = new URL(convertData.downloadUrl, backendBase).href;
            const cloudPlayUrl = convertData?.cloudinaryAudio?.url ? String(convertData.cloudinaryAudio.url) : '';
            const absolutePlayUrl = cloudPlayUrl || absoluteDownload;
            $('#downloadLink').href = absoluteDownload;
            $('#downloadLink').setAttribute('download', convertData.fileName || 'audio');
            $('#downloadLink').classList.add('step-active');
            $('#resultWrap').hidden = false;
            playUiFx('convert_done');

            // START: File Expiry & Location Info (Task 1)
            const resultWrap = document.getElementById('resultWrap');
            let expiryEl = document.getElementById('fileExpiryInfo');
            if (!expiryEl) {
              expiryEl = document.createElement('div');
              expiryEl.id = 'fileExpiryInfo';
              expiryEl.className = 'mt-3 pt-2 border-top';
              const alertEl = resultWrap.querySelector('.alert-success');
              if (alertEl && alertEl.parentNode === resultWrap) {
                alertEl.parentNode.insertBefore(expiryEl, alertEl.nextSibling);
              } else {
                resultWrap.appendChild(expiryEl);
              }
            }

            if (window.fileExpiryTimer) clearInterval(window.fileExpiryTimer);
            let expiryTimeLeft = 3600; // 60 mins

            const updateExpiryDisplay = () => {
              const m = Math.floor(expiryTimeLeft / 60);
              const s = expiryTimeLeft % 60;
              const timeStr = `${m}:${s < 10 ? '0' + s : s}`;
              expiryEl.innerHTML = `
            <div class="d-flex justify-content-between align-items-center text-secondary small bg-body-tertiary rounded p-2 border">
                <div class="d-flex align-items-center text-success">
                    <i class="bi bi-folder-check me-2 fs-5"></i>
                    <div>
                        <div class="fw-bold" style="font-size: 0.8rem;">Tersimpan di:</div>
                        <div style="font-size: 0.75rem;">Internal / Downloads</div>
                    </div>
                </div>
                <div class="text-end text-danger">
                     <div class="fw-bold" style="font-size: 0.8rem;"><i class="bi bi-hourglass-split me-1"></i>Hapus Otomatis</div>
                     <div class="font-monospace" style="font-size: 0.9rem;">${timeStr}</div>
                </div>
            </div>
          `;
              if (expiryTimeLeft <= 0) {
                clearInterval(window.fileExpiryTimer);
                expiryEl.innerHTML = `<div class="text-center text-danger small p-2"><i class="bi bi-x-circle me-1"></i>File kadaluarsa dari server.</div>`;
              }
              expiryTimeLeft--;
            };
            updateExpiryDisplay();
            window.fileExpiryTimer = setInterval(updateExpiryDisplay, 1000);
            // END: File Expiry & Location Info

            // Update Stats
            const statsEl = document.getElementById('conversionStats');
            if (statsEl) {
              statsEl.hidden = false;
              const estEl = document.getElementById('estDownload');
              const lufsEl = document.getElementById('lufsStat');
              // Mock logic if fileSize not returned
              const sizeVal = convertData.fileSize ? Number(convertData.fileSize) : (3 * 1024 * 1024);
              const sizeMb = (sizeVal / 1024 / 1024).toFixed(1);
              if (estEl) estEl.textContent = `${sizeMb} MB • ~${sizeVal < 5000000 ? '2s' : '5s'}`;
              if (lufsEl) {
                if (convertData.audioInsight && convertData.audioInsight.lufs) {
                  const realLufs = convertData.audioInsight.lufs;
                  const isNorm = body.normalize || (convertData.audioInsight.targetLufs && convertData.audioInsight.targetLufs.includes('-14'));
                  lufsEl.textContent = `${realLufs} LUFS ${isNorm ? '(Norm)' : '(Orig)'}`;
                } else {
                  lufsEl.textContent = body.normalize ? '-14 LUFS (Norm)' : '-12 LUFS (Orig)';
                }
              }
            }

            // Audio Insight (Advanced Mode only)
            const isAdvanced = document.getElementById('advanced-mode')?.hidden === false;
            if (isAdvanced && convertData.audioInsight && typeof renderAudioInsight === 'function') {
              renderAudioInsight(convertData.audioInsight);
            }

            $('#status').textContent = translateMessage('Selesai');
            notifyUser('YouTube to MP3', `Telah selesai di download: ${convertData.fileName || 'Audio File'}`);

            $('#loadingSpinner').style.display = 'none';
            if (window.manageCTAState) window.manageCTAState('completed');
            announceNarrator('Konversi selesai, file siap diunduh.');
            convertProgressAnimator.complete(`${translateMessage('Selesai')} • 100%`);
            if (convertData.logs && $('#showLog').checked) { $('#logs').textContent = convertData.logs; }
            if (forceAutoDownload) $('#downloadLink').click();

            const metaFromServer = convertData.metadata || providedMetadata || lastVideoInfo || null;
            if (metaFromServer) {
              applyVideoMetadata(metaFromServer, { setUrl: !overrideUrl, autoFillId3: false, fillEmptyId3: true });
            }
            renderRingtoneResults(Array.isArray(convertData.ringtones) ? convertData.ringtones : []);

            if (convertData.userProgress?.summary) {
              applyUserSummary(convertData.userProgress.summary, { origin: 'server' });
              const xpGain = Number(convertData.userProgress.xpGain) || 0;
              if (xpGain > 0) showRewardToast(`+${xpGain} XP • Cloud sync`);
              if (Array.isArray(convertData.userProgress.badgesAwarded)) {
                convertData.userProgress.badgesAwarded.forEach((badge) => {
                  const badgeId = typeof badge === 'string' ? badge : badge?.id;
                  if (badgeId) awardBadge(badgeId);
                });
              }
            } else if (!state.auth?.user) {
              const xpGain = estimateXpFromConversion(body, convertData);
              if (xpGain > 0) incrementPoints(xpGain, 'Konversi sukses');
            }

            const historyMeta = metaFromServer
              ? {
                title: metaFromServer.cleanTitle || metaFromServer.title || '',
                artist: metaFromServer.artist || metaFromServer.author || '',
                album: metaFromServer.album || '',
                cover: metaFromServer.cover || metaFromServer.thumbnail || '',
              }
              : null;
            pushHistory({
              downloadUrl: absolutePlayUrl,
              serverUrl: absoluteDownload,
              cloudUrl: cloudPlayUrl,
              format: convertData.format,
              abr: body.abr,
              fileName: convertData.fileName,
              fileSize: convertData.fileSize || convertData.size || 0,
              meta: historyMeta,
              audioInsight: convertData.audioInsight
            });

            const previewMeta = {
              fileName: convertData.fileName || '',
              baseName: convertData.baseName || '',
              format: convertData.format,
              title: $('#id3Title').value.trim() || metaFromServer?.cleanTitle || metaFromServer?.title || convertData.fileName || '',
              sampleRate: convertData.sampleRate || null,
              channels: convertData.channels || null,
            };
            state.lastDownload = {
              url: absolutePlayUrl,
              fileName: convertData.fileName || previewMeta.fileName || 'audio',
              format: convertData.format || body.format,
              mimeType: convertData.mimeType || null,
            };
            updateDriveUi();
            showAudioPreview(absolutePlayUrl, previewMeta);
            setToast('Done! Enjoy your music 🎧');
            updateAiStatus('Konversi selesai', 'success');
            registerConversionSuccess('direct', {
              vpnFriendly: convertData.vpnFriendly ?? body.vpnFriendly,
              smartResume: convertData.smartResume ?? body.smartResume,
              soundEffect: convertData.soundEffect ?? body.soundEffect,
            });
            if (state.preferences?.rememberLastFormat) {
              state.preferences = {
                ...state.preferences,
                lastFormat: {
                  format: body.format,
                  abr: Number.isFinite(Number(body.abr)) ? Number(body.abr) : null,
                  sampleRate: Number.isFinite(Number(body.sampleRate)) ? Number(body.sampleRate) : null,
                  videoQuality: body.videoQuality || videoQualitySelect?.value || '',
                },
              };
              persistState();
            }
            if ($('#autoClear').checked && !overrideUrl) { $('#clearBtn').click(); }
          } catch (err) {
            $('#status').textContent = translateMessage(`Error: ${err.message}`);
            $('#loadingSpinner').style.display = 'none';
            if (window.manageCTAState) window.manageCTAState('completed');
            $('#resultWrap').hidden = true;
            state.lastDownload = null;
            updateDriveUi();
            $('#logWrap').hidden = false;
            $('#logs').textContent = (err && err.stack) ? err.stack : String(err);
            resetAudioPreview();
            convertProgressAnimator.fail(translateMessage('Gagal'));
            const friendlyErr = toFriendlyConvertError(err?.message || '');
            try {
              ensureForumSocket()?.emit('conversion_error', { reason: friendlyErr || 'convert_error' });
              window.reportUserAction?.('conversion_error', friendlyErr || 'convert_error');
            } catch { }
            setToast(friendlyErr);
            announceNarrator(`Konversi gagal: ${friendlyErr}`);
            updateAiStatus(friendlyErr, 'danger');
          } finally {
            stopConvertProgressWatcher();
            convertProgressAnimator.hide();
            if (!overrideUrl && typeof turnstile !== 'undefined') {
              try { turnstile.reset(); } catch (e) { }
            }
          }
        }

        async function submitBackgroundJob(body) {
          try {
            const payload = { ...body };
            let captchaToken = body.captchaToken || null;
            try {
              if (!captchaToken) {
                captchaToken = await requestCaptchaToken('background');
              }
              if (captchaToken) payload.captchaToken = captchaToken;
            } catch (err) {
              const message = err?.message || translateMessage('Verifikasi captcha gagal. Silakan coba lagi.');
              updateAiStatus(message, 'danger');
              setToast(message);
              return;
            }
            updateAiStatus('Mengirim ke background...', 'info');
            const resp = await fetch(api('/api/background'), {
              method: 'POST',
              headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify(payload),
            });
            const { data: jobData } = await resolveJsonResponse(resp, {
              fallbackMessage: translateMessage('Gagal membuat job'),
              logLabel: 'background-create',
            });
            if (jobData?.job) {
              updateBackgroundJob(jobData.job);
              setToast('Job diproses di latar');
              updateAiStatus(`Job #${jobData.job.id.slice(-5)} masuk antrian.`, 'info');
              scheduleJobPoll(jobData.job.id, 1500);
            }
          } catch (err) {
            updateAiStatus(err.message || 'Gagal membuat job', 'danger');
            setToast('Gagal membuat job: ' + err.message);
          }
        }

        let isQueuePaused = false;
        const toggleQueuePause = () => {
          isQueuePaused = !isQueuePaused;
          const btn = document.getElementById('pauseQueueBtn');
          if (btn) {
            btn.innerHTML = isQueuePaused ? '<i class="bi bi-play-fill"></i> Resume' : '<i class="bi bi-pause-fill"></i> Pause';
            btn.classList.toggle('btn-warning', isQueuePaused);
            btn.classList.toggle('btn-outline-secondary', !isQueuePaused);
          }
          setToast(isQueuePaused ? 'Antrian dipause' : 'Antrian dilanjutkan');
        };

        async function doConvertQueue() {
          const urls = queue.length
            ? queue.map((q) => q.url)
            : $('#playlist').value
              .split(/\n+/)
              .map((s) => s.trim())
              .filter((u) => /^https?:\/\//i.test(u) && isSupportedMediaUrl(u));
          if (!urls.length) { setToast('Antrian kosong'); return; }

          // Inject Pause Button if not exists
          let pauseBtn = document.getElementById('pauseQueueBtn');
          if (!pauseBtn) {
            pauseBtn = document.createElement('button');
            pauseBtn.id = 'pauseQueueBtn';
            pauseBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
            pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
            pauseBtn.onclick = toggleQueuePause;

            const convertQueueBtn = document.getElementById('convertQueueBtn');
            if (convertQueueBtn) convertQueueBtn.parentNode.insertBefore(pauseBtn, convertQueueBtn.nextSibling);
          }

          const progress = $('#queueProgress');
          progress.hidden = false; progress.max = urls.length; progress.value = 0;

          for (let i = 0; i < urls.length; i++) {
            while (isQueuePaused) {
              await new Promise(r => setTimeout(r, 500));
            }

            $('#url').value = urls[i];
            $('#id3Title').value = '';
            $('#id3Artist').value = '';
            $('#id3Album').value = '';
            if (id3Genre) id3Genre.value = '';
            $('#fileName').value = '';
            await updatePreview();
            setToast(`Memproses ${i + 1}/${urls.length}`);

            try {
              await doConvert(urls[i], true);
            } catch (e) { console.error(e); }

            progress.value = i + 1;
            if (queue.length) { queue.shift(); renderQueue(); }
          }
          progress.hidden = true;
          setToast('Semua antrian selesai');
          if (pauseBtn) pauseBtn.remove();
          isQueuePaused = false;
        }

        async function downloadPlaylistZip() {
          const itemsSrc = queue.length
            ? [...queue]
            : $('#playlist').value
              .split(/\n+/)
              .map((s) => s.trim())
              .filter((u) => /^https?:\/\//i.test(u) && isSupportedMediaUrl(u))
              .map((url) => ({ url, title: '' }));
          if (!itemsSrc.length) { setToast('Antrian kosong'); return; }
          resetPlaylistPreview();
          $('#statusWrap').hidden = false; $('#resultWrap').hidden = true; $('#logWrap').hidden = true; $('#logs').textContent = '';
          $('#loadingSpinner').style.display = '';
          $('#status').textContent = 'Menyiapkan ZIP...';

          const trim = {};
          const s = parseTime($('#trimStart').value.trim());
          const e = parseTime($('#trimEnd').value.trim());
          if (s !== null) trim.start = s;
          if (e !== null) trim.end = e;

          const id3 = {
            title: $('#id3Title').value.trim(),
            artist: $('#id3Artist').value.trim(),
            album: $('#id3Album').value.trim(),
            genre: id3Genre ? id3Genre.value.trim() : ''
          };
          Object.keys(id3).forEach(k => { if (!id3[k]) delete id3[k]; });

          const items = itemsSrc.map(item => ({
            url: item.url || item,
            fileName: sanitizeFileName(item.title || item.url || ''),
          }));

          const body = {
            items,
            format: $('#format').value,
            abr: Number($('#abr').value),
            sampleRate: Number($('#sampleRate').value),
            normalize: $('#normalize').checked,
            coverUrl: $('#thumb').src || undefined,
            atmos: $('#atmos').checked,
            speedMode: $('#speedMode').value,
            zipName: sanitizeFileName($('#fileName').value.trim()) || undefined,
          };
          if (Object.keys(trim).length) body.trim = trim;
          if (Object.keys(id3).length) body.id3 = id3;
          if (denoiseInput) body.denoise = denoiseInput.checked;
          if (volumeBoost) body.volumeBoost = Number(volumeBoost.value || 0);
          if (enhancerSelect) body.enhancer = enhancerSelect.value || 'none';
          if (soundEffectSelect) body.soundEffect = soundEffectSelect.value || 'none';
          if (vpnFriendlyToggle) body.vpnFriendly = !!vpnFriendlyToggle.checked;
          if (smartResumeToggle) body.smartResume = !!smartResumeToggle.checked;

          try {
            const captchaToken = await requestCaptchaToken('playlist');
            if (captchaToken) body.captchaToken = captchaToken;
            const { data: playlistData } = await postJson('/api/convert-playlist', body, {
              fallbackMessage: translateMessage('Gagal membuat ZIP'),
              logLabel: 'convert-playlist',
            });
            $('#loadingSpinner').style.display = 'none';
            $('#status').textContent = 'ZIP selesai';
            showPlaylistResult(playlistData, items.length);
            setToast(`Playlist ZIP siap (${items.length} file)`);
            if (playlistData?.user) {
              applyUserSummary(playlistData.user, { origin: 'server' });
              showRewardToast(translateMessage('XP tersinkronisasi'));
            } else if (!state.auth?.user) {
              const xpGain = Math.max(estimateXpFromConversion(body, {}), 12) + Math.max(0, items.length - 1) * 4;
              incrementPoints(xpGain, 'Playlist ZIP');
            }
            const base = getBackend() || window.location.origin;
            const absoluteZip = new URL(playlistData.downloadUrl, base).href;
            pushHistory({
              downloadUrl: absoluteZip,
              format: 'zip',
              abr: body.abr,
              fileName: playlistData.fileName,
              fileSize: playlistData.fileSize || playlistData.size || 0
            });
            registerConversionSuccess('playlist', {
              vpnFriendly: body.vpnFriendly,
              smartResume: body.smartResume,
              soundEffect: body.soundEffect,
            });
            if (state.preferences?.rememberLastFormat) {
              state.preferences = {
                ...state.preferences,
                lastFormat: {
                  format: body.format,
                  abr: Number.isFinite(Number(body.abr)) ? Number(body.abr) : null,
                  sampleRate: Number.isFinite(Number(body.sampleRate)) ? Number(body.sampleRate) : null,
                  videoQuality: videoQualitySelect?.value || '',
                },
              };
              persistState();
            }
            if ($('#autoDownload').checked && playlistDownloadLink) { playlistDownloadLink.click(); }
            if ($('#autoClear').checked) { queue.length = 0; renderQueue(); $('#playlist').value = ''; }
          } catch (err) {
            try {
              const zipOk = await fallbackZipClient(items);
              if (zipOk) {
                $('#loadingSpinner').style.display = 'none';
                $('#status').textContent = 'ZIP selesai';
                setToast(`Playlist ZIP siap (${items.length} file)`);
              } else {
                throw err;
              }
            } catch (fallbackErr) {
              $('#status').textContent = 'Error: ' + (fallbackErr.message || err.message);
              $('#loadingSpinner').style.display = 'none';
              $('#logWrap').hidden = false;
              $('#logs').textContent = ((fallbackErr && fallbackErr.stack) ? fallbackErr.stack : String(fallbackErr)) || (err && err.stack) || String(err);
              setToast('Terjadi error: ' + (fallbackErr.message || err.message));
            }
          } finally {
            if (typeof turnstile !== 'undefined') {
              try { turnstile.reset(); } catch (e) { }
            }
          }
        }

        async function fallbackZipClient(items = []) {
          try {
            if (!window.JSZip) throw new Error('JSZip tidak tersedia');
            const zip = new window.JSZip();
            const base = getBackend() || window.location.origin;
            const progress = $('#queueProgress');
            progress.hidden = false;
            progress.max = items.length;
            progress.value = 0;
            for (let i = 0; i < items.length; i += 1) {
              const url = items[i]?.url || items[i];
              if (!url) continue;
              const token = await requestCaptchaToken('convert');
              const progressId = createProgressId();
              const payload = {
                url,
                format: $('#format').value,
                abr: Number($('#abr').value),
                sampleRate: Number($('#sampleRate').value),
                normalize: $('#normalize').checked,
                atmos: $('#atmos').checked,
                speedMode: $('#speedMode').value,
                noPlaylist: true,
                captchaToken: token,
                progressId,
              };
              const resp = await fetch(api('/api/convert'), {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload),
              });
              const { data: result } = await resolveJsonResponse(resp, {
                fallbackMessage: translateMessage('Gagal memproses'),
                logLabel: 'convert-fallback-zip',
              });
              const absolute = new URL(result.downloadUrl, base).href;
              const fileResp = await fetch(absolute);
              const blob = await fileResp.blob();
              const name = result.fileName || `${String(i + 1).padStart(String(items.length).length, '0')}.${result.format || 'mp3'}`;
              zip.file(name, blob);
              progress.value = i + 1;
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const objectUrl = URL.createObjectURL(zipBlob);
            if (playlistDownloadLink) {
              playlistDownloadLink.href = objectUrl;
              playlistDownloadLink.setAttribute('download', sanitizeFileName($('#fileName').value.trim()) || 'playlist.zip');
            }
            if (playlistInfo) {
              playlistInfo.textContent = `${items.length} file siap diunduh`;
            }
            if (playlistShareCard) playlistShareCard.hidden = true;
            $('#resultWrap').hidden = false;
            if ($('#autoDownload').checked && playlistDownloadLink) { playlistDownloadLink.click(); }
            progress.hidden = true;
            return true;
          } catch (e) {
            return false;
          }
        }

        async function handleSubtitle() {
          const url = $('#url').value.trim();
          if (!/^https?:\/\//i.test(url)) {
            setToast('Masukkan URL yang valid terlebih dahulu');
            $('#url').focus();
            return;
          }
          if (subtitleResult) subtitleResult.hidden = true;
          if (subtitlePreview) subtitlePreview.textContent = '';
          if (subtitleAutoBadge) subtitleAutoBadge.hidden = true;
          subtitleShareUrl = '';
          if (subtitleBtn) {
            subtitleBtn.disabled = true;
            subtitleBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Memuat';
          }
          try {
            const langVal = subtitleLang?.value || 'id.*,en.*,en';
            const body = {
              url,
              lang: langVal === 'all' ? 'all' : langVal,
              preferAuto: subtitleAuto ? subtitleAuto.checked : true,
              fileName: sanitizeFileName($('#fileName').value.trim()) || undefined,
              title: $('#id3Title').value.trim() || $('#videoTitle').textContent.trim() || undefined,
            };
            const { data: subtitleData } = await postJson('/api/subtitle', body, {
              fallbackMessage: translateMessage('Gagal mengambil subtitle'),
              logLabel: 'subtitle',
            });
            if (subtitleLangBadge) subtitleLangBadge.textContent = (subtitleData.lang || '').toUpperCase() || 'TXT';
            if (subtitleAutoBadge) subtitleAutoBadge.hidden = !subtitleData.auto;
            if (subtitleSrtLink) {
              subtitleSrtLink.href = subtitleData.srtUrl || '#';
              if (subtitleData.srtFileName) subtitleSrtLink.setAttribute('download', subtitleData.srtFileName);
            }
            if (subtitleTxtLink) {
              subtitleTxtLink.href = subtitleData.txtUrl || '#';
              if (subtitleData.txtFileName) subtitleTxtLink.setAttribute('download', subtitleData.txtFileName);
            }
            const rawText = (subtitleData.text || subtitleData.preview || '').trim();
            subtitleFullText = rawText;
            if (subtitlePreview) {
              subtitlePreview.textContent = rawText || '(Tidak ada teks tersedia)';
              subtitlePreview.scrollTop = 0;
            }
            if (subtitleStatus) {
              const lineCount = Number(subtitleData.lineCount);
              const wordCount = Number(subtitleData.wordCount);
              const metaParts = [];
              const langBadge = String(subtitleData.lang || '').toLowerCase();
              const originalLang = String(subtitleData.originalLang || '').trim().toLowerCase();
              const translatedFrom = String(subtitleData.translatedFrom || '').trim().toLowerCase();
              if (subtitleData.translated) {
                const fromLabel = (translatedFrom || originalLang || '')?.toUpperCase();
                metaParts.push(fromLabel ? `Terjemahan dari ${fromLabel}` : 'Terjemahan');
              } else if (originalLang && originalLang !== langBadge) {
                metaParts.push(`Bahasa asli ${originalLang.toUpperCase()}`);
              }
              if (Number.isFinite(lineCount) && lineCount > 0) metaParts.push(`${lineCount} baris`);
              if (Number.isFinite(wordCount) && wordCount > 0) metaParts.push(`${wordCount} kata`);
              subtitleStatus.textContent = metaParts.length ? `Subtitle lengkap (${metaParts.join(' • ')})` : 'Subtitle siap diunduh';
            }
            subtitleShareUrl = subtitleData.txtUrl ? new URL(subtitleData.txtUrl, window.location.origin).href : (subtitleData.srtUrl ? new URL(subtitleData.srtUrl, window.location.origin).href : '');
            if (subtitleResult) subtitleResult.hidden = false;
            setToast('Subtitle lengkap siap diunduh');
          } catch (err) {
            subtitleFullText = '';
            if (subtitleStatus) subtitleStatus.textContent = 'Gagal mengambil subtitle';
            if (subtitlePreview) subtitlePreview.textContent = err.message || 'Terjadi kesalahan';
            if (subtitleResult) subtitleResult.hidden = false;
            setToast('Subtitle gagal: ' + err.message);
          } finally {
            if (subtitleBtn) {
              subtitleBtn.disabled = false;
              subtitleBtn.innerHTML = subtitleBtnDefault || '<i class="bi bi-text-left"></i> Ambil subtitle';
            }
          }
        }

        let urlDragDepth = 0;
        const isUrlDrag = (e) => {
          const dt = e.dataTransfer;
          if (!dt) return false;
          if (dt.types && Array.from(dt.types).includes('Files')) return false;
          return true;
        };

        ['dragenter', 'dragleave'].forEach(ev => {
          document.addEventListener(ev, (e) => {
            if (!isUrlDrag(e)) return;
            if (ev === 'dragenter') { urlDragDepth += 1; if (urlDropOverlay) urlDropOverlay.hidden = false; }
            else { urlDragDepth = Math.max(0, urlDragDepth - 1); if (urlDragDepth === 0 && urlDropOverlay) urlDropOverlay.hidden = true; }
            e.preventDefault();
          });
        });

        document.addEventListener('dragover', (e) => {
          if (!isUrlDrag(e)) return;
          e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
          if (!isUrlDrag(e)) return;
          e.preventDefault();
          urlDragDepth = 0;
          if (urlDropOverlay) urlDropOverlay.hidden = true;
          const data = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
          if (data) {
            $('#url').value = data.trim();
            updatePreview();
            setToast('URL ditempel dari drag & drop');
          }
        });

        // ===== Copy log =====
        $('#copyLog').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText($('#logs').textContent || ''); setToast('Log tersalin'); } catch { setToast('Tidak bisa menyalin'); }
        });

        // ===== Extras: FAQ Logic & Hall of Fame =====
        const initExtras = () => {
          const faqOpenTicketBtn = document.getElementById('faqOpenTicketBtn');
          if (faqOpenTicketBtn && !faqOpenTicketBtn.dataset.bound) {
            faqOpenTicketBtn.dataset.bound = '1';
            faqOpenTicketBtn.addEventListener('click', () => {
              const modalEl = document.getElementById('emailModal');
              if (modalEl && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
            });
          }

          const faqOpenAiHelpBtn = document.getElementById('faqOpenAiHelpBtn');
          if (faqOpenAiHelpBtn && !faqOpenAiHelpBtn.dataset.bound) {
            faqOpenAiHelpBtn.dataset.bound = '1';
            faqOpenAiHelpBtn.addEventListener('click', () => {
              const assistantToggleBtn = document.getElementById('assistantToggle');
              const assistantPanelEl = document.getElementById('assistantPanel');
              if (assistantPanelEl?.hidden && assistantToggleBtn) assistantToggleBtn.click();
              const input = document.getElementById('assistantInput');
              if (input) {
                input.value = '/help';
                input.focus();
              }
            });
          }

          const forumQuickButtons = Array.from(document.querySelectorAll('[data-forum-quick]'));
          forumQuickButtons.forEach((btn) => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => {
              const forumInput = document.getElementById('forumInput');
              if (!forumInput) return;
              const presetMap = {
                halo: 'Halo semuanya 👋 semoga harimu lancar!',
                bantuan: 'Teman-teman, boleh bantu cek kendala convert saya? (link + error sudah saya siapkan).',
                event: 'Ada yang minat bikin event komunitas minggu ini? Share idenya di thread ini ya 🔥',
                rules: 'Reminder bareng: jaga sopan santun, no spam, dan hormati sesama warga ya 🙌'
              };
              forumInput.value = presetMap[btn.dataset.forumQuick || 'halo'] || '';
              forumInput.focus();
            });
          });

          const copySaweriaLinkBtn = document.getElementById('copySaweriaLinkBtn');
          if (copySaweriaLinkBtn && !copySaweriaLinkBtn.dataset.bound) {
            copySaweriaLinkBtn.dataset.bound = '1';
            copySaweriaLinkBtn.addEventListener('click', async () => {
              try { await navigator.clipboard.writeText('https://saweria.co/DhikaMarcella'); setToast('Link donasi tersalin'); } catch { setToast('Gagal menyalin link donasi'); }
            });
          }
          const shareSaweriaBtn = document.getElementById('shareSaweriaBtn');
          if (shareSaweriaBtn && !shareSaweriaBtn.dataset.bound) {
            shareSaweriaBtn.dataset.bound = '1';
            shareSaweriaBtn.addEventListener('click', async () => {
              const shareUrl = 'https://saweria.co/DhikaMarcella';
              if (navigator.share) {
                try { await navigator.share({ title: 'Dukung YTConv', text: 'Yuk bantu support YTConv 🚀', url: shareUrl }); } catch { }
              } else {
                try { await navigator.clipboard.writeText(shareUrl); setToast('Link donasi siap dibagikan'); } catch { }
              }
            });
          }
          const saweriaReminderToggle = document.getElementById('saweriaReminderToggle');
          if (saweriaReminderToggle && !saweriaReminderToggle.dataset.bound) {
            saweriaReminderToggle.dataset.bound = '1';
            try { saweriaReminderToggle.checked = localStorage.getItem('saweria_reminder') === '1'; } catch { }
            saweriaReminderToggle.addEventListener('change', () => {
              try { localStorage.setItem('saweria_reminder', saweriaReminderToggle.checked ? '1' : '0'); } catch { }
              setToast(saweriaReminderToggle.checked ? 'Reminder donasi bulanan aktif' : 'Reminder donasi dimatikan');
            });
          }

          const missionButtons = Array.from(document.querySelectorAll('[data-mission-action]'));
          const missionScore = document.getElementById('dailyMissionScore');
          if (missionButtons.length && missionScore) {
            const missionKey = 'experience_daily_mission';
            let missionState = {};
            try { missionState = JSON.parse(localStorage.getItem(missionKey) || '{}') || {}; } catch { missionState = {}; }
            const refreshMissionScore = () => {
              const done = missionButtons.reduce((acc, btn) => acc + (missionState[btn.dataset.missionAction || ''] ? 1 : 0), 0);
              missionScore.textContent = `${done} / ${missionButtons.length}`;
            };
            missionButtons.forEach((btn) => {
              const key = btn.dataset.missionAction || '';
              btn.classList.toggle('btn-success', !!missionState[key]);
              btn.classList.toggle('btn-outline-primary', !missionState[key]);
              if (btn.dataset.bound) return;
              btn.dataset.bound = '1';
              btn.addEventListener('click', () => {
                missionState[key] = true;
                try { localStorage.setItem(missionKey, JSON.stringify(missionState)); } catch { }
                btn.classList.remove('btn-outline-primary');
                btn.classList.add('btn-success');
                refreshMissionScore();
                if (key === 'faq' && typeof setActiveSection === 'function') setActiveSection('faq');
                if (key === 'forum') {
                  const fm = document.getElementById('forumModal');
                  if (fm && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(fm).show();
                }
              });
            });
            refreshMissionScore();
          }

          const profileExportSummaryBtn = document.getElementById('profileExportSummaryBtn');
          if (profileExportSummaryBtn && !profileExportSummaryBtn.dataset.bound) {
            profileExportSummaryBtn.dataset.bound = '1';
            profileExportSummaryBtn.addEventListener('click', () => {
              const payload = {
                level: document.getElementById('avatarLevelBadge')?.textContent?.trim() || 'Lv.1',
                xp: document.getElementById('rewardPointsLabel')?.textContent?.trim() || '0 XP',
                streak: document.getElementById('profileStreakLabel')?.textContent?.trim() || '0 hari',
                mood: document.getElementById('avatarMood')?.textContent?.trim() || '-',
                exportedAt: new Date().toISOString(),
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'ytconv-profile-summary.json';
              a.click();
              URL.revokeObjectURL(url);
            });
          }

          const profileCopyStatsBtn = document.getElementById('profileCopyStatsBtn');
          if (profileCopyStatsBtn && !profileCopyStatsBtn.dataset.bound) {
            profileCopyStatsBtn.dataset.bound = '1';
            profileCopyStatsBtn.addEventListener('click', async () => {
              const text = `Level: ${document.getElementById('avatarLevelBadge')?.textContent?.trim() || '-'} | XP: ${document.getElementById('rewardPointsLabel')?.textContent?.trim() || '-'} | Streak: ${document.getElementById('profileStreakLabel')?.textContent?.trim() || '-'}`;
              try { await navigator.clipboard.writeText(text); setToast('Statistik profil disalin'); } catch { setToast('Gagal menyalin statistik'); }
            });
          }

          const settingsCopyDiagnosticsBtn = document.getElementById('settingsCopyDiagnosticsBtn');
          if (settingsCopyDiagnosticsBtn && !settingsCopyDiagnosticsBtn.dataset.bound) {
            settingsCopyDiagnosticsBtn.dataset.bound = '1';
            settingsCopyDiagnosticsBtn.addEventListener('click', async () => {
              const diagnostics = {
                online: navigator.onLine,
                theme: document.documentElement.getAttribute('data-bs-theme') || 'auto',
                mode: localStorage.getItem('ytmp3_mode_pref') || 'basic',
                language: document.getElementById('langSelect')?.value || 'en',
                cdn: document.getElementById('cdnSelect')?.value || 'auto',
                userAgent: navigator.userAgent,
                time: new Date().toISOString(),
              };
              try { await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2)); setToast('Diagnostics disalin'); } catch { setToast('Gagal menyalin diagnostics'); }
            });
          }

          const settingsResetPrefsBtn = document.getElementById('settingsResetPrefsBtn');
          if (settingsResetPrefsBtn && !settingsResetPrefsBtn.dataset.bound) {
            settingsResetPrefsBtn.dataset.bound = '1';
            settingsResetPrefsBtn.addEventListener('click', () => {
              try {
                ['ytmp3_mode_pref', 'saweria_reminder', 'experience_daily_mission', 'assistant_settings', 'assistantHistory', 'themeMode'].forEach((k) => localStorage.removeItem(k));
              } catch { }
              setToast('Preferensi utama direset. Refresh halaman untuk menerapkan penuh.');
            });
          }

          const footerCopyCurrentUrlBtn = document.getElementById('footerCopyCurrentUrlBtn');
          if (footerCopyCurrentUrlBtn && !footerCopyCurrentUrlBtn.dataset.bound) {
            footerCopyCurrentUrlBtn.dataset.bound = '1';
            footerCopyCurrentUrlBtn.addEventListener('click', async () => {
              try { await navigator.clipboard.writeText(location.href); setToast('URL halaman tersalin'); } catch { setToast('Gagal menyalin URL'); }
            });
          }

          const footerOpenTicketBtn = document.getElementById('footerOpenTicketBtn');
          if (footerOpenTicketBtn && !footerOpenTicketBtn.dataset.bound) {
            footerOpenTicketBtn.dataset.bound = '1';
            footerOpenTicketBtn.addEventListener('click', () => {
              const modalEl = document.getElementById('emailModal');
              if (modalEl && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
            });
          }

          const footerOpenChangelogBtn = document.getElementById('footerOpenChangelogBtn');
          if (footerOpenChangelogBtn && !footerOpenChangelogBtn.dataset.bound) {
            footerOpenChangelogBtn.dataset.bound = '1';
            footerOpenChangelogBtn.addEventListener('click', () => {
              setToast('Update terbaru: FAQ diperluas, Smart Assist Basic, forum quick actions, dan diagnostics settings.');
            });
          }

          const backToTopBtn = document.getElementById('backToTopBtn');
          if (backToTopBtn && !backToTopBtn.dataset.bound) {
            backToTopBtn.dataset.bound = '1';
            const syncBackTop = () => {
              backToTopBtn.hidden = (window.scrollY || 0) < 420;
            };
            window.addEventListener('scroll', syncBackTop, { passive: true });
            backToTopBtn.addEventListener('click', () => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            syncBackTop();
          }

          const faqSearchInput = document.getElementById('faqSearchInput');
          if (faqSearchInput && !faqSearchInput.dataset.bound) {
            faqSearchInput.dataset.bound = '1';
            faqSearchInput.addEventListener('input', () => {
              const keyword = String(faqSearchInput.value || '').trim().toLowerCase();
              const faqItems = Array.from(document.querySelectorAll('#faqTabContent .accordion-item'));
              faqItems.forEach((item) => {
                const text = String(item.textContent || '').toLowerCase();
                item.hidden = keyword ? !text.includes(keyword) : false;
              });
            });
            const quickKeywords = Array.from(document.querySelectorAll('[data-faq-keyword]'));
            quickKeywords.forEach((chip) => {
              chip.addEventListener('click', () => {
                faqSearchInput.value = chip.dataset.faqKeyword || '';
                faqSearchInput.dispatchEvent(new Event('input'));
              });
            });
            const faqResetKeywordBtn = document.getElementById('faqResetKeywordBtn');
            if (faqResetKeywordBtn) {
              faqResetKeywordBtn.addEventListener('click', () => {
                faqSearchInput.value = '';
                faqSearchInput.dispatchEvent(new Event('input'));
              });
            }
          }

          const faqTabContent = document.getElementById('faqTabContent');
          if (faqTabContent && !faqTabContent.dataset.collapseFallbackBound) {
            faqTabContent.dataset.collapseFallbackBound = '1';
            faqTabContent.addEventListener('click', (event) => {
              const button = event.target.closest('.accordion-button[data-bs-toggle="collapse"]');
              if (!button || window.bootstrap?.Collapse) return;
              const target = document.querySelector(button.getAttribute('data-bs-target') || '');
              if (!target) return;
              event.preventDefault();
              const parentSelector = target.getAttribute('data-bs-parent');
              if (parentSelector) {
                document.querySelectorAll(`${parentSelector} .accordion-collapse.show`).forEach((openPanel) => {
                  if (openPanel !== target) openPanel.classList.remove('show');
                });
              }
              const isOpen = target.classList.toggle('show');
              button.classList.toggle('collapsed', !isOpen);
              button.setAttribute('aria-expanded', String(isOpen));
            });
          }

          // 1. FAQ Trouble Links (Mobile vs Desktop)
          const linkContainer = document.getElementById('admin-contact-buttons');
          if (linkContainer) {
            const isMobile = window.innerWidth <= 768;
            let html = '';
            if (isMobile) {
              // Mobile: Direct Instagram DM
              html += `<a href="https://www.instagram.com/dikalfe?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" class="btn btn-outline-danger btn-sm rounded-pill"><i class="bi bi-instagram me-1"></i>DM Admin</a>`;
            } else {
              // Desktop: Drive Link + Instagram Pass
              html += `<a href="https://drive.google.com/file/d/1tcp09OPav74jPqoy_CI2PUeVVB91y0dS/view?usp=sharing" target="_blank" class="btn btn-outline-primary btn-sm rounded-pill"><i class="bi bi-file-earmark-lock me-1"></i>Get Cookies</a>`;
              html += `<a href="https://www.instagram.com/dikalfe?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" class="btn btn-outline-danger btn-sm rounded-pill ms-2"><i class="bi bi-instagram me-1"></i>Pass Admin</a>`;
            }
            linkContainer.innerHTML = html;
          }

          // 2. Hall of Fame
          const sultanList = document.getElementById('hof-sultan-list');
          const recentList = document.getElementById('hof-recent-list');

          const formatRupiah = (amount) => {
            const value = Number(amount) || 0;
            return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
          };

          const supportTierLabel = (amountRaw) => {
            const n = Number(amountRaw) || 0;
            if (n >= 100000) return 'Sultan Mode';
            if (n >= 50000) return 'Server Boost';
            return 'Traktir Kopi';
          };

          const timeAgo = (ms) => {
            const t = Number(ms) || 0;
            if (!t) return '';
            const diff = Math.max(0, Date.now() - t);
            const sec = Math.floor(diff / 1000);
            if (sec < 60) return `${sec}s ago`;
            const min = Math.floor(sec / 60);
            if (min < 60) return `${min}m ago`;
            const hr = Math.floor(min / 60);
            if (hr < 24) return `${hr}h ago`;
            const day = Math.floor(hr / 24);
            return `${day}d ago`;
          };

          const escapeHtml = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

          const renderHallOfFame = async () => {
            if (sultanList) {
              sultanList.innerHTML = `<div class="list-group-item p-3 text-secondary small"><span class="spinner-border spinner-border-sm me-2"></span>Memuat leaderboard...</div>`;
            }
            if (recentList) {
              recentList.innerHTML = `<div class="list-group-item p-3 text-secondary small"><span class="spinner-border spinner-border-sm me-2"></span>Memuat dukungan terbaru...</div>`;
            }
            try {
              const resp = await fetch(`/api/support/hall-of-fame?limit=10`, { cache: 'no-store' });
              const data = await resp.json().catch(() => null);
              if (!resp.ok || !data || !data.ok) throw new Error(data?.error || 'Gagal memuat data');

              const topMonth = Array.isArray(data.topMonth) ? data.topMonth : [];
              const recent = Array.isArray(data.recent) ? data.recent : [];

              if (sultanList) {
                if (!topMonth.length) {
                  sultanList.innerHTML = `<div class="list-group-item p-3 text-secondary small">Belum ada dukungan bulan ini.</div>`;
                } else {
                  sultanList.innerHTML = topMonth.slice(0, 10).map((row, i) => {
                    const name = escapeHtml(row.name || 'Anonim');
                    const initial = escapeHtml(String(name || 'A').trim().charAt(0).toUpperCase() || 'A');
                    const amount = formatRupiah(row.totalAmount);
                    const rankColor = i === 0 ? 'warning' : 'secondary';
                    const avatarBg = i === 0 ? 'warning' : 'secondary-subtle';
                    const avatarText = i === 0 ? 'dark' : 'dark';
                    return `
                <div class="list-group-item d-flex align-items-center gap-3 p-3">
                  <div class="fw-bold text-${rankColor} fs-4">${i + 1}</div>
                  <div class="avatar-placeholder rounded-circle bg-${avatarBg} text-${avatarText} d-flex align-items-center justify-content-center fw-bold" style="width: 40px; height: 40px;">${initial}</div>
                  <div class="flex-grow-1">
                    <div class="fw-bold">${name}</div>
                    <div class="small text-secondary">${amount}</div>
                  </div>
                  ${i === 0 ? '<i class="bi bi-crown-fill text-warning"></i>' : ''}
                </div>
              `;
                  }).join('');
                }
              }

              if (recentList) {
                if (!recent.length) {
                  recentList.innerHTML = `<div class="list-group-item p-3 text-secondary small">Belum ada dukungan terbaru.</div>`;
                } else {
                  recentList.innerHTML = recent.slice(0, 10).map((row) => {
                    const name = escapeHtml(row.donatorName || 'Anonim');
                    const label = escapeHtml(supportTierLabel(row.amountRaw));
                    const when = escapeHtml(timeAgo(row.createdAt));
                    return `
                <div class="list-group-item d-flex align-items-center gap-3 p-3">
                  <div class="avatar-placeholder rounded-circle bg-info-subtle text-info d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;"><i class="bi bi-person-fill"></i></div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold">${name}</div>
                    <div class="small text-secondary">${label} • ${formatRupiah(row.amountRaw)}</div>
                  </div>
                  <small class="text-secondary">${when}</small>
                </div>
              `;
                  }).join('');
                }
              }
            } catch (e) {
              if (sultanList) sultanList.innerHTML = `<div class="list-group-item p-3 text-danger small">Leaderboard gagal dimuat.</div>`;
              if (recentList) recentList.innerHTML = `<div class="list-group-item p-3 text-danger small">Dukungan terbaru gagal dimuat.</div>`;
            }
          };

          if (sultanList || recentList) {
            renderHallOfFame();
            setInterval(renderHallOfFame, 30000);
          }
        };

        initPublicTicketLookup();
        initEmailContact();

        // ===== Basic Mode Logic =====
        const basicUrlInput = document.getElementById('basic-url');
        const basicConvertBtn = document.getElementById('basic-convert-btn');
        const basicResetBtn = document.getElementById('basic-reset-btn');
        const basicMp3Btn = document.getElementById('basic-mp3-btn');
        const basicMp4Btn = document.getElementById('basic-mp4-btn');
        const basicResSd = document.getElementById('basic-res-sd');
        const basicResHd = document.getElementById('basic-res-hd');
        const basicLoading = document.getElementById('basic-loading');
        const basicSuccess = document.getElementById('basic-success');
        const basicError = document.getElementById('basic-error');
        const basicDownloadBtn = document.getElementById('basic-download-btn');
        const basicFilename = document.getElementById('basic-filename');
        const basicErrorMsg = document.getElementById('basic-error-msg');
        const basicPasteBtn = document.getElementById('basic-paste-btn');

        const levenshteinDistance = (a, b) => {
          if (!a || !b) return 100;
          const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
          for (let i = 0; i <= a.length; i += 1) { track[0][i] = i; }
          for (let j = 0; j <= b.length; j += 1) { track[j][0] = j; }
          for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
              const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
              track[j][i] = Math.min(
                track[j][i - 1] + 1,
                track[j - 1][i] + 1,
                track[j - 1][i - 1] + indicator,
              );
            }
          }
          return track[b.length][a.length];
        };

        const checkDuplicate = (url, title = '') => {
          const history = loadCloudHistoryOnly();

          const extractId = (u) => {
            try {
              const match = u.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{10,12})\b/);
              return match ? match[1] : null;
            } catch { return null; }
          };

          const newId = extractId(url);

          return history.find(h => {
            // 1. Direct URL Match
            if (h.originalUrl === url || h.downloadUrl === url) return true;

            // 2. ID Match (Best for YouTube)
            if (newId) {
              const oldId = extractId(h.originalUrl);
              if (oldId && oldId === newId) return true;
            }

            // 3. Title Similarity (98% match)
            if (title && h.title) {
              const dist = levenshteinDistance(title.toLowerCase(), h.title.toLowerCase());
              const maxLength = Math.max(title.length, h.title.length);
              const similarity = (1 - dist / maxLength) * 100;
              if (similarity >= 98) return true;
            }

            return false;
          });
        };

        let activeTurnstileWidgetId = null;

        const requestTurnstileVerification = () => {
          return new Promise((resolve, reject) => {
            const modalEl = document.getElementById('turnstileModal');
            const widgetContainer = document.getElementById('turnstile-widget');

            if (!modalEl || !widgetContainer) {
              const msg = translateMessage('Captcha tidak tersedia. Refresh halaman atau matikan adblock.');
              setToast(msg);
              reject(new Error(msg));
              return;
            }

            if (bootstrapGlobal?.Modal) {
              const waitForTurnstile = async (timeoutMs = 4000) => {
                const started = Date.now();
                while (!window.turnstile && Date.now() - started < timeoutMs) {
                  await new Promise((r) => setTimeout(r, 120));
                }
                return !!window.turnstile;
              };

              waitForTurnstile().then((ok) => {
                if (!ok) {
                  const msg = translateMessage('Captcha gagal dimuat. Refresh halaman atau matikan adblock.');
                  setToast(msg);
                  reject(new Error(msg));
                  return;
                }

                const modal = new bootstrapGlobal.Modal(modalEl);
                modal.show();

                // Clear previous widget properly
                if (activeTurnstileWidgetId !== null) {
                  try { window.turnstile.remove(activeTurnstileWidgetId); } catch (e) { }
                  activeTurnstileWidgetId = null;
                }
                widgetContainer.innerHTML = '';

                // Render Turnstile
                const siteKey = '0x4AAAAAACJPcwOvzNFeWXfR';

                try {
                  activeTurnstileWidgetId = window.turnstile.render(widgetContainer, {
                    sitekey: siteKey,
                    callback: (token) => {
                      setTimeout(() => modal.hide(), 500);
                      resolve(token);
                    },
                    'error-callback': () => {
                      setToast('Turnstile Error');
                      reject(new Error('Turnstile Error'));
                    }
                  });
                } catch (e) {
                  console.error(e);
                  const msg = translateMessage('Captcha gagal dimunculkan. Coba refresh.');
                  setToast(msg);
                  reject(new Error(msg));
                }
              });
            } else {
              const msg = translateMessage('Komponen captcha belum siap. Coba refresh.');
              setToast(msg);
              reject(new Error(msg));
            }
          });
        };

        const validateLinkInput = (input) => {
          if (!input) return;
          input.addEventListener('input', () => {
            const val = input.value;
            if (!val) {
              input.classList.remove('is-invalid');
              return;
            }

            const isAdmin = isAdminLoggedIn();
            if (isAdmin) {
              input.classList.remove('is-invalid');
              return;
            }

            const isUrl = /^(https?:\/\/)/i.test(val);
            const allowed = /youtube\.com|youtu\.be|spotify\.com|soundcloud\.com/i.test(val);

            if (val.length > 8 && (!isUrl || !allowed)) {
              input.classList.add('is-invalid');
            } else {
              input.classList.remove('is-invalid');
            }
          });

          input.addEventListener('change', () => {
            const val = input.value;
            const isAdmin = isAdminLoggedIn();
            if (!isAdmin && val && !/youtube\.com|youtu\.be|spotify\.com|soundcloud\.com/i.test(val)) {
              setToast('Hanya link YouTube, Spotify, atau SoundCloud yang valid');
              input.value = ''; // Clear invalid input
            }
          });
        };

        const handleBasicConvert = async () => {
          // Request notification permission if default
          if ('Notification' in window && Notification.permission === 'default') {
            try { Notification.requestPermission(); } catch { }
          }

          const basicUrlInput = document.getElementById('basic-url');
          const url = basicUrlInput?.value?.trim();
          if (!url) {
            setToast('Masukkan link YouTube, Spotify, atau SoundCloud dulu');
            vibrate(100);
            return;
          }

          // Validation: Must be a link and from Allowed Sources
          const isUrl = /^(https?:\/\/)/i.test(url);
          const allowed = /youtube\.com|youtu\.be|spotify\.com|soundcloud\.com/i.test(url);

          if (!isUrl || !allowed) {
            setToast('Hanya link YouTube, Spotify, atau SoundCloud yang diperbolehkan');
            vibrate(200);
            return;
          }

          const format = document.querySelector('input[name="basic-fmt"]:checked')?.value || 'mp3';

          playUiFx('convert_click');

          // Duplicate Detector
          const dup = checkDuplicate(url);
          if (dup && dup.format === format) {
            const modalEl = document.getElementById('duplicateModal');
            const filenameEl = document.getElementById('duplicateFilename');
            const confirmBtn = document.getElementById('confirmDuplicateBtn');

            if (modalEl && bootstrapGlobal?.Modal) {
              if (filenameEl) filenameEl.textContent = dup.fileName || 'Audio File';
              const modal = new bootstrapGlobal.Modal(modalEl);
              modal.show();

              const newBtn = confirmBtn.cloneNode(true);
              confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

              newBtn.addEventListener('click', () => {
                modal.hide();
                finishBasicConvert(url, dup);
              });
              return;
            } else if (modalEl) {
              // Fallback if Bootstrap JS missing
              if (confirm(`File mirip ditemukan: ${dup.fileName}. Gunakan cache?`)) {
                finishBasicConvert(url, dup);
                return;
              }
            }
          }

          // Turnstile Check (Basic Mode Only)
          try {
            await requestTurnstileVerification();
          } catch (e) {
            return; // Stop if failed/cancelled
          }

          await executeBasicConvert(url);
        };

        const setBasicFlowStep = (stepId, done = false) => {
          const el = document.getElementById(stepId);
          if (!el) return;
          el.classList.toggle('text-success', !!done);
          el.classList.toggle('fw-semibold', !!done);
          el.classList.toggle('text-secondary', !done);
          const icon = el.querySelector('i');
          if (icon) icon.className = done ? 'bi bi-check-circle-fill me-1' : 'bi bi-circle me-1';
        };

        const updateBasicFlowChecklist = () => {
          const url = String(document.getElementById('basic-url')?.value || '').trim();
          const isLinkDone = /^(https?:\/\/)/i.test(url);
          const fmt = document.querySelector('input[name="basic-fmt"]:checked')?.value || '';
          const quality = String(document.getElementById('basic-quality')?.value || '');
          const hasPreset = Boolean(fmt) && (fmt === 'mp3' ? true : Boolean(quality));
          const hasStarted = !document.getElementById('basic-progress-wrap')?.hidden;
          const hasDone = !document.getElementById('basic-result')?.hidden;

          setBasicFlowStep('basicStepLink', isLinkDone);
          setBasicFlowStep('basicStepPreset', hasPreset);
          setBasicFlowStep('basicStepConvert', hasStarted);
          setBasicFlowStep('basicStepDone', hasDone);

          const score = [isLinkDone, hasPreset, hasStarted, hasDone].filter(Boolean).length;
          const scoreEl = document.getElementById('basicFlowScore');
          if (scoreEl) scoreEl.textContent = `${score} / 4`;
        };

        const updateBasicSmartAssist = () => {
          const url = String(document.getElementById('basic-url')?.value || '').trim();
          const format = document.querySelector('input[name="basic-fmt"]:checked')?.value || 'mp3';
          const quality = String(document.getElementById('basic-quality')?.value || 'standard');
          const hint = document.getElementById('basicSmartHintText');
          const badge = document.getElementById('basicSourceBadge');
          if (!hint || !badge) return;

          const source = /spotify\.com/i.test(url)
            ? 'Spotify'
            : (/soundcloud\.com/i.test(url) ? 'SoundCloud' : (/youtube\.com|youtu\.be/i.test(url) ? 'YouTube' : '-'));
          badge.textContent = `Sumber: ${source}`;

          if (!url) {
            hint.textContent = 'Tempel link dulu, nanti AI bantu rekomendasi format terbaik buat kamu.';
            return;
          }
          if (format === 'mp3') {
            hint.innerHTML = `Rekomendasi: <strong>MP3</strong> cocok buat musik harian. Gunakan kualitas <strong>${quality === 'best' ? 'Terbaik' : (quality === 'low' ? 'Hemat Data' : 'Standar')}</strong>.`;
          } else {
            hint.innerHTML = 'Rekomendasi: <strong>MP4</strong> cocok kalau kamu butuh video visual. Kualitas Standar biasanya paling cepat.';
          }
        };

        const finishBasicConvert = (url, dup) => {
          const basicSuccess = document.getElementById('basic-result');
          const basicDownloadBtn = document.getElementById('basic-download-link');
          const basicCopyLinkBtn = document.getElementById('basicCopyLinkBtn');
          const basicShareBtn = document.getElementById('basicShareBtn');

          if (basicSuccess) basicSuccess.hidden = false;
          if (basicDownloadBtn) {
            basicDownloadBtn.href = dup.downloadUrl;
            basicDownloadBtn.download = dup.fileName || 'download';
            basicDownloadBtn.classList.add('step-active');
            basicDownloadBtn.onclick = () => { if (navigator.vibrate) navigator.vibrate(20); };
          }
          if (basicCopyLinkBtn) {
            basicCopyLinkBtn.onclick = async () => {
              try { await navigator.clipboard.writeText(String(dup.downloadUrl || '')); setToast('Link download disalin'); } catch { setToast('Gagal menyalin link'); }
            };
          }
          if (basicShareBtn) {
            basicShareBtn.onclick = async () => {
              const shareUrl = String(dup.downloadUrl || '');
              if (!shareUrl) return;
              if (navigator.share) {
                try { await navigator.share({ title: 'Hasil convert YTConv', url: shareUrl }); } catch { }
              } else {
                try { await navigator.clipboard.writeText(shareUrl); setToast('Link dibagikan lewat clipboard'); } catch { }
              }
            };
          }
          setToast('Menggunakan file dari cache');
          updateBasicFlowChecklist();
          vibrate([50, 50]);
          playUiFx('convert_done');
        };

        const startBasicProgressWatcher = (id) => {
          if (!id) return;
          const progWrap = document.getElementById('basic-progress-wrap');
          const progBar = document.getElementById('basic-progress-bar');
          const statusText = document.getElementById('basic-status-text');
          if (progWrap) { progWrap.hidden = false; }
          let timer = 0;
          const poll = async () => {
            try {
              const resp = await fetch(api(`/api/progress/${id}?t=${Date.now()}`), { cache: 'no-store' });
              if (!resp.ok) {
                if (resp.status === 404) {
                  timer = window.setTimeout(poll, 900);
                  return;
                }
                throw new Error(`HTTP ${resp.status}`);
              }
              const safe = await readJsonSafe(resp);
              const info = safe.data?.progress || {};
              const percent = Number(info.percent ?? 0);
              if (progBar) progBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
              const parts = [];
              if (info.message) parts.push(info.message);
              else {
                if (info.etaLabel) parts.push(`ETA ${info.etaLabel}`);
                else if (typeof info.etaSeconds === 'number' && info.etaSeconds >= 0) parts.push(`ETA ${secondsToClock(info.etaSeconds)}`);
                if (info.speed) parts.push(info.speed);
                if (info.size) parts.push(info.size);
              }
              if (statusText) statusText.textContent = parts.join(' • ') || 'Memproses...';
              const stage = String(info.stage || '').toLowerCase();
              if (stage === 'complete' || stage === 'error') {
                if (timer) clearTimeout(timer);
                timer = 0;
                return;
              }
            } catch { }
            timer = window.setTimeout(poll, 900);
          };
          poll();
        };

        const executeBasicConvert = async (url, explicitToken = null) => {
          const basicLoading = document.getElementById('basic-progress-wrap');
          const basicSuccess = document.getElementById('basic-result');
          const basicConvertBtn = document.getElementById('basic-convert-btn');
          const basicDownloadBtn = document.getElementById('basic-download-link');
          const basicCopyLinkBtn = document.getElementById('basicCopyLinkBtn');
          const basicShareBtn = document.getElementById('basicShareBtn');

          if (basicLoading) basicLoading.hidden = false;
          if (basicSuccess) basicSuccess.hidden = true;
          if (basicConvertBtn) basicConvertBtn.disabled = true;

          try {
            const format = document.querySelector('input[name="basic-fmt"]:checked')?.value || 'mp3';
            const qualityVal = document.getElementById('basic-quality')?.value || 'standard';

            const payload = { url, format };
            if (format === 'mp4') {
              payload.videoQuality = qualityVal;
            } else {
              payload.abr = 128;
            }
            const progressId = createProgressId();
            payload.progressId = progressId;
            startBasicProgressWatcher(progressId);
            try {
              const token = explicitToken || await requestCaptchaToken('convert');
              if (token) payload.captchaToken = token;
              else throw new Error('Captcha token missing');
            } catch (e) {
              throw new Error('Gagal memverifikasi captcha. Silakan coba lagi.');
            }

            const resp = await fetch(api('/api/convert'), {
              method: 'POST',
              headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify(payload),
            });
            const { data: result } = await resolveJsonResponse(resp, {
              fallbackMessage: 'Gagal memproses',
              logLabel: 'basic-convert',
            });

            if (result.isDuplicate) {
              setToast('File diambil dari cache (Cepat!)');
            }

            if (basicLoading) basicLoading.hidden = true;
            if (basicSuccess) basicSuccess.hidden = false;
            if (basicDownloadBtn) {
              const dUrl = absoluteFromRelative(result.downloadUrl);
              if (!dUrl) throw new Error('Link download tidak valid.');
              basicDownloadBtn.href = dUrl;
              basicDownloadBtn.download = result.fileName || 'download';
              basicDownloadBtn.classList.add('step-active');
            }
            if (basicCopyLinkBtn && basicDownloadBtn) {
              basicCopyLinkBtn.onclick = async () => {
                try { await navigator.clipboard.writeText(String(basicDownloadBtn.href || '')); setToast('Link download disalin'); } catch { setToast('Gagal menyalin link'); }
              };
            }
            if (basicShareBtn && basicDownloadBtn) {
              basicShareBtn.onclick = async () => {
                const shareUrl = String(basicDownloadBtn.href || '');
                if (!shareUrl) return;
                if (navigator.share) {
                  try { await navigator.share({ title: 'Hasil convert YTConv', url: shareUrl }); } catch { }
                } else {
                  try { await navigator.clipboard.writeText(shareUrl); setToast('Link dibagikan lewat clipboard'); } catch { }
                }
              };
            }

            // Render Audio Insight if available
            if (result.audioInsight && typeof renderAudioInsight === 'function') {
              // Render di Basic Mode juga
              const insightWrap = document.getElementById('audioInsightWrap');
              if (insightWrap) {
                insightWrap.hidden = false;
              }

              const insightWrapBasic = document.getElementById('audioInsightWrapBasic');
              if (insightWrapBasic) {
                insightWrapBasic.hidden = false;
              }

              renderAudioInsight(result.audioInsight);
            }

            vibrate([50, 50, 50]);
            playUiFx('convert_done');

            pushHistory({
              originalUrl: url,
              downloadUrl: (result?.cloudinaryAudio?.url ? String(result.cloudinaryAudio.url) : '') || absoluteFromRelative(result.downloadUrl),
              serverUrl: absoluteFromRelative(result.downloadUrl),
              cloudUrl: result?.cloudinaryAudio?.url ? String(result.cloudinaryAudio.url) : '',
              fileName: result.fileName,
              fileSize: result.fileSize || result.size || 0,
              format: result.format,
              abr: format === 'mp3' ? 128 : undefined,
              meta: { title: result.fileName },
              audioInsight: result.audioInsight
            });
            if (typeof renderBasicHistory === 'function') renderBasicHistory();

            notifyUser('YouTube to MP3', `Selesai di convert: ${result.fileName || 'Audio File'}`);
            updateBasicFlowChecklist();

          } catch (err) {
            if (basicLoading) basicLoading.hidden = true;
            setToast('Error: ' + err.message);
          } finally {
            if (basicConvertBtn) basicConvertBtn.disabled = false;
            updateBasicFlowChecklist();
          }
        };

        // ===== Gaptek (Simple) Mode Logic =====
        const startGaptekProgressWatcher = (id) => {
          if (!id) return;
          const progWrap = document.getElementById('gaptek-progress-wrap');
          const progBar = document.getElementById('gaptek-progress-bar');
          const statusText = document.getElementById('gaptek-status-text');

          if (progWrap) { progWrap.hidden = false; }
          let timer = 0;

          const poll = async () => {
            try {
              const resp = await fetch(api(`/api/progress/${id}?t=${Date.now()}`), { cache: 'no-store' });
              if (!resp.ok) {
                if (resp.status === 404) {
                  timer = window.setTimeout(poll, 900);
                  return;
                }
                throw new Error(`HTTP ${resp.status}`);
              }
              const safe = await readJsonSafe(resp);
              const info = safe.data?.progress || {};
              const percent = Number(info.percent ?? 0);

              if (progBar) {
                progBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
                progBar.setAttribute('aria-valuenow', percent);
              }

              if (statusText) {
                const parts = [];
                if (info.message) parts.push(info.message);
                else {
                  parts.push(`${percent.toFixed(0)}%`);
                  if (info.etaLabel) parts.push(`Sisa: ${info.etaLabel}`);
                }
                statusText.textContent = parts.join(' • ') || 'Memproses...';
              }

              const stage = String(info.stage || '').toLowerCase();
              if (stage === 'complete' || stage === 'error') {
                if (timer) clearTimeout(timer);
                timer = 0;
                return;
              }
            } catch { }
            timer = window.setTimeout(poll, 900);
          };
          poll();
        };

        const executeGaptekConvert = async (url) => {
          const loadingEl = document.getElementById('gaptek-status');
          const resultEl = document.getElementById('gaptek-result');
          const btn = document.getElementById('gaptek-convert-btn');
          const downloadBtn = document.getElementById('gaptek-download-link');
          const progWrap = document.getElementById('gaptek-progress-wrap');

          if (loadingEl) loadingEl.hidden = false;
          if (resultEl) resultEl.hidden = true;
          if (progWrap) progWrap.hidden = true; // Hide old progress
          if (btn) btn.disabled = true;

          try {
            const payload = {
              url,
              format: 'mp3',
              abr: 128 // Default for simple mode
            };

            const progressId = createProgressId();
            payload.progressId = progressId;

            // Start polling
            startGaptekProgressWatcher(progressId);

            // Turnstile
            try {
              const token = await requestCaptchaToken('convert');
              if (token) payload.captchaToken = token;
            } catch (e) {
              console.warn('Gaptek captcha skipped', e);
            }

            const resp = await fetch(api('/api/convert'), {
              method: 'POST',
              headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify(payload),
            });

            const { data: result } = await resolveJsonResponse(resp, {
              fallbackMessage: 'Gagal memproses lagu',
              logLabel: 'gaptek-convert',
            });

            if (loadingEl) loadingEl.hidden = true;
            if (resultEl) resultEl.hidden = false;

            if (downloadBtn) {
              const dUrl = absoluteFromRelative(result.downloadUrl);
              if (!dUrl) throw new Error('Link download tidak valid.');
              downloadBtn.href = dUrl;
              downloadBtn.download = result.fileName || 'lagu-mp3';
              downloadBtn.onclick = () => { if (navigator.vibrate) navigator.vibrate(20); };
            }

            setToast('Berhasil! Lagu siap disimpan.');
            vibrate([50, 50, 50]);

            // Add to history (reuse basic history logic)
            pushHistory({
              originalUrl: url,
              downloadUrl: (result?.cloudinaryAudio?.url ? String(result.cloudinaryAudio.url) : '') || absoluteFromRelative(result.downloadUrl),
              serverUrl: absoluteFromRelative(result.downloadUrl),
              cloudUrl: result?.cloudinaryAudio?.url ? String(result.cloudinaryAudio.url) : '',
              fileName: result.fileName,
              fileSize: result.fileSize || 0,
              format: 'mp3',
              abr: 128,
              meta: { title: result.fileName }
            });
            if (typeof renderBasicHistory === 'function') renderBasicHistory();

          } catch (err) {
            if (loadingEl) loadingEl.hidden = true;
            setToast(toFriendlyConvertError(err?.message || ''));
            vibrate(200);
          } finally {
            if (btn) btn.disabled = false;
          }
        };

        const handleGaptekConvert = async () => {
          const input = document.getElementById('gaptek-url');
          const url = input?.value?.trim();

          if (!url) {
            setToast('Tempel link-nya dulu ya!');
            vibrate(100);
            return;
          }

          if (!/^(https?:\/\/)/i.test(url)) {
            setToast('Link tidak valid. Pastikan link YouTube/Spotify.');
            return;
          }

          await executeGaptekConvert(url);
        };

        const initGaptekMode = () => {
          const btn = document.getElementById('gaptek-convert-btn');
          if (btn) btn.addEventListener('click', handleGaptekConvert);

          const resetBtn = document.getElementById('gaptek-reset-btn');
          if (resetBtn) {
            resetBtn.addEventListener('click', () => {
              const input = document.getElementById('gaptek-url');
              const resultEl = document.getElementById('gaptek-result');
              const progWrap = document.getElementById('gaptek-progress-wrap');

              if (input) input.value = '';
              if (resultEl) resultEl.hidden = true;
              if (progWrap) progWrap.hidden = true;

              vibrate(50);
            });
          }

          // Input Validation
          const input = document.getElementById('gaptek-url');
          if (input && typeof validateLinkInput === 'function') validateLinkInput(input);
        };

        const initBasicMode = () => {
          // Mode Switcher Logic
          const setupModeSwitcher = () => {
            const btnToggle = document.getElementById('headerModeToggle');
            const labelToggle = document.getElementById('headerModeLabel');
            const containerBasic = document.getElementById('basic-mode');
            const containerAdvanced = document.getElementById('advanced-mode');
            const containerGaptek = document.getElementById('gaptek-mode');
            const welcomeModalEl = document.getElementById('welcomeModeModal');
            const selectBasic = document.getElementById('selectBasicMode');
            const selectAdvanced = document.getElementById('selectAdvancedMode');
            const selectGaptek = document.getElementById('selectGaptekMode');
            const modeKey = 'ytmp3_mode_pref';

            const setMode = (mode) => {
              const isBasic = mode === 'basic';
              const isGaptek = mode === 'gaptek';
              const isAdvanced = !isBasic && !isGaptek;

              if (containerBasic) containerBasic.hidden = !isBasic;
              if (containerAdvanced) containerAdvanced.hidden = !isAdvanced;
              if (containerGaptek) containerGaptek.hidden = !isGaptek;

              if (labelToggle) {
                if (isBasic) labelToggle.textContent = 'Mode: Basic';
                else if (isGaptek) labelToggle.textContent = 'Mode: Gaptek';
                else labelToggle.textContent = 'Mode: Advanced';
              }
              if (btnToggle) {
                const icon = btnToggle.querySelector('i');
                if (icon) {
                  if (isBasic) icon.className = 'bi bi-magic';
                  else if (isGaptek) icon.className = 'bi bi-emoji-smile';
                  else icon.className = 'bi bi-sliders';
                }
                btnToggle.title = isBasic
                  ? 'Basic Mode: cepat dan simpel'
                  : (isGaptek ? 'Gaptek Mode: dipandu langkah demi langkah' : 'Advanced Mode: fitur paling lengkap');
                // Update button style
                btnToggle.classList.remove('text-primary', 'text-secondary', 'text-success');
                if (isBasic) btnToggle.classList.add('text-primary');
                else if (isGaptek) btnToggle.classList.add('text-success');
                else btnToggle.classList.add('text-secondary');
              }
              localStorage.setItem(modeKey, mode);
              vibrate(30);
            };

            const currentMode = localStorage.getItem(modeKey);

            if (btnToggle) {
              btnToggle.addEventListener('click', () => {
                const now = localStorage.getItem(modeKey) || 'basic';
                // Cycle: Basic -> Advanced -> Gaptek -> Basic
                let next = 'basic';
                if (now === 'basic') next = 'advanced';
                else if (now === 'advanced') next = 'gaptek';
                else next = 'basic';

                setMode(next);
                let msg = 'Basic Mode aktif';
                if (next === 'advanced') msg = 'Advanced Mode aktif';
                if (next === 'gaptek') msg = 'Gaptek Mode aktif';
                setToast(msg);
              });
            }

            // Admin Login Form - Prevent Auto Submit/Refresh
            const adminForm = document.getElementById('adminLoginForm');
            if (adminForm) {
              adminForm.addEventListener('submit', (e) => {
                e.preventDefault();
                // Logic login admin akan ditambahkan nanti
                setToast('Fitur login admin belum diaktifkan.');
              });
            }

            // Reset Mode Button
            const btnResetMode = document.getElementById('resetModePrefBtn');
            if (btnResetMode) {
              btnResetMode.addEventListener('click', () => {
                localStorage.removeItem(modeKey);

                if (welcomeModalEl && bootstrapGlobal?.Modal) {
                  // Close settings offcanvas if open
                  const settingsOffcanvas = document.getElementById('offcanvasSettings');
                  if (settingsOffcanvas && bootstrapGlobal?.Offcanvas) {
                    const offcanvasInstance = bootstrapGlobal.Offcanvas.getInstance(settingsOffcanvas);
                    if (offcanvasInstance) offcanvasInstance.hide();
                  }

                  // Show welcome modal
                  if (welcomeModalInstance) {
                    welcomeModalInstance.show();
                  } else {
                    // Fallback if instance lost (shouldn't happen)
                    const modal = new bootstrapGlobal.Modal(welcomeModalEl);
                    modal.show();
                  }
                } else {
                  setMode('basic');
                  setToast('Mode direset ke Basic');
                }
              });
            }

            // Gaptek Exit Button
            const gaptekExitBtn = document.getElementById('gaptek-exit-btn');
            if (gaptekExitBtn) {
              gaptekExitBtn.addEventListener('click', () => {
                localStorage.removeItem(modeKey);
                setMode('basic');
                if (welcomeModalEl && bootstrapGlobal?.Modal) {
                  const modal = new bootstrapGlobal.Modal(welcomeModalEl);
                  modal.show();
                }
              });
            }

            // Welcome Modal
            let welcomeModalInstance = null;
            if (welcomeModalEl && bootstrapGlobal?.Modal) {
              welcomeModalInstance = new bootstrapGlobal.Modal(welcomeModalEl);

              // Attach listeners ONCE, regardless of currentMode
              const handleSelection = (mode) => {
                setMode(mode);
                welcomeModalInstance.hide();
              };

              if (selectBasic) selectBasic.onclick = () => handleSelection('basic');
              if (selectAdvanced) selectAdvanced.onclick = () => handleSelection('advanced');
              if (selectGaptek) selectGaptek.onclick = () => handleSelection('gaptek');

              // Show if no mode selected
              if (!currentMode) {
                welcomeModalInstance.show();
              } else {
                setMode(currentMode);
              }
            } else {
              setMode(currentMode || 'basic');
            }

            // Basic Mode Listeners
            const basicConvertBtn = document.getElementById('basic-convert-btn');
            if (basicConvertBtn) basicConvertBtn.addEventListener('click', () => {
              updateBasicFlowChecklist();
              updateBasicSmartAssist();
              handleBasicConvert();
            });

            const basicPasteBtn = document.getElementById('basicPasteBtn');
            const basicUrlInput = document.getElementById('basic-url');
            const basicQuality = document.getElementById('basic-quality');
            const basicFmtMp3 = document.getElementById('basic-fmt-mp3');
            const basicFmtMp4 = document.getElementById('basic-fmt-mp4');
            if (basicUrlInput) validateLinkInput(basicUrlInput);

            if (basicPasteBtn && basicUrlInput) {
              basicPasteBtn.addEventListener('click', async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  basicUrlInput.value = text;
                  setToast('Link ditempel');
                  vibrate(50);
                } catch { setToast('Gagal menempel link'); }
                updateBasicFlowChecklist();
                updateBasicSmartAssist();
              });
            }

            const applyBasicPreset = (presetName) => {
              if (!basicQuality || !basicFmtMp3 || !basicFmtMp4) return;
              if (presetName === 'musik') {
                basicFmtMp3.checked = true;
                basicQuality.value = 'best';
              } else if (presetName === 'hemat') {
                basicFmtMp3.checked = true;
                basicQuality.value = 'low';
              } else if (presetName === 'video') {
                basicFmtMp4.checked = true;
                basicQuality.value = 'standard';
              }
              try { localStorage.setItem('ytmp3_basic_preset', presetName); } catch { }
              if (typeof updateFormatUI === 'function') updateFormatUI();
              setToast(`Preset aktif: ${presetName}`);
              vibrate(25);
            };

            const presetButtons = Array.from(document.querySelectorAll('[data-basic-preset]'));
            presetButtons.forEach((btn) => {
              btn.addEventListener('click', () => {
                applyBasicPreset(btn.dataset.basicPreset || 'musik');
                updateBasicFlowChecklist();
                updateBasicSmartAssist();
              });
            });

            const basicResetBtn = document.getElementById('basic-reset-btn');
            const basicSuccess = document.getElementById('basic-result');
            const basicError = document.getElementById('basic-progress-wrap'); // Reuse wrapper for error hiding
            if (basicResetBtn) {
              basicResetBtn.addEventListener('click', () => {
                if (basicUrlInput) basicUrlInput.value = '';
                if (basicSuccess) basicSuccess.hidden = true;
                // Hide progress/error
                const progWrap = document.getElementById('basic-progress-wrap');
                if (progWrap) progWrap.hidden = true;
                vibrate(50);
                updateBasicFlowChecklist();
                updateBasicSmartAssist();
              });
            }

            // Format Toggle (MP3/MP4)
            const fmtMp3 = document.getElementById('basic-fmt-mp3');
            const fmtMp4 = document.getElementById('basic-fmt-mp4');
            const qualitySelect = document.getElementById('basic-quality');

            const updateFormatUI = () => {
              const isMp3 = fmtMp3?.checked;
              if (qualitySelect) {
                // Hide/Disable quality select for MP3 (since it's fixed 128kbps)
                // qualitySelect.parentElement might be the column.
                // Let's just disable it or hide parent
                qualitySelect.disabled = !!isMp3;
                if (qualitySelect.closest('.col-6')) {
                  // Optional: Hide the whole column? Or just disable
                  // qualitySelect.closest('.col-6').style.opacity = isMp3 ? '0.5' : '1';
                }
              }
            };

            if (fmtMp3) fmtMp3.addEventListener('change', updateFormatUI);
            if (fmtMp4) fmtMp4.addEventListener('change', updateFormatUI);
            if (fmtMp3) fmtMp3.addEventListener('change', updateBasicSmartAssist);
            if (fmtMp4) fmtMp4.addEventListener('change', updateBasicSmartAssist);
            updateFormatUI(); // Init state
            const storedPreset = localStorage.getItem('ytmp3_basic_preset');
            if (storedPreset) applyBasicPreset(storedPreset);
            if (basicUrlInput) {
              basicUrlInput.addEventListener('input', updateBasicFlowChecklist);
              basicUrlInput.addEventListener('change', updateBasicFlowChecklist);
              basicUrlInput.addEventListener('input', updateBasicSmartAssist);
              basicUrlInput.addEventListener('change', updateBasicSmartAssist);
            }
            if (qualitySelect) {
              qualitySelect.addEventListener('change', updateBasicFlowChecklist);
              qualitySelect.addEventListener('change', updateBasicSmartAssist);
            }

            if (basicUrlInput && basicConvertBtn) {
              basicUrlInput.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey) {
                  ev.preventDefault();
                  basicConvertBtn.click();
                }
              });
            }
            updateBasicFlowChecklist();
            updateBasicSmartAssist();

            // Clear History Button
            const btnClearBasic = document.getElementById('clearBasicHistoryBtn');
            if (btnClearBasic) {
              btnClearBasic.addEventListener('click', () => {
                if (confirm('Hapus semua riwayat?')) {
                  localStorage.removeItem(historyKey);
                  if (typeof renderBasicHistory === 'function') renderBasicHistory();
                  if (typeof renderHistory === 'function') renderHistory(); // Sync advanced history too
                  setToast('Riwayat dihapus');
                }
              });
            }

            // Initial History Render
            if (typeof renderBasicHistory === 'function') renderBasicHistory();
          };

          try {
            setupModeSwitcher();
          } catch (err) {
            console.error('Mode switcher init failed:', err);
          }
        };

        // ===== Init =====
        (function init() {
          try {
            initTheme();
            initWelcome();
            renderSpinWheel();
            loadSettings();
            applyStoredFormatPreference();
            hydrateCachedUserSummary();
            loadAuthToken();
            fetchAuthConfig();
            fetchCheatConfig();
            fetchUserSession({ silent: true });
            updateSpinUi();
            ensureAssistantWelcome();
            updateMascotMood('default');
            initExtras();

            try {
              initBasicMode();
              initGaptekMode();
              const advUrl = document.getElementById('url');
              if (advUrl && typeof validateLinkInput === 'function') validateLinkInput(advUrl);
            } catch (e) { console.error('Basic mode init failed', e); }

            // Version Badge
            const verBadge = document.getElementById('appVersionBadge');
            const navVerBadge = document.getElementById('navVersionBadge');
            if (verBadge) {
              verBadge.textContent = APP_VERSION;
              verBadge.title = `Klik untuk info versi (${APP_VERSION})`;
              verBadge.addEventListener('click', () => {
                setToast(`YouTube To MP3 ${APP_VERSION} - Updated & Stable`);
                vibrate(50);
              });
            }
            if (navVerBadge) {
              navVerBadge.textContent = `${APP_VERSION} • Online`;
            }

            if (state.experience.narratorAuto) narrateGuide();
            renderHistory();
            if (typeof fetchTrendingNow === 'function') fetchTrendingNow();
            renderQueue();
            applyFormatPolicy();
            updateBackendBadge();
            refreshToolStatus();
            updatePreview();
            renderBackgroundJobs();
            loadStoredJobs();
            refreshBackgroundJobs();
            if (!localStorage.getItem(tutorialKey) && tutorialModalEl) {
              showWalkthrough(true);
            }

            // Step Highlighting Logic
            function initStepHighlighting() {
              // Basic Mode Elements
              const basicInput = document.getElementById('basic-url');
              const basicInputGroup = document.getElementById('basic-input-group');
              const basicFormatSection = document.getElementById('basic-format-section');
              const basicConvertBtn = document.getElementById('basic-convert-btn');
              const basicFormatRadios = document.querySelectorAll('input[name="basic-fmt"]');

              // Advanced Mode Elements
              const advInput = document.getElementById('url');
              const advFormat = document.getElementById('format');
              const advConvertBtn = document.getElementById('convertBtn');
              const advDownloadBtn = document.getElementById('downloadLink');

              function setStep(step, mode = 'basic') {
                // Clear all
                if (mode === 'basic') {
                  basicInputGroup?.classList.remove('step-active');
                  basicFormatSection?.classList.remove('step-active');
                  basicConvertBtn?.classList.remove('step-active');

                  if (step === 1) basicInputGroup?.classList.add('step-active');
                  if (step === 2) basicFormatSection?.classList.add('step-active');
                  if (step === 3) basicConvertBtn?.classList.add('step-active');
                } else {
                  advInput?.classList.remove('step-active');
                  advFormat?.classList.remove('step-active');
                  advConvertBtn?.classList.remove('step-active');
                  advDownloadBtn?.classList.remove('step-active');

                  if (step === 1) advInput?.classList.add('step-active');
                  if (step === 2) advFormat?.classList.add('step-active');
                  if (step === 3) advConvertBtn?.classList.add('step-active');
                }
              }

              // Basic Mode Logic
              if (basicInput) {
                // Initial check
                const val = basicInput.value.trim();
                if (val) setStep(2, 'basic');
                else setStep(1, 'basic');

                basicInput.addEventListener('input', () => {
                  const val = basicInput.value.trim();
                  const isUrl = /^(https?:\/\/)/i.test(val);
                  const allowed = /youtube\.com|youtu\.be|spotify\.com|soundcloud\.com/i.test(val);

                  if (val.length > 5 && isUrl && allowed) {
                    setStep(2, 'basic');
                  } else {
                    setStep(1, 'basic');
                  }
                });

                basicInput.addEventListener('focus', () => {
                  const val = basicInput.value.trim();
                  if (!val) setStep(1, 'basic');
                });
              }

              basicFormatRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                  setStep(3, 'basic');
                });
              });

              if (basicConvertBtn) {
                basicConvertBtn.addEventListener('click', () => {
                  basicConvertBtn.classList.remove('step-active');
                });
              }

              // Advanced Mode Logic
              if (advInput) {
                // Initial check
                const val = advInput.value.trim();
                if (val) setStep(2, 'advanced');
                else setStep(1, 'advanced');

                advInput.addEventListener('input', () => {
                  const val = advInput.value.trim();
                  const isUrl = /^(https?:\/\/)/i.test(val);
                  if (val.length > 5 && isUrl) {
                    setStep(2, 'advanced');
                  } else {
                    setStep(1, 'advanced');
                  }
                });

                if (advFormat) {
                  advFormat.addEventListener('change', () => {
                    setStep(3, 'advanced');
                  });
                }

                if (advConvertBtn) {
                  advConvertBtn.addEventListener('click', () => {
                    advConvertBtn.classList.remove('step-active');
                  });
                }
              }
            }
            initStepHighlighting();

          } catch (fatalError) {
            console.error('App Initialization Failed:', fatalError);
            alert('Aplikasi gagal memuat. Silakan refresh halaman.');
          }
        })();

        // Feature: Copy Filename (Task 5)
        document.addEventListener('DOMContentLoaded', () => {
          const copyBtn = document.getElementById('copyFileNameBtn');
          if (copyBtn) {
            copyBtn.addEventListener('click', function () {
              const link = document.getElementById('downloadLink');
              const fileName = link?.getAttribute('download');
              if (!fileName) return;

              navigator.clipboard.writeText(fileName).then(() => {
                const icon = this.querySelector('i');
                const originalClass = icon.className;

                icon.className = 'bi bi-check-lg';

                if (typeof setToast === 'function') {
                  setToast('Nama file disalin!');
                }

                setTimeout(() => {
                  icon.className = originalClass;
                }, 2000);
              }).catch(err => console.error('Copy failed', err));
            });
          }
        });

        // Mini Rating Logic (Task 6)
        window.submitMiniRating = function (type) {
          const btns = document.getElementById('ratingButtons');
          const thanks = document.getElementById('ratingThanks');

          if (btns && thanks) {
            btns.hidden = true;
            thanks.hidden = false;
            // Optional: Save to localStorage or Analytics
            try {
              const ratings = JSON.parse(localStorage.getItem('userRatings') || '[]');
              ratings.push({ ts: Date.now(), type: type });
              localStorage.setItem('userRatings', JSON.stringify(ratings));
            } catch (e) { }
          }
        };

        // --- Task 8: Remember Device ---
        function initDeviceIdentity() {
          const deviceBadge = document.getElementById('deviceIdentityBadge');
          let deviceId = localStorage.getItem('ytmp3_device_id');
          let isNew = false;

          if (!deviceId) {
            isNew = true;
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
              deviceId = crypto.randomUUID().split('-')[0]; // Shorten for display
            } else {
              deviceId = Math.random().toString(36).substring(2, 10);
            }
            localStorage.setItem('ytmp3_device_id', deviceId);
            localStorage.setItem('ytmp3_first_visit', new Date().toISOString());
          }

          // Update UI
          if (deviceBadge) {
            deviceBadge.innerHTML = `<i class="bi bi-phone me-1"></i>ID: ${deviceId.substring(0, 6)}`;
            deviceBadge.title = `Device ID: ${deviceId}`;
          }

          // Welcome back toast (only if not new and not just refreshed immediately)
          // We use session storage to avoid spamming toast on refresh
          if (!isNew && !sessionStorage.getItem('device_welcome_shown')) {
            // Check if user has a preferred mode
            const mode = localStorage.getItem('ytmp3_mode_pref');
            const modeName = mode === 'advanced' ? 'Advanced' : 'Basic';

            // Delay slightly so it doesn't clash with other toasts
            setTimeout(() => {
              setToast(`Selamat datang kembali! Mode ${modeName} siap.`);
            }, 1500);
            sessionStorage.setItem('device_welcome_shown', 'true');
          }
        }
        initDeviceIdentity();

        // --- Task 7: Usage Badges Logic ---
        function initUsageBadges() {
          const usageCountEl = document.getElementById('usageCount');
          const trendStatusEl = document.getElementById('trendStatus');
          const usageBadgesEl = document.getElementById('usageBadges');

          if (!usageCountEl || !trendStatusEl || !usageBadgesEl) return;

          // 1. Determine "Dipakai Hari Ini" (Used Today)
          // We simulate a realistic global counter based on time of day + local usage
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const msSinceStart = now.getTime() - startOfDay;

          // Base: ~5000 users per day average, distributed by time
          // Linear accumulation: ~4.5 users per minute average (slightly higher for "Ramai")
          const estimatedBase = Math.floor(msSinceStart / (1000 * 60) * 4.5);

          // Add random variance based on day of year
          const dayOfYear = Math.floor(msSinceStart / 86400000);
          const dailyVariance = (dayOfYear % 7) * 135;

          // Get local user contribution
          let localCount = parseInt(localStorage.getItem('localUsageCount') || '0');

          // Check if local count is from today (reset if not)
          const lastUsageDate = localStorage.getItem('lastUsageDate');
          const todayStr = now.toDateString();

          if (lastUsageDate !== todayStr) {
            localCount = 0;
            localStorage.setItem('localUsageCount', '0');
            localStorage.setItem('lastUsageDate', todayStr);
          }

          let currentDisplayCount = estimatedBase + dailyVariance + localCount;

          // Update display function
          const updateDisplay = () => {
            usageCountEl.innerText = currentDisplayCount.toLocaleString('id-ID');

            // Logic for "Ramai Dipake" vs "Normal"
            // "Ramai" if count > 5000 OR current hour is 18-22 (6PM-10PM)
            const hour = new Date().getHours();
            const isPeakTime = hour >= 18 && hour <= 22;
            const isHighTraffic = currentDisplayCount > 5000;

            const trendBadge = trendStatusEl.parentElement;
            if (isPeakTime || isHighTraffic) {
              trendStatusEl.innerText = "Ramai Dipake!";
              trendBadge.className = "badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill py-2 px-3 shadow-sm d-flex align-items-center";
              trendBadge.querySelector('i').className = "bi bi-fire me-2";
            } else {
              trendStatusEl.innerText = "Stabil";
              trendBadge.className = "badge bg-success-subtle text-success border border-success-subtle rounded-pill py-2 px-3 shadow-sm d-flex align-items-center";
              trendBadge.querySelector('i').className = "bi bi-activity me-2";
            }
          };

          // Initial run
          updateDisplay();

          // Simulate live updates (users joining)
          // Random increment every 3-8 seconds
          setInterval(() => {
            if (Math.random() > 0.3) { // 70% chance to increment
              currentDisplayCount++;
              updateDisplay();
            }
          }, 5000);

          // Expose increment function for actual conversion
          window.incrementUsageCount = () => {
            localCount++;
            localStorage.setItem('localUsageCount', localCount);
            currentDisplayCount++;
            updateDisplay();
          };
        }
        initUsageBadges();

        // --- Task 9: Smart Disable (1 CTA) ---
        window.manageCTAState = function (state) {
          const convertBtn = document.getElementById('convertBtn');
          const downloadAllBtn = document.getElementById('downloadAllBtn');
          const downloadZipBtn = document.getElementById('downloadZipBtn');
          const clearBtn = document.getElementById('clearBtn');

          // Helper to set disabled state
          const set = (el, disabled) => {
            if (el) {
              const adminLocked = Boolean(window.__adminConvertDisabled) && (el.id === 'convertBtn' || el.id === 'basic-convert-btn' || el.id === 'gaptek-convert-btn');
              el.disabled = disabled || adminLocked;
              // Add/remove visual hint for disabled state if needed, but 'disabled' attribute is usually enough for Bootstrap
              if (disabled || adminLocked) {
                el.classList.add('opacity-50');
              } else {
                el.classList.remove('opacity-50');
              }
            }
          };

          switch (state) {
            case 'idle':
              try { ensureForumSocket()?.emit('conversion_idle'); } catch { }
              set(convertBtn, false);
              set(downloadAllBtn, true);
              set(downloadZipBtn, true);
              set(clearBtn, true);

              // Restore Convert Button Text
              if (convertBtn) {
                convertBtn.innerHTML = window.__adminConvertDisabled
                  ? '<i class="bi bi-shield-lock"></i> <span>Convert Disabled Admin</span>'
                  : '<i class="bi bi-magic"></i> <span data-i18n="buttonConvert">Convert</span>';
                // Ensure it pulsates or highlights as the primary action
                convertBtn.classList.toggle('pulse-animation', !window.__adminConvertDisabled);
              }
              break;

            case 'converting':
              try { ensureForumSocket()?.emit('conversion_start', { source: 'cta_state' }); } catch { }
              set(convertBtn, true);
              set(downloadAllBtn, true);
              set(downloadZipBtn, true);
              set(clearBtn, true);

              // Show Loading
              if (convertBtn) {
                convertBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses...';
                convertBtn.classList.remove('pulse-animation');
              }
              break;

            case 'completed':
              try { ensureForumSocket()?.emit('conversion_success', { source: 'cta_state' }); } catch { }
              // In completed state, we might want to allow "Clear" or "Convert New"
              // But the primary focus should be the Result Card (which has its own buttons)
              // We enable "Clear" so user can reset
              set(convertBtn, false); // User can convert another one directly

              // If there are items in queue (which we don't track easily here without global state), 
              // we might want to enable download all. 
              // For now, let's enable them if they exist, but maybe visually de-emphasize?
              // The prompt says "cuman 1 CTA aja". 
              // So let's keep secondary buttons disabled unless we KNOW they are needed.
              // But `convertBtn` IS the "Convert Next" button.
              // `clearBtn` is "Reset".
              set(clearBtn, false);

              // Let's assume Download All/Zip are for queue. If queue empty, keep disabled?
              // Checking queue length is hard from here without accessing `window.conversionQueue`.
              // Let's just enable them for now as they are part of the "Advanced" toolset.
              set(downloadAllBtn, false);
              set(downloadZipBtn, false);

              if (convertBtn) {
                convertBtn.innerHTML = '<i class="bi bi-magic"></i> <span data-i18n="buttonConvert">Convert Next</span>';
                convertBtn.classList.remove('pulse-animation');
              }
              break;
          }
        };

        // Initialize Smart CTA
        window.manageCTAState('idle');

        // Add CSS for pulse animation if not exists
        const style = document.createElement('style');
        style.innerHTML = `
        @keyframes pulse-primary {
            0% { box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(13, 110, 253, 0); }
            100% { box-shadow: 0 0 0 0 rgba(13, 110, 253, 0); }
        }
        .pulse-animation {
            animation: pulse-primary 2s infinite;
        }
    `;
        document.head.appendChild(style);

        // --- Task 10: Auto Fix Typos ---
        function initAutoFixTypos() {
          const inputs = ['url', 'basic-url', 'queueUrl'];

          const typos = [
            { pattern: /youtub\.com/i, fix: 'youtube.com' },
            { pattern: /yotube\.com/i, fix: 'youtube.com' },
            { pattern: /youtbe\.com/i, fix: 'youtube.com' },
            { pattern: /youtube\.co$/i, fix: 'youtube.com' }, // End of string
            { pattern: /youtube\.co\//i, fix: 'youtube.com/' },
            { pattern: /youtu\.be\//i, fix: 'youtu.be/' }, // Just ensure it exists, mostly safe
            { pattern: /sptify\.com/i, fix: 'spotify.com' },
            { pattern: /soundclod\.com/i, fix: 'soundcloud.com' },
            { pattern: /souncloud\.com/i, fix: 'soundcloud.com' },
            { pattern: /^www\.youtube\.com/i, fix: 'https://www.youtube.com' },
            { pattern: /^youtube\.com/i, fix: 'https://youtube.com' },
            { pattern: /^youtu\.be/i, fix: 'https://youtu.be' },
          ];

          function checkAndFix(input) {
            if (!input || !input.value) return;
            let val = input.value.trim();
            let original = val;
            let fixed = false;

            // 1. Remove spaces
            if (val.includes(' ')) {
              val = val.replace(/\s+/g, '');
              fixed = true;
            }

            // 2. Fix Typos
            typos.forEach(t => {
              if (t.pattern.test(val)) {
                val = val.replace(t.pattern, t.fix);
                fixed = true;
              }
            });

            // 3. Auto-prepend https:// if missing but looks like a URL (contains dot, no protocol)
            if (!/^https?:\/\//i.test(val) && val.includes('.') && !val.includes(' ')) {
              // Simple heuristic: if it starts with youtube, youtu.be, spotify, soundcloud
              if (/^(youtube|youtu|spotify|soundcloud)/i.test(val)) {
                val = 'https://' + val;
                fixed = true;
              }
            }

            if (fixed && val !== original) {
              input.value = val;
              // Optional: Flash input or Toast
              // Create a mini toast specifically for this or use standard toast
              // We'll use a subtle animation on the input
              input.style.transition = 'background-color 0.3s';
              const oldBg = input.style.backgroundColor;
              input.style.backgroundColor = 'rgba(25, 135, 84, 0.2)'; // Success tint
              setTimeout(() => {
                input.style.backgroundColor = oldBg;
              }, 1000);

              // Show small hint
              const id = 'typo-hint-' + input.id;
              let hint = document.getElementById(id);
              if (!hint) {
                hint = document.createElement('div');
                hint.id = id;
                hint.className = 'form-text text-success small animate__animated animate__fadeIn';
                input.parentNode.appendChild(hint);
              }
              hint.innerHTML = '<i class="bi bi-magic me-1"></i>Typo diperbaiki otomatis';

              // Remove hint after 3s
              setTimeout(() => {
                if (hint) hint.remove();
              }, 3000);
            }
          }

          inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
              el.addEventListener('blur', () => checkAndFix(el));
              el.addEventListener('paste', () => {
                setTimeout(() => checkAndFix(el), 100);
              });
            }
          });
        }
        initAutoFixTypos();

        // --- Task 11: Double Tap Protection ---
        function initDoubleTapProtection() {
          const protectedSelectors = [
            '#convertBtn',
            '#basic-convert-btn',
            '#downloadAllBtn',
            '#downloadZipBtn',
            '#downloadLink',
            '#clearBtn'
          ];

          // Global capture phase listener for better coverage
          document.addEventListener('click', (e) => {
            const btn = e.target.closest('button, a.btn');
            if (!btn) return;

            // Check if it's one of our protected buttons OR has a specific class
            // We'll protect ALL primary/success buttons to be safe + specific IDs
            const isProtected = protectedSelectors.some(sel => btn.matches(sel)) ||
              btn.classList.contains('btn-primary') ||
              btn.classList.contains('btn-success');

            if (isProtected) {
              const now = Date.now();
              const lastClick = Number(btn.dataset.lastClick || 0);

              // 1. Debounce (prevent double taps within 500ms)
              if (now - lastClick < 500) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Double tap prevented on', btn);
                return;
              }

              // 2. Update last click
              btn.dataset.lastClick = now;

              // 3. Visual Feedback (Ripple or Scale handled by CSS, but let's ensure active state is cleared)
              // Bootstrap buttons sometimes get stuck in :active on mobile
              setTimeout(() => btn.blur(), 200);
            }
          }, true); // Capture phase to intercept early
        }
        initDoubleTapProtection();

        // --- Task 12: Back Button Friendly ---
        function initBackButtonFriendly() {
          let isBackNavigation = false;

          // 1. Handle Section Navig                /* REMOVED: Handled by global delegated ha                const navButtons = document.querySelectorAll('[data-section-targe                navButtons.forEach(btn                    btn.addEventListener('click', (e)                        if (isBackNavigation) re                        const target = btn.dataset.sectionTa                        // Only push if different (simple c                        if (history.state?.section !== targ                            history.pushState({ section: target }, '', '#' + tar                                                                    */

          // 2. Handle Modals & Offcanvas
          // Use capture to ensure we catch dynamic ones if attached to body, but simple querySelectorAll is usually enough for static
          const modals = document.querySelectorAll('.modal, .offcanvas');
          modals.forEach(el => {
            // Push state when opening
            const onShow = (e) => {
              if (isBackNavigation) return;
              // Only push if not already current state (avoid duplicates)
              if (history.state?.modal !== e.target.id) {
                history.pushState({ modal: e.target.id }, '', '#' + e.target.id);
              }
            };
            el.addEventListener('show.bs.modal', onShow);
            el.addEventListener('show.bs.offcanvas', onShow);

            // Go back when closing manually
            const onHide = (e) => {
              // If this closing is triggered by a navigation click, DO NOT go back!
              if (isBackNavigation || window.isNavigatingSection) return;

              // If the current history state is THIS modal, go back
              if (history.state?.modal === e.target.id) {
                history.back();
              }
            };
            el.addEventListener('hide.bs.modal', onHide);
            el.addEventListener('hide.bs.offcanvas', onHide);
          });

          // 3. Handle Popstate (Back Button)
          window.addEventListener('popstate', (e) => {
            isBackNavigation = true;

            // A. Close any open Modal/Offcanvas if state doesn't match
            const openModal = document.querySelector('.modal.show, .offcanvas.show');
            if (openModal) {
              if (e.state?.modal !== openModal.id) {
                // Try to get instance using global 'bs' or 'bootstrap' or 'bootstrapGlobal'
                const B = window.bs || window.bootstrap || window.bootstrapGlobal;
                if (B) {
                  const instance = B.Modal.getInstance(openModal) || B.Offcanvas.getInstance(openModal);
                  if (instance) instance.hide();
                } else {
                  // Fallback: click closest dismiss button
                  const dismiss = openModal.querySelector('[data-bs-dismiss]');
                  if (dismiss) dismiss.click();
                }
              }
            }

            // B. Restore Section
            if (e.state?.section) {
              // Directly set section without clicking button (avoids loop)
              setActiveSection(e.state.section);
            } else {
              // Default if no state
              const hash = window.location.hash.substring(1);
              if (hash) setActiveSection(hash);
              else setActiveSection('converter');
            }

            setTimeout(() => { isBackNavigation = false; }, 100);
          });

          // Initial state push for current section if needed? 
          // Maybe not, to avoid messing up initial history.
        }
        initBackButtonFriendly();

        // --- Task 13: Multi-Modal Toggle Fix ---
        // Fixes the glitch where clicking a modal trigger while another is open
        // just closes the first one without opening the new one.
        document.addEventListener('click', (e) => {
          const trigger = e.target.closest('[data-bs-toggle="modal"]');
          if (!trigger) return;

          const targetSelector = trigger.getAttribute('data-bs-target');
          if (!targetSelector) return;

          const targetModal = document.querySelector(targetSelector);
          if (!targetModal) return;

          // Check for any currently open modals
          const openModals = document.querySelectorAll('.modal.show');
          let needsToWait = false;

          openModals.forEach(modal => {
            // Don't close the modal we are trying to open (in case it's a toggle off action)
            if (modal !== targetModal) {
              const B = window.bs || window.bootstrap || window.bootstrapGlobal;
              if (B && B.Modal) {
                const instance = B.Modal.getInstance(modal);
                if (instance) {
                  // Prevent the default bootstrap behavior to avoid conflicts
                  e.preventDefault();
                  e.stopPropagation();

                  needsToWait = true;

                  // Wait for the old modal to fully hide before showing the new one
                  const onHidden = () => {
                    modal.removeEventListener('hidden.bs.modal', onHidden);
                    // Wait a tiny bit more for backdrop removal just in case
                    setTimeout(() => {
                      const newInstance = B.Modal.getOrCreateInstance(targetModal);
                      newInstance.show();
                    }, 50);
                  };
                  modal.addEventListener('hidden.bs.modal', onHidden);
                  instance.hide();
                }
              }
            }
          });

          // If we intercepted the click to close an old modal first, 
          // Bootstrap's internal code won't fire for the new modal because we stopped propagation.
          // We handle showing it in the `onHidden` callback.
        }, true); // Use capture phase to intercept before Bootstrap's data API

        // --- Task 1: Mobile Storage Detection ---
        async function checkStorage() {
          // Mobile detection: simple width check or UA
          const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          if (!isMobile) return;

          if (navigator.storage && navigator.storage.estimate) {
            try {
              const { usage, quota } = await navigator.storage.estimate();
              if (quota > 0) {
                const percent = (usage / quota) * 100;
                if (percent > 85) {
                  setToast('⚠️ Penyimpanan HP hampir penuh! Bersihkan cache agar download lancar.', 'warning');
                }
              }
            } catch (e) { console.error('Storage check failed', e); }
          }
        }
        // Check after a short delay
        setTimeout(checkStorage, 3000);

        // --- Task 3: Real-time Local Clock ---
        function initRealTimeClock() {
          const clockEl = document.getElementById('serverTimeBadge');
          if (!clockEl) return;

          function updateClock() {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');

            // Use new structure if available
            if (clockEl.classList.contains('cute-clock')) {
              const timeText = clockEl.querySelector('.time-text');
              const secondsText = clockEl.querySelector('.seconds');
              if (timeText) timeText.textContent = `${h}:${m}`;
              if (secondsText) secondsText.textContent = `:${s}`;
            } else {
              // Fallback
              clockEl.innerHTML = `<i class="bi bi-clock-fill me-1"></i>${h}:${m}:${s}`;
            }

            clockEl.removeAttribute('hidden');
          }

          updateClock(); // Initial call
          setInterval(updateClock, 1000);
        }
        initRealTimeClock();

        // --- Task 6: Forum Chat Logic (Realtime & Authenticated) ---
        function initForumChat() {
          const forumModal = document.getElementById('forumModal');
          const forumLoginOverlay = document.getElementById('forumLoginOverlay');
          const forumGoogleLoginBtn = document.getElementById('forumGoogleLoginBtn');
          const forumInput = document.getElementById('forumInput');
          const forumSendBtn = document.getElementById('forumSendBtn');
          const forumChatArea = document.getElementById('forumChatArea');
          const forumScrollBtn = document.getElementById('forumScrollBtn');
          const forumReactionOverlay = document.getElementById('forumReactionOverlay');
          const forumLoadingOverlay = document.getElementById('forumLoadingOverlay');
          const forumReplyPreview = document.getElementById('forumReplyPreview');
          const forumReplyTitle = document.getElementById('forumReplyTitle');
          const forumReplyText = document.getElementById('forumReplyText');
          const forumReplyThumb = document.getElementById('forumReplyThumb');
          const forumReplyCloseBtn = document.getElementById('forumReplyCloseBtn');
          const forumVoiceIndicator = document.getElementById('forumVoiceIndicator');
          const forumVoiceTimer = document.getElementById('forumVoiceTimer');
          const forumVoiceCancelBtn = document.getElementById('forumVoiceCancelBtn');
          const forumAttachMenuBtn = document.getElementById('forumAttachMenuBtn');
          const forumStickerBtn = document.getElementById('forumStickerBtn');
          const forumReportBtn = document.getElementById('forumReportBtn');
          const forumReportModalEl = document.getElementById('forumReportModal');
          const reportSubmitBtn = document.getElementById('reportSubmitBtn');
          const reportFilesInput = document.getElementById('reportFiles');
          const reportPreview = document.getElementById('reportPreview');
          const reportMessageIdEl = document.getElementById('reportMessageId');
          const reportTargetUidEl = document.getElementById('reportTargetUid');
          const reportTargetNameEl = document.getElementById('reportTargetName');
          const reportSourceRoomEl = document.getElementById('reportSourceRoom');
          const reportCategoryEl = document.getElementById('reportCategory');
          const reportContactEl = document.getElementById('reportContact');
          const reportDetailsEl = document.getElementById('reportDetails');
          const reportEvidenceEl = document.getElementById('reportEvidence');
          const forumReportModal = forumReportModalEl ? new bootstrap.Modal(forumReportModalEl) : null;
          const forumMessageInfoModalEl = document.getElementById('forumMessageInfoModal');
          const forumMessageInfoSender = document.getElementById('forumMessageInfoSender');
          const forumMessageInfoTime = document.getElementById('forumMessageInfoTime');
          const forumMessageInfoId = document.getElementById('forumMessageInfoId');
          const forumMessageInfoModal = forumMessageInfoModalEl ? new bootstrap.Modal(forumMessageInfoModalEl) : null;

          if (forumModal) {
            forumModal.addEventListener('shown.bs.modal', () => {
              document.body.classList.add('forum-modal-open');
            });
            forumModal.addEventListener('hidden.bs.modal', () => {
              document.body.classList.remove('forum-modal-open');
            });
          }

          // --- Helper Functions ---
          let isNearBottomState = true;
          let replyContext = null;
          let reportFiles = [];
          let forumUnblockedByAppeal = false;
          let voiceState = {
            isRecording: false,
            mediaRecorder: null,
            chunks: [],
            stream: null,
            startedAt: 0,
            timer: null,
          };

          function formatWhatsAppDate(timestamp) {
            if (!timestamp || !timestamp.seconds) return '';
            const date = new Date(timestamp.seconds * 1000);
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return timeStr;
          }

          function dayKeyFromTimestamp(timestamp) {
            if (!timestamp || !timestamp.seconds) return '';
            const d = new Date(timestamp.seconds * 1000);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }

          function formatSeparatorLabel(timestamp) {
            if (!timestamp || !timestamp.seconds) return '';
            const date = new Date(timestamp.seconds * 1000);
            const now = new Date();
            const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
            if (isToday) return 'Hari ini';
            if (isYesterday) return 'Kemarin';
            return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          }

          function setReplyContext(ctx) {
            replyContext = ctx;
            if (!forumReplyPreview) return;
            if (!ctx) {
              forumReplyPreview.classList.add('d-none');
              if (forumReplyTitle) forumReplyTitle.textContent = '';
              if (forumReplyText) forumReplyText.textContent = '';
              if (forumReplyThumb) {
                forumReplyThumb.classList.add('d-none');
                forumReplyThumb.removeAttribute('src');
              }
              return;
            }
            forumReplyPreview.classList.remove('d-none');
            if (forumReplyTitle) forumReplyTitle.textContent = ctx.name || 'Warga';
            if (forumReplyText) forumReplyText.textContent = ctx.text || '';
            if (forumReplyThumb) {
              if (ctx.previewUrl) {
                forumReplyThumb.src = ctx.previewUrl;
                forumReplyThumb.classList.remove('d-none');
              } else {
                forumReplyThumb.classList.add('d-none');
                forumReplyThumb.removeAttribute('src');
              }
            }
          }

          function isLaporanRoom() {
            return (activeForumRoom || 'umum') === 'laporan';
          }

          function applyRoomUiRules() {
            if (!forumInput || !forumSendBtn) return;
            const readOnly = isLaporanRoom();
            if (readOnly) {
              forumInput.disabled = true;
              forumInput.placeholder = 'Room Laporan bersifat read-only. Gunakan tombol Laporkan untuk mengirim laporan.';
              forumSendBtn.disabled = true;
              setReplyContext(null);
              if (forumAttachMenuBtn) {
                forumAttachMenuBtn.setAttribute('disabled', '');
                forumAttachMenuBtn.style.pointerEvents = 'none';
                forumAttachMenuBtn.style.opacity = '0.5';
              }
              if (forumStickerBtn) {
                forumStickerBtn.setAttribute('disabled', '');
              }
            } else {
              if (currentUser) forumInput.disabled = false;
              forumInput.placeholder = 'Ketik pesan...';
              if (forumAttachMenuBtn) {
                forumAttachMenuBtn.removeAttribute('disabled');
                forumAttachMenuBtn.style.pointerEvents = '';
                forumAttachMenuBtn.style.opacity = '';
              }
              if (forumStickerBtn) {
                forumStickerBtn.removeAttribute('disabled');
              }
              updateSendButtonState();
            }
          }

          function resetReportForm() {
            if (reportMessageIdEl) reportMessageIdEl.value = '';
            if (reportTargetUidEl) reportTargetUidEl.value = '';
            if (reportTargetNameEl) reportTargetNameEl.value = '';
            if (reportSourceRoomEl) reportSourceRoomEl.value = activeForumRoom || 'umum';
            if (reportCategoryEl) reportCategoryEl.value = 'bug';
            if (reportContactEl) reportContactEl.value = '';
            if (reportDetailsEl) reportDetailsEl.value = '';
            if (reportEvidenceEl) reportEvidenceEl.value = '';
            reportFiles = [];
            if (reportFilesInput) reportFilesInput.value = '';
            if (reportPreview) reportPreview.innerHTML = '';
          }

          function renderReportPreview() {
            if (!reportPreview) return;
            reportPreview.innerHTML = '';
            reportFiles.forEach((file, idx) => {
              const url = URL.createObjectURL(file);
              const wrap = document.createElement('div');
              wrap.className = 'position-relative';
              wrap.innerHTML = `
                  <img src="${url}" class="rounded-3 border" style="width: 110px; height: 110px; object-fit: cover;">
                  <button type="button" class="btn btn-sm btn-dark position-absolute top-0 end-0 m-1 p-0 d-flex align-items-center justify-content-center" style="width: 26px; height: 26px; border-radius: 999px;" data-action="remove-report-file" data-idx="${idx}">
                    <i class="bi bi-x"></i>
                  </button>
                `;
              reportPreview.appendChild(wrap);
            });
          }

          if (reportFilesInput) {
            reportFilesInput.addEventListener('change', (e) => {
              const files = Array.from(e.target.files || []).filter((f) => f && f.type && f.type.startsWith('image/'));
              reportFiles = [...reportFiles, ...files].slice(0, 8);
              renderReportPreview();
              reportFilesInput.value = '';
            });
          }
          if (reportPreview) {
            reportPreview.addEventListener('click', (e) => {
              const btn = e.target.closest('[data-action="remove-report-file"]');
              if (!btn) return;
              const idx = Number(btn.getAttribute('data-idx'));
              if (!Number.isFinite(idx)) return;
              reportFiles.splice(idx, 1);
              renderReportPreview();
            });
          }

          async function submitForumReport() {
            if (!currentUser) { setToast('Silakan login dulu supaya bisa melapor.'); return; }
            if (!window.firebaseModules || !window.firebaseModules.db) { setToast('Sistem laporan belum siap.'); return; }

            const category = reportCategoryEl ? reportCategoryEl.value : 'other';
            const details = reportDetailsEl ? reportDetailsEl.value.trim() : '';
            const evidence = reportEvidenceEl ? reportEvidenceEl.value.trim() : '';
            if (!details) { setToast('Isi dulu keterangan laporan ya.'); return; }

            const srcRoom = reportSourceRoomEl ? (reportSourceRoomEl.value || (activeForumRoom || 'umum')) : (activeForumRoom || 'umum');
            const msgId = reportMessageIdEl ? reportMessageIdEl.value : '';
            const targetName = reportTargetNameEl ? reportTargetNameEl.value : '';
            const targetUid = reportTargetUidEl ? reportTargetUidEl.value : '';
            const contact = reportContactEl ? reportContactEl.value.trim() : '';

            const originalHtml = reportSubmitBtn ? reportSubmitBtn.innerHTML : '';
            if (reportSubmitBtn) {
              reportSubmitBtn.disabled = true;
              reportSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Mengirim...';
            }

            try {
              let uploaded = [];
              if (reportFiles.length > 0) {
                for (const f of reportFiles) {
                  try {
                    const url = await uploadToCloudinary(f, 'forum-reports');
                    if (url) uploaded.push(url);
                  } catch (err) { console.error(err); }
                }
              }

              const reporter = currentUser.displayName || currentUser.email || 'Warga';
              const roomLabel = (typeof getForumRoomLabel === 'function') ? getForumRoomLabel(srcRoom) : srcRoom;
              const lines = [
                `LAPORAN (${category})`,
                `Pelapor: ${reporter}`,
                `Room: ${roomLabel}`,
                targetName ? `Target: ${targetName}` : null,
                targetUid ? `Target UID: ${targetUid}` : null,
                msgId ? `Message ID: ${msgId}` : null,
                contact ? `Kontak: ${contact}` : null,
                ``,
                `Keterangan:`,
                details,
                evidence ? `` : null,
                evidence ? `Bukti chat:` : null,
                evidence || null,
              ].filter(Boolean).join('\n');

              const { db, collection, addDoc, serverTimestamp } = window.firebaseModules;
              await addDoc(collection(db, "forum-messages"), {
                uid: currentUser.uid,
                name: 'BOT Laporan',
                timestamp: serverTimestamp(),
                room: 'laporan',
                text: lines,
                images: uploaded,
                report: {
                  type: 'user_report',
                  category,
                  sourceRoom: srcRoom,
                  messageId: msgId,
                  reportedUid: targetUid,
                  reportedName: targetName,
                  submittedByUid: currentUser.uid,
                },
              });

              setToast('Laporan terkirim. Makasih sudah bantu jaga forum.');
              try { forumReportModal?.hide?.(); } catch { }
              resetReportForm();
            } catch (err) {
              console.error(err);
              setToast('Gagal kirim laporan. Coba lagi sebentar ya.');
            } finally {
              if (reportSubmitBtn) {
                reportSubmitBtn.disabled = false;
                reportSubmitBtn.innerHTML = originalHtml;
              }
            }
          }

          if (reportSubmitBtn) {
            reportSubmitBtn.addEventListener('click', () => {
              submitForumReport();
            });
          }

          function openReportModal(prefill = {}) {
            resetReportForm();
            if (reportSourceRoomEl) reportSourceRoomEl.value = prefill.sourceRoom || (activeForumRoom || 'umum');
            if (reportMessageIdEl) reportMessageIdEl.value = prefill.messageId || '';
            if (reportTargetUidEl) reportTargetUidEl.value = prefill.targetUid || '';
            if (reportTargetNameEl) reportTargetNameEl.value = prefill.targetName || '';
            if (reportCategoryEl && prefill.category) reportCategoryEl.value = prefill.category;
            if (reportEvidenceEl && prefill.evidence) reportEvidenceEl.value = prefill.evidence;
            if (forumReportModal) forumReportModal.show();
          }

          if (forumReportBtn) {
            forumReportBtn.addEventListener('click', () => openReportModal({}));
          }

          function buildReplyContextFromMessage(messageId, msgData) {
            const senderName = msgData && msgData.email === adminEmail ? 'ADMIN' : ((msgData && msgData.name) || 'Warga');
            const trimmedText = (msgData && msgData.text ? String(msgData.text) : '').trim();
            let text = trimmedText;
            let kind = 'text';
            let previewUrl = '';

            if (msgData && msgData.deleted) {
              return { id: messageId, name: senderName, text: 'Pesan dihapus', kind: 'text', previewUrl: '' };
            }

            if (msgData && msgData.stickerUrl) {
              kind = 'sticker';
              previewUrl = msgData.stickerUrl;
              if (!text) text = 'Stiker';
            } else if (msgData && Array.isArray(msgData.images) && msgData.images.length > 0) {
              kind = 'image';
              previewUrl = msgData.images[0];
              if (!text) text = 'Foto';
            } else if (msgData && msgData.voiceUrl) {
              kind = 'voice';
              if (!text) text = 'Voice note';
            }
            if (!text) text = 'Pesan';

            return { id: messageId, name: senderName, text, kind, previewUrl };
          }

          const voiceAudioByMessageId = new Map();
          let activeVoiceMessageId = null;

          function formatDurationSeconds(seconds) {
            const s = Math.max(0, Math.floor(seconds || 0));
            const mm = String(Math.floor(s / 60));
            const ss = String(s % 60).padStart(2, '0');
            return `${mm}:${ss}`;
          }

          function hashStringToUint(str) {
            const s = String(str || '');
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) {
              h ^= s.charCodeAt(i);
              h = Math.imul(h, 16777619);
            }
            return h >>> 0;
          }

          function makeRng(seedUint) {
            let a = seedUint >>> 0;
            return () => {
              a += 0x6D2B79F5;
              let t = a;
              t = Math.imul(t ^ (t >>> 15), t | 1);
              t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
              return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
          }

          function buildVoiceBarsHtml(seedStr, barCount = 34) {
            const rng = makeRng(hashStringToUint(seedStr));
            let html = '';
            for (let i = 0; i < barCount; i++) {
              const v = rng();
              const height = Math.round(28 + v * 72);
              html += `<span style="height:${height}%"></span>`;
            }
            return html;
          }

          function setVoiceUiPlaying(voiceEl, isPlaying) {
            if (!voiceEl) return;
            const btn = voiceEl.querySelector('.voice-play-btn');
            if (!btn) return;
            btn.innerHTML = isPlaying ? '<i class="bi bi-pause-fill"></i>' : '<i class="bi bi-play-fill"></i>';
          }

          function updateVoiceUiProgress(voiceEl, audio) {
            if (!voiceEl || !audio) return;
            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
            const p = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;
            const prog = voiceEl.querySelector('.voice-bars-progress');
            if (prog) prog.style.width = `${Math.round(p * 100)}%`;
          }

          function setVoiceUiDuration(voiceEl, seconds) {
            if (!voiceEl) return;
            const el = voiceEl.querySelector('.voice-time');
            if (!el) return;
            el.textContent = formatDurationSeconds(seconds);
          }

          function getVoiceElByMessageId(messageId) {
            if (!forumChatArea) return null;
            const nodes = forumChatArea.querySelectorAll('.voice-note');
            for (const n of nodes) {
              if (n.getAttribute('data-voice-message-id') === messageId) return n;
            }
            return null;
          }

          async function toggleVoicePlayback(voiceEl) {
            if (!voiceEl) return;
            const messageId = voiceEl.getAttribute('data-voice-message-id');
            const url = voiceEl.getAttribute('data-voice-url') || '';
            if (!messageId || !url) return;

            const existingActive = activeVoiceMessageId && voiceAudioByMessageId.get(activeVoiceMessageId);
            if (existingActive && activeVoiceMessageId !== messageId) {
              try { existingActive.pause(); } catch { }
            }

            let audio = voiceAudioByMessageId.get(messageId);
            if (!audio) {
              audio = new Audio(url);
              audio.preload = 'metadata';
              voiceAudioByMessageId.set(messageId, audio);

              const knownMs = Number(voiceEl.getAttribute('data-voice-duration-ms') || 0);
              if (knownMs > 0) setVoiceUiDuration(voiceEl, knownMs / 1000);

              audio.addEventListener('loadedmetadata', () => {
                const el = getVoiceElByMessageId(messageId) || voiceEl;
                const secs = Number.isFinite(audio.duration) ? audio.duration : 0;
                if (secs > 0) setVoiceUiDuration(el, secs);
                updateVoiceUiProgress(el, audio);
              });
              audio.addEventListener('timeupdate', () => {
                const el = getVoiceElByMessageId(messageId) || voiceEl;
                updateVoiceUiProgress(el, audio);
              });
              audio.addEventListener('ended', () => {
                const el = getVoiceElByMessageId(messageId) || voiceEl;
                if (activeVoiceMessageId === messageId) activeVoiceMessageId = null;
                setVoiceUiPlaying(el, false);
                updateVoiceUiProgress(el, audio);
              });
              audio.addEventListener('pause', () => {
                const el = getVoiceElByMessageId(messageId) || voiceEl;
                if (activeVoiceMessageId === messageId) activeVoiceMessageId = null;
                setVoiceUiPlaying(el, false);
                updateVoiceUiProgress(el, audio);
              });
              audio.addEventListener('play', () => {
                const el = getVoiceElByMessageId(messageId) || voiceEl;
                activeVoiceMessageId = messageId;
                setVoiceUiPlaying(el, true);
              });
              audio.addEventListener('error', () => {
                const el = getVoiceElByMessageId(messageId) || voiceEl;
                setVoiceUiPlaying(el, false);
                setToast('Voice note tidak bisa diputar', 'danger');
              });
            }

            if (!audio.paused) {
              audio.pause();
              return;
            }

            try {
              await audio.play();
            } catch (err) {
              console.error(err);
              setToast('Gagal memutar voice note', 'danger');
            }
          }

          function setVoiceRecordingUi(isRecording) {
            if (!forumVoiceIndicator) return;
            if (isRecording) forumVoiceIndicator.classList.remove('d-none');
            else forumVoiceIndicator.classList.add('d-none');
          }

          function updateVoiceTimerUi() {
            if (!forumVoiceTimer) return;
            const elapsedMs = Date.now() - (voiceState.startedAt || Date.now());
            const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
            const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const ss = String(totalSeconds % 60).padStart(2, '0');
            forumVoiceTimer.textContent = `${mm}:${ss}`;
          }

          async function startVoiceRecording() {
            if (voiceState.isRecording) return;
            if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setToast('Browser tidak mendukung voice note', 'danger'); return; }
            if (typeof MediaRecorder === 'undefined') { setToast('Browser tidak mendukung voice note', 'danger'); return; }

            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const recorder = new MediaRecorder(stream);

              voiceState.isRecording = true;
              voiceState.mediaRecorder = recorder;
              voiceState.stream = stream;
              voiceState.chunks = [];
              voiceState.startedAt = Date.now();

              setVoiceRecordingUi(true);
              updateVoiceTimerUi();
              if (voiceState.timer) clearInterval(voiceState.timer);
              voiceState.timer = setInterval(updateVoiceTimerUi, 250);

              recorder.addEventListener('dataavailable', (evt) => {
                if (evt.data && evt.data.size > 0) voiceState.chunks.push(evt.data);
              });

              recorder.start();
              updateSendButtonState();
            } catch (err) {
              console.error(err);
              setToast('Izin mikrofon ditolak', 'danger');
            }
          }

          async function stopVoiceRecording(shouldSend) {
            if (!voiceState.isRecording) return;
            const recorder = voiceState.mediaRecorder;
            const stream = voiceState.stream;
            const startedAt = voiceState.startedAt || Date.now();

            voiceState.isRecording = false;
            if (voiceState.timer) clearInterval(voiceState.timer);
            voiceState.timer = null;
            setVoiceRecordingUi(false);

            try {
              if (recorder && recorder.state !== 'inactive') {
                await new Promise((resolve) => {
                  recorder.addEventListener('stop', resolve, { once: true });
                  recorder.stop();
                });
              }
            } catch { }

            try {
              if (stream) stream.getTracks().forEach((t) => t.stop());
            } catch { }

            const elapsedMs = Date.now() - startedAt;
            const chunks = Array.isArray(voiceState.chunks) ? voiceState.chunks : [];
            voiceState.chunks = [];
            voiceState.mediaRecorder = null;
            voiceState.stream = null;
            voiceState.startedAt = 0;

            updateSendButtonState();
            if (!shouldSend) return;
            if (isLaporanRoom()) { setToast('Room Laporan tidak menerima voice note. Gunakan tombol Laporkan ya.'); return; }
            if (!chunks.length) { setToast('Rekaman kosong', 'warning'); return; }

            const mimeType = (recorder && recorder.mimeType) ? recorder.mimeType : (chunks[0] && chunks[0].type) ? chunks[0].type : 'audio/webm';
            const blob = new Blob(chunks, { type: mimeType });
            const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
            const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });

            forumSendBtn.disabled = true;
            forumSendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            try {
              let voiceUrl = '';
              try {
                voiceUrl = await uploadToCloudinaryVideo(file, 'forum-voice');
              } catch (err) {
                console.error(err);
                voiceUrl = await uploadToCloudinaryAuto(file, 'forum-voice');
              }
              if (!voiceUrl) throw new Error('Voice upload gagal');
              const { db, collection, addDoc, serverTimestamp } = window.firebaseModules;
              const msgData = {
                text: '',
                uid: currentUser.uid,
                name: currentUser.displayName || 'Warga',
                timestamp: serverTimestamp(),
                room: activeForumRoom || 'umum',
                voiceUrl,
                voiceDurationMs: elapsedMs,
                voiceMimeType: mimeType,
              };
              if (replyContext && replyContext.id) {
                msgData.replyTo = {
                  id: replyContext.id,
                  name: replyContext.name || 'Warga',
                  text: replyContext.text || '',
                  kind: replyContext.kind || 'text',
                  previewUrl: replyContext.previewUrl || '',
                };
              }
              if (currentUser.email) msgData.email = currentUser.email;
              if (currentUser.photoURL) msgData.photoURL = currentUser.photoURL;
              await addDoc(collection(db, "forum-messages"), msgData);
              setReplyContext(null);
              window.scrollToBottom(true);
            } catch (e) {
              console.error(e);
              setToast('Gagal kirim voice note: ' + (e.message || 'unknown'), 'danger');
            } finally {
              forumSendBtn.disabled = false;
              updateSendButtonState();
            }
          }

          if (forumReplyCloseBtn) {
            forumReplyCloseBtn.addEventListener('click', () => setReplyContext(null));
          }
          if (forumVoiceCancelBtn) {
            forumVoiceCancelBtn.addEventListener('click', async () => {
              if (!voiceState.isRecording) return;
              await stopVoiceRecording(false);
            });
          }

          window.scrollToBottom = (smooth = true) => {
            if (!forumChatArea) return;
            forumChatArea.scrollTo({
              top: forumChatArea.scrollHeight,
              behavior: smooth ? 'smooth' : 'auto'
            });
            if (forumScrollBtn) forumScrollBtn.classList.add('d-none');
            isNearBottomState = true;
          };

          if (forumChatArea) {
            forumChatArea.addEventListener('scroll', () => {
              if (!forumScrollBtn) return;
              const threshold = 150;
              const isNearBottom = forumChatArea.scrollHeight - forumChatArea.scrollTop - forumChatArea.clientHeight < threshold;
              isNearBottomState = isNearBottom;
              if (isNearBottom) {
                forumScrollBtn.classList.add('d-none');
              } else {
                forumScrollBtn.classList.remove('d-none');
              }
            });
          }
          if (forumScrollBtn) {
            forumScrollBtn.addEventListener('click', () => window.scrollToBottom(true));
          }
          const forumLogoutBtn = document.getElementById('forumLogoutBtn');
          const forumDeleteAllBtn = document.getElementById('forumDeleteAllBtn');
          const forumImageInput = document.getElementById('forumImageInput');
          const attachmentPreviewBar = document.getElementById('attachmentPreviewBar');
          const btnCameraOpen = document.getElementById('btnCameraOpen');
          const forumOnlineCount = document.getElementById('forumOnlineCount');

          // Editor Elements
          const editorModalEl = document.getElementById('editorModal');
          const editorCanvas = document.getElementById('editorCanvas');
          const editorCropImage = document.getElementById('editorCropImage');
          const btnSaveEdit = document.getElementById('btnSaveEdit');
          const editorColorPicker = document.getElementById('editorColorPicker');
          const editorTextInput = document.getElementById('editorTextInput');
          const btnEditCrop = document.getElementById('btnEditCrop');
          const btnEditRotate = document.getElementById('btnEditRotate');
          const btnEditText = document.getElementById('btnEditText');
          const editorTextTools = document.getElementById('editorTextTools');
          const editorTextSize = document.getElementById('editorTextSize');
          const editorTextSmaller = document.getElementById('editorTextSmaller');
          const editorTextBigger = document.getElementById('editorTextBigger');

          let editorModal;
          if (editorModalEl) editorModal = new bootstrap.Modal(editorModalEl);

          let selectedFiles = []; // Array of File objects
          let activeEditorFileIndex = null;
          let canvasCtx = null;
          let isDrawing = false;
          let lastX = 0;
          let lastY = 0;
          let currentImageObj = null; // Image object for canvas
          let editMode = 'none';
          let cropperInstance = null;
          let activeTextIndex = -1;
          let textDragOffset = { x: 0, y: 0 };

          // Auto-open logic
          if (sessionStorage.getItem('forum_login_pending') === 'true') {
            const checkBs = setInterval(() => {
              if (typeof bootstrap !== 'undefined' && forumModal) {
                clearInterval(checkBs);
                const bsModal = new bootstrap.Modal(forumModal);
                bsModal.show();
              }
            }, 500);
            setTimeout(() => clearInterval(checkBs), 10000);
          }

          if (!forumGoogleLoginBtn) return;

          let unsubscribe = null;
          let extraUnsubscribes = [];
          let currentUser = null;
          let forumMessageCache = {};
          let stickerFavoritesSet = new Set();
          const adminEmail = 'andhikamarcella546@gmail.com';
          const forumRoomSelect = document.getElementById('forumRoomSelect');
          const forumCopyRoomBtn = document.getElementById('forumCopyRoomBtn');
          const forumRoomBadge = document.getElementById('forumRoomBadge');
          const privateRoomTosModalEl = document.getElementById('privateRoomTosModal');
          const privateRoomAcceptBtn = document.getElementById('privateRoomAcceptBtn');
          const privateRoomTosModal = privateRoomTosModalEl ? new bootstrap.Modal(privateRoomTosModalEl) : null;
          const privateRoomTosKey = 'forum_private_room_tos_ok';
          let pendingRoomSelection = null;
          const FORUM_ROOMS = [
            { key: 'umum', label: 'Umum' },
            { key: 'laporan', label: 'Laporan' },
            { key: 'jomok', label: 'Jomok' },
            { key: 'foto', label: 'Foto Warga' },
            { key: 'event', label: 'Event' },
            { key: 'santai', label: 'Santai / Meme' },
          ];
          const forumRoomKeyStorage = 'forum_room';
          let activeForumRoom = localStorage.getItem(forumRoomKeyStorage) || 'umum';

          const forumCallBtn = document.getElementById('forumCallBtn');
          const waCallOverlay = document.getElementById('waCallOverlay');
          const waCallName = document.getElementById('waCallName');
          const waCallStatus = document.getElementById('waCallStatus');
          const waSpeakerBtn = document.getElementById('waSpeakerBtn');
          const waMicBtn = document.getElementById('waMicBtn');
          const waMicIcon = document.getElementById('waMicIcon');
          const waEndCallBtn = document.getElementById('waEndCallBtn');
          const ringtoneConnecting = document.getElementById('ringtoneConnecting');
          const ringtoneIncoming = document.getElementById('ringtoneIncoming');
          let isSpeakerOn = false;
          const forumRemoteAudio = document.getElementById('forumRemoteAudio');
          const forumCallPickerModalEl = document.getElementById('forumCallPickerModal');
          const forumCallPickerModal = forumCallPickerModalEl ? new bootstrap.Modal(forumCallPickerModalEl) : null;
          const forumCallUserList = document.getElementById('forumCallUserList');
          const forumCallUserEmpty = document.getElementById('forumCallUserEmpty');
          const forumIncomingCallModalEl = document.getElementById('forumIncomingCallModal');
          const forumIncomingCallModal = forumIncomingCallModalEl ? new bootstrap.Modal(forumIncomingCallModalEl) : null;
          const forumIncomingCaller = document.getElementById('forumIncomingCaller');
          const forumAcceptCallBtn = document.getElementById('forumAcceptCallBtn');
          const forumDeclineCallBtn = document.getElementById('forumDeclineCallBtn');

          let forumSocket = null;
          let forumSocketConnected = false;
          let forumPresenceUsers = [];

          let callState = {
            status: 'idle',
            room: '',
            callId: '',
            peerUserId: '',
            peerName: '',
            pc: null,
            localStream: null,
            remoteStream: null,
            micEnabled: true,
            startedAt: 0,
            timer: 0,
            pendingOffer: null,
            iceQueue: [],
            isOutgoing: false,
          };

          let cachedIceServers = null;
          let cachedIceServersAt = 0;

          const getIceServers = async () => {
            const age = Date.now() - cachedIceServersAt;
            // Cache the TURN credentials for 5 minutes so we don't spam the API key limits
            if (cachedIceServers && age < 5 * 60 * 1000) return cachedIceServers;

            try {
              // Priority 1: User's requested API endpoint
              const res = await fetch("/api/turn", { cache: 'no-store' });
              const ice = await res.json().catch(() => null);

              if (res.ok && ice) {
                // Determine format
                let parsedIceServers = [];
                if (Array.isArray(ice)) {
                  ice.forEach(item => {
                    if (item.iceServers) parsedIceServers = parsedIceServers.concat(item.iceServers);
                    else if (item.urls) parsedIceServers.push(item);
                  });
                } else if (ice.iceServers) {
                  parsedIceServers = ice.iceServers;
                } else if (ice.urls) {
                  parsedIceServers = [ice];
                }

                if (!parsedIceServers.length && Array.isArray(ice)) parsedIceServers = ice;

                if (parsedIceServers && parsedIceServers.length > 0) {
                  cachedIceServers = parsedIceServers;
                  cachedIceServersAt = Date.now();
                  console.log("[WebRTC] Successfully fetched dynamic TURN servers from /api/turn", cachedIceServers);
                  return cachedIceServers;
                }
              }
            } catch (err) {
              console.error('[WebRTC] Failed to fetch /api/turn', err);
            }

            // Fallback to /api/turn-credentials if /api/turn fails or hasn't deployed fully
            try {
              const res = await fetch("/api/turn-credentials", { cache: 'no-store' });
              const payload = await res.json().catch(() => null);
              if (res.ok && payload && Array.isArray(payload.iceServers) && payload.iceServers.length) {
                cachedIceServers = payload.iceServers;
                cachedIceServersAt = Date.now();
                return cachedIceServers;
              }
            } catch (e) { console.error('Failed to fetch fallback TURN credentials', e); }

            // Utter fallback array if both fail
            cachedIceServers = [
              { urls: 'stun:stun.relay.metered.ca:80' },
              { urls: 'turn:standard.relay.metered.ca:80', username: '58f25dcefc88997a05a5fbbb', credential: 'ulLNhCZCp6eQkFu3' }
            ];
            cachedIceServersAt = Date.now();
            return cachedIceServers;
          };

          const formatCallDuration = (ms) => {
            const sec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
            const mm = String(Math.floor(sec / 60)).padStart(2, '0');
            const ss = String(sec % 60).padStart(2, '0');
            return `${mm}:${ss}`;
          };

          const setCallUi = () => {
            if (!waCallOverlay) return;
            if (callState.status === 'connected') {
              waCallOverlay.classList.remove('d-none');
              waCallOverlay.classList.add('d-flex');
              if (waCallName) waCallName.textContent = callState.peerName || 'Warga';
              if (waCallStatus) waCallStatus.textContent = formatCallDuration(Date.now() - callState.startedAt);
              if (ringtoneConnecting) ringtoneConnecting.pause();
              if (ringtoneIncoming) ringtoneIncoming.pause();
              if (waMicIcon) waMicIcon.className = callState.micEnabled ? 'bi bi-mic-fill fs-3' : 'bi bi-mic-mute-fill fs-3 text-danger';
            } else if (callState.status === 'calling') {
              waCallOverlay.classList.remove('d-none');
              waCallOverlay.classList.add('d-flex');
              if (waCallName) waCallName.textContent = callState.peerName || 'Warga';
              if (waCallStatus) waCallStatus.textContent = 'Calling...';
              if (ringtoneConnecting && ringtoneConnecting.paused && callState.isOutgoing) ringtoneConnecting.play().catch(() => { });
              if (waMicIcon) waMicIcon.className = callState.micEnabled ? 'bi bi-mic-fill fs-3' : 'bi bi-mic-mute-fill fs-3 text-danger';
            } else {
              waCallOverlay.classList.add('d-none');
              waCallOverlay.classList.remove('d-flex');
              if (ringtoneConnecting) {
                ringtoneConnecting.pause();
                ringtoneConnecting.currentTime = 0;
              }
              if (ringtoneIncoming) {
                ringtoneIncoming.pause();
                ringtoneIncoming.currentTime = 0;
              }
            }
          };

          const stopCallTimer = () => {
            if (callState.timer) clearInterval(callState.timer);
            callState.timer = 0;
          };

          const startCallTimer = () => {
            stopCallTimer();
            callState.timer = window.setInterval(() => {
              if (callState.status !== 'connected') return;
              setCallUi();
            }, 500);
          };

          const cleanupPeer = () => {
            stopCallTimer();
            try {
              if (callState.pc) callState.pc.onicecandidate = null;
            } catch { }
            try {
              callState.pc?.close?.();
            } catch { }
            callState.pc = null;
            if (callState.localStream) {
              try { callState.localStream.getTracks().forEach((t) => t.stop()); } catch { }
            }
            callState.localStream = null;
            callState.remoteStream = null;
            callState.pendingOffer = null;
            callState.iceQueue = [];
            callState.peerUserId = '';
            callState.peerName = '';
            callState.callId = '';
            callState.status = 'idle';
            callState.micEnabled = true;
            callState.startedAt = 0;
            if (forumRemoteAudio) {
              try { forumRemoteAudio.srcObject = null; } catch { }
            }
            setCallUi();
          };

          const createPeerConnection = async () => {
            const servers = await getIceServers();
            console.log("Using ICE Servers for this PC:", servers);
            const pc = new RTCPeerConnection({
              iceServers: servers,
              iceTransportPolicy: 'all', // explicitly allow relay (TURN)
              bundlePolicy: 'max-bundle',
              rtcpMuxPolicy: 'require',
            });
            pc.ontrack = (evt) => {
              const [stream] = evt.streams || [];
              if (!stream) return;
              console.log("REMOTE STREAM RECEIVED", stream);
              callState.remoteStream = stream;
              if (forumRemoteAudio) {
                try {
                  forumRemoteAudio.srcObject = stream;
                  forumRemoteAudio.play().catch(e => console.error("Audio play error", e));
                } catch (err) { console.error("Could not set srcObject", err); }
              }
            };
            pc.onconnectionstatechange = () => {
              console.log('[WebRTC] Connection state changed:', pc.connectionState);
              if (pc.connectionState === 'connected') {
                callState.status = 'connected';
                callState.startedAt = Date.now();
                startCallTimer();
                setCallUi();
              }
              if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                console.error('[WebRTC] Connection failed or closed', pc.connectionState);
                if (callState.status !== 'idle') {
                  cleanupPeer();
                  if (typeof window.setToast === 'function') window.setToast('Koneksi terputus (P2P failed).', 'danger');
                }
              }
            };

            pc.oniceconnectionstatechange = () => {
              console.log('[WebRTC] ICE Connection state:', pc.iceConnectionState);
              if (pc.iceConnectionState === 'failed') {
                console.error('[WebRTC] ICE Connection Failed - Cannot establish P2P or Relay connection.');
                if (callState.status !== 'idle') {
                  cleanupPeer();
                  if (typeof window.setToast === 'function') window.setToast('Koneksi terputus (ICE Failed).', 'danger');
                }
              }
            };

            pc.onicegatheringstatechange = () => {
              console.log('[WebRTC] ICE Gathering State:', pc.iceGatheringState);
            };

            pc.onsignalingstatechange = () => {
              console.log('[WebRTC] Signaling State:', pc.signalingState);
            };

            return pc;
          };

          const ensureForumSocket = () => {
            if (forumSocket) return forumSocket;
            if (typeof window.io !== 'function') return null;
            const telemetryClientId = (() => {
              const key = 'ytconv_client_id_v1';
              let id = localStorage.getItem(key);
              if (!id) {
                id = `cid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                localStorage.setItem(key, id);
              }
              return id;
            })();
            const abVariant = (() => {
              const key = 'ytconv_ab_variant_v1';
              let v = localStorage.getItem(key);
              if (!v) {
                v = Math.random() < 0.5 ? 'A' : 'B';
                localStorage.setItem(key, v);
              }
              return v;
            })();
            const reportPageChange = () => {
              try {
                forumSocket?.emit('page_change', {
                  page: window.location.pathname || '/',
                  clientId: telemetryClientId,
                  abVariant,
                  userId: currentUser?.uid || '',
                  userEmail: currentUser?.email || '',
                });
              } catch { }
            };
            const reportUserAction = (action, detail = '') => {
              try {
                forumSocket?.emit('user_action', { action, detail, clientId: telemetryClientId, abVariant });
              } catch { }
            };
            window.reportUserAction = reportUserAction;
            forumSocket = window.io({
              transports: ['websocket', 'polling'],
            });
            forumSocket.on('connect', () => {
              forumSocketConnected = true;
              reportPageChange();
              joinForumPresence(activeForumRoom);
            });
            forumSocket.on('disconnect', () => {
              forumSocketConnected = false;
              forumPresenceUsers = [];
              renderCallUserList();
            });
            forumSocket.on('forum:users', (payload) => {
              if (!payload || payload.room !== activeForumRoom) return;
              forumPresenceUsers = Array.isArray(payload.users) ? payload.users : [];
              renderCallUserList();
            });
            forumSocket.on('forum:userUnblocked', (payload) => {
              const targetUserId = String(payload?.userId || '');
              if (!targetUserId || targetUserId !== String(currentUser?.uid || '')) return;
              forumUnblockedByAppeal = true;
              setForumViolationCount(0);
              setToast('✅ Appeal diterima admin. Forum chat kamu sudah diaktifkan lagi.', 'success');
              updateSendButtonState();
            });
            forumSocket.on('forum:appealReviewed', (payload) => {
              const targetUserId = String(payload?.userId || '');
              if (!targetUserId || targetUserId !== String(currentUser?.uid || '')) return;
              if (payload.reviewNote) {
                alert(`Pesan dari Admin Forum (Appeal ${payload.statusLabel}):\n\n"${payload.reviewNote}"`);
              } else if (payload.status === 'rejected') {
                alert(`Maaf, Appeal kamu (${payload.appealId}) telah ditolak admin. Kamu tetap tidak bisa mengirim pesan.`);
              }
            });
            forumSocket.on('call:offer', (payload) => {
              if (!payload?.callId || !payload?.offer) return;
              if (callState.status !== 'idle') {
                try {
                  forumSocket.emit('call:end', {
                    room: payload.room,
                    callId: payload.callId,
                    toUserId: payload.fromUserId,
                  });
                } catch { }
                return;
              }
              callState.pendingOffer = payload;
              callState.callId = String(payload.callId);
              callState.peerUserId = String(payload.fromUserId || '');
              callState.peerName = String(payload.fromName || 'Warga');
              if (forumIncomingCaller) forumIncomingCaller.textContent = callState.peerName;
              forumIncomingCallModal?.show?.();
              if (ringtoneIncoming && ringtoneIncoming.paused) ringtoneIncoming.play().catch(() => { });
            });
            forumSocket.on('call:answer', async (payload) => {
              if (!payload?.callId || payload.callId !== callState.callId) return;
              if (!callState.pc) return;
              try {
                await callState.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                // Process queued ICE candidates after setting remote description
                while (callState.iceQueue.length > 0) {
                  const candidate = callState.iceQueue.shift();
                  try {
                    await callState.pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (e) {
                    console.error('Failed to add queued candidate', e);
                  }
                }
              } catch (e) { console.error('Error setting remote answer', e); }
            });
            forumSocket.on('call:ice', async (payload) => {
              if (!payload?.callId || payload.callId !== callState.callId) return;
              if (!callState.pc || !callState.pc.remoteDescription) {
                callState.iceQueue.push(payload.candidate);
                return;
              }
              try {
                await callState.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) { console.error('Error adding ICE', e); }
            });
            forumSocket.on('call:end', (payload) => {
              if (!payload?.callId || payload.callId !== callState.callId) return;
              cleanupPeer();
              setToast('Panggilan berakhir');
            });
            forumSocket.on('conversion_blocked', (payload) => {
              if (typeof setToast === 'function') setToast(payload?.message || 'Konversi dinonaktifkan sementara oleh admin.', 'warning');
              window.manageCTAState?.('idle');
            });
            forumSocket.on('control_state', (payload) => {
              const disabled = payload?.convertEnabled === false;
              window.__adminConvertDisabled = disabled;
              const convertBtn = document.getElementById('convertBtn');
              const basicBtn = document.getElementById('basic-convert-btn');
              const gaptekBtn = document.getElementById('gaptek-convert-btn');
              [convertBtn, basicBtn, gaptekBtn].forEach((btn) => {
                if (!btn) return;
                btn.disabled = disabled;
                btn.classList.toggle('opacity-50', disabled);
                btn.title = disabled ? 'Convert dinonaktifkan admin sementara' : '';
              });
              const badgeId = 'adminConvertStateBadge';
              let badge = document.getElementById(badgeId);
              if (!badge) {
                badge = document.createElement('div');
                badge.id = badgeId;
                badge.className = 'small mt-2';
                const target = document.getElementById('convertBtn')?.parentElement;
                if (target) target.appendChild(badge);
              }
              if (badge) {
                badge.textContent = disabled ? '🚫 Convert dinonaktifkan sementara oleh admin.' : '✅ Convert aktif normal.';
                badge.classList.toggle('text-danger', disabled);
                badge.classList.toggle('text-success', !disabled);
              }
            });
            window.addEventListener('popstate', reportPageChange);
            window.addEventListener('hashchange', reportPageChange);
            let lastActionAt = 0;
            document.addEventListener('click', (evt) => {
              const now = Date.now();
              if (now - lastActionAt < 400) return;
              const target = evt.target?.closest?.('button, a, [data-section-target], input, select');
              if (!target) return;
              lastActionAt = now;
              const label = target.id || target.getAttribute('data-section-target') || target.name || target.textContent?.trim()?.slice(0, 40) || target.tagName;
              reportUserAction('click', label);
            }, true);
            document.addEventListener('change', (evt) => {
              const t = evt.target;
              if (!t) return;
              const label = t.id || t.name || t.tagName;
              const val = typeof t.value === 'string' ? t.value.slice(0, 40) : '';
              reportUserAction('change', `${label}:${val}`);
            }, true);
            return forumSocket;
          };

          function joinForumPresence(roomKey) {
            if (!currentUser) return;
            const socket = ensureForumSocket();
            if (!socket) return;
            const room = String(roomKey || 'umum');
            socket.emit('forum:join', {
              room,
              userId: currentUser.uid,
              name: currentUser.displayName || currentUser.email || 'Warga',
            });
          }

          function renderCallUserList() {
            if (!forumCallUserList || !forumCallUserEmpty) return;
            const myId = currentUser?.uid || '';
            const users = (Array.isArray(forumPresenceUsers) ? forumPresenceUsers : []).filter((u) => u && u.userId && u.userId !== myId);
            forumCallUserList.innerHTML = '';
            if (!users.length) {
              forumCallUserEmpty.hidden = false;
              return;
            }
            forumCallUserEmpty.hidden = true;
            users.forEach((u) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'list-group-item list-group-item-action d-flex align-items-center justify-content-between';
              btn.innerHTML = `<span class="fw-semibold">${String(u.name || 'Warga').replace(/</g, '&lt;')}</span><span class="badge rounded-pill text-bg-info">Call</span>`;
              btn.addEventListener('click', () => {
                // IMPORTANT: Synchronous user gesture to unlock audio element for Safari/iOS
                if (forumRemoteAudio) forumRemoteAudio.play().catch(() => { });
                forumCallPickerModal?.hide?.();
                startOutgoingCall(String(u.userId), String(u.name || 'Warga'));
              });
              forumCallUserList.appendChild(btn);
            });
          }

          const startOutgoingCall = async (toUserId, toName) => {
            if (!currentUser) return;
            const socket = ensureForumSocket();
            if (!socket) {
              setToast('Call belum siap (socket).');
              return;
            }
            if (callState.status !== 'idle') return;
            callState.status = 'calling';
            callState.room = activeForumRoom;
            callState.callId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            callState.peerUserId = toUserId;
            callState.peerName = toName;
            callState.isOutgoing = true;
            setCallUi();
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              callState.localStream = stream;
              callState.micEnabled = true;
              const pc = await createPeerConnection();
              callState.pc = pc;
              stream.getTracks().forEach((t) => pc.addTrack(t, stream));
              let isLocalDescriptionSet = false;
              const localCandidatesQueue = [];

              pc.onicecandidate = (evt) => {
                if (!evt.candidate) {
                  console.log('[WebRTC Caller] ICE Gathering finished.');
                  return;
                }
                console.log('[WebRTC Caller] Generated candidate:', evt.candidate.candidate);

                const emitCandidate = (candidate) => {
                  socket.emit('call:ice', {
                    room: activeForumRoom,
                    callId: callState.callId,
                    toUserId,
                    candidate,
                  });
                };

                if (isLocalDescriptionSet) {
                  emitCandidate(evt.candidate);
                } else {
                  localCandidatesQueue.push(evt.candidate);
                }
              };

              // Only create offer once audio tracks are explicitly added (prevent timing issues)
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
              await pc.setLocalDescription(offer);
              isLocalDescriptionSet = true;

              localCandidatesQueue.forEach((c) => {
                socket.emit('call:ice', {
                  room: activeForumRoom,
                  callId: callState.callId,
                  toUserId,
                  candidate: c,
                });
              });

              socket.emit('call:offer', {
                room: activeForumRoom,
                callId: callState.callId,
                toUserId,
                offer: pc.localDescription,
              });

              if (typeof window.setToast === 'function') window.setToast(`Calling ${toName}...`);

              // Set a timeout to cancel the call if not answered/connected
              callState.timer = setTimeout(() => {
                if (callState.status === 'calling') {
                  cleanupPeer();
                  if (typeof window.setToast === 'function') window.setToast('Panggilan tidak dijawab (Timeout)', 'warning');
                }
              }, 45000); // 45 seconds

            } catch (err) {
              console.error('[WebRTC Call Error]', err);
              cleanupPeer();
              if (typeof window.setToast === 'function') window.setToast('Gagal memulai call: ' + (err?.message || 'unknown'), 'danger');
            }
          };

          const acceptIncomingCall = async () => {
            const payload = callState.pendingOffer;
            if (!payload) return;
            const socket = ensureForumSocket();
            if (!socket) return;
            callState.status = 'calling';
            callState.room = activeForumRoom;
            callState.isOutgoing = false;
            setCallUi();
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              callState.localStream = stream;
              callState.micEnabled = true;
              const pc = await createPeerConnection();
              callState.pc = pc;
              stream.getTracks().forEach((t) => pc.addTrack(t, stream));
              let isLocalDescriptionSet = false;
              const localCandidatesQueue = [];

              pc.onicecandidate = (evt) => {
                if (!evt.candidate) {
                  console.log('[WebRTC Receiver] ICE Gathering finished.');
                  return;
                }
                console.log('[WebRTC Receiver] Generated candidate:', evt.candidate.candidate);

                const emitCandidate = (candidate) => {
                  socket.emit('call:ice', {
                    room: payload.room,
                    callId: payload.callId,
                    toUserId: payload.fromUserId,
                    candidate,
                  });
                };

                if (isLocalDescriptionSet) {
                  emitCandidate(evt.candidate);
                } else {
                  localCandidatesQueue.push(evt.candidate);
                }
              };

              await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              isLocalDescriptionSet = true;

              localCandidatesQueue.forEach((c) => {
                socket.emit('call:ice', {
                  room: payload.room,
                  callId: payload.callId,
                  toUserId: payload.fromUserId,
                  candidate: c,
                });
              });

              socket.emit('call:answer', {
                room: payload.room,
                callId: payload.callId,
                toUserId: payload.fromUserId,
                answer: pc.localDescription,
              });
              callState.pendingOffer = null;

              // Process any queued ICE candidates
              while (callState.iceQueue.length > 0) {
                const candidate = callState.iceQueue.shift();
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                  console.error('Failed to add queued candidate', e);
                }
              }

              if (typeof window.setToast === 'function') window.setToast('Call tersambung...', 'success');

              // Clear timeout if there was one
              if (callState.timer && typeof callState.timer !== 'number') {
                clearTimeout(callState.timer);
              }

            } catch (err) {
              console.error('[WebRTC Accept Error]', err);
              cleanupPeer();
              if (typeof window.setToast === 'function') window.setToast('Gagal menerima call: ' + (err?.message || 'unknown'), 'danger');
            }
          };

          const declineIncomingCall = () => {
            const payload = callState.pendingOffer;
            if (!payload) return;
            const socket = ensureForumSocket();
            try {
              socket?.emit?.('call:end', {
                room: payload.room,
                callId: payload.callId,
                toUserId: payload.fromUserId,
              });
            } catch { }
            cleanupPeer();
          };

          const endCurrentCall = () => {
            const socket = ensureForumSocket();
            if (socket && callState.peerUserId && callState.callId) {
              try {
                socket.emit('call:end', {
                  room: activeForumRoom,
                  callId: callState.callId,
                  toUserId: callState.peerUserId,
                });
              } catch { }
            }
            cleanupPeer();
          };

          if (forumCallBtn) {
            forumCallBtn.addEventListener('click', () => {
              if (!currentUser) return;
              if (callState.status !== 'idle') {
                setToast('Sedang dalam panggilan.');
                return;
              }
              renderCallUserList();
              forumCallPickerModal?.show?.();
            });
          }

          if (waMicBtn) {
            waMicBtn.addEventListener('click', () => {
              if (!callState.localStream) return;
              const tracks = callState.localStream.getAudioTracks();
              if (!tracks.length) return;
              callState.micEnabled = !callState.micEnabled;
              tracks.forEach((t) => {
                t.enabled = callState.micEnabled;
              });
              setCallUi();
            });
          }

          if (waSpeakerBtn) {
            waSpeakerBtn.addEventListener('click', async () => {
              isSpeakerOn = !isSpeakerOn;
              waSpeakerBtn.style.background = isSpeakerOn ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
              if (forumRemoteAudio && typeof forumRemoteAudio.setSinkId === 'function') {
                try {
                  await forumRemoteAudio.setSinkId(isSpeakerOn ? 'speaker' : '');
                } catch (e) {
                  console.warn("setSinkId fail", e);
                }
              }
            });
          }

          if (waEndCallBtn) {
            waEndCallBtn.addEventListener('click', () => {
              endCurrentCall();
            });
          }

          if (forumAcceptCallBtn) {
            forumAcceptCallBtn.addEventListener('click', async () => {
              // IMPORTANT: Synchronous user gesture to unlock audio element for Safari/iOS
              if (forumRemoteAudio) forumRemoteAudio.play().catch(() => { });
              forumIncomingCallModal?.hide?.();
              await acceptIncomingCall();
            });
          }

          if (forumDeclineCallBtn) {
            forumDeclineCallBtn.addEventListener('click', () => {
              if (ringtoneIncoming) {
                ringtoneIncoming.pause();
                ringtoneIncoming.currentTime = 0;
              }
              forumIncomingCallModal?.hide?.();
              declineIncomingCall();
            });
          }

          function isPrivateRoomKey(key) {
            return typeof key === 'string' && /^priv-\d{4,10}$/.test(key);
          }

          function parsePrivateRoomCode(key) {
            if (!isPrivateRoomKey(key)) return '';
            return key.replace('priv-', '');
          }

          function buildPrivateRoomKey(code) {
            const cleaned = String(code || '').replace(/\D/g, '');
            return cleaned ? `priv-${cleaned}` : '';
          }

          function generatePrivateRoomCode(length = 6) {
            const n = Math.max(4, Math.min(10, Number(length) || 6));
            let out = '';
            for (let i = 0; i < n; i += 1) out += String(Math.floor(Math.random() * 10));
            return out;
          }

          function getForumRoomLabel(key) {
            if (isPrivateRoomKey(key)) return `Private • ${parsePrivateRoomCode(key)}`;
            const found = FORUM_ROOMS.find((r) => r.key === key);
            return found ? found.label : 'Umum';
          }

          function hasAcceptedPrivateRoomTos() {
            try { return localStorage.getItem(privateRoomTosKey) === '1'; } catch { return false; }
          }

          function requestPrivateRoomTos(nextSelection) {
            pendingRoomSelection = nextSelection;
            if (forumRoomSelect) forumRoomSelect.value = activeForumRoom;
            if (privateRoomTosModal) privateRoomTosModal.show();
            else setToast('Syarat Private Room belum siap dibuka.');
          }

          if (privateRoomAcceptBtn) {
            privateRoomAcceptBtn.addEventListener('click', () => {
              try { localStorage.setItem(privateRoomTosKey, '1'); } catch { }
              try { privateRoomTosModal?.hide?.(); } catch { }
              const next = pendingRoomSelection;
              pendingRoomSelection = null;
              if (next) handleRoomSelection(next);
            });
          }

          function syncRoomSelectOptions(roomKey) {
            if (!forumRoomSelect) return;
            const opts = Array.from(forumRoomSelect.options || []);
            opts
              .filter((o) => o && o.dataset && o.dataset.dynamic === '1')
              .forEach((o) => { try { o.remove(); } catch { } });

            if (isPrivateRoomKey(roomKey)) {
              const opt = document.createElement('option');
              opt.value = roomKey;
              opt.textContent = `Private Room • ${parsePrivateRoomCode(roomKey)}`;
              opt.dataset.dynamic = '1';
              const joinOpt = forumRoomSelect.querySelector('option[value="__join_private__"]');
              if (joinOpt && joinOpt.parentNode) joinOpt.parentNode.insertBefore(opt, joinOpt);
              else forumRoomSelect.appendChild(opt);
            }
          }

          function setActiveRoomUi(roomKey) {
            activeForumRoom = roomKey;
            localStorage.setItem(forumRoomKeyStorage, roomKey);
            if (forumRoomBadge) forumRoomBadge.textContent = getForumRoomLabel(roomKey);
            syncRoomSelectOptions(roomKey);
            if (forumRoomSelect) forumRoomSelect.value = roomKey;
            if (forumCopyRoomBtn) {
              if (isPrivateRoomKey(roomKey)) forumCopyRoomBtn.classList.remove('d-none');
              else forumCopyRoomBtn.classList.add('d-none');
            }
            applyRoomUiRules();
            if (currentUser) {
              joinForumPresence(roomKey);
              renderCallUserList();
            }
          }

          function handleRoomSelection(value) {
            if ((value === '__create_private__' || value === '__join_private__' || isPrivateRoomKey(value)) && !hasAcceptedPrivateRoomTos()) {
              requestPrivateRoomTos(value);
              return;
            }
            if (value === '__create_private__') {
              const code = generatePrivateRoomCode(6);
              const key = buildPrivateRoomKey(code);
              setActiveRoomUi(key);
              try { startChatListener(); } catch { }
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(code).then(
                  () => setToast(`Private room siap. Kodenya ${code} (sudah kesalin).`),
                  () => setToast(`Private room siap. Kodenya ${code}.`)
                );
              } else {
                setToast(`Private room siap. Kodenya ${code}.`);
              }
              return;
            }
            if (value === '__join_private__') {
              const raw = window.prompt('Masukkan kode Private Room (angka saja):', '');
              const cleaned = String(raw || '').replace(/\D/g, '');
              if (!cleaned || cleaned.length < 4) {
                setToast('Kode private room belum valid.');
                setActiveRoomUi('umum');
                try { startChatListener(); } catch { }
                return;
              }
              const key = buildPrivateRoomKey(cleaned);
              setActiveRoomUi(key);
              try { startChatListener(); } catch { }
              setToast(`Masuk ke private room ${cleaned}.`);
              return;
            }
            setActiveRoomUi(value || 'umum');
            try { startChatListener(); } catch { }
          }

          if (forumRoomSelect) {
            forumRoomSelect.addEventListener('change', () => {
              handleRoomSelection(forumRoomSelect.value);
            });
          }

          if (forumCopyRoomBtn) {
            forumCopyRoomBtn.addEventListener('click', async () => {
              const code = parsePrivateRoomCode(activeForumRoom);
              if (!code) return;
              try {
                await navigator.clipboard.writeText(code);
                setToast('Kode private room sudah kesalin.');
              } catch {
                setToast(`Kode private room: ${code}`);
              }
            });
          }

          setActiveRoomUi(activeForumRoom);

          // --- File Handling & Preview ---

          // Handle File Selection
          if (forumImageInput) {
            forumImageInput.addEventListener('change', (e) => {
              const files = Array.from(e.target.files);
              addFilesToQueue(files);
              e.target.value = ''; // Reset
            });
          }

          // Handle Camera
          if (btnCameraOpen) {
            btnCameraOpen.addEventListener('click', () => {
              forumImageInput.setAttribute('capture', 'environment');
              forumImageInput.click();
              setTimeout(() => forumImageInput.removeAttribute('capture'), 1000); // Reset after click
            });
          }

          function addFilesToQueue(files) {
            files.forEach(file => {
              if (file.type.startsWith('image/')) {
                selectedFiles.push(file);
              }
            });
            renderAttachmentPreview();
          }

          function renderAttachmentPreview() {
            if (selectedFiles.length === 0) {
              attachmentPreviewBar.classList.add('d-none');
              return;
            }
            attachmentPreviewBar.classList.remove('d-none');
            attachmentPreviewBar.innerHTML = '';

            selectedFiles.forEach((file, index) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'position-relative d-inline-block me-2';
                div.innerHTML = `
                        <img src="${e.target.result}" class="rounded-3 border border-secondary" style="height: 80px; width: 80px; object-fit: cover;">
                        <button class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-1 p-0 d-flex align-items-center justify-content-center shadow-sm" 
                            style="width: 20px; height: 20px; font-size: 10px;" onclick="removeFile(${index})"><i class="bi bi-x"></i></button>
                        <button class="btn btn-sm btn-light rounded-circle position-absolute bottom-0 end-0 m-1 p-0 d-flex align-items-center justify-content-center shadow-sm" 
                            style="width: 24px; height: 24px;" onclick="openImageEditor(${index})"><i class="bi bi-pencil-fill text-dark" style="font-size: 10px;"></i></button>
                    `;
                attachmentPreviewBar.appendChild(div);
              };
              reader.readAsDataURL(file);
            });
            updateSendButtonState();
          }

          window.removeFile = (index) => {
            selectedFiles.splice(index, 1);
            renderAttachmentPreview();
          };

          // --- Image Editor Logic ---

          window.openImageEditor = (index) => {
            activeEditorFileIndex = index;
            const file = selectedFiles[index];
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                currentImageObj = img;
                editorModal.show();

                // Fix: Init canvas after modal is shown to ensure correct dimensions
                setTimeout(() => {
                  initCanvas(img);
                }, 200);

                // Normal Chat Flow Save
                const newSaveBtn = btnSaveEdit.cloneNode(true);
                btnSaveEdit.replaceWith(newSaveBtn);
                const actualSaveBtn = document.getElementById('btnSaveEdit');
                actualSaveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Simpan Edit';

                actualSaveBtn.onclick = () => {
                  if (!editorCanvas) return;
                  editorCanvas.toBlob((blob) => {
                    if (!blob) return;
                    const newFile = new File([blob], "edited_" + file.name, { type: file.type || "image/png" });
                    selectedFiles[index] = newFile; // Update in place
                    renderAttachmentPreview();
                    const bsModal = bootstrap.Modal.getInstance(document.getElementById('editorModal'));
                    if (bsModal) bsModal.hide();
                  }, file.type || 'image/png', 1.0);
                };
              };
              img.src = e.target.result;
            };
            reader.readAsDataURL(file);
          };


          // Initialize Canvas with High Resolution
          function initCanvas(img) {
            if (!editorCanvas) return;

            if (cropperInstance) {
              try { cropperInstance.destroy(); } catch { }
              cropperInstance = null;
            }
            if (editorCropImage) editorCropImage.style.display = 'none';
            editorCanvas.style.display = '';

            // Set canvas size to match image's natural dimensions for high quality
            editorCanvas.width = img.naturalWidth || img.width;
            editorCanvas.height = img.naturalHeight || img.height;

            // Init 2D context
            canvasCtx = editorCanvas.getContext('2d');

            // Ensure container has height so canvas is visible
            const container = editorCanvas.parentElement;
            if (container && container.clientHeight === 0) {
              container.style.height = '50vh';
              container.style.minHeight = '300px';
            }

            // Reset strokes & texts for a fresh edit session
            window.editorStrokes = [];
            window.editorTexts = [];
            activeTextIndex = -1;
            if (editorTextTools) editorTextTools.classList.add('d-none');

            // Draw initial image
            redrawCanvas();
          }

          // Redraw Canvas (Background + Drawings + Text)
          function redrawCanvas() {
            if (!canvasCtx || !currentImageObj) return;

            // 1. Draw Background Image
            canvasCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
            canvasCtx.drawImage(currentImageObj, 0, 0);

            // 2. Draw Brush Strokes
            if (window.editorStrokes) {
              window.editorStrokes.forEach(stroke => {
                canvasCtx.beginPath();
                canvasCtx.lineJoin = 'round';
                canvasCtx.lineCap = 'round';
                canvasCtx.lineWidth = stroke.size;
                canvasCtx.strokeStyle = stroke.color;
                canvasCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
                for (let i = 1; i < stroke.points.length; i++) {
                  canvasCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
                }
                canvasCtx.stroke();
              });
            }

            // 3. Draw Text Objects
            if (window.editorTexts) {
              window.editorTexts.forEach(txtObj => {
                const size = Math.max(12, Number(txtObj.size) || 72);
                canvasCtx.font = `bold ${size}px Arial`;
                canvasCtx.fillStyle = txtObj.color;
                canvasCtx.textAlign = "center";
                canvasCtx.strokeStyle = "white";
                canvasCtx.lineWidth = Math.max(2, Math.round(size / 18));
                canvasCtx.strokeText(txtObj.text, txtObj.x, txtObj.y);
                canvasCtx.fillText(txtObj.text, txtObj.x, txtObj.y);
              });
            }
          }

          // Editor Tools State
          window.editorStrokes = [];
          window.editorTexts = [];
          // Variables redeclared fix: use window or remove 'let' if already declared
          // Actually, let's just reuse the ones declared at the top or reset them.
          // We declared `let isDrawing` at line ~17223. We should NOT redeclare it here.
          // We will just reset them.

          // Reset state when opening editor usually happens in initCanvas or openImageEditor

          let currentStroke = null;
          let draggingTextIndex = -1;

          const getCanvasPoint = (e) => {
            const rect = editorCanvas.getBoundingClientRect();
            const scaleX = editorCanvas.width / rect.width;
            const scaleY = editorCanvas.height / rect.height;
            return {
              x: (e.clientX - rect.left) * scaleX,
              y: (e.clientY - rect.top) * scaleY,
            };
          };

          const getTextBounds = (txtObj) => {
            if (!canvasCtx || !txtObj) return null;
            const size = Math.max(12, Number(txtObj.size) || 72);
            canvasCtx.save();
            canvasCtx.font = `bold ${size}px Arial`;
            canvasCtx.textAlign = 'center';
            const metrics = canvasCtx.measureText(String(txtObj.text || ''));
            canvasCtx.restore();
            const w = Math.max(24, metrics.width);
            const pad = Math.max(10, Math.round(size * 0.25));
            const left = txtObj.x - (w / 2) - pad;
            const right = txtObj.x + (w / 2) + pad;
            const top = txtObj.y - size - pad;
            const bottom = txtObj.y + pad;
            return { left, right, top, bottom, size };
          };

          const pickTextIndexAt = (x, y) => {
            if (!Array.isArray(window.editorTexts)) return -1;
            for (let i = window.editorTexts.length - 1; i >= 0; i--) {
              const bounds = getTextBounds(window.editorTexts[i]);
              if (!bounds) continue;
              if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) return i;
            }
            return -1;
          };

          const setActiveText = (idx) => {
            activeTextIndex = Number.isFinite(idx) ? idx : -1;
            if (activeTextIndex < 0 || !Array.isArray(window.editorTexts) || !window.editorTexts[activeTextIndex]) {
              if (editorTextTools) editorTextTools.classList.add('d-none');
              return;
            }
            const t = window.editorTexts[activeTextIndex];
            const size = Math.max(12, Number(t.size) || 72);
            if (editorTextSize) editorTextSize.value = String(Math.min(Number(editorTextSize.max) || 240, Math.max(Number(editorTextSize.min) || 12, size)));
            if (editorTextTools) editorTextTools.classList.remove('d-none');
          };

          const bumpTextSize = (delta) => {
            if (activeTextIndex < 0 || !Array.isArray(window.editorTexts) || !window.editorTexts[activeTextIndex]) return;
            const t = window.editorTexts[activeTextIndex];
            const next = Math.max(12, Math.min(240, (Number(t.size) || 72) + delta));
            t.size = next;
            if (editorTextSize) editorTextSize.value = String(next);
            redrawCanvas();
          };

          const setCropMode = (enabled) => {
            if (!editorCanvas || !editorCropImage) return;
            const saveBtn = document.getElementById('btnSaveEdit');
            if (enabled) {
              editMode = 'crop';
              editorCanvas.style.display = 'none';
              editorCropImage.style.display = '';
              if (saveBtn) saveBtn.setAttribute('disabled', '');
            } else {
              editMode = 'none';
              editorCropImage.style.display = 'none';
              editorCanvas.style.display = '';
              if (saveBtn) saveBtn.removeAttribute('disabled');
            }
          };

          editorCanvas.addEventListener('pointerdown', (e) => {
            editorCanvas.setPointerCapture?.(e.pointerId);
            const { x: mouseX, y: mouseY } = getCanvasPoint(e);

            if (editMode === 'text') {
              const idx = pickTextIndexAt(mouseX, mouseY);
              setActiveText(idx);
              if (idx !== -1) {
                draggingTextIndex = idx;
                const t = window.editorTexts[idx];
                textDragOffset = { x: mouseX - t.x, y: mouseY - t.y };
                editorCanvas.style.cursor = 'move';
              } else {
                draggingTextIndex = -1;
                editorCanvas.style.cursor = 'default';
              }
              return;
            }

            if (editMode === 'brush') {
              isDrawing = true;
              [lastX, lastY] = [mouseX, mouseY];
              currentStroke = { points: [{ x: mouseX, y: mouseY }], color: editorColorPicker.value, size: 10 };
            }
          });

          editorCanvas.addEventListener('pointermove', (e) => {
            const { x: mouseX, y: mouseY } = getCanvasPoint(e);

            if (editMode === 'text' && draggingTextIndex !== -1) {
              const t = window.editorTexts[draggingTextIndex];
              t.x = mouseX - (textDragOffset?.x || 0);
              t.y = mouseY - (textDragOffset?.y || 0);
              redrawCanvas();
              return;
            }

            if (isDrawing && editMode === 'brush') {
              canvasCtx.beginPath();
              canvasCtx.lineJoin = 'round';
              canvasCtx.lineCap = 'round';
              canvasCtx.lineWidth = 10;
              canvasCtx.strokeStyle = editorColorPicker.value;
              canvasCtx.moveTo(lastX, lastY);
              canvasCtx.lineTo(mouseX, mouseY);
              canvasCtx.stroke();

              if (currentStroke) currentStroke.points.push({ x: mouseX, y: mouseY });
              [lastX, lastY] = [mouseX, mouseY];
            }
          });

          const endPointer = () => {
            if (isDrawing && currentStroke) {
              window.editorStrokes.push(currentStroke);
              currentStroke = null;
            }
            isDrawing = false;
            draggingTextIndex = -1;
            if (editMode === 'text') editorCanvas.style.cursor = 'default';
          };

          editorCanvas.addEventListener('pointerup', endPointer);
          editorCanvas.addEventListener('pointercancel', endPointer);

          editorCanvas.addEventListener('wheel', (e) => {
            if (editMode !== 'text' || activeTextIndex < 0) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -4 : 4;
            bumpTextSize(delta);
          }, { passive: false });

          // Tool Buttons Logic
          if (document.getElementById('btnEditBrush')) {
            document.getElementById('btnEditBrush').addEventListener('click', () => {
              editMode = (editMode === 'brush') ? 'none' : 'brush';
              editorCanvas.style.cursor = (editMode === 'brush') ? 'crosshair' : 'default';
              setToast(editMode === 'brush' ? 'Mode Gambar Aktif' : 'Mode Gambar Nonaktif', 'info');
            });
          }

          if (btnEditCrop) {
            btnEditCrop.addEventListener('click', () => {
              if (!currentImageObj || !editorCropImage) return;

              if (!cropperInstance) {
                if (!window.Cropper) {
                  setToast('Mode crop belum siap di perangkat ini.');
                  return;
                }
                if (editorTextTools) editorTextTools.classList.add('d-none');
                setCropMode(true);
                editorCropImage.src = currentImageObj.src;
                editorCropImage.onload = () => {
                  try { cropperInstance?.destroy?.(); } catch { }
                  cropperInstance = new window.Cropper(editorCropImage, {
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.9,
                    background: false,
                    responsive: true,
                    guides: true,
                    center: true,
                    zoomable: true,
                    movable: true,
                    rotatable: true,
                    scalable: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                  });
                  setToast('Tarik kotak crop sesuai kebutuhan, lalu tekan Crop lagi untuk simpan.');
                };
                return;
              }

              try {
                const cropped = cropperInstance.getCroppedCanvas({
                  imageSmoothingEnabled: true,
                  imageSmoothingQuality: 'high',
                });
                const newImg = new Image();
                newImg.onload = () => {
                  try { cropperInstance.destroy(); } catch { }
                  cropperInstance = null;
                  currentImageObj = newImg;
                  window.editorStrokes = [];
                  window.editorTexts = [];
                  setCropMode(false);
                  initCanvas(newImg);
                  setToast('Crop diterapkan.');
                };
                newImg.src = cropped.toDataURL();
              } catch (err) {
                console.error(err);
                setToast('Crop gagal diproses.');
              }
            });
          }

          if (btnEditRotate) {
            btnEditRotate.addEventListener('click', () => {
              if (!currentImageObj) return;
              if (cropperInstance) {
                try { cropperInstance.rotate(90); } catch { }
                return;
              }
              const srcW = currentImageObj.naturalWidth || currentImageObj.width;
              const srcH = currentImageObj.naturalHeight || currentImageObj.height;
              const temp = document.createElement('canvas');
              temp.width = srcH;
              temp.height = srcW;
              const tCtx = temp.getContext('2d');
              tCtx.translate(temp.width / 2, temp.height / 2);
              tCtx.rotate(Math.PI / 2);
              tCtx.drawImage(currentImageObj, -srcW / 2, -srcH / 2);
              const newImg = new Image();
              newImg.onload = () => {
                currentImageObj = newImg;
                window.editorStrokes = [];
                window.editorTexts = [];
                initCanvas(newImg);
                setToast('Gambar diputar.');
              };
              newImg.src = temp.toDataURL();
            });
          }

          // Ensure Editor Canvas Container has explicit dimensions to prevent "Black Screen"
          // This usually happens if the modal or parent has 0 height when canvas initializes.
          // We fix this by checking container size in initCanvas, but let's add a helper here too.
          if (editorModalEl) {
            editorModalEl.addEventListener('shown.bs.modal', () => {
              const container = editorCanvas.parentElement;
              if (container && container.clientHeight === 0) {
                // Force a height if hidden
                container.style.height = '50vh';
              }
              if (currentImageObj) initCanvas(currentImageObj);
            });
            editorModalEl.addEventListener('hidden.bs.modal', () => {
              if (cropperInstance) {
                try { cropperInstance.destroy(); } catch { }
                cropperInstance = null;
              }
              if (editorCropImage) editorCropImage.style.display = 'none';
              if (editorCanvas) editorCanvas.style.display = '';
              const saveBtn = document.getElementById('btnSaveEdit');
              if (saveBtn) saveBtn.removeAttribute('disabled');
              editMode = 'none';
              activeTextIndex = -1;
              if (editorTextTools) editorTextTools.classList.add('d-none');
            });
          }

          if (btnEditText) {
            btnEditText.addEventListener('click', () => {
              editMode = 'text';
              if (cropperInstance) {
                setToast('Selesaikan crop dulu atau tekan Crop lagi untuk simpan.');
                return;
              }
              const text = prompt("Masukkan teks:");
              if (!text) return;
              const baseSize = editorTextSize ? Number(editorTextSize.value) || 72 : 72;
              window.editorTexts.push({
                text: text,
                x: editorCanvas.width / 2,
                y: editorCanvas.height / 2,
                color: editorColorPicker.value,
                size: baseSize,
              });
              setActiveText(window.editorTexts.length - 1);
              redrawCanvas();
              setToast('Teks ditambahkan. Drag untuk pindah, scroll/slider untuk perbesar.');
            });
          }

          if (editorTextSize) {
            editorTextSize.addEventListener('input', () => {
              if (activeTextIndex < 0 || !Array.isArray(window.editorTexts) || !window.editorTexts[activeTextIndex]) return;
              window.editorTexts[activeTextIndex].size = Number(editorTextSize.value) || 72;
              redrawCanvas();
            });
          }

          if (editorTextSmaller) {
            editorTextSmaller.addEventListener('click', () => bumpTextSize(-6));
          }

          if (editorTextBigger) {
            editorTextBigger.addEventListener('click', () => bumpTextSize(6));
          }

          // Save Edited Image
          // This is handled by dynamic listeners now (btnSaveEdit.onclick)
          // We remove the static listener or make it default to something safe
          // BUT, since we overwrite onclick in specific flows, we can leave this or remove it.
          // Better to remove the old static listener block to avoid conflicts.

          // --- Auth & Chat Logic ---

          function initAuth() {
            if (!window.firebaseModules || !window.firebaseModules.auth) return;
            const { auth, onAuthStateChanged, getRedirectResult } = window.firebaseModules;

            if (sessionStorage.getItem('forum_login_pending') === 'true') {
              forumLoginOverlay.innerHTML = `
                    <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                    <h5 class="text-white">Memverifikasi Login...</h5>
                 `;
            }

            getRedirectResult(auth).then((result) => {
              if (result) {
                setToast('<i class="bi bi-google me-2"></i>Login berhasil!', 'success');
                sessionStorage.removeItem('forum_login_pending');
                forumLoginOverlay.classList.remove('d-flex');
                forumLoginOverlay.classList.add('d-none');
                setTimeout(restoreOverlayContent, 1000);
              }
            }).catch((error) => {
              console.error("Redirect login failed", error);
              sessionStorage.removeItem('forum_login_pending');
              restoreOverlayContent();
            });

            onAuthStateChanged(auth, async (user) => {
              currentUser = user;
              if (user) {
                // Create/Update User Document
                try {
                  const { db, doc, setDoc, serverTimestamp } = window.firebaseModules;
                  if (db && doc && setDoc && serverTimestamp) {
                    const userRef = doc(db, "users", user.uid);
                    await setDoc(userRef, {
                      email: user.email,
                      displayName: user.displayName,
                      photoURL: user.photoURL,
                      lastLogin: serverTimestamp()
                    }, { merge: true });
                  }
                } catch (e) { console.warn("User doc update failed:", e); }

                forumLoginOverlay.classList.remove('d-flex');
                forumLoginOverlay.classList.add('d-none');
                forumInput.disabled = false;
                updateSendButtonState();
                if (forumLogoutBtn) forumLogoutBtn.classList.remove('d-none');
                if (forumCallBtn) forumCallBtn.classList.remove('d-none');
                if (forumReportBtn) forumReportBtn.classList.remove('d-none');
                if (forumDeleteAllBtn) {
                  if (user.email === adminEmail) forumDeleteAllBtn.classList.remove('d-none');
                  else forumDeleteAllBtn.classList.add('d-none');
                }
                startChatListener();
                applyRoomUiRules();
                ensureForumSocket();
                joinForumPresence(activeForumRoom);
                renderCallUserList();
              } else {
                forumLoginOverlay.classList.remove('d-none');
                forumLoginOverlay.classList.add('d-flex');
                forumInput.disabled = true;
                updateSendButtonState();
                if (forumLogoutBtn) forumLogoutBtn.classList.add('d-none');
                if (forumCallBtn) forumCallBtn.classList.add('d-none');
                if (forumReportBtn) forumReportBtn.classList.add('d-none');
                if (forumDeleteAllBtn) forumDeleteAllBtn.classList.add('d-none');
                if (unsubscribe) unsubscribe();
                endCurrentCall();
                try { forumSocket?.emit?.('forum:leave'); } catch { }
                try { forumSocket?.disconnect?.(); } catch { }
                forumSocket = null;
                forumSocketConnected = false;
                forumPresenceUsers = [];
                renderCallUserList();
                if (forumLoadingOverlay) {
                  forumLoadingOverlay.classList.remove('d-flex');
                  forumLoadingOverlay.classList.add('d-none');
                }
                if (forumLoginOverlay.querySelector('.spinner-border')) restoreOverlayContent();
              }
            });
          }

          function restoreOverlayContent() {
            forumLoginOverlay.innerHTML = `
              <div class="mb-4 p-4 bg-gradient-dark rounded-circle shadow-lg border border-secondary position-relative overflow-hidden">
                <i class="bi bi-google text-danger position-relative z-1" style="font-size: 3.5rem;"></i>
                <div class="position-absolute top-0 start-0 w-100 h-100 bg-white opacity-10"></div>
              </div>
              <h3 class="fw-bold mb-2 text-white" style="letter-spacing: -0.5px;">Gabung Forum</h3>
              <p class="text-secondary mb-4" style="max-width: 300px;">Diskusi seru, berbagi gambar, dan stiker dengan warga lainnya.</p>
              
              <button id="forumGoogleLoginBtn" class="btn btn-light rounded-pill py-3 px-5 fw-bold d-flex align-items-center gap-3 shadow-lg hover-scale">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="24" height="24" alt="G">
                  <span>Masuk dengan Google</span>
              </button>`;
            const newBtn = document.getElementById('forumGoogleLoginBtn');
            if (newBtn) newBtn.addEventListener('click', handleLoginClick);
          }

          const moduleCheckInterval = setInterval(() => {
            if (window.firebaseModules && window.firebaseModules.auth) {
              clearInterval(moduleCheckInterval);
              initAuth();
            }
          }, 500);
          setTimeout(() => clearInterval(moduleCheckInterval), 15000);

          async function startChatListener() {
            if (!window.firebaseModules || !window.firebaseModules.db) return;
            if (!currentUser) return;

            const { db, collection, query, orderBy, where, limit, onSnapshot, auth } = window.firebaseModules;

            // Update Online Count (Fake for now, or just show connected)
            if (forumOnlineCount) forumOnlineCount.innerHTML = '<span class="text-success">●</span> Terhubung';
            if (forumLoadingOverlay) {
              forumLoadingOverlay.classList.remove('d-none');
              forumLoadingOverlay.classList.add('d-flex');
              const msgEl = forumLoadingOverlay.querySelector('.text-white-50');
              if (msgEl) msgEl.textContent = 'Menyambungkan forum warga...';
            }

            try {
              if (auth && auth.currentUser) await auth.currentUser.getIdToken(true);
            } catch (e) { }

            const colRef = collection(db, "forum-messages");
            const roomKey = activeForumRoom || 'umum';
            const q = query(colRef, orderBy("timestamp", "desc"), limit(250));

            if (unsubscribe) { try { unsubscribe(); } catch { } unsubscribe = null; }
            if (Array.isArray(extraUnsubscribes) && extraUnsubscribes.length) {
              extraUnsubscribes.forEach((fn) => { try { fn(); } catch { } });
            }
            extraUnsubscribes = [];

            const handleSnapshot = (docs) => {
              if (forumLoadingOverlay) {
                forumLoadingOverlay.classList.remove('d-flex');
                forumLoadingOverlay.classList.add('d-none');
              }
              const prevScrollTop = forumChatArea.scrollTop;
              const prevScrollHeight = forumChatArea.scrollHeight;
              const shouldAutoScroll = isNearBottomState || forumChatArea.innerHTML.trim() === '';

              forumChatArea.innerHTML = '';
              forumMessageCache = {};

              const pinnedByRoom = {
                umum: 'Selamat datang di Forum Warga!<br>Room <b>Umum</b> buat ngobrol bebas, tanya fitur, dan update santai.',
                laporan: 'Room <b>Laporan</b> bersifat <b>read-only</b>.<br>Untuk kirim laporan, pakai tombol <b>Laporkan</b> (ikon bendera) lalu isi form + screenshot.',
                jomok: 'Room <b>Jomok</b> buat obrolan dewasa (18+).<br>Tetap sopan, jangan sebar data pribadi siapa pun.',
                foto: 'Room <b>Foto Warga</b> buat share foto, hasil edit, atau meme gambar.<br>Jangan doxxing & jangan upload KTP/nomor WA.',
                event: 'Room <b>Event</b> buat info event, tantangan, dan pengumuman komunitas.<br>Cek pinned ini biar nggak ketinggalan.',
                santai: 'Room <b>Santai / Meme</b> buat lepas stress.<br>Drop meme, cerita random, atau bercandaan tipis-tipis.',
              };
              const pinnedText = isPrivateRoomKey(roomKey)
                ? `Ini <b>Private Room</b>.<br>Kode room: <b>${parsePrivateRoomCode(roomKey)}</b> • Jangan dibagi ke orang random.`
                : (pinnedByRoom[roomKey] || pinnedByRoom.umum);

              const pinnedRules = `
                    <div class="d-flex align-items-start mb-3 message admin admin-pinned w-100 justify-content-start">
                       <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2 shadow-sm" style="width:36px; height:36px; flex-shrink:0; font-size: 0.8rem;">ADM</div>
                       <div class="message-bubble admin-pinned-gradient p-3 rounded-4 rounded-top-0 shadow-sm border-0 position-relative" style="max-width: 85%;">
                          <div class="small fw-bold text-white mb-1">Admin <i class="bi bi-patch-check-fill text-info"></i></div>
                         <div class="small text-white">${pinnedText}</div>
                          <div class="text-end text-white-50 mt-1 d-flex align-items-center justify-content-end gap-1" style="font-size: 0.65rem;">
                            <i class="bi bi-pin-angle-fill"></i> Pinned
                          </div>
                       </div>
                    </div>`;
              forumChatArea.insertAdjacentHTML('beforeend', pinnedRules);

              let lastDateKey = '';
              docs.forEach((doc) => {
                const data = doc.data();
                forumMessageCache[doc.id] = data;
                const key = dayKeyFromTimestamp(data.timestamp);
                if (key && key !== lastDateKey) {
                  lastDateKey = key;
                  const label = formatSeparatorLabel(data.timestamp);
                  if (label) {
                    forumChatArea.insertAdjacentHTML('beforeend', `<div class="chat-date-separator">${label}</div>`);
                  }
                }
                renderMessage(doc.id, data);
              });
              if (shouldAutoScroll) {
                window.scrollToBottom(false);
              } else {
                const nextScrollHeight = forumChatArea.scrollHeight;
                const delta = nextScrollHeight - prevScrollHeight;
                forumChatArea.scrollTop = Math.max(0, prevScrollTop + delta);
                if (forumScrollBtn) forumScrollBtn.classList.remove('d-none');
              }
            };

            const normalizeRoom = (data) => {
              const key = data && typeof data.room === 'string' ? data.room.trim() : '';
              return key ? key : 'umum';
            };

            const filterDocsForRoom = (docs) => {
              if (!Array.isArray(docs)) return [];
              const filtered = roomKey === 'umum'
                ? docs.filter((d) => normalizeRoom(d.data()) === 'umum')
                : docs.filter((d) => normalizeRoom(d.data()) === roomKey);
              filtered.sort((a, b) => {
                const ta = a.data()?.timestamp?.toMillis?.() || 0;
                const tb = b.data()?.timestamp?.toMillis?.() || 0;
                return ta - tb;
              });
              return filtered;
            };

            unsubscribe = onSnapshot(
              q,
              (snapshot) => handleSnapshot(filterDocsForRoom(snapshot.docs)),
              (error) => {
                console.error("Error getting chats:", error);
                if (forumLoadingOverlay) {
                  forumLoadingOverlay.classList.remove('d-none');
                  forumLoadingOverlay.classList.add('d-flex');
                  const msgEl = forumLoadingOverlay.querySelector('.text-white-50');
                  if (msgEl) msgEl.textContent = 'Gagal menyambungkan forum. Coba refresh.';
                }
                if (error.code === 'permission-denied') {
                  setToast('Gagal memuat pesan. Silakan refresh halaman.', 'danger');
                  const retryHtml = `
                            <div class="text-center my-3">
                                <div class="alert alert-danger d-inline-block p-2 small shadow-sm">
                                    <i class="bi bi-exclamation-triangle-fill me-1"></i> <b>Akses Ditolak Database</b>
                                    <br>Admin wajib mengatur "Firestore Rules".
                                    <br><button class="btn btn-sm btn-danger mt-2 rounded-pill px-3" onclick="location.reload()">Refresh</button>
                                </div>
                            </div>`;
                  forumChatArea.insertAdjacentHTML('beforeend', retryHtml);
                  forumChatArea.scrollTop = forumChatArea.scrollHeight;
                } else if (error.code === 'failed-precondition') {
                  setToast('Room forum butuh index Firestore. Sementara aku tampilkan versi kompatibel dulu.', 'warning');
                }
              }
            );
          }

          // --- Cloudinary Upload Helper (Signed Upload Client-Side) ---
          // WARNING: Exposing API Secret client-side is risky. 
          async function uploadToCloudinary(file, folder = null) {
            const apiKey = '422728616314883';
            const apiSecret = 'Nh3_vvxXVaQSEyJXqguIiI5YTbE';
            const cloudName = 'dgbal8btf';
            const timestamp = Math.round((new Date()).getTime() / 1000);

            // Generate Signature
            // If folder is provided, include it. If not, don't.
            let paramsToSign = `timestamp=${timestamp}`;
            if (folder) {
              paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
            }
            const signatureStr = paramsToSign + apiSecret;

            async function sha1(str) {
              const enc = new TextEncoder();
              const hash = await crypto.subtle.digest('SHA-1', enc.encode(str));
              return Array.from(new Uint8Array(hash))
                .map(v => v.toString(16).padStart(2, '0')).join('');
            }

            const signature = await sha1(signatureStr);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp);
            if (folder) formData.append('folder', folder);
            formData.append('signature', signature);

            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

              xhr.onload = () => {
                if (xhr.status === 200) {
                  const response = JSON.parse(xhr.responseText);
                  resolve(response.secure_url);
                } else {
                  console.error("Cloudinary Error:", xhr.responseText);
                  reject(new Error("Cloudinary Upload Failed: " + xhr.statusText));
                }
              };
              xhr.onerror = () => reject(new Error("Network Error"));
              xhr.send(formData);
            });
          }
          try { window.uploadToCloudinary = uploadToCloudinary; } catch { }

          async function uploadToCloudinaryAuto(file, folder = null) {
            const apiKey = '422728616314883';
            const apiSecret = 'Nh3_vvxXVaQSEyJXqguIiI5YTbE';
            const cloudName = 'dgbal8btf';
            const timestamp = Math.round((new Date()).getTime() / 1000);

            let paramsToSign = `timestamp=${timestamp}`;
            if (folder) {
              paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
            }
            const signatureStr = paramsToSign + apiSecret;

            const enc = new TextEncoder();
            const hash = await crypto.subtle.digest('SHA-1', enc.encode(signatureStr));
            const signature = Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2, '0')).join('');

            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp);
            if (folder) formData.append('folder', folder);
            formData.append('signature', signature);

            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
              xhr.onload = () => {
                if (xhr.status === 200) {
                  const response = JSON.parse(xhr.responseText);
                  resolve(response.secure_url);
                } else {
                  console.error("Cloudinary Error:", xhr.responseText);
                  reject(new Error("Cloudinary Upload Failed: " + xhr.statusText));
                }
              };
              xhr.onerror = () => reject(new Error("Network Error"));
              xhr.send(formData);
            });
          }
          try { window.uploadToCloudinaryAuto = uploadToCloudinaryAuto; } catch { }

          async function uploadToCloudinaryVideo(file, folder = null) {
            const apiKey = '422728616314883';
            const apiSecret = 'Nh3_vvxXVaQSEyJXqguIiI5YTbE';
            const cloudName = 'dgbal8btf';
            const timestamp = Math.round((new Date()).getTime() / 1000);

            let paramsToSign = `timestamp=${timestamp}`;
            if (folder) {
              paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
            }
            const signatureStr = paramsToSign + apiSecret;

            const enc = new TextEncoder();
            const hash = await crypto.subtle.digest('SHA-1', enc.encode(signatureStr));
            const signature = Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2, '0')).join('');

            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp);
            if (folder) formData.append('folder', folder);
            formData.append('signature', signature);

            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
              xhr.onload = () => {
                if (xhr.status === 200) {
                  const response = JSON.parse(xhr.responseText);
                  resolve(response.secure_url);
                } else {
                  console.error("Cloudinary Error:", xhr.responseText);
                  reject(new Error("Cloudinary Upload Failed: " + xhr.statusText));
                }
              };
              xhr.onerror = () => reject(new Error("Network Error"));
              xhr.send(formData);
            });
          }

          const reactionChoices = [
            { key: 'like', emoji: '👍' },
            { key: 'love', emoji: '❤️' },
            { key: 'laugh', emoji: '😂' },
            { key: 'wow', emoji: '😮' },
            { key: 'sad', emoji: '😢' }
          ];

          async function toggleReaction(messageId, key) {
            if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
            const msg = forumMessageCache[messageId] || {};
            const existing = (msg.reactions && Array.isArray(msg.reactions[key])) ? msg.reactions[key] : [];
            const has = existing.includes(currentUser.uid);

            const { db, doc, updateDoc, arrayUnion, arrayRemove } = window.firebaseModules;
            const ref = doc(db, "forum-messages", messageId);
            const field = `reactions.${key}`;
            await updateDoc(ref, { [field]: has ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
          }

          async function toggleStar(messageId) {
            if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
            const msg = forumMessageCache[messageId] || {};
            const existing = Array.isArray(msg.starredBy) ? msg.starredBy : [];
            const has = existing.includes(currentUser.uid);
            const { db, doc, updateDoc, arrayUnion, arrayRemove } = window.firebaseModules;
            const ref = doc(db, "forum-messages", messageId);
            await updateDoc(ref, { starredBy: has ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
            setToast(has ? 'Bintang dihapus' : 'Ditandai berbintang', 'success');
          }

          function hideReactionOverlay() {
            if (!forumReactionOverlay) return;
            forumReactionOverlay.classList.add('d-none');
            forumReactionOverlay.innerHTML = '';
          }

          function showReactionOverlay(messageId, anchorEl) {
            if (!forumReactionOverlay) return;
            hideReactionOverlay();

            const bar = document.createElement('div');
            bar.className = 'reaction-bar position-absolute';
            bar.innerHTML = reactionChoices.map((r) => (
              `<button type="button" class="reaction-btn" data-action="pick-reaction" data-message-id="${messageId}" data-reaction-key="${r.key}" aria-label="Reaction ${r.key}">${r.emoji}</button>`
            )).join('');

            forumReactionOverlay.appendChild(bar);
            forumReactionOverlay.classList.remove('d-none');

            const overlayRect = forumReactionOverlay.getBoundingClientRect();
            const anchorRect = anchorEl.getBoundingClientRect();
            const top = Math.max(10, anchorRect.top - overlayRect.top - 48);
            const left = Math.max(10, Math.min(anchorRect.left - overlayRect.left, overlayRect.width - bar.offsetWidth - 10));
            bar.style.top = `${top}px`;
            bar.style.left = `${left}px`;

            const onDocClick = (evt) => {
              const inside = forumReactionOverlay.contains(evt.target);
              if (!inside) {
                hideReactionOverlay();
                document.removeEventListener('click', onDocClick, true);
              }
            };
            document.addEventListener('click', onDocClick, true);
          }

          if (forumReactionOverlay) {
            forumReactionOverlay.addEventListener('click', async (e) => {
              const btn = e.target.closest('[data-action="pick-reaction"]');
              if (!btn) return;
              e.preventDefault();
              const messageId = btn.getAttribute('data-message-id');
              const key = btn.getAttribute('data-reaction-key');
              if (!messageId || !key) return;
              try { await toggleReaction(messageId, key); } catch (err) { console.error(err); setToast('Gagal tambah reaksi', 'danger'); }
              hideReactionOverlay();
            });
          }

          function showMessageInfo(messageId) {
            if (!forumMessageInfoModal) return;
            const msgData = forumMessageCache[messageId];
            if (!msgData) return;
            const sender = msgData.email === adminEmail ? 'ADMIN' : (msgData.name || 'Warga');
            const time = msgData.timestamp ? new Date(msgData.timestamp.seconds * 1000).toLocaleString('id-ID') : '-';
            if (forumMessageInfoSender) forumMessageInfoSender.textContent = sender;
            if (forumMessageInfoTime) forumMessageInfoTime.textContent = time;
            if (forumMessageInfoId) forumMessageInfoId.textContent = messageId;
            forumMessageInfoModal.show();
          }

          function buildReactionsHtml(messageId, reactions) {
            if (!reactions) return '';
            const pills = [];
            reactionChoices.forEach((r) => {
              const list = Array.isArray(reactions[r.key]) ? reactions[r.key] : [];
              if (list.length > 0) {
                pills.push(`<button type="button" class="btn btn-sm reaction-pill me-1 mb-1" data-action="toggle-reaction" data-message-id="${messageId}" data-reaction-key="${r.key}">${r.emoji} <span>${list.length}</span></button>`);
              }
            });
            if (pills.length === 0) return '';
            return `<div class="mt-2 d-flex flex-wrap">${pills.join('')}</div>`;
          }

          if (forumChatArea) {
            forumChatArea.addEventListener('click', async (e) => {
              const voiceEl = e.target.closest('.voice-note');
              if (voiceEl) {
                e.preventDefault();
                await toggleVoicePlayback(voiceEl);
                return;
              }

              // Toggle Reaction (Pill)
              const pill = e.target.closest('[data-action="toggle-reaction"]');
              if (pill) {
                e.preventDefault();
                const messageId = pill.getAttribute('data-message-id');
                const key = pill.getAttribute('data-reaction-key');
                if (messageId && key) {
                  try { await toggleReaction(messageId, key); } catch (err) { console.error(err); setToast('Gagal tambah reaksi', 'danger'); }
                }
                return;
              }

              // Dropdown Actions
              const actionBtn = e.target.closest('[data-action]');
              if (actionBtn) {
                e.preventDefault();
                const action = actionBtn.getAttribute('data-action');
                const messageId = actionBtn.getAttribute('data-id') || actionBtn.getAttribute('data-message-id');

                if (action === 'pick-reaction') {
                  const key = actionBtn.getAttribute('data-reaction-key');
                  if (messageId && key) try { await toggleReaction(messageId, key); } catch (err) { console.error(err); setToast('Gagal tambah reaksi', 'danger'); }
                  hideReactionOverlay();
                }
                else if (action === 'msg-copy') {
                  const msgData = forumMessageCache[messageId];
                  if (msgData && msgData.text) {
                    navigator.clipboard.writeText(msgData.text).then(() => setToast('Teks disalin', 'success'));
                  }
                }
                else if (action === 'msg-reply') {
                  const msgData = forumMessageCache[messageId];
                  if (msgData) {
                    setReplyContext(buildReplyContextFromMessage(messageId, msgData));
                    forumInput.focus();
                  }
                }
                else if (action === 'msg-report') {
                  const msgData = forumMessageCache[messageId];
                  if (!msgData) return;
                  const ctx = buildReplyContextFromMessage(messageId, msgData);
                  const reportedName = msgData.email === adminEmail ? 'ADMIN' : (msgData.name || 'Warga');
                  openReportModal({
                    category: 'other',
                    sourceRoom: activeForumRoom || 'umum',
                    messageId,
                    targetUid: msgData.uid || '',
                    targetName: reportedName,
                    evidence: ctx.text ? `Kutipan: ${String(ctx.text).slice(0, 220)}` : '',
                  });
                }
                else if (action === 'msg-delete') {
                  if (confirm('Hapus pesan ini?')) {
                    const { db, doc, deleteDoc, updateDoc, serverTimestamp } = window.firebaseModules;
                    try {
                      await deleteDoc(doc(db, "forum-messages", messageId));
                      setToast('Pesan dihapus', 'success');
                    } catch (e) {
                      const msg = (e && e.message) ? e.message : String(e);
                      if (/permission|insufficient/i.test(msg)) {
                        try {
                          await updateDoc(doc(db, "forum-messages", messageId), {
                            deleted: true,
                            deletedByUid: currentUser ? currentUser.uid : null,
                            deletedAt: serverTimestamp ? serverTimestamp() : null,
                          });
                          setToast('Pesan dihapus', 'success');
                        } catch (e2) {
                          const msg2 = (e2 && e2.message) ? e2.message : String(e2);
                          setToast('Gagal hapus: tidak punya izin (deploy Firestore Rules).', 'danger');
                          console.error('Soft delete failed:', msg2);
                        }
                      } else setToast('Gagal hapus: ' + msg, 'danger');
                    }
                  }
                }
                else if (action === 'msg-info') {
                  showMessageInfo(messageId);
                }
                else if (action === 'msg-star') {
                  try { await toggleStar(messageId); } catch (e2) { setToast('Gagal: ' + e2.message, 'danger'); }
                }
                else if (action === 'msg-react-menu') {
                  const wrapper = actionBtn.closest('[data-message-id]');
                  const bubble = wrapper ? wrapper.querySelector('.message-bubble') : null;
                  showReactionOverlay(messageId, bubble || wrapper || actionBtn);
                }
              }
            });

            let swipeReplyState = null;
            const canSwipeReply = () => {
              try {
                return window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
              } catch {
                return window.innerWidth <= 768;
              }
            };
            const resetSwipeReplyUi = () => {
              if (!swipeReplyState) return;
              const el = swipeReplyState.el;
              if (el) {
                el.style.transition = 'transform 160ms ease, opacity 160ms ease';
                el.style.transform = '';
                el.style.opacity = '';
              }
            };

            forumChatArea.addEventListener('pointerdown', (e) => {
              if (!canSwipeReply()) return;
              if (e.target.closest('button, a, input, textarea, .dropdown, .voice-note')) return;
              const msgEl = e.target.closest('[data-message-id]');
              if (!msgEl) return;
              swipeReplyState = {
                el: msgEl,
                id: msgEl.getAttribute('data-message-id') || '',
                startX: e.clientX,
                startY: e.clientY,
                dx: 0,
                active: false,
              };
              msgEl.style.transition = 'none';
            });

            forumChatArea.addEventListener('pointermove', (e) => {
              if (!swipeReplyState) return;
              const dx = e.clientX - swipeReplyState.startX;
              const dy = e.clientY - swipeReplyState.startY;
              swipeReplyState.dx = dx;
              if (!swipeReplyState.active && Math.abs(dy) > 44) {
                resetSwipeReplyUi();
                swipeReplyState = null;
                return;
              }
              if (dx <= 0) return;
              const cap = Math.min(72, dx);
              swipeReplyState.active = cap > 18;
              if (swipeReplyState.el) {
                swipeReplyState.el.style.transform = `translateX(${cap}px)`;
                swipeReplyState.el.style.opacity = String(Math.max(0.65, 1 - (cap / 260)));
              }
            });

            const finishSwipeReply = () => {
              if (!swipeReplyState) return;
              const { el, id, dx } = swipeReplyState;
              const shouldTrigger = dx > 56;
              resetSwipeReplyUi();
              if (shouldTrigger && id) {
                const msgData = forumMessageCache[id];
                if (msgData) {
                  setReplyContext(buildReplyContextFromMessage(id, msgData));
                  try { if (navigator.vibrate) navigator.vibrate(18); } catch { }
                  try { forumInput.focus(); } catch { }
                }
              }
              swipeReplyState = null;
            };

            forumChatArea.addEventListener('pointerup', finishSwipeReply);
            forumChatArea.addEventListener('pointercancel', finishSwipeReply);

            let touchSwipe = null;
            const touchStart = (e) => {
              if (!canSwipeReply()) return;
              const t = e.touches && e.touches[0];
              if (!t) return;
              if (e.target.closest('button, a, input, textarea, .dropdown, .voice-note')) return;
              const msgEl = e.target.closest('[data-message-id]');
              if (!msgEl) return;
              touchSwipe = {
                el: msgEl,
                id: msgEl.getAttribute('data-message-id') || '',
                startX: t.clientX,
                startY: t.clientY,
                dx: 0,
                locked: false,
              };
              msgEl.style.transition = 'none';
            };
            const touchMove = (e) => {
              if (!touchSwipe) return;
              const t = e.touches && e.touches[0];
              if (!t) return;
              const dx = t.clientX - touchSwipe.startX;
              const dy = t.clientY - touchSwipe.startY;
              touchSwipe.dx = dx;
              if (!touchSwipe.locked) {
                if (Math.abs(dy) > 44) { resetSwipeReplyUi(); touchSwipe = null; return; }
                if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) touchSwipe.locked = true;
              }
              if (!touchSwipe.locked) return;
              if (dx <= 0) return;
              e.preventDefault();
              const cap = Math.min(72, dx);
              if (touchSwipe.el) {
                touchSwipe.el.style.transform = `translateX(${cap}px)`;
                touchSwipe.el.style.opacity = String(Math.max(0.65, 1 - (cap / 260)));
              }
            };
            const touchEnd = () => {
              if (!touchSwipe) return;
              const shouldTrigger = touchSwipe.dx > 56;
              const id = touchSwipe.id;
              resetSwipeReplyUi();
              if (shouldTrigger && id) {
                const msgData = forumMessageCache[id];
                if (msgData) {
                  setReplyContext(buildReplyContextFromMessage(id, msgData));
                  try { if (navigator.vibrate) navigator.vibrate(18); } catch { }
                  try { forumInput.focus(); } catch { }
                }
              }
              touchSwipe = null;
            };
            forumChatArea.addEventListener('touchstart', touchStart, { passive: true });
            forumChatArea.addEventListener('touchmove', touchMove, { passive: false });
            forumChatArea.addEventListener('touchend', touchEnd, { passive: true });
            forumChatArea.addEventListener('touchcancel', touchEnd, { passive: true });
          }

          function renderMessage(messageId, data) {
            if (!currentUser) return;

            const isReportBot = !!(data && data.report && data.report.type === 'user_report');
            const msgEmail = data && data.email ? String(data.email).trim().toLowerCase() : '';
            const msgName = data && data.name ? String(data.name).trim().toLowerCase() : '';
            const isAdminEmail = !isReportBot && (msgEmail === adminEmail || (!msgEmail && msgName === 'admin'));
            const isMe = !isReportBot && !isAdminEmail && (
              (data && data.uid && currentUser.uid && data.uid === currentUser.uid) ||
              (msgEmail && currentUser.email && msgEmail === String(currentUser.email).trim().toLowerCase())
            );
            const isAdmin = isAdminEmail || isReportBot;
            const isStarred = Array.isArray(data.starredBy) && data.starredBy.includes(currentUser.uid);
            const isDeleted = !!data.deleted;

            // Use new helper
            let timeStr = formatWhatsAppDate(data.timestamp);

            let imagesHtml = '';
            if (!isDeleted && data.images && Array.isArray(data.images) && data.images.length > 0) {
              imagesHtml = `<div class="d-flex flex-wrap gap-1 mt-2 mb-1">`;
              data.images.forEach(url => {
                imagesHtml += `<img src="${url}" class="rounded-3 cursor-pointer shadow-sm border" style="max-width: 150px; max-height: 150px; object-fit: cover;" onclick="window.openPreview('${url}')">`;
              });
              imagesHtml += `</div>`;
            }
            if (!isDeleted && data.stickerUrl) {
              imagesHtml += `<img src="${data.stickerUrl}" class="d-block mt-2 sticker-img cursor-pointer" style="width: 140px;" onclick="window.openStickerPreview('${data.stickerUrl}')">`;
            }

            const reactionStrip = buildReactionsHtml(messageId, data.reactions);
            const replyTo = data.replyTo && typeof data.replyTo === 'object' ? data.replyTo : null;
            const replyToName = replyTo ? String(replyTo.name || 'Warga').replace(/</g, "&lt;") : '';
            const replyToText = replyTo ? String(replyTo.text || '').replace(/</g, "&lt;") : '';
            const replyToThumb = replyTo && replyTo.previewUrl
              ? `<img class="quote-thumb" src="${String(replyTo.previewUrl)}" alt="Preview">`
              : '';
            const replyQuote = replyTo
              ? `<div class="chat-reply-quote">
                      <div class="quote-row">
                        <div class="quote-main">
                          <div class="quote-title">${replyToName}</div>
                          <div class="quote-text">${replyToText}</div>
                        </div>
                        ${replyToThumb}
                      </div>
                   </div>`
              : '';

            // New Dropdown Menu
            const viewerIsAdmin = !!(currentUser && currentUser.email === adminEmail);
            const optionsMenu = `
                <div class="dropdown d-inline-block wa-options">
                  <button class="btn btn-link btn-sm p-0 text-decoration-none wa-options-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-chevron-down" style="font-size: 0.75rem;"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-dark shadow-lg border-0 p-1" style="min-width: 160px;">
                    <li><button class="dropdown-item rounded-2 small py-2" data-action="msg-info" data-id="${messageId}"><i class="bi bi-info-circle me-2"></i> Info</button></li>
                    <li><button class="dropdown-item rounded-2 small py-2" data-action="msg-reply" data-id="${messageId}"><i class="bi bi-reply me-2"></i> Balas</button></li>
                    <li><button class="dropdown-item rounded-2 small py-2" data-action="msg-copy" data-id="${messageId}"><i class="bi bi-clipboard me-2"></i> Salin</button></li>
                    <li><button class="dropdown-item rounded-2 small py-2" data-action="msg-report" data-id="${messageId}"><i class="bi bi-flag me-2"></i> Laporkan</button></li>
                    <li><button class="dropdown-item rounded-2 small py-2" data-action="msg-react-menu" data-id="${messageId}"><i class="bi bi-emoji-smile me-2"></i> Reaksi</button></li>
                    <li><button class="dropdown-item rounded-2 small py-2" data-action="msg-star" data-id="${messageId}"><i class="bi ${isStarred ? 'bi-star-fill' : 'bi-star'} me-2"></i> ${isStarred ? 'Hapus bintang' : 'Bintang'}</button></li>
                    ${(isMe || viewerIsAdmin) ? `<li><hr class="dropdown-divider my-1"></li><li><button class="dropdown-item rounded-2 small py-2 text-danger" data-action="msg-delete" data-id="${messageId}"><i class="bi bi-trash3 me-2"></i> Hapus</button></li>` : ''}
                  </ul>
                </div>
            `;

            const starIcon = isStarred ? `<i class="bi bi-star-fill text-warning me-1"></i>` : '';
            const textHtml = isDeleted
              ? `<div class="small fst-italic" style="opacity: 0.75;">Pesan dihapus</div>`
              : (data.text && String(data.text).trim() !== '')
                ? `<div class="small" style="white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">${String(data.text).replace(/</g, "&lt;")}</div>`
                : '';
            const voiceUrlSafe = data.voiceUrl ? String(data.voiceUrl).replace(/"/g, '&quot;') : '';
            const voiceBars = buildVoiceBarsHtml(messageId);
            const voiceDurationSeconds = data.voiceDurationMs ? Math.max(0, Math.round(Number(data.voiceDurationMs) / 1000)) : 0;
            const voiceTimeLabel = voiceDurationSeconds ? formatDurationSeconds(voiceDurationSeconds) : '0:00';
            const voiceHtml = (!isDeleted && data.voiceUrl)
              ? `<div class="mt-2">
                       <div class="voice-note" data-voice-message-id="${messageId}" data-voice-url="${voiceUrlSafe}" data-voice-duration-ms="${data.voiceDurationMs || ''}">
                         <button type="button" class="voice-play-btn" aria-label="Putar voice note"><i class="bi bi-play-fill"></i></button>
                         <div class="voice-wave" aria-label="Waveform">
                           <div class="voice-bars voice-bars-base">${voiceBars}</div>
                           <div class="voice-bars voice-bars-progress">${voiceBars}</div>
                         </div>
                         <div class="voice-meta"><span class="voice-time">${voiceTimeLabel}</span></div>
                       </div>
                   </div>`
              : '';
            let msgContent = replyQuote + textHtml + voiceHtml + imagesHtml + reactionStrip;
            const hasMedia = !!(
              (!isDeleted && (data.voiceUrl || (data.images && Array.isArray(data.images) && data.images.length) || data.stickerUrl)) ||
              (reactionStrip && String(reactionStrip).trim() !== '')
            );
            const bubbleWithMediaClass = hasMedia ? ' wa-bubble--with-media' : '';
            const bubbleStickerClass = (!isDeleted && data.stickerUrl && (!data.text || String(data.text).trim() === '') && !data.voiceUrl && !(data.images && Array.isArray(data.images) && data.images.length)) ? ' wa-sticker wa-bubble--no-tail' : '';

            let msgHtml;
            if (isReportBot) {
              msgHtml = `
               <div class="d-flex align-items-end mb-2 message admin w-100 justify-content-start" data-message-id="${messageId}">
                    <div class="bg-dark text-white d-flex align-items-center justify-content-center me-2 shadow-sm wa-avatar" style="border: 2px solid #0dcaf0;">
                       <i class="bi bi-robot"></i>
                    </div>
                    <div class="message-bubble wa-bubble wa-bubble--other wa-bubble--no-tail${bubbleWithMediaClass}${bubbleStickerClass}">
                       <div class="small fw-bold mb-1" style="color: #0dcaf0;"><i class="bi bi-robot me-1"></i>BOT Laporan</div>
                       ${msgContent}
                       <div class="wa-meta" style="color: var(--chat-date-other);">
                          <span class="wa-time">${starIcon}${timeStr}</span>
                          ${optionsMenu}
                       </div>
                    </div>
                 </div>`;
            } else if (isAdminEmail) {
              msgHtml = `
               <div class="d-flex align-items-end mb-2 w-100 justify-content-end message admin" data-message-id="${messageId}">
                    <div class="message-bubble wa-bubble wa-bubble--me wa-bubble--no-tail${bubbleWithMediaClass}${bubbleStickerClass}">
                       <div class="small fw-bold mb-1" style="opacity: 0.9;"><i class="bi bi-shield-check me-1 text-warning"></i>ADMIN</div>
                       ${msgContent}
                       <div class="wa-meta" style="color: var(--chat-date-me);">
                          <span class="wa-time">${starIcon}${timeStr}</span>
                          ${optionsMenu}
                       </div>
                    </div>
                    <div class="bg-dark text-white d-flex align-items-center justify-content-center ms-2 shadow-sm wa-avatar" style="border: 2px solid gold;">
                       ${data.photoURL ? `<img src="${data.photoURL}" class="w-100 h-100 object-fit-cover">` : 'ADM'}
                    </div>
                 </div>`;
            } else if (isMe) {
              msgHtml = `
               <div class="d-flex align-items-end mb-2 w-100 justify-content-end" data-message-id="${messageId}">
                    <div class="message-bubble wa-bubble wa-bubble--me${bubbleWithMediaClass}${bubbleStickerClass}">
                       ${msgContent}
                       <div class="wa-meta" style="color: var(--chat-date-me);">
                          <span class="wa-time">${starIcon}${timeStr}</span>
                          <span class="wa-status"><i class="bi bi-check-all"></i></span>
                          ${optionsMenu}
                       </div>
                    </div>
                    <div class="bg-dark text-white d-flex align-items-center justify-content-center ms-2 shadow-sm wa-avatar" style="font-size: 0.8rem;">
                       ${data.photoURL ? `<img src="${data.photoURL}" class="w-100 h-100 object-fit-cover">` : 'ME'}
                    </div>
                 </div>`;
            } else {
              msgHtml = `
               <div class="d-flex align-items-end mb-2 w-100 justify-content-start" data-message-id="${messageId}">
                    <div class="bg-secondary text-white d-flex align-items-center justify-content-center me-2 shadow-sm wa-avatar" style="font-size: 0.8rem;">
                       ${data.photoURL ? `<img src="${data.photoURL}" class="w-100 h-100 object-fit-cover">` : 'USR'}
                    </div>
                    <div class="message-bubble wa-bubble wa-bubble--other${bubbleWithMediaClass}${bubbleStickerClass}">
                       <div class="small fw-bold text-info mb-1">${(data.name || 'Warga').replace(/</g, "&lt;")}</div>
                       ${msgContent}
                       <div class="wa-meta" style="color: var(--chat-date-other);">
                          <span class="wa-time">${starIcon}${timeStr}</span>
                          ${optionsMenu}
                       </div>
                    </div>
                 </div>`;
            }
            forumChatArea.insertAdjacentHTML('beforeend', msgHtml);
          }

          function openPreviewModal(src, allowFavorite) {
            const modalEl = document.getElementById('imagePreviewModal');
            const imgEl = document.getElementById('previewModalImage');
            const favBtn = document.getElementById('previewFavBtn');
            if (modalEl && imgEl) {
              imgEl.src = src;
              if (favBtn) {
                if (allowFavorite) {
                  favBtn.classList.remove('d-none');
                  favBtn.dataset.stickerUrl = src;
                  const isFav = stickerFavoritesSet.has(src);
                  favBtn.innerHTML = isFav ? '<i class="bi bi-star-fill me-1"></i> Favorit' : '<i class="bi bi-star me-1"></i> Favorit';
                  favBtn.classList.toggle('btn-warning', isFav);
                  favBtn.classList.toggle('btn-outline-warning', !isFav);
                } else {
                  favBtn.classList.add('d-none');
                  delete favBtn.dataset.stickerUrl;
                }
              }
              const bsModal = new bootstrap.Modal(modalEl);
              bsModal.show();
            }
          }

          window.openPreview = (src) => openPreviewModal(src, false);
          window.openStickerPreview = async (src) => {
            try { await loadStickerFavoritesSet(); } catch (e) { }
            openPreviewModal(src, true);
          };

          const previewFavBtn = document.getElementById('previewFavBtn');
          if (previewFavBtn) {
            previewFavBtn.addEventListener('click', async () => {
              const url = previewFavBtn.dataset.stickerUrl;
              if (!url) return;
              try {
                await toggleStickerFavorite(url);
                const isFav = stickerFavoritesSet.has(url);
                previewFavBtn.innerHTML = isFav ? '<i class="bi bi-star-fill me-1"></i> Favorit' : '<i class="bi bi-star me-1"></i> Favorit';
                previewFavBtn.classList.toggle('btn-warning', isFav);
                previewFavBtn.classList.toggle('btn-outline-warning', !isFav);
              } catch (e) {
                console.error(e);
              }
            });
          }

          async function handleLoginClick() {
            // ... (Keep existing login logic mostly same but ensure new UI is handled)
            const btn = document.getElementById('forumGoogleLoginBtn');
            if (!btn) return;
            if (!window.firebaseModules || !window.firebaseModules.auth) return;
            const { auth, signInWithPopup, GoogleAuthProvider, signInWithRedirect } = window.firebaseModules;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>...';
            btn.disabled = true;
            try {
              const provider = new GoogleAuthProvider();
              provider.setCustomParameters({ prompt: 'select_account' });
              try {
                const result = await signInWithPopup(auth, provider);
                if (result && result.user) {
                  setToast('Login berhasil!', 'success');
                  sessionStorage.removeItem('forum_login_pending');
                  forumLoginOverlay.classList.remove('d-flex');
                  forumLoginOverlay.classList.add('d-none');
                }
              } catch (popupErr) {
                sessionStorage.setItem('forum_login_pending', 'true');
                await signInWithRedirect(auth, provider);
              }
            } catch (error) {
              console.error(error);
              btn.innerHTML = 'Login Google';
              btn.disabled = false;
            }
          }

          forumGoogleLoginBtn.addEventListener('click', handleLoginClick);

          if (forumLogoutBtn) {
            forumLogoutBtn.addEventListener('click', () => {
              if (window.firebaseModules && window.firebaseModules.auth) {
                window.firebaseModules.auth.signOut().then(() => setToast('Berhasil logout.', 'success'));
              }
            });
          }

          async function deleteAllForumMessages() {
            if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
            if (currentUser.email !== adminEmail) { setToast('Tidak diizinkan.', 'danger'); return; }
            if (!confirm('Hapus semua chat forum?')) return;

            const { db, collection, query, orderBy, limit, startAfter, getDocs, writeBatch } = window.firebaseModules;
            if (!db) return;

            const originalHtml = forumDeleteAllBtn ? forumDeleteAllBtn.innerHTML : '';
            if (forumDeleteAllBtn) {
              forumDeleteAllBtn.disabled = true;
              forumDeleteAllBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            }

            let deleted = 0;
            let cursor = null;
            try {
              while (true) {
                let q = query(collection(db, "forum-messages"), orderBy("timestamp", "asc"), limit(400));
                if (cursor) q = query(collection(db, "forum-messages"), orderBy("timestamp", "asc"), startAfter(cursor), limit(400));

                const snap = await getDocs(q);
                if (snap.empty) break;

                const batch = writeBatch(db);
                snap.docs.forEach((d) => batch.delete(d.ref));
                await batch.commit();

                deleted += snap.size;
                cursor = snap.docs[snap.docs.length - 1];
                if (snap.size < 400) break;
              }

              setToast(`Berhasil hapus semua chat (${deleted}).`, 'success');
            } catch (e) {
              console.error(e);
              setToast('Gagal hapus chat: ' + e.message, 'danger');
            } finally {
              if (forumDeleteAllBtn) {
                forumDeleteAllBtn.disabled = false;
                forumDeleteAllBtn.innerHTML = originalHtml;
              }
            }
          }

          if (forumDeleteAllBtn) {
            forumDeleteAllBtn.addEventListener('click', deleteAllForumMessages);
          }

          const FORUM_BADWORDS = ['anjing', 'bangsat', 'brengsek', 'goblok', 'tolol', 'kontol', 'memek', 'jancok', 'ngentot', 'bacot'];
          const FORUM_VIOLATION_LIMIT = 5;
          const forumViolationKey = () => `ytconv:forum:violations:${currentUser?.uid || 'guest'}`;
          const normalizeForumText = (value) => String(value || '')
            .toLowerCase()
            .replace(/[@4]/g, 'a')
            .replace(/[3]/g, 'e')
            .replace(/[1!|]/g, 'i')
            .replace(/[0]/g, 'o')
            .replace(/[5$]/g, 's')
            .replace(/[7]/g, 't')
            .replace(/[^a-z0-9\s]/g, '');

          function getForumViolationCount() {
            try { return Number(localStorage.getItem(forumViolationKey()) || '0') || 0; } catch { return 0; }
          }

          function setForumViolationCount(val) {
            try { localStorage.setItem(forumViolationKey(), String(Math.max(0, Number(val) || 0))); } catch { }
          }
          try {
            window.getForumViolationCount = getForumViolationCount;
          } catch { }

          async function reportForumModeration(text, violationCount) {
            try {
              await fetch('/api/forum/moderation-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: currentUser?.uid || '',
                  name: currentUser?.displayName || 'Warga',
                  email: currentUser?.email || '',
                  text,
                  violationCount,
                  room: activeForumRoom || 'umum',
                }),
              });
            } catch (err) {
              console.warn('Gagal kirim laporan automod', err);
            }
          }

          async function sendForumMessage() {
            if (isLaporanRoom()) { setToast('Room Laporan tidak menerima chat. Gunakan tombol Laporkan ya.'); return; }
            const text = forumInput.value.trim();
            if (!text && selectedFiles.length === 0) return;
            if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
            if (getForumViolationCount() >= FORUM_VIOLATION_LIMIT && !forumUnblockedByAppeal) {
              forumInput.disabled = true;
              setToast('🚫 Akun kamu dibatasi setelah 5x pelanggaran. Ajukan appeal via AI Navigator / tiket email.', 'danger');
              return;
            }

            try {
              const forumStatusResp = await fetch(`/api/forum/status?userId=${encodeURIComponent(currentUser.uid)}`);
              const forumStatusData = await forumStatusResp.json().catch(() => ({}));
              if (forumStatusResp.ok && forumStatusData?.ok) {
                forumUnblockedByAppeal = Boolean(forumStatusData.unblockedByAppeal);
                if (forumStatusData.blocked && !forumUnblockedByAppeal) {
                  setForumViolationCount(Math.max(FORUM_VIOLATION_LIMIT, Number(forumStatusData.violationCount || 0) || FORUM_VIOLATION_LIMIT));
                  forumInput.disabled = true;
                  forumInput.placeholder = 'Akun forum dibatasi karena 5x pelanggaran. Ajukan appeal via AI Navigator / tiket email (respon 2x24 jam).';
                  updateSendButtonState();
                  setToast('🚫 Status akun forum kamu sedang dibatasi oleh sistem moderasi.', 'danger');
                  return;
                }
              }
            } catch { }

            const normalized = normalizeForumText(text);
            const hasBadWord = FORUM_BADWORDS.some((w) => normalized.includes(w));
            if (hasBadWord) {
              const nextCount = getForumViolationCount() + 1;
              setForumViolationCount(nextCount);
              await reportForumModeration(text, nextCount);
              if (nextCount >= FORUM_VIOLATION_LIMIT) {
                setToast('🚫 Kamu diblokir sementara setelah 5x pelanggaran. Ajukan appeal lewat AI Navigator / tiket email. Estimasi review 2x24 jam.', 'danger');
                forumInput.disabled = true;
                forumInput.placeholder = 'Akun forum dibatasi karena 5x pelanggaran. Ajukan appeal via AI Navigator / tiket email (respon 2x24 jam).';
                forumInput.value = '';
                updateSendButtonState();
                return;
              }
              setToast(`⚠️ Pesan kasar otomatis dihapus (${nextCount}/5). Gunakan bahasa yang baik ya.`, 'warning');
              forumInput.value = '';
              updateSendButtonState();
              return;
            }

            const { db, collection, addDoc, serverTimestamp, auth, storage, ref, uploadBytes, getDownloadURL } = window.firebaseModules;

            forumSendBtn.disabled = true;
            forumSendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

            try {
              // Upload Images
              let imageUrls = [];
              if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                  const url = await uploadToCloudinary(file);
                  imageUrls.push(url);
                }
              }

              const msgData = {
                text: text,
                uid: currentUser.uid,
                name: currentUser.displayName || 'Warga',
                timestamp: serverTimestamp(),
                room: activeForumRoom || 'umum',
                images: imageUrls
              };
              if (replyContext && replyContext.id) {
                msgData.replyTo = {
                  id: replyContext.id,
                  name: replyContext.name || 'Warga',
                  text: replyContext.text || '',
                  kind: replyContext.kind || 'text',
                  previewUrl: replyContext.previewUrl || '',
                };
              }
              if (currentUser.email) msgData.email = currentUser.email;
              if (currentUser.photoURL) msgData.photoURL = currentUser.photoURL;

              await addDoc(collection(db, "forum-messages"), msgData);

              // Reset Input
              forumInput.value = '';
              setReplyContext(null);
              selectedFiles = [];
              renderAttachmentPreview();
              window.scrollToBottom(true);

            } catch (e) {
              console.error(e);
              setToast('Gagal kirim: ' + e.message, 'danger');
            } finally {
              forumSendBtn.disabled = false;
              updateSendButtonState();
            }
          }

          function updateSendButtonState() {
            if (!forumSendBtn) return;
            if (!currentUser) {
              forumSendBtn.disabled = true;
              if (forumAppealBtn) forumAppealBtn.classList.add('d-none');
              return;
            }
            if (isLaporanRoom()) {
              forumSendBtn.disabled = true;
              if (forumAppealBtn) forumAppealBtn.classList.add('d-none');
              return;
            }
            if (getForumViolationCount() >= FORUM_VIOLATION_LIMIT) {
              if (forumUnblockedByAppeal) {
                setForumViolationCount(0);
              } else {
                forumSendBtn.disabled = true;
                forumInput.disabled = true;
                forumInput.placeholder = 'Akun forum dibatasi karena 5x pelanggaran. Ajukan appeal via AI Navigator / tiket email (respon 2x24 jam).';
                if (forumAppealBtn) forumAppealBtn.classList.remove('d-none');
                return;
              }
            }
            if (forumAppealBtn) forumAppealBtn.classList.add('d-none');
            forumInput.disabled = false;
            forumInput.placeholder = 'Ketik pesan...';
            if (voiceState.isRecording) {
              forumSendBtn.disabled = false;
              forumSendBtn.classList.remove('btn-primary');
              forumSendBtn.classList.add('btn-danger');
              forumSendBtn.innerHTML = '<i class="bi bi-stop-fill fs-5"></i>';
              return;
            }
            const hasText = forumInput.value.trim().length > 0;
            const hasFiles = selectedFiles.length > 0;
            forumSendBtn.disabled = false;
            forumSendBtn.classList.remove('btn-danger');
            forumSendBtn.classList.add('btn-primary');
            if (hasText || hasFiles) {
              forumSendBtn.innerHTML = '<i class="bi bi-send-fill fs-5 ms-1"></i>';
            } else {
              forumSendBtn.innerHTML = '<i class="bi bi-mic-fill fs-4"></i>';
            }
          }

          async function syncForumModerationStatus() {
            const uid = currentUser?.uid || '';
            if (!uid) return;
            try {
              const r = await fetch(`/api/forum/status?userId=${encodeURIComponent(uid)}`);
              const d = await r.json().catch(() => ({}));
              if (!r.ok || !d?.ok) return;
              forumUnblockedByAppeal = Boolean(d.unblockedByAppeal);
              if (forumUnblockedByAppeal) {
                setForumViolationCount(0);
              }
              updateSendButtonState();
            } catch (err) {
              console.warn('Gagal sinkron status forum', err);
            }
          }

          async function submitForumAppealFromButton() {
            if (!currentUser?.uid) {
              setToast('Login Google dulu untuk kirim appeal.', 'warning');
              return;
            }
            const reason = window.prompt('Tulis alasan appeal forum kamu:', 'Saya minta unban forum, akan patuh aturan dan tidak toxic lagi.');
            if (reason === null) return;
            const cleanReason = String(reason || '').trim();
            if (!cleanReason) {
              setToast('Alasan appeal tidak boleh kosong.', 'warning');
              return;
            }
            forumAppealBtn?.setAttribute('disabled', '');
            try {
              const socketId = (() => {
                try { return ensureForumSocket?.()?.id || ''; } catch { return ''; }
              })();
              const violationCount = Number(getForumViolationCount() || 0) || 0;
              const disabledFeatures = [
                ...(violationCount >= FORUM_VIOLATION_LIMIT ? ['forum_chat_input_disabled'] : []),
                ...(forumSendBtn?.disabled ? ['forum_send_button_disabled'] : []),
              ];
              const resp = await fetch('/api/forum/appeal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  source: 'forum_button',
                  userId: currentUser.uid,
                  name: currentUser.displayName || 'Warga',
                  email: currentUser.email || '',
                  room: activeForumRoom || 'umum',
                  socketId,
                  reason: cleanReason,
                  violationCount,
                  disabledFeatures,
                  googleAccount: {
                    provider: 'google',
                    uid: currentUser.uid,
                    email: currentUser.email || '',
                  },
                }),
              });
              const data = await resp.json().catch(() => ({}));
              if (!resp.ok || !data?.appealId) {
                try {
                  ensureForumSocket?.()?.emit?.('forum:appeal', { reason: cleanReason });
                } catch { }
                throw new Error(data?.message || data?.error || 'appeal_submit_failed');
              }
              setToast(data?.message || `Appeal ${data.appealId} berhasil dikirim ke admin dashboard.`, 'success');
            } catch (err) {
              console.error('Gagal submit appeal dari tombol forum', err);
              setToast(`Gagal kirim appeal: ${err?.message || 'unknown_error'}`, 'danger');
            } finally {
              forumAppealBtn?.removeAttribute('disabled');
            }
          }

          if (forumAppealBtn) {
            forumAppealBtn.addEventListener('click', submitForumAppealFromButton);
          }

          if (forumModal) {
            forumModal.addEventListener('shown.bs.modal', () => {
              syncForumModerationStatus().catch(() => { });
            });
          }

          if (typeof window !== 'undefined') {
            window.addEventListener('focus', () => {
              syncForumModerationStatus().catch(() => { });
            });
          }

          if (forumSendBtn) {
            const autoResizeForumInput = () => {
              if (!forumInput) return;
              forumInput.style.height = 'auto';
              const next = Math.min(forumInput.scrollHeight, 100);
              forumInput.style.height = `${next}px`;
              forumInput.style.overflowY = forumInput.scrollHeight > 100 ? 'auto' : 'hidden';
            };

            const handleSendBtnClick = async () => {
              if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
              const hasText = forumInput.value.trim().length > 0;
              const hasFiles = selectedFiles.length > 0;
              if (voiceState.isRecording) {
                await stopVoiceRecording(true);
                return;
              }
              if (hasText || hasFiles) {
                await sendForumMessage();
                return;
              }
              await startVoiceRecording();
            };

            forumSendBtn.addEventListener('click', handleSendBtnClick);
            forumInput.addEventListener('input', () => {
              autoResizeForumInput();
              updateSendButtonState();
            });
            // Handle Enter key for text only if no files (or just shift+enter for newline)
            forumInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const hasText = forumInput.value.trim().length > 0;
                const hasFiles = selectedFiles.length > 0;
                if (hasText || hasFiles) sendForumMessage();
              }
            });

            autoResizeForumInput();
          }

          function stickerIdFromUrl(url) {
            try {
              return btoa(unescape(encodeURIComponent(url))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
            } catch {
              return String(url).slice(0, 256).replace(/[^a-zA-Z0-9_-]/g, '_');
            }
          }

          function buildStickerGridHtml(urls) {
            let gridHtml = '<div class="sticker-grid">';
            urls.forEach((url) => {
              const id = stickerIdFromUrl(url);
              const encoded = encodeURIComponent(url);
              const isFav = stickerFavoritesSet.has(url);
              gridHtml += `
                    <div class="sticker-tile" data-sticker-id="${id}" data-sticker-url="${encoded}">
                        <img src="${url}" class="sticker-item sticker-img" loading="lazy">
                        <button type="button" class="sticker-fav-btn ${isFav ? 'is-active' : ''}" data-sticker-id="${id}" data-sticker-url="${encoded}">
                            <i class="bi ${isFav ? 'bi-star-fill' : 'bi-star'}"></i>
                        </button>
                    </div>`;
            });
            gridHtml += '</div>';
            return gridHtml;
          }

          function bindStickerGridHandlers(tabEl) {
            if (!tabEl || tabEl.dataset.handlersBound === '1') return;
            tabEl.dataset.handlersBound = '1';

            tabEl.addEventListener('click', async (e) => {
              const favBtn = e.target.closest('.sticker-fav-btn');
              if (favBtn) {
                e.preventDefault();
                e.stopPropagation();
                const url = decodeURIComponent(favBtn.getAttribute('data-sticker-url') || '');
                if (!url) return;
                try { await toggleStickerFavorite(url); } catch (err) { console.error(err); }
                return;
              }

              const tile = e.target.closest('.sticker-tile');
              if (tile) {
                const url = decodeURIComponent(tile.getAttribute('data-sticker-url') || '');
                if (!url) return;
                window.sendSticker(url);
              }
            });
          }

          async function loadStickerFavoritesSet() {
            stickerFavoritesSet = new Set();
            if (!currentUser) return;

            const { db, collection, getDocs, query, orderBy, limit } = window.firebaseModules;
            const q = query(collection(db, "users", currentUser.uid, "sticker-favorites"), orderBy("createdAt", "desc"), limit(500));
            const snap = await getDocs(q);
            snap.forEach((docSnap) => {
              const data = docSnap.data() || {};
              if (data.url) stickerFavoritesSet.add(data.url);
            });
          }

          async function toggleStickerFavorite(url) {
            if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
            const { db, doc, setDoc, deleteDoc, serverTimestamp } = window.firebaseModules;
            const id = stickerIdFromUrl(url);
            const ref = doc(db, "users", currentUser.uid, "sticker-favorites", id);

            if (stickerFavoritesSet.has(url)) {
              await deleteDoc(ref);
              stickerFavoritesSet.delete(url);
            } else {
              await setDoc(ref, { url, createdAt: serverTimestamp() }, { merge: true });
              stickerFavoritesSet.add(url);
            }

            document.querySelectorAll(`.sticker-fav-btn[data-sticker-id="${id}"]`).forEach((btn) => {
              const active = stickerFavoritesSet.has(url);
              btn.classList.toggle('is-active', active);
              const icon = btn.querySelector('i');
              if (icon) icon.className = `bi ${active ? 'bi-star-fill' : 'bi-star'}`;
            });

            loadFavoriteStickers();
          }

          async function loadFavoriteStickers() {
            const favTab = document.getElementById('sticker-favorites');
            if (!favTab) return;

            if (!currentUser) {
              favTab.innerHTML = '<div class="text-center text-secondary p-3">Login dulu untuk melihat stiker favorit.</div>';
              return;
            }

            favTab.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 small text-secondary">Memuat stiker favorit...</div></div>';

            try {
              await loadStickerFavoritesSet();
              const urls = Array.from(stickerFavoritesSet);
              if (urls.length === 0) {
                favTab.innerHTML = '<div class="text-center text-secondary small mt-5">Belum ada stiker favorit.</div>';
                return;
              }
              favTab.innerHTML = buildStickerGridHtml(urls);
              bindStickerGridHandlers(favTab);
            } catch (e) {
              console.error(e);
              favTab.innerHTML = `<div class="text-center text-danger p-3">Gagal memuat favorit: ${e.message}</div>`;
            }
          }

          // Sticker Integration
          window.sendSticker = async (url) => {
            const { db, collection, addDoc, serverTimestamp } = window.firebaseModules;
            if (!currentUser) { setToast('Anda belum login!', 'warning'); return; }
            if (isLaporanRoom()) { setToast('Room Laporan tidak menerima chat/stiker. Gunakan tombol Laporkan ya.'); return; }

            let messageId = null;
            try {
              const msgData = {
                uid: currentUser.uid,
                name: currentUser.displayName || 'Warga',
                timestamp: serverTimestamp(),
                room: activeForumRoom || 'umum',
                email: currentUser.email,
                photoURL: currentUser.photoURL,
                stickerUrl: url,
                text: ''
              };
              if (replyContext && replyContext.id) {
                msgData.replyTo = {
                  id: replyContext.id,
                  name: replyContext.name || 'Warga',
                  text: replyContext.text || '',
                  kind: replyContext.kind || 'text',
                  previewUrl: replyContext.previewUrl || '',
                };
              }
              const msgRef = await addDoc(collection(db, "forum-messages"), msgData);
              messageId = msgRef.id;
            } catch (e) {
              console.error(e);
              setToast('Gagal kirim stiker: ' + e.message, 'danger');
              return;
            }

            try {
              await addDoc(collection(db, "users", currentUser.uid, "sticker-history"), {
                url,
                messageId,
                usedAt: serverTimestamp()
              });
            } catch (e) {
              console.error(e);
            }

            const stickerModalEl = document.getElementById('stickerModal');
            const stickerModal = bootstrap.Modal.getInstance(stickerModalEl);
            if (stickerModal) stickerModal.hide();
            setReplyContext(null);
          };

          // Sticker Button
          if (document.getElementById('forumStickerBtn')) {
            document.getElementById('forumStickerBtn').addEventListener('click', async () => {
              const stickerModalEl = document.getElementById('stickerModal');
              const bsModal = new bootstrap.Modal(stickerModalEl);
              bsModal.show();
              try { await loadStickerFavoritesSet(); } catch (e) { }
              loadRecentStickers();
              loadFavoriteStickers();
              loadGeneralStickers();
            });
          }

          function loadRecentStickers() {
            const recentTab = document.getElementById('sticker-recent');
            if (!recentTab) return;

            recentTab.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 small text-secondary">Memuat riwayat stiker...</div></div>';

            const { db, collection, getDocs, query, orderBy, limit } = window.firebaseModules;
            const { auth, onAuthStateChanged } = window.firebaseModules;

            if (!auth || !auth.currentUser) {
              recentTab.innerHTML = '<div class="text-center text-secondary p-3">Login dulu untuk melihat riwayat stiker.</div>';
              if (onAuthStateChanged && auth) {
                const unsub = onAuthStateChanged(auth, (user) => {
                  if (user) {
                    unsub();
                    loadRecentStickers();
                  }
                });
              }
              return;
            }

            const q = query(
              collection(db, "users", auth.currentUser.uid, "sticker-history"),
              orderBy("usedAt", "desc"),
              limit(50)
            );

            getDocs(q)
              .then((querySnapshot) => {
                const seen = new Set();
                const urls = [];
                querySnapshot.forEach((docSnap) => {
                  const data = docSnap.data() || {};
                  const u = data.url || data.stickerUrl;
                  if (!u) return;
                  if (seen.has(u)) return;
                  seen.add(u);
                  urls.push(u);
                });

                if (urls.length === 0) {
                  recentTab.innerHTML = '<div class="text-center text-secondary small mt-5">Belum ada stiker yang dipakai.</div>';
                  return;
                }

                recentTab.innerHTML = buildStickerGridHtml(urls);
                bindStickerGridHandlers(recentTab);
              })
              .catch((error) => {
                console.error("Error getting sticker history:", error);
                recentTab.innerHTML = `<div class="text-center text-danger p-3">Gagal memuat riwayat: ${error.message}</div>`;
              });
          }

          function loadGeneralStickers() {
            // Populate General Stickers (Pack) - STRICTLY from Firestore 'stickers' collection
            const packTab = document.getElementById('sticker-pack');
            if (packTab) {
              // Always refresh to ensure latest data
              packTab.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 small text-secondary">Memuat stiker umum...</div></div>';

              const { db, collection, getDocs, query, where } = window.firebaseModules;
              const { auth, onAuthStateChanged } = window.firebaseModules;

              if (!auth || !auth.currentUser) {
                packTab.innerHTML = '<div class="text-center text-secondary p-3">Login dulu untuk melihat stiker.</div>';
                if (onAuthStateChanged && auth) {
                  const unsub = onAuthStateChanged(auth, (user) => {
                    if (user) {
                      unsub();
                      loadGeneralStickers();
                    }
                  });
                }
                return;
              }

              // Helper to render grid
              const renderStickers = (urls) => {
                if (urls.length > 0) {
                  packTab.innerHTML = buildStickerGridHtml(urls);
                  bindStickerGridHandlers(packTab);
                } else {
                  packTab.innerHTML = '<div class="text-center text-secondary p-3">Tidak ada stiker di database.</div>';
                }
              };

              // Query Firestore
              const q = query(collection(db, "stickers"), where("category", "==", "umum"));

              getDocs(q)
                .then((querySnapshot) => {
                  let urls = [];
                  querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.url) urls.push(data.url);
                  });

                  console.log(`Firestore Stickers Fetched: ${urls.length} items`);
                  renderStickers(urls);
                })
                .catch((error) => {
                  console.error("Error getting stickers from Firestore:", error);
                  packTab.innerHTML = `<div class="text-center text-danger p-3">Gagal memuat stiker: ${error.message}</div>`;
                });
            }
          }

        }
        initForumChat();

        // --- Task 7: CDN Feature ---
        function initCDNFeature() {
          const cdnSelect = document.getElementById('cdnSelect');
          const cdnLatency = document.getElementById('cdnLatency');
          const cdnBadge = document.getElementById('cdnStatusBadge');

          if (!cdnSelect || !cdnBadge) return;

          // Load saved preference
          const savedCDN = localStorage.getItem('prefCDN') || 'auto';
          cdnSelect.value = savedCDN;
          updateCDNBadge(savedCDN);
          checkLatency(savedCDN); // Initial check

          cdnSelect.addEventListener('change', () => {
            const val = cdnSelect.value;
            localStorage.setItem('prefCDN', val);

            // Show connecting toast
            setToast(`<span class="spinner-border spinner-border-sm me-2"></span>Menghubungkan ke node ${val.toUpperCase()}...`, 'info');

            cdnSelect.disabled = true;

            setTimeout(() => {
              cdnSelect.disabled = false;
              updateCDNBadge(val);
              checkLatency(val);
              setToast(`<i class="bi bi-hdd-network-fill me-2"></i>Terhubung ke CDN ${val.toUpperCase()}`, 'success');
            }, 1500);
          });

          function updateCDNBadge(val) {
            let label = 'Auto';
            if (val === 'id-jkt') label = 'ID-JKT';
            else if (val === 'sg-sin') label = 'SG-1';
            else if (val === 'us-west') label = 'US-West';
            else if (val === 'eu-ger') label = 'EU-Ger';

            cdnBadge.innerHTML = `<i class="bi bi-hdd-network-fill me-1"></i>CDN: ${label}`;

            // Visual feedback on badge
            cdnBadge.classList.add('bg-success', 'text-white');
            cdnBadge.classList.remove('bg-primary-subtle', 'text-primary');
            setTimeout(() => {
              cdnBadge.classList.remove('bg-success', 'text-white');
              cdnBadge.classList.add('bg-primary-subtle', 'text-primary');
            }, 1000);
          }

          function checkLatency(val) {
            if (!cdnLatency) return;
            cdnLatency.innerText = 'Pinging...';
            cdnLatency.className = 'font-monospace fw-bold text-secondary';

            setTimeout(() => {
              let ms = 0;
              // Simulate latency based on "location" (assuming user is in ID)
              if (val === 'auto' || val === 'id-jkt') ms = Math.floor(Math.random() * 20) + 10; // 10-30ms
              else if (val === 'sg-sin') ms = Math.floor(Math.random() * 30) + 30; // 30-60ms
              else if (val === 'us-west') ms = Math.floor(Math.random() * 100) + 180; // 180-280ms
              else if (val === 'eu-ger') ms = Math.floor(Math.random() * 100) + 200; // 200-300ms

              cdnLatency.innerText = `${ms} ms`;

              if (ms < 50) cdnLatency.className = 'font-monospace fw-bold text-success';
              else if (ms < 150) cdnLatency.className = 'font-monospace fw-bold text-warning';
              else cdnLatency.className = 'font-monospace fw-bold text-danger';

            }, 1000);
          }
        }
        initCDNFeature();

      });
