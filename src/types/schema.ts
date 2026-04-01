/**
 * Strict JSON schema for generated template output.
 */

export type ElementType = 'text' | 'image' | 'shape';
export type ElementRole =
  // Legacy / generic
  | 'HEADLINE'
  | 'SUBHEAD'
  | 'CTA'
  | 'BODY_TEXT'
  | 'HERO_IMAGE'
  | 'BACKGROUND_IMAGE'
  | 'LOGO'
  | 'PROMO_IMAGE_1'
  | 'PROMO_IMAGE_2'
  | 'PROMO_IMAGE_3'
  | 'DECORATIVE'
  // Canva-like roles
  | 'BRAND_NAME'
  | 'MENU_TITLE'
  | 'PRODUCT_NAME'
  | 'DESCRIPTION'
  | 'PHONE_CTA'
  | 'PHONE_NUMBER'
  | 'CTA_BUTTON'
  | 'PRODUCT_IMAGE';

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  w: number;
  h: number;
}

export interface ElementStyle {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  backgroundColor?: string;
  alignment?: 'left' | 'center' | 'right';
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  borderRadius?: number;
}

export interface ElementConstraints {
  maxCharacters?: number;
  maxLines?: number;
  overflowHandling?: 'SHRINK_TO_FIT' | 'CLIP' | 'WRAP';
}

export interface TemplateElement {
  // New structure
  elementId: string;
  type: ElementType;
  role: ElementRole;
  position: Position;
  dimensions: Dimensions;
  rotation?: number;
  style: ElementStyle;
  content: string | null;
  constraints?: ElementConstraints | null;
  assetReferenceId?: string | null;
  crop?: unknown | null;
  zIndex?: number;
  // Optional metadata passthrough
  id?: number;
  template_id?: string;
  created_at?: string;
}

export interface ColorPalette {
  $VAR_BG_PRIMARY?: string;
  $VAR_BG_SECONDARY?: string;
  $VAR_PRIMARY?: string;
  $VAR_SECONDARY?: string;
  $VAR_ACCENT?: string;
  $VAR_TEXT_MAIN?: string;
  $VAR_TEXT_SECONDARY?: string;
}

export interface CanvasBackground {
  type: 'color' | 'gradient' | 'image';
  value: string;
}

export interface Canvas {
  width: number;
  height: number;
  unit?: 'px';
  background?: CanvasBackground;
  colorPalette: ColorPalette;
}

/** How strictly a template should match posts: category-only vs category+subcategory. */
export type TemplateMatchScope = 'universal' | 'strict';

export interface TemplateIndexing {
  isPro: boolean;
  status: 'active' | 'inactive';
  tags: string[];
  colors: string[];
  fontFamilies: string[];
  totalElements: number;
  targetPlatforms: string[];
  designStyle: string;
  contentSlots: ElementRole[];
  industryFit: string[] | null;
  marketingGoal: string | null;
  toneFit: string | null;
  /** Canonical ids — align with `src/config/templateTaxonomy.ts` */
  taxonomy: {
    categoryId: string;
    subCategoryId: string;
  };
  /**
   * universal: usable for any post in the same taxonomy category (subcategory may differ).
   * strict: only for posts whose category and subcategory both match this template.
   */
  matchScope: TemplateMatchScope;
}

export interface GeneratedTemplate {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  userOwnerId: string | null;
  canvas: Canvas;
  indexing: TemplateIndexing;
  isPro: boolean;
  status: 'active' | 'inactive';
  tags: string[];
  colors: string[];
  fontFamilies: string[];
  totalElements: number;
  designStyle: string;
  contentSlots: ElementRole[];
  targetPlatforms: string[];
  elements: TemplateElement[];
  colorPalette: ColorPalette;
  industryFit: string[];
  marketingGoal: string | null;
  toneFit: string | null;
  scope: TemplateMatchScope;
  created_at: string;
  updated_at: string;
}

export interface GenerateVariationsInput {
  niche: string;
  category: string;
  count: number;
  target_platform?: 'instagram_post' | 'facebook_post' | 'pinterest_post';
  marketing_goal?: string;
  brand_name?: string;
  visual_style?: string;
  tone?: string;
  /**
   * universal (default): match posts on category only.
   * strict: post must match both category and subcategory (e.g. poll- or format-specific layouts).
   */
  template_scope?: TemplateMatchScope;
  brand_assets?: {
    logo_url?: string;
    colors?: { primary?: string; accent?: string };
  };
}

/**
 * Distinct Pexels search phrases so full-bleed canvas and inset/hero images are not duplicates.
 */
export interface StockPhotoQueries {
  fullBleedBackground: string;
  framedFocus: string;
  productDetail: string;
  promo1: string;
  promo2: string;
  promo3: string;
}

export interface ContentPackage {
  brandName: string;
  menuTitle: string;
  productName: string;
  phone: string;
  email: string;
  address: string;
  headline: string;
  subhead: string;
  bodyText: string;
  imageQueries: string[];
  /** Layer-specific stock search terms (preferred over imageQueries for image placement). */
  stockPhotoQueries: StockPhotoQueries;
  name: string;
}
