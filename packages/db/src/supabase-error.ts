type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatSupabaseError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (isPlainObject(error)) {
    const message = error.message;
    const code = error.code;
    const details = error.details;
    const hint = error.hint;
    const parts: string[] = [];

    if (typeof message === "string" && message.trim().length > 0) {
      parts.push(message.trim());
    }
    if (typeof code === "string" && code.trim().length > 0) {
      parts.push(`code=${code.trim()}`);
    }
    if (typeof details === "string" && details.trim().length > 0) {
      parts.push(`details=${details.trim()}`);
    } else if (details !== undefined && details !== null) {
      parts.push(`details=${safeStringify(details)}`);
    }
    if (typeof hint === "string" && hint.trim().length > 0) {
      parts.push(`hint=${hint.trim()}`);
    }

    if (parts.length > 0) {
      return parts.join(" | ");
    }
    return safeStringify(error);
  }

  return String(error);
}

export function throwSupabaseError(error: unknown, context: string): never {
  throw new Error(`${context}: ${formatSupabaseError(error)}`);
}
