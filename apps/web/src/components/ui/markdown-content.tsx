"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type MarkdownSize = "xs" | "sm" | "base";

interface MarkdownContentProps {
  content: string;
  className?: string;
  size?: MarkdownSize;
}

interface MarkdownRawToggleProps {
  content: string;
  className?: string;
  markdownClassName?: string;
  rawClassName?: string;
  defaultMode?: "md" | "raw";
  size?: MarkdownSize;
}

const SIZE_STYLES: Record<MarkdownSize, string> = {
  xs: "text-[11px] [&_p]:text-[11px] [&_li]:text-[11px]",
  sm: "text-xs [&_p]:text-xs [&_li]:text-xs",
  base: "text-sm [&_p]:text-sm [&_li]:text-sm",
};

const MARKDOWN_BASE_CLASSES =
  "max-w-none leading-relaxed text-[var(--foreground)] " +
  "[&_h1]:text-base [&_h1]:font-bold [&_h1]:text-[var(--foreground)] [&_h1]:mt-4 [&_h1]:mb-2 " +
  "[&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-[var(--foreground)] [&_h2]:mt-3 [&_h2]:mb-1.5 " +
  "[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-[var(--foreground)] [&_h3]:mt-2.5 [&_h3]:mb-1 " +
  "[&_p]:text-[var(--foreground)] [&_p]:my-1.5 [&_p]:leading-relaxed " +
  "[&_ul]:my-1.5 [&_ul]:pl-4 [&_ul]:list-disc " +
  "[&_ol]:my-1.5 [&_ol]:pl-4 [&_ol]:list-decimal " +
  "[&_li]:my-0.5 [&_strong]:text-[var(--foreground)] [&_strong]:font-bold " +
  "[&_em]:text-[var(--muted-foreground)] [&_em]:italic " +
  "[&_code]:text-[11px] [&_code]:text-cyan-300 [&_code]:bg-cyan-500/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded " +
  "[&_pre]:bg-[var(--card)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto " +
  "[&_pre_code]:text-[var(--foreground)] [&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_hr]:my-3 [&_hr]:border-[var(--border)] " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-cyan-500/30 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:italic [&_blockquote_p]:text-[var(--muted-foreground)] " +
  "[&_a]:text-cyan-400 [&_a]:underline " +
  "[&_table]:w-full [&_table]:my-2 [&_table]:border-collapse " +
  "[&_thead]:border-b [&_thead]:border-[var(--border)] " +
  "[&_th]:text-left [&_th]:text-[10px] [&_th]:font-semibold [&_th]:text-[var(--muted-foreground)] [&_th]:uppercase [&_th]:tracking-wider [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[var(--card)] " +
  "[&_td]:text-[var(--foreground)] [&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-[var(--border)]";

export function MarkdownContent({
  content,
  className,
  size = "sm",
}: MarkdownContentProps) {
  return (
    <div
      className={cn(
        MARKDOWN_BASE_CLASSES,
        SIZE_STYLES[size],
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownRawToggle({
  content,
  className,
  markdownClassName,
  rawClassName,
  defaultMode = "md",
  size = "sm",
}: MarkdownRawToggleProps) {
  const [mode, setMode] = useState<"md" | "raw">(defaultMode);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-end rounded-md border border-[var(--border)] bg-[var(--muted)]/40 p-0.5 w-fit ml-auto">
        <button
          onClick={() => setMode("md")}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
            mode === "md"
              ? "bg-[var(--card)] text-cyan-400 shadow-sm border border-[var(--border)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
          title="Rendered Markdown"
          type="button"
        >
          <FileText className="w-3 h-3" />
          MD
        </button>
        <button
          onClick={() => setMode("raw")}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
            mode === "raw"
              ? "bg-[var(--card)] text-cyan-400 shadow-sm border border-[var(--border)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
          title="Raw Text"
          type="button"
        >
          <Code className="w-3 h-3" />
          Raw
        </button>
      </div>

      {mode === "raw" ? (
        <div
          className={cn(
            "whitespace-pre-wrap font-mono leading-relaxed text-[var(--foreground)]",
            SIZE_STYLES[size],
            rawClassName
          )}
        >
          {content}
        </div>
      ) : (
        <MarkdownContent
          content={content}
          size={size}
          className={markdownClassName}
        />
      )}
    </div>
  );
}
