import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker } from "./circuit-breaker.js";

describe("CircuitBreaker", () => {
  describe("constructor", () => {
    it("creates with default options", () => {
      const cb = new CircuitBreaker();
      expect(cb.name).toBe("circuit");
      expect(cb.isOpen).toBe(false);
      expect(cb.failures).toBe(0);
    });

    it("accepts custom options", () => {
      const cb = new CircuitBreaker({
        name: "api-calls",
        failureThreshold: 5,
        cooldownMs: 60_000,
      });
      expect(cb.name).toBe("api-calls");
    });
  });

  describe("closed state", () => {
    it("starts closed", () => {
      const cb = new CircuitBreaker();
      expect(cb.isOpen).toBe(false);
      expect(cb.remainingCooldownMs).toBe(0);
    });

    it("stays closed below failure threshold", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      cb.recordFailure("error 1");
      cb.recordFailure("error 2");
      expect(cb.isOpen).toBe(false);
      expect(cb.failures).toBe(2);
    });
  });

  describe("opening", () => {
    it("opens after reaching failure threshold", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 30_000 });
      cb.recordFailure("err 1");
      cb.recordFailure("err 2");
      cb.recordFailure("err 3");
      expect(cb.isOpen).toBe(true);
      expect(cb.remainingCooldownMs).toBeGreaterThan(0);
      expect(cb.remainingCooldownMs).toBeLessThanOrEqual(30_000);
    });

    it("opens with threshold of 1", () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      cb.recordFailure();
      expect(cb.isOpen).toBe(true);
    });
  });

  describe("closing via success", () => {
    it("resets failure streak on success", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.failures).toBe(2);

      cb.recordSuccess();
      expect(cb.failures).toBe(0);
      expect(cb.isOpen).toBe(false);
    });

    it("closes an open circuit on success", () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen).toBe(true);

      cb.recordSuccess();
      expect(cb.isOpen).toBe(false);
      expect(cb.remainingCooldownMs).toBe(0);
    });
  });

  describe("reset()", () => {
    it("resets all state", () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen).toBe(true);

      cb.reset();
      expect(cb.isOpen).toBe(false);
      expect(cb.failures).toBe(0);
      expect(cb.remainingCooldownMs).toBe(0);
    });
  });

  describe("cooldown expiry", () => {
    it("closes after cooldown period", () => {
      vi.useFakeTimers();
      try {
        const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 5_000 });
        cb.recordFailure();
        expect(cb.isOpen).toBe(true);

        vi.advanceTimersByTime(4_999);
        expect(cb.isOpen).toBe(true);

        vi.advanceTimersByTime(2);
        expect(cb.isOpen).toBe(false);
        expect(cb.remainingCooldownMs).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("isTransientError()", () => {
    it("detects rate limit errors", () => {
      expect(CircuitBreaker.isTransientError("Rate limit exceeded")).toBe(true);
      expect(CircuitBreaker.isTransientError("Error 429: too many requests")).toBe(true);
    });

    it("detects overloaded errors", () => {
      expect(CircuitBreaker.isTransientError("Server is overloaded")).toBe(true);
    });

    it("detects temporary unavailability", () => {
      expect(CircuitBreaker.isTransientError("Service temporarily unavailable")).toBe(true);
      expect(CircuitBreaker.isTransientError("503 Service Unavailable")).toBe(true);
    });

    it("detects timeout errors", () => {
      expect(CircuitBreaker.isTransientError("Request timeout after 30s")).toBe(true);
    });

    it("does not flag permanent errors", () => {
      expect(CircuitBreaker.isTransientError("Invalid API key")).toBe(false);
      expect(CircuitBreaker.isTransientError("Permission denied")).toBe(false);
      expect(CircuitBreaker.isTransientError("Model not found")).toBe(false);
    });
  });

  describe("re-opening after cooldown", () => {
    it("can open again after auto-closing and hitting threshold again", () => {
      vi.useFakeTimers();
      try {
        const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000 });

        // First open
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.isOpen).toBe(true);

        // Wait for cooldown
        vi.advanceTimersByTime(1_001);
        expect(cb.isOpen).toBe(false);

        // Failures still accumulated — next failure reopens
        cb.recordFailure();
        expect(cb.isOpen).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
