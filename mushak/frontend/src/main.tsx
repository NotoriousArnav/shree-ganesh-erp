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
import Products from "./routes/merchant/Products";
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
      { path: "products", element: <Products /> },
      { path: "stock", element: <Stock /> },
      { path: "categories", element: <Categories /> },
    ],
  },
]);

startThemeWatcher();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
