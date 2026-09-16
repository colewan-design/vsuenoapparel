import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { StandardEvents } from '@shopify/events';

/**
 * Text inside a panel that reads well letter by letter: the tier label and each
 * row's term and value. The bullet lists are excluded by the plain-text check in
 * splitIntoCharacters.
 */
const CHAR_SPLIT_SELECTOR = '.variant-detail__label, .variant-detail__row dt span, .variant-detail__row dd';

/**
 * Longer than this and the per-letter stagger outlives the reveal it belongs to,
 * so the text keeps the simpler whole-block rise instead.
 */
const MAX_SPLIT_LENGTH = 90;

/**
 * Wraps every character in its own mask so it can rise on its own delay.
 *
 * Characters are grouped into word spans because an inline-block character is a
 * break opportunity -- without the grouping the browser would happily wrap a
 * line in the middle of a word.
 *
 * The animated copy is hidden from assistive tech and paired with a plain
 * visually-hidden copy, so the text is still announced as one string rather than
 * spelled out.
 *
 * @param {Element} element - The element whose text should be split.
 */
function splitIntoCharacters(element) {
  // Rich content (lists, paragraphs) keeps the whole-block rise.
  if (element.firstElementChild) return;

  const text = element.textContent?.trim();
  if (!text || text.length > MAX_SPLIT_LENGTH) return;

  const animated = document.createElement('span');
  animated.setAttribute('aria-hidden', 'true');

  const words = text.split(/\s+/).filter(Boolean);
  let charIndex = 0;

  words.forEach((word, wordIndex) => {
    const wordElement = document.createElement('span');
    wordElement.className = 'vd-word';

    for (const character of word) {
      const mask = document.createElement('span');
      mask.className = 'vd-char';

      const inner = document.createElement('span');
      inner.className = 'vd-char__inner';
      inner.style.setProperty('--vd-char-index', String(charIndex));
      inner.textContent = character;
      charIndex += 1;

      mask.appendChild(inner);
      wordElement.appendChild(mask);
    }

    animated.appendChild(wordElement);

    // Restore the whitespace the split removed, so the text still wraps.
    if (wordIndex < words.length - 1) animated.appendChild(document.createTextNode(' '));
  });

  const announced = document.createElement('span');
  announced.className = 'visually-hidden';
  announced.textContent = text;

  // Doubles as the CSS hook that tells the stylesheet this element is split.
  element.dataset.vdSplit = text;
  element.replaceChildren(announced, animated);
}

/**
 * Keeps the variant details panel in sync with the selected variant.
 *
 * The variant picker re-renders the section server-side on every change, so the
 * correct tier is already chosen in Liquid. We just morph our own subtree from
 * that response, mirroring how product-inventory stays in sync.
 */
class VariantDetails extends Component {
  /** Identifies the current reveal, so a superseded one cannot clean up after it. */
  #animationRun = null;

  connectedCallback() {
    super.connectedCallback();
    const section = this.closest('.shopify-section, dialog');
    section?.addEventListener(StandardEvents.productSelect, this.#handleProductSelect);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    const section = this.closest('.shopify-section, dialog');
    section?.removeEventListener(StandardEvents.productSelect, this.#handleProductSelect);
  }

  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html, newProduct } = detail;

        if (newProduct) {
          this.dataset.productId = newProduct.id;
        } else if (detail.productId && detail.productId !== this.dataset.productId) {
          return;
        }

        const updated = html.querySelector('variant-details');
        if (!updated) return;

        // Morph diffs against our live DOM, so hand it plain text rather than
        // making it unpick the character spans from the previous reveal.
        this.#animationRun = null;
        this.#restorePlainText();

        morph(this, updated, { childrenOnly: true });
        this.#animateActivePanel();
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[variant-details] Event promise rejected:', error);
      });
  };

  /**
   * Replays the staggered reveal on the tier that just became visible.
   *
   * morph() rewrites our subtree, so the split and the class both have to go on
   * after it lands. The reflow between removing and adding the class restarts
   * the animation when the same panel is shown twice in a row.
   */
  #animateActivePanel() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const panel = this.querySelector('.variant-detail:not([hidden])');
    if (!panel) return;

    panel.classList.remove('variant-detail--animate');

    const steps = panel.querySelectorAll('.variant-detail__label, .variant-detail__row');
    steps.forEach((step, index) => step.style.setProperty('--vd-index', String(index)));
    panel.querySelectorAll(CHAR_SPLIT_SELECTOR).forEach(splitIntoCharacters);

    void panel.offsetWidth;
    panel.classList.add('variant-detail--animate');

    const run = Symbol('variant-details reveal');
    this.#animationRun = run;

    const finish = () => {
      // A newer variant change has already taken over.
      if (this.#animationRun !== run) return;
      this.#animationRun = null;
      panel.classList.remove('variant-detail--animate');
      steps.forEach((step) => step.style.removeProperty('--vd-index'));
      this.#restorePlainText(panel);
    };

    // Every character animates on its own delay, so wait for the whole subtree
    // rather than guessing which element finishes last.
    if (typeof panel.getAnimations !== 'function') {
      panel.addEventListener('animationend', finish, { once: true });
      return;
    }

    Promise.allSettled(panel.getAnimations({ subtree: true }).map((animation) => animation.finished)).then(finish);
  }

  /**
   * Puts the split elements back to plain text.
   * @param {Element} [root] - Subtree to restore. Defaults to the whole component.
   */
  #restorePlainText(root = this) {
    for (const element of root.querySelectorAll('[data-vd-split]')) {
      element.textContent = element.dataset.vdSplit ?? element.textContent;
      delete element.dataset.vdSplit;
    }
  }
}

if (!customElements.get('variant-details')) {
  customElements.define('variant-details', VariantDetails);
}
