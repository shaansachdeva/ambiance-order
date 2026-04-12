"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({
  children,
  session,
  refetchOnWindowFocus,
  refetchInterval,
}: {
  children: React.ReactNode;
  session: any;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
}) {
  return (
    <NextAuthSessionProvider
      session={session}
      refetchOnWindowFocus={refetchOnWindowFocus}
      refetchInterval={refetchInterval}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
