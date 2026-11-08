import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { imageSrc, uploadImage } from "@/lib/images";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (key: string | null) => void;
  label?: string;
  hint?: string;
  /** Products use a rounded square; profile pictures use a circle. */
  shape?: "square" | "circle";
  /** Storage folder inside the merchant's own prefix. */
  prefix?: string;
  disabled?: boolean;
};

/** Optional image picker: presigns, uploads, and reports the object key. */
export default function ImageField({
  value,
  onChange,
  label = "Image",
  hint = "Optional. PNG, JPEG, WebP, GIF or AVIF up to 5 MB.",
  shape = "square",
  prefix = "images",
  disabled = false,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Object URLs created for local previews must be released.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const src = preview ?? imageSrc(value);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setBusy(true);
    const local = URL.createObjectURL(file);
    setPreview(local);

    try {
      onChange(await uploadImage(file, prefix));
      setPreview(null);
      URL.revokeObjectURL(local);
    } catch (cause) {
      setPreview(null);
      URL.revokeObjectURL(local);
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center overflow-hidden border bg-muted",
            shape === "circle" ? "rounded-full" : "rounded-md",
          )}
        >
          {src ? (
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              None
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="sr-only"
              onChange={(event) => void onPick(event)}
              disabled={disabled || busy}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : src ? "Change image" : "Choose image"}
            </Button>
            {src && !disabled ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onChange(null)}
              >
                Remove
              </Button>
            ) : null}
          </div>

          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
