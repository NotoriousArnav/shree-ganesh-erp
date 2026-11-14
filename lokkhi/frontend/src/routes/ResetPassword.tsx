import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { Button, ErrorNote, Field, Input } from "@/components/ui";
import ThemeToggle from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }

    setBusy(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(
          result.error.message ??
            "The link may have expired. Request a new one.",
        );
        return;
      }

      setDone(true);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const invalidLink = !token || Boolean(linkError);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Lokkhi</h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Your password has been updated.
              </p>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Sign in
              </Link>
            </div>
          ) : invalidLink ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="New password" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </Field>

              <Field label="Confirm password" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  minLength={8}
                  required
                />
              </Field>

              {error ? <ErrorNote>{error}</ErrorNote> : null}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                <Link to="/login" className="underline underline-offset-2">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
