import { useEffect, useRef, useState } from "react";

import { Button, Dialog, ErrorNote } from "@/components/ui";
import {
  binaryBlob,
  downloadBlob,
  exportFormats,
  formatDetails,
  invoiceCsv,
  invoiceFilename,
  invoiceShareUrl,
  invoiceXlsx,
  plainMoney,
  shareText,
  type ExportFormat,
} from "@/lib/invoice-export";
import type { Invoice } from "@/lib/types";
/**
 * Export invoice modal.
 *
 * Generating a file is fast, but a short countdown gives the browser time to
 * settle and makes the download feel deliberate: the file starts saving on its
 * own after five seconds, and can be started immediately or shared instead.
 */

const COUNTDOWN_SECONDS = 5;

type Phase = "choose" | "generating" | "ready" | "downloaded" | "error";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExportDialog({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [phase, setPhase] = useState<Phase>("choose");
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const downloadedRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const details = format ? formatDetails(format) : null;

  async function start(next: ExportFormat) {
    setFormat(next);
    setPhase("generating");
    setError(null);
    setBlob(null);
    setShareOpen(false);
    setShareNote(null);
    setShareCopied(false);
    downloadedRef.current = false;
    setSecondsLeft(COUNTDOWN_SECONDS);

    const target = formatDetails(next);
    const name = invoiceFilename(invoice, target.extension);

    try {
      let file: Blob;
      if (next === "csv") {
        file = new Blob([invoiceCsv(invoice)], { type: target.mime });
      } else if (next === "xlsx") {
        file = binaryBlob(invoiceXlsx(invoice), target.mime);
      } else {
        // pdf-lib is only needed for PDF exports, so load it on demand.
        const { invoicePdf } = await import("@/lib/invoice-pdf");
        file = binaryBlob(await invoicePdf(invoice), target.mime);
      }

      setBlob(file);
      setFilename(name);
      setPhase("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare the export.");
      setPhase("error");
    }
  }

  function save() {
    if (!blob || downloadedRef.current) return;
    downloadedRef.current = true;
    downloadBlob(filename, blob);
    setPhase("downloaded");
  }

  useEffect(() => {
    if (phase !== "ready") return;

    if (secondsLeft === 0) {
      if (!downloadedRef.current && blob) {
        downloadedRef.current = true;
        downloadBlob(filename, blob);
        setPhase("downloaded");
      }
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, secondsLeft, blob, filename]);

  async function share() {
    if (!blob) return;
    setShareNote(null);

    const url = invoiceShareUrl(invoice);
    const file = new File([blob], filename, { type: blob.type });
    const payload: ShareData = {
      files: [file],
      title: `Invoice ${invoice.number ?? "draft"}`,
      text: `${shareText(invoice)}\n${url}`,
      url,
    };

    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(payload);
        return;
      }
    } catch (cause) {
      // The user dismissing the share sheet is not an error.
      if (cause instanceof DOMException && cause.name === "AbortError") return;
    }

    setShareOpen((open) => !open);
  }

  async function copySummary() {
    await navigator.clipboard.writeText(
      `${shareText(invoice)}\n${invoiceShareUrl(invoice)}`,
    );
    setShareCopied(true);
  }

  const shareUrl = invoiceShareUrl(invoice);
  const shareMessage = encodeURIComponent(`${shareText(invoice)}\n${shareUrl}`);
  const shareSubject = encodeURIComponent(
    `Invoice ${invoice.number ?? "draft"} from Lokkhi`,
  );
  const shareLinks = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${shareMessage}`,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(
        shareUrl,
      )}&text=${shareMessage}`,
    },
    {
      label: "Email",
      href: `mailto:?subject=${shareSubject}&body=${shareMessage}`,
    },
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      title="Export invoice"
      description={
        details
          ? `${details.label} · ${filename}`
          : "Choose a format. Nothing leaves this browser."
      }
    >
      <div className="space-y-4">
        {!format ? (
          <div className="space-y-2">
            {exportFormats.map((entry) => (
              <button
                key={entry.value}
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
                onClick={() => void start(entry.value)}
              >
                <span>
                  <span className="block text-sm font-semibold">{entry.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
                <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
                  Export →
                </span>
              </button>
            ))}
            <p className="pt-1 text-xs text-muted-foreground/80">
              Total: {plainMoney(invoice.total, invoice.currency)} ·{" "}
              {invoice.lines.length} {invoice.lines.length === 1 ? "line" : "lines"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {blob ? fileSize(blob.size) : details?.label}
                    {phase === "generating" ? " · preparing…" : null}
                    {phase === "downloaded" ? " · download started" : null}
                    {phase === "ready"
                      ? ` · starts in ${secondsLeft}s`
                      : null}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {details?.label}
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className={[
                    "h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear",
                    phase === "generating" ? "w-1/4 animate-pulse" : "",
                    phase === "ready"
                      ? ""
                      : phase === "downloaded"
                        ? "w-full"
                        : "",
                  ].join(" ")}
                  style={
                    phase === "ready"
                      ? {
                          width: `${((COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS) * 100}%`,
                        }
                      : undefined
                  }
                />
              </div>
            </div>

            {error ? <ErrorNote>{error}</ErrorNote> : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={save}
                disabled={!blob || phase === "generating" || phase === "downloaded"}
              >
                {phase === "downloaded" ? "Downloaded" : "Download now"}
              </Button>
              <Button variant="outline" onClick={() => void share()} disabled={!blob}>
                Share to…
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFormat(null);
                  setPhase("choose");
                  setBlob(null);
                  setError(null);
                }}
              >
                Back
              </Button>
            </div>

            {shareOpen ? (
              <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex flex-wrap gap-2">
                  {shareLinks.map((link) => (
                    <a
                      key={link.label}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        setShareNote(
                          "The file is ready in your downloads. Attach it in the chat or email that just opened.",
                        )
                      }
                    >
                      {link.label}
                    </a>
                  ))}
                  <button
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    onClick={() => void copySummary()}
                  >
                    {shareCopied ? "Copied" : "Copy details"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {shareNote ??
                    "This browser cannot share files directly. The links open a read-only invoice page; download the file to attach it instead."}
                </p>
                <p className="break-all rounded-lg bg-card px-2 py-1.5 text-[11px] text-muted-foreground">
                  {shareUrl}
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Anyone with this link can view the invoice without signing in.
                </p>
              </div>
            ) : null}

            {phase === "downloaded" ? (
              <p className="text-xs text-muted-foreground/80">
                Saved to your downloads. You can export another format any time.
              </p>
            ) : null}
          </div>
        )}

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
