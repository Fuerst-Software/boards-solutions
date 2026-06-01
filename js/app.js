/**
 * boards.solutions — Dashboard App Module
 * Handles: sidebar, dropdowns, search/filter, settings tabs, upload zone, toasts
 */

import { $, $$, debounce, on } from './utils.js';
import { createFocusTrap } from './accessibility.js';

/* ─────────────────────────────────────────────
   Sidebar — simple, reliable open/close
───────────────────────────────────────────── */
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const openBtn  = document.getElementById('sidebar-open');
  const closeBtn = document.getElementById('sidebar-close');

  if (!sidebar) return;

  function isDesktop() { return window.innerWidth >= 768; }

  function openSidebar() {
    sidebar.classList.add('is-open');
    sidebar.removeAttribute('hidden');
    sidebar.setAttribute('aria-hidden', 'false');
    if (overlay) {
      overlay.removeAttribute('hidden');
      // next frame so CSS transition fires
      requestAnimationFrame(() => overlay.classList.add('is-visible'));
    }
    document.body.classList.add('sidebar-open');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    sidebar.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.classList.remove('is-visible');
    document.body.classList.remove('sidebar-open');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');

    // hide after slide-out transition
    const onEnd = () => {
      if (!sidebar.classList.contains('is-open') && !isDesktop()) {
        sidebar.setAttribute('hidden', '');
      }
    };
    sidebar.addEventListener('transitionend', onEnd, { once: true });
    if (overlay) {
      const onOverlayEnd = () => {
        if (!overlay.classList.contains('is-visible')) overlay.setAttribute('hidden', '');
      };
      overlay.addEventListener('transitionend', onOverlayEnd, { once: true });
    }
  }

  if (openBtn)  openBtn.addEventListener('click',  openSidebar);
  if (closeBtn) closeBtn.addEventListener('click',  closeSidebar);
  if (overlay)  overlay.addEventListener('click',   closeSidebar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeSidebar();
  });

  // Responsive: show/hide on resize
  window.addEventListener('resize', () => {
    if (isDesktop()) {
      sidebar.removeAttribute('hidden');
      sidebar.classList.remove('is-open');
      sidebar.setAttribute('aria-hidden', 'false');
      if (overlay) { overlay.classList.remove('is-visible'); overlay.setAttribute('hidden', ''); }
      document.body.classList.remove('sidebar-open');
    }
  });

  // Initial mobile state: hide sidebar
  if (!isDesktop()) {
    sidebar.setAttribute('hidden', '');
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.classList.remove('is-open');
  }
}

