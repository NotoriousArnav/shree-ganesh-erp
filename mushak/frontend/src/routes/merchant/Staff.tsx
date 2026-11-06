import { useCallback, useEffect, useState } from "react";

import PageHeader from "@/components/page-header";
import StaffDialog from "@/components/staff-dialog";
import StaffPasswordDialog from "@/components/staff-password-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { permissionLabels, usePermissions } from "@/lib/permissions";
import type { StaffMember, StaffPermission } from "@/lib/types";

export default function Staff() {
  const { profile, isMerchant } = usePermissions();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [resetting, setResetting] = useState<StaffMember | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    api<StaffMember[]>("/api/merchant/staff")
      .then(setStaff)
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isMerchant) load();
  }, [isMerchant, load]);

  async function setActive(member: StaffMember, active: boolean) {
    if (
      !active &&
      !window.confirm(
        `Deactivate ${member.name}? They will be signed out and cannot sign in until you reactivate them.`,
      )
    ) {
      return;
    }

    setError(null);

    try {
      await api<StaffMember>(`/api/merchant/staff/${member.id}`, {
        method: "PATCH",
        body: { active },
      });
      load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  if (!isMerchant) {
    return (
      <div className="space-y-5">
        <PageHeader title="Staff" description="Counter accounts for this shop." />
        <p className="rounded-md border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
          {profile
            ? "Only the shop owner can manage staff accounts."
            : "Loading…"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff"
        description="Create counter logins and choose what each person may change."
        actions={
          <Button onClick={() => setEditing("new")}>Add staff</Button>
        }
      />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{profile?.user.name ?? "Shop owner"}</p>
            <p className="text-xs text-muted-foreground">Shop owner · you</p>
          </div>
          <Badge variant="success">Full access</Badge>
        </div>

        <div className="divide-y">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{member.name}</span>
                  <Badge variant={member.active ? "success" : "secondary"}>
                    {member.active ? "Active" : "Deactivated"}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email}
                  {member.phoneNumber ? ` · ${member.phoneNumber}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <AccessBadges permissions={member.permissions} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Added {dateTime(member.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(member)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setResetting(member)}
                >
                  Reset password
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={
                    member.active ? "text-muted-foreground" : undefined
                  }
                  onClick={() => void setActive(member, !member.active)}
                >
                  {member.active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </div>
          ))}

          {!loading && staff.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No staff yet. Add a counter login when you are ready to share
              access.
            </p>
          ) : null}

          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Staff can always view products and the dashboard. Ticking nothing gives
        them view-only access. Deactivating an account signs them out
        everywhere.
      </p>

      {editing ? (
        <StaffDialog
          key={editing === "new" ? "new" : editing.id}
          staff={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {resetting ? (
        <StaffPasswordDialog
          key={resetting.id}
          staff={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => setResetting(null)}
        />
      ) : null}
    </div>
  );
}

function AccessBadges({ permissions }: { permissions: StaffPermission[] }) {
  if (permissions.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">View only · no changes</span>
    );
  }

  return (
    <>
      {permissions.map((permission) => (
        <Badge key={permission} variant="outline">
          {permissionLabels[permission]}
        </Badge>
      ))}
    </>
  );
}
