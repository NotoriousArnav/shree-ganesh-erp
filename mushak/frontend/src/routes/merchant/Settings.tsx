import { useEffect, useState, type FormEvent } from "react";

import PageHeader from "@/components/page-header";
import ImageField from "@/components/image-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import {
  useMerchantProfile,
  useRefreshMerchantProfile,
} from "@/lib/merchant-context";
import { usePermissions } from "@/lib/permissions";

export default function Settings() {
  const profile = useMerchantProfile();
  const refreshProfile = useRefreshMerchantProfile();
  const { isMerchant } = usePermissions();
  const merchant = profile?.merchant ?? null;

  const [name, setName] = useState(merchant?.name ?? "");
  const [phone, setPhone] = useState(merchant?.phone ?? "");
  const [gstin, setGstin] = useState(merchant?.gstin ?? "");
  const [currency, setCurrency] = useState(merchant?.currency ?? "INR");
  const [profileImageKey, setProfileImageKey] = useState<string | null>(
    merchant?.profileImageKey ?? null,
  );
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!merchant) return;

    setName(merchant.name);
    setPhone(merchant.phone ?? "");
    setGstin(merchant.gstin ?? "");
    setCurrency(merchant.currency);
    setProfileImageKey(merchant.profileImageKey ?? null);
    setLine1(merchant.address?.line1 ?? "");
    setLine2(merchant.address?.line2 ?? "");
    setCity(merchant.address?.city ?? "");
    setStateName(merchant.address?.state ?? "");
    setPincode(merchant.address?.pincode ?? "");
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

    const address: Record<string, string> = {};
    if (line1.trim()) address.line1 = line1.trim();
    if (line2.trim()) address.line2 = line2.trim();
    if (city.trim()) address.city = city.trim();
    if (stateName.trim()) address.state = stateName.trim();
    if (pincode.trim()) address.pincode = pincode.trim();

    setBusy(true);

    try {
      await api(`/api/merchant/profile`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : { phone: null }),
          ...(gstin.trim() ? { gstin: gstin.trim() } : { gstin: null }),
          ...(currency.trim() ? { currency: currency.trim().toUpperCase() } : {}),
          address: Object.keys(address).length > 0 ? address : null,
          profileImageKey,
        },
      });

      // The sidebar and mobile header read the shared profile, so show the new
      // picture and shop name without a page reload.
      await refreshProfile();
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
        <ImageField
          value={profileImageKey}
          onChange={setProfileImageKey}
          label="Profile picture"
          prefix="profile"
          shape="circle"
          hint="Optional. Shown next to the shop name."
        />

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
          <Label htmlFor="settings-line1">Address</Label>
          <Input
            id="settings-line1"
            value={line1}
            onChange={(event) => setLine1(event.target.value)}
            placeholder="Shop number, building, street"
          />
          <Input
            id="settings-line2"
            value={line2}
            onChange={(event) => setLine2(event.target.value)}
            placeholder="Area, landmark (optional)"
            aria-label="Address line 2"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="settings-city">City</Label>
            <Input
              id="settings-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Pune"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-state">State</Label>
            <Input
              id="settings-state"
              value={stateName}
              onChange={(event) => setStateName(event.target.value)}
              placeholder="Maharashtra"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-pincode">PIN code</Label>
            <Input
              id="settings-pincode"
              value={pincode}
              onChange={(event) => setPincode(event.target.value)}
              inputMode="numeric"
              placeholder="411001"
            />
          </div>
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
