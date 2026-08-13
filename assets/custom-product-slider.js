if (!customElements.get('custom-product-slider')) {
  customElements.define('custom-product-slider', class CustomProductSlider extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.custom-slider-track');
      this.prevBtn = this.querySelector('.slider-arrow--prev');
      this.nextBtn = this.querySelector('.slider-arrow--next');

      const desktopSlides = this.track.dataset.slidesDesktop;
      const mobileSlides = this.track.dataset.slidesMobile;

      this.style.setProperty('--slides-desktop', desktopSlides);
      this.style.setProperty('--slides-mobile', mobileSlides);

      if (this.prevBtn && this.nextBtn) {
        this.prevBtn.addEventListener('click', () => this.scroll('left'));
        this.nextBtn.addEventListener('click', () => this.scroll('right'));
      }

      this.initQuickViewModal();
      this.initActions();
    }

    initQuickViewModal() {
      const modal = document.getElementById('QuickView-Modal');
      if (!modal || modal.dataset.qvInit) return;

      modal.dataset.qvInit = 'true';

      modal.addEventListener('close', () => {
        const target = document.getElementById('QuickView-Target');
        const modalContent = modal.querySelector('.quick-view-modal__content');

        if (target) target.innerHTML = '';

        if (modalContent) {
          [...modalContent.classList].forEach((className) => {
            if (className.startsWith('color-') || className === 'gradient') {
              modalContent.classList.remove(className);
            }
          });
        }
      });

      if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
          if (event.source !== 'product-form') return;
          if (!modal.open && !modal.hasAttribute('open')) return;
          if (!modal.querySelector('product-form')) return;

          if (typeof modal.close === 'function') {
            modal.close();
          } else {
            modal.removeAttribute('open');
          }
        });
      }
    }

    scroll(direction) {
      const slideWidth = this.track.querySelector('.custom-slider-slide').offsetWidth;
      const scrollAmount = direction === 'left' ? -slideWidth : slideWidth;
      this.track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }

    initActions() {
      this.querySelectorAll('.js-quick-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const handle = e.currentTarget.dataset.productHandle;
          this.openQuickView(handle);
        });
      });

      this.querySelectorAll('.js-add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const variantId = e.currentTarget.dataset.variantId;
          this.addToCart(variantId, e.currentTarget);
        });
      });
    }

    async openQuickView(handle) {
      const modal = document.getElementById('QuickView-Modal');
      const target = document.getElementById('QuickView-Target');
      const modalContent = modal.querySelector('.quick-view-modal__content');

      target.innerHTML = '<div class="qv-loading">Loading product...</div>';

      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }

      try {
        const root = window.Shopify?.routes?.root || '/';
        const productUrl = `${root}products/${handle}`;
        const response = await fetch(productUrl);

        if (!response.ok) throw new Error('Product fetch failed');

        const responseHTML = new DOMParser().parseFromString(await response.text(), 'text/html');
        const productElement = responseHTML.querySelector('product-info');

        if (!productElement) throw new Error('Product info not found');

        this.preprocessQuickViewProduct(productElement, modalContent);
        HTMLUpdateUtility.setInnerHTML(target, productElement.outerHTML);

        if (window.Shopify?.PaymentButton) {
          window.Shopify.PaymentButton.init();
        }

        if (window.ProductModel) {
          window.ProductModel.loadShopifyXR();
        }

        target.addEventListener('product-info:loaded', ({ target: productInfo }) => {
          productInfo.addPreProcessCallback((html) => {
            const nextProductElement = html.querySelector('product-info');
            if (nextProductElement) {
              this.preprocessQuickViewProduct(nextProductElement, modalContent);
            }
          });
        }, { once: true });
      } catch (err) {
        console.error(err);
        target.innerHTML = '<p class="qv-error">Unable to load product content. Please try refreshing.</p>';
      }
    }

    preprocessQuickViewProduct(productElement, modalContent) {
      productElement.classList.forEach((classApplied) => {
        if (classApplied.startsWith('color-') || classApplied === 'gradient') {
          modalContent.classList.add(classApplied);
        }
      });

      productElement.setAttribute('data-update-url', 'false');

      const sectionId = productElement.dataset.section;
      if (sectionId) {
        const newId = `quickview-${sectionId}`;
        productElement.innerHTML = productElement.innerHTML.replaceAll(sectionId, newId);

        Array.from(productElement.attributes).forEach((attribute) => {
          if (attribute.value.includes(sectionId)) {
            productElement.setAttribute(attribute.name, attribute.value.replace(sectionId, newId));
          }
        });

        productElement.dataset.originalSection = sectionId;
      }

      const pickupAvailability = productElement.querySelector('pickup-availability');
      if (pickupAvailability) pickupAvailability.remove();

      const productModal = productElement.querySelector('product-modal');
      if (productModal) productModal.remove();

      productElement.querySelectorAll('modal-dialog').forEach((dialog) => dialog.remove());

      const galleryList = productElement.querySelector('[id^="Slider-Gallery"]');
      if (galleryList) {
        galleryList.setAttribute('role', 'presentation');
        galleryList.querySelectorAll('[id^="Slide-"]').forEach((slide) => slide.setAttribute('role', 'presentation'));
      }

      const product = productElement.querySelector('.product');
      const desktopColumns = product?.classList.contains('product--columns');

      if (desktopColumns) {
        const mediaImages = product.querySelectorAll('.product__media img');

        if (mediaImages.length) {
          let mediaImageSizes =
            '(min-width: 1000px) 715px, (min-width: 750px) calc((100vw - 11.5rem) / 2), calc(100vw - 4rem)';

          if (product.classList.contains('product--medium')) {
            mediaImageSizes = mediaImageSizes.replace('715px', '605px');
          } else if (product.classList.contains('product--small')) {
            mediaImageSizes = mediaImageSizes.replace('715px', '495px');
          }

          mediaImages.forEach((img) => img.setAttribute('sizes', mediaImageSizes));
        }
      }
    }

    async addToCart(variantId, button) {
      if (button.disabled) return;
      button.disabled = true;

      const originalText = button.getAttribute('data-tooltip');
      button.setAttribute('data-tooltip', 'Adding...');

      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', 1);
      formData.append('sections', 'cart-drawer,cart-icon-bubble');

      try {
        const res = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const parsedResponse = await res.json();
          button.setAttribute('data-tooltip', 'Added!');
          this.updateDawnCart(parsedResponse);
        } else {
          throw new Error('Add to cart failed');
        }
      } catch (e) {
        button.setAttribute('data-tooltip', 'Error');
      } finally {
        setTimeout(() => {
          button.setAttribute('data-tooltip', originalText);
          button.disabled = false;
        }, 1500);
      }
    }

    updateDawnCart(response) {
      if (window.pubsub) {
        window.pubsub.publish('cart-update', {
          source: 'custom-slider',
          cartData: response
        });
      }

      if (response.sections && response.sections['cart-icon-bubble']) {
        const cartIconTarget = document.getElementById('cart-icon-bubble');
        if (cartIconTarget) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(response.sections['cart-icon-bubble'], 'text/html');
          cartIconTarget.innerHTML = doc.body.innerHTML;
        }
      }

      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) {
        if (response.sections && response.sections['cart-drawer']) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(response.sections['cart-drawer'], 'text/html');
          const drawerInner = cartDrawer.querySelector('.drawer__inner') || cartDrawer;
          const newDrawerInner = doc.querySelector('.drawer__inner') || doc.body;
          drawerInner.innerHTML = newDrawerInner.innerHTML;
        }
        cartDrawer.open();
      }
    }
  });
}
