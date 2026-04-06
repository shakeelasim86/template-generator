/**
 * Main generator: generateVariations(input) -> N unique template JSONs.
 * Orchestrates content expansion, skeleton matching, semantic fitting,
 * image fetch, color extraction, and design intelligence (contrast, hierarchy).
 */

import type {
  GenerateVariationsInput,
  GeneratedTemplate,
  TemplateElement,
  ElementRole,
  Canvas,
  TemplateMatchScope,
  ElementConstraints,
} from '../types/schema.js';
import { resolveTemplateTaxonomy, buildTemplateIndexTags } from '../config/templateTaxonomy.js';
import type { ResolvedTemplateTaxonomy } from '../config/templateTaxonomy.js';
import type { ContentPackage } from '../types/schema.js';
import { generateSkeletonAndContentPackage, finalizeTextElementConstraints } from './contentExpansion.js';
import { getContentForRole, getStockPhotoQueryForRole } from './semanticFitting.js';
import { searchPhotoDeduped, getImageUrl } from './imageService.js';
import { LIGHT_TEXT, DARK_TEXT } from './colorExtraction.js';
import { randomUUID } from 'crypto';
import { APP_CONFIG } from '../config/constants.js';
import { sortElementsForMainApp } from './strictTemplateJson.js';
interface RuntimeSkeleton {
  id: string;
  name: string;
  canvas: { width: number; height: number; colorPalette: Canvas['colorPalette'] };
  elements: Array<{
    element_id: string;
    type: 'text' | 'image' | 'shape';
    role: ElementRole;
    position: { x: number; y: number };
    dimensions: { w: number; h: number };
    style: Record<string, unknown>;
    zIndex?: number;
    content: string;
    constraints?: ElementConstraints | { maxCharacters?: number; maxLines?: number };
    textZone?: boolean;
  }>;
}

/** Remove canonical brand URL from visible copy when the layout should not show a website line. */
function stripCanonicalWebsiteFromVisibleText(text: string): string {
  let s = String(text);
  const url = APP_CONFIG.BRAND.WEBSITE_URL;
  if (url) s = s.split(url).join('');
  s = s.replace(/\bkonvrtai\.com\b/gi, '');
  s = s.replace(/\s*\|\s*$/g, '').replace(/^\s*\|\s*/g, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}

function replaceTemplateTokens(text: string, pkg: ContentPackage): string {
  const siteValue = pkg.showWebsiteOnLayout ? pkg.website : '';
  const trimmed = String(text ?? '').trim();
  const noDollar = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed;

  // Handle plain "key" placeholders the LLM sometimes emits.
  if (noDollar.toUpperCase() === 'BRAND_NAME' || noDollar === 'brandName') return pkg.brandName;
  if (noDollar.toUpperCase() === 'MENU_TITLE' || noDollar === 'menuTitle') return pkg.menuTitle;
  if (noDollar.toUpperCase() === 'PRODUCT_NAME' || noDollar === 'productName') return pkg.productName;
  if (noDollar.toUpperCase() === 'HEADLINE_TEXT' || noDollar.toUpperCase() === 'HEADLINE' || noDollar === 'headline')
    return pkg.headline;
  if (noDollar.toUpperCase() === 'SUBHEAD_TEXT' || noDollar.toUpperCase() === 'SUBHEAD' || noDollar === 'subhead')
    return pkg.subhead;
  if (noDollar.toUpperCase() === 'BODY_TEXT' || noDollar.toUpperCase() === 'BODY' || noDollar === 'bodyText')
    return pkg.bodyText;
  if (noDollar.toUpperCase() === 'CONTACT_INFO') return `${pkg.address}\n${pkg.phone}`;
  if (noDollar.toUpperCase() === 'PHONE' || noDollar.toUpperCase() === 'PHONE_NUMBER' || noDollar === 'phone')
    return pkg.phone;
  if (noDollar.toUpperCase() === 'EMAIL' || noDollar === 'email') return pkg.email;
  if (noDollar.toUpperCase() === 'ADDRESS' || noDollar === 'address') return pkg.address;
  if (noDollar.toUpperCase() === 'LOGO_TEXT') return pkg.brandName;
  if (noDollar.toUpperCase() === 'HOURS') return 'Mon-Fri: 11 AM - 10 PM';
  if (noDollar.toUpperCase() === 'WEBSITE' || noDollar === 'website') return siteValue;

  // Handle templating-style placeholders.
  return trimmed.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const k = String(key);
    switch (k) {
      case 'brandName':
        return pkg.brandName;
      case 'menuTitle':
        return pkg.menuTitle;
      case 'productName':
        return pkg.productName;
      case 'phone':
        return pkg.phone;
      case 'email':
        return pkg.email;
      case 'website':
        return siteValue;
      case 'address':
        return pkg.address;
      case 'name':
        return pkg.name;
      case 'headline':
        return pkg.headline;
      case 'subhead':
        return pkg.subhead;
      case 'bodyText':
        return pkg.bodyText;
      default:
        return _m;
    }
  });
}

