import { describe, it, expect } from "vitest";
import { formatSupabaseError, throwSupabaseError } from "./supabase-error.js";

describe("formatSupabaseError", () => {
  it("formats a standard Error", () => {
    expect(formatSupabaseError(new Error("connection refused"))).toBe(
      "connection refused"
    );
  });

  it("formats a Supabase-style error object", () => {
    const err = {
      message: "Row not found",
      code: "PGRST116",
      details: "Results contain 0 rows",
      hint: "Try a different filter",
    };
    const result = formatSupabaseError(err);
    expect(result).toContain("Row not found");
    expect(result).toContain("code=PGRST116");
    expect(result).toContain("details=Results contain 0 rows");
    expect(result).toContain("hint=Try a different filter");
  });

  it("handles object with only message", () => {
    expect(formatSupabaseError({ message: "simple" })).toBe("simple");
  });

  it("handles object with non-string details", () => {
    const err = { message: "failed", details: { nested: true } };
    const result = formatSupabaseError(err);
    expect(result).toContain("failed");
    expect(result).toContain('details={"nested":true}');
  });

  it("falls back to JSON for unknown objects", () => {
    const err = { custom: "data" };
    expect(formatSupabaseError(err)).toBe('{"custom":"data"}');
  });

  it("stringifies primitives", () => {
    expect(formatSupabaseError(42)).toBe("42");
    expect(formatSupabaseError(null)).toBe("null");
    expect(formatSupabaseError(undefined)).toBe("undefined");
  });

  it("handles Error with empty message", () => {
    const err = new Error("");
    // Empty message falls through to object check
    const result = formatSupabaseError(err);
    expect(typeof result).toBe("string");
  });
});

describe("throwSupabaseError", () => {
  it("throws an Error with context prefix", () => {
    expect(() => throwSupabaseError(new Error("oops"), "create failed")).toThrow(
      "create failed: oops"
    );
  });

  it("throws an Error with formatted object", () => {
    expect(() =>
      throwSupabaseError({ message: "not found", code: "PGRST116" }, "get")
    ).toThrow("get: not found | code=PGRST116");
  });
});
