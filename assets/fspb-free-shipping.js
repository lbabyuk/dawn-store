(() => {
  const SECTION_UPSELL = 'fspb-upsell';

  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    const value = (Number(cents) || 0) / 100;
    const formatString = format || '${{amount}}';
    const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    const match = formatString.match(placeholderRegex);
    if (!match) return String(value);

    let formatted;
    switch (match[1]) {
      case 'amount_no_decimals':
        formatted = String(Math.round(value));
        break;
      case 'amount_with_comma_separator':
        formatted = value.toFixed(2).replace('.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        formatted = String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        break;
      case 'amount_with_apostrophe_separator':
        formatted = value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        break;
      default:
        formatted = value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    return formatString.replace(placeholderRegex, formatted);
  }

  function getCartTotal(cartData) {
    if (!cartData) return null;
    if (typeof cartData.total_price === 'number') return cartData.total_price;
    if (cartData.cartData && typeof cartData.cartData.total_price === 'number') {
      return cartData.cartData.total_price;
    }
    return null;
  }

  function fetchConfig(type = 'json') {
    if (typeof window.fetchConfig === 'function') return window.fetchConfig(type);
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
    };
  }

  class FspbShippingBar extends HTMLElement {
    connectedCallback() {
      this.messageEl = this.querySelector('[data-fspb-message]');
      this.trackEl = this.querySelector('[data-fspb-track]');
      this.upsellEl = this.querySelector('[data-fspb-upsell]');
      this.listEl = this.querySelector('[data-fspb-list]');

      this.threshold = Number(this.dataset.threshold) || 0;
      this.moneyFormat = this.dataset.moneyFormat || '${{amount}}';
      this.textProgress = this.dataset.textProgress || 'Add [amount] more for free shipping';
      this.textUnlocked = this.dataset.textUnlocked || 'You unlocked free shipping 🎉';
      this.textAdding = this.dataset.textAdding || 'Adding…';
      this.upsellSource = this.dataset.upsellSource || 'collection';
      this.productsToShow = Number(this.dataset.productsToShow) || 3;
      this.sectionUpsell = this.dataset.sectionUpsell || SECTION_UPSELL;

      this.onAddClick = this.onAddClick.bind(this);
      this.onCartUpdate = this.onCartUpdate.bind(this);
      this.onLoadingMutation = this.onLoadingMutation.bind(this);

      this.addEventListener('click', this.onAddClick);

      if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        this.unsubscribeCart = subscribe(PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate);
      }

      this.observeCartLoading();

      if (this.upsellSource === 'recommendations' && !this.classList.contains('fspb--unlocked')) {
        this.loadRecommendations();
      }
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onAddClick);
      if (this.unsubscribeCart) this.unsubscribeCart();
      if (this.loadingObserver) this.loadingObserver.disconnect();
    }

    observeCartLoading() {
      const targets = [
        document.getElementById('CartDrawer-CartItems'),
        document.getElementById('main-cart-items'),
      ].filter(Boolean);

      if (!targets.length || typeof MutationObserver === 'undefined') return;

      this.loadingObserver = new MutationObserver(this.onLoadingMutation);
      targets.forEach((target) => {
        this.loadingObserver.observe(target, { attributes: true, attributeFilter: ['class'] });
      });
    }

    onLoadingMutation(mutations) {
      const isLoading = mutations.some((mutation) =>
        mutation.target.classList.contains('cart__items--disabled')
      );
      this.classList.toggle('fspb--loading', isLoading);
    }

    setLoading(isLoading) {
      this.classList.toggle('fspb--loading', Boolean(isLoading));
    }

    updateProgress(cartTotal, itemCount) {
      if (typeof cartTotal !== 'number' || Number.isNaN(cartTotal)) return;

      const threshold = this.threshold;
      const unlocked = threshold <= 0 || cartTotal >= threshold;
      const remaining = Math.max(0, threshold - cartTotal);
      const progress = threshold > 0 ? Math.min(100, (cartTotal / threshold) * 100) : 100;
      const isEmpty =
        typeof itemCount === 'number' ? itemCount === 0 : cartTotal <= 0;
      // Hide upsell for empty cart or when the free-shipping threshold is met.
      const showUpsell = !unlocked && !isEmpty;

      this.dataset.cartTotal = String(cartTotal);
      this.dataset.progress = String(progress);
      this.dataset.unlocked = String(unlocked);
      this.style.setProperty('--fspb-progress', `${progress}%`);
      this.classList.toggle('fspb--unlocked', unlocked);
      this.classList.toggle('fspb--empty-cart', isEmpty);

      if (this.trackEl) {
        this.trackEl.setAttribute('aria-valuenow', String(Math.round(progress)));
      }

      if (this.messageEl) {
        this.messageEl.textContent = unlocked
          ? this.textUnlocked
          : this.textProgress.replace('[amount]', formatMoney(remaining, this.moneyFormat));
      }

      if (this.upsellEl) {
        if (showUpsell) {
          this.upsellEl.hidden = false;
          this.upsellEl.classList.remove('fspb__upsell--hidden');
        } else {
          this.upsellEl.hidden = true;
          this.upsellEl.classList.add('fspb__upsell--hidden');
        }
      }
    }

    onCartUpdate(event) {
      const cartData = event && (event.cartData || event);
      const total = getCartTotal(cartData);
      const itemCount =
        cartData && typeof cartData.item_count === 'number'
          ? cartData.item_count
          : cartData && Array.isArray(cartData.items)
            ? cartData.items.length
            : undefined;
      if (total !== null) this.updateProgress(total, itemCount);
      this.setLoading(false);

      if (cartData && Array.isArray(cartData.items)) {
        const ids = new Set(
          cartData.items.map((item) => String(item.product_id || (item.product && item.product.id) || ''))
        );
        this.querySelectorAll('[data-fspb-item]').forEach((item) => {
          if (ids.has(String(item.dataset.productId))) item.remove();
        });

        const nextSeed =
          cartData.items[0] &&
          (cartData.items[0].product_id || (cartData.items[0].product && cartData.items[0].product.id));
        if (nextSeed) this.dataset.seedProductId = String(nextSeed);
      }

      if (this.upsellSource === 'recommendations' && this.dataset.unlocked !== 'true') {
        const seed = this.dataset.seedProductId;
        if (seed) this.loadRecommendations(seed);
      }
    }

    loadRecommendations(productId) {
      const seed = productId || this.dataset.seedProductId;
      if (!seed || !this.listEl || this.recsLoading) return;

      this.recsLoading = true;
      const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      const url = `${root}recommendations/products?product_id=${encodeURIComponent(seed)}&limit=${
        this.productsToShow
      }&section_id=${encodeURIComponent(this.sectionUpsell)}`;

      fetch(url)
        .then((response) => response.text())
        .then((text) => {
          const doc = new DOMParser().parseFromString(text, 'text/html');
          const sourceList = doc.querySelector('[data-fspb-upsell-section] .fspb__list');
          this.listEl.classList.remove('fspb__list--loading');
          if (sourceList && sourceList.children.length) {
            this.listEl.innerHTML = sourceList.innerHTML;
            const addLabel = this.dataset.textAdd;
            if (addLabel) {
              this.listEl.querySelectorAll('[data-fspb-add-label]').forEach((el) => {
                el.textContent = addLabel;
              });
            }
          } else {
            this.listEl.innerHTML = '';
          }
        })
        .catch(() => {
          if (this.listEl) this.listEl.classList.remove('fspb__list--loading');
        })
        .finally(() => {
          this.recsLoading = false;
        });
    }

    onAddClick(event) {
      const button = event.target.closest('[data-fspb-add]');
      if (!button || !this.contains(button) || button.disabled) return;
      event.preventDefault();
      this.addToCart(button);
    }

    getSectionsToRequest() {
      const sections = ['cart-drawer', 'cart-icon-bubble'];
      const pageSection = document.querySelector('.fspb-section-wrapper[id^="shopify-section-"]');
      if (pageSection) {
        sections.push(pageSection.id.replace(/^shopify-section-/, ''));
      }

      const mainCart = document.getElementById('main-cart-items');
      if (mainCart && mainCart.dataset.id) sections.push(mainCart.dataset.id);

      const footer = document.getElementById('main-cart-footer');
      if (footer && footer.dataset.id) sections.push(footer.dataset.id);

      return [...new Set(sections)];
    }

    addToCart(button) {
      const variantId = button.dataset.variantId;
      if (!variantId) return;

      const label = button.querySelector('[data-fspb-add-label]');
      const originalLabel = label ? label.textContent : '';

      button.classList.add('loading');
      button.setAttribute('aria-disabled', 'true');
      button.disabled = true;
      if (label) label.textContent = this.textAdding;
      this.setLoading(true);

      const routes = window.routes || {};
      const addUrl = routes.cart_add_url || '/cart/add.js';
      const body = JSON.stringify({
        id: Number(variantId),
        quantity: 1,
        sections: this.getSectionsToRequest(),
        sections_url: window.location.pathname,
      });

      fetch(addUrl, { ...fetchConfig('javascript'), body })
        .then((response) => response.json())
        .then((response) => {
          if (response.status) {
            throw new Error(response.description || response.message || 'Cart error');
          }

          const sectionsPayload = response;
          const cartUrl = (routes.cart_url || '/cart') + '.js';
          return fetch(cartUrl)
            .then((cartResponse) => cartResponse.json())
            .then((cart) => {
              if (cart && typeof cart.total_price === 'number') {
                this.updateProgress(cart.total_price, cart.item_count);
              }

              this.renderCartSections(sectionsPayload, cart);

              if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
                publish(PUB_SUB_EVENTS.cartUpdate, {
                  source: 'fspb-shipping-bar',
                  cartData: cart,
                  productVariantId: variantId,
                });
              }

              return cart;
            });
        })
        .catch(() => {})
        .finally(() => {
          if (!this.isConnected) return;
          button.classList.remove('loading');
          button.removeAttribute('aria-disabled');
          button.disabled = false;
          if (label) label.textContent = originalLabel;
          this.setLoading(false);
        });
    }

    renderCartSections(response, cart) {
      if (!response || !response.sections) return;

      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer && response.sections['cart-drawer']) {
        this.replaceSectionHtml('cart-drawer', response.sections['cart-drawer'], '#CartDrawer');
        if (cart && cart.item_count > 0) cartDrawer.classList.remove('is-empty');
        if (cart && cart.item_count === 0) cartDrawer.classList.add('is-empty');

        const overlay = cartDrawer.querySelector('#CartDrawer-Overlay');
        if (overlay && typeof cartDrawer.close === 'function') {
          overlay.addEventListener('click', cartDrawer.close.bind(cartDrawer));
        }
      }

      if (response.sections['cart-icon-bubble']) {
        this.replaceSectionHtml('cart-icon-bubble', response.sections['cart-icon-bubble']);
      }

      Object.keys(response.sections).forEach((sectionId) => {
        if (sectionId === 'cart-drawer' || sectionId === 'cart-icon-bubble') return;
        const el = document.getElementById(`shopify-section-${sectionId}`);
        if (!el) return;
        if (el.classList.contains('fspb-section-wrapper') || el.querySelector('fspb-shipping-bar')) {
          const doc = new DOMParser().parseFromString(response.sections[sectionId], 'text/html');
          const incoming = doc.querySelector(`#shopify-section-${sectionId}`) || doc.body;
          if (incoming) el.innerHTML = incoming.innerHTML;
        }
      });

      const mainCart = document.getElementById('main-cart-items');
      if (mainCart) {
        const sectionKey = mainCart.dataset.id;
        const html = (sectionKey && response.sections[sectionKey]) || response.sections['main-cart-items'];
        if (html) {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const source = doc.querySelector('.js-contents') || doc.querySelector('cart-items');
          const target = mainCart.querySelector('.js-contents') || mainCart;
          if (source && target) target.innerHTML = source.innerHTML;
        }
      }
    }

    replaceSectionHtml(sectionId, html, selector) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (selector) {
        const source = doc.querySelector(selector);
        const target = document.querySelector(selector);
        if (source && target) {
          target.innerHTML = source.innerHTML;
          return;
        }
      }
      const sectionEl = document.getElementById(`shopify-section-${sectionId}`);
      const incoming = doc.querySelector(`#shopify-section-${sectionId}`) || doc.body;
      if (sectionEl && incoming) sectionEl.innerHTML = incoming.innerHTML;
    }
  }

  if (!customElements.get('fspb-shipping-bar')) {
    customElements.define('fspb-shipping-bar', FspbShippingBar);
  }
})();
