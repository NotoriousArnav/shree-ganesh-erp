import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Button, ErrorNote, Field, Input } from "@/components/ui";
import ThemeToggle from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";

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
        redirectTo: `${window.location.origin}${withBasePath("/reset-password")}`,
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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Lokkhi</h1>
          <p className="text-sm text-muted-foreground">Forgot password</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                If <span className="font-medium text-foreground">{email}</span>{" "}
                belongs to an account, a reset link is on its way. In
                development it lands in the local mail catcher (Mailpit) or the
                backend terminal.
              </p>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="Account email" required>
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="merchant@shop.local"
                  required
                />
              </Field>

              {error ? <ErrorNote>{error}</ErrorNote> : null}

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
      </div>
    </div>
  );
}
