import React, {PropsWithChildren} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'

export function withQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
    },
  })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

export function Providers({children}: PropsWithChildren) {
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
