import { describe, expect, it } from "vitest";
import {
  isPublicApiPath,
  isPublicPath,
  requiresAuthentication,
} from "./route-auth";

describe("route auth policy", () => {
  it("keeps public routes accessible", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/share/token-123")).toBe(true);
    expect(isPublicPath("/api/auth")).toBe(true);
    expect(isPublicPath("/api/demo")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/favicon.ico")).toBe(true);
  });

  it("marks non-public API routes as protected", () => {
    expect(isPublicApiPath("/api/auth/logout")).toBe(true);
    expect(isPublicApiPath("/api/thinking")).toBe(false);
    expect(requiresAuthentication("/api/thinking")).toBe(true);
    expect(requiresAuthentication("/api/swarm/token")).toBe(true);
  });

  it("protects workspace routes only", () => {
    expect(requiresAuthentication("/workspace")).toBe(true);
    expect(requiresAuthentication("/workspace/something")).toBe(true);
    expect(requiresAuthentication("/")).toBe(false);
    expect(requiresAuthentication("/random-page")).toBe(false);
  });
});
