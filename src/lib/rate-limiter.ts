// Rate limiting configuration
const RATE_LIMITS = {
  login: {
    ip: { maxAttempts: 10, windowMinutes: 15 },
    email: { maxAttempts: 5, windowMinutes: 60 }
  },
  register: {
    ip: { maxAttempts: 5, windowMinutes: 60 }
  },
  'forgot-password': {
    ip: { maxAttempts: 3, windowMinutes: 60 },
    email: { maxAttempts: 3, windowMinutes: 60 }
  }
} as const;

export type Endpoint = keyof typeof RATE_LIMITS;

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
}

// Extract IP address from request
export function getClientIP(request: Request): string {
  // Cloudflare provides the real IP in CF-Connecting-IP header
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // Fallback to X-Forwarded-For
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // Default fallback
  return 'unknown';
}

// Check rate limit and increment attempt counter
export async function checkRateLimit(
  db: D1Database,
  endpoint: Endpoint,
  ip: string,
  email?: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpoint];
  const now = new Date();

  // Check IP rate limit
  if ('ip' in config) {
    const ipResult = await checkKey(db, endpoint, ip, 'ip', config.ip, now);
    if (!ipResult.allowed) {
      return ipResult;
    }
  }

  // Check email rate limit (if applicable)
  if (email && 'email' in config) {
    const emailConfig = (config as any).email;
    const emailResult = await checkKey(db, endpoint, email.toLowerCase(), 'email', emailConfig, now);
    if (!emailResult.allowed) {
      return emailResult;
    }
  }

  return { allowed: true };
}

async function checkKey(
  db: D1Database,
  endpoint: Endpoint,
  key: string,
  keyType: 'ip' | 'email',
  config: { maxAttempts: number; windowMinutes: number },
  now: Date
): Promise<RateLimitResult> {
  const windowStart = new Date(now.getTime() - config.windowMinutes * 60 * 1000);

  // Get current rate limit record
  const record = await db.prepare(`
    SELECT attempts, first_attempt_at, blocked_until
    FROM rate_limits
    WHERE key = ? AND key_type = ? AND endpoint = ?
  `).bind(key, keyType, endpoint).first<{
    attempts: number;
    first_attempt_at: string;
    blocked_until: string | null;
  }>();

  // Check if currently blocked
  if (record?.blocked_until) {
    const blockedUntil = new Date(record.blocked_until);
    if (blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfterSeconds };
    }
  }

  // Check if window expired (reset counter)
  if (record) {
    const firstAttempt = new Date(record.first_attempt_at);
    if (firstAttempt < windowStart) {
      // Window expired, reset
      await db.prepare(`
        UPDATE rate_limits
        SET attempts = 1, first_attempt_at = datetime('now'), last_attempt_at = datetime('now'), blocked_until = NULL
        WHERE key = ? AND key_type = ? AND endpoint = ?
      `).bind(key, keyType, endpoint).run();
      return { allowed: true, remaining: config.maxAttempts - 1 };
    }
  }

  // Check if limit exceeded
  if (record && record.attempts >= config.maxAttempts) {
    // Block for the remaining window time
    const firstAttempt = new Date(record.first_attempt_at);
    const blockUntil = new Date(firstAttempt.getTime() + config.windowMinutes * 60 * 1000);
    const retryAfterSeconds = Math.ceil((blockUntil.getTime() - now.getTime()) / 1000);

    // Update blocked_until
    await db.prepare(`
      UPDATE rate_limits
      SET blocked_until = ?, last_attempt_at = datetime('now')
      WHERE key = ? AND key_type = ? AND endpoint = ?
    `).bind(blockUntil.toISOString(), key, keyType, endpoint).run();

    return { allowed: false, retryAfterSeconds };
  }

  // Increment attempt counter or create new record
  if (record) {
    await db.prepare(`
      UPDATE rate_limits
      SET attempts = attempts + 1, last_attempt_at = datetime('now')
      WHERE key = ? AND key_type = ? AND endpoint = ?
    `).bind(key, keyType, endpoint).run();
    return { allowed: true, remaining: config.maxAttempts - record.attempts - 1 };
  } else {
    await db.prepare(`
      INSERT INTO rate_limits (key, key_type, endpoint, attempts, first_attempt_at, last_attempt_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).bind(key, keyType, endpoint).run();
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }
}

// Reset rate limit on successful login
export async function resetRateLimit(
  db: D1Database,
  endpoint: Endpoint,
  ip: string,
  email?: string
): Promise<void> {
  // Delete rate limit records for successful auth
  await db.prepare(`
    DELETE FROM rate_limits
    WHERE endpoint = ? AND (
      (key = ? AND key_type = 'ip')
      ${email ? "OR (key = ? AND key_type = 'email')" : ''}
    )
  `).bind(endpoint, ip, ...(email ? [email.toLowerCase()] : [])).run();
}

// Cleanup old rate limit records (call periodically)
export async function cleanupRateLimits(db: D1Database): Promise<void> {
  // Delete records older than 24 hours
  await db.prepare(`
    DELETE FROM rate_limits
    WHERE last_attempt_at < datetime('now', '-24 hours')
  `).run();
}

// Generate rate limit error response
export function rateLimitResponse(retryAfterSeconds: number): Response {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return new Response(JSON.stringify({
    error: `Troppi tentativi. Riprova tra ${minutes} minuto${minutes > 1 ? 'i' : ''}.`
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds)
    }
  });
}
