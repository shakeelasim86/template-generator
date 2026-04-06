/**
 * Upload / external payload: strict snake_case template JSON (see strictTemplateJson.ts).
 */

import type { GeneratedTemplate } from '../types/schema.js';
import { toStrictSnakeTemplate } from './strictTemplateJson.js';

export function mapTemplateToUploadJson(t: unknown): Record<string, unknown> {
  return toStrictSnakeTemplate(t as GeneratedTemplate);
}
