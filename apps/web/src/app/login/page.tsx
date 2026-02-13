import { LoginClient } from "@/components/auth/LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginClient demoEnabled={process.env.DEMO_MODE === "true"} />;
}
