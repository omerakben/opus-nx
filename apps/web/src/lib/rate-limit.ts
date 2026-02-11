/**
 * Simple in-memory rate limiter for hackathon demo.
 * For production, use Redis-backed limiter or Vercel's built-in rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check if a request is allowed under rate limits.
 * Uses IP address as key (falls back to "unknown" if not available).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `rate:${identifier}`;

  let entry = store.get(key);

  // Reset if window expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  entry.count++;
  store.set(key, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/** Pre-configured rate limits for different route categories. */
export const RATE_LIMITS = {
  /** Auth: strict to prevent brute-force (5 attempts per 15 min) */
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 } satisfies RateLimitConfig,
  /** Expensive AI routes: moderate (10 requests per minute) */
  ai: { windowMs: 60 * 1000, maxRequests: 10 } satisfies RateLimitConfig,
  /** Swarm: tighter since it fans out to multiple agents (5 per minute) */
  swarm: { windowMs: 60 * 1000, maxRequests: 5 } satisfies RateLimitConfig,
} as const;

/**
 * Apply rate limiting to a request. Returns a 429 Response if the limit
 * is exceeded, or null if the request is allowed.
 */
export function applyRateLimit(
  request: Request,
  routeKey: string,
  config: RateLimitConfig
): Response | null {
  const ip = getClientIP(request);
  const result = checkRateLimit(`${routeKey}:${ip}`, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          recoverable: true,
          correlationId: request.headers.get("x-correlation-id") ?? "unknown",
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetTime),
        },
      }
    );
  }

  return null;
}

/**
 * Extract client IP from request headers.
 * Works with Vercel, Cloudflare, and other proxies.
 */
export function getClientIP(request: Request): string {
  // Vercel
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Real IP header
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp;
  }

  return "unknown";
}
