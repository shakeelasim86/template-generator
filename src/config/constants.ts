export const APP_CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  USE_OPENAI: process.env.USE_OPENAI === 'true',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  DEBUG_PROMPTS: process.env.DEBUG_PROMPTS === 'true',
  KEYS: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
  },
  ASSETS: {
    LOGO_URL: process.env.LOGO_URL || '/assets/konvrt_logo.png',
  },
} as const;

