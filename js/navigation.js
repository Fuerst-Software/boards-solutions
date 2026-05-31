/**
 * boards.solutions — Navigation
 * Sticky header, mobile menu with focus trap, smooth scroll, scroll-spy.
 */

import { $, $$, on, prefersReducedMotion } from './utils.js';
import { createFocusTrap } from './accessibility.js';

/** Collected teardown functions for SPA-ready cleanup */
const cleanups = [];

/**
 * Sticky header via IntersectionObserver — avoids scroll event listener cost.
 * Observes a 1px sentinel element at the top of the page.
 */
function initStickyHeader() {
  const header = $('.site-header');
  if (!header) return;

  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText =
    'position:absolute;top:0;left:0;width:1px;height:10px;pointer-events:none;';
  document.body.prepend(sentinel);

  const observer = new IntersectionObserver(
    ([entry]) => {
      header.classList.toggle('header--scrolled', !entry.isIntersecting);
    },
    { threshold: 1.0 }
  );

  observer.observe(sentinel);
  cleanups.push(() => {
    observer.disconnect();
    sentinel.remove();
  });
}

/**
 * Mobile menu toggle with full focus trap.
 * Escape key closes; clicking the backdrop closes; focus returns to trigger.
 */
function initMobileMenu() {
  const toggle   = $('.nav-toggle');
  const menu     = $('#mobile-menu');
  const closeBtn = $('.mobile-menu__close');

  if (!toggle || !menu) return;

  const trap = createFocusTrap(menu);
  let isOpen = false;

  function openMenu() {
    isOpen = true;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Menü schließen');
    menu.removeAttribute('aria-hidden');
    menu.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    trap.activate();
  }

  function closeMenu() {
    isOpen = false;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Menü öffnen');
    menu.setAttribute('aria-hidden', 'true');
    menu.classList.remove('is-open');
    document.body.style.overflow = '';
    trap.deactivate();
    /* Return focus to the element that opened the menu */
    toggle.focus();
  }

  const cleanup1 = on(toggle, 'click', () => (isOpen ? closeMenu() : openMenu()));

  /* Escape closes */
  const cleanup2 = on(menu, 'keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  /* Click on backdrop (outside menu__inner) closes */
  const cleanup3 = on(menu, 'click', (e) => {
    if (e.target === menu) closeMenu();
  });

  /* Close button inside menu */
  const cleanup4 = closeBtn
    ? on(closeBtn, 'click', closeMenu)
    : () => {};

  /* Close menu when any mobile link is clicked */
  const cleanup5 = on(menu, 'click', '.mobile-menu__links a', () => closeMenu());

  cleanups.push(
    cleanup1, cleanup2, cleanup3, cleanup4, cleanup5,
    () => trap.destroy()
  );
}

/**
 * Smooth scroll for anchor links.
 * Skipped entirely when user prefers reduced motion.
 */
function initSmoothScroll() {
  if (prefersReducedMotion()) return;

  const cleanup = on(document, 'click', 'a[href^="#"]', function (e, el) {
    const href = el.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.getElementById(href.slice(1));
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    /* Update URL without triggering a navigation */
    history.pushState(null, '', href);

    /* Move focus to section for keyboard/AT users */
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
    target.focus({ preventScroll: true });
  });

  cleanups.push(cleanup);
}

/**
 * Scroll-spy: highlights the matching nav link for the visible section.
 * Uses IntersectionObserver at 40% threshold.
 */
function initScrollSpy() {
  const navLinks   = $$('nav[aria-label="Hauptnavigation"] a[href^="#"]');
  const mobileLinks = $$('.mobile-menu__links a[href^="#"]');
  const allLinks   = [...navLinks, ...mobileLinks];

  if (!allLinks.length) return;

  const sections = [...new Set(
    allLinks
      .map(link => link.getAttribute('href')?.slice(1))
      .filter(Boolean)
      .map(id => document.getElementById(id))
      .filter(Boolean)
  )];

  if (!sections.length) return;

  const updateActive = (activeId) => {
    allLinks.forEach(link => {
      const matches = link.getAttribute('href') === `#${activeId}`;
      if (matches) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
      link.closest('li')?.classList.toggle('is-active', matches);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible) updateActive(visible.target.id);
    },
    {
      rootMargin: '-10% 0px -55% 0px',
      threshold: [0, 0.25, 0.5],
    }
  );

  sections.forEach(s => observer.observe(s));
  cleanups.push(() => observer.disconnect());
}

/**
 * Remove all registered event listeners and observers.
 * Call this before navigating away in a SPA context.
 */
export function destroy() {
  cleanups.forEach(fn => fn());
  cleanups.length = 0;
}

export function init() {
  initStickyHeader();
  initMobileMenu();
  initSmoothScroll();
  initScrollSpy();
}

/* Modules are deferred — DOM is ready when this runs */
init();
