import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

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
      </body>
    </html>
  );
}
