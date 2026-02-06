export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[var(--border)] rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
        <p className="text-[var(--muted-foreground)] text-sm">
          Loading Opus Nx...
        </p>
      </div>
    </div>
  );
}
