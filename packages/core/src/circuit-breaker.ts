/**
 * Reusable circuit breaker for protecting LLM API calls.
 *
 * Pattern: after N consecutive failures, "open" the circuit for a
 * cooldown period. While open, callers skip the protected operation
 * and get an immediate failure signal. A successful call resets the
 * streak and closes the circuit.
 *
 * Used by GoTEngine, ThinkFork, and any engine making Claude API calls
 * that could hit rate limits or transient errors.
 */

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before the circuit opens. Default: 3 */
  failureThreshold?: number;
  /** Cooldown period in ms when the circuit opens. Default: 30_000 */
  cooldownMs?: number;
  /** Name for logging. Default: "circuit" */
  name?: string;
}

export class CircuitBreaker {
  private failureStreak = 0;
  private openUntil = 0;
  readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name ?? "circuit";
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
  }

  /** True when the circuit is open (callers should skip the operation). */
  get isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  /** Milliseconds remaining in the cooldown, or 0 if closed. */
  get remainingCooldownMs(): number {
    return Math.max(0, this.openUntil - Date.now());
  }

  /** Current consecutive failure count. */
  get failures(): number {
    return this.failureStreak;
  }

  /** Record a failure. Opens the circuit after threshold is reached. */
  recordFailure(errorMessage?: string): void {
    this.failureStreak += 1;
    if (this.failureStreak >= this.failureThreshold) {
      this.openUntil = Date.now() + this.cooldownMs;
    }
  }

  /** Record a success. Resets the failure streak and closes the circuit. */
  recordSuccess(): void {
    this.failureStreak = 0;
    this.openUntil = 0;
  }

  /** Reset all state (useful between reasoning sessions). */
  reset(): void {
    this.failureStreak = 0;
    this.openUntil = 0;
  }

  /**
   * Check if a transient-looking error message should count as a
   * circuit-relevant failure. Detects rate limits, overload, and
   * temporary API unavailability.
   */
  static isTransientError(errorMessage: string): boolean {
    const lowered = errorMessage.toLowerCase();
    return (
      lowered.includes("overloaded") ||
      lowered.includes("rate limit") ||
      lowered.includes("429") ||
      lowered.includes("temporarily unavailable") ||
      lowered.includes("503") ||
      lowered.includes("timeout")
    );
  }
}
