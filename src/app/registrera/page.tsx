import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Registrera byrå",
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Registrera er byrå"
      description="Skapa ett konto för din mäklarbyrå. Du blir automatiskt ägare och kan bjuda in kollegor."
    >
      <RegisterForm />
    </AuthCard>
  );
}
