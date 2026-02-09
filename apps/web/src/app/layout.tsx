import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { ensureServerEnv } from "@/lib/server-env";
import { Toaster } from "@/components/ui/sonner";

// Validate required runtime env vars as soon as the app boots.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  ensureServerEnv();
}

export const metadata: Metadata = {
  title: "Opus Nx - Cognitive Architecture Dashboard",
  description:
    "Visualize reasoning graphs, stream extended thinking, and explore metacognitive insights",
  keywords: [
    "AI",
    "reasoning",
    "cognitive architecture",
    "Claude",
    "extended thinking",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-[var(--background)]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
