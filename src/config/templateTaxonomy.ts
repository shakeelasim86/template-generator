/**
 * Canonical template taxonomy for category / subcategory labels and indexing.
 * Extend `TEMPLATE_TAXONOMY` when adding new verticals — matchers use id, label, and aliases.
 */

import type { ContentPackage } from '../types/schema.js';

export interface TaxonomySubcategoryDef {
  id: string;
  label: string;
  /** Optional seed tags merged into indexing tags for this subcategory */
  suggestedTags?: string[];
  aliases?: string[];
}

export interface TaxonomyCategoryDef {
  id: string;
  label: string;
  /** Extra strings that should resolve to this category (comma-free, human phrases ok) */
  aliases?: string[];
  /**
   * Industry buckets for downstream filtering (align with existing generator enums).
   */
  industryFit: string[];
  subcategories: TaxonomySubcategoryDef[];
}

/** Add new categories / subcategories here so JSON stays aligned across templates. */
export const TEMPLATE_TAXONOMY: TaxonomyCategoryDef[] = [
  {
    id: 'food_beverage',
    label: 'Food & Beverage',
    aliases: ['food and beverage', 'food & beverage', 'f&b', 'fnb', 'food', 'beverage', 'restaurant food'],
    industryFit: ['RESTAURANT_FOOD', 'E_COMMERCE_RETAIL'],
    subcategories: [
      { id: 'coffee_shop', label: 'Coffee Shop', suggestedTags: ['coffee', 'cafe', 'espresso', 'barista'] },
      { id: 'restaurant', label: 'Restaurant', suggestedTags: ['dining', 'menu', 'chef', 'plating'] },
      { id: 'bakery', label: 'Bakery & Pastry', suggestedTags: ['bakery', 'pastry', 'dessert'] },
      { id: 'bar_juice', label: 'Bar & Juicery', suggestedTags: ['bar', 'juice', 'cocktail'] },
    ],
  },
  {
    id: 'fashion_apparel',
    label: 'Fashion & Apparel',
    aliases: ['fashion', 'apparel', 'clothing', 'retail fashion'],
    industryFit: ['FASHION_APPAREL', 'E_COMMERCE_RETAIL'],
    subcategories: [
      {
        id: 'shoes',
        label: 'Shoes & Footwear',
        suggestedTags: ['shoes', 'footwear', 'sneakers', 'collection', 'sale'],
        aliases: ['footwear', 'sneakers'],
      },
      { id: 'streetwear', label: 'Streetwear', suggestedTags: ['streetwear', 'urban', 'style'] },
      { id: 'luxury', label: 'Luxury Fashion', suggestedTags: ['luxury', 'premium', 'designer'] },
    ],
  },
  {
    id: 'beauty_cosmetics',
    label: 'Beauty & Cosmetics',
    aliases: ['beauty', 'cosmetics', 'makeup', 'skincare brand'],
    industryFit: ['BEAUTY_COSMETICS', 'E_COMMERCE_RETAIL'],
    subcategories: [
      { id: 'skincare', label: 'Skincare', suggestedTags: ['skincare', 'glow', 'serum'] },
      { id: 'salon', label: 'Salon & Spa', suggestedTags: ['salon', 'spa', 'wellness'] },
    ],
  },
  {
    id: 'fitness_wellness',
    label: 'Fitness & Wellness',
    aliases: ['fitness', 'wellness', 'gym brand'],
    industryFit: ['FITNESS_WELLNESS', 'HEALTHCARE_MEDICAL'],
    subcategories: [
      { id: 'gym', label: 'Gym & Training', suggestedTags: ['gym', 'training', 'strength'] },
      { id: 'yoga', label: 'Yoga & Mindfulness', suggestedTags: ['yoga', 'mindfulness', 'stretch'] },
    ],
  },
  {
    id: 'tech_software',
    label: 'Technology',
    aliases: ['tech', 'software', 'saas', 'b2b tech'],
    industryFit: ['TECH_SOFTWARE', 'CONSULTING_B2B'],
    subcategories: [
      { id: 'saas', label: 'SaaS & Software', suggestedTags: ['saas', 'software', 'product'] },
      { id: 'startup', label: 'Startup', suggestedTags: ['startup', 'launch', 'innovation'] },
    ],
  },
  {
    id: 'travel_hospitality',
    label: 'Travel & Hospitality',
    aliases: ['travel', 'hospitality', 'tourism'],
    industryFit: ['TRAVEL_HOSPITALITY', 'RESTAURANT_FOOD'],
    subcategories: [
      { id: 'hotel', label: 'Hotels', suggestedTags: ['hotel', 'stay', 'resort'] },
      { id: 'experience', label: 'Experiences', suggestedTags: ['experience', 'adventure', 'tour'] },
    ],
  },
  {
    id: 'general',
    label: 'General',
    aliases: ['social', 'general', 'marketing', 'brand', 'promo'],
    industryFit: ['CONSULTING_B2B', 'E_COMMERCE_RETAIL'],
    subcategories: [
      { id: 'promotional', label: 'Promotional', suggestedTags: ['promo', 'brand', 'campaign'] },
      { id: 'announcement', label: 'Announcement', suggestedTags: ['announcement', 'news', 'update'] },
    ],
  },
];

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'your',
  'our',
  'are',
  'was',
  'has',
  'have',
  'not',
  'but',
  'any',
  'can',
  'you',
  'all',
  'per',
  'its',
  'one',
  'get',
]);

