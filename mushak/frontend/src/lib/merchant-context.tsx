import { createContext, useContext, type ReactNode } from "react";

import type { Profile } from "./types";

/**
 * The signed-in shop user, loaded once by MerchantLayout.
 *
 * Pages read permissions from here instead of trusting `session.user.role`,
 * because a staff account can be limited without changing its role.
 */
type MerchantProfileValue = {
  profile: Profile | null;
  /** Re-reads the profile after a Settings save. */
  refresh: () => Promise<void>;
};

const MerchantProfileContext = createContext<MerchantProfileValue | null>(null);

export function MerchantProfileProvider({
  profile,
  refresh,
  children,
}: {
  profile: Profile | null;
  refresh: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <MerchantProfileContext.Provider value={{ profile, refresh }}>
      {children}
    </MerchantProfileContext.Provider>
  );
}

export function useMerchantProfile() {
  return useContext(MerchantProfileContext)?.profile ?? null;
}

export function useRefreshMerchantProfile() {
  return useContext(MerchantProfileContext)?.refresh ?? (async () => {});
}
