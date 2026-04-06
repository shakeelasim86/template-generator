(function () {
  var form = document.getElementById('form');
  var status = document.getElementById('status');
  var grid = document.getElementById('grid');
  var submitBtn = document.getElementById('submitBtn');
  var nicheInput = document.getElementById('niche');
  var categoryInput = document.getElementById('category');
  var countSelect = document.getElementById('count');
  var platformSelect = document.getElementById('platform');
  var brandNameInput = document.getElementById('brandName');
  var visualStyleInput = document.getElementById('visualStyle');

  var examplesGrid = document.getElementById('examplesGrid');
  var toggleExamplesBtn = document.getElementById('toggleExamplesBtn');
  var examplesExpanded = false;

  var EXAMPLES = [
    { category: 'Food & Beverage', niche: 'Coffee Shop', notes: 'Editorial cafe promo, minimal copy, premium tone' },
    { category: 'Food & Beverage', niche: 'Pizza Promotion', notes: 'Bold product-forward layout, strong headline hierarchy' },
    { category: 'Health & Wellness', niche: 'Yoga Studio', notes: 'Calm typography, airy spacing, lifestyle imagery' },
    { category: 'Beauty', niche: 'Skincare Brand', notes: 'Clean luxury aesthetic, ingredient-led messaging' },
    { category: 'Fashion', niche: 'Streetwear Drop', notes: 'High-contrast type, modern grid, punchy product name' },
    { category: 'Real Estate', niche: 'Modern Apartment Listing', notes: 'Simple structure, clear info density, elegant layout' },
    { category: 'Education', niche: 'Online Course Launch', notes: 'Headline + supporting line, professional tone' },
    { category: 'Travel & Hospitality', niche: 'Boutique Hotel', notes: 'Premium vibe, minimal copy, rich imagery' },
    { category: 'Tech', niche: 'SaaS Product Update', notes: 'Clear hierarchy, concise benefits, modern feel' },
    { category: 'Finance', niche: 'Personal Budgeting', notes: 'Trustworthy tone, clean spacing, legible typography' },
    { category: 'E-commerce', niche: 'Home Decor Store', notes: 'Warm visuals, lifestyle positioning, soft shapes' },
    { category: 'Fitness', niche: 'Gym Membership Promo', notes: 'Strong headline, balanced layout, high energy' },
    { category: 'Automotive', niche: 'Car Detailing Service', notes: 'Product shine imagery, premium service tone' },
    { category: 'Events', niche: 'Live Music Night', notes: 'Nightlife vibe, bold type, poster-style composition' },
    { category: 'Food & Beverage', niche: 'Bakery & Pastries', notes: 'Cozy photography, crafted copy, subtle overlays' },
    { category: 'Photography', niche: 'Portrait Studio', notes: 'Elegant text blocks, neutral palette, modern layout' },
  ];

  function renderExamples() {
    if (!examplesGrid) return;
    examplesGrid.innerHTML = '';
    var max = examplesExpanded ? EXAMPLES.length : 6;
    EXAMPLES.slice(0, max).forEach(function (ex) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'example-chip';
      chip.setAttribute('aria-label', ex.category + ' example: ' + ex.niche);

      var cat = document.createElement('div');
      cat.className = 'example-cat';
      cat.textContent = ex.category;

      var niche = document.createElement('div');
      niche.className = 'example-niche';
      niche.textContent = ex.niche;

      var notes = document.createElement('div');
      notes.className = 'example-notes';
      notes.textContent = ex.notes;

      chip.appendChild(cat);
      chip.appendChild(niche);
      chip.appendChild(notes);

      chip.addEventListener('click', function () {
        if (categoryInput) categoryInput.value = ex.category;
        if (nicheInput) nicheInput.value = ex.niche;
        if (countSelect && !countSelect.value) countSelect.value = '2';
        setStatus('Example selected: ' + ex.niche + ' · Click Generate to see results.');
        if (nicheInput && nicheInput.focus) nicheInput.focus();
      });

      examplesGrid.appendChild(chip);
    });

    if (toggleExamplesBtn) {
      toggleExamplesBtn.textContent = examplesExpanded ? 'Show Fewer Examples' : 'Show More Examples';
    }
  }

  var tester = document.getElementById('tester');
  var openTesterBtn = document.getElementById('openTesterBtn');
  var closeTesterBtn = document.getElementById('closeTesterBtn');
  var renderTesterBtn = document.getElementById('renderTesterBtn');
  var copyTesterBtn = document.getElementById('copyTesterBtn');
  var testerJson = document.getElementById('testerJson');
  var testerPreview = document.getElementById('testerPreview');
  var testerStatus = document.getElementById('testerStatus');

  var jsonModal = document.getElementById('jsonModal');
  var jsonModalTitle = document.getElementById('jsonModalTitle');
  var jsonModalPre = document.getElementById('jsonModalPre');
  var closeJsonBtn = document.getElementById('closeJsonBtn');
  var copyJsonBtn = document.getElementById('copyJsonBtn');

  var devPostModal = document.getElementById('devPostModal');
  var devPostRequestPre = document.getElementById('devPostRequestPre');
  var devPostBodyPre = document.getElementById('devPostBodyPre');
  var devPostResponseSection = document.getElementById('devPostResponseSection');
  var devPostResponsePre = document.getElementById('devPostResponsePre');
  var devPostSendBtn = document.getElementById('devPostSendBtn');
  var devPostProgress = document.getElementById('devPostProgress');
  var devPostHint = document.getElementById('devPostHint');
  var devPostHeaderCloseBtn = document.getElementById('devPostHeaderCloseBtn');
  var devPostDoneCloseBtn = document.getElementById('devPostDoneCloseBtn');
  var devPostTokenInput = document.getElementById('devPostTokenInput');

  var pendingDevPostTemplate = null;
  var activeJsonText = '';
  var originalSubmitText = submitBtn ? submitBtn.textContent : 'Generate';

  function setStatus(msg, isError) {
    status.textContent = msg;
    status.className = 'status' + (isError ? ' error' : '');
  }

  function setGenerating(isGenerating, count) {
    if (!submitBtn) return;
    submitBtn.disabled = isGenerating;
    if (isGenerating) {
      submitBtn.classList.add('btn-loading');
      submitBtn.textContent = 'Generating';
      if (typeof count === 'number') setStatus('Generating ' + count + ' template(s)…');
    } else {
      submitBtn.classList.remove('btn-loading');
      submitBtn.textContent = originalSubmitText || 'Generate';
    }
  }

  function clearGrid() {
    grid.innerHTML = '';
  }

  function getPlatformCanvas(platform) {
    if (platform === 'facebook_post') return { w: 1200, h: 630 };
    if (platform === 'pinterest_post') return { w: 1000, h: 1500 };
    return { w: 1080, h: 1350 };
  }

  function renderPlaceholders(count, platform) {
    clearGrid();
    var safeCount = Math.max(1, Math.min(30, Number(count) || 1));
    var c = getPlatformCanvas(platform);
    for (var i = 0; i < safeCount; i++) {
      var card = document.createElement('div');
      card.className = 'card placeholder';
      card.setAttribute('data-idx', String(i + 1));

      var wrap = document.createElement('div');
      wrap.className = 'preview-wrap';
      wrap.style.paddingBottom = ((c.h / c.w) * 100).toFixed(4) + '%';
      var sk = document.createElement('div');
      sk.className = 'skeleton';
      wrap.appendChild(sk);

      var preview = document.createElement('div');
      preview.className = 'preview';
      wrap.appendChild(preview);

      var title = document.createElement('div');
      title.className = 'card-title';
      title.innerHTML = '<div class=\"skeleton-line long\"></div>';

      var meta = document.createElement('div');
      meta.className = 'card-meta';
      meta.innerHTML = '<div class=\"skeleton-line short\"></div>';

      var badges = document.createElement('div');
      badges.className = 'card-badges';
      badges.innerHTML = '<span class=\"badge\">Generating</span><span class=\"badge\">'+ c.w + '×' + c.h +'</span>';

      card.appendChild(wrap);
      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(badges);
      grid.appendChild(card);
    }
  }

  function updatePlaceholderWithTemplate(index, t) {
    var idx = Number(index) || 1;
    var card = grid.querySelector('.card[data-idx=\"' + idx + '\"]');
    if (!card) return;
    // Replace the placeholder card with the full final card UI
    var finalCard = buildTemplateCard(t);
    finalCard.setAttribute('data-idx', String(idx));
    card.parentNode.replaceChild(finalCard, card);
  }

  function buildTemplateCard(t) {
    var card = document.createElement('div');
    card.className = 'card';

    var title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = t && t.name ? t.name : 'Template';

    var meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = (t && t.category ? t.category + ' · ' : '') + (t.totalElements || (t.elements ? t.elements.length : 0) || 0) + ' elements';

    var badges = document.createElement('div');
    badges.className = 'card-badges';
    var platformBadge = document.createElement('span');
    platformBadge.className = 'badge';
    platformBadge.innerHTML = '<strong>' + getPlatformLabel(t) + '</strong>';
    var sizeBadge = document.createElement('span');
    sizeBadge.className = 'badge';
    var w = (t && t.canvas && t.canvas.width) ? Number(t.canvas.width) : 0;
    var h = (t && t.canvas && t.canvas.height) ? Number(t.canvas.height) : 0;
    sizeBadge.innerHTML = '<strong>' + (w > 0 && h > 0 ? (w + '×' + h) : '—') + '</strong>';
    badges.appendChild(platformBadge);
    badges.appendChild(sizeBadge);

    var actions = document.createElement('div');
    actions.className = 'card-actions';

    var viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'btn-secondary';
    viewBtn.textContent = 'View JSON';
    viewBtn.addEventListener('click', function () {
      var pretty = '';
      try {
        pretty = JSON.stringify(t, null, 2);
      } catch (e) {
        pretty = String(t);
      }
      openJsonModal(title.textContent || 'Template JSON', pretty);
    });
    actions.appendChild(viewBtn);

    var testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'btn-secondary';
    testBtn.textContent = 'Test';
    testBtn.addEventListener('click', function () {
      try {
        testerJson.value = JSON.stringify(t, null, 2);
      } catch (e) {
        testerJson.value = String(t);
      }
      openTester();
      renderTester();
    });
    actions.appendChild(testBtn);

    var postDevBtn = document.createElement('button');
    postDevBtn.type = 'button';
    postDevBtn.className = 'btn-secondary';
    postDevBtn.textContent = 'Post to Dev';
    postDevBtn.addEventListener('click', function () {
      openDevPostModal(t);
    });
    actions.appendChild(postDevBtn);

    var wrap = document.createElement('div');
    wrap.className = 'preview-wrap';
    var cw = (t && t.canvas && t.canvas.width) ? Number(t.canvas.width) : 1080;
    var ch = (t && t.canvas && t.canvas.height) ? Number(t.canvas.height) : 1350;
    if (cw > 0 && ch > 0) {
      wrap.style.paddingBottom = ((ch / cw) * 100).toFixed(4) + '%';
    }
    var preview = document.createElement('div');
    preview.className = 'preview';
    wrap.appendChild(preview);

    card.appendChild(wrap);
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(badges);
    card.appendChild(actions);

    if (window.TemplateRenderer && window.TemplateRenderer.renderPreview) {
      window.TemplateRenderer.renderPreview(t, preview);
    }

    return card;
  }

  function buildStreamUrl(payload) {
    var p = new URLSearchParams();
    p.set('niche', payload.niche);
    p.set('category', payload.category);
    p.set('count', String(payload.count));
    p.set('target_platform', payload.target_platform);
    if (payload.brand_name) p.set('brand_name', payload.brand_name);
    if (payload.visual_style) p.set('visual_style', payload.visual_style);
    return '/api/generate/stream?' + p.toString();
  }

  function setTesterStatus(msg, isError) {
    testerStatus.textContent = msg;
    testerStatus.className = 'tester-status' + (isError ? ' error' : '');
  }

  function openTester() {
    tester.classList.add('open');
    testerJson && testerJson.focus();
  }

  function closeTester() {
    tester.classList.remove('open');
    if (testerPreview) testerPreview.innerHTML = '';
    setTesterStatus('Paste JSON and click Render.');
  }

  function renderTester() {
    if (!testerJson) return;
    var raw = testerJson.value.trim();
    if (!raw) {
      setTesterStatus('Please paste a template JSON first.', true);
      return;
    }
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setTesterStatus('Invalid JSON: ' + (e && e.message ? e.message : 'parse error'), true);
      return;
    }
    if (!parsed || !parsed.canvas || !parsed.elements) {
      setTesterStatus('JSON parsed, but it does not look like a template (missing canvas/elements).', true);
      return;
    }
    if (testerPreview) testerPreview.innerHTML = '';
    try {
      if (window.TemplateRenderer && window.TemplateRenderer.renderPreview) {
        window.TemplateRenderer.renderPreview(parsed, testerPreview);
        setTesterStatus('Rendered OK.');
      } else {
        setTesterStatus('Renderer not available.', true);
      }
    } catch (err) {
      setTesterStatus('Render failed: ' + (err && err.message ? err.message : String(err)), true);
    }
  }

  function copyTester() {
    var text = (testerJson && testerJson.value) ? testerJson.value : '';
    if (!text) return;
    var done = function () {
      copyTesterBtn.textContent = 'Copied';
      setTimeout(function () { copyTesterBtn.textContent = 'Copy'; }, 1000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
      done();
    }
  }

  openTesterBtn && openTesterBtn.addEventListener('click', openTester);
  closeTesterBtn && closeTesterBtn.addEventListener('click', closeTester);
  renderTesterBtn && renderTesterBtn.addEventListener('click', renderTester);
  copyTesterBtn && copyTesterBtn.addEventListener('click', copyTester);
  testerJson && testerJson.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') renderTester();
  });

  function openJsonModal(title, jsonText) {
    activeJsonText = jsonText || '';
    jsonModalTitle.textContent = title || 'Template JSON';
    jsonModalPre.textContent = activeJsonText;
    jsonModal.classList.add('open');
  }

  function closeJsonModal() {
    jsonModal.classList.remove('open');
    activeJsonText = '';
    jsonModalPre.textContent = '';
  }

  function closeDevPostModal() {
    if (!devPostModal) return;
    devPostModal.classList.remove('open');
    pendingDevPostTemplate = null;
    if (devPostProgress) devPostProgress.hidden = true;
    if (devPostResponseSection) devPostResponseSection.hidden = true;
    if (devPostResponsePre) devPostResponsePre.textContent = '';
    if (devPostSendBtn) {
      devPostSendBtn.disabled = false;
      devPostSendBtn.hidden = false;
    }
    if (devPostDoneCloseBtn) devPostDoneCloseBtn.hidden = true;
    if (devPostHint) {
      devPostHint.hidden = true;
      devPostHint.textContent = '';
    }
  }

  function openDevPostModal(t) {
    if (!devPostModal || !devPostRequestPre || !devPostBodyPre) return;
    pendingDevPostTemplate = t;
    if (devPostResponseSection) devPostResponseSection.hidden = true;
    if (devPostResponsePre) devPostResponsePre.textContent = '';
    if (devPostProgress) devPostProgress.hidden = true;
    if (devPostSendBtn) {
      devPostSendBtn.disabled = false;
      devPostSendBtn.hidden = false;
    }
    if (devPostDoneCloseBtn) devPostDoneCloseBtn.hidden = true;
    if (devPostHint) {
      devPostHint.hidden = true;
      devPostHint.textContent = '';
    }
    devPostRequestPre.textContent = 'Loading…';
    devPostBodyPre.textContent = '';
    devPostModal.classList.add('open');

    fetch('/api/dev/templates/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: t }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (_ref) {
        var ok = _ref.ok;
        var body = _ref.body;
        if (!ok) {
          devPostRequestPre.textContent = (body && body.error) ? body.error : 'Map request failed.';
          devPostBodyPre.textContent = '';
          return;
        }
        devPostRequestPre.textContent = body.requestSummary || '';
        try {
          devPostBodyPre.textContent = JSON.stringify(body.mapped, null, 2);
        } catch (e) {
          devPostBodyPre.textContent = String(body.mapped);
        }
        if (devPostHint && body.publishConfigured === false) {
          devPostHint.hidden = false;
          devPostHint.textContent =
            'No default token in .env — paste a JWT above to authorize, or set UPLOAD_TEMPLATE_BEARER_TOKEN on the server.';
        }
      })
      .catch(function (err) {
        devPostRequestPre.textContent =
          'Network error: ' + (err && err.message ? err.message : String(err));
        devPostBodyPre.textContent = '';
      });
  }

  function runDevPostPublish() {
    if (!pendingDevPostTemplate || !devPostSendBtn) return;
    devPostSendBtn.disabled = true;
    if (devPostProgress) {
      devPostProgress.hidden = false;
      devPostProgress.textContent = 'Posting to Dev API…';
    }
    if (devPostResponseSection) devPostResponseSection.hidden = true;
    if (devPostResponsePre) devPostResponsePre.textContent = '';

    var publishBody = { template: pendingDevPostTemplate };
    var tok = (devPostTokenInput && devPostTokenInput.value) ? devPostTokenInput.value.trim() : '';
    if (tok) publishBody.bearerToken = tok;

    fetch('/api/dev/templates/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publishBody),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (_ref2) {
        var res = _ref2.res;
        var body = _ref2.body;
        if (devPostProgress) devPostProgress.hidden = true;
        if (!devPostResponseSection || !devPostResponsePre) return;

        if (res.status === 503 && body && body.error) {
          devPostResponseSection.hidden = false;
          devPostResponsePre.textContent = JSON.stringify(body, null, 2);
        } else if (!res.ok && !(body && ('status' in body || 'ok' in body))) {
          devPostResponseSection.hidden = false;
          devPostResponsePre.textContent = JSON.stringify(body, null, 2);
        } else {
          devPostResponseSection.hidden = false;
          var out = {
            ok: body.ok,
            httpStatus: body.status,
            statusText: body.statusText,
            responseBodyJson: body.responseBodyJson,
            responseBodyText: body.responseBodyText,
            error: body.error,
          };
          devPostResponsePre.textContent = JSON.stringify(out, null, 2);
        }

        var allowRetry = res.status === 503;
        if (devPostSendBtn) {
          devPostSendBtn.hidden = !allowRetry;
          devPostSendBtn.disabled = false;
        }
        if (devPostDoneCloseBtn) devPostDoneCloseBtn.hidden = false;
      })
      .catch(function (err) {
        if (devPostProgress) devPostProgress.hidden = true;
        if (devPostResponseSection && devPostResponsePre) {
          devPostResponseSection.hidden = false;
          devPostResponsePre.textContent = JSON.stringify(
            { ok: false, error: err && err.message ? err.message : String(err) },
            null,
            2,
          );
        }
        if (devPostSendBtn) {
          devPostSendBtn.hidden = false;
          devPostSendBtn.disabled = false;
        }
        if (devPostDoneCloseBtn) devPostDoneCloseBtn.hidden = false;
      });
  }

  closeJsonBtn.addEventListener('click', closeJsonModal);
  jsonModal.addEventListener('click', function (e) {
    if (e.target === jsonModal) closeJsonModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (jsonModal.classList.contains('open')) closeJsonModal();
    else if (devPostModal && devPostModal.classList.contains('open')) closeDevPostModal();
  });

  if (devPostModal) {
    devPostModal.addEventListener('click', function (e) {
      if (e.target === devPostModal) closeDevPostModal();
    });
  }
  if (devPostHeaderCloseBtn) devPostHeaderCloseBtn.addEventListener('click', closeDevPostModal);
  if (devPostDoneCloseBtn) devPostDoneCloseBtn.addEventListener('click', closeDevPostModal);
  if (devPostSendBtn) devPostSendBtn.addEventListener('click', runDevPostPublish);
  copyJsonBtn.addEventListener('click', function () {
    var text = activeJsonText || '';
    if (!text) return;
    var done = function () {
      copyJsonBtn.textContent = 'Copied';
      setTimeout(function () { copyJsonBtn.textContent = 'Copy'; }, 1000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
      done();
    }
  });

  if (toggleExamplesBtn) {
    toggleExamplesBtn.addEventListener('click', function () {
      examplesExpanded = !examplesExpanded;
      renderExamples();
    });
  }
  renderExamples();

  function showPreviews(templates) {
    clearGrid();
    templates.forEach(function (t) {
      grid.appendChild(buildTemplateCard(t));
    });
  }

  function getPlatformLabel(t) {
    var tp = (t && t.targetPlatforms && t.targetPlatforms[0]) ? t.targetPlatforms[0] : '';
    if (tp === 'facebook_post') return 'Facebook';
    if (tp === 'pinterest_post') return 'Pinterest';
    if (tp === 'instagram_post') return 'Instagram';
    var w = (t && t.canvas && t.canvas.width) ? Number(t.canvas.width) : 0;
    var h = (t && t.canvas && t.canvas.height) ? Number(t.canvas.height) : 0;
    if (w === 1200 && h === 630) return 'Facebook';
    if (w === 1000 && h === 1500) return 'Pinterest';
    if (w === 1080 && h === 1350) return 'Instagram';
    return 'Custom';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var niche = document.getElementById('niche').value.trim();
    var category = document.getElementById('category').value.trim() || 'Social';
    var count = parseInt(document.getElementById('count').value, 10) || 2;
    var platform = (platformSelect && platformSelect.value) ? platformSelect.value : 'instagram_post';
    var brandName = (brandNameInput && brandNameInput.value) ? brandNameInput.value.trim() : '';
    var visualStyle = (visualStyleInput && visualStyleInput.value) ? visualStyleInput.value.trim() : '';

    setGenerating(true, count);
    renderPlaceholders(count, platform);

    var payload = {
      niche: niche,
      category: category,
      count: count,
      target_platform: platform,
      brand_name: brandName || undefined,
      visual_style: visualStyle || undefined
    };

    if (window.EventSource) {
      var received = 0;
      var es = new EventSource(buildStreamUrl(payload));

      es.addEventListener('template', function (ev) {
        try {
          var msg = JSON.parse(ev.data || '{}');
          if (msg && msg.template) {
            received += 1;
            updatePlaceholderWithTemplate(msg.index, msg.template);
            setStatus('Generated ' + received + ' / ' + (msg.total || count) + ' template(s)…');
          }
        } catch (_) {}
      });

      es.addEventListener('generation_error', function (ev) {
        try {
          if (ev && ev.data) {
            var body = JSON.parse(ev.data);
            if (body && body.error) setStatus(body.error, true);
          }
        } catch (_) {}
        try { es.close(); } catch (_) {}
        setGenerating(false);
        clearGrid();
      });

      es.addEventListener('done', function () {
        es.close();
        setGenerating(false);
        setStatus('Generated ' + received + ' template(s).');
      });

      // Safety: if the stream silently dies, don't leave the button loading forever.
      setTimeout(function () {
        if (submitBtn && submitBtn.disabled) setGenerating(false);
      }, 180000);

      return;
    }

    // Fallback to non-streaming if EventSource is unavailable.
    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var msg = body.message || body.error || res.statusText;
            if (res.status === 429 || body.code === 'QUOTA_EXCEEDED') {
              setStatus(msg, true);
              return null;
            }
            throw new Error(msg);
          }
          return body;
        });
      })
      .then(function (data) {
        if (!data || !data.templates) return;
        var list = data.templates;
        setStatus('Generated ' + list.length + ' template(s).');
        showPreviews(list);
      })
      .catch(function (err) {
        setStatus(err.message || 'Request failed', true);
        clearGrid();
      })
      .finally(function () {
        setGenerating(false);
      });
  });
})();