export interface ResolvedTemplateTaxonomy {
  categoryId: string;
  categoryLabel: string;
  subCategoryId: string;
  subCategoryLabel: string;
  industryFit: string[];
  taxonomyTags: string[];
  matchedTaxonomy: 'full' | 'category_only' | 'fallback';
}

function normKey(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugId(s: string): string {
  return normKey(s).replace(/\s+/g, '_');
}

function tokens(s: string): string[] {
  const k = normKey(s);
  return k ? k.split(' ') : [];
}

function stringsMatch(a: string, b: string): boolean {
  const na = normKey(a);
  const nb = normKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return false;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap >= Math.min(ta.size, tb.size) * 0.6 && overlap > 0;
}

function categoryMatchesInput(def: TaxonomyCategoryDef, categoryInput: string): boolean {
  const raw = normKey(categoryInput);
  if (!raw) return false;
  if (stringsMatch(def.id, categoryInput) || stringsMatch(def.label, categoryInput)) return true;
  for (const a of def.aliases ?? []) {
    if (stringsMatch(a, categoryInput)) return true;
  }
  return false;
}

function subMatchesInput(sub: TaxonomySubcategoryDef, nicheInput: string): boolean {
  if (!normKey(nicheInput)) return false;
  if (stringsMatch(sub.id, nicheInput) || stringsMatch(sub.label, nicheInput)) return true;
  for (const a of sub.aliases ?? []) {
    if (stringsMatch(a, nicheInput)) return true;
  }
  return false;
}

function findSubInCategory(def: TaxonomyCategoryDef, nicheInput: string): TaxonomySubcategoryDef | null {
  for (const sub of def.subcategories) {
    if (subMatchesInput(sub, nicheInput)) return sub;
  }
  return null;
}

/** If category is wrong but niche matches a known sub elsewhere, snap to that branch. */
function findSubGlobally(nicheInput: string): { category: TaxonomyCategoryDef; sub: TaxonomySubcategoryDef } | null {
  for (const c of TEMPLATE_TAXONOMY) {
    const sub = findSubInCategory(c, nicheInput);
    if (sub) return { category: c, sub };
  }
  return null;
}

function pickCategory(categoryInput: string): TaxonomyCategoryDef | null {
  for (const c of TEMPLATE_TAXONOMY) {
    if (categoryMatchesInput(c, categoryInput)) return c;
  }
  return null;
}

/**
 * Resolve API `category` + `niche` (sub-niche) to canonical taxonomy ids and display labels.
 */
export function resolveTemplateTaxonomy(categoryInput: string, nicheInput: string): ResolvedTemplateTaxonomy {
  const catTrim = String(categoryInput ?? '').trim();
  const nicheTrim = String(nicheInput ?? '').trim();

  const pickedCat = pickCategory(catTrim);
  let category: TaxonomyCategoryDef | null = pickedCat;
  let sub: TaxonomySubcategoryDef | null = null;
  let subFromTaxonomy = false;

  if (category && nicheTrim) {
    const found = findSubInCategory(category, nicheTrim);
    if (found) {
      sub = found;
      subFromTaxonomy = true;
    }
  }

  if (!category && nicheTrim) {
    const g = findSubGlobally(nicheTrim);
    if (g) {
      category = g.category;
      sub = g.sub;
      subFromTaxonomy = true;
    }
  }

  if (category && !sub) {
    if (nicheTrim) {
      sub = { id: slugId(nicheTrim), label: nicheTrim, suggestedTags: [] };
    } else {
      sub = category.subcategories[0]!;
      subFromTaxonomy = true;
    }
  }

  if (!category) {
    category = pickCategory('general') ?? TEMPLATE_TAXONOMY[TEMPLATE_TAXONOMY.length - 1]!;
    if (nicheTrim) {
      sub = { id: slugId(nicheTrim), label: nicheTrim, suggestedTags: [] };
    } else {
      sub = category.subcategories[0]!;
      subFromTaxonomy = true;
    }
  }

  let matched: ResolvedTemplateTaxonomy['matchedTaxonomy'];
  if (!pickedCat && !subFromTaxonomy) {
    matched = 'fallback';
  } else if (subFromTaxonomy) {
    matched = 'full';
  } else {
    matched = 'category_only';
  }

  const subResolved =
    sub ??
    category.subcategories[0] ??
    ({ id: 'general', label: 'General', suggestedTags: [] } satisfies TaxonomySubcategoryDef);

  const taxonomyTags = [...(subResolved.suggestedTags ?? [])].map((t) => normKey(t)).filter((t) => t.length >= 3);

  return {
    categoryId: category.id,
    categoryLabel: category.label,
    subCategoryId: subResolved.id,
    subCategoryLabel: subResolved.label,
    industryFit: Array.from(new Set(category.industryFit)),
    taxonomyTags: Array.from(new Set(taxonomyTags)),
    matchedTaxonomy: matched,
  };
}

/**
 * Extract multi-character keywords for indexing. Never iterates strings char-by-char as tags.
 */
export function buildTemplateIndexTags(args: {
  resolved: ResolvedTemplateTaxonomy;
  pkg: ContentPackage;
  designStyle: string;
  targetPlatform: string;
}): string[] {
  const minLen = 3;
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const w = String(raw ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '');
    if (w.length < minLen || STOPWORDS.has(w)) return;
    if (seen.has(w)) return;
    seen.add(w);
    out.push(w);
  };

  const pushWordsFromText = (text: string) => {
    const m = String(text).toLowerCase().match(/\b[a-z][a-z0-9]{2,}\b/g);
    if (!m) return;
    for (const w of m) push(w);
  };

  for (const t of args.resolved.taxonomyTags) push(t);
  pushWordsFromText(args.resolved.categoryLabel);
  pushWordsFromText(args.resolved.subCategoryLabel);
  pushWordsFromText(args.pkg.menuTitle);
  pushWordsFromText(args.pkg.productName);
  pushWordsFromText(args.pkg.name);
  pushWordsFromText(args.pkg.headline);
  pushWordsFromText(args.pkg.subhead);
  pushWordsFromText(args.pkg.bodyText);
  pushWordsFromText(args.designStyle.replace(/_/g, ' '));
  pushWordsFromText(args.targetPlatform.replace(/_/g, ' '));

  const cap = 18;
  return out.slice(0, cap);
}
