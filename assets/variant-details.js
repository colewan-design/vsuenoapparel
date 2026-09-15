import { morph } from '@theme/morph';
import { Component } from '@theme/component';
import { StandardEvents } from '@shopify/events';

/**
 * Keeps the variant details panel in sync with the selected variant.
 *
 * The variant picker re-renders the section server-side on every change, so the
 * correct tier is already chosen in Liquid. We just morph our own subtree from
 * that response, mirroring how product-inventory stays in sync.
 */
class VariantDetails extends Component {
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
   * morph() rewrites our subtree, so the class has to go on after it lands. The
   * reflow between removing and adding restarts the animation when the same
   * panel is shown twice in a row.
   */
  #animateActivePanel() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const panel = this.querySelector('.variant-detail:not([hidden])');
    if (!panel) return;

    panel.classList.remove('variant-detail--animate');
    void panel.offsetWidth;

    const steps = panel.querySelectorAll('.variant-detail__label, .variant-detail__row');
    steps.forEach((step, index) => step.style.setProperty('--vd-index', String(index)));

    panel.classList.add('variant-detail--animate');

    const last = steps[steps.length - 1];
    last?.addEventListener(
      'animationend',
      () => {
        panel.classList.remove('variant-detail--animate');
        steps.forEach((step) => step.style.removeProperty('--vd-index'));
      },
      { once: true }
    );
  }
}

if (!customElements.get('variant-details')) {
  customElements.define('variant-details', VariantDetails);
}
