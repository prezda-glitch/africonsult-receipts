// Vercel Serverless Function: /api/ocr
// Proxies receipt images to Anthropic Claude Vision API
// API key stays server-side, never exposed to client

const CATS = [
  'Fuel & transport', 'Equipment', 'Office supplies',
  'Meals & entertainment', 'Services', 'Rent & utilities',
  'Professional fees', 'Travel', 'Insurance', 'Other',
];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mediaType } = req.body;
  if (!image || !mediaType) return res.status(400).json({ error: 'Missing image or mediaType' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: image },
              },
              {
                type: 'text',
                text: `You are an OCR engine for Tanzanian business receipts and EFD receipts. Extract data as JSON only with no markdown fences or explanation. Fields: vendor (string), amount (number total in TZS), date (YYYY-MM-DD), vat_amount (number if visible), efd_no (string EFD receipt number if visible), category (one of: ${CATS.join(', ')}), description (brief). Use null for missing fields. Return ONLY the JSON object.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'OCR service unavailable' });
    }

    const data = await response.json();
    const text = data.content?.map((c) => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (e) {
    console.error('OCR processing error:', e);
    return res.status(500).json({ error: 'Failed to process receipt' });
  }
}
