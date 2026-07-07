import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Återställ lösenord",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Återställ lösenord"
      description="Ange din e-postadress så skickar vi en länk för att välja ett nytt lösenord."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
