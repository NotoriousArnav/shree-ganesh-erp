import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

/** Accepts 9876543210, +919876543210, or a spaced version of either. */
function normalizePhone(value: string) {
  const digits = value.trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  return digits;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const value = identifier.trim();
      const isEmail = value.includes("@");

      const result = isEmail
        ? await authClient.signIn.email({ email: value, password })
        : await authClient.signIn.phoneNumber({
            phoneNumber: normalizePhone(value),
            password,
          });

      if (result.error) {
        setError(result.error.message ?? "Invalid credentials.");
        return;
      }

      navigate(from, { replace: true });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <img
            src="/brand/mushak.png"
            alt="Mushak"
            className="h-16 w-auto"
          />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Shree Ganesh ERP
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Sign in</h1>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="identifier">
              Email or phone
            </label>
            <Input
              id="identifier"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="you@shop.in or 98765 43210"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are created by the platform admin.{" "}
          <Link to="/" className="underline underline-offset-2">
            Back home
          </Link>
        </p>
      </div>
    </main>
  );
}
