import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-[var(--muted)] skeleton-shimmer",
        className
      )}
      style={style}
    />
  );
}

export { Skeleton };