export async function generateVariations(input: GenerateVariationsInput): Promise<GeneratedTemplate[]> {
  const {
    niche,
    category,
    count,
    marketing_goal,
    brand_assets,
    target_platform,
  } = input;

  const geminiKey = APP_CONFIG.KEYS.GEMINI_API_KEY;
  const pexelsKey = APP_CONFIG.KEYS.PEXELS_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY is required');
  if (!pexelsKey) throw new Error('PEXELS_API_KEY is required');

  const results: GeneratedTemplate[] = [];

  const platform = target_platform ?? 'instagram_post';
  const { width: canvasW, height: canvasH } = getCanvasForPlatform(platform);

  await generateVariationsStream(input, async (template) => {
    results.push(template);
  });

  return results;
}

export async function generateVariationsStream(
  input: GenerateVariationsInput,
  onTemplate: (template: GeneratedTemplate, index: number, total: number) => Promise<void> | void,
): Promise<void> {
  const { niche, category, count, marketing_goal, brand_assets, target_platform } = input;

  const geminiKey = APP_CONFIG.KEYS.GEMINI_API_KEY;
  const pexelsKey = APP_CONFIG.KEYS.PEXELS_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY is required');
  if (!pexelsKey) throw new Error('PEXELS_API_KEY is required');

  const platform = target_platform ?? 'instagram_post';
  const { width: canvasW, height: canvasH } = getCanvasForPlatform(platform);

  const resolvedTaxonomy = resolveTemplateTaxonomy(category, niche);
  const templateScope: TemplateMatchScope = input.template_scope === 'strict' ? 'strict' : 'universal';

  for (let i = 0; i < count; i++) {
    let skeleton: RuntimeSkeleton;
    let pkg: ContentPackage;
    let llmDesign:
      | {
          designStyle: string;
          colorPalette: {
            $VAR_BG_PRIMARY: string;
            $VAR_BG_SECONDARY: string;
            $VAR_PRIMARY: string;
            $VAR_SECONDARY: string;
            $VAR_ACCENT: string;
            $VAR_TEXT_MAIN: string;
            $VAR_TEXT_SECONDARY: string;
          };
          fontPairing: { heading: string; body: string; accent?: string };
          backgroundPreference: 'image' | 'color' | 'gradient';
          logoText: string;
        }
      | undefined;
    try {
      const llm = await generateSkeletonAndContentPackage(
        geminiKey,
        niche,
        category,
        platform,
        canvasW,
        canvasH,
        marketing_goal,
        i + 1,
        {
          brandName: input.brand_name,
          visualStyle: input.visual_style,
          tone: input.tone,
        }
      );
      skeleton = {
        id: `llm-${i + 1}`,
        name: llm.skeletonName,
        canvas: { width: canvasW, height: canvasH, colorPalette: {} },
        elements: llm.elements.map((e) => ({
          element_id: e.element_id,
          type: e.type,
          role: e.role as ElementRole,
          position: e.position,
          dimensions: e.dimensions,
          style: e.style,
          zIndex: e.z_index,
          content: e.content_placeholder ? String(e.content_placeholder) : '',
          constraints: e.constraints,
          textZone: e.textZone,
        })),
      };
      skeleton = simplifySkeletonForElegance(skeleton);
      pkg = llm.content;
      llmDesign = llm.design;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(
        `[generateVariations] LLM skeleton+content failed for variation ${i + 1}/${count}: ${detail}`,
      );
      throw new Error(
        `LLM skeleton generation failed for variation ${i + 1}/${count}. Only live model output is used (no procedural fallback). ${detail}`,
        { cause: err },
      );
    }

    const template = await buildTemplateFromPackage(
      skeleton,
      pkg,
      resolvedTaxonomy,
      templateScope,
      pexelsKey,
      brand_assets,
      i + 1,
      { width: canvasW, height: canvasH, platform },
      llmDesign
    );
    await onTemplate({ ...template, skeleton_source: 'llm' }, i + 1, count);
  }
}

