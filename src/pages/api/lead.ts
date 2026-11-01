import type { APIRoute } from 'astro';
import { handleLead } from '../../lib/lead-handler';
import { createRateLimiter } from '../../lib/rate-limit';

export const prerender = false;

// 5 заявок за 10 минут с одного IP (spec: lead-capture); LEAD_RATE_LIMIT — только для тестов
const limiter = createRateLimiter({ limit: Number(process.env.LEAD_RATE_LIMIT) || 5, windowMs: 10 * 60_000 });

function clientIp(request: Request, clientAddress: () => string): string {
  if (process.env.TRUST_PROXY === '1') {
    const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (fwd) return fwd;
  }
  try {
    return clientAddress();
  } catch {
    return 'unknown';
  }
}

// ctx.clientAddress — геттер, который бросает исключение, если адрес недоступен
export const POST: APIRoute = (ctx) =>
  handleLead(ctx.request, clientIp(ctx.request, () => ctx.clientAddress), { env: process.env, limiter });

export const ALL: APIRoute = () =>
  new Response(null, { status: 405, headers: { allow: 'POST' } });
