import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import RequireRole from "./components/require-role";
import Admin from "./routes/Admin";
import ForgotPassword from "./routes/ForgotPassword";
import Home from "./routes/Home";
import Login from "./routes/Login";
import ResetPassword from "./routes/ResetPassword";

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
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
