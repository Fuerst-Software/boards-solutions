/**
 * boards.solutions — channel.js  v3.0
 * Embed published boards as editorial content cards with a professional modal.
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
    .bs-channel, .bs-channel *, .bs-channel *::before, .bs-channel *::after {
      box-sizing: border-box;
    }
    .bs-channel { font-family: inherit; }

    /* ── Grid — feels like native content, not a widget box ── */
    .bs-channel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.75rem;
      margin-top: 1.5rem;
    }

    /* ── Card ── */
    .bs-card {
      background: var(--bs-card-bg, #fff);
      border: 1px solid var(--bs-border, #e5e7eb);
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: box-shadow .25s ease, transform .25s ease, border-color .25s ease;
      box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06);
    }
    .bs-card:hover {
      box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 20px 48px rgba(15,23,42,.14);
      transform: translateY(-6px);
      border-color: var(--bs-primary, #0b4fd8);
    }

    /* ── Card image ── */
    .bs-card-img {
      width: 100%;
      height: 210px;
      object-fit: cover;
      display: block;
      flex-shrink: 0;
    }

    /* ── No-image placeholder ── */
    .bs-card-img-placeholder {
      width: 100%;
      height: 210px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1.5rem;
      flex-shrink: 0;
    }
    .bs-card-img-placeholder--blog      { background: linear-gradient(135deg, #3B82F6, #1D4ED8); }
    .bs-card-img-placeholder--affiliate { background: linear-gradient(135deg, #10B981, #059669); }
    .bs-card-img-placeholder--review    { background: linear-gradient(135deg, #F59E0B, #D97706); }
    .bs-card-img-placeholder--faq       { background: linear-gradient(135deg, #8B5CF6, #6D28D9); }

    .bs-card-ph-icon {
      width: 54px; height: 54px;
      border-radius: 14px;
      background: rgba(255,255,255,.22);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: rgba(255,255,255,.92);
    }
    .bs-card-ph-lines { display: flex; flex-direction: column; gap: 9px; flex: 1; }
    .bs-card-ph-line  { height: 9px; border-radius: 5px; background: rgba(255,255,255,.3); }
    .bs-card-ph-line--short { width: 58%; }

    /* ── Card body ── */
    .bs-card-body {
      padding: 1.35rem 1.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: .7rem;
      flex: 1;
    }

    /* ── Type badge ── */
    .bs-type-badge {
      display: inline-flex;
      align-items: center;
      font-size: .64rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .09em;
      padding: 4px 11px;
      border-radius: 999px;
      background: var(--bs-badge-bg, #eff3fd);
      color: var(--bs-primary, #0b4fd8);
      width: auto;
      max-width: 100%;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Card heading ── */
    .bs-card h3 {
      margin: 0;
      font-size: 1.12rem;
      font-weight: 750;
      line-height: 1.35;
      color: var(--bs-text, #0f172a);
      letter-spacing: -.015em;
    }

    /* ── Card description ── */
    .bs-card p {
      margin: 0;
      font-size: .875rem;
      color: var(--bs-text-muted, #64748b);
      line-height: 1.65;
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .bs-stars { color: #f59e0b; font-size: .9rem; letter-spacing: .04em; }

    /* ── Buttons — shared sizing rules so labels never overflow ── */
    .bs-btn-read,
    .bs-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      width: auto;
      max-width: 100%;
      white-space: nowrap;
      flex-shrink: 0;
      text-decoration: none;
      cursor: pointer;
    }

    /* ── Read button ── */
    .bs-btn-read {
      margin-top: auto;
      padding: .6rem 1.3rem;
      background: transparent;
      color: var(--bs-primary, #0b4fd8);
      border: 1.5px solid var(--bs-primary, #0b4fd8);
      border-radius: 999px;
      font-size: .82rem;
      font-weight: 650;
      transition: background .18s ease, color .18s ease, box-shadow .18s ease, transform .18s ease;
    }
    .bs-btn-read:hover {
      background: var(--bs-primary, #0b4fd8);
      color: var(--bs-btn-text, #fff);
      box-shadow: 0 6px 18px color-mix(in srgb, var(--bs-primary, #0b4fd8) 35%, transparent);
      transform: translateY(-1px);
    }

    /* ── CTA button ── */
    .bs-btn {
      padding: .7rem 1.6rem;
      background: var(--bs-primary, #0b4fd8);
      color: var(--bs-btn-text, #fff);
      border-radius: 999px;
      font-size: .88rem;
      font-weight: 700;
      letter-spacing: -.005em;
      border: none;
      margin-top: auto;
      box-shadow: 0 4px 14px color-mix(in srgb, var(--bs-primary, #0b4fd8) 30%, transparent);
      transition: opacity .18s ease, transform .18s ease, box-shadow .18s ease;
    }
    .bs-btn:hover {
      opacity: .92;
      transform: translateY(-1px);
      box-shadow: 0 8px 22px color-mix(in srgb, var(--bs-primary, #0b4fd8) 40%, transparent);
    }
    .bs-btn:active { transform: translateY(0); }

    .bs-price {
      font-size: 1.1rem;
      font-weight: 750;
      letter-spacing: -.01em;
      color: var(--bs-text, #0f172a);
    }

    /* ── FAQ card items ── */
    .bs-faq-item {
      border-top: 1px solid var(--bs-border, #e5e7eb);
      padding-top: .7rem;
    }
    .bs-faq-q {
      font-weight: 600;
      font-size: .875rem;
      color: var(--bs-text, #0f172a);
      margin-bottom: .25rem;
      line-height: 1.4;
    }
    .bs-faq-a {
      font-size: .82rem;
      color: var(--bs-text-muted, #64748b);
      line-height: 1.6;
    }

    /* ── Pros/cons ── */
    .bs-pros-cons { display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .bs-pros, .bs-cons { flex: 1; min-width: 130px; }
    .bs-pros strong { color: #16a34a; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .bs-cons strong { color: #dc2626; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .bs-pros ul, .bs-cons ul {
      margin: .4rem 0 0;
      padding-left: 1.1rem;
      font-size: .84rem;
      color: var(--bs-text-muted, #374151);
      line-height: 1.75;
    }

    /* ── Empty state ── */
    .bs-empty {
      text-align: center;
      padding: 3rem;
      color: #94a3b8;
      font-size: .9rem;
      border: 1.5px dashed #e2e8f0;
      border-radius: 18px;
    }

    /* ════════════════════════════════════════
       MODAL — Professional editorial design
    ════════════════════════════════════════ */
    .bs-modal-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(10,17,32,.65);
      backdrop-filter: blur(8px) saturate(1.4);
      -webkit-backdrop-filter: blur(8px) saturate(1.4);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      animation: bsFadeIn .2s ease;
    }
    @keyframes bsFadeIn { from { opacity: 0 } to { opacity: 1 } }

    .bs-modal {
      background: var(--bs-card-bg, #fff);
      border-radius: 22px;
      max-width: 740px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      overflow-y: auto;
      box-shadow: 0 40px 120px rgba(10,17,32,.3), 0 0 0 1px rgba(255,255,255,.08);
      animation: bsSlideUp .26s cubic-bezier(.22,1,.36,1);
      display: flex;
      flex-direction: column;
      scrollbar-width: thin;
      scrollbar-color: #e2e8f0 transparent;
    }
    .bs-modal::-webkit-scrollbar { width: 5px; }
    .bs-modal::-webkit-scrollbar-track { background: transparent; }
    .bs-modal::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }

    @keyframes bsSlideUp {
      from { transform: translateY(28px) scale(.98); opacity: 0 }
      to   { transform: none; opacity: 1 }
    }

    /* Hero image — full-bleed at the very top */
    .bs-modal-hero {
      width: 100%;
      height: 360px;
      object-fit: cover;
      display: block;
      flex-shrink: 0;
      border-radius: 22px 22px 0 0;
    }

    /* Product image — contain so nothing is cut off */
    .bs-modal-hero--product {
      object-fit: contain;
      background: #f8fafc;
      height: 300px;
    }

    /* Floating close button over hero (when hero present) */
    .bs-modal-close-float {
      position: absolute;
      top: 14px; right: 14px;
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,.2);
      color: #fff;
      cursor: pointer;
      font-size: 1rem;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
      z-index: 2;
    }
    .bs-modal-close-float:hover { background: rgba(0,0,0,.65); }

    /* Hero wrapper — relative positioning for floating close */
    .bs-modal-hero-wrap {
      position: relative;
      flex-shrink: 0;
    }

    /* Inner content area */
    .bs-modal-inner {
      padding: 1.75rem 2rem 2.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      flex: 1;
    }

    /* Topbar: badge + close (used when no hero image) */
    .bs-modal-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .bs-modal-close {
      flex-shrink: 0;
      width: 34px; height: 34px;
      border: 1.5px solid var(--bs-border, #e5e7eb);
      border-radius: 10px;
      background: #f8fafc;
      cursor: pointer;
      font-size: .95rem;
      display: flex; align-items: center; justify-content: center;
      color: #64748b;
      transition: background .15s, border-color .15s;
    }
    .bs-modal-close:hover { background: #e5e7eb; border-color: #cbd5e1; }

    /* Title */
    .bs-modal h2 {
      margin: 0;
      font-size: 1.65rem;
      font-weight: 700;
      color: var(--bs-text, #0f172a);
      line-height: 1.22;
      letter-spacing: -.025em;
    }

    /* Body text — paragraphs */
    .bs-modal-content {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .bs-modal-content p {
      margin: 0 0 1em;
      font-size: .94rem;
      color: var(--bs-text-muted, #374151);
      line-height: 1.85;
      word-break: break-word;
    }
    .bs-modal-content p:last-child { margin-bottom: 0; }

    /* Rating row */
    .bs-modal-rating {
      display: flex;
      align-items: center;
      gap: .5rem;
    }
    .bs-modal-rating .bs-stars { font-size: 1.1rem; }
    .bs-modal-rating span { font-size: .84rem; color: var(--bs-text-muted, #64748b); font-weight: 500; }

    /* Affiliate buy box */
    .bs-modal-buybox {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      padding: 1.25rem 1.5rem;
      border: 1.5px solid var(--bs-border, #e5e7eb);
      border-radius: 16px;
      background: #f8fafc;
      margin-top: .25rem;
    }
    .bs-modal-buybox-price {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--bs-text, #0f172a);
      letter-spacing: -.02em;
    }

    /* Verdict box */
    .bs-modal-verdict {
      padding: 1rem 1.25rem;
      background: #f0f4ff;
      border-left: 3px solid var(--bs-primary, #0b4fd8);
      border-radius: 0 10px 10px 0;
      font-size: .9rem;
      color: var(--bs-text, #0f172a);
      line-height: 1.65;
    }
    .bs-modal-verdict strong { color: var(--bs-primary, #0b4fd8); }

    /* Pros/cons inside modal */
    .bs-modal-pros-cons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 480px) { .bs-modal-pros-cons { grid-template-columns: 1fr; } }
    .bs-modal-pros-col, .bs-modal-cons-col {
      background: #f8fafc;
      border-radius: 12px;
      padding: 1rem;
    }
    .bs-modal-pros-col { border-top: 3px solid #16a34a; }
    .bs-modal-cons-col { border-top: 3px solid #dc2626; }
    .bs-modal-pros-col strong { color: #16a34a; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .bs-modal-cons-col strong { color: #dc2626; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .bs-modal-pros-col ul, .bs-modal-cons-col ul {
      margin: .5rem 0 0;
      padding-left: 1.1rem;
      font-size: .84rem;
      color: #374151;
      line-height: 1.75;
    }

    /* FAQ inside modal */
    .bs-modal-faq-item {
      border-bottom: 1px solid var(--bs-border, #f1f5f9);
      padding: .9rem 0;
    }
    .bs-modal-faq-item:first-child { padding-top: 0; }
    .bs-modal-faq-item:last-child { border-bottom: none; padding-bottom: 0; }
    .bs-modal-faq-q {
      font-weight: 600;
      font-size: .93rem;
      color: var(--bs-text, #0f172a);
      margin-bottom: .4rem;
      line-height: 1.4;
    }
    .bs-modal-faq-a {
      font-size: .875rem;
      color: var(--bs-text-muted, #4b5563);
      line-height: 1.75;
    }

    /* Tags */
    .bs-modal-tags {
      display: flex; flex-wrap: wrap; gap: .35rem;
      padding-top: .75rem;
      border-top: 1px solid var(--bs-border, #f1f5f9);
    }
    .bs-modal-tag {
      font-size: .65rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: .06em;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--bs-badge-bg, #f1f5f9);
      color: var(--bs-text-muted, #64748b);
    }

    /* Affiliate links (blog) */
    .bs-modal-links {
      display: flex;
      flex-wrap: wrap;
      gap: .65rem;
      padding-top: .5rem;
    }

    /* Loading */
    .bs-loading-pulse {
      display: flex; gap: .5rem; padding: 2rem 0; align-items: center; justify-content: center;
    }
    .bs-loading-pulse span {
      width: 9px; height: 9px; border-radius: 50%;
      background: #cbd5e1; animation: bsPulse 1.2s ease-in-out infinite;
    }
    .bs-loading-pulse span:nth-child(2) { animation-delay: .2s; }
    .bs-loading-pulse span:nth-child(3) { animation-delay: .4s; }
    @keyframes bsPulse {
      0%,80%,100% { transform: scale(.8); opacity: .5 }
      40%          { transform: scale(1.2); opacity: 1  }
    }

    /* Responsive modal */
    @media (max-width: 600px) {
      .bs-modal { border-radius: 16px 16px 0 0; max-height: 95vh; margin-top: auto; }
      .bs-modal-hero { height: 240px; border-radius: 16px 16px 0 0; }
      .bs-modal-hero--product { height: 200px; }
      .bs-modal h2 { font-size: 1.3rem; }
      .bs-modal-inner { padding: 1.25rem 1.25rem 1.75rem; }
      .bs-modal-overlay { align-items: flex-end; padding: 0; }
    }
  `;

  // ── Helpers ──────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /** Convert plain text with newlines into proper <p> HTML */
  function textToHtml(text) {
    if (!text) return '';
    return text
      .split(/\n{2,}/)
      .map(para => para.trim())
      .filter(Boolean)
      .map(para => `<p>${esc(para.replace(/\n/g, ' '))}</p>`)
      .join('');
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

  // ── Theme ────────────────────────────────────────────────────────
  function hexBrightness(hex) {
    const h = (hex || '').replace('#', '');
    if (h.length < 6) return 128;
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return (r*299 + g*587 + b*114) / 1000;
  }

  function applyTheme(theme) {
    const existing = document.getElementById('bs-theme-styles');
    if (existing) existing.remove();
    if (!theme || typeof theme !== 'object' || !Object.keys(theme).length) return;

    const primary   = theme.primary    || '#0b4fd8';
    const secondary = theme.secondary  || theme.accent || theme.primary || '#0ea5e9';
    const cardBg    = theme.card_bg    || theme.background || '#ffffff';
    const text      = theme.text       || '#0f172a';
    const textMuted = theme.text_muted || '#64748b';
    const border    = theme.border     || '#e5e7eb';
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
      }`;
    document.head.appendChild(style);
  }

  // ── Modal ────────────────────────────────────────────────────────
  function openModal(b) {
    const overlay = document.createElement('div');
    overlay.className = 'bs-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', esc(b.boardName || b.title || b.productName || 'Board'));

    const modal = document.createElement('div');
    modal.className = 'bs-modal';
    modal.innerHTML = buildModalContent(b, true);
    overlay.appendChild(modal);

    function close() {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .18s';
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    modal.addEventListener('click', e => {
      if (e.target.closest('.bs-modal-close') || e.target.closest('.bs-modal-close-float')) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Fetch full board data
    if (b.embedId) {
      fetch(`${apiBase}/embed/board/${encodeURIComponent(b.embedId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(full => {
          if (!full || !overlay.isConnected) return;
          modal.innerHTML = buildModalContent(full, false);
        })
        .catch(() => {});
    }
  }

  function buildModalContent(b, loading) {
    if (loading) {
      return `
        <div class="bs-modal-inner">
          <div class="bs-modal-topbar">
            <span class="bs-type-badge">${esc(typeName(b.type))}</span>
            <button class="bs-modal-close" aria-label="Schließen">✕</button>
          </div>
          <div class="bs-loading-pulse"><span></span><span></span><span></span></div>
        </div>`;
    }

    const img = b.image || b.blogImage || b.affImage || b.revImage || '';
    const isProduct = b.type === 'affiliate' || b.type === 'review';

    // Hero image block
    const heroHtml = img ? `
      <div class="bs-modal-hero-wrap">
        <img class="bs-modal-hero${isProduct ? ' bs-modal-hero--product' : ''}"
             src="${esc(img)}" alt="${esc(b.boardName || b.title || b.productName || '')}">
        <button class="bs-modal-close-float" aria-label="Schließen">✕</button>
      </div>` : '';

    // Title (different field per type)
    const title = b.type === 'faq'
      ? (b.faqTitle || b.boardName || 'FAQ')
      : (b.title || b.productName || b.boardName || '');

    // Build type-specific content
    let content = '';

    if (b.type === 'blog') {
      const fullText = b.content || b.intro || '';
      content = `
        <div class="bs-modal-content">${textToHtml(fullText)}</div>
        ${(b.affiliateLinks || []).filter(l => l.url).length ? `
          <div class="bs-modal-links">
            ${(b.affiliateLinks).filter(l => l.url).map(l =>
              `<a class="bs-btn" href="${esc(l.url)}" target="_blank" rel="noopener nofollow">
                ${esc(l.text || 'Mehr erfahren')} →
               </a>`
            ).join('')}
          </div>` : ''}`;

    } else if (b.type === 'affiliate') {
      content = `
        ${b.rating ? `<div class="bs-modal-rating">${stars(b.rating)}<span>${b.rating} / 5 Sterne</span></div>` : ''}
        <div class="bs-modal-content">${textToHtml(b.description || '')}</div>
        ${b.affiliateUrl ? `
          <div class="bs-modal-buybox">
            <span class="bs-modal-buybox-price">${b.price ? esc(b.price) : ''}</span>
            <a class="bs-btn" href="${esc(b.affiliateUrl)}" target="_blank" rel="noopener nofollow">
              ${esc(b.buttonText || 'Jetzt ansehen')} →
            </a>
          </div>` : ''}`;

    } else if (b.type === 'review') {
      const hasPros = b.pros?.length;
      const hasCons = b.cons?.length;
      content = `
        ${b.rating ? `<div class="bs-modal-rating">${stars(b.rating)}<span>${b.rating} / 5 Sterne</span></div>` : ''}
        <div class="bs-modal-content">${textToHtml(b.reviewText || '')}</div>
        ${(hasPros || hasCons) ? `
          <div class="bs-modal-pros-cons">
            ${hasPros ? `
              <div class="bs-modal-pros-col">
                <strong>Vorteile</strong>
                <ul>${b.pros.filter(Boolean).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
              </div>` : ''}
            ${hasCons ? `
              <div class="bs-modal-cons-col">
                <strong>Nachteile</strong>
                <ul>${b.cons.filter(Boolean).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
              </div>` : ''}
          </div>` : ''}
        ${b.verdict ? `
          <div class="bs-modal-verdict"><strong>Fazit:</strong> ${esc(b.verdict)}</div>` : ''}
        ${b.affiliateUrl ? `
          <div class="bs-modal-buybox">
            <span class="bs-modal-buybox-price">${b.price ? esc(b.price) : ''}</span>
            <a class="bs-btn" href="${esc(b.affiliateUrl)}" target="_blank" rel="noopener nofollow">
              ${esc(b.buttonText || 'Preis prüfen')} →
            </a>
          </div>` : ''}`;

    } else if (b.type === 'faq') {
      content = `
        <div>
          ${(b.faqs || []).map(f => `
            <div class="bs-modal-faq-item">
              <div class="bs-modal-faq-q">${esc(f.question || f.q || '')}</div>
              <div class="bs-modal-faq-a">${esc(f.answer || f.a || '')}</div>
            </div>`).join('')}
        </div>`;
    }

    const tags = b.tags || [];

    return `
      ${heroHtml}
      <div class="bs-modal-inner">
        ${!heroHtml ? `
          <div class="bs-modal-topbar">
            <span class="bs-type-badge">${esc(typeName(b.type))}</span>
            <button class="bs-modal-close" aria-label="Schließen">✕</button>
          </div>` : `
          <span class="bs-type-badge" style="width:fit-content">${esc(typeName(b.type))}</span>`}
        <h2>${esc(title)}</h2>
        ${content}
        ${tags.length ? `
          <div class="bs-modal-tags">
            ${tags.map(t => `<span class="bs-modal-tag">${esc(t)}</span>`).join('')}
          </div>` : ''}
      </div>`;
  }

  // ── Card renderers ───────────────────────────────────────────────
  function cardImage(b) {
    const thumb = b.imageThumb || b.image || b.blogImage || b.affImage || '';
    const typeClass = b.type || 'blog';
    if (thumb) {
      return `<img class="bs-card-img" src="${esc(thumb)}"
                alt="${esc(b.boardName || b.title || b.productName || '')}"
                loading="lazy">`;
    }
    const icon = TYPE_ICONS[typeClass] || TYPE_ICONS.blog;
    return `
      <div class="bs-card-img-placeholder bs-card-img-placeholder--${typeClass}">
        <div class="bs-card-ph-icon">${icon}</div>
        <div class="bs-card-ph-lines">
          <div class="bs-card-ph-line"></div>
          <div class="bs-card-ph-line bs-card-ph-line--short"></div>
          <div class="bs-card-ph-line"></div>
        </div>
      </div>`;
  }

  const TYPE_ICONS = {
    blog:      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    affiliate: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>',
    review:    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    faq:       '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  function renderBlog(b) {
    const intro = b.intro || b.content || '';
    const snippet = intro.length > 130 ? intro.slice(0, 127) + '…' : intro;
    return `
      ${cardImage(b)}
      <div class="bs-card-body">
        <span class="bs-type-badge">Blog</span>
        <h3>${esc(b.title || b.boardName)}</h3>
        ${snippet ? `<p>${esc(snippet)}</p>` : ''}
        <button class="bs-btn-read" data-bs-open>Weiterlesen →</button>
      </div>`;
  }

  function renderAffiliate(b) {
    const desc = (b.description || '').slice(0, 115);
    return `
      ${cardImage(b)}
      <div class="bs-card-body">
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
          <span class="bs-type-badge">Empfehlung</span>
          ${b.badge ? `<span class="bs-type-badge" style="background:#fef9c3;color:#92400e">${esc(b.badge)}</span>` : ''}
        </div>
        <h3>${esc(b.productName || b.boardName)}</h3>
        ${b.rating ? stars(b.rating) : ''}
        ${desc ? `<p>${esc(desc)}${(b.description||'').length > 115 ? '…' : ''}</p>` : ''}
        ${b.price ? `<span class="bs-price">${esc(b.price)}</span>` : ''}
        <button class="bs-btn-read" data-bs-open>Details ansehen →</button>
      </div>`;
  }

  function renderReview(b) {
    const txt = (b.reviewText || '').slice(0, 115);
    return `
      ${cardImage(b)}
      <div class="bs-card-body">
        <span class="bs-type-badge">Review</span>
        <h3>${esc(b.productName || b.boardName)}</h3>
        ${b.rating ? stars(b.rating) : ''}
        ${txt ? `<p>${esc(txt)}${(b.reviewText||'').length > 115 ? '…' : ''}</p>` : ''}
        <button class="bs-btn-read" data-bs-open>Review lesen →</button>
      </div>`;
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
            <div class="bs-faq-q">${esc(f.question || f.q || '')}</div>
            <div class="bs-faq-a">${esc((f.answer || f.a || '').slice(0, 75))}${(f.answer||f.a||'').length > 75 ? '…' : ''}</div>
          </div>`).join('')}
        <button class="bs-btn-read" data-bs-open>Alle FAQs →</button>
      </div>`;
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
        <h3>${esc(b.boardName || b.title || 'Board')}</h3>
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
      '<div class="bs-loading-pulse"><span></span><span></span><span></span></div>';

    // Show a friendlier hint after 4 s (Railway cold-start can take 10–15 s)
    const slowHint = setTimeout(() => {
      if (container.querySelector('.bs-loading-pulse')) {
        container.innerHTML = `
          <div class="bs-loading-pulse"><span></span><span></span><span></span></div>
          <p style="text-align:center;font-size:.82rem;color:#94a3b8;margin-top:.75rem">
            Inhalte werden geladen…
          </p>`;
      }
    }, 4000);

    // Fire a quick health ping in parallel — warms Railway if it's sleeping
    // while the real fetch is already in flight (overlap = zero extra wait time)
    fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(25000) }).catch(() => {});

    // Fetch with timeout + 1 automatic retry (handles Railway cold start)
    async function fetchChannel(timeout) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(
          `${apiBase}/embed/channel/${encodeURIComponent(key)}`,
          { signal: ctrl.signal }
        );
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      } catch (e) {
        clearTimeout(t);
        throw e;
      }
    }

    try {
      let data;
      try {
        data = await fetchChannel(18000); // first attempt — 18 s
      } catch {
        // One automatic retry after a short pause (server might now be warm)
        await new Promise(r => setTimeout(r, 1500));
        data = await fetchChannel(15000);
      }
      clearTimeout(slowHint);
      if (data.theme) applyTheme(data.theme);
      mount(container, data.boards || []);
    } catch (err) {
      clearTimeout(slowHint);
      container.innerHTML = `
        <div class="bs-empty">
          Inhalte konnten nicht geladen werden.
          <br><button onclick="location.reload()" style="margin-top:.75rem;padding:.35rem .9rem;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:.8rem;color:#64748b">Erneut versuchen</button>
        </div>`;
      console.warn('[boards.solutions] channel.js Fehler:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
