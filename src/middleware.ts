import { defineMiddleware } from 'astro:middleware';

// Security headers for all responses
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Clone response to add headers
  const newResponse = new Response(response.body, response);

  // Prevent MIME type sniffing
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  newResponse.headers.set('X-Frame-Options', 'DENY');

  // XSS protection for older browsers
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS - enforce HTTPS for 1 year
  newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Content Security Policy
  // Allows inline scripts (needed for Astro/Svelte), self resources, and specific external resources
  newResponse.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Svelte/Astro needs inline scripts
    "style-src 'self' 'unsafe-inline'", // Tailwind uses inline styles
    "img-src 'self' data: https:", // Allow images from self, data URIs, and HTTPS
    "font-src 'self'",
    "connect-src 'self' https://bankaccountdata.gocardless.com", // Nordigen API
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));

  // Permissions Policy - restrict browser features
  newResponse.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return newResponse;
});
