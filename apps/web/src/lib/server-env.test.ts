import { describe, expect, it } from "vitest";
import { getWorkspaceEnvStatus } from "./server-env";

describe("workspace env status", () => {
  it("returns ok when all required workspace env values exist", () => {
    const status = getWorkspaceEnvStatus({
      ANTHROPIC_API_KEY: "sk-ant-test",
      AUTH_SECRET: "test-secret-123456",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      SUPABASE_ANON_KEY: "anon-key",
    } as unknown as NodeJS.ProcessEnv);

    expect(status.ok).toBe(true);
    expect(status.issues).toEqual([]);
  });

  it("returns issues when required workspace env values are missing", () => {
    const status = getWorkspaceEnvStatus({
      AUTH_SECRET: "test-secret-123456",
    } as unknown as NodeJS.ProcessEnv);

    expect(status.ok).toBe(false);
    expect(status.issues.some((issue) => issue.startsWith("ANTHROPIC_API_KEY"))).toBe(true);
    expect(status.issues.some((issue) => issue.startsWith("SUPABASE_URL"))).toBe(true);
    expect(status.issues.some((issue) => issue.startsWith("SUPABASE_SERVICE_ROLE_KEY"))).toBe(true);
    expect(status.issues.some((issue) => issue.startsWith("SUPABASE_ANON_KEY"))).toBe(true);
  });
});
