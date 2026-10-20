/**
 * Free Tracker lead-magnet:
 * - Section form → success popup
 * - Same form as timed popup after N seconds on page
 * - Modal form submit → success popup
 */
(function () {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var KLAVIYO_REVISION = '2026-07-15';

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  function setMessage(el, text, type) {
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'free-tracker__message';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'free-tracker__message free-tracker__message--' + (type || 'error');
  }

  function fillTemplate(template, email) {
    if (!template) return '';
    return template.replace(/\{\{\s*email\s*\}\}/gi, email).replace(/\[email\]/gi, email);
  }

  function storageGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

  function subscribeKlaviyo(email, config) {
    var companyId = config.companyId;
    var listId = config.listId;
    var tag = config.tag;
    var source = config.source;

    if (!companyId || !listId) {
      return Promise.reject(new Error('missing-klaviyo-config'));
    }

    var properties = {};
    if (tag) {
      properties.tracker_tag = tag;
      properties.$source = source || tag;
    }

    var payload = {
      data: {
        type: 'subscription',
        attributes: {
          custom_source: source || 'Free Tracker',
          profile: {
            data: {
              type: 'profile',
              attributes: {
                email: email,
                properties: properties
              }
            }
          }
        },
        relationships: {
          list: {
            data: {
              type: 'list',
              id: listId
            }
          }
        }
      }
    };

    return fetch(
      'https://a.klaviyo.com/client/subscriptions/?company_id=' + encodeURIComponent(companyId),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          revision: KLAVIYO_REVISION
        },
        body: JSON.stringify(payload)
      }
    ).then(function (res) {
      if (res.status >= 200 && res.status < 300) return true;
      return res.text().then(function (body) {
        var err = new Error('klaviyo-' + res.status);
        err.body = body;
        throw err;
      });
    });
  }

  function initTracker(root) {
    if (!root || root.dataset.ftReady === '1') return;
    root.dataset.ftReady = '1';

    var trackerId = root.getAttribute('data-ft-id') || 'ft';
    var storageCompleted = 'ft-completed-' + trackerId;
    var storageDismissed = 'ft-timed-dismissed-' + trackerId;

    var modal = qs(root, '[data-ft-modal]');
    var dialog = qs(root, '[data-ft-dialog]');
    var stepForm = qs(root, '[data-ft-step="form"]');
    var stepSuccess = qs(root, '[data-ft-step="success"]');
    var successCopy = qs(root, '[data-ft-success-copy]');
    var downloadBtn = qs(root, '[data-ft-download]');
    var sectionForm = qs(root, '.free-tracker__panel [data-ft-form]');
    var modalForm = qs(root, '[data-ft-modal-form]');
    var submitting = false;
    var lastFocus = null;
    var completed = storageGet(storageCompleted) === '1';
    var timedDismissed = storageGet(storageDismissed) === '1';
    var timedTimer = null;
    var currentStep = 'form';

    var config = {
      companyId: (root.getAttribute('data-company-id') || '').trim(),
      listId: (root.getAttribute('data-list-id') || '').trim(),
      tag: (root.getAttribute('data-tag') || '').trim(),
      source: (root.getAttribute('data-source') || '').trim(),
      pdfUrl: (root.getAttribute('data-pdf-url') || '').trim(),
      designMode: root.getAttribute('data-design-mode') === 'true',
      popupDelay: parseInt(root.getAttribute('data-popup-delay') || '5', 10) || 0,
      errorText: root.getAttribute('data-error-text') || 'Something went wrong. Please try again.',
      invalidText: root.getAttribute('data-invalid-text') || 'Please enter a valid email address.',
      loadingText: root.getAttribute('data-loading-text') || 'Sending…',
      successTemplate:
        root.getAttribute('data-success-text-template') ||
        "We've also sent a copy to [email] so you've always got it handy.",
      missingConfigText:
        'Add Klaviyo Company ID and List ID in the Free tracker block settings.'
    };

    function getFormControls(form) {
      return {
        form: form,
        emailInput: form ? qs(form, '[data-ft-email]') : null,
        submitBtn: form ? qs(form, '[data-ft-submit]') : null,
        submitLabel: form ? qs(form, '[data-ft-submit-label]') : null,
        messageEl: form
          ? qs(form.parentElement, '[data-ft-message]') || qs(form, '[data-ft-message]')
          : null,
        defaultLabel: form && qs(form, '[data-ft-submit-label]')
          ? qs(form, '[data-ft-submit-label]').textContent
          : ''
      };
    }

    function setLoading(controls, isLoading) {
      submitting = isLoading;
      if (controls.submitBtn) {
        controls.submitBtn.disabled = isLoading;
        controls.submitBtn.classList.toggle('is-loading', isLoading);
      }
      if (controls.submitLabel) {
        controls.submitLabel.textContent = isLoading
          ? config.loadingText
          : controls.defaultLabel;
      }
      if (controls.emailInput) controls.emailInput.readOnly = isLoading;
    }

    function showStep(step) {
      currentStep = step;
      if (stepForm) stepForm.hidden = step !== 'form';
      if (stepSuccess) stepSuccess.hidden = step !== 'success';
      if (dialog) {
        var labelId =
          step === 'success'
            ? (qs(stepSuccess, 'h2') && qs(stepSuccess, 'h2').id) || ''
            : (qs(stepForm, 'h2') && qs(stepForm, 'h2').id) || '';
        if (labelId) dialog.setAttribute('aria-labelledby', labelId);
      }
    }

    function openModal(step, email) {
      if (!modal) return;
      lastFocus = document.activeElement;

      if (step === 'form' && modalForm) {
        var modalEmail = qs(modalForm, '[data-ft-email]');
        if (modalEmail && email) modalEmail.value = email;
      }

      if (step === 'success') {
        completed = true;
        storageSet(storageCompleted, '1');
        if (timedTimer) {
          clearTimeout(timedTimer);
          timedTimer = null;
        }
        if (successCopy) {
          successCopy.textContent = fillTemplate(
            config.successTemplate,
            email || 'parent@example.com'
          );
        }
        if (downloadBtn && config.pdfUrl) {
          downloadBtn.setAttribute('href', config.pdfUrl);
          downloadBtn.removeAttribute('disabled');
        }
      }

      showStep(step || 'form');
      modal.hidden = false;
      document.documentElement.classList.add('free-tracker-modal-open');
      document.body.classList.add('free-tracker-modal-open');

      if (step === 'form' && modalForm) {
        var input = qs(modalForm, '[data-ft-email]');
        if (input) input.focus();
      } else {
        var closeBtn = qs(modal, '[data-ft-close]');
        if (closeBtn) closeBtn.focus();
      }
    }

    function closeModal() {
      if (!modal || modal.hidden) return;
      if (currentStep === 'form' && !completed) {
        timedDismissed = true;
        storageSet(storageDismissed, '1');
      }
      modal.hidden = true;
      document.documentElement.classList.remove('free-tracker-modal-open');
      document.body.classList.remove('free-tracker-modal-open');
      showStep('form');
      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }

    function scheduleTimedPopup() {
      if (config.popupDelay <= 0 || completed || timedDismissed || !modal) return;
      if (timedTimer) clearTimeout(timedTimer);
      timedTimer = setTimeout(function () {
        timedTimer = null;
        if (completed || timedDismissed) return;
        if (modal && !modal.hidden) return;
        openModal('form');
      }, config.popupDelay * 1000);
    }

    root.querySelectorAll('[data-ft-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal && !modal.hidden) {
        closeModal();
      }
    });

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function (event) {
        if (!config.pdfUrl) {
          event.preventDefault();
          return;
        }
        if (downloadBtn.tagName === 'A') {
          downloadBtn.setAttribute('href', config.pdfUrl);
        } else {
          event.preventDefault();
          window.open(config.pdfUrl, '_blank', 'noopener');
        }
      });
    }

    function handleFormSubmit(event) {
      event.preventDefault();
      if (submitting) return;

      var form = event.currentTarget;
      var controls = getFormControls(form);

      setMessage(controls.messageEl, '', '');
      if (controls.emailInput) {
        controls.emailInput.classList.remove('is-invalid');
        controls.emailInput.removeAttribute('aria-invalid');
      }

      var email = (
        controls.emailInput && controls.emailInput.value
          ? controls.emailInput.value
          : ''
      ).trim();

      if (!EMAIL_RE.test(email)) {
        if (controls.emailInput) {
          controls.emailInput.classList.add('is-invalid');
          controls.emailInput.setAttribute('aria-invalid', 'true');
          controls.emailInput.focus();
        }
        setMessage(controls.messageEl, config.invalidText, 'error');
        return;
      }

      setLoading(controls, true);

      var subscribePromise;
      if (!config.companyId || !config.listId) {
        if (config.designMode) {
          subscribePromise = Promise.resolve(true);
        } else {
          subscribePromise = Promise.reject(new Error('missing-klaviyo-config'));
        }
      } else {
        subscribePromise = subscribeKlaviyo(email, config);
      }

      subscribePromise
        .then(function () {
          openModal('success', email);
          form.reset();
          setMessage(controls.messageEl, '', '');
          if (controls.emailInput) {
            controls.emailInput.classList.remove('is-invalid');
            controls.emailInput.removeAttribute('aria-invalid');
          }
        })
        .catch(function (err) {
          var msg =
            err && err.message === 'missing-klaviyo-config'
              ? config.missingConfigText
              : config.errorText;
          if (controls.emailInput) {
            controls.emailInput.setAttribute('aria-invalid', 'true');
          }
          setMessage(controls.messageEl, msg, 'error');
        })
        .finally(function () {
          setLoading(controls, false);
        });
    }

    if (sectionForm) {
      sectionForm.addEventListener('submit', handleFormSubmit);
    }
    if (modalForm) {
      modalForm.addEventListener('submit', handleFormSubmit);
    }

    scheduleTimedPopup();
  }

  function initAll(scope) {
    (scope || document).querySelectorAll('[data-free-tracker]').forEach(initTracker);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
