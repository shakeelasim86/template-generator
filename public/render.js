/**
 * Renders a single template JSON into a canvas preview (scaled to fit container).
 * Handles text and image elements; uses placeholder for CORS-blocked images when needed.
 */

(function (global) {
  /** Accept strict snake_case wire format (z_index, font_size, …) alongside legacy camelCase. */
  function normalizeTemplateForDraw(template) {
    if (!template || typeof template !== 'object') return template;
    var c = template.canvas || {};
    var palette = c.colorPalette || c.color_palette || {};
    function normStyle(st) {
      if (!st || typeof st !== 'object') return st || {};
      return {
        color: st.color,
        fill: st.fill,
        stroke: st.stroke,
        backgroundColor: st.backgroundColor != null ? st.backgroundColor : st.background_color,
        opacity: st.opacity,
        fontFamily: st.fontFamily || st.font_family,
        fontSize: st.fontSize != null ? st.fontSize : st.font_size,
        fontWeight: st.fontWeight != null ? st.fontWeight : st.font_weight,
        alignment: st.alignment,
        letterSpacing: st.letterSpacing != null ? st.letterSpacing : st.letter_spacing,
        strokeWidth: st.strokeWidth != null ? st.strokeWidth : st.stroke_width,
        cornerRadius: st.cornerRadius != null ? st.cornerRadius : st.corner_radius,
        borderRadius: st.borderRadius != null ? st.borderRadius : st.border_radius,
      };
    }
    var normEls = (template.elements || []).map(function (el) {
      var imgSrc =
        el.type === 'image'
          ? (el.content != null && el.content !== '' ? el.content : el.assetReferenceId || el.asset_reference_id || '')
          : el.content;
      return {
        type: el.type,
        role: el.role,
        position: el.position,
        dimensions: el.dimensions,
        elementId: el.elementId || el.element_id,
        zIndex: el.zIndex != null && el.zIndex !== undefined ? el.zIndex : el.z_index,
        style: normStyle(el.style),
        content: imgSrc,
      };
    });
    return {
      canvas: {
        width: c.width,
        height: c.height,
        colorPalette: palette,
        background: c.background,
      },
      elements: normEls,
    };
  }

  function drawTemplate(template, canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    template = normalizeTemplateForDraw(template);
    const c = template.canvas || {};
    const w = Math.max(1, Math.round(c.width || 1080));
    const h = Math.max(1, Math.round(c.height || 1350));
    const scale = 1;

    canvas.width = w;
    canvas.height = h;

    const pal = c.colorPalette || c.color_palette || {};
    const bg = c.background;
    const bgColor = (bg && bg.type === 'color' && bg.value) || pal.$VAR_BG_PRIMARY || pal.background || pal.primary || '#1a1a1a';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const elements = (template.elements || []).slice().sort(function (a, b) {
      var za = a.zIndex != null ? a.zIndex : a.z_index;
      var zb = b.zIndex != null ? b.zIndex : b.z_index;
      return (za || 0) - (zb || 0);
    });

    function resolveColorToken(value, fallback) {
      if (!value) return fallback;
      if (value === '$VAR_TEXT_MAIN') return pal.$VAR_TEXT_MAIN || fallback;
      if (value === '$VAR_TEXT_SECONDARY') return pal.$VAR_TEXT_SECONDARY || pal.$VAR_TEXT_MAIN || fallback;
      if (value === '$VAR_TEXT') return pal.$VAR_TEXT_MAIN || fallback;
      if (value === '$VAR_ACCENT') return pal.$VAR_ACCENT || fallback;
      if (value === '$VAR_PRIMARY') return pal.$VAR_PRIMARY || fallback;
      if (value === '$VAR_SECONDARY') return pal.$VAR_SECONDARY || fallback;
      if (value === '$VAR_BG') return pal.$VAR_BG || pal.$VAR_BG_PRIMARY || fallback;
      if (value === '$VAR_BG_PRIMARY') return pal.$VAR_BG_PRIMARY || fallback;
      if (value === '$VAR_BG_SECONDARY') return pal.$VAR_BG_SECONDARY || fallback;
      return value;
    }

    function drawRect(el) {
      const x = (el.position.x || 0) * scale;
      const y = (el.position.y || 0) * scale;
      const ww = (el.dimensions.w || 100) * scale;
      const hh = (el.dimensions.h || 100) * scale;
      const style = el.style || {};
      const fill = resolveColorToken(
        style.fill || style.backgroundColor || style.color,
        pal.$VAR_ACCENT || pal.accent || '#666'
      );
      const opacity = typeof style.opacity === 'number' ? style.opacity : 1;
      const r = style.cornerRadius || style.borderRadius || 0;
      ctx.save();
      ctx.globalAlpha = opacity;
      if (r > 0) {
        roundRect(ctx, x, y, ww, hh, r * scale);
        ctx.fillStyle = fill;
        ctx.fill();
      } else {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, ww, hh);
      }
      ctx.restore();
    }

    function drawImage(el, img, done) {
      const x = (el.position.x || 0) * scale;
      const y = (el.position.y || 0) * scale;
      const ww = (el.dimensions.w || 100) * scale;
      const hh = (el.dimensions.h || 100) * scale;
      ctx.drawImage(img, x, y, ww, hh);
      if (typeof done === 'function') done();
    }

    function drawText(el) {
      const x = (el.position.x || 0) * scale;
      const y = (el.position.y || 0) * scale;
      const ww = (el.dimensions.w || 200) * scale;
      const hh = (el.dimensions.h || 60) * scale;
      const style = el.style || {};
      // Preserve typography from JSON as much as possible.
      const rawSize = Number(style.fontSize || 16);
      const fontSize = Math.max(8, Math.min(220, rawSize * scale));
      const fw = String(style.fontWeight || '').toLowerCase();
      const isBold = fw === 'bold' || Number(style.fontWeight) >= 600;
      ctx.font = (isBold ? 'bold ' : '') + fontSize + 'px ' + (style.fontFamily || 'sans-serif');
      ctx.fillStyle = resolveColorToken(style.color, pal.$VAR_TEXT_MAIN || pal.text || '#fff');
      ctx.textBaseline = 'top';
      const align = style.alignment || 'left';
      ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
      const tx = ctx.textAlign === 'center' ? x + ww / 2 : ctx.textAlign === 'right' ? x + ww : x;
      const lineHeight = fontSize * 1.2;
      const safeH = Number.isFinite(hh) && hh > 0 ? hh : (fontSize * 2);
      const maxLines = Math.max(1, Math.floor(safeH / lineHeight));

      // Clip text to its element box to prevent overlapping spills.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, ww, safeH);
      ctx.clip();
      wrapText(ctx, el.content || '', tx, y, ww, lineHeight, maxLines);
      ctx.restore();
    }

    function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines) {
      const words = text.split(/\s+/);
      let line = '';
      let ny = y;
      let linesDrawn = 0;
      for (let i = 0; i < words.length; i++) {
        const test = line + (line ? ' ' : '') + words[i];
        const m = context.measureText(test);
        if (m.width > maxWidth && line) {
          context.fillText(line, x, ny);
          linesDrawn++;
          if (linesDrawn >= maxLines) return;
          line = words[i];
          ny += lineHeight;
        } else {
          line = test;
        }
      }
      if (line && linesDrawn < maxLines) context.fillText(line, x, ny);
    }

    function roundRect(context, x, y, w, h, r) {
      const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      context.beginPath();
      context.moveTo(x + rr, y);
      context.arcTo(x + w, y, x + w, y + h, rr);
      context.arcTo(x + w, y + h, x, y + h, rr);
      context.arcTo(x, y + h, x, y, rr);
      context.arcTo(x, y, x + w, y, rr);
      context.closePath();
    }

    const imageState = new Map();
    const bgImageState = { status: 'none', img: null };

    function drawImagePlaceholder(el) {
      const x = (el.position.x || 0) * scale;
      const y = (el.position.y || 0) * scale;
      const ww = (el.dimensions.w || 100) * scale;
      const hh = (el.dimensions.h || 100) * scale;
      ctx.fillStyle = pal.$VAR_BG_SECONDARY || pal.primary || '#333';
      ctx.fillRect(x, y, ww, hh);
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.fillText('Image', x + 4, y + 14);
    }

    function renderAll() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      if (bg && bg.type === 'image') {
        if (bgImageState.status === 'loaded' && bgImageState.img) {
          ctx.drawImage(bgImageState.img, 0, 0, w, h);
        } else if (bgImageState.status === 'error') {
          // Keep color fill when background image fails.
        }
      }
      elements.forEach(function (el) {
        if (el.type === 'shape') {
          drawRect(el);
        } else if (el.type === 'text') {
          drawText(el);
        } else if (el.type === 'image') {
          const st = imageState.get(el.elementId || el.element_id || el.content || '');
          if (st && st.status === 'loaded' && st.img) drawImage(el, st.img);
          else if (st && st.status === 'error') drawImagePlaceholder(el);
          else drawImagePlaceholder(el);
        }
      });
    }

    // Preload images and re-render as each one completes to preserve z-index order.
    if (bg && bg.type === 'image' && bg.value) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImageState.status = 'loading';
      bgImg.onload = function () {
        bgImageState.status = 'loaded';
        bgImageState.img = bgImg;
        renderAll();
      };
      bgImg.onerror = function () {
        bgImageState.status = 'error';
        bgImageState.img = null;
        renderAll();
      };
      bgImg.src = bg.value;
    }

    elements.forEach(function (el) {
      if (el.type !== 'image') return;
      var src = el.content || '';
      if (!src) return;
      const key = el.elementId || el.element_id || src || '';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      imageState.set(key, { status: 'loading', img: null });
      img.onload = function () {
        imageState.set(key, { status: 'loaded', img: img });
        renderAll();
      };
      img.onerror = function () {
        imageState.set(key, { status: 'error', img: null });
        renderAll();
      };
      img.src = src;
    });

    renderAll();
  }

  function renderPreview(template, container) {
    var canvas = document.createElement('canvas');
    container.appendChild(canvas);
    drawTemplate(template, canvas);
  }

  global.TemplateRenderer = { drawTemplate: drawTemplate, renderPreview: renderPreview };
})(typeof window !== 'undefined' ? window : this);