/* ─────────────────────────────────────────────
   Notification dropdown
───────────────────────────────────────────── */
function initNotifications() {
  const toggle   = $('#notifications-toggle');
  const dropdown = $('#notifications-dropdown');

  if (!toggle || !dropdown) return;

  toggle.addEventListener('click', () => {
    const isHidden = dropdown.hasAttribute('hidden');
    if (isHidden) {
      dropdown.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      dropdown.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hasAttribute('hidden')) {
      dropdown.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

/* ─────────────────────────────────────────────
   User menu dropdown
───────────────────────────────────────────── */
function initUserMenu() {
  const toggle   = $('#user-menu-toggle');
  const dropdown = $('#user-menu-dropdown');

  if (!toggle || !dropdown) return;

  toggle.addEventListener('click', () => {
    const isHidden = dropdown.hasAttribute('hidden');
    if (isHidden) {
      dropdown.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      dropdown.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hasAttribute('hidden')) {
      dropdown.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

/* ─────────────────────────────────────────────
   Filter Tabs (boards.html / products.html)
───────────────────────────────────────────── */
function initFilterTabs() {
  const tabLists = $$('[role="tablist"][data-filter-list]');

  tabLists.forEach(tabList => {
    const tabs = $$('[role="tab"]', tabList);

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        selectTab(tab, tabs, tabList);
      });
    });

    tabList.addEventListener('keydown', (e) => {
      const current = $('[role="tab"][aria-selected="true"]', tabList);
      const idx = tabs.indexOf(current);

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        tabs[(idx + 1) % tabs.length].focus();
        selectTab(tabs[(idx + 1) % tabs.length], tabs, tabList);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        tabs[(idx - 1 + tabs.length) % tabs.length].focus();
        selectTab(tabs[(idx - 1 + tabs.length) % tabs.length], tabs, tabList);
      } else if (e.key === 'Home') {
        e.preventDefault();
        tabs[0].focus();
        selectTab(tabs[0], tabs, tabList);
      } else if (e.key === 'End') {
        e.preventDefault();
        tabs[tabs.length - 1].focus();
        selectTab(tabs[tabs.length - 1], tabs, tabList);
      }
    });
  });

  function selectTab(tab, tabs, tabList) {
    tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');

    const filter = tab.dataset.filter;
    const container = tabList.closest('[data-filter-container]');
    if (container) filterCards(container, filter);
  }

  function filterCards(container, filter) {
    const cards = $$('[data-status]', container);
    cards.forEach(card => {
      const show = filter === 'all' || card.dataset.status === filter;
      card.hidden = !show;
    });

    // Update empty-state visibility
    const empty = $('[data-empty-state]', container);
    if (empty) {
      const visibleCount = cards.filter(c => !c.hidden).length;
      empty.hidden = visibleCount > 0;
    }
  }
}

/* ─────────────────────────────────────────────
   Search + Filter (boards / products)
───────────────────────────────────────────── */
function initSearch() {
  const searchInputs = $$('[data-search-input]');

  searchInputs.forEach(input => {
    const container = document.querySelector(input.dataset.searchTarget || '[data-search-container]');
    if (!container) return;

    const clearBtn = input.closest('[data-search-wrapper]')
      ? $('[data-search-clear]', input.closest('[data-search-wrapper]'))
      : null;

    const doSearch = debounce(() => {
      const q = input.value.trim().toLowerCase();
      const cards = $$('[data-search-item]', container);
      let visible = 0;

      cards.forEach(card => {
        const text = card.dataset.searchText || card.textContent;
        const match = !q || text.toLowerCase().includes(q);
        card.hidden = !match;
        if (match) visible++;
      });

      // Empty state
      const empty = $('[data-empty-state]', container);
      if (empty) empty.hidden = visible > 0;

      // Show/hide clear button
      if (clearBtn) clearBtn.hidden = !q;
    }, 200);

    input.addEventListener('input', doSearch);

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      doSearch();
      input.focus();
    });
  });
}

/* ─────────────────────────────────────────────
   Sort dropdown
───────────────────────────────────────────── */
function initSort() {
  const sortSelects = $$('[data-sort-select]');

  sortSelects.forEach(select => {
    select.addEventListener('change', () => {
      const container = document.querySelector(select.dataset.sortTarget || '[data-sort-container]');
      if (!container) return;

      const items = $$('[data-sort-key]', container);
      const val = select.value;

      const sorted = [...items].sort((a, b) => {
        const ka = a.dataset.sortKey || '';
        const kb = b.dataset.sortKey || '';

        if (val === 'name-asc') return ka.localeCompare(kb);
        if (val === 'name-desc') return kb.localeCompare(ka);
        if (val === 'date-desc') return (b.dataset.sortDate || '') > (a.dataset.sortDate || '') ? 1 : -1;
        if (val === 'date-asc')  return (a.dataset.sortDate || '') > (b.dataset.sortDate || '') ? 1 : -1;
        return 0;
      });

      sorted.forEach(item => container.appendChild(item));
    });
  });
}

/* ─────────────────────────────────────────────
   Settings Tabs (settings.html)
───────────────────────────────────────────── */
function initSettingsTabs() {
  const tabList = $('[role="tablist"][data-settings-tabs]');
  if (!tabList) return;

  const tabs    = $$('[role="tab"]', tabList);
  const panels  = $$('[role="tabpanel"]');

  function selectSettingsTab(tab) {
    tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    panels.forEach(p => p.setAttribute('hidden', ''));

    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');

    const panelId = tab.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.removeAttribute('hidden');
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => selectSettingsTab(tab));
  });

  tabList.addEventListener('keydown', (e) => {
    const current = $('[role="tab"][aria-selected="true"]', tabList);
    const idx = tabs.indexOf(current);

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = tabs[(idx + 1) % tabs.length];
      next.focus();
      selectSettingsTab(next);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
      prev.focus();
      selectSettingsTab(prev);
    } else if (e.key === 'Home') {
      e.preventDefault();
      tabs[0].focus();
      selectSettingsTab(tabs[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      tabs[tabs.length - 1].focus();
      selectSettingsTab(tabs[tabs.length - 1]);
    }
  });

  // Activate first tab on load
  if (tabs.length > 0) selectSettingsTab(tabs[0]);
}

