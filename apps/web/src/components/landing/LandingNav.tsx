import Link from "next/link";
import { Github } from "lucide-react";
import { display } from "./fonts";

export function LandingNav() {
  return (
    <nav className="mb-10 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2">
        <img src="/opus_nx_icon.svg" alt="Opus Nx" width={28} height={28} />
        <span
          className={`text-sm font-semibold tracking-wide ${display.className}`}
        >
          OPUS NX
        </span>
        <span className="rounded-full bg-[#C4654A]/15 px-2 py-0.5 text-[10px] font-medium text-[#C4654A]">
          Research Platform
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs hover:border-[#7BA3BE]/40"
        >
          Access Workspace
        </Link>
        <a
          href="https://github.com/omerakben/opus-nx"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs hover:border-[#C4654A]/40"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>
    </nav>
  );
}
