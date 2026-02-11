import { Dashboard } from "@/components/layout";

export default function HomePage() {
  const isDemoMode = process.env.DEMO_MODE === "true";
  return <Dashboard isDemoMode={isDemoMode} />;
}
