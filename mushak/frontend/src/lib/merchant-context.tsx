import { createContext, useContext, type ReactNode } from "react";

import type { Profile } from "./types";

/**
 * The signed-in shop user, loaded once by MerchantLayout.
 *
 * Pages read permissions from here instead of trusting `session.user.role`,
 * because a staff account can be limited without changing its role.
 */
const MerchantProfileContext = createContext<Profile | null>(null);

export function MerchantProfileProvider({
  profile,
  children,
}: {
  profile: Profile | null;
  children: ReactNode;
}) {
  return (
    <MerchantProfileContext.Provider value={profile}>
      {children}
    </MerchantProfileContext.Provider>
  );
}

export function useMerchantProfile() {
  return useContext(MerchantProfileContext);
}
