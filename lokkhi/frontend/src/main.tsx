import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useSearchParams } from "react-router";

import AppShell from "@/components/AppShell";
import ForgotPassword from "@/routes/ForgotPassword";
import InvoiceDetail from "@/routes/InvoiceDetail";
import InvoiceEditor from "@/routes/InvoiceEditor";
import InvoiceList from "@/routes/InvoiceList";
import Login from "@/routes/Login";
import PublicInvoice from "@/routes/PublicInvoice";
import ResetPassword from "@/routes/ResetPassword";
import { basePath } from "@/lib/base-path";
import { startThemeWatcher } from "@/lib/theme";
import "./index.css";

startThemeWatcher();

/**
 * `/invoices/:id` is the signed-in detail page, but adding `?anon=true` opens
 * the same invoice read-only for someone holding a share link.
 */
function InvoiceDetailRoute() {
  const [params] = useSearchParams();

  if (params.get("anon") === "true") return <PublicInvoice />;

  return (
    <AppShell>
      <InvoiceDetail />
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basePath || "/"}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route
          index
          element={
            <AppShell>
              <InvoiceList />
            </AppShell>
          }
        />
        <Route
          path="/invoices/new"
          element={
            <AppShell>
              <InvoiceEditor />
            </AppShell>
          }
        />
        <Route path="/invoices/:id" element={<InvoiceDetailRoute />} />
        <Route
          path="/invoices/:id/edit"
          element={
            <AppShell>
              <InvoiceEditor />
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
