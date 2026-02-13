import { describe, expect, it } from "vitest";
import {
  isPublicApiPath,
  isPublicPath,
  isStaticAssetPath,
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

  it("treats static assets as public", () => {
    expect(requiresAuthentication("/_next/static/chunks/main.js")).toBe(false);
    expect(requiresAuthentication("/icon.svg")).toBe(false);
    expect(requiresAuthentication("/favicon.ico")).toBe(false);
    expect(requiresAuthentication("/favicon.png")).toBe(false);
  });

  it("protects nested workspace routes", () => {
    expect(requiresAuthentication("/workspace/sessions/123")).toBe(true);
    expect(requiresAuthentication("/workspace/settings")).toBe(true);
  });

  it("treats public API sub-routes correctly", () => {
    expect(isPublicApiPath("/api/auth/logout")).toBe(true);
    expect(isPublicApiPath("/api/demo/something")).toBe(true);
    expect(isPublicApiPath("/api/health")).toBe(true);
    expect(isPublicApiPath("/api/sessions")).toBe(false);
    expect(isPublicApiPath("/api/swarm/token")).toBe(false);
  });

  it("handles share paths with any token", () => {
    expect(isPublicPath("/share/abc-123")).toBe(true);
    expect(isPublicPath("/share/any-token-here")).toBe(true);
    expect(requiresAuthentication("/share/xyz")).toBe(false);
  });

  it("identifies static asset paths", () => {
    expect(isStaticAssetPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isStaticAssetPath("/favicon.ico")).toBe(true);
    expect(isStaticAssetPath("/icon.svg")).toBe(true);
    expect(isStaticAssetPath("/api/auth")).toBe(false);
    expect(isStaticAssetPath("/workspace")).toBe(false);
  });
});
