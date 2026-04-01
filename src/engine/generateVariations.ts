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
} from '../types/schema.js';
import { resolveTemplateTaxonomy, buildTemplateIndexTags } from '../config/templateTaxonomy.js';
import type { ResolvedTemplateTaxonomy } from '../config/templateTaxonomy.js';
import type { ContentPackage } from '../types/schema.js';
import { generateContentPackages, generateSkeletonAndContentPackage } from './contentExpansion.js';
import {
  getContentForRole,
  getCanvasBackgroundStockQuery,
  getStockPhotoQueryForRole,
} from './semanticFitting.js';
import { searchPhotoDeduped, getImageUrl } from './imageService.js';
import {
  getDominantColor,
  getAccentFromPrimary,
  LIGHT_TEXT,
  DARK_TEXT,
} from './colorExtraction.js';
import { randomUUID } from 'crypto';
import { APP_CONFIG } from '../config/constants.js';
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
    constraints?: { maxCharacters?: number; maxLines?: number };
    textZone?: boolean;
  }>;
}

function replaceTemplateTokens(text: string, pkg: ContentPackage): string {
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
  if (noDollar.toUpperCase() === 'WEBSITE') return pkg.email;

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
    } catch {
      // Safe fallback if model output is malformed.
      const skeletonFallback = createDynamicSkeleton({
        width: canvasW,
        height: canvasH,
        platform,
        seed: i + 1,
        layoutIndex: i,
      });
      skeleton = simplifySkeletonForElegance(skeletonFallback);
      const structureGoal = buildStructureGoal(marketing_goal, skeletonFallback);
      const fallback = await generateContentPackages(
        geminiKey,
        niche,
        category,
        1,
        structureGoal
      );
      pkg = fallback[0];
      llmDesign = undefined;
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
    await onTemplate(template, i + 1, count);
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
  /** Only one full-bleed layer and one brand mark; other image roles may repeat for mosaics. */
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
      if (el.role === 'LOGO' || el.role === 'BACKGROUND_IMAGE') {
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

function buildStructureGoal(marketingGoal: string | undefined, skeleton: RuntimeSkeleton): string {
  const textRoles = Array.from(new Set(skeleton.elements.filter((e) => e.type === 'text').map((e) => e.role)));
  const imageSlots = skeleton.elements.filter((e) => e.type === 'image').length;
  const shapeSlots = skeleton.elements.filter((e) => e.type === 'shape').length;
  const base = marketingGoal ? `${marketingGoal}. ` : '';
  return (
    `${base}Layout structure for this specific variation: ` +
    `text roles=[${textRoles.join(', ')}], imageSlots=${imageSlots}, shapeSlots=${shapeSlots}. ` +
    `Generate copy that fits this exact structure with strong visual hierarchy and non-empty field values.`
  );
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

  let canvasBgUrl = '';
  if (llmDesign?.backgroundPreference !== 'color') {
    canvasBgUrl = await fetchDistinctPhotoUrl(getCanvasBackgroundStockQuery(pkg));
    if (canvasBgUrl && !llmDesign && !primaryHex) {
      try {
        const dominant = await getDominantColor(canvasBgUrl);
        bgPrimaryHex = dominant.hex;
        bgSecondaryHex = getAccentFromPrimary(dominant.hex);
        primaryHex = dominant.isDark ? '#FFFFFF' : '#111827';
        accentHex = accentHex ?? (dominant.isDark ? '#FF6B6B' : '#FF6B6B');
        textMainHex = dominant.isDark ? LIGHT_TEXT : DARK_TEXT;
        textSecondaryHex = dominant.isDark ? '#FFD93D' : '#1A1A1A';
      } catch {
        bgPrimaryHex = '#1A1A2E';
        bgSecondaryHex = '#16213E';
        primaryHex = primaryHex ?? '#FFFFFF';
        accentHex = accentHex ?? '#FF6B6B';
        textMainHex = LIGHT_TEXT;
        textSecondaryHex = '#FFD93D';
      }
    }
  }

  if (!canvasBgUrl && llmDesign?.backgroundPreference !== 'color') {
    const fallbackQuery = `${taxonomy.subCategoryLabel || taxonomy.categoryLabel} ${pkg.name || ''}`.trim();
    canvasBgUrl = await fetchDistinctPhotoUrl(fallbackQuery);
  }

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

  const canvas: Canvas = {
    width: target.width,
    height: target.height,
    unit: 'px',
    background: llmDesign?.backgroundPreference === 'color'
      ? { type: 'color', value: colorPalette.$VAR_BG_PRIMARY ?? bgPrimaryHex }
      : canvasBgUrl
      ? { type: 'image', value: canvasBgUrl }
      : { type: 'color', value: bgPrimaryHex },
    colorPalette,
  };

  const elements: TemplateElement[] = [];
  const contentSlots: ElementRole[] = [];
  let z = 0;
  /** Advances when resolving Pexels query from role + stockPhotoQueries (not from placeholder). */
  let stockImageSlot = 0;

  for (const el of skeleton.elements) {
    const contentSlot = el.role;
    if (!contentSlots.includes(contentSlot)) contentSlots.push(contentSlot);

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
    if (style.color === '$VAR_TEXT') (style as { color: string }).color = textMainHex;
    if (style.color === '$VAR_TEXT_MAIN') (style as { color: string }).color = textMainHex;
    if (style.color === '$VAR_TEXT_SECONDARY') (style as { color: string }).color = textSecondaryHex;
    if (style.color === '$VAR_ACCENT') (style as { color: string }).color = colorPalette.$VAR_ACCENT ?? '#FFD93D';
    if (style.fill === '$VAR_ACCENT') (style as { fill: string }).fill = colorPalette.$VAR_ACCENT ?? '#FFD93D';
    if (style.backgroundColor === '$VAR_ACCENT') (style as { backgroundColor: string }).backgroundColor = accentHex;

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
      (Boolean(canvasBgUrl) || elements.some((e) => e.type === 'image')) &&
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
        constraints: el.constraints ?? null,
        assetReferenceId: '',
        crop: null,
        zIndex: z++,
      });
    }

    elements.push({
      elementId: `${templateId}-${el.element_id}`,
      type: el.type,
      role: el.role,
      position: { x: el.position.x * sx, y: el.position.y * sy },
      dimensions:
        el.role === 'LOGO'
          ? { w: 240, h: 120 }
          : { w: el.dimensions.w * sx, h: el.dimensions.h * sy },
      rotation: 0,
      style: scaleStyle(style as TemplateElement['style'], sFont),
      content,
      constraints: el.constraints ?? null,
      assetReferenceId: '',
      crop: null,
      zIndex: typeof el.zIndex === 'number' && Number.isFinite(el.zIndex) ? el.zIndex : z++,
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
    elements: stabilizeElements(elements.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)), canvas),
  };
}