/* ─────────────────────────────────────────────
   Upload Zone (media-library.html)
───────────────────────────────────────────── */
function initUploadZone() {
  const zone   = $('#upload-zone');
  const input  = $('#upload-input');
  const status = $('#upload-status');

  if (!zone || !input) return;

  let dragCounter = 0;

  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    zone.classList.add('is-dragging');
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  zone.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter === 0) zone.classList.remove('is-dragging');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    zone.classList.remove('is-dragging');
    handleFiles(e.dataTransfer.files);
  });

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', () => {
    if (input.files.length > 0) handleFiles(input.files);
  });

  function handleFiles(files) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10 MB

    const valid   = [];
    const invalid = [];

    Array.from(files).forEach(f => {
      if (!allowed.includes(f.type)) {
        invalid.push(`${f.name}: Dateityp nicht erlaubt`);
      } else if (f.size > maxSize) {
        invalid.push(`${f.name}: Datei zu groß (max. 10 MB)`);
      } else {
        valid.push(f);
      }
    });

    if (invalid.length > 0) {
      showToast(invalid.join('<br>'), 'error');
    }

    if (valid.length > 0) {
      simulateUpload(valid);
    }
  }

  function simulateUpload(files) {
    if (status) {
      status.textContent = `${files.length} Datei${files.length > 1 ? 'en' : ''} wird hochgeladen…`;
      status.removeAttribute('hidden');
    }

    // Simulate async upload
    setTimeout(() => {
      showToast(`${files.length} Datei${files.length > 1 ? 'en' : ''} erfolgreich hochgeladen.`, 'success');
      if (status) status.setAttribute('hidden', '');

      // Inject placeholder tiles into the media grid
      const grid = $('#media-grid');
      if (grid) {
        files.forEach(f => {
          const tile = document.createElement('div');
          tile.className = 'media-tile';
          tile.setAttribute('tabindex', '0');
          tile.setAttribute('aria-label', f.name);
          tile.innerHTML = `
            <div class="media-tile__thumb" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <div class="media-tile__info">
              <span class="media-tile__name">${f.name}</span>
              <span class="media-tile__size">${(f.size / 1024).toFixed(0)} KB</span>
            </div>
          `;
          grid.prepend(tile);
        });
      }
    }, 1200);
  }
}

/* ─────────────────────────────────────────────
   Toast Notifications
───────────────────────────────────────────── */
const toastContainer = (() => {
  let el = null;
  return () => {
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-container';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'false');
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    return el;
  };
})();