function simplifySkeletonForElegance(skeleton: RuntimeSkeleton): RuntimeSkeleton {
  const priority: Record<ElementRole, number> = {
    BACKGROUND_IMAGE: 0,
    HERO_IMAGE: 0,
    PRODUCT_IMAGE: 1,
    LOGO: 2,
    BRAND_NAME: 3,
    MENU_TITLE: 4,
    HEADLINE: 4,
    PRODUCT_NAME: 5,
    DESCRIPTION: 6,
    BODY_TEXT: 7,
    PHONE_NUMBER: 8,
    SUBHEAD: 8,
    DECORATIVE: 9,
    PROMO_IMAGE_1: 10,
    PROMO_IMAGE_2: 10,
    PROMO_IMAGE_3: 10,
    PHONE_CTA: 11,
    CTA_BUTTON: 12,
    CTA: 12,
  };

  // Only de-duplicate "key" text slots; allow multiple BODY_TEXT elements.
  const dedupeTextRoles = new Set<ElementRole>([
    'BRAND_NAME',
    'MENU_TITLE',
    'HEADLINE',
    'PRODUCT_NAME',
    'DESCRIPTION',
    'PHONE_NUMBER',
  ]);
  const textRolesSeen = new Set<ElementRole>();
  /** Only one full-bleed BACKGROUND_IMAGE in elements (canvas photo is merged at build time). */
  let backgroundImageKept = false;
  /** Only one brand mark; other image roles may repeat for mosaics. */
  const primaryImageRolesSeen = new Set<ElementRole>();
  let decorativeCount = 0;

  const sorted = [...skeleton.elements].sort((a, b) => {
    const pa = priority[a.role] ?? 99;
    const pb = priority[b.role] ?? 99;
    return pa - pb;
  });

  const kept: RuntimeSkeleton['elements'] = [];
  for (const el of sorted) {
    if (el.role === 'CTA' || el.role === 'CTA_BUTTON' || el.role === 'PHONE_CTA') continue;
    if (el.type === 'shape' && el.role === 'DECORATIVE') {
      decorativeCount++;
      if (decorativeCount > 2) continue;
    }
    if (el.type === 'text' && dedupeTextRoles.has(el.role)) {
      if (textRolesSeen.has(el.role)) continue;
      textRolesSeen.add(el.role);
    }
    if (el.type === 'image') {
      if (el.role === 'BACKGROUND_IMAGE') {
        if (backgroundImageKept) continue;
        backgroundImageKept = true;
      }
      if (el.role === 'LOGO') {
        if (primaryImageRolesSeen.has(el.role)) continue;
        primaryImageRolesSeen.add(el.role);
      }
      const imageElCount = kept.filter((k) => k.type === 'image').length;
      if (imageElCount >= 12) continue;
    }
    kept.push(el);
    if (kept.length >= 14) break;
  }

  return {
    ...skeleton,
    elements: kept.length >= 4 ? kept : skeleton.elements.slice(0, 6),
  };
}

function getCanvasForPlatform(platform: NonNullable<GenerateVariationsInput['target_platform']>): { width: number; height: number } {
  switch (platform) {
    case 'facebook_post':
      return { width: 1200, height: 630 };
    case 'pinterest_post':
      return { width: 1000, height: 1500 };
    case 'instagram_post':
    default:
      return { width: 1080, height: 1350 };
  }
}

