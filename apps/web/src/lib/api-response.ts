import { NextResponse } from "next/server";

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    correlationId: string;
    details?: unknown;
  };
  degraded?: boolean;
  degradation?: Record<string, unknown>;
}

interface JsonOptions {
  status?: number;
  correlationId?: string;
}

interface ErrorOptions extends JsonOptions {
  code: string;
  message: string;
  recoverable?: boolean;
  details?: unknown;
  degraded?: boolean;
  degradation?: Record<string, unknown>;
}

export function getCorrelationId(request?: Request): string {
  const incoming = request?.headers.get("x-correlation-id")?.trim();
  if (incoming) {
    return incoming;
  }
  return crypto.randomUUID();
}

function withCorrelationHeader(response: NextResponse, correlationId: string): NextResponse {
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export function jsonSuccess<T>(payload: T, options: JsonOptions = {}): NextResponse {
  const correlationId = options.correlationId ?? crypto.randomUUID();
  const response = NextResponse.json(payload, {
    status: options.status ?? 200,
  });
  return withCorrelationHeader(response, correlationId);
}

export function jsonError(options: ErrorOptions): NextResponse {
  const status = options.status ?? 500;
  const correlationId = options.correlationId ?? crypto.randomUUID();
  const recoverable = options.recoverable ?? status < 500;

  const body: ApiErrorEnvelope = {
    error: {
      code: options.code,
      message: options.message,
      recoverable,
      correlationId,
      details: options.details,
    },
    degraded: options.degraded,
    degradation: options.degradation,
  };

  const response = NextResponse.json(body, { status });
  return withCorrelationHeader(response, correlationId);
}
