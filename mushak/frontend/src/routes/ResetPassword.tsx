import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { PasswordInput } from "@/components/ui/password-input";
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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <img src="/brand/mushak.png" alt="Mushak" className="h-16 w-auto" />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Shree Ganesh ERP
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Choose a new password
          </h1>
        </div>

        {done ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Your password has been updated.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        ) : invalidLink ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired.
            </p>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                New password
              </label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirm">
                Confirm password
              </label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                minLength={8}
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

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
    </main>
  );
}
