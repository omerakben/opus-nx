"use client";

import { Brain, GithubIcon, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  isMobile?: boolean;
}

export function Header({ isMobile }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (isMobile) {
    return (
      <header className="h-12 border-b border-[var(--border)] bg-[var(--card)] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base text-[var(--foreground)]">
            Opus Nx
          </span>
        </div>

        <div className="flex items-center gap-1">
          <a
            href="https://github.com/omerakben/opus-nx"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
            title="View on GitHub"
          >
            <GithubIcon className="w-4 h-4" />
          </a>
          <button
            onClick={handleLogout}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--card)] px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg text-[var(--foreground)]">
            Opus Nx
          </span>
        </div>
        <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-full">
          Cognitive Architecture
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted-foreground)]">
          Powered by Claude Opus 4.6
        </span>
        <a
          href="https://github.com/omerakben/opus-nx"
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
          title="View on GitHub"
        >
          <GithubIcon className="w-4 h-4" />
        </a>
        <button
          onClick={handleLogout}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
