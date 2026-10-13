/**
 * Relocate Callout accordion into article body + animate open/close.
 * Insert after Nth .OutlineElement / meaningful <p>
 * (N from data-callout-insert-after on the callout source, 1-based).
 */
(function () {
  var ANIM_MS = 250;
  var DEFAULT_AFTER = 2;

  function getRichtext(root) {
    if (!root) return null;
    return root.querySelector('._input-richtext') || root.querySelector('.rte') || root;
  }

  function parseInsertAfter(callout) {
    var raw = callout && callout.getAttribute('data-callout-insert-after');
    var n = parseInt(raw, 10);
    if (!n || n < 1) return DEFAULT_AFTER;
    return n;
  }

  function findInsertAnchor(richtext, afterN) {
    if (!richtext) return null;
    var index = Math.max(1, afterN || DEFAULT_AFTER) - 1;

    var firstDiv = null;
    for (var i = 0; i < richtext.children.length; i++) {
      if (richtext.children[i].tagName === 'DIV') {
        firstDiv = richtext.children[i];
        break;
      }
    }

    if (firstDiv) {
      var outlines = [];
      for (var j = 0; j < firstDiv.children.length; j++) {
        var child = firstDiv.children[j];
        if (
          child.classList &&
          (child.classList.contains('OutlineElement') ||
            (child.className && String(child.className).indexOf('OutlineElement') !== -1))
        ) {
          outlines.push(child);
        }
      }

      if (outlines.length > index) {
        return { parent: firstDiv, after: outlines[index] };
      }

      var deepOutlines = firstDiv.querySelectorAll('.OutlineElement');
      if (deepOutlines.length > index) {
        var target = deepOutlines[index];
        return { parent: target.parentNode, after: target };
      }
    }

    var paragraphs = richtext.querySelectorAll('p');
    var meaningfulPs = [];
    for (var p = 0; p < paragraphs.length; p++) {
      var text = (paragraphs[p].textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) meaningfulPs.push(paragraphs[p]);
    }
    if (meaningfulPs.length > index) {
      var targetP = meaningfulPs[index];
      return { parent: targetP.parentNode, after: targetP };
    }

    return null;
  }

  function placeCallout(callout, anchor) {
    if (!callout || !anchor || !anchor.parent || !anchor.after) return false;
    if (anchor.after.nextSibling) {
      anchor.parent.insertBefore(callout, anchor.after.nextSibling);
    } else {
      anchor.parent.appendChild(callout);
    }
    callout.setAttribute('data-callout-acc-placed', '1');
    return true;
  }

  function ensurePanelInner(panel) {
    if (!panel) return null;
    var first = panel.firstElementChild;
    if (first && first.classList.contains('article-guide__callout-acc-panel-inner')) {
      return first;
    }
    var inner = document.createElement('div');
    inner.className = 'article-guide__callout-acc-panel-inner';
    while (panel.firstChild) {
      inner.appendChild(panel.firstChild);
    }
    panel.appendChild(inner);
    return inner;
  }

  function panelHeight(panel) {
    var inner = ensurePanelInner(panel);
    return inner ? inner.scrollHeight : panel.scrollHeight;
  }

  function clearAnimState(panel) {
    panel.classList.remove('is-animating');
    panel.style.height = '';
    panel.style.opacity = '';
  }

  function enhanceAccordion(details) {
    if (!details || details.getAttribute('data-callout-acc-anim') === '1') return;
    details.setAttribute('data-callout-acc-anim', '1');

    var summary = details.querySelector('.article-guide__callout-acc-summary');
    var panel = details.querySelector('.article-guide__callout-acc-panel');
    if (!summary || !panel) return;

    ensurePanelInner(panel);
    var animating = false;

    if (details.open) {
      details.classList.add('is-expanded');
      panel.style.height = 'auto';
      panel.style.opacity = '1';
    }

    summary.addEventListener('click', function (event) {
      event.preventDefault();
      if (animating) return;

      var isOpen = details.open || details.classList.contains('is-expanded');

      if (isOpen) {
        animating = true;
        panel.classList.add('is-animating');
        panel.style.height = panelHeight(panel) + 'px';
        panel.style.opacity = '1';
        void panel.offsetHeight;

        details.classList.remove('is-expanded');
        panel.style.height = '0px';
        panel.style.opacity = '0';

        window.setTimeout(function () {
          details.open = false;
          clearAnimState(panel);
          animating = false;
        }, ANIM_MS);
      } else {
        animating = true;
        details.open = true;
        details.classList.add('is-expanded');
        panel.classList.add('is-animating');

        panel.style.height = '0px';
        panel.style.opacity = '0';
        void panel.offsetHeight;

        var target = panelHeight(panel);
        panel.style.height = target + 'px';
        panel.style.opacity = '1';

        window.setTimeout(function () {
          panel.style.height = 'auto';
          panel.classList.remove('is-animating');
          animating = false;
        }, ANIM_MS);
      }
    });
  }

  function initAll(scope) {
    var scopeRoot = scope || document;
    var callouts = scopeRoot.querySelectorAll(
      '.section-article-guide [data-callout-acc-source]:not([data-callout-acc-placed])'
    );

    var bodies = scopeRoot.querySelectorAll(
      '.section-article-guide [data-callout-insert-root], .section-article-guide .article-guide__body'
    );

    Array.prototype.forEach.call(callouts, function (callout) {
      var afterN = parseInsertAfter(callout);
      for (var b = 0; b < bodies.length; b++) {
        var richtext = getRichtext(bodies[b]);
        var anchor = findInsertAnchor(richtext, afterN);
        if (anchor && placeCallout(callout, anchor)) break;
      }
    });

    var detailsList = scopeRoot.querySelectorAll('.section-article-guide .article-guide__callout-acc');
    Array.prototype.forEach.call(detailsList, enhanceAccordion);
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
