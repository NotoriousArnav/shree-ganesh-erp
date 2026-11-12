import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

/** Accepts 9876543210, +919876543210, or a spaced version of either. */
function normalizePhone(value: string) {
  const digits = value.trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  return digits;
}

function signInError(error: { message?: string; status: number }) {
  if (error.status === 401 || error.status === 400) {
    return error.message ?? "Invalid email/phone or password.";
  }
  if (error.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (error.status >= 500) {
    return "The server is not responding. Check that the Lokkhi backend is running on port 8081.";
  }
  return error.message ?? "Could not sign in. Try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        setError(signInError(result.error));
        return;
      }

      navigate("/", { replace: true });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Lokkhi</h1>
          <p className="text-sm text-neutral-500">
            Sales and purchase invoices
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          {error ? <ErrorNote>{error}</ErrorNote> : null}

          <Field label="Email or phone">
            <Input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              placeholder="merchant@shop.local"
              required
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-neutral-400">
            Uses the same account as Mushak.
          </p>
        </form>
      </div>
    </div>
  );
}
