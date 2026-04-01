/**
 * Map ContentPackage fields into skeleton element roles (semantic fitting).
 */

import type { ContentPackage } from '../types/schema.js';
import type { MasterSkeleton } from './skeletons.js';
import type { ElementRole } from '../types/schema.js';

const ROLE_TO_PACKAGE_KEY: Partial<Record<ElementRole, keyof ContentPackage>> = {
  HEADLINE: 'headline',
  SUBHEAD: 'subhead',
  BODY_TEXT: 'bodyText',
  BRAND_NAME: 'brandName',
  MENU_TITLE: 'menuTitle',
  PRODUCT_NAME: 'productName',
  DESCRIPTION: 'subhead',
  PHONE_CTA: 'phone',
  PHONE_NUMBER: 'phone',
};

export function getContentForRole(role: ElementRole, pkg: ContentPackage): string {
  const key = ROLE_TO_PACKAGE_KEY[role];
  if (key) {
    const v = pkg[key];
    if (typeof v === 'string' && v) return v;
  }
  switch (role) {
    case 'HEADLINE':
      return pkg.headline;
    case 'SUBHEAD':
      return pkg.subhead ?? '';
    case 'BRAND_NAME':
      return pkg.brandName ?? '';
    case 'MENU_TITLE':
      return pkg.menuTitle ?? pkg.headline;
    case 'PRODUCT_NAME':
      return pkg.productName ?? '';
    case 'DESCRIPTION':
      return pkg.subhead ?? pkg.bodyText ?? pkg.headline ?? '';
    case 'PHONE_NUMBER':
    case 'PHONE_CTA':
      return pkg.phone ?? '';
    case 'BODY_TEXT':
      return pkg.bodyText ?? '';
    default:
      return '';
  }
}

/** Pexels query for the full-bleed canvas background (distinct from inset hero imagery). */
export function getCanvasBackgroundStockQuery(pkg: ContentPackage): string {
  const s = pkg.stockPhotoQueries;
  if (s?.fullBleedBackground) return s.fullBleedBackground;
  return pkg.imageQueries[0] || pkg.headline || pkg.name || 'abstract wide background';
}

/**
 * Pexels query for a skeleton image by role. `slotIndex` rotates through distinct phrases when
 * several images share the same role (e.g. multiple PRODUCT_IMAGE) without per-element placeholders.
 */
export function getStockPhotoQueryForRole(role: ElementRole, pkg: ContentPackage, slotIndex = 0): string {
  const s = pkg.stockPhotoQueries;
  const fallback = pkg.headline || pkg.name || 'lifestyle photography';
  if (s) {
    switch (role) {
      case 'BACKGROUND_IMAGE':
        return s.fullBleedBackground || s.framedFocus || fallback;
      case 'HERO_IMAGE':
        return s.framedFocus || s.productDetail || fallback;
      case 'PRODUCT_IMAGE': {
        const pool = [s.framedFocus, s.productDetail, s.promo1, s.promo2, s.promo3].filter(Boolean) as string[];
        if (pool.length) return pool[slotIndex % pool.length]!;
        return fallback;
      }
      case 'PROMO_IMAGE_1':
        return s.promo1 || s.framedFocus || fallback;
      case 'PROMO_IMAGE_2':
        return s.promo2 || s.productDetail || fallback;
      case 'PROMO_IMAGE_3':
        return s.promo3 || s.promo1 || fallback;
      default:
        return s.framedFocus || s.fullBleedBackground || fallback;
    }
  }
  return getImageQueryForRole(role, pkg, slotIndex);
}

export function getImageQueryForRole(
  role: ElementRole,
  pkg: ContentPackage,
  imageIndex: number
): string {
  const queries = pkg.imageQueries;
  const fallback = pkg.headline || pkg.name || 'social media background';
  if (role === 'BACKGROUND_IMAGE') return queries[0] ?? fallback;
  if (role === 'HERO_IMAGE') return queries[1] ?? queries[0] ?? fallback;
  if (role === 'PRODUCT_IMAGE') return queries[1] ?? queries[0] ?? fallback;
  if (role === 'PROMO_IMAGE_1') return queries[2] ?? queries[0] ?? pkg.headline;
  if (role === 'PROMO_IMAGE_2') return queries[1] ?? queries[0] ?? pkg.headline;
  if (role === 'PROMO_IMAGE_3') return queries[2] ?? queries[0] ?? pkg.headline;
  if (Array.isArray(queries) && queries.length > 0) return queries[imageIndex % queries.length] ?? fallback;
  return fallback;
}
