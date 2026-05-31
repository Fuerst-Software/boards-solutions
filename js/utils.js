/**
 * boards.solutions — Utility Functions
 * Pure, side-effect-free helpers. No DOM init here.
 */

/**
 * querySelector shorthand
 * @param {string} selector
 * @param {Element|Document} [context=document]
 * @returns {Element|null}
 */
export const $ = (selector, context = document) =>
  context.querySelector(selector);

/**
 * querySelectorAll shorthand — returns a real array
 * @param {string} selector
 * @param {Element|Document} [context=document]
 * @returns {Element[]}
 */
export const $$ = (selector, context = document) =>
  Array.from(context.querySelectorAll(selector));

/**
 * Debounce — delays fn until after `delay` ms have elapsed
 * since the last invocation.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle — ensures fn is called at most once per `limit` ms.
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(fn, limit) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

/**
 * Event listener helper with optional event delegation.
 * Returns a cleanup function to remove the listener.
 *
 * Direct: on(btn, 'click', handler)
 * Delegated: on(document, 'click', '.btn', handler) — handler receives (event, matchedEl)
 *
 * @param {EventTarget} target
 * @param {string} event
 * @param {string|Function} selectorOrHandler
 * @param {Function} [handler]
 * @returns {Function} cleanup
 */
export function on(target, event, selectorOrHandler, handler) {
  if (typeof selectorOrHandler === 'function') {
    target.addEventListener(event, selectorOrHandler);
    return () => target.removeEventListener(event, selectorOrHandler);
  }

  const delegated = (e) => {
    const match = e.target.closest(selectorOrHandler);
    if (match && target.contains(match)) {
      handler.call(match, e, match);
    }
  };

  target.addEventListener(event, delegated);
  return () => target.removeEventListener(event, delegated);
}

/**
 * Returns true when any part of el is inside the viewport.
 * @param {Element} el
 * @returns {boolean}
 */
export function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

/**
 * Returns true when the user prefers reduced motion.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
