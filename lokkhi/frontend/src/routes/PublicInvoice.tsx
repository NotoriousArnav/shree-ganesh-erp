import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import ExportDialog from "@/components/export-dialog";
import InvoiceDocument from "@/components/invoice-document";
import { Badge, Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Invoice } from "@/lib/types";

type SharedInvoice = Invoice & { issuerName: string | null };

/**
 * Read-only invoice behind a share link (`/invoices/:id?anon=true`).
 *
 * This page does not use the app shell, so it never asks the recipient to sign
 * in. The backend returns only document fields; internal stock state and
 * catalogue links stay private.
 */
export default function PublicInvoice() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<SharedInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    api<SharedInvoice>(`/api/public/invoices/${id}`)
      .then((payload) => {
        if (!cancelled) {
          setInvoice(payload);
          setError(null);
          document.title = `${payload.number ?? "Invoice"} · Lokkhi`;
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading shared invoice…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">This invoice is not available</h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "The link may be mistyped, or the invoice was removed."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="print-hide border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              Lokkhi
            </Link>
            <span className="text-xs text-muted-foreground">
              Shared invoice
            </span>
            <Badge
              tone={
                invoice.status === "issued"
                  ? "green"
                  : invoice.status === "void"
                    ? "red"
                    : "neutral"
              }
            >
              {invoice.status}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              Export
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {invoice.issuerName ? (
          <p className="text-sm text-muted-foreground print-hide">
            Shared by <span className="font-medium text-foreground">{invoice.issuerName}</span>
            . This is a read-only copy of their invoice.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground print-hide">
            This is a read-only copy of an invoice.
          </p>
        )}

        <InvoiceDocument invoice={invoice} />

        <p className="text-xs text-muted-foreground/70 print-hide">
          You are viewing a shared invoice. Nothing here can be edited.
        </p>
      </main>

      {exportOpen ? (
        <ExportDialog invoice={invoice} onClose={() => setExportOpen(false)} />
      ) : null}
    </div>
  );
}
