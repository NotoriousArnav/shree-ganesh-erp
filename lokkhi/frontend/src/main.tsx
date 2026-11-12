import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";

import AppShell from "@/components/AppShell";
import InvoiceDetail from "@/routes/InvoiceDetail";
import InvoiceEditor from "@/routes/InvoiceEditor";
import InvoiceList from "@/routes/InvoiceList";
import Login from "@/routes/Login";
import { startThemeWatcher } from "@/lib/theme";
import "./index.css";

startThemeWatcher();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
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
        <Route
          path="/invoices/:id"
          element={
            <AppShell>
              <InvoiceDetail />
            </AppShell>
          }
        />
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
