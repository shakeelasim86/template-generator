/**
 * Express server: POST /api/generate and static frontend.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { generateVariations, generateVariationsStream } from './engine/generateVariations.js';
import type { GenerateVariationsInput } from './types/schema.js';
import { APP_CONFIG } from './config/constants.js';

const app = express();
const PORT = APP_CONFIG.PORT;

app.use(cors());
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  try {
    const body = req.body as Partial<GenerateVariationsInput>;
    const niche = String(body.niche ?? '').trim();
    const category = String(body.category ?? 'Social').trim();
    const count = Math.min(30, Math.max(1, Number(body.count) ?? 2));
    const target_platform =
      body.target_platform === 'facebook_post' || body.target_platform === 'pinterest_post' || body.target_platform === 'instagram_post'
        ? body.target_platform
        : 'instagram_post';
    if (!niche) {
      res.status(400).json({ error: 'niche is required' });
      return;
    }
    const template_scope =
      body.template_scope === 'strict' || body.template_scope === 'universal' ? body.template_scope : undefined;

    const input: GenerateVariationsInput = {
      niche,
      category,
      count,
      target_platform,
      marketing_goal: body.marketing_goal,
      brand_name: body.brand_name,
      visual_style: body.visual_style,
      tone: body.tone,
      template_scope,
      brand_assets: body.brand_assets,
    };
    const templates = await generateVariations(input);
    res.json({ templates });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const isQuota =
      rawMessage.includes('429') ||
      rawMessage.includes('RESOURCE_EXHAUSTED') ||
      rawMessage.includes('quota') ||
      rawMessage.includes('Quota exceeded');
    if (isQuota) {
      res.status(429).json({
        error: 'Generation is temporarily unavailable.',
        code: 'QUOTA_EXCEEDED',
        message:
          "The Gemini API hit a rate or daily quota (free tier is often 20 requests/day per model). Wait and retry or add billing in Google AI Studio for higher limits.",
      });
      return;
    }
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error && typeof err.cause === 'string'
          ? err.cause
          : undefined;
    res.status(500).json({
      error: rawMessage || 'Generation failed',
      ...(cause ? { detail: cause } : {}),
    });
  }
});

// Progressive streaming: emits templates one-by-one via Server-Sent Events (SSE).
app.get('/api/generate/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Best-effort: some proxies buffer unless we send a first byte quickly
  res.write('event: ready\ndata: {}\n\n');

  const close = () => {
    try {
      res.write('event: done\ndata: {}\n\n');
    } catch (_) {}
    res.end();
  };
  req.on('close', close);

  try {
    const niche = String(req.query.niche ?? '').trim();
    const category = String(req.query.category ?? 'Social').trim();
    const count = Math.min(30, Math.max(1, Number(req.query.count) ?? 2));
    const target_platform =
      req.query.target_platform === 'facebook_post' ||
      req.query.target_platform === 'pinterest_post' ||
      req.query.target_platform === 'instagram_post'
        ? (req.query.target_platform as GenerateVariationsInput['target_platform'])
        : 'instagram_post';

    if (!niche) {
      res.write(`event: generation_error\ndata: ${JSON.stringify({ error: 'niche is required' })}\n\n`);
      close();
      return;
    }

    const template_scope =
      req.query.template_scope === 'strict' || req.query.template_scope === 'universal'
        ? (req.query.template_scope as GenerateVariationsInput['template_scope'])
        : undefined;

    const input: GenerateVariationsInput = {
      niche,
      category,
      count,
      target_platform,
      marketing_goal: typeof req.query.marketing_goal === 'string' ? req.query.marketing_goal : undefined,
      brand_name: typeof req.query.brand_name === 'string' ? req.query.brand_name : undefined,
      visual_style: typeof req.query.visual_style === 'string' ? req.query.visual_style : undefined,
      tone: typeof req.query.tone === 'string' ? req.query.tone : undefined,
      template_scope,
    };

    await generateVariationsStream(input, (template, index, total) => {
      res.write(
        `event: template\ndata: ${JSON.stringify({ template, index, total })}\n\n`,
      );
    });

    close();
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error && typeof err.cause === 'string'
          ? err.cause
          : undefined;
    const combined = [rawMessage, cause].filter(Boolean).join(' ');
    const isQuota =
      combined.includes('429') ||
      combined.includes('RESOURCE_EXHAUSTED') ||
      combined.includes('quota') ||
      combined.includes('Quota exceeded');
    if (isQuota) {
      res.write(
        `event: generation_error\ndata: ${JSON.stringify({
          error: 'Generation is temporarily unavailable (API quota).',
          code: 'QUOTA_EXCEEDED',
          message:
            'Gemini returned a rate or daily quota limit (free tier is limited per model per day). Wait and retry or enable billing in Google AI Studio.',
          detail: rawMessage,
        })}\n\n`,
      );
    } else {
      res.write(
        `event: generation_error\ndata: ${JSON.stringify({
          error: rawMessage || 'Generation failed',
          ...(cause ? { detail: cause } : {}),
        })}\n\n`,
      );
    }
    close();
  }
});

const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));
app.use('/assets', express.static(path.join(process.cwd(), 'src/engine')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Template Generator running at http://localhost:${PORT}`);
});
