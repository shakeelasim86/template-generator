export const APP_CONFIG = {
  PORT: 3000,
  USE_OPENAI: false,
  OPENAI_MODEL: 'gpt-4.1-mini',
  GEMINI_MODEL: 'gemini-2.5-flash',
  DEBUG_PROMPTS: true,
  KEYS: {
    GEMINI_API_KEY: 'AIzaSyAv1cjuA4OSuxMHZaOaLjye2-bhXHcPTqA',
    OPENAI_API_KEY:
      'Key Here',
    PEXELS_API_KEY: 'gn8qMqn2fAQIeEtLliNRHfFTJSixPdDjN4sD2P3GPSPLm7xtnGQGYVGp',
  },
  ASSETS: {
    LOGO_URL: '/assets/konvrt_logo.png',
  },
} as const;

