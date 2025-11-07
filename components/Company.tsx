"use client"

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {useUser} from "@clerk/nextjs";
import {useFlags} from "@flags-gg/react-library";
import {useQuery} from "@tanstack/react-query";

async function getCompanies() {
  const res = await fetch(`/api/companies`, {
    method: "GET",
  })

  if (!res.ok) {
    throw new Error("Failed to fetch companies from client")
  }

  return await res.json() as [string]
}

export function Companies() {
  const {user} = useUser()
  const {is} = useFlags()

  const {data, error} = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: getCompanies,
  })

  if (!user) {
    return null
  }

  if (!is("companies list")?.enabled()) {
    return null
  }

  return (
    <Command className="rounded-lg border shadow-md md:min-w-[450px]">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {data?.map((company) => (
          <CommandItem>{company}</CommandItem>
        ))}
      </CommandList>
    </Command>
  )
}
