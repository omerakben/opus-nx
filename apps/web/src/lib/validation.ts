/**
 * Shared validation utilities for API routes.
 *
 * These utilities provide consistent input validation across the application,
 * particularly for UUID parameters that come from route params or query strings.
 */

/**
 * UUID v4 regex pattern.
 * Matches standard UUID format: 8-4-4-4-12 hex digits with hyphens.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID v4 format.
 *
 * SECURITY: This prevents SQL injection and malformed ID attacks by ensuring
 * only valid UUIDs are passed to database queries.
 *
 * @param value - The string to validate
 * @returns true if the string is a valid UUID, false otherwise
 */
export function isValidUuid(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }
  return UUID_REGEX.test(value);
}

/**
 * Validate a UUID and return it if valid, or null if invalid.
 * Useful for optional UUID parameters.
 *
 * @param value - The string to validate
 * @returns The validated UUID string or null
 */
export function validateUuid(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  return isValidUuid(value) ? value : null;
}

/**
 * Error thrown when UUID validation fails.
 */
export class InvalidUuidError extends Error {
  constructor(paramName: string, value: string) {
    super(`Invalid UUID format for parameter '${paramName}': ${value}`);
    this.name = "InvalidUuidError";
  }
}

/**
 * Validate a UUID and throw if invalid.
 * Useful for required UUID parameters where you want to fail fast.
 *
 * @param value - The string to validate
 * @param paramName - The name of the parameter (for error messages)
 * @returns The validated UUID string
 * @throws InvalidUuidError if the value is not a valid UUID
 */
export function requireValidUuid(value: string, paramName: string): string {
  if (!isValidUuid(value)) {
    throw new InvalidUuidError(paramName, value);
  }
  return value;
}
