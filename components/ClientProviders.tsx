"use client"

import {ReactNode, useState} from "react";
import {QueryClientProvider, QueryClient} from "@tanstack/react-query";
import {FlagsProvider} from "@flags-gg/react-library";
import {env} from "@/lib/env"
import GuestSync from "@/components/GuestSync";

export default function ClientProviders({children}: {children: ReactNode}) {
  const [queryClient] = useState(() => new QueryClient())
  const flagConfig = {
    projectId: env.NEXT_PUBLIC_FLAGS_PROJECT,
    agentId: env.NEXT_PUBLIC_FLAGS_AGENT,
    environmentId: env.NEXT_PUBLIC_FLAGS_ENVIRONMENT,
  }

  return <QueryClientProvider client={queryClient}>
    <FlagsProvider options={flagConfig}>
      <GuestSync />
      {children}
    </FlagsProvider>
  </QueryClientProvider>
}