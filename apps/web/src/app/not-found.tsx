import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-md text-center p-6">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-[var(--muted-foreground)]/30 animate-spin-slow" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-[var(--muted-foreground)]">404</span>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          Page Not Found
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
