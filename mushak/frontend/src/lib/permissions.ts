import { authClient } from "./auth-client";
import { useMerchantProfile } from "./merchant-context";
import {
  staffPermissionValues,
  type StaffPermission,
} from "./types";

export const permissionDetails: Array<{
  value: StaffPermission;
  label: string;
  description: string;
}> = [
  {
    value: "stock",
    label: "Move stock",
    description: "Record purchases, sales, damage and stock adjustments.",
  },
  {
    value: "catalogue",
    label: "Manage catalogue",
    description: "Add, edit and archive products, prices, SKU and GST.",
  },
  {
    value: "categories",
    label: "Manage categories",
    description: "Create, rename and delete categories.",
  },
];

export const permissionLabels: Record<StaffPermission, string> = {
  stock: "Stock",
  catalogue: "Catalogue",
  categories: "Categories",
};

/**
 * The signed-in user's effective permissions.
 *
 * While the profile request is still in flight, merchants are assumed to have
 * everything so their controls do not flicker; staff start with none.
 */
export function usePermissions() {
  const profile = useMerchantProfile();
  const { data: session } = authClient.useSession();

  const role = profile?.user.role ?? session?.user.role ?? "";
  const permissions: StaffPermission[] =
    profile?.user.permissions ??
    (role === "merchant" ? [...staffPermissionValues] : []);

  return {
    profile,
    role,
    permissions,
    isMerchant: role === "merchant",
    can: (permission: StaffPermission) => permissions.includes(permission),
  };
}