function getImageOrientationForPlatform(
  platform: NonNullable<GenerateVariationsInput['target_platform']>,
): 'landscape' | 'portrait' | 'squarish' {
  switch (platform) {
    case 'facebook_post':
      return 'landscape';
    case 'pinterest_post':
    case 'instagram_post':
      return 'portrait';
    default:
      return 'squarish';
  }
}

async function buildTemplateFromPackage(
  skeleton: RuntimeSkeleton,
  pkg: ContentPackage,
  taxonomy: ResolvedTemplateTaxonomy,
  matchScope: TemplateMatchScope,
  pexelsKey: string,
  brandAssets: GenerateVariationsInput['brand_assets'],
  index: number,
  target: { width: number; height: number; platform: NonNullable<GenerateVariationsInput['target_platform']> },
  llmDesign?: {
    designStyle: string;
    colorPalette: {
      $VAR_BG_PRIMARY: string;
      $VAR_BG_SECONDARY: string;
      $VAR_PRIMARY: string;
      $VAR_SECONDARY: string;
      $VAR_ACCENT: string;
      $VAR_TEXT_MAIN: string;
      $VAR_TEXT_SECONDARY: string;
    };
    fontPairing: { heading: string; body: string; accent?: string };
    backgroundPreference: 'image' | 'color' | 'gradient';
    logoText: string;
  }
): Promise<GeneratedTemplate> {
  const templateId = randomUUID();
  const name = `${pkg.name} (Variation ${index})`;

  const baseW = skeleton.canvas.width;
  const baseH = skeleton.canvas.height;
  const sx = target.width / baseW;
  const sy = target.height / baseH;
  const sFont = Math.min(sx, sy);
  const imageOrientation = getImageOrientationForPlatform(target.platform);

  let primaryHex = brandAssets?.colors?.primary ?? llmDesign?.colorPalette.$VAR_PRIMARY;
  let accentHex = brandAssets?.colors?.accent ?? llmDesign?.colorPalette.$VAR_SECONDARY;
  let bgPrimaryHex = llmDesign?.colorPalette.$VAR_BG_PRIMARY ?? '#0F172A';
  let bgSecondaryHex = llmDesign?.colorPalette.$VAR_BG_SECONDARY ?? '#111827';
  let textMainHex = llmDesign?.colorPalette.$VAR_TEXT_MAIN ?? DARK_TEXT;
  let textSecondaryHex = llmDesign?.colorPalette.$VAR_TEXT_SECONDARY ?? '#FFFFFF';

  const usedPhotoIds = new Set<string>();
  const fetchDistinctPhotoUrl = async (query: string): Promise<string> => {
    const q =
      String(query || '').trim() ||
      `${taxonomy.subCategoryLabel || taxonomy.categoryLabel} lifestyle`;
    const photo = await searchPhotoDeduped(pexelsKey, q, imageOrientation, usedPhotoIds);
    if (photo) {
      usedPhotoIds.add(String(photo.id));
      return getImageUrl(photo, 'regular');
    }
    return '';
  };

  if (!primaryHex) primaryHex = '#FFFFFF';
  if (!accentHex) accentHex = '#FF6B6B';

  const colorPalette: Canvas['colorPalette'] = {
    $VAR_BG_PRIMARY: llmDesign?.colorPalette.$VAR_BG_PRIMARY ?? bgPrimaryHex,
    $VAR_BG_SECONDARY: llmDesign?.colorPalette.$VAR_BG_SECONDARY ?? bgSecondaryHex,
    $VAR_PRIMARY: llmDesign?.colorPalette.$VAR_PRIMARY ?? primaryHex,
    $VAR_SECONDARY: llmDesign?.colorPalette.$VAR_SECONDARY ?? accentHex,
    $VAR_ACCENT: llmDesign?.colorPalette.$VAR_ACCENT ?? '#FFD93D',
    $VAR_TEXT_MAIN: llmDesign?.colorPalette.$VAR_TEXT_MAIN ?? textMainHex,
    $VAR_TEXT_SECONDARY: llmDesign?.colorPalette.$VAR_TEXT_SECONDARY ?? textSecondaryHex,
  };

  const bgPref = llmDesign?.backgroundPreference ?? 'color';
  // Canvas is only solid color or gradient (LLM palette). Full-bleed photos are BACKGROUND_IMAGE elements.
  const canvasBackground: NonNullable<Canvas['background']> =
    bgPref === 'gradient'
      ? {
          type: 'gradient',
          value: `linear-gradient(135deg, ${colorPalette.$VAR_BG_PRIMARY} 0%, ${colorPalette.$VAR_BG_SECONDARY} 100%)`,
        }
      : { type: 'color', value: colorPalette.$VAR_BG_PRIMARY ?? bgPrimaryHex };

  const hasBgImageLayer = skeleton.elements.some((e) => e.type === 'image' && e.role === 'BACKGROUND_IMAGE');
  const needsInjectedBg = bgPref === 'image' && !hasBgImageLayer;
  const injectedFullBleed: RuntimeSkeleton['elements'][number] = {
    element_id: 'full-bleed-bg',
    type: 'image',
    role: 'BACKGROUND_IMAGE',
    position: { x: 0, y: 0 },
    dimensions: { w: baseW, h: baseH },
    style: {},
    zIndex: 0,
    content: '',
    textZone: false,
  };
  const sourceElements = needsInjectedBg ? [injectedFullBleed, ...skeleton.elements] : skeleton.elements;

  const canvas: Canvas = {
    width: target.width,
    height: target.height,
    unit: 'px',
    background: canvasBackground,
    colorPalette,
  };

  const elements: TemplateElement[] = [];
  const contentSlots: ElementRole[] = [];
  let z = 0;
  /** Advances when resolving Pexels query from role + stockPhotoQueries (not from placeholder). */
  let stockImageSlot = 0;

  for (const el of sourceElements) {
    if (el.type === 'shape' && el.role === 'DECORATIVE') {
      const bw = skeleton.canvas.width;
      const bh = skeleton.canvas.height;
      const dw = Number(el.dimensions.w);
      const dh = Number(el.dimensions.h);
      if (bw > 0 && bh > 0 && dw >= bw * 0.85 && dh >= bh * 0.85) {
        continue;
      }
    }
    if (el.role === 'LOGO' && !pkg.showBrandLogoImage) {
      continue;
    }

    const contentSlot = el.role;
    if (!contentSlots.includes(contentSlot)) contentSlots.push(contentSlot);

    const templateConstraints: ElementConstraints | null =
      el.type === 'text' ? (finalizeTextElementConstraints('text', el.role, el.constraints) ?? null) : null;

    let content: string | null = null;
    if (el.type === 'text') {
      if (el.role === 'BRAND_NAME') {
        content = APP_CONFIG.BRAND.DISPLAY_NAME;
      } else {
        content = el.content && String(el.content).trim() ? String(el.content) : getContentForRole(el.role, pkg);
      }
      if (el.role === 'LOGO' && (!content || !content.trim())) {
        content = llmDesign?.logoText || pkg.brandName;
      }
      if (el.role === 'PHONE_NUMBER' && (!content || !content.trim())) {
        content = pkg.phone;
      }
      if (el.role === 'BODY_TEXT' && (!content || !content.trim())) {
        content = `${pkg.address}  |  ${pkg.email}`;
      }

      if (content) {
        // If the LLM used template placeholders like {{headline}}, replace them with real values.
        content = replaceTemplateTokens(content, pkg);
        if (!pkg.showWebsiteOnLayout) {
          content = stripCanonicalWebsiteFromVisibleText(content);
        }
      }
    } else if (el.type === 'image') {
      if (el.role === 'LOGO') {
        content = APP_CONFIG.ASSETS.LOGO_URL;
      } else {
        const rawPh = String(el.content ?? '').trim();
        const isHttp = /^https?:\/\//i.test(rawPh);
        const isLogoWord = rawPh.toUpperCase() === 'LOGO';
        const usePlaceholderQuery = Boolean(rawPh && !isHttp && !isLogoWord);
        const query = usePlaceholderQuery
          ? rawPh
          : getStockPhotoQueryForRole(el.role, pkg, stockImageSlot);
        if (!usePlaceholderQuery) stockImageSlot += 1;
        let url = await fetchDistinctPhotoUrl(query);
        if (!url && (el.role === 'BACKGROUND_IMAGE' || el.role === 'HERO_IMAGE' || el.role === 'PRODUCT_IMAGE')) {
          url = await fetchDistinctPhotoUrl(`${query} different angle`);
        }
        content = url || null;
      }
    }

    // Never emit null/empty image URLs; fall back to a stable placeholder.
    if (el.type === 'image' && (!content || String(content).trim() === '')) {
      const seed = encodeURIComponent(`${taxonomy.subCategoryId}-${pkg.name}-${el.role}-${templateId}`);
      const w = Math.max(200, Math.round((el.dimensions.w as number) * sx));
      const h = Math.max(200, Math.round((el.dimensions.h as number) * sy));
      content = `https://picsum.photos/seed/${seed}/${w}/${h}`;
    }

    const style = { ...el.style } as Record<string, unknown>;
    resolvePaletteTokensInStyle(style, colorPalette, accentHex);

    const isHeadline = el.role === 'HEADLINE';
    const fontSize = isHeadline ? Math.max(48, (el.style.fontSize as number) ?? 48) : (el.style.fontSize as number);
    const fontWeight = isHeadline ? 800 : (el.style.fontWeight as number ?? 400);
    if (el.type === 'text') {
      const currentFamily = String((style as any).fontFamily || '').trim();
      if (!currentFamily) {
        const isDisplay = ['HEADLINE', 'MENU_TITLE', 'PRODUCT_NAME', 'BRAND_NAME'].includes(el.role);
        const named = isDisplay ? llmDesign?.fontPairing.heading : llmDesign?.fontPairing.body;
        const fallbackNamed = isDisplay ? 'Inter' : 'Inter';
        const base = (named && String(named).trim()) || fallbackNamed;
        const stack = base.includes(',') ? base : `${base.trim()}, sans-serif`;
        (style as { fontFamily?: string }).fontFamily = stack;
      }
      (style as { fontSize: number }).fontSize = fontSize;
      (style as { fontWeight: number }).fontWeight = fontWeight;
      (style as { color: string }).color = (style as { color?: string }).color ?? textMainHex;
    }

    // Optional readability overlay for text zones over images:
    // If the skeleton marks this element as being in a textZone, create a semi-transparent
    // shape behind it to improve contrast and avoid messy overlaps with image details.
    const wantsOverlay =
      el.type === 'text' &&
      (el as unknown as { textZone?: boolean }).textZone &&
      elements.some((e) => e.type === 'image') &&
      el.role !== 'CTA'; // CTA already uses accent background

    if (wantsOverlay) {
      const pad = 16; // padding around text box
      const bgIsDark = textMainHex === LIGHT_TEXT; // light text → dark overlay
      const overlayColor = bgIsDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.28)';

      elements.push({
        elementId: `${templateId}-${el.element_id}-overlay`,
        type: 'shape',
        role: 'DECORATIVE',
        position: {
          x: Math.max(0, ((el.position.x as number) - pad) * sx),
          y: Math.max(0, ((el.position.y as number) - pad) * sy),
        },
        dimensions: {
          w: Math.min(canvas.width, ((el.dimensions.w as number) + pad * 2) * sx),
          h: Math.min(canvas.height, ((el.dimensions.h as number) + pad * 2) * sy),
        },
        rotation: 0,
        style: { fill: overlayColor, cornerRadius: 12 } as unknown as TemplateElement['style'],
        content: null,
        constraints: null,
        assetReferenceId: '',
        crop: null,
        zIndex: z++,
      });
    }

    const isFullBleedBg = el.type === 'image' && el.role === 'BACKGROUND_IMAGE';

    elements.push({
      elementId: `${templateId}-${el.element_id}`,
      type: el.type,
      role: el.role,
      position: isFullBleedBg ? { x: 0, y: 0 } : { x: el.position.x * sx, y: el.position.y * sy },
      dimensions:
        el.role === 'LOGO'
          ? {
              w: APP_CONFIG.ASSETS.LOGO_TEMPLATE_WIDTH_PX,
              h: APP_CONFIG.ASSETS.LOGO_TEMPLATE_HEIGHT_PX,
            }
          : isFullBleedBg
            ? { w: canvas.width, h: canvas.height }
            : { w: el.dimensions.w * sx, h: el.dimensions.h * sy },
      rotation: 0,
      style: scaleStyle(style as TemplateElement['style'], sFont),
      content,
      constraints: templateConstraints,
      assetReferenceId: '',
      crop: null,
      zIndex: isFullBleedBg
        ? 0
        : typeof el.zIndex === 'number' && Number.isFinite(el.zIndex)
          ? el.zIndex
          : z++,
    });
  }

  const indexingDesignStyle = llmDesign?.designStyle || 'modern_social';
  const tags = buildTemplateIndexTags({
    resolved: taxonomy,
    pkg,
    designStyle: indexingDesignStyle,
    targetPlatform: target.platform,
  });
  const fontFamilies = Array.from(
    new Set(
      elements
        .filter((e) => e.type === 'text')
        .map((e) => String((e.style && (e.style as any).fontFamily) || 'Sans-serif').split(',')[0].trim())
        .filter(Boolean),
    ),
  );
  const colors = [
    colorPalette.$VAR_BG_PRIMARY,
    colorPalette.$VAR_BG_SECONDARY,
    colorPalette.$VAR_PRIMARY,
    colorPalette.$VAR_SECONDARY,
    colorPalette.$VAR_ACCENT,
    colorPalette.$VAR_TEXT_SECONDARY,
  ].filter(Boolean) as string[];

  const now = new Date().toISOString();
  const indexing = {
    isPro: false,
    status: 'active' as const,
    tags,
    colors,
    fontFamilies: fontFamilies.length ? fontFamilies : ['Sans-serif'],
    totalElements: elements.length,
    targetPlatforms: [target.platform],
    designStyle: indexingDesignStyle,
    contentSlots,
    industryFit: taxonomy.industryFit,
    marketingGoal: null,
    toneFit: null,
    taxonomy: {
      categoryId: taxonomy.categoryId,
      subCategoryId: taxonomy.subCategoryId,
    },
    matchScope,
  };

  return {
    id: `TPL-${templateId}`,
    name,
    category: taxonomy.categoryLabel,
    subCategory: taxonomy.subCategoryLabel,
    userOwnerId: null,
    canvas,
    indexing,
    isPro: false,
    status: 'active',
    tags,
    colors,
    fontFamilies: indexing.fontFamilies,
    totalElements: elements.length,
    designStyle: indexing.designStyle,
    contentSlots,
    targetPlatforms: indexing.targetPlatforms,
    colorPalette,
    industryFit: taxonomy.industryFit,
    marketingGoal: null,
    toneFit: null,
    scope: matchScope,
    created_at: now,
    updated_at: now,
    elements: stabilizeElements(sortElementsForMainApp(normalizeStackingOrder(elements)), canvas),
  };
}

