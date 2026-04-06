/**
 * Wire-format templates for the main consumer app: resolved colors (no $VAR_*), minimal canvas,
 * element order text → shapes → images (array paints last last = on top for that runtime).
 * Internal pipeline keeps {@link GeneratedTemplate}.
 */

import type { GeneratedTemplate, TemplateElement, Canvas, ElementStyle } from '../types/schema.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function buildPaletteLookup(t: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const merge = (obj: unknown) => {
    if (!isRecord(obj)) return;
    for (const [k, v] of Object.entries(obj)) {
      if (v != null && String(v).trim() !== '') out[k] = String(v);
    }
  };
  merge(t.colorPalette);
  merge(t.color_palette);
  const canvas = t.canvas;
  if (isRecord(canvas)) {
    merge(canvas.colorPalette);
    merge(canvas.color_palette);
  }
  if (Object.keys(out).length === 0 && isRecord(canvas)) {
    const bg = canvas.background;
    if (isRecord(bg) && bg.type === 'color' && typeof bg.value === 'string' && bg.value.trim()) {
      out.$VAR_BG_PRIMARY = String(bg.value).trim();
    }
  }
  return out;
}

function resolveColorValue(val: unknown, pal: Record<string, string>): string {
  if (val == null) return '#000000';
  const s = String(val).trim();
  if (!s) return '#000000';
  if (s in pal) return pal[s];
  if (s.startsWith('$VAR_')) return pal[s] || '#000000';
  return s;
}

/** Replace longest $VAR_* keys first so nested names do not partially match. */
function substitutePaletteTokensInString(s: string, pal: Record<string, string>): string {
  let out = s;
  const keys = Object.keys(pal).filter((k) => k.startsWith('$')).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const v = pal[k];
    if (!v) continue;
    out = out.split(k).join(v);
  }
  return out;
}

function exportFontWeight(fw: unknown): string {
  if (fw === undefined || fw === null) return 'normal';
  if (typeof fw === 'string') {
    const l = fw.toLowerCase();
    return l === 'bold' || l === 'normal' ? l : Number(fw) >= 600 ? 'bold' : 'normal';
  }
  if (typeof fw === 'number' && Number.isFinite(fw)) return fw >= 600 ? 'bold' : 'normal';
  return 'normal';
}

