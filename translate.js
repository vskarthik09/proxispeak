import { Router } from 'express';

const router = Router();

const MAX_TEXT_LENGTH = 4000;
const REQUEST_TIMEOUT = 10000;

router.post('/', async (req, res) => {
  const { text, target, source = 'auto' } = req.body || {};

  // 1. Validate input
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      message: 'Valid text is required.'
    });
  }

  if (typeof target !== 'string' || !/^[a-zA-Z-]{2,10}$/.test(target)) {
    return res.status(400).json({
      message: 'Valid target language is required.'
    });
  }

  if (source !== 'auto' &&
      (typeof source !== 'string' || !/^[a-zA-Z-]{2,10}$/.test(source))) {
    return res.status(400).json({
      message: 'Invalid source language.'
    });
  }

  const providerUrl = process.env.LIBRETRANSLATE_URL;

  // 2. Check provider configuration
  if (!providerUrl) {
    return res.status(503).json({
      message: 'Translation provider is not configured.'
    });
  }

  // 3. Limit input length
  const cleanText = text.trim().slice(0, MAX_TEXT_LENGTH);

  // 4. Setup request timeout
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    // 5. Call LibreTranslate API
    const response = await fetch(
      `${providerUrl.replace(/\/+$/, '')}/translate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          q: cleanText,
          source,
          target,
          format: 'text',
          ...(process.env.LIBRETRANSLATE_API_KEY && {
            api_key: process.env.LIBRETRANSLATE_API_KEY
          })
        })
      }
    );

    // 6. Handle provider response
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(502).json({
        message: data.error || 'Translation service error.'
      });
    }

    if (typeof data.translatedText !== 'string') {
      return res.status(502).json({
        message: 'Invalid translation response.'
      });
    }

    // 7. Return translated result
    return res.status(200).json({
      success: true,
      source,
      target,
      translatedText: data.translatedText
    });

  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({
        message: 'Translation request timed out.'
      });
    }

    console.error('Translation API error:', error.message);

    return res.status(502).json({
      message: 'Could not reach translation provider.'
    });

  } finally {
    clearTimeout(timeout);
  }
});

export default router;
