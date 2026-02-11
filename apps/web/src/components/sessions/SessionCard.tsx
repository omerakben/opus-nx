"use client";

import { cn } from "@/lib/utils";
import { formatRelativeTime, truncate } from "@/lib/utils";
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { Session } from "@/lib/api";
import { Archive, MessageSquare, MoreHorizontal, Share2, Star, Trash2 } from "lucide-react";

interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onShare?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  /** Display name derived from first query */
  displayName?: string;
}

export function SessionCard({
  session,
  isActive,
  onClick,
  onShare,
  onArchive,
  onDelete,
  displayName,
}: SessionCardProps) {
  const name = displayName || "New Session";
  const isDemo = session.isDemo === true;

  return (
    <div
      className={cn(
        "group relative w-full text-left p-3 rounded-lg border transition-all cursor-pointer",
        isActive
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]",
        isDemo && !isActive && "border-violet-500/30 bg-violet-500/5"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="option"
      aria-selected={isActive}
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isDemo ? (
            <Star className="w-4 h-4 text-violet-400 shrink-0" />
          ) : (
            <MessageSquare className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
          )}
          <span className="text-sm font-medium text-[var(--foreground)] truncate">
            {truncate(name, 30)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant={session.status === "active" ? "success" : "secondary"}
            className="text-[10px] px-1.5 py-0"
          >
            {session.status}
          </Badge>

          {/* Action menu - visible on hover */}
          {(onShare || onArchive || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "p-1 rounded-md transition-opacity",
                    "opacity-0 group-hover:opacity-100 focus:opacity-100",
                    "hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  )}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Session options"
                >
                  <MoreHorizontal className="w-4 h-4 text-[var(--muted-foreground)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {onShare && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare();
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share link
                  </DropdownMenuItem>
                )}
                {onShare && (onArchive || onDelete) && <DropdownMenuSeparator />}
                {onArchive && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                    }}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
                {onArchive && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
        {formatRelativeTime(new Date(session.createdAt))}
      </div>
    </div>
  );
}
