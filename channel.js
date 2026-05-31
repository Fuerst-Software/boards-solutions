/**
 * boards.solutions — channel.js  v2.0
 * Embed published boards with images, theme colors, and full modal.
 *
 * Usage:
 *   <script src="https://..." data-key="ek_..." defer></script>
 *   Optional: data-api="https://..." to override API base URL.
 */
(function () {
  'use strict';

  const script  = document.currentScript ||
    document.querySelector('script[data-key][src*="channel.js"]');
  const key     = script && script.getAttribute('data-key');
  const apiBase = (script && script.getAttribute('data-api')) ||
    'https://web-production-83480.up.railway.app/api';

  if (!key) {
    console.warn('[boards.solutions] channel.js: data-key fehlt.');
    return;
  }

  // ── Base styles ──────────────────────────────────────────────────
  const CSS_BASE = `
    .bs-channel { font-family: inherit; }
    .bs-channel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
      margin-top: 1.5rem;
    }
    .bs-card {
      background: var(--bs-card-bg, #fff);
      border: 1px solid var(--bs-border, #e5e7eb);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: box-shadow .18s, transform .18s;
    }
    .bs-card:hover {
      box-shadow: 0 6px 28px rgba(0,0,0,.10);
      transform: translateY(-3px);
    }
    .bs-card-img {
      width: 100%;
      height: 190px;
      object-fit: cover;
      display: block;
      flex-shrink: 0;
    }
    .bs-card-img-placeholder {
      width: 100%;
      height: 5px;
      background: linear-gradient(90deg, var(--bs-primary, #0b4fd8) 0%, var(--bs-secondary, #0ea5e9) 100%);
      flex-shrink: 0;
    }
    .bs-card-body {
      padding: 1.2rem 1.4rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: .6rem;
      flex: 1;
    }
    .bs-type-badge {
      display: inline-block;
      font-size: .68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .07em;
      padding: .2rem .65rem;
      border-radius: 999px;
      background: var(--bs-badge-bg, #eff3fd);
      color: var(--bs-primary, #0b4fd8);
      width: fit-content;
    }
    .bs-card h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.35;
      color: var(--bs-text, #0f172a);
    }
    .bs-card p {
      margin: 0;
      font-size: .875rem;
      color: var(--bs-text-muted, #64748b);
      line-height: 1.6;
      flex: 1;
    }
    .bs-stars { color: #f59e0b; font-size: .9rem; letter-spacing: .05em; }
    .bs-btn {
      display: inline-block;
      padding: .52rem 1.1rem;
      background: var(--bs-primary, #0b4fd8);
      color: var(--bs-btn-text, #fff);
      border-radius: 8px;
      font-size: .84rem;
      font-weight: 600;
      text-decoration: none;
      width: fit-content;
      transition: background .15s, opacity .15s;
      border: none;
      cursor: pointer;
      margin-top: auto;
    }
    .bs-btn:hover { opacity: .88; }
    .bs-btn-read {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      margin-top: auto;
      padding: .48rem 1rem;
      background: transparent;
      color: var(--bs-primary, #0b4fd8);
      border: 1.5px solid var(--bs-primary, #0b4fd8);
      border-radius: 8px;
      font-size: .82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s, color .15s;
      width: fit-content;
    }
    .bs-btn-read:hover {
      background: var(--bs-primary, #0b4fd8);
      color: var(--bs-btn-text, #fff);
    }
    .bs-price {
      font-size: .95rem;
      font-weight: 700;
      color: var(--bs-text, #0f172a);
    }
    .bs-faq-item { border-top: 1px solid var(--bs-border, #e5e7eb); padding-top: .65rem; }
    .bs-faq-q    { font-weight: 600; font-size: .875rem; color: var(--bs-text, #0f172a); margin-bottom: .2rem; }
    .bs-faq-a    { font-size: .82rem; color: var(--bs-text-muted, #64748b); }
    .bs-pros-cons { display: flex; gap: 1rem; flex-wrap: wrap; }
    .bs-pros, .bs-cons { flex: 1; min-width: 120px; }
    .bs-pros strong { color: #16a34a; font-size: .78rem; }
    .bs-cons strong { color: #dc2626; font-size: .78rem; }
    .bs-pros ul, .bs-cons ul { margin: .2rem 0 0; padding-left: 1rem; font-size: .78rem; color: #374151; }
    .bs-empty {
      text-align: center; padding: 2.5rem; color: #94a3b8; font-size: .9rem;
      border: 1px dashed #e2e8f0; border-radius: 14px;
    }

    /* ── Modal ────────────────────────────────────────────────── */
    .bs-modal-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(15,23,42,.55);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      animation: bsFadeIn .18s ease;
    }
    @keyframes bsFadeIn { from { opacity: 0 } to { opacity: 1 } }
    .bs-modal {
      background: #fff;
      border-radius: 18px;
      max-width: 700px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 28px 90px rgba(15,23,42,.22);
      animation: bsSlideUp .22s ease;
    }
    @keyframes bsSlideUp {
      from { transform: translateY(18px); opacity: 0 }
      to   { transform: none;             opacity: 1 }
    }
    .bs-modal-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 1rem; padding: 1.5rem 1.5rem 0;
    }
    .bs-modal-body { padding: 1rem 1.5rem 1.75rem; }
    .bs-modal-close {
      flex-shrink: 0; width: 34px; height: 34px;
      border: 1px solid #e5e7eb; border-radius: 9px;
      background: #f8fafc; cursor: pointer;
      font-size: 1rem; display: flex; align-items: center; justify-content: center;
      color: #64748b; transition: background .15s;
    }
    .bs-modal-close:hover { background: #e5e7eb; }
    .bs-modal h2 { margin: 0; font-size: 1.35rem; font-weight: 700; color: #0f172a; line-height: 1.3; }
    .bs-modal-content {
      margin-top: .75rem; font-size: .91rem; color: #374151;
      line-height: 1.8; white-space: pre-wrap; word-break: break-word;
    }
    .bs-modal-meta {
      display: flex; flex-wrap: wrap; gap: .45rem;
      margin-top: 1rem; padding-top: 1rem;
      border-top: 1px solid #f1f5f9;
    }
    .bs-modal-tag {
      font-size: .7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .05em; padding: .2rem .55rem;
      border-radius: 999px; background: #f1f5f9; color: #64748b;
    }
    .bs-modal-affiliate {
      margin-top: 1.25rem; padding: 1rem;
      border: 1px solid #e5e7eb; border-radius: 12px;
      background: #f8fafc;
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem; flex-wrap: wrap;
    }
    .bs-modal-price { font-size: 1.15rem; font-weight: 700; color: #0f172a; }
    .bs-loading-pulse {
      display: flex; gap: .5rem; padding: 1rem 0; align-items: center;
    }
    .bs-loading-pulse span {
      width: 8px; height: 8px; border-radius: 50%;
      background: #cbd5e1; animation: bsPulse 1.2s ease-in-out infinite;
    }
    .bs-loading-pulse span:nth-child(2) { animation-delay: .2s; }
    .bs-loading-pulse span:nth-child(3) { animation-delay: .4s; }
    @keyframes bsPulse {
      0%,80%,100% { transform: scale(.8); opacity: .5 }
      40%          { transform: scale(1.2); opacity: 1  }
    }
  `;

  // ── Helpers ──────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function stars(n) {
    const r = Math.round(n * 2) / 2;
    let s = '';
    for (let i = 1; i <= 5; i++) {
      s += i <= r ? '★' : (i - .5 <= r ? '⯨' : '☆');
    }
    return `<span class="bs-stars" aria-label="${r} von 5 Sternen">${s}</span>`;
  }

  function typeName(type) {
    return { blog: 'Blog', affiliate: 'Empfehlung', review: 'Review', faq: 'FAQ' }[type] || type;
  }

  // ── Theme application ────────────────────────────────────────────
  function hexBrightness(hex) {
    const h = (hex || '').replace('#', '');
    if (h.length < 6) return 128;
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return (r*299 + g*587 + b*114) / 1000;
  }

  function darkenHex(hex, amount) {
    const h = (hex || '').replace('#','');
    if (h.length < 6) return hex;
    const r = Math.max(0, parseInt(h.slice(0,2),16) - amount);
    const g = Math.max(0, parseInt(h.slice(2,4),16) - amount);
    const b = Math.max(0, parseInt(h.slice(4,6),16) - amount);
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  }

  function applyTheme(theme) {
    const existing = document.getElementById('bs-theme-styles');
    if (existing) existing.remove();
    if (!theme || typeof theme !== 'object' || !Object.keys(theme).length) return;

    // Support both old 4-field format and new granular 8-field format
    const primary   = theme.primary    || '#0b4fd8';
    const secondary = theme.secondary  || theme.accent || theme.primary || '#0ea5e9';
    const cardBg    = theme.card_bg    || theme.background || '#ffffff';
    const text      = theme.text       || '#0f172a';
    // Granular overrides — fall back to auto-derived if not set
    const textMuted = theme.text_muted || text + '99';
    const border    = theme.border     || text + '18';
    const btnText   = theme.btn_text   || (hexBrightness(primary) > 160 ? '#0f172a' : '#ffffff');
    const badgeBg   = theme.badge_bg   || primary + '18';

    const style = document.createElement('style');
    style.id = 'bs-theme-styles';
    style.textContent = `
      .bs-channel {
        --bs-primary:    ${primary};
        --bs-secondary:  ${secondary};
        --bs-card-bg:    ${cardBg};
        --bs-text:       ${text};
        --bs-text-muted: ${textMuted};
        --bs-border:     ${border};
        --bs-btn-text:   ${btnText};
        --bs-badge-bg:   ${badgeBg};
      }
    `;
    document.head.appendChild(style);
  }

  // ── Modal ────────────────────────────────────────────────────────
  function openModal(b) {
    const overlay = document.createElement('div');
    overlay.className = 'bs-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', esc(b.boardName || b.title || 'Board'));

    overlay.innerHTML = `<div class="bs-modal">${buildModalContent(b, true)}</div>`;

    function close() {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .18s';
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) { if (e.key === 'Escape') close(); }

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.bs-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    // Fetch full board data (includes full image)
    if (b.embedId) {
      fetch(`${apiBase}/embed/board/${encodeURIComponent(b.embedId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(full => {
          if (!full || !overlay.isConnected) return;
          const modal = overlay.querySelector('.bs-modal');
          if (modal) modal.innerHTML = buildModalContent(full, false);
          overlay.querySelector('.bs-modal-close').addEventListener('click', close);
        })
        .catch(() => {});
    }
  }

  function buildModalContent(b, loading) {
    const img    = b.image || b.blogImage || b.affImage || '';
    const imgHtml = img
      ? `<img src="${esc(img)}" alt="${esc(b.boardName || b.title || '')}"
           style="width:100%;max-height:360px;object-fit:cover;border-radius:12px 12px 0 0;display:block;margin:-1.5rem -1.5rem 1rem;width:calc(100% + 3rem)">`
      : '';

    let body = loading
      ? `<div class="bs-loading-pulse"><span></span><span></span><span></span></div>`
      : '';

    if (!loading) {
      if (b.type === 'blog') {
        const fullText = b.content || b.intro || '';
        body = `
          ${imgHtml}
          <div class="bs-modal-content">${esc(fullText)}</div>
          ${(b.affiliateLinks || []).map(l =>
            `<a class="bs-btn" href="${esc(l.url)}" target="_blank" rel="noopener nofollow"
               style="margin-top:1rem;display:inline-block">${esc(l.text)}</a>`
          ).join('')}
        `;
      } else if (b.type === 'affiliate') {
        body = `
          ${imgHtml}
          ${b.rating ? `<div style="margin:.4rem 0">${stars(b.rating)}
            <span style="color:#64748b;font-size:.83rem;margin-left:.3rem">${b.rating}/5</span></div>` : ''}
          <div class="bs-modal-content">${esc(b.description || '')}</div>
          ${prosConsHtml(b)}
          ${b.affiliateUrl ? `
            <div class="bs-modal-affiliate">
              ${b.price ? `<span class="bs-modal-price">${esc(b.price)}</span>` : '<span></span>'}
              <a class="bs-btn" href="${esc(b.affiliateUrl)}" target="_blank"
                 rel="noopener nofollow">${esc(b.buttonText || 'Jetzt ansehen')}</a>
            </div>` : ''}
        `;
      } else if (b.type === 'review') {
        body = `
          ${imgHtml}
          ${b.rating ? `<div style="margin:.4rem 0">${stars(b.rating)}
            <span style="color:#64748b;font-size:.83rem;margin-left:.3rem">${b.rating}/5</span></div>` : ''}
          <div class="bs-modal-content">${esc(b.reviewText || '')}</div>
          ${prosConsHtml(b)}
          ${b.verdict ? `<div style="margin-top:.75rem;padding:.75rem;background:#f8fafc;border-radius:8px;font-size:.87rem">
            <strong>Fazit:</strong> ${esc(b.verdict)}</div>` : ''}
          ${b.affiliateUrl ? `
            <div class="bs-modal-affiliate">
              ${b.price ? `<span class="bs-modal-price">${esc(b.price)}</span>` : '<span></span>'}
              <a class="bs-btn" href="${esc(b.affiliateUrl)}" target="_blank"
                 rel="noopener nofollow">${esc(b.buttonText || 'Preis prüfen')}</a>
            </div>` : ''}
        `;
      } else if (b.type === 'faq') {
        body = `
          <div style="margin-top:.5rem">
            ${(b.faqs || []).map(f => `
              <div class="bs-faq-item">
                <div class="bs-faq-q">${esc(f.question)}</div>
                <div class="bs-faq-a">${esc(f.answer || '')}</div>
              </div>`).join('')}
          </div>
        `;
      }
    }

    const tags = b.tags || [];
    return `
      <div class="bs-modal-header">
        <div>
          <span class="bs-type-badge">${esc(typeName(b.type))}</span>
          <h2 style="margin-top:.5rem">${esc(b.boardName || b.title || b.productName)}</h2>
        </div>
        <button class="bs-modal-close" aria-label="Schließen">✕</button>
      </div>
      <div class="bs-modal-body">
        ${body}
        ${tags.length ? `<div class="bs-modal-meta">
          ${tags.map(t => `<span class="bs-modal-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    `;
  }

  function prosConsHtml(b) {
    if (!b.pros?.length && !b.cons?.length) return '';
    return `
      <div class="bs-pros-cons" style="margin-top:1rem">
        ${b.pros?.length ? `<div class="bs-pros">
          <strong>+ Vorteile</strong>
          <ul>${b.pros.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
        ${b.cons?.length ? `<div class="bs-cons">
          <strong>− Nachteile</strong>
          <ul>${b.cons.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      </div>`;
  }

  // ── Card renderers ───────────────────────────────────────────────
  function cardImage(b) {
    const thumb = b.imageThumb || '';
    if (thumb) {
      return `<img class="bs-card-img" src="${esc(thumb)}"
                alt="${esc(b.boardName || b.title || b.productName || '')}"
                loading="lazy">`;
    }
    return '<div class="bs-card-img-placeholder"></div>';
  }

  function renderBlog(b) {
    const intro   = b.intro || b.content || '';
    const snippet = intro.length > 130 ? intro.slice(0, 127) + '…' : intro;
    return `
      ${cardImage(b)}
      <div class="bs-card-body">
        <span class="bs-type-badge">Blog</span>
        <h3>${esc(b.boardName || b.title)}</h3>
        ${snippet ? `<p>${esc(snippet)}</p>` : ''}
        <button class="bs-btn-read" data-bs-open>Weiterlesen →</button>
      </div>
    `;
  }

  function renderAffiliate(b) {
    return `
      ${cardImage(b)}
      <div class="bs-card-body">
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
          <span class="bs-type-badge">Empfehlung</span>
          ${b.badge ? `<span class="bs-type-badge" style="background:#fef9c3;color:#92400e">${esc(b.badge)}</span>` : ''}
        </div>
        <h3>${esc(b.productName || b.boardName)}</h3>
        ${b.rating ? stars(b.rating) : ''}
        <p>${esc((b.description || '').slice(0, 115))}${(b.description||'').length > 115 ? '…' : ''}</p>
        ${b.price ? `<span class="bs-price">${esc(b.price)}</span>` : ''}
        <button class="bs-btn-read" data-bs-open>Details ansehen →</button>
      </div>
    `;
  }

  function renderReview(b) {
    return `
      ${cardImage(b)}
      <div class="bs-card-body">
        <span class="bs-type-badge">Review</span>
        <h3>${esc(b.productName || b.boardName)}</h3>
        ${b.rating ? stars(b.rating) : ''}
        <p>${esc((b.reviewText || '').slice(0, 115))}${(b.reviewText||'').length > 115 ? '…' : ''}</p>
        <button class="bs-btn-read" data-bs-open>Review lesen →</button>
      </div>
    `;
  }

  function renderFaq(b) {
    const faqs = (b.faqs || []).slice(0, 2);
    return `
      ${cardImage(b)}
      <div class="bs-card-body">
        <span class="bs-type-badge">FAQ</span>
        <h3>${esc(b.faqTitle || b.boardName)}</h3>
        ${faqs.map(f => `
          <div class="bs-faq-item">
            <div class="bs-faq-q">${esc(f.question)}</div>
            <div class="bs-faq-a">${esc((f.answer||'').slice(0,75))}${(f.answer||'').length>75?'…':''}</div>
          </div>`).join('')}
        <button class="bs-btn-read" data-bs-open>Alle FAQs →</button>
      </div>
    `;
  }

  function renderCard(b) {
    let inner = '';
    if      (b.type === 'blog')      inner = renderBlog(b);
    else if (b.type === 'affiliate') inner = renderAffiliate(b);
    else if (b.type === 'review')    inner = renderReview(b);
    else if (b.type === 'faq')       inner = renderFaq(b);
    else {
      inner = `${cardImage(b)}<div class="bs-card-body">
        <span class="bs-type-badge">${esc(b.type)}</span>
        <h3>${esc(b.boardName||b.title||'Board')}</h3>
        <button class="bs-btn-read" data-bs-open>Öffnen →</button>
      </div>`;
    }
    return `<article class="bs-card" data-bs-id="${esc(b.id)}">${inner}</article>`;
  }

  // ── Main ─────────────────────────────────────────────────────────
  let boardsData = [];

  function mount(container, boards) {
    boardsData = boards;
    if (!boards.length) {
      container.innerHTML = '<div class="bs-empty">Noch keine veröffentlichten Inhalte.</div>';
      return;
    }
    container.innerHTML =
      `<div class="bs-channel-grid">${boards.map(renderCard).join('')}</div>`;

    container.addEventListener('click', e => {
      const btn  = e.target.closest('[data-bs-open]');
      const card = e.target.closest('.bs-card');
      if (!btn && !card) return;
      const id    = (btn || card).closest('.bs-card')?.dataset.bsId;
      const board = boardsData.find(b => b.id === id);
      if (board) openModal(board);
    });
  }

  function injectStyles() {
    if (document.getElementById('bs-channel-styles')) return;
    const style = document.createElement('style');
    style.id = 'bs-channel-styles';
    style.textContent = CSS_BASE;
    document.head.appendChild(style);
  }

  async function init() {
    injectStyles();

    const container = document.getElementById('boards-channel') ||
      (() => {
        const div = document.createElement('div');
        div.id = 'boards-channel';
        script.parentNode.insertBefore(div, script.nextSibling);
        return div;
      })();

    container.classList.add('bs-channel');
    container.innerHTML =
      '<div class="bs-loading-pulse" style="padding:1.5rem 0">' +
        '<span></span><span></span><span></span></div>';

    try {
      const res = await fetch(`${apiBase}/embed/channel/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.theme) applyTheme(data.theme);
      mount(container, data.boards || []);
    } catch (err) {
      container.innerHTML = '<div class="bs-empty">Inhalte konnten nicht geladen werden.</div>';
      console.warn('[boards.solutions] channel.js Fehler:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
