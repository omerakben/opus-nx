import {
  getWorkspaceEnvIssues,
  loadWorkspaceEnv,
  type WorkspaceEnv,
} from "@opus-nx/shared";

let cachedWorkspaceEnv: WorkspaceEnv | null = null;

export interface WorkspaceEnvStatus {
  ok: boolean;
  issues: string[];
}

export function getWorkspaceEnvStatus(
  env: NodeJS.ProcessEnv = process.env
): WorkspaceEnvStatus {
  const issues = getWorkspaceEnvIssues(env);
  return {
    ok: issues.length === 0,
    issues,
  };
}

export function ensureWorkspaceEnv(): WorkspaceEnv {
  if (cachedWorkspaceEnv) {
    return cachedWorkspaceEnv;
  }

  cachedWorkspaceEnv = loadWorkspaceEnv();
  return cachedWorkspaceEnv;
}

// Backward compatibility for existing imports.
export const ensureServerEnv = ensureWorkspaceEnv;
