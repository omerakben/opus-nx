import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { MissionAlignment } from "@/components/landing/MissionAlignment";
import { PlatformScope } from "@/components/landing/PlatformScope";
import { ResearchFoundation } from "@/components/landing/ResearchFoundation";
import { OpenSourceCTA } from "@/components/landing/OpenSourceCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function HomePage() {
  const demoEnabled = process.env.DEMO_MODE === "true";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="h-[440px] bg-[radial-gradient(circle_at_20%_20%,rgba(196,101,74,0.20),transparent_45%),radial-gradient(circle_at_78%_26%,rgba(123,163,190,0.18),transparent_42%),linear-gradient(to_bottom,rgba(255,255,255,0.01),transparent)]" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-10 sm:pt-16">
        <LandingNav />
        <HeroSection />
        <PlatformScope demoEnabled={demoEnabled} />
      </section>

      <MissionAlignment />
      <ResearchFoundation />
      <OpenSourceCTA />
      <LandingFooter />
    </main>
  );
}
