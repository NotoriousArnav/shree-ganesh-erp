import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import RequireRole from "./components/require-role";
import MerchantLayout from "./components/merchant-layout";
import { startThemeWatcher } from "./lib/theme";
import Admin from "./routes/Admin";
import ForgotPassword from "./routes/ForgotPassword";
import Home from "./routes/Home";
import Login from "./routes/Login";
import ResetPassword from "./routes/ResetPassword";
import Categories from "./routes/merchant/Categories";
import Dashboard from "./routes/merchant/Dashboard";
import Catalogue from "./routes/merchant/Catalogue";
import Inventory from "./routes/merchant/Inventory";
import ProductDetail from "./routes/merchant/ProductDetail";
import Settings from "./routes/merchant/Settings";
import Staff from "./routes/merchant/Staff";
import Stock from "./routes/merchant/Stock";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/admin",
    element: (
      <RequireRole roles={["super_admin", "dev"]}>
        <Admin />
      </RequireRole>
    ),
  },
  {
    path: "/app",
    element: (
      <RequireRole roles={["merchant", "staff"]}>
        <MerchantLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "inventory", element: <Inventory /> },
      { path: "inventory/:id", element: <ProductDetail /> },
      { path: "catalogue", element: <Catalogue /> },
      { path: "stock", element: <Stock /> },
      { path: "categories", element: <Categories /> },
      { path: "staff", element: <Staff /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

startThemeWatcher();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
