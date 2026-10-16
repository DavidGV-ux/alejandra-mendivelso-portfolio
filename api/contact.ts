import { z } from 'zod';

interface ApiRequest {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const payloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(4000),
  // Honeypot: si viene relleno, es un bot.
  company: z.string().max(0).optional(),
});

const RATE_LIMIT = 5;
const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 1000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size >= MAX_TRACKED_IPS) {
    for (const [key, timestamps] of hits) {
      if (timestamps.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

function clientIp(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]!.trim();
  if (Array.isArray(forwarded)) return forwarded[0] ?? 'unknown';
  return 'unknown';
}

async function sendWithResend(apiKey: string, data: z.infer<typeof payloadSchema>): Promise<boolean> {
  const from = process.env.CONTACT_FROM ?? 'Portafolio <onboarding@resend.dev>';
  const to = process.env.CONTACT_TO ?? 'hola@alejandramendivelso.com';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: data.email,
        subject: `Nuevo mensaje de ${data.name}`,
        text: `Nombre: ${data.name}\nCorreo: ${data.email}\n\n${data.message}`,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error('[contact] Resend error', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[contact] Resend unreachable', error);
    return false;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }

  let payload: unknown;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ ok: false, error: 'invalid_payload' });
    return;
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_payload' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Sin proveedor configurado: no fallamos al usuario en desarrollo.
    console.info('[contact] Mensaje recibido (sin RESEND_API_KEY):', {
      name: parsed.data.name,
      email: parsed.data.email,
    });
    res.status(200).json({ ok: true });
    return;
  }

  const delivered = await sendWithResend(apiKey, parsed.data);
  if (!delivered) {
    res.status(502).json({ ok: false, error: 'delivery_failed' });
    return;
  }

  res.status(200).json({ ok: true });
}
