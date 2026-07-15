/**
 * RATE LIMITER simples em memória para proteção de endpoints críticos.
 *
 * Janela deslizante: N requisições por IP em windowMs milissegundos.
 * Usa Map<string, number[]> (timestamps). Autodepura entradas antigas a cada 60s.
 *
 * Nota: em ambiente multi-instancia eventual, cada pod terá seu próprio cache.
 * Para SaaS de médio porte isso é suficiente. Para porte grande, usar Redis.
 */

const store = new Map<string, number[]>();

// Limpa entradas expiradas a cada 60 segundos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store) {
      const filtered = timestamps.filter(t => now - t < 600_000); // mantém 10 min
      if (filtered.length === 0) store.delete(key);
      else store.set(key, filtered);
    }
  }, 60_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Verifica se uma requisição está dentro do limite.
 * @param key  Chave única (ex: `login:${ip}`)
 * @param maxRequests  Número máximo de requisições na janela
 * @param windowMs  Tamanho da janela em milissegundos
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const timestamps = (store.get(key) || []).filter(t => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    store.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, remaining: maxRequests - timestamps.length, retryAfterMs: 0 };
}

/**
 * Extrai IP do request de forma compatível com reverse proxy.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}