export function showToast(message, type = 'info', duration = 4000) {
  const container = toastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast__message">${message}</span>
    <button class="toast__close" aria-label="Benachrichtigung schließen" type="button">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/></svg>
    </button>
  `;

  const closeBtn = toast.querySelector('.toast__close');
  closeBtn.addEventListener('click', () => dismiss(toast));

  container.appendChild(toast);

  // Force reflow so animation plays
  toast.getBoundingClientRect();
  toast.classList.add('toast--visible');

  const timer = setTimeout(() => dismiss(toast), duration);

  // Pause timer on hover (accessibility: user may be reading)
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => setTimeout(() => dismiss(toast), 1500));

  function dismiss(t) {
    t.classList.remove('toast--visible');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }
}

/* ─────────────────────────────────────────────
   Toggle switches (settings.html)
───────────────────────────────────────────── */
function initToggles() {
  const toggles = $$('[data-toggle-announce]');

  toggles.forEach(input => {
    const announceId = input.dataset.toggleAnnounce;
    const announce = announceId ? document.getElementById(announceId) : null;

    input.addEventListener('change', () => {
      if (announce) {
        announce.textContent = input.checked
          ? (input.dataset.onLabel  || 'Aktiviert')
          : (input.dataset.offLabel || 'Deaktiviert');
      }
    });
  });
}

/* ─────────────────────────────────────────────
   Board card "more" menu
───────────────────────────────────────────── */
function initBoardMenus() {
  on(document, 'click', '[data-board-menu-toggle]', (e, btn) => {
    const menuId = btn.dataset.boardMenuToggle;
    const menu   = document.getElementById(menuId);
    if (!menu) return;

    const isHidden = menu.hasAttribute('hidden');

    // Close all other open menus first
    $$('[data-board-menu]').forEach(m => {
      m.setAttribute('hidden', '');
      const toggle = document.querySelector(`[data-board-menu-toggle="${m.id}"]`);
      toggle?.setAttribute('aria-expanded', 'false');
    });

    if (isHidden) {
      menu.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-board-menu-toggle]') && !e.target.closest('[data-board-menu]')) {
      $$('[data-board-menu]').forEach(m => {
        m.setAttribute('hidden', '');
        const toggle = document.querySelector(`[data-board-menu-toggle="${m.id}"]`);
        toggle?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('[data-board-menu]:not([hidden])').forEach(m => {
        m.setAttribute('hidden', '');
        const toggle = document.querySelector(`[data-board-menu-toggle="${m.id}"]`);
        toggle?.setAttribute('aria-expanded', 'false');
        toggle?.focus();
      });
    }
  });
}

/* ─────────────────────────────────────────────
   Copy embed snippet (app.html / boards.html)
───────────────────────────────────────────── */
function initCopySnippet() {
  on(document, 'click', '[data-copy-snippet]', (e, btn) => {
    const targetId = btn.dataset.copySnippet;
    const target   = targetId ? document.getElementById(targetId) : null;
    const text     = target ? target.textContent : btn.dataset.copyText;

    if (!text) return;

    navigator.clipboard.writeText(text.trim()).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Kopiert!';
      btn.setAttribute('aria-label', 'Kopiert!');
      setTimeout(() => {
        btn.textContent = original;
        btn.setAttribute('aria-label', 'Code kopieren');
      }, 2000);
      showToast('Snippet in Zwischenablage kopiert.', 'success', 2500);
    }).catch(() => {
      showToast('Kopieren fehlgeschlagen. Bitte manuell kopieren.', 'error');
    });
  });
}

/* ─────────────────────────────────────────────
   Confirm dialogs (delete actions)
───────────────────────────────────────────── */
function initConfirmActions() {
  on(document, 'click', '[data-confirm]', (e, btn) => {
    const message = btn.dataset.confirm || 'Bist du sicher?';
    if (!window.confirm(message)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

/* ─────────────────────────────────────────────
   Color picker preview (settings.html)
───────────────────────────────────────────── */
function initColorPickers() {
  const pickers = $$('[data-color-preview]');

  pickers.forEach(input => {
    const previewId = input.dataset.colorPreview;
    const preview   = previewId ? document.getElementById(previewId) : null;

    if (preview) {
      preview.style.backgroundColor = input.value;

      input.addEventListener('input', () => {
        preview.style.backgroundColor = input.value;
      });
    }
  });
}

/* ─────────────────────────────────────────────
   Character counter (settings.html — bio textarea)
───────────────────────────────────────────── */
function initCharCounters() {
  const textareas = $$('[data-char-counter]');

  textareas.forEach(textarea => {
    const counterId = textarea.dataset.charCounter;
    const counter   = counterId ? document.getElementById(counterId) : null;
    const max       = parseInt(textarea.getAttribute('maxlength') || '0', 10);

    if (!counter) return;

    function update() {
      const remaining = max - textarea.value.length;
      counter.textContent = `${textarea.value.length} / ${max}`;
      counter.classList.toggle('form-char-counter--warn', remaining < 20);
    }

    textarea.addEventListener('input', update);
    update();
  });
}

/* ─────────────────────────────────────────────
   Inline form save (settings.html)
───────────────────────────────────────────── */
function initSettingsForms() {
  const forms = $$('[data-settings-form]');

  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const btn = form.querySelector('[type="submit"]');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Gespeichert ✓';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2500);
      }

      showToast('Einstellungen gespeichert.', 'success');
    });
  });
}

/* ─────────────────────────────────────────────
   Init all
───────────────────────────────────────────── */
function init() {
  initSidebar();
  initNotifications();
  initUserMenu();
  initFilterTabs();
  initSearch();
  initSort();
  initSettingsTabs();
  initUploadZone();
  initToggles();
  initBoardMenus();
  initCopySnippet();
  initConfirmActions();
  initColorPickers();
  initCharCounters();
  initSettingsForms();
}

init();
