import { useEffect, useState, type FormEvent } from "react";

import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { useMerchantProfile } from "@/lib/merchant-context";
import { usePermissions } from "@/lib/permissions";

export default function Settings() {
  const profile = useMerchantProfile();
  const { isMerchant } = usePermissions();
  const merchant = profile?.merchant ?? null;

  const [name, setName] = useState(merchant?.name ?? "");
  const [phone, setPhone] = useState(merchant?.phone ?? "");
  const [gstin, setGstin] = useState(merchant?.gstin ?? "");
  const [currency, setCurrency] = useState(merchant?.currency ?? "INR");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!merchant) return;

    setName(merchant.name);
    setPhone(merchant.phone ?? "");
    setGstin(merchant.gstin ?? "");
    setCurrency(merchant.currency);
    setAddress(merchant.address ? JSON.stringify(merchant.address, null, 2) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!name.trim()) {
      setError("Give the shop a name.");
      return;
    }

    let parsedAddress: Record<string, string> | null = null;

    if (address.trim()) {
      try {
        const value = JSON.parse(address) as Record<string, string>;
        parsedAddress = value && typeof value === "object" ? value : null;
      } catch {
        setError("The address must be a JSON object like {\"line1\": \"12 Market Road\"}.");
        return;
      }
    }

    setBusy(true);

    try {
      await api(`/api/merchant/profile`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : { phone: null }),
          ...(gstin.trim() ? { gstin: gstin.trim() } : { gstin: null }),
          ...(currency.trim() ? { currency: currency.trim().toUpperCase() } : {}),
          address: parsedAddress,
        },
      });

      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!isMerchant) {
    return (
      <div className="space-y-5">
        <PageHeader title="Settings" description="Shop profile and preferences." />
        <p className="rounded-md border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
          Only the shop owner can change these settings. Ask the shop owner if you
          need something adjusted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="The shop's own details. Staff cannot change these."
      />

      <form className="max-w-2xl space-y-4 rounded-lg border bg-background p-5" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Shop name</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="settings-phone">Phone</Label>
            <Input
              id="settings-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-currency">Currency</Label>
            <Input
              id="settings-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-gstin">GSTIN</Label>
          <Input
            id="settings-gstin"
            value={gstin}
            onChange={(event) => setGstin(event.target.value)}
            placeholder="27AABCU9603R1ZMXX"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-address">Address (JSON)</Label>
          <textarea
            id="settings-address"
            className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder='{"line1": "12 Market Road", "city": "Pune", "state": "Maharashtra", "pincode": "411001"}'
          />
          <p className="text-xs text-muted-foreground">
            Free-form address as JSON: line1, line2, city, state, pincode.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {saved ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Shop settings saved.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
