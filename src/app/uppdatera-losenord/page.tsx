import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Välj lösenord",
};

export default function UpdatePasswordPage() {
  return (
    <AuthCard title="Välj ett lösenord" description="Ange ett nytt lösenord för ditt konto.">
      <Suspense>
        <UpdatePasswordForm />
      </Suspense>
    </AuthCard>
  );
}