function createDynamicSkeleton(args: {
  width: number;
  height: number;
  platform: NonNullable<GenerateVariationsInput['target_platform']>;
  seed: number;
  layoutIndex: number;
}): RuntimeSkeleton {
  const { width: W, height: H, seed, platform, layoutIndex } = args;
  const familyCount = 5;
  const variantCount = 6;
  const normalized = ((layoutIndex % (familyCount * variantCount)) + (familyCount * variantCount)) % (familyCount * variantCount);
  const mode = normalized % familyCount;
  const variant = Math.floor(normalized / familyCount);
  const r = mulberry32(seed * 997 + W + H + normalized * 131);
  const m = Math.round(Math.min(W, H) * 0.06);
  const gap = Math.round(Math.min(W, H) * 0.018);

  const base: RuntimeSkeleton = {
    id: `runtime-${seed}-${mode}`,
    name: `Runtime Layout ${mode + 1}`,
    canvas: { width: W, height: H, colorPalette: {} },
    elements: [],
  };

  if (mode === 0) {
    // Hero image + bottom editorial band
    base.elements.push(
      { element_id: 'bg', type: 'image', role: 'BACKGROUND_IMAGE', position: { x: 0, y: 0 }, dimensions: { w: W, h: H }, style: {}, content: '' },
      { element_id: 'band', type: 'shape', role: 'DECORATIVE', position: { x: m, y: Math.round(H * 0.62) }, dimensions: { w: W - 2 * m, h: Math.round(H * 0.3) }, style: { fill: 'rgba(0,0,0,0.58)', cornerRadius: 24 }, content: '', textZone: true },
      { element_id: 'brand', type: 'text', role: 'BRAND_NAME', position: { x: m + 24, y: Math.round(H * 0.66) }, dimensions: { w: W - 2 * m - 48, h: 40 }, style: { color: '$VAR_ACCENT', fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 700, alignment: 'left' }, content: '', textZone: true },
      { element_id: 'title', type: 'text', role: 'MENU_TITLE', position: { x: m + 24, y: Math.round(H * 0.70) }, dimensions: { w: W - 2 * m - 48, h: 90 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'Manrope, sans-serif', fontSize: 50, fontWeight: 700, alignment: 'left' }, content: '', textZone: true },
      { element_id: 'desc', type: 'text', role: 'DESCRIPTION', position: { x: m + 24, y: Math.round(H * 0.78) }, dimensions: { w: W - 2 * m - 48, h: 90 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'DM Sans, sans-serif', fontSize: 30, fontWeight: 500, alignment: 'left' }, content: '', textZone: true },
    );
    return applyLayoutVariant(base, variant, W, H, r);
  }

  if (mode === 1) {
    // Left image / right copy split
    const leftW = Math.round(W * 0.56);
    base.elements.push(
      { element_id: 'img', type: 'image', role: 'PRODUCT_IMAGE', position: { x: 0, y: 0 }, dimensions: { w: leftW, h: H }, style: {}, content: '' },
      { element_id: 'panel', type: 'shape', role: 'DECORATIVE', position: { x: leftW - 2, y: 0 }, dimensions: { w: W - leftW + 2, h: H }, style: { fill: 'rgba(15,23,42,0.93)' }, content: '', textZone: true },
      { element_id: 'brand', type: 'text', role: 'BRAND_NAME', position: { x: leftW + m / 2, y: m * 2 }, dimensions: { w: W - leftW - m, h: 40 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, alignment: 'left' }, content: '', textZone: true },
      { element_id: 'product', type: 'text', role: 'PRODUCT_NAME', position: { x: leftW + m / 2, y: m * 3.2 }, dimensions: { w: W - leftW - m, h: 140 }, style: { color: '$VAR_ACCENT', fontFamily: 'Fraunces, serif', fontSize: 74, fontWeight: 800, alignment: 'left' }, content: '', textZone: true },
      { element_id: 'desc', type: 'text', role: 'DESCRIPTION', position: { x: leftW + m / 2, y: m * 6.1 }, dimensions: { w: W - leftW - m, h: 130 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'DM Sans, sans-serif', fontSize: 28, fontWeight: 500, alignment: 'left' }, content: '', textZone: true },
    );
    return applyLayoutVariant(base, variant, W, H, r);
  }

  if (mode === 2) {
    // Center poster type + framed image
    const frameW = Math.round(W * 0.78);
    const frameX = Math.round((W - frameW) / 2);
    base.elements.push(
      { element_id: 'bg', type: 'shape', role: 'DECORATIVE', position: { x: 0, y: 0 }, dimensions: { w: W, h: H }, style: { fill: '$VAR_BG_PRIMARY' }, content: '' },
      { element_id: 'brand', type: 'text', role: 'BRAND_NAME', position: { x: m, y: m * 1.6 }, dimensions: { w: W - 2 * m, h: 40 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, alignment: 'center' }, content: '', textZone: true },
      { element_id: 'title', type: 'text', role: 'MENU_TITLE', position: { x: m, y: m * 2.5 }, dimensions: { w: W - 2 * m, h: 90 }, style: { color: '$VAR_TEXT_MAIN', fontFamily: 'Manrope, sans-serif', fontSize: 44, fontWeight: 700, alignment: 'center' }, content: '', textZone: true },
      { element_id: 'img', type: 'image', role: 'PRODUCT_IMAGE', position: { x: frameX, y: Math.round(H * 0.25) }, dimensions: { w: frameW, h: Math.round(H * 0.5) }, style: {}, content: '' },
      { element_id: 'product', type: 'text', role: 'PRODUCT_NAME', position: { x: m, y: Math.round(H * 0.78) }, dimensions: { w: W - 2 * m, h: 130 }, style: { color: '$VAR_ACCENT', fontFamily: 'Fraunces, serif', fontSize: 92, fontWeight: 800, alignment: 'center' }, content: '', textZone: true },
    );
    return applyLayoutVariant(base, variant, W, H, r);
  }

  if (mode === 3) {
    // Triple image mosaic + footer copy
    const topH = Math.round(H * 0.35);
    const tileW = Math.round((W - 2 * m - 2 * gap) / 3);
    base.elements.push(
      { element_id: 'i1', type: 'image', role: 'PROMO_IMAGE_1', position: { x: m, y: m }, dimensions: { w: tileW, h: topH }, style: {}, content: '' },
      { element_id: 'i2', type: 'image', role: 'PROMO_IMAGE_2', position: { x: m + tileW + gap, y: m }, dimensions: { w: tileW, h: topH }, style: {}, content: '' },
      { element_id: 'i3', type: 'image', role: 'PROMO_IMAGE_3', position: { x: m + 2 * (tileW + gap), y: m }, dimensions: { w: tileW, h: topH }, style: {}, content: '' },
      { element_id: 'hero', type: 'image', role: 'PRODUCT_IMAGE', position: { x: m, y: m + topH + gap }, dimensions: { w: W - 2 * m, h: Math.round(H * 0.34) }, style: {}, content: '' },
      { element_id: 'foot', type: 'shape', role: 'DECORATIVE', position: { x: m, y: Math.round(H * 0.74) }, dimensions: { w: W - 2 * m, h: Math.round(H * 0.22) }, style: { fill: 'rgba(15,23,42,0.82)', cornerRadius: 20 }, content: '', textZone: true },
      { element_id: 'headline', type: 'text', role: 'HEADLINE', position: { x: m + 20, y: Math.round(H * 0.77) }, dimensions: { w: W - 2 * m - 40, h: 90 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'Fraunces, serif', fontSize: 56, fontWeight: 800, alignment: 'left' }, content: '', textZone: true },
      { element_id: 'desc', type: 'text', role: 'DESCRIPTION', position: { x: m + 20, y: Math.round(H * 0.84) }, dimensions: { w: W - 2 * m - 40, h: 80 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'DM Sans, sans-serif', fontSize: 28, fontWeight: 500, alignment: 'left' }, content: '', textZone: true },
    );
    return applyLayoutVariant(base, variant, W, H, r);
  }

  // mode === 4
  // Clean minimal with big product type and offset image
  const imgW = Math.round(W * 0.58);
  base.elements.push(
    { element_id: 'bg', type: 'shape', role: 'DECORATIVE', position: { x: 0, y: 0 }, dimensions: { w: W, h: H }, style: { fill: '$VAR_BG_PRIMARY' }, content: '' },
    { element_id: 'accent', type: 'shape', role: 'DECORATIVE', position: { x: 0, y: Math.round(H * 0.58) }, dimensions: { w: W, h: Math.round(H * 0.42) }, style: { fill: 'rgba(255,217,61,0.11)' }, content: '' },
    { element_id: 'img', type: 'image', role: 'PRODUCT_IMAGE', position: { x: W - imgW - m, y: Math.round(H * 0.12) }, dimensions: { w: imgW, h: Math.round(H * 0.56) }, style: {}, content: '' },
    { element_id: 'brand', type: 'text', role: 'BRAND_NAME', position: { x: m, y: Math.round(H * 0.13) }, dimensions: { w: W - imgW - 2 * m, h: 40 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, alignment: 'left' }, content: '', textZone: true },
    { element_id: 'product', type: 'text', role: 'PRODUCT_NAME', position: { x: m, y: Math.round(H * 0.22) }, dimensions: { w: W - imgW - 2 * m, h: 220 }, style: { color: '$VAR_ACCENT', fontFamily: 'Fraunces, serif', fontSize: 102, fontWeight: 800, alignment: 'left' }, content: '', textZone: true },
    { element_id: 'desc', type: 'text', role: 'DESCRIPTION', position: { x: m, y: Math.round(H * 0.48) }, dimensions: { w: W - imgW - 2 * m, h: 120 }, style: { color: '$VAR_TEXT_SECONDARY', fontFamily: 'DM Sans, sans-serif', fontSize: 30, fontWeight: 500, alignment: 'left' }, content: '', textZone: true },
  );
  return applyLayoutVariant(base, variant, W, H, r);
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildUniqueLayoutPlan(count: number, seedKey: string): number[] {
  const total = 30; // 5 families x 6 variants
  const pool = Array.from({ length: total }, (_, i) => i);
  const rand = mulberry32(hashString(seedKey));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  if (count <= total) return pool.slice(0, count);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % total]);
  return out;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function applyLayoutVariant(base: RuntimeSkeleton, variant: number, W: number, H: number, rand: () => number): RuntimeSkeleton {
  if (variant === 0) return base;
  const e = base.elements.map((x) => ({ ...x, position: { ...x.position }, dimensions: { ...x.dimensions }, style: { ...x.style } }));
  const textEls = e.filter((x) => x.type === 'text');
  const shapeEls = e.filter((x) => x.type === 'shape');
  const imageEls = e.filter((x) => x.type === 'image');

  if (variant === 1) {
    // Horizontal mirror
    for (const el of e) el.position.x = W - el.position.x - el.dimensions.w;
    for (const t of textEls) if ((t.style as any).alignment === 'left') (t.style as any).alignment = 'right';
  } else if (variant === 2) {
    // Vertical rhythm shift
    const dy = Math.round(H * 0.04);
    for (let i = 0; i < textEls.length; i++) textEls[i].position.y += i % 2 === 0 ? -dy : dy;
  } else if (variant === 3) {
    // Centered editorial variant
    for (const t of textEls) {
      (t.style as any).alignment = 'center';
      t.position.x = Math.max(24, Math.round(W * 0.08));
      t.dimensions.w = Math.round(W * 0.84);
    }
  } else if (variant === 4) {
    // Inset image blocks + rounder cards
    const inset = Math.round(Math.min(W, H) * 0.03);
    for (const im of imageEls) {
      im.position.x += inset;
      im.position.y += inset;
      im.dimensions.w = Math.max(120, im.dimensions.w - inset * 2);
      im.dimensions.h = Math.max(120, im.dimensions.h - inset * 2);
    }
    for (const sh of shapeEls) {
      (sh.style as any).cornerRadius = Math.max(12, Number((sh.style as any).cornerRadius || 0) + 12);
    }
  } else if (variant === 5) {
    // Subtle asymmetry
    const dx = Math.round(W * (0.02 + rand() * 0.025));
    for (let i = 0; i < textEls.length; i++) {
      textEls[i].position.x += i % 2 === 0 ? dx : -dx;
    }
  }

  return { ...base, elements: e };
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
