// Rate limiting best-effort em memória por instância serverless.
// Não substitui proteção de borda (Vercel/Cloudflare), mas freia abuso
// autenticado e enumeração dentro de cada instância.

const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 120; // requisições por minuto por usuário+rota
const MAX_KEYS = 10_000;

export function consumeRateLimit(key: string, limit = LIMIT, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (buckets.size > MAX_KEYS) {
    for (const [k, stamps] of buckets) {
      const fresh = stamps.filter((t) => t > cutoff);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
    }
  }

  const stamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (stamps.length >= limit) {
    buckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  buckets.set(key, stamps);
  return true;
}
