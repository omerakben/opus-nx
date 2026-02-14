import { display } from "./fonts";
import { PAPERS } from "./constants";

export function ResearchFoundation() {
  return (
    <section className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#7BA3BE]/30 bg-[#7BA3BE]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#7BA3BE]">
            Research Foundation
          </p>
          <h2
            className={`${display.className} mt-4 text-2xl font-semibold`}
          >
            Grounded in Peer-Reviewed Research
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAPERS.map((paper) => (
            <a
              key={paper.title}
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[#7BA3BE]/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{paper.title}</h3>
                <span className="shrink-0 rounded-full bg-[#7BA3BE]/15 px-2 py-0.5 text-[10px] font-medium text-[#7BA3BE]">
                  {paper.module}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                {paper.authors}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {paper.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