/**
 * Map design-token strings on styles to real hex so downstream apps never see invalid keys like $VAR_BG.
 */
function resolvePaletteTokensInStyle(
  style: Record<string, unknown>,
  cp: Canvas['colorPalette'],
  accentFallback: string,
): void {
  const bgP = cp.$VAR_BG_PRIMARY ?? '#0F172A';
  const bgS = cp.$VAR_BG_SECONDARY ?? '#111827';
  const primary = cp.$VAR_PRIMARY ?? '#FFFFFF';
  const secondary = cp.$VAR_SECONDARY ?? '#FFFFFF';
  const accent = cp.$VAR_ACCENT ?? accentFallback;
  const textMain = cp.$VAR_TEXT_MAIN ?? '#111827';
  const textSec = cp.$VAR_TEXT_SECONDARY ?? '#FFFFFF';

  const map: Record<string, string> = {
    $VAR_BG: bgP,
    $VAR_BG_PRIMARY: bgP,
    $VAR_BG_SECONDARY: bgS,
    $VAR_PRIMARY: primary,
    $VAR_SECONDARY: secondary,
    $VAR_ACCENT: accent,
    $VAR_TEXT: textMain,
    $VAR_TEXT_MAIN: textMain,
    $VAR_TEXT_SECONDARY: textSec,
  };

  for (const key of ['color', 'fill', 'stroke', 'backgroundColor'] as const) {
    const v = style[key];
    if (typeof v === 'string' && v in map) {
      (style as Record<string, string>)[key] = map[v];
    }
  }
}

