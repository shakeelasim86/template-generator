/**
 * Step A: Content Expansion - LLM generates N unique Content Packages.
 *
 * Provider selection:
 * - If USE_OPENAI === 'true' and OPENAI_API_KEY is set -> use OpenAI
 * - Otherwise use Gemini with GEMINI_API_KEY.
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { ContentPackage, StockPhotoQueries } from '../types/schema.js';
import { APP_CONFIG } from '../config/constants.js';

export interface LlmSkeletonElement {
  element_id: string;
  type: 'text' | 'image' | 'shape';
  role:
    | 'BRAND_NAME'
    | 'MENU_TITLE'
    | 'PRODUCT_NAME'
    | 'DESCRIPTION'
    | 'HEADLINE'
    | 'BODY_TEXT'
    | 'PHONE_NUMBER'
    | 'BACKGROUND_IMAGE'
    | 'PRODUCT_IMAGE'
    | 'PROMO_IMAGE_1'
    | 'PROMO_IMAGE_2'
    | 'PROMO_IMAGE_3'
    | 'LOGO'
    | 'DECORATIVE';
  position: { x: number; y: number };
  dimensions: { w: number; h: number };
  style: Record<string, unknown>;
  z_index?: number;
  constraints?: { maxCharacters?: number; maxLines?: number };
  textZone?: boolean;
  content_placeholder?: string;
}

export interface LlmSkeletonWithContent {
  skeletonName: string;
  elements: LlmSkeletonElement[];
  design: {
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
    fontPairing: {
      heading: string;
      body: string;
      accent?: string;
    };
    backgroundPreference: 'image' | 'color' | 'gradient';
    logoText: string;
  };
  content: ContentPackage;
}

export async function generateContentPackages(
  apiKey: string,
  niche: string,
  category: string,
  count: number,
  marketingGoal?: string
): Promise<ContentPackage[]> {
  const prompt = `You are a senior brand strategist, creative director, and editorial copywriter creating production-ready social template content.
Brand context: niche="${niche}", category="${category}".${marketingGoal ? ` Marketing goal: ${marketingGoal}.` : ''}

Fixed brand (always use exactly — do not invent a different company name):
- brandName: "${APP_CONFIG.BRAND.DISPLAY_NAME}" (exact spelling and casing)
- email: "${APP_CONFIG.BRAND.CONTACT_EMAIL}" (exact copy)
- Copy may describe the niche (e.g. pizza, coffee) but the trade name shown on templates is always ${APP_CONFIG.BRAND.DISPLAY_NAME}.

Stock photography via Pexels (critical):
- Return stockPhotoQueries with six DISTINCT short search phrases (no brand names). Each phrase must describe a different scene/subject so the API does not return the same photo twice (e.g. wide dining room blur vs. plated pizza top-down vs. flour-on-board macro).
- fullBleedBackground = atmospheric wide shot for the **full canvas** behind UI.
- framedFocus = **inset/main** hero image (e.g. one plated dish), different from fullBleedBackground.
- productDetail = complementary **detail** (hands, ingredient texture, close macro) — not the same wording as framedFocus.
- promo1, promo2, promo3 = three more **different** phrases for tile/mosaic slots.

Output quality requirements:
- Mature, polished, premium tone. Human and specific, never generic.
- Avoid clichés, filler, and hype language.
- No emojis. No excessive punctuation. No clickbait.
- No direct CTA button language ("Buy now", "Order now", "Click here", etc.).
- Copy must feel like it belongs in a modern Canva-quality template.

Design-awareness instructions (for better templates):
- Write with visual hierarchy in mind: brand label -> section title -> hero product phrase -> supporting line.
- Keep text scannable and balanced; each line should be visually placeable without crowding.
- Prioritize clarity, rhythm, and contrast between title and supporting copy.
- Use wording that works with elegant typography and clean spacing.

Generate exactly ${count} distinct content packages with varied creative angles and copy structures.

For each package return a JSON object with ALL fields present and NON-EMPTY strings (never null/undefined/empty).
If real details are unknown, invent realistic placeholders:
- phone: realistic phone number
- address: realistic short street/city line
- email must be exactly "${APP_CONFIG.BRAND.CONTACT_EMAIL}"

Return a JSON object with:
- brandName: must be exactly "${APP_CONFIG.BRAND.DISPLAY_NAME}"
- menuTitle: string (under 20 chars; refined and specific)
- productName: string (under 18 chars)
- phone: string (e.g. "+1 (212) 555-0198")
- email: must be exactly "${APP_CONFIG.BRAND.CONTACT_EMAIL}"
- address: string (e.g. "12 Grove St, New York")
- name: short internal title for this variation (e.g. "Afternoon Ritual")
- headline: string (short, punchy, under 40 chars)
- subhead: string (supporting line, under 60 chars)
- bodyText: string (one supporting line; under 90 chars)
- imageQueries: string[] (REQUIRED, 3 short phrases; supplementary to stockPhotoQueries)
- stockPhotoQueries: object with fullBleedBackground, framedFocus, productDetail, promo1, promo2, promo3 (each a distinct Pexels-oriented phrase)

Output ONLY a valid JSON array of ${count} objects, no markdown or explanation. Example format:
[{\"name\":\"...\",\"headline\":\"...\"},{\"name\":\"...\",...}]`;

  const useOpenAI = APP_CONFIG.USE_OPENAI;

  if (useOpenAI) {
    const openAiKey = APP_CONFIG.KEYS.OPENAI_API_KEY;
    if (!openAiKey) throw new Error('OPENAI_API_KEY is required when USE_OPENAI=true');

    console.log('\n[openai] contentExpansion final prompt:\n' + prompt + '\n');

    const client = new OpenAI({ apiKey: openAiKey });
    const response: any = await client.responses.create({
      model: APP_CONFIG.OPENAI_MODEL,
      input: prompt,
      max_output_tokens: Math.min(4000, Math.max(800, count * 600)),
      text: {
        format: {
          type: 'json_schema',
          name: 'content_packages',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                minItems: count,
                maxItems: count,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'brandName',
                    'menuTitle',
                    'productName',
                    'phone',
                    'email',
                    'address',
                    'name',
                    'headline',
                    'subhead',
                    'bodyText',
                    'imageQueries',
                    'stockPhotoQueries',
                  ],
                  properties: {
                    brandName: { type: 'string', minLength: 3 },
                    menuTitle: { type: 'string', minLength: 4 },
                    productName: { type: 'string', minLength: 3 },
                    phone: { type: 'string', minLength: 7 },
                    email: { type: 'string', minLength: 6 },
                    address: { type: 'string', minLength: 6 },
                    name: { type: 'string' },
                    headline: { type: 'string', minLength: 6 },
                    subhead: { type: 'string', minLength: 8 },
                    bodyText: { type: 'string', minLength: 8 },
                    imageQueries: {
                      type: 'array',
                      minItems: 3,
                      maxItems: 3,
                      items: { type: 'string' },
                    },
                    stockPhotoQueries: {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'fullBleedBackground',
                        'framedFocus',
                        'productDetail',
                        'promo1',
                        'promo2',
                        'promo3',
                      ],
                      properties: {
                        fullBleedBackground: { type: 'string', minLength: 4 },
                        framedFocus: { type: 'string', minLength: 4 },
                        productDetail: { type: 'string', minLength: 4 },
                        promo1: { type: 'string', minLength: 4 },
                        promo2: { type: 'string', minLength: 4 },
                        promo3: { type: 'string', minLength: 4 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const text = extractOpenAIText(response) ?? '';
    console.log('\n[openai] contentExpansion llm response:\n' + text + '\n');
    const cleaned = repairJson(text.replace(/```json?\s*|\s*```/g, '').trim());
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`OpenAI returned invalid JSON: ${text.slice(0, 300)}`);
    }

    const obj = (parsed ?? {}) as Record<string, unknown>;
    const items = Array.isArray(obj.items) ? obj.items : Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
    return items.slice(0, count).map((it) => normalizeContentPackage(it, niche, category));
  }

  // Gemini path (default)
  const ai = new GoogleGenAI({ apiKey });
  const model = APP_CONFIG.GEMINI_MODEL;
  console.log('\n[gemini] contentExpansion final prompt:\n' + prompt + '\n');

  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      const retryDelay = 10000;
      await new Promise((r) => setTimeout(r, retryDelay));
      try {
        response = await ai.models.generateContent({ model, contents: prompt });
      } catch (retryErr: unknown) {
        const retryMsg =
          retryErr && typeof retryErr === 'object' && 'message' in retryErr
            ? String((retryErr as { message: unknown }).message)
            : '';
        if (retryMsg.includes('429') || retryMsg.includes('RESOURCE_EXHAUSTED') || retryMsg.includes('quota')) {
          throw new Error('Quota exceeded. ' + retryMsg);
        }
        throw retryErr;
      }
    } else {
      throw err;
    }
  }

  const text = response.text ?? '';
  console.log('\n[gemini] contentExpansion llm response:\n' + text + '\n');
  const cleaned = repairJson(text.replace(/```json?\s*|\s*```/g, '').trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 300)}`);
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.slice(0, count).map((it) => normalizeContentPackage(it, niche, category));
}

export async function generateSkeletonAndContentPackage(
  apiKey: string,
  niche: string,
  category: string,
  platform: 'instagram_post' | 'facebook_post' | 'pinterest_post',
  width: number,
  height: number,
  marketingGoal: string | undefined,
  variationIndex: number,
  opts?: {
    brandName?: string;
    visualStyle?: string;
    tone?: string;
  }
): Promise<LlmSkeletonWithContent> {
  const gridUnit = Math.max(4, Math.round(Math.min(width, height) / 36));
  const prompt = `ROLE
You are a Senior Art Director & Systems Designer. Your task is to architect a high-converting, Canva-quality template skeleton.

CONTEXT
Niche: "${niche}"
Platform: "${platform}"
Canvas: ${width}x${height}
Variation Index: ${variationIndex}
${marketingGoal ? `Marketing Goal: "${marketingGoal}"\n` : ''}${opts?.brandName ? `Preferred Brand Name: "${opts.brandName}"\n` : ''}${opts?.visualStyle ? `Preferred Visual Style: "${opts.visualStyle}"\n` : ''}${opts?.tone ? `Preferred Tone: "${opts.tone}"\n` : ''}

PHASE 1: DESIGN STRATEGY (INTERNAL RATIONALE)
Before generating JSON, you must select a Design Archetype and define your strategy.

1. Archetype Selection: Map "${niche}" to one of these 4 archetypes:
LUXE/MINIMALIST: High negative space, centered, serif fonts, airy.
BOLD/ENERGETIC:  Heavy type, asymmetrical, vibrant, textured.
WARM/ORGANIC: Rounded corners, earthy tones, soft overlaps.
PROFESSIONAL/CLEAN: Grid-strict, left-aligned, blue/slate tones, high clarity.

2. Platform Constraints:
Instagram: Focus on a central "Scroll-Stopper" visual. Keep bottom 10% clear of text.
Facebook: Prioritize readability and trust. Use a logical Top-to-Bottom information flow.
Pinterest: Maximize vertical scannability. Use large, high-contrast headline blocks.

3. Design Heuristics:
60-30-10 Rule: 60% Background, 30% Secondary/Shapes, 10% Accent/CTA.
Typographic Scale: HEADLINE size must be at least 2.5x the BODY_TEXT size.
The Grid: Snap all X/Y coordinates to a 12-column grid (multiples of ${gridUnit}px).
The Visual Anchor: Strong focal point can be **photography**, **typography**, **color fields**, or **shapes** — not every layout needs a photo. If you use a PRODUCT_IMAGE or mosaic, text must support the hero, not fight it.
Proximity & White Space: Group related items (Address + Phone) together. Maintain a “Safe Zone” of 10% of the canvas width on all edges.
Typographic Scale Enforcement: Use a clear hierarchy. The HEADLINE must be at least 2.5x the size of the BODY_TEXT to create depth.

PHASE 2: TECHNICAL SPECIFICATIONS
Typography: Pick professional, legible typefaces that fit the archetype and niche — you are not limited to a fixed list. Use well-known, production-ready families (e.g. Google Fonts, common web/system fonts). For each text element, set style.fontFamily as a real CSS font stack when possible (e.g. "Fraunces, serif" or "Outfit, sans-serif"). In design.fontPairing, name heading and body faces that match what you used in the skeleton. Pair a strong display face for headlines with a clear body face; avoid gimmicky or obscure names.
Color Palette: Use variables ($VAR_BG, $VAR_PRIMARY, $VAR_ACCENT, $VAR_TEXT) to ensure dynamic behavior.
Visual Weight: Balance a large image in one quadrant with text in the opposite quadrant.

Rule: Every element MUST include content_placeholder (string). For text elements, it must be the exact label to render (including CTA/action labels).

BRAND & CONTACT (fixed):
- brandName in "content" MUST be exactly "${APP_CONFIG.BRAND.DISPLAY_NAME}" (templates show this name).
- email in "content" MUST be exactly "${APP_CONFIG.BRAND.CONTACT_EMAIL}".
- design.logoText should be "${APP_CONFIG.BRAND.DISPLAY_NAME}" or a short uppercase variant of it.
- A LOGO image element should use a text placeholder like "LOGO"; the app injects the real Konvrt logo asset.

IMAGERY — YOU CHOOSE THE COUNT (0 to many):
- Decide how many **raster** photos the design needs: **zero** (type-led layout with shapes + color/gradient), **one** focal image, or **several** for split layouts / mosaics. More images is not always better; match the archetype.
- Image roles: BACKGROUND_IMAGE (optional full-bleed behind UI), PRODUCT_IMAGE, PROMO_IMAGE_1 / _2 / _3, LOGO (asset). Omit image elements entirely if the layout is typography- or color-only; then set design.backgroundPreference to "color" or "gradient", not "image".
- For **each** non-LOGO image element, set content_placeholder to a **unique** short Pexels search phrase (no brand names). If you leave it empty, the app maps the role to optional content.stockPhotoQueries pools below.
- Avoid duplicate roles only for LOGO and BACKGROUND_IMAGE (at most one each). You may use multiple PRODUCT_IMAGE or promo slots for grids.

OPTIONAL STOCK POOL (Pexels-oriented phrases — for canvas / role fallback):
- content.stockPhotoQueries may include any of: fullBleedBackground (wide soft scene for canvas fill), framedFocus, productDetail, promo1, promo2, promo3. Each phrase should differ when present; omitted entries are filled automatically.
- content.imageQueries: 3 short phrases summarizing the niche/visual mood (still required).

OUTPUT FORMAT
Return ONLY a JSON object. No prose.
{
  "rationale": {
    "selected_archetype": "string",
    "vibe_description": "string",
    "layout_strategy": "string"
  },
  "design": {
    "name": "string",
    "color_palette": {
      "$VAR_BG": "hex",
      "$VAR_PRIMARY": "hex",
      "$VAR_ACCENT": "hex",
      "$VAR_TEXT_MAIN": "hex",
      "$VAR_TEXT_SECONDARY": "hex"
    },
    "elements": [
      {
        "id": "ELEM-01",
        "type": "text|image|shape",
        "role": "HEADLINE|SUBHEAD|BODY|LOGO|PRODUCT_IMAGE|DECORATIVE",
        "rect": {"x": number, "y": number, "w": number, "h": number},
        "z_index": number,
        "style": {
          "color": "$VAR_...",
          "fontFamily": "string",
          "fontSize": number,
          "fontWeight": "bold|normal",
          "alignment": "left|center|right",
          "opacity": number,
          "letterSpacing": number
        },
        "content_placeholder": "string"
      }
    ]
  },
  "content": {
    "brandName": "string",
    "menuTitle": "string",
    "productName": "string",
    "phone": "string",
    "email": "string",
    "address": "string",
    "name": "string",
    "headline": "string",
    "subhead": "string",
    "bodyText": "string",
    "imageQueries": ["string", "string", "string"],
    "stockPhotoQueries": {
      "fullBleedBackground": "string (optional)",
      "framedFocus": "string (optional)",
      "productDetail": "string (optional)",
      "promo1": "string (optional)",
      "promo2": "string (optional)",
      "promo3": "string (optional)"
    }
  }
}`;

  const useOpenAI = APP_CONFIG.USE_OPENAI;
  if (useOpenAI) {
    const openAiKey = APP_CONFIG.KEYS.OPENAI_API_KEY;
    if (!openAiKey) throw new Error('OPENAI_API_KEY is required when USE_OPENAI=true');
    console.log('\n[openai] skeleton+content final prompt:\n' + prompt + '\n');

    const client = new OpenAI({ apiKey: openAiKey });
    const response: any = await client.responses.create({
      model: APP_CONFIG.OPENAI_MODEL,
      input: prompt,
      max_output_tokens: 4000,
      text: {
        format: {
          type: 'json_schema',
          name: 'skeleton_with_content',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['skeletonName', 'design', 'elements', 'content'],
            properties: {
              skeletonName: { type: 'string', minLength: 3 },
              design: {
                type: 'object',
                additionalProperties: false,
                required: ['designStyle', 'colorPalette', 'fontPairing', 'backgroundPreference', 'logoText'],
                properties: {
                  designStyle: { type: 'string', minLength: 3 },
                  colorPalette: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['$VAR_BG_PRIMARY', '$VAR_BG_SECONDARY', '$VAR_PRIMARY', '$VAR_SECONDARY', '$VAR_ACCENT', '$VAR_TEXT_MAIN', '$VAR_TEXT_SECONDARY'],
                    properties: {
                      $VAR_BG_PRIMARY: { type: 'string', minLength: 4 },
                      $VAR_BG_SECONDARY: { type: 'string', minLength: 4 },
                      $VAR_PRIMARY: { type: 'string', minLength: 4 },
                      $VAR_SECONDARY: { type: 'string', minLength: 4 },
                      $VAR_ACCENT: { type: 'string', minLength: 4 },
                      $VAR_TEXT_MAIN: { type: 'string', minLength: 4 },
                      $VAR_TEXT_SECONDARY: { type: 'string', minLength: 4 },
                    },
                  },
                  fontPairing: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['heading', 'body'],
                    properties: {
                      heading: { type: 'string', minLength: 2 },
                      body: { type: 'string', minLength: 2 },
                      accent: { type: 'string' },
                    },
                  },
                  backgroundPreference: { type: 'string', enum: ['image', 'color', 'gradient'] },
                  logoText: { type: 'string', minLength: 2 },
                },
              },
              elements: {
                type: 'array',
                minItems: 4,
                maxItems: 16,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['element_id', 'type', 'role', 'position', 'dimensions', 'style', 'content_placeholder'],
                  properties: {
                    element_id: { type: 'string' },
                    type: { type: 'string', enum: ['text', 'image', 'shape'] },
                    role: {
                      type: 'string',
                      enum: ['BRAND_NAME', 'MENU_TITLE', 'PRODUCT_NAME', 'DESCRIPTION', 'HEADLINE', 'BODY_TEXT', 'PHONE_NUMBER', 'BACKGROUND_IMAGE', 'PRODUCT_IMAGE', 'PROMO_IMAGE_1', 'PROMO_IMAGE_2', 'PROMO_IMAGE_3', 'LOGO', 'DECORATIVE'],
                    },
                    position: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['x', 'y'],
                      properties: { x: { type: 'number' }, y: { type: 'number' } },
                    },
                    dimensions: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['w', 'h'],
                      properties: { w: { type: 'number' }, h: { type: 'number' } },
                    },
                    style: { type: 'object' },
                    content_placeholder: { type: 'string' },
                    constraints: { type: 'object' },
                    textZone: { type: 'boolean' },
                  },
                },
              },
              content: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'brandName',
                  'menuTitle',
                  'productName',
                  'phone',
                  'email',
                  'address',
                  'name',
                  'headline',
                  'subhead',
                  'bodyText',
                  'imageQueries',
                ],
                properties: {
                  brandName: { type: 'string', minLength: 3 },
                  menuTitle: { type: 'string', minLength: 4 },
                  productName: { type: 'string', minLength: 3 },
                  phone: { type: 'string', minLength: 7 },
                  email: { type: 'string', minLength: 6 },
                  address: { type: 'string', minLength: 6 },
                  name: { type: 'string', minLength: 3 },
                  headline: { type: 'string', minLength: 6 },
                  subhead: { type: 'string', minLength: 8 },
                  bodyText: { type: 'string', minLength: 8 },
                  imageQueries: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
                  stockPhotoQueries: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      fullBleedBackground: { type: 'string' },
                      framedFocus: { type: 'string' },
                      productDetail: { type: 'string' },
                      promo1: { type: 'string' },
                      promo2: { type: 'string' },
                      promo3: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const text = extractOpenAIText(response) ?? '';
    console.log('\n[openai] skeleton+content llm response:\n' + text + '\n');
    const parsed = JSON.parse(repairJson(text.replace(/```json?\s*|\s*```/g, '').trim())) as Record<string, unknown>;
    return normalizeSkeletonWithContent(parsed, niche, category, width, height);
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = APP_CONFIG.GEMINI_MODEL;
  console.log('\n[gemini] skeleton+content final prompt:\n' + prompt + '\n');
  const response = await ai.models.generateContent({ model, contents: prompt });
  const text = response.text ?? '';
  console.log('\n[gemini] skeleton+content llm response:\n' + text + '\n');
  const parsed = JSON.parse(repairJson(text.replace(/```json?\s*|\s*```/g, '').trim())) as Record<string, unknown>;
  return normalizeSkeletonWithContent(parsed, niche, category, width, height);
}

function extractOpenAIText(resp: any): string | undefined {
  // Try new Responses API shape
  const out = (resp && resp.output) || (resp && resp.output_text);
  if (typeof out === 'string') return out;
  if (Array.isArray(out) && out[0]?.content) {
    const parts = out[0].content;
    for (const p of parts) {
      if (typeof p.text === 'string') return p.text;
      if (p.type === 'output_text' && p.text) return p.text;
      if (p.type === 'text' && p.text?.value) return p.text.value;
    }
  }
  return undefined;
}

function buildDefaultStockPhotoQueries(
  niche: string,
  category: string,
  imageQueries: string[]
): StockPhotoQueries {
  const a = imageQueries[0] || `${niche} venue interior wide`;
  const b = imageQueries[1] || `${niche} hero dish plating`;
  const c = imageQueries[2] || `${category} ingredient texture macro`;
  return {
    fullBleedBackground: `${a} wide soft-focus ambient background`,
    framedFocus: `${b} single subject hero centered`,
    productDetail: `${c} complementary close-up detail`,
    promo1: `${niche} lifestyle alternate angle`,
    promo2: `${niche} overhead hands serving`,
    promo3: `${niche} rustic surface macro`,
  };
}

function normalizeStockPhotoQueries(
  raw: Record<string, unknown>,
  niche: string,
  category: string,
  imageQueries: string[]
): StockPhotoQueries {
  const defaults = buildDefaultStockPhotoQueries(niche, category, imageQueries);
  const sp = raw.stockPhotoQueries;
  if (!sp || typeof sp !== 'object') return defaults;
  const obj = sp as Record<string, unknown>;
  const pick = (key: keyof StockPhotoQueries): string => {
    const v = cleanText(obj[key]);
    return v || defaults[key];
  };
  return {
    fullBleedBackground: pick('fullBleedBackground'),
    framedFocus: pick('framedFocus'),
    productDetail: pick('productDetail'),
    promo1: pick('promo1'),
    promo2: pick('promo2'),
    promo3: pick('promo3'),
  };
}

function normalizeContentPackage(raw: unknown, niche: string, category: string): ContentPackage {
  const o = raw as Record<string, unknown>;
  const rawQueries = Array.isArray(o.imageQueries) ? (o.imageQueries as unknown[]) : [];
  let imageQueries = rawQueries
    .map((q) => (q == null ? '' : String(q)).trim())
    .filter(Boolean)
    .slice(0, 3);

  const defaultQueries = [
    `${niche} product close-up`,
    `${niche} lifestyle scene`,
    `${category} background texture`,
  ];
  if (imageQueries.length < 3) {
    for (let i = imageQueries.length; i < 3; i++) {
      imageQueries.push(defaultQueries[i]);
    }
  }
  if (imageQueries.length === 0) {
    imageQueries = [...defaultQueries];
  }

  const stockPhotoQueries = normalizeStockPhotoQueries(o, niche, category, imageQueries);

  const menuTitle = cleanText(o.menuTitle);
  const productName = cleanText(o.productName);
  const phone = cleanText(o.phone);
  const address = cleanText(o.address);

  return {
    brandName: APP_CONFIG.BRAND.DISPLAY_NAME,
    menuTitle: truncate(menuTitle || 'SIGNATURE SELECTION', 22),
    productName: truncate(productName || niche.split(/\s+/)[0]?.toUpperCase() || 'SIGNATURE', 18),
    phone: phone || '+1 (212) 555-0198',
    email: APP_CONFIG.BRAND.CONTACT_EMAIL,
    address: truncate(address || '12 Grove St, New York', 44),
    name: truncate(String(o.name ?? 'Untitled'), 32),
    headline: truncate(cleanText(o.headline) || 'A refined daily ritual', 42),
    subhead: truncate(cleanText(o.subhead) || 'A refined daily ritual, in every cup.', 64),
    bodyText: truncate(cleanText(o.bodyText) || 'Crafted with care, served with ease.', 84),
    imageQueries,
    stockPhotoQueries,
  };
}

function truncate(v: string, max: number): string {
  const s = String(v || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 3)).trimEnd() + '...';
}

function normalizeSkeletonWithContent(
  raw: Record<string, unknown>,
  niche: string,
  category: string,
  width: number,
  height: number
): LlmSkeletonWithContent {
  const designObj = ((raw.design as unknown) ?? {}) as Record<string, unknown>;
  const rawElements = Array.isArray(raw.elements)
    ? raw.elements
    : Array.isArray(designObj.elements)
      ? (designObj.elements as unknown[])
      : [];
  const mapRole = (role: string): LlmSkeletonElement['role'] => {
    const r = role.toUpperCase();
    if (r === 'BODY') return 'BODY_TEXT';
    if (r === 'SUBHEAD') return 'DESCRIPTION';
    if (r === 'PRODUCT_IMAGE') return 'PRODUCT_IMAGE';
    if (r === 'LOGO') return 'LOGO';
    if (r === 'HEADLINE') return 'HEADLINE';
    return 'DECORATIVE';
  };
  const elements: LlmSkeletonElement[] = rawElements
    .map((it, idx) => {
      const o = (it ?? {}) as Record<string, unknown>;
      const type = String(o.type ?? '') as LlmSkeletonElement['type'];
      if (!['text', 'image', 'shape'].includes(type)) return null;
      const role = mapRole(String(o.role ?? 'DECORATIVE'));
      const rect = ((o.rect as unknown) ?? {}) as Record<string, unknown>;
      const pos = ((o.position as unknown) ?? {}) as Record<string, unknown>;
      const dim = ((o.dimensions as unknown) ?? {}) as Record<string, unknown>;
      const px = Number(rect.x ?? pos.x ?? 0);
      const py = Number(rect.y ?? pos.y ?? 0);
      const dw = Number(rect.w ?? dim.w ?? 100);
      const dh = Number(rect.h ?? dim.h ?? 100);
      const styleRaw = o.style && typeof o.style === 'object' ? (o.style as Record<string, unknown>) : {};
      const fontSizeRaw = Number((styleRaw as any)?.fontSize);

      const fontSize = Number.isFinite(fontSizeRaw) && fontSizeRaw > 0 ? fontSizeRaw : undefined;

      let dwFinal = dw;
      let dhFinal = dh;
      if (!Number.isFinite(dwFinal) || dwFinal <= 0) dwFinal = 100;
      if (!Number.isFinite(dhFinal) || dhFinal <= 0) {
        // When the model returns "auto" height, convert to a sensible box.
        // This prevents text from spilling/overlapping because the renderer does not treat "auto" specially.
        if (role === 'HEADLINE') dhFinal = Math.max(45, Math.round((fontSize ?? 40) * 1.4));
        else if (role === 'DESCRIPTION') dhFinal = Math.max(55, Math.round((fontSize ?? 28) * 2.0));
        else if (role === 'BODY_TEXT') dhFinal = Math.max(70, Math.round((fontSize ?? 22) * 2.6));
        else if (role === 'PHONE_NUMBER') dhFinal = Math.max(45, Math.round((fontSize ?? 24) * 1.8));
        else dhFinal = Math.max(55, Math.round((fontSize ?? 20) * 2.0));
      }
      return {
        element_id: String(o.element_id ?? o.id ?? `elem_${idx + 1}`),
        type,
        role,
        position: {
          x: Math.max(0, Math.min(width - 10, px)),
          y: Math.max(0, Math.min(height - 10, py)),
        },
        dimensions: { w: Math.max(20, Math.min(width, dwFinal)), h: Math.max(20, Math.min(height, dhFinal)) },
        style: styleRaw as Record<string, unknown>,
        z_index: Number.isFinite(Number(o.z_index)) ? (Number(o.z_index) as number) : undefined,
        constraints: o.constraints && typeof o.constraints === 'object' ? (o.constraints as any) : undefined,
        textZone: Boolean(o.textZone),
        content_placeholder:
          typeof o.content_placeholder === 'string' && o.content_placeholder.trim()
            ? o.content_placeholder
            : undefined,
      };
    })
    .filter(Boolean) as LlmSkeletonElement[];

  const content = normalizeContentPackage((raw.content as unknown) ?? raw, niche, category);
  const designRaw = ((raw.design as unknown) ?? {}) as Record<string, unknown>;
  const cpRaw = ((designRaw.colorPalette as unknown) ?? {}) as Record<string, unknown>;
  const cpRawAlt = ((designRaw.color_palette as unknown) ?? {}) as Record<string, unknown>;
  const fpRaw = ((designRaw.fontPairing as unknown) ?? {}) as Record<string, unknown>;
  const design: LlmSkeletonWithContent['design'] = {
    designStyle: cleanText(designRaw.designStyle ?? designRaw.name) || 'modern_editorial',
    colorPalette: {
      $VAR_BG_PRIMARY: String(cpRaw.$VAR_BG_PRIMARY ?? cpRawAlt.$VAR_BG ?? '#0F172A'),
      $VAR_BG_SECONDARY: String(cpRaw.$VAR_BG_SECONDARY ?? cpRawAlt.$VAR_BG ?? '#111827'),
      $VAR_PRIMARY: String(cpRaw.$VAR_PRIMARY ?? cpRawAlt.$VAR_PRIMARY ?? '#FFFFFF'),
      $VAR_SECONDARY: String(cpRaw.$VAR_SECONDARY ?? cpRawAlt.$VAR_PRIMARY ?? '#FF6B6B'),
      $VAR_ACCENT: String(cpRaw.$VAR_ACCENT ?? cpRawAlt.$VAR_ACCENT ?? '#FFD93D'),
      $VAR_TEXT_MAIN: String(cpRaw.$VAR_TEXT_MAIN ?? cpRawAlt.$VAR_TEXT_MAIN ?? '#F9FAFB'),
      $VAR_TEXT_SECONDARY: String(cpRaw.$VAR_TEXT_SECONDARY ?? cpRawAlt.$VAR_TEXT_SECONDARY ?? '#FFFFFF'),
    },
    fontPairing: {
      heading: cleanText(fpRaw.heading) || 'Inter',
      body: cleanText(fpRaw.body) || 'Inter',
      accent: cleanText(fpRaw.accent) || undefined,
    },
    backgroundPreference: ['image', 'color', 'gradient'].includes(String(designRaw.backgroundPreference))
      ? (String(designRaw.backgroundPreference) as 'image' | 'color' | 'gradient')
      : 'image',
    logoText: cleanText(designRaw.logoText) || APP_CONFIG.BRAND.DISPLAY_NAME,
  };
  return {
    skeletonName: cleanText(raw.skeletonName) || 'Runtime LLM Skeleton',
    design,
    elements: elements.length > 0 ? elements : [
      {
        element_id: 'fallback-bg',
        type: 'image',
        role: 'BACKGROUND_IMAGE',
        position: { x: 0, y: 0 },
        dimensions: { w: width, h: height },
        style: {},
        textZone: false,
      },
      {
        element_id: 'fallback-title',
        type: 'text',
        role: 'HEADLINE',
        position: { x: 60, y: 80 },
        dimensions: { w: width - 120, h: 120 },
        style: { fontFamily: 'Inter, sans-serif', fontSize: 56, fontWeight: 700, color: '$VAR_TEXT_SECONDARY', alignment: 'left' },
        textZone: true,
      },
    ],
    content,
  };
}

function cleanText(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  // Avoid placeholder-only punctuation like "-" / "—" / "..." etc.
  if (!/[a-z0-9]/i.test(s)) return '';
  return s;
}

function repairJson(input: string): string {
  // Keep this conservative: only fix common non-JSON tokens produced by models.
  // `undefined` is not valid JSON; replace it with null when used as a value.
  return input.replace(/:\s*undefined\b/g, ': null');
}

