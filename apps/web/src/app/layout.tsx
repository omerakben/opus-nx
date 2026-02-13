import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { ClientToaster } from "@/components/ui/client-toaster";

export const metadata: Metadata = {
  title: "Opus Nx - Persistent Reasoning Research Platform",
  description:
    "Open-source platform for persistent reasoning graphs, swarm analysis, and iterative policy improvement",
  keywords: [
    "AI",
    "reasoning",
    "research platform",
    "Claude",
    "extended thinking",
  ],
  authors: [
    { name: "Ozzy", url: "https://omerakben.com" },
    { name: "Claude", url: "https://tuel.ai" },
  ],
  creator: "Ozzy + Claude",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Opus Nx - Persistent Reasoning Research Platform",
    description:
      "Open-source platform for persistent reasoning graphs, swarm analysis, and iterative policy improvement",
    siteName: "Opus Nx",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Opus Nx - Persistent Reasoning Research Platform",
    description:
      "Open-source platform for persistent reasoning graphs, swarm analysis, and iterative policy improvement",
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
        <ClientToaster />
      </body>
    </html>
  );
}
