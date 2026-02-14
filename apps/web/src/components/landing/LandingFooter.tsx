import { serif } from "./fonts";

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-8 px-6">
      <div className="mx-auto max-w-6xl flex flex-col items-center gap-3 text-center">
        <p
          className={`${serif.className} text-sm text-[var(--muted-foreground)]`}
        >
          Built by{" "}
          <a
            href="https://omerakben.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#C4654A] hover:underline"
          >
            Ozzy
          </a>
          {" + "}
          <a
            href="https://tuel.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7BA3BE] hover:underline"
          >
            TUEL AI
          </a>
          {" + "}
          <a
            href="https://www.anthropic.com/news/claude-opus-4-6"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D4A574] hover:underline"
          >
            Claude
          </a>
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Research Platform &middot; MIT License
        </p>
      </div>
    </footer>
  );
}
