/**
 * JWT Implementation
 *
 * Simple JWT sign/verify using Node.js crypto (HMAC-SHA256).
 * No external dependencies required.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  if (pad === 2) padded += '==';
  else if (pad === 3) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf8');
}

function hmacSign(data: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Create a signed JWT token.
 */
export function signToken(
  payload: Record<string, unknown>,
  secret: string,
  expirySeconds: number,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expirySeconds,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = hmacSign(`${headerEncoded}.${payloadEncoded}`, secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Verify a JWT token and return its payload, or null on failure.
 */
export function verifyToken(
  token: string,
  secret: string,
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

  // Verify signature using timing-safe comparison
  const expectedSig = hmacSign(`${headerEncoded}.${payloadEncoded}`, secret);
  const sigBuf = Buffer.from(signatureEncoded, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  // Decode payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded)) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Check expiry
  const exp = payload['exp'];
  if (typeof exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now >= exp) return null;
  }

  return payload;
}
