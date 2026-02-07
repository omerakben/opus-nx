import { createHmac } from "crypto";

/**
 * Generate an HMAC-SHA256 signature for the auth cookie value.
 * Shared across auth, demo, and seed routes.
 */
export function generateAuthSignature(secret: string): string {
  return createHmac("sha256", secret)
    .update("opus-nx-authenticated")
    .digest("hex");
}

/**
 * Verify a cookie value matches the expected HMAC signature
 * using timing-safe comparison.
 */
export function verifyAuthSignature(
  cookieValue: string,
  secret: string
): boolean {
  const expected = generateAuthSignature(secret);
  if (cookieValue.length !== expected.length) return false;

  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    mismatch |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
