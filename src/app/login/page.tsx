import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Logga in",
};

export default function LoginPage() {
  return (
    <AuthCard title="Logga in" description="Välkommen tillbaka till BergLabs.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
