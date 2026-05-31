/**
 * boards.solutions — Accessibility Utilities
 * Focus trapping, form validation, live-region helpers.
 */

import { $, $$, on } from './utils.js';

/** All natively focusable elements */
const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
].join(', ');

/**
 * Creates a focus trap for a container element.
 * Tab/Shift+Tab cycles only within container while active.
 *
 * @param {Element} container
 * @returns {{ activate(): void, deactivate(): void, destroy(): void }}
 */
export function createFocusTrap(container) {
  let active = false;

  const getFocusables = () => $$(FOCUSABLE_SELECTOR, container);

  const handleKeydown = (e) => {
    if (!active || e.key !== 'Tab') return;

    const focusables = getFocusables();
    if (!focusables.length) return;

    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !container.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeydown);

  return {
    activate() {
      active = true;
      const focusables = getFocusables();
      if (focusables.length) focusables[0].focus();
    },
    deactivate() {
      active = false;
    },
    destroy() {
      active = false;
      container.removeEventListener('keydown', handleKeydown);
    },
  };
}

/**
 * Shows a validation error for an input field.
 * Sets aria-invalid, populates the error element, announces via role="alert".
 */
function showError(input, errorEl, message) {
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', errorEl.id);
  errorEl.textContent = message;
  errorEl.setAttribute('role', 'alert');
}

/**
 * Clears a validation error for an input field.
 */
function clearError(input, errorEl) {
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-describedby');
  errorEl.textContent = '';
  errorEl.removeAttribute('role');
}

/** Basic RFC 5322-inspired email pattern check */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Initialises the WCAG 2.2 AA demo form in the accessibility section.
 * Handles required fields, email format, live region announcements.
 */
function initDemoForm() {
  const form = $('#demo-form');
  if (!form) return;

  const nameInput   = $('#demo-name');
  const emailInput  = $('#demo-email');
  const nameError   = $('#demo-name-error');
  const emailError  = $('#demo-email-error');
  const successMsg  = $('#demo-success');

  if (!nameInput || !emailInput || !nameError || !emailError || !successMsg) return;

  /* Live blur validation */
  on(nameInput, 'blur', () => {
    if (!nameInput.value.trim()) {
      showError(nameInput, nameError, 'Bitte geben Sie Ihren Namen ein.');
    } else {
      clearError(nameInput, nameError);
    }
  });

  on(emailInput, 'blur', () => {
    if (!emailInput.value.trim()) {
      showError(emailInput, emailError, 'Bitte geben Sie Ihre E-Mail-Adresse ein.');
    } else if (!isValidEmail(emailInput.value)) {
      showError(emailInput, emailError, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    } else {
      clearError(emailInput, emailError);
    }
  });

  /* Clear error on input after failure */
  on(nameInput, 'input', () => {
    if (nameInput.getAttribute('aria-invalid') === 'true' && nameInput.value.trim()) {
      clearError(nameInput, nameError);
    }
  });

  on(emailInput, 'input', () => {
    if (emailInput.getAttribute('aria-invalid') === 'true' && isValidEmail(emailInput.value)) {
      clearError(emailInput, emailError);
    }
  });

  /* Submit */
  on(form, 'submit', (e) => {
    e.preventDefault();
    successMsg.textContent = '';

    let firstInvalid = null;

    clearError(nameInput, nameError);
    clearError(emailInput, emailError);

    if (!nameInput.value.trim()) {
      showError(nameInput, nameError, 'Bitte geben Sie Ihren Namen ein.');
      firstInvalid = firstInvalid ?? nameInput;
    }

    if (!emailInput.value.trim()) {
      showError(emailInput, emailError, 'Bitte geben Sie Ihre E-Mail-Adresse ein.');
      firstInvalid = firstInvalid ?? emailInput;
    } else if (!isValidEmail(emailInput.value)) {
      showError(emailInput, emailError, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      firstInvalid = firstInvalid ?? emailInput;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    /* Success — announce to screen readers via polite live region */
    successMsg.textContent = 'Danke! Ihre Nachricht wurde übermittelt. Wir melden uns bald.';
    form.reset();

    /* Clear success message after 6 seconds */
    setTimeout(() => {
      successMsg.textContent = '';
    }, 6000);
  });
}

/**
 * Ensures clicking a skip-link moves visible focus to the target.
 * Required because some browsers don't shift focus on anchor hash nav.
 */
function initSkipLink() {
  const skipLink = $('.skip-link');
  if (!skipLink) return;

  on(skipLink, 'click', (e) => {
    const targetId = skipLink.getAttribute('href')?.slice(1);
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;

    e.preventDefault();
    /* Make non-interactive element focusable transiently */
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
    target.focus();
  });
}

export function init() {
  initSkipLink();
  initDemoForm();
}

/* Modules are deferred — DOM is ready when this runs */
init();
