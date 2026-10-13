(function () {
  function getTabs(root) {
    return Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  }

  function getPanelByTabId(root, id) {
    try {
      return root.querySelector(
        '[role="tabpanel"][data-tab-id="' +
          (window.CSS && CSS.escape ? CSS.escape(id) : id) +
          '"]'
      );
    } catch (e) {
      return null;
    }
  }

  function getTabIdByAnchor(root, anchor) {
    if (!anchor) return null;
    var id = String(anchor).replace(/^#/, '');
    if (!id) return null;

    var panel = null;
    try {
      panel = root.querySelector('[role="tabpanel"]#' + (window.CSS && CSS.escape ? CSS.escape(id) : id));
    } catch (e) {
      panel = null;
    }
    if (!panel) {
      try {
        panel = root.querySelector(
          '[role="tabpanel"][data-anchor="' +
            (window.CSS && CSS.escape ? CSS.escape(id) : id) +
            '"]'
        );
      } catch (e) {
        panel = null;
      }
    }
    return panel ? panel.getAttribute('data-tab-id') : null;
  }

  function setHashForTab(root, id) {
    var panel = getPanelByTabId(root, id);
    var anchor = panel && (panel.getAttribute('data-anchor') || panel.id);
    if (!anchor) return;
    if (window.location.hash === '#' + anchor) return;
    if (history.replaceState) {
      history.replaceState(null, '', '#' + anchor);
    } else {
      window.location.hash = anchor;
    }
  }

  function setActive(root, id, options) {
    var scroll = options && options.scroll;
    var focus = options && options.focus;
    var updateHash = options && options.hash;
    var tabs = getTabs(root);
    var panels = root.querySelectorAll('[role="tabpanel"]');
    var i;
    var activeTab = null;

    for (i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      var on = tab.getAttribute('data-tab-id') === id;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      if (on) activeTab = tab;
    }

    for (i = 0; i < panels.length; i++) {
      var panel = panels[i];
      panel.hidden = panel.getAttribute('data-tab-id') !== id;
    }

    root.setAttribute('data-active-tab', id);

    if (updateHash) {
      setHashForTab(root, id);
    }

    if (activeTab) {
      if (scroll) {
        activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      }
      if (focus) {
        activeTab.focus();
      }
    }
  }

  function activateTabByIndex(root, tabs, index, options) {
    var nextIndex = (index + tabs.length) % tabs.length;
    var id = tabs[nextIndex].getAttribute('data-tab-id');
    if (!id) return;
    setActive(root, id, options);
  }

  function initGuideTabs(root) {
    if (!root || root.getAttribute('data-guide-tabs-ready') === 'true') return;

    var tabs = getTabs(root);
    if (!tabs.length) return;

    var tablist = root.querySelector('[role="tablist"]');
    root.setAttribute('data-guide-tabs-ready', 'true');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function (event) {
        var id = event.currentTarget.getAttribute('data-tab-id');
        if (!id) return;
        setActive(root, id, { scroll: true, hash: true });
      });
    });

    if (tablist) {
      tablist.addEventListener('keydown', function (event) {
        var currentTabs = getTabs(root);
        if (!currentTabs.length) return;

        var currentIndex = currentTabs.indexOf(document.activeElement);
        if (currentIndex === -1) return;

        var key = event.key;
        var nextIndex = null;

        if (key === 'ArrowRight') {
          nextIndex = currentIndex + 1;
        } else if (key === 'ArrowLeft') {
          nextIndex = currentIndex - 1;
        } else if (key === 'Home') {
          nextIndex = 0;
        } else if (key === 'End') {
          nextIndex = currentTabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        activateTabByIndex(root, currentTabs, nextIndex, { scroll: true, focus: true, hash: true });
      });
    }

    var hashTabId = getTabIdByAnchor(root, window.location.hash);
    var initial =
      hashTabId ||
      root.getAttribute('data-active-tab') ||
      tabs[0].getAttribute('data-tab-id');
    if (initial) setActive(root, initial, { scroll: !!hashTabId, hash: false });
  }

  function initAll(scope) {
    var roots = (scope || document).querySelectorAll('[data-guide-tabs]');
    for (var i = 0; i < roots.length; i++) {
      initGuideTabs(roots[i]);
    }
  }

  function syncFromHash() {
    var roots = document.querySelectorAll('[data-guide-tabs]');
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      var id = getTabIdByAnchor(root, window.location.hash);
      if (id) setActive(root, id, { scroll: true, hash: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll();
    });
  } else {
    initAll();
  }

  window.addEventListener('hashchange', syncFromHash);

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
