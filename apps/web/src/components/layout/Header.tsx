"use client";

import { GithubIcon, LogOut, HelpCircle, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  isMobile?: boolean;
  onReplayTour?: () => void;
  isDemoMode?: boolean;
}

export function Header({ isMobile, onReplayTour, isDemoMode }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (isMobile) {
    return (
      <header className="h-12 border-b border-[var(--border)] bg-[var(--card)] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="/opus_nx_icon.svg"
            alt="Opus Nx"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <span className="font-semibold text-base text-[var(--foreground)]">
            Opus Nx
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            Cognitive Architecture
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onReplayTour && (
            <button
              onClick={onReplayTour}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
              title="Replay tour"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
          <a
            href="https://omerakben.com"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 flex items-center gap-1 px-1.5 rounded-md hover:bg-[var(--muted)] transition-colors text-xs text-[var(--muted-foreground)]"
            title="Ozzy"
          >
            <ExternalLink className="w-3 h-3" />
            Ozzy
          </a>
          <a
            href="https://tuel.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 flex items-center gap-1 px-1.5 rounded-md hover:bg-[var(--muted)] transition-colors text-xs text-[var(--muted-foreground)]"
            title="tuel.ai"
          >
            <ExternalLink className="w-3 h-3" />
            tuel.ai
          </a>
          <a
            href="https://github.com/omerakben/opus-nx"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
            title="View on GitHub"
          >
            <GithubIcon className="w-4 h-4" />
          </a>
          {!isDemoMode && (
            <button
              onClick={handleLogout}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--card)] px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img
            src="/opus_nx_icon.svg"
            alt="Opus Nx"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="font-bold text-lg text-[var(--foreground)]">
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
        {onReplayTour && (
          <button
            onClick={onReplayTour}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
            title="Replay tour"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
        <a
          href="https://omerakben.com"
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 flex items-center gap-1 px-1.5 rounded-md hover:bg-[var(--muted)] transition-colors text-xs text-[var(--muted-foreground)]"
          title="Ozzy"
        >
          <ExternalLink className="w-3 h-3" />
          Ozzy
        </a>
        <a
          href="https://tuel.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 flex items-center gap-1 px-1.5 rounded-md hover:bg-[var(--muted)] transition-colors text-xs text-[var(--muted-foreground)]"
          title="tuel.ai"
        >
          <ExternalLink className="w-3 h-3" />
          tuel.ai
        </a>
        <a
          href="https://github.com/omerakben/opus-nx"
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
          title="View on GitHub"
        >
          <GithubIcon className="w-4 h-4" />
        </a>
        {!isDemoMode && (
          <button
            onClick={handleLogout}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
