import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { MemberActions } from "@/components/team/member-actions";
import { RevokeInvitationButton } from "@/components/team/revoke-invitation-button";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEAT_PRICE_SEK } from "@/lib/subscription";
import type { UserRole } from "@/lib/database.types";

export const metadata: Metadata = {
  title: "Medarbetare",
};

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Ägare",
  admin: "Administratör",
  agent: "Mäklare",
};

export default async function TeamPage() {
  const { profile, organization } = await requireSession();

  if (profile.role !== "owner" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const memberCount = members?.length ?? 0;
  const pendingCount = invitations?.length ?? 0;
  const usedSeats = memberCount + pendingCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Medarbetare</h1>
          <p className="text-sm text-muted-foreground">
            Hantera vilka som har åtkomst till {organization.name}.
          </p>
        </div>
        <InviteMemberDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platser (seats)</CardTitle>
          <CardDescription>
            {usedSeats} platser används ({memberCount} aktiva, {pendingCount} väntande
            inbjudningar). Fakturering: {SEAT_PRICE_SEK} kr per mäklare och månad inkl.
            moms – fakturor skickas separat.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktiva medarbetare</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead className="hidden sm:table-cell">E-post</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.full_name || member.email}
                    {member.id === profile.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">(du)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {member.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.role !== "owner" && member.id !== profile.id ? (
                      <MemberActions
                        memberId={member.id}
                        memberName={member.full_name || member.email}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pendingCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Väntande inbjudningar</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-post</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead className="hidden sm:table-cell">Skickad</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invitations ?? []).map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ROLE_LABELS[invitation.role as UserRole] ?? invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {new Date(invitation.created_at).toLocaleDateString("sv-SE")}
                    </TableCell>
                    <TableCell>
                      <RevokeInvitationButton
                        invitationId={invitation.id}
                        email={invitation.email}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
