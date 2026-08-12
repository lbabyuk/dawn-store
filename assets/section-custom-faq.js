
if (!customElements.get('custom-faq')) {
  customElements.define(
    'custom-faq',
    class CustomFAQ extends HTMLElement {
      constructor() {
        super();
        this.autoCloseOthers = this.dataset.autoClose === 'true';
      }

      connectedCallback() {
        this.items = this.querySelectorAll('.custom-faq__item');
        this.initAccordion();
      }

      initAccordion() {
        this.items.forEach((item) => {
          const trigger = item.querySelector('.custom-faq__trigger');
          const content = item.querySelector('.custom-faq__content');

          if (!trigger || !content) return;

          trigger.addEventListener('click', () => {
            const isOpen = item.classList.contains('is-open');

            if (this.autoCloseOthers) {
              this.closeAllExcept(item);
            }

            this.toggleItem(item, trigger, content, !isOpen);
          });
        });
      }

      toggleItem(item, trigger, content, open) {
        if (open) {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
          content.hidden = false;
        } else {
          item.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          content.hidden = true;
        }
      }

      closeAllExcept(currentItem) {
        this.items.forEach((item) => {
          if (item !== currentItem) {
            const trigger = item.querySelector('.custom-faq__trigger');
            const content = item.querySelector('.custom-faq__content');
            if (trigger && content) {
              this.toggleItem(item, trigger, content, false);
            }
          }
        });
      }
    }
  );
}