/**
 * - Assign unique zIndex 0..n-1 (higher = on top for z-index–aware renderers).
 * - Emit array in paint order for **array-order** renderers (first item = bottom): all non-text
 *   layers first (sorted by z then build order), then all text (same). Decorative bars/shapes
 *   no longer appear after copy in the list.
 */
function normalizeStackingOrder(elements: TemplateElement[]): TemplateElement[] {
  const tagged = elements.map((el, stackIndex) => ({ el, stackIndex }));
  const isText = (t: (typeof tagged)[number]) => t.el.type === 'text';
  const nonText = tagged.filter((t) => !isText(t));
  const text = tagged.filter(isText);
  const byZThenOrder = (a: (typeof tagged)[number], b: (typeof tagged)[number]) => {
    const za = a.el.zIndex ?? 0;
    const zb = b.el.zIndex ?? 0;
    if (za !== zb) return za - zb;
    return a.stackIndex - b.stackIndex;
  };
  nonText.sort(byZThenOrder);
  text.sort(byZThenOrder);
  const merged = [...nonText, ...text];
  merged.forEach((t, rank) => {
    t.el.zIndex = rank;
  });
  return merged.map((t) => t.el);
}

function scaleStyle(style: TemplateElement['style'], sFont: number): TemplateElement['style'] {
  const out = { ...(style as any) } as any;
  if (typeof out.fontSize === 'number') out.fontSize = Math.max(10, Math.round(out.fontSize * sFont));
  if (typeof out.cornerRadius === 'number') out.cornerRadius = Math.round(out.cornerRadius * sFont);
  if (typeof out.borderRadius === 'number') out.borderRadius = Math.round(out.borderRadius * sFont);
  if (typeof out.strokeWidth === 'number') out.strokeWidth = Math.max(1, Math.round(out.strokeWidth * sFont));
  return out;
}

