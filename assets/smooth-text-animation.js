/**
 * A smooth text animation for the product title.
 *
 * Splits the title into words, then reveals each one from behind a mask with a
 * staggered, damped bounce. Runs once on load on product pages, and again when
 * the section is re-rendered in the theme editor.
 *
 * Styling and timing live in smooth-text-animation.css.
 */

/** The main product title. Scoped to the product information section so quick-add
 *  modals and recommendation cards are left alone. */
const TITLE_SELECTOR = '[id*="ProductInformation-"] h1';

/** Put this attribute on the title to skip the animation. */
const OPT_OUT_ATTRIBUTE = 'data-no-text-animation';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Wraps each word in a masked span so it can be animated on its own.
 * @param {HTMLElement} element - The element whose text should be split.
 * @returns {boolean} Whether there was any text to split.
 */
function splitIntoWords(element) {
  const words = element.textContent?.trim().split(/\s+/).filter(Boolean);
  if (!words?.length) return false;

  const fragment = document.createDocumentFragment();

  words.forEach((word, index) => {
    const mask = document.createElement('span');
    mask.className = 'sta__word';

    const inner = document.createElement('span');
    inner.className = 'sta__word-inner';
    inner.style.setProperty('--sta-index', String(index));
    inner.textContent = word;

    mask.appendChild(inner);
    fragment.appendChild(mask);

    // Restore the whitespace the split removed, so the title still wraps naturally.
    if (index < words.length - 1) fragment.appendChild(document.createTextNode(' '));
  });

  element.replaceChildren(fragment);
  return true;
}

/**
 * Splits and animates a title, restoring the original markup if anything fails.
 * @param {HTMLElement} element - The title element.
 */
function animateText(element, restart = false) {
  if (element.dataset.staInitialized === 'true') {
    if (!restart || prefersReducedMotion()) return;

    const words = element.querySelectorAll('.sta__word-inner');
    element.classList.remove('sta--animate');
    words.forEach((word) => word.classList.remove('sta__word-inner--done'));

    // Force the browser to commit the reset before replaying the reveal.
    void element.offsetWidth;
    element.classList.add('sta--animate');
    return;
  }
  if (element.hasAttribute(OPT_OUT_ATTRIBUTE)) return;

  element.dataset.staInitialized = 'true';

  const originalMarkup = element.innerHTML;
  const originalText = element.textContent?.trim() ?? '';

  try {
    element.classList.add('sta');

    if (!splitIntoWords(element)) {
      element.classList.remove('sta');
      return;
    }

    // Read the title as one string rather than word by word.
    element.setAttribute('aria-label', originalText);

    if (prefersReducedMotion()) return;

    // Added in the same frame as the split, so the static title never paints.
    element.classList.add('sta--animate');

    const words = element.querySelectorAll('.sta__word-inner');
    const lastWord = words[words.length - 1];

    lastWord?.addEventListener(
      'animationend',
      () => words.forEach((word) => word.classList.add('sta__word-inner--done')),
      { once: true }
    );
  } catch (error) {
    console.warn('[smooth-text-animation] Could not animate the title:', error);
    element.innerHTML = originalMarkup;
    element.classList.remove('sta', 'sta--animate');
    element.removeAttribute('aria-label');
  }
}

function init() {
  const title = document.querySelector(TITLE_SELECTOR);
  if (title instanceof HTMLElement) animateText(title);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

document.addEventListener('shopify:section:load', init);

document.addEventListener('smooth-text:animate', (event) => {
  const animatedElement = event.detail?.element;
  if (!(animatedElement instanceof HTMLElement)) return;

  animateText(animatedElement, event.detail?.restart === true);
});
