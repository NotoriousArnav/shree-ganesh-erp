import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { api, errorMessage } from "@/lib/api";
import { permissionDetails } from "@/lib/permissions";
import type { StaffMember, StaffPermission } from "@/lib/types";

type Props = {
  staff: StaffMember | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function StaffDialog({ staff, onClose, onSaved }: Props) {
  const isNew = staff === null;

  const [name, setName] = useState(staff?.name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [phone, setPhone] = useState(staff?.phoneNumber ?? "");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<StaffPermission[]>(
    staff?.permissions ?? ["stock"],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(permission: StaffPermission, checked: boolean) {
    setPermissions((current) => {
      const next = new Set(current);
      if (checked) next.add(permission);
      else next.delete(permission);
      return [...next];
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Give the staff member a name.");
      return;
    }

    if (isNew && !email.trim()) {
      setError("Enter an email address for signing in.");
      return;
    }

    if (isNew && password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }

    setBusy(true);

    try {
      if (isNew) {
        await api<StaffMember>("/api/merchant/staff", {
          method: "POST",
          body: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phoneNumber: phone.trim() || null,
            password,
            permissions,
          },
        });
      } else {
        await api<StaffMember>(`/api/merchant/staff/${staff.id}`, {
          method: "PATCH",
          body: {
            name: name.trim(),
            phoneNumber: phone.trim() || null,
            permissions,
          },
        });
      }

      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? "Add staff" : "Edit staff"}
      description={
        isNew
          ? "Create a sign-in for a counter helper and choose what they can change."
          : "Update the name, phone number or what this account may change."
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="staff-name">Name</Label>
          <Input
            id="staff-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Counter Staff"
            required
          />
        </div>

        {isNew ? (
          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@shop.in"
              autoComplete="off"
              required
            />
            <p className="text-xs text-muted-foreground">
              Used to sign in and to reset a forgotten password.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {staff.email}
            </p>
            <p className="text-xs text-muted-foreground">
              The sign-in email cannot be changed here.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="staff-phone">Phone (optional)</Label>
            <Input
              id="staff-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="98765 43210"
              autoComplete="off"
            />
          </div>

          {isNew ? (
            <div className="space-y-1.5">
              <Label htmlFor="staff-password">Temporary password</Label>
              <PasswordInput
                id="staff-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
            </div>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What they can change</legend>
          <p className="text-xs text-muted-foreground">
            Everyone can view products and the dashboard. Leave all unticked
            for view-only access.
          </p>

          <div className="space-y-2">
            {permissionDetails.map((permission) => (
              <label
                key={permission.value}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/40"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={permissions.includes(permission.value)}
                  onChange={(event) =>
                    toggle(permission.value, event.target.checked)
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    {permission.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {permission.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add staff" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
