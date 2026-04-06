export const APP_CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  DEBUG_PROMPTS: process.env.DEBUG_PROMPTS === 'true',
  /** Fixed product branding for generated templates (copy + logo treatment). */
  BRAND: {
    DISPLAY_NAME: 'Konvrt ai',
    CONTACT_EMAIL: 'hello@konvrtai.com',
    WEBSITE_URL: 'https://konvrtai.com',
  },
  KEYS: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
  },
  /** Template upload API (server-side only; never exposed to the browser). */
  UPLOAD_TEMPLATE: {
    API_URL: (process.env.UPLOAD_TEMPLATE_API || 'https://social.kualitech.io/templates/').trim(),
    BEARER_TOKEN: (process.env.UPLOAD_TEMPLATE_BEARER_TOKEN || '').trim(),
  },
  ASSETS: {
    LOGO_URL: process.env.LOGO_URL || '/assets/konvrt_logo.png',
    /** Fixed render box for LOGO image layers in emitted templates (height +15 vs prior 120). */
    LOGO_TEMPLATE_WIDTH_PX: 240,
    LOGO_TEMPLATE_HEIGHT_PX: 135,
  },
} as const;