function stabilizeElements(elements: TemplateElement[], canvas: Canvas): TemplateElement[] {
  const minSide = Math.min(canvas.width, canvas.height);
  const pad = Math.round(minSide * 0.02);
  return elements.map((el) => {
    if (el.type === 'image' && el.role === 'BACKGROUND_IMAGE') {
      return {
        ...el,
        position: { x: 0, y: 0 },
        dimensions: { w: canvas.width, h: canvas.height },
        style: { ...(el.style || {}) },
      };
    }

    const out = {
      ...el,
      position: { ...el.position },
      dimensions: { ...el.dimensions },
      style: { ...(el.style || {}) },
    };

    const minW = el.type === 'text' ? Math.round(minSide * 0.18) : Math.round(minSide * 0.08);
    const minH = el.type === 'text' ? Math.round(minSide * 0.05) : Math.round(minSide * 0.08);

    out.dimensions.w = Math.max(minW, Math.min(canvas.width - pad * 2, out.dimensions.w));
    out.dimensions.h = Math.max(minH, Math.min(canvas.height - pad * 2, out.dimensions.h));
    out.position.x = Math.max(pad, Math.min(canvas.width - pad - out.dimensions.w, out.position.x));
    out.position.y = Math.max(pad, Math.min(canvas.height - pad - out.dimensions.h, out.position.y));

    if (out.type === 'text' && typeof (out.style as any).fontSize === 'number') {
      const fs = (out.style as any).fontSize as number;
      (out.style as any).fontSize = Math.max(14, Math.min(120, fs));
    }

    return out;
  });
}
