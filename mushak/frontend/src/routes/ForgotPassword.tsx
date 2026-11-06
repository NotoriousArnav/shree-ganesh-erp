import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        setError(result.error.message ?? "Could not request a reset link.");
        return;
      }

      setSent(true);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

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
            Forgot password
          </h1>
        </div>

        {sent ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{email}</span>{" "}
              belongs to an account, a reset link is on its way. In development
              it is printed in the backend terminal and saved under{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                /tmp/mushak-mail
              </code>
              .
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Account email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@shop.in"
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
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
