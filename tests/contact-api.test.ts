import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/contact';

type Req = Parameters<typeof handler>[0];
type Res = Parameters<typeof handler>[1];

interface FakeRes extends Res {
  status(code: number): FakeRes;
}

interface ResState {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

function createRes(): { res: FakeRes; state: ResState } {
  const state: ResState = { status: 0, body: null, headers: {} };
  const res: FakeRes = {
    status(code) {
      state.status = code;
      return res;
    },
    json(body) {
      state.body = body;
    },
    setHeader(name, value) {
      state.headers[name] = value;
    },
  };
  return { res, state };
}

interface ReqOverrides {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function request(overrides: ReqOverrides = {}): Req {
  return {
    method: 'POST',
    body: { name: 'Ana', email: 'ana@example.com', message: 'Hola, me interesa un proyecto.' },
    headers: { 'x-forwarded-for': '10.0.0.1' },
    ...overrides,
  } as Req;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api/contact', () => {
  it('rechaza métodos que no son POST', async () => {
    const { res, state } = createRes();
    await handler(request({ method: 'GET' }), res);
    expect(state.status).toBe(405);
  });

  it('devuelve 400 con un body de texto que no es JSON', async () => {
    const { res, state } = createRes();
    await handler(request({ body: '{no-json' }), res);
    expect(state.status).toBe(400);
    expect(state.body).toEqual({ ok: false, error: 'invalid_payload' });
  });

  it('rechaza payloads que no pasan el schema (honeypot incluido)', async () => {
    const { res, state } = createRes();
    await handler(
      request({ body: { name: 'A', email: 'no', message: 'corto', company: 'bot' } }),
      res,
    );
    expect(state.status).toBe(400);
  });

  it('acepta un mensaje válido sin proveedor configurado (dev)', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { res, state } = createRes();
    await handler(request({ headers: { 'x-forwarded-for': '10.0.0.2' } }), res);
    expect(state.status).toBe(200);
    expect(state.body).toEqual({ ok: true });
    expect(info).toHaveBeenCalled();
  });

  it('envía con Resend y responde 200', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', fetchMock);
    const { res, state } = createRes();
    await handler(request({ headers: { 'x-forwarded-for': '10.0.0.3' } }), res);
    expect(state.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('responde 502 si el proveedor está configurado y falla', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { res, state } = createRes();
    await handler(request({ headers: { 'x-forwarded-for': '10.0.0.4' } }), res);
    expect(state.status).toBe(502);
    expect(state.body).toEqual({ ok: false, error: 'delivery_failed' });
  });

  it('limita a 5 envíos por minuto y IP', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const headers = { 'x-forwarded-for': '10.9.9.9' };
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const { res, state } = createRes();
      await handler(request({ headers }), res);
      last = state.status;
    }
    expect(last).toBe(429);
  });
});
