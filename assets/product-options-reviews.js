/**
 * Accessible tabs for the client-editable product option detail section.
 * Detail copy delegates its word reveal to the product title animation asset.
 */
class ProductOptionsReviews extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#handleClick);
    this.addEventListener('keydown', this.#handleKeydown);
    this.addEventListener('shopify:block:select', this.#handleBlockSelect);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#handleClick);
    this.removeEventListener('keydown', this.#handleKeydown);
    this.removeEventListener('shopify:block:select', this.#handleBlockSelect);
  }

  get tabs() {
    return [...this.querySelectorAll('[data-variant-trigger]')];
  }

  #handleClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest('[data-variant-trigger]');
    if (!(tab instanceof HTMLButtonElement) || !this.contains(tab)) return;

    this.#select(tab.dataset.variantTrigger, true);
  };

  #handleKeydown = (event) => {
    if (!(event.target instanceof HTMLButtonElement) || !event.target.matches('[data-variant-trigger]')) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const tabs = this.tabs;
    const currentIndex = tabs.indexOf(event.target);
    let nextIndex = currentIndex;

    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;

    const nextTab = tabs[nextIndex];
    if (!(nextTab instanceof HTMLButtonElement)) return;
    this.#select(nextTab.dataset.variantTrigger, true);
    nextTab.focus();
  };

  #handleBlockSelect = (event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest('[data-variant-trigger]');
    if (!(tab instanceof HTMLButtonElement)) return;
    this.#select(tab.dataset.variantTrigger, false);
  };

  #select(id, animate) {
    if (!id) return;

    for (const tab of this.tabs) {
      const isSelected = tab.dataset.variantTrigger === id;
      tab.classList.toggle('is-selected', isSelected);
      tab.setAttribute('aria-selected', String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    }

    const panels = this.querySelectorAll('[data-variant-panel]');
    for (const panel of panels) {
      const isSelected = panel.getAttribute('data-variant-panel') === id;
      panel.classList.toggle('is-selected', isSelected);
      panel.toggleAttribute('hidden', !isSelected);

      if (isSelected && animate) {
        const detailText = panel.querySelector('[data-variant-detail-text]');
        if (detailText instanceof HTMLElement) {
          requestAnimationFrame(() => {
            detailText.dispatchEvent(
              new CustomEvent('smooth-text:animate', {
                bubbles: true,
                detail: { element: detailText, restart: true },
              })
            );
          });
        }
      }
    }
  }
}

if (!customElements.get('product-options-reviews')) {
  customElements.define('product-options-reviews', ProductOptionsReviews);
}