/** Text layers: camelCase style (main app). */
function styleToTextExport(style: ElementStyle | undefined, pal: Record<string, string>): Record<string, unknown> {
  const src = (style || {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {
    fontFamily: 'Arial',
    alignment: typeof src.alignment === 'string' ? src.alignment : 'left',
    fontWeight: exportFontWeight(src.fontWeight ?? src.font_weight),
  };
  const color = src.color !== undefined ? resolveColorValue(src.color, pal) : '#333333';
  out.color = color;
  const fs = src.fontSize ?? src.font_size;
  if (typeof fs === 'number' && Number.isFinite(fs)) {
    out.fontSize = Math.round(fs);
  } else {
    out.fontSize = 16;
  }
  return out;
}

/** Shape layers: camelCase style + defaults like main app. */
function styleToShapeExport(style: ElementStyle | undefined, pal: Record<string, string>): Record<string, unknown> {
  const src = (style || {}) as Record<string, unknown>;
  const fill = src.fill !== undefined ? resolveColorValue(src.fill, pal) : '#333333';
  const cr = src.cornerRadius ?? src.corner_radius;
  const cornerRadius = typeof cr === 'number' && Number.isFinite(cr) ? Math.round(cr) : 0;
  const op = src.opacity;
  const opacity = typeof op === 'number' && Number.isFinite(op) ? op : 1;
  const sw = src.strokeWidth ?? src.stroke_width;
  const strokeWidth = typeof sw === 'number' && Number.isFinite(sw) ? sw : 0;

  return {
    fill,
    stroke: null,
    strokeWidth,
    opacity,
    cornerRadius,
  };
}

/** Image overlay style (minimal). */
function styleToImageExport(style: ElementStyle | undefined): Record<string, unknown> {
  const src = (style || {}) as Record<string, unknown>;
  const op = src.opacity;
  const opacity = typeof op === 'number' && Number.isFinite(op) ? op : 1;
  return { opacity };
}

function paletteRecordForExport(pal: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(pal)) {
    const s = String(v).trim();
    if (s) out[k] = s;
  }
  return out;
}

function canvasToStrict(canvas: Canvas | undefined, pal: Record<string, string>): Record<string, unknown> {
  const c = canvas;
  const w = typeof c?.width === 'number' ? c.width : 1080;
  const h = typeof c?.height === 'number' ? c.height : 1350;
  const unit = c?.unit === 'px' ? 'px' : 'px';
  const bg = c?.background;
  const palOut = paletteRecordForExport(pal);

  const fallbackColor = resolveColorValue(pal.$VAR_BG_PRIMARY, pal) || '#1a1a1a';

  if (bg?.type === 'image' && typeof bg.value === 'string' && bg.value.trim()) {
    const raw = bg.value.trim();
    const resolved = /^https?:\/\//i.test(raw) ? raw : resolveColorValue(raw, pal);
    if (/^https?:\/\//i.test(resolved)) {
      if (!palOut.$VAR_BG_PRIMARY) palOut.$VAR_BG_PRIMARY = fallbackColor;
      return {
        width: w,
        height: h,
        unit,
        background: { type: 'image', value: resolved },
        color_palette: palOut,
      };
    }
  }

  if (bg?.type === 'gradient' && typeof bg.value === 'string' && bg.value.trim()) {
    const value = substitutePaletteTokensInString(String(bg.value), pal);
    if (!palOut.$VAR_BG_PRIMARY) palOut.$VAR_BG_PRIMARY = fallbackColor;
    return {
      width: w,
      height: h,
      unit,
      background: { type: 'gradient', value },
      color_palette: palOut,
    };
  }

  let value = fallbackColor;
  if (bg?.type === 'color' && typeof bg.value === 'string' && bg.value.trim()) {
    value = resolveColorValue(bg.value, pal) || value;
  }
  const background: { type: 'color'; value: string } = { type: 'color', value };
  if (!palOut.$VAR_BG_PRIMARY) palOut.$VAR_BG_PRIMARY = background.value;

  return {
    width: w,
    height: h,
    unit,
    background,
    color_palette: palOut,
  };
}

/**
 * LLM often emits a near–full-canvas DECORATIVE “frame” that duplicates canvas.background
 * and can sit above product imagery in consumers that mishandle z-order.
 */
function isRedundantFullCanvasDecorative(el: TemplateElement, canvasW: number, canvasH: number): boolean {
  if (el.type !== 'shape' || el.role !== 'DECORATIVE') return false;
  if (String(el.elementId || '').includes('FULL-BLEED-BACK')) return true;
  const w = Number(el.dimensions?.w) || 0;
  const h = Number(el.dimensions?.h) || 0;
  if (canvasW <= 0 || canvasH <= 0) return false;
  return w >= canvasW * 0.85 && h >= canvasH * 0.85;
}

function filterRedundantFullBleedShapes(elements: TemplateElement[], cw: number, ch: number): TemplateElement[] {
  return elements.filter((e) => !isRedundantFullCanvasDecorative(e, cw, ch));
}

/** Raster tier for main-app array order (lower tier = earlier in JSON = painted before layers that follow). */
function imageRoleOrderTier(role: string): 0 | 1 | 2 {
  const r = String(role || '').toUpperCase();
  if (r === 'BACKGROUND_IMAGE') return 2;
  if (r === 'LOGO') return 1;
  return 0;
}

/**
 * Main app paints in array order (first → back, last → front).
 * Images: PRODUCT / promos / other rasters → LOGO → BACKGROUND_IMAGE (always last).
 */
export function sortElementsForMainApp(elements: TemplateElement[]): TemplateElement[] {
  const texts = elements.filter((e) => e.type === 'text');
  const shapes = elements.filter((e) => e.type === 'shape');
  const images = elements.filter((e) => e.type === 'image');
  const byZ = (a: TemplateElement, b: TemplateElement) => (a.zIndex ?? 0) - (b.zIndex ?? 0);
  texts.sort(byZ);
  shapes.sort(byZ);

  const tier0 = images.filter((e) => imageRoleOrderTier(String(e.role)) === 0);
  const tier1 = images.filter((e) => imageRoleOrderTier(String(e.role)) === 1);
  const tier2 = images.filter((e) => imageRoleOrderTier(String(e.role)) === 2);
  tier0.sort(byZ);
  tier1.sort(byZ);
  tier2.sort(byZ);

  return [...texts, ...shapes, ...tier0, ...tier1, ...tier2];
}

function textElementToExport(el: TemplateElement, pal: Record<string, string>): Record<string, unknown> {
  return {
    elementId: el.elementId,
    type: 'text',
    position: { x: el.position.x, y: el.position.y },
    dimensions: { w: el.dimensions.w, h: el.dimensions.h },
    rotation: typeof el.rotation === 'number' ? el.rotation : 0,
    role: el.role,
    z_index: typeof el.zIndex === 'number' ? el.zIndex : 0,
    style: styleToTextExport(el.style, pal),
    content: el.content != null ? String(el.content) : '',
  };
}

function shapeElementToExport(el: TemplateElement, pal: Record<string, string>): Record<string, unknown> {
  return {
    elementId: el.elementId,
    type: 'shape',
    position: { x: el.position.x, y: el.position.y },
    dimensions: { w: el.dimensions.w, h: el.dimensions.h },
    rotation: typeof el.rotation === 'number' ? el.rotation : 0,
    role: el.role,
    z_index: typeof el.zIndex === 'number' ? el.zIndex : 0,
    style: styleToShapeExport(el.style, pal),
    shape_type: 'rectangle',
  };
}

function elementRecord(el: TemplateElement): Record<string, unknown> {
  return el as unknown as Record<string, unknown>;
}

function imageAssetUrl(el: TemplateElement): string {
  const r = elementRecord(el);
  const c = r.content;
  const a = r.assetReferenceId ?? r.asset_reference_id;
  for (const v of [c, a]) {
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function imageElementToExport(el: TemplateElement): Record<string, unknown> {
  const url = imageAssetUrl(el);
  const rid = elementRecord(el);
  const elementId = String(rid.elementId ?? rid.element_id ?? '');
  const pos = (rid.position as { x?: number; y?: number }) || { x: 0, y: 0 };
  const dim = (rid.dimensions as { w?: number; h?: number }) || { w: 100, h: 100 };
  const zRaw = rid.zIndex ?? rid.z_index;
  const rot = rid.rotation;
  return {
    elementId,
    type: 'image',
    position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
    dimensions: { w: Number(dim.w) || 100, h: Number(dim.h) || 100 },
    rotation: typeof rot === 'number' ? rot : 0,
    role: String(rid.role ?? 'PRODUCT_IMAGE'),
    z_index: typeof zRaw === 'number' ? zRaw : Number(zRaw) || 0,
    assetReferenceId: url || null,
    style: styleToImageExport((rid.style as ElementStyle | undefined) ?? el.style),
  };
}

export function elementToMainExport(el: TemplateElement, pal: Record<string, string>): Record<string, unknown> {
  if (el.type === 'text') return textElementToExport(el, pal);
  if (el.type === 'shape') return shapeElementToExport(el, pal);
  return imageElementToExport(el);
}

/** Exported JSON for the main app (element order + field names match consumer). */
export function toStrictSnakeTemplate(input: GeneratedTemplate | Record<string, unknown>): Record<string, unknown> {
  const t = input as Record<string, unknown>;
  const pal = buildPaletteLookup(t);

  const canvasRaw = t.canvas as Canvas | undefined;
  const cw = typeof canvasRaw?.width === 'number' ? canvasRaw.width : 1080;
  const ch = typeof canvasRaw?.height === 'number' ? canvasRaw.height : 1350;
  const elementsRaw = filterRedundantFullBleedShapes(
    Array.isArray(t.elements) ? (t.elements as TemplateElement[]) : [],
    cw,
    ch,
  );

  const ordered = sortElementsForMainApp(elementsRaw);
  const subCat = String(t.subCategory ?? t.sub_category ?? '');
  const templateId = String(t.id ?? '');

  const exported = ordered.map((el) => elementToMainExport(el, pal));

  return {
    id: templateId,
    name: String(t.name ?? ''),
    category: String(t.category ?? ''),
    sub_category: subCat,
    user_owner_id: (t.userOwnerId ?? t.user_owner_id ?? null) as string | null,
    canvas: canvasToStrict(canvasRaw, pal),
    elements: exported,
    subCategory: subCat,
  };
}
