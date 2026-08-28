// src/pages/api/ocr.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

type Annotation = {
  description?: string;
  boundingPoly?: { vertices?: { x?: number; y?: number }[] };
};
type Data = { text?: string; annotations?: Annotation[]; error?: string };

async function createFormParser(opts = { multiples: false }) {
  // dynamic import so bundler doesn't try to eagerly resolve the package at build time
  const pkg = await import('formidable').catch((e) => {
    // If import failed, rethrow with helpful message
    throw new Error('Failed to import formidable: ' + String(e));
  });

  // pkg may be { default: [Function] } or the function itself or module with IncomingForm constructor
  const mod: any = (pkg && pkg.default) ? pkg.default : pkg;

  // If mod is a function (factory style), call it:
  if (typeof mod === 'function') {
    try {
      return mod(opts);
    } catch (e) {
      // continue to other strategies
    }
  }

  // If mod.IncomingForm exists as a constructor, use that:
  if (mod && typeof mod.IncomingForm === 'function') {
    return new mod.IncomingForm(opts);
  }

  // Fallback: if the module itself has parse method
  if (mod && typeof mod.parse === 'function') {
    return mod;
  }

  throw new Error('Unsupported formidable export shape. Upgrade/downgrade formidable or adjust parser code.');
}

function parseForm(req: NextApiRequest) {
  return new Promise<{ fields: any; files: any }>(async (resolve, reject) => {
    try {
      const form = await createFormParser({ multiples: false });

      // If form has parse as function (the normal API)
      if (typeof (form as any).parse === 'function') {
        (form as any).parse(req, (err: any, fields: any, files: any) => {
          if (err) return reject(err);
          resolve({ fields, files });
        });
        return;
      }

      // If we reach here, we couldn't find a parse function
      reject(new Error('formidable parser does not provide parse(req, cb)'));
    } catch (err) {
      reject(err);
    }
  });
}

// --- Google AI Studio (Gemini API) OCR call ---
// Get a key from https://aistudio.google.com/apikey and set it as
// GEMINI_API_KEY (or GOOGLE_API_KEY) in your .env.local file.
const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGeminiOcr(base64Image: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Get a key from https://aistudio.google.com/apikey and add it to .env.local'
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          {
            text:
              'Extract ALL visible text from this product label image, exactly as it appears, ' +
              'preserving line breaks between distinct pieces of text. ' +
              'Return ONLY the raw extracted text — no commentary, no markdown formatting, no code fences.',
          },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${t}`);
  }

  const json = await res.json();
  return json;
}

function extractTextFromGeminiResponse(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { files } = await parseForm(req);
    // formidable v3 always returns files as arrays (files.image => [File]),
    // regardless of the `multiples` option, so normalize before use.
    const rawImage = (files as any).image;
    const imageFile = Array.isArray(rawImage) ? rawImage[0] : rawImage;
    if (!imageFile) {
      res.status(400).json({ error: 'No image uploaded' });
      return;
    }

    const filepath = imageFile.filepath || imageFile.path;
    if (!filepath) {
      res.status(500).json({ error: 'Uploaded file could not be located on disk' });
      return;
    }

    const buffer = fs.readFileSync(filepath);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.mimetype || imageFile.type || 'image/jpeg';

    const geminiResp = await callGeminiOcr(base64Image, mimeType);
    const fullText = extractTextFromGeminiResponse(geminiResp);

    // Gemini's generateContent doesn't return per-word bounding boxes the way
    // Cloud Vision's TEXT_DETECTION does, so there are no overlay annotations here.
    // The frontend already handles an empty annotations array gracefully.
    res.status(200).json({ text: fullText, annotations: [] });
  } catch (err: any) {
    // Log server-side
    console.error('ocr api error:', err && err.stack ? err.stack : err);
    // Respond with JSON so client won't try to parse HTML
    res.status(500).json({ error: err?.message ?? 'OCR processing error' });
  }
}
