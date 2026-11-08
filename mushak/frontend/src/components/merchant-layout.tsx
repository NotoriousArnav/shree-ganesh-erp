import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { api, errorMessage } from "@/lib/api";
import { imageSrc } from "@/lib/images";
import { authClient } from "@/lib/auth-client";
import { MerchantProfileProvider } from "@/lib/merchant-context";
import {
  staffPermissionValues,
  type Profile,
  type StaffPermission,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type NavigationItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: () => React.ReactElement;
  permission?: StaffPermission;
  merchantOnly?: boolean;
};

const navigation: NavigationItem[] = [
  { to: "/app", label: "Dashboard", end: true, icon: DashboardIcon },
  { to: "/app/inventory", label: "Inventory", icon: BoxIcon },
  { to: "/app/catalogue", label: "Catalogue", icon: CatalogueIcon },
  { to: "/app/stock", label: "Stock", icon: ArrowsIcon, permission: "stock" },
  {
    to: "/app/categories",
    label: "Categories",
    icon: TagIcon,
    permission: "categories",
  },
  { to: "/app/staff", label: "Staff", icon: UsersIcon, merchantOnly: true },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon, merchantOnly: true },
];

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  dev: "Dev",
  merchant: "Merchant",
  staff: "Staff",
};

export default function MerchantLayout() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api<Profile>("/api/merchant/profile"));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const shopName = profile?.merchant?.name ?? "Your shop";
  const shopImage = imageSrc(profile?.merchant?.profileImageKey);
  const userName = profile?.user.name ?? session?.user.name ?? "Account";
  const role = profile?.user.role ?? session?.user.role ?? "";
  const permissions: StaffPermission[] =
    profile?.user.permissions ??
    (role === "merchant" ? [...staffPermissionValues] : []);

  const visibleNavigation = navigation.filter((item) => {
    if (item.merchantOnly) return role === "merchant";
    if (item.permission) return permissions.includes(item.permission);
    return true;
  });

  async function signOut() {
    await authClient.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          {shopImage ? (
            <img
              src={shopImage}
              alt=""
              className="size-9 shrink-0 rounded-full border object-cover"
            />
          ) : (
            <img src="/brand/mushak.png" alt="" className="h-9 w-auto" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{shopName}</p>
            <p className="text-xs text-muted-foreground">Mushak inventory</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center justify-between gap-2 px-2 pb-3">
            <span className="text-xs font-medium text-muted-foreground">
              Appearance
            </span>
            <ThemeToggle />
          </div>
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">
              {roleLabels[role] ?? role}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {shopImage ? (
                <img
                  src={shopImage}
                  alt=""
                  className="size-8 shrink-0 rounded-full border object-cover"
                />
              ) : (
                <img src="/brand/mushak.png" alt="" className="h-8 w-auto" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{shopName}</p>
                <p className="text-xs text-muted-foreground">
                  {userName} · {roleLabels[role] ?? role}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>

          <div className="flex items-center gap-2 px-2 pb-2">
            <nav className="flex flex-1 gap-1 overflow-x-auto">
              {visibleNavigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )
                  }
                >
                  <item.icon />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <ThemeToggle className="shrink-0" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {error ? (
            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <MerchantProfileProvider profile={profile} refresh={loadProfile}>
            <Outlet />
          </MerchantProfileProvider>
        </main>
      </div>
    </div>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <Icon>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </Icon>
  );
}

function BoxIcon() {
  return (
    <Icon>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </Icon>
  );
}

function ArrowsIcon() {
  return (
    <Icon>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </Icon>
  );
}

function CatalogueIcon() {
  return (
    <Icon>
      <path d="m12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </Icon>
  );
}

function TagIcon() {
  return (
    <Icon>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </Icon>
  );
}

function UsersIcon() {
  return (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a10 10 0 1 1-17.66-17.66l.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 13 22c0-3.87 3.13-7 7-7s7 3.13 7 7a1.65 1.65 0 0 0-.59 3Z" />
    </Icon>
  );
}